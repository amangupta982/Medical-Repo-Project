"""
This is the service behind the "Prediction button" flow described in the spec:
React -> FastAPI -> load data -> preprocess -> run XGBoost -> run LightGBM ->
run LSTM (where applicable) -> compare against STORED validation metrics ->
select winner -> log to `predictions` table -> return full comparison + final answer.

Design choice: we do NOT retrain on every click (too slow for a UI button).
Instead, at request time we:
  1. Load the already-trained model artifacts for each candidate model.
  2. Run live inference for the specific PHC/medicine/date requested.
  3. Pull each model's STORED held-out validation metrics (from training time)
     to decide which model is trusted as champion -- selection is based on
     validation performance, not on which prediction looks most convenient.
"""
import os
import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb

from sqlalchemy.orm import Session
from app.models.db_models import ModelPerformance, Prediction, PHC, Medicine
from app.ml.preprocessing.features import load_panel, compute_stockout_labels, build_features, FEATURE_COLS
from app.ml.explainability.shap_service import explain_row

RISK_THRESHOLDS = [(0.85, "CRITICAL"), (0.6, "HIGH"), (0.3, "MEDIUM"), (0.0, "LOW")]


def risk_level_for(prob: float) -> str:
    for thr, label in RISK_THRESHOLDS:
        if prob >= thr:
            return label
    return "LOW"


def _get_feature_row(phc_id: str, medicine: str):
    df = load_panel()
    df = compute_stockout_labels(df)
    df = build_features(df)
    sub = df[(df["phc_id"] == phc_id) & (df["medicine"] == medicine)]
    if sub.empty:
        raise ValueError(f"No data found for PHC={phc_id}, medicine={medicine}")
    return sub.sort_values("date").iloc[-1], df  # latest snapshot + full df (for peer context if needed)


def predict_stockout(db: Session, phc_id: str, medicine: str) -> dict:
    row, _ = _get_feature_row(phc_id, medicine)
    X = row[FEATURE_COLS].to_frame().T.astype(float)

    perf_rows = db.query(ModelPerformance).filter(ModelPerformance.task == "stockout_classification").all()
    if not perf_rows:
        raise RuntimeError("No trained stock-out models found. Run app/ml/classification/train_stockout.py first.")

    all_outputs = []
    champion_row = None
    for pr in perf_rows:
        if pr.model_name == "baseline":
            prob = 1.0 if row["days_of_stock_left"] < row["lead_time_days"] * 1.3 else 0.0
        elif pr.model_name == "logistic_regression":
            continue  # secondary baseline, not served live (kept for the comparison table only)
        elif pr.model_name == "xgboost":
            m = xgb.XGBClassifier(); m.load_model(pr.model_artifact_path)
            prob = float(m.predict_proba(X)[:, 1][0])
        elif pr.model_name == "lightgbm":
            booster = lgb.Booster(model_file=pr.model_artifact_path)
            prob = float(booster.predict(X)[0])
        else:
            continue
        all_outputs.append({"model": pr.model_name, "prediction": round(prob, 4), "metrics": pr.metrics})
        if pr.is_current_champion:
            champion_row = pr
            champion_prob = prob

    if champion_row is None:
        raise RuntimeError("No champion model flagged in model_performance.")

    driver_info = explain_row(row)

    pred_log = Prediction(
        prediction_type="stockout",
        phc_id=db.query(PHC).filter(PHC.code == phc_id).first().id,
        medicine_id=db.query(Medicine).filter(Medicine.name == medicine).first().id,
        selected_model=champion_row.model_name,
        final_prediction=champion_prob,
        all_model_outputs=all_outputs,
        evaluation_metrics=champion_row.metrics,
        risk_level=risk_level_for(champion_prob),
        explanation=driver_info,
    )
    db.add(pred_log)
    db.commit()
    db.refresh(pred_log)

    expected_days = row["days_of_stock_left"] if row["consumption_ma7"] > 0 else None

    return {
        "phc_id": phc_id, "medicine": medicine,
        "current_stock": int(row["current_stock"]),
        "predicted_demand_per_day": round(float(row["consumption_ma7"]), 2),
        "expected_stockout_days": round(float(expected_days), 1) if expected_days is not None else None,
        "stockout_probability": round(champion_prob, 4),
        "risk_level": risk_level_for(champion_prob),
        "selected_model": champion_row.model_name,
        "all_model_outputs": all_outputs,
        "top_drivers": driver_info["top_drivers"],
        "prediction_id": pred_log.id,
        "selection_reason": f"{champion_row.model_name} selected: highest PR-AUC "
                             f"({champion_row.metrics.get('pr_auc')}) on held-out time-based validation set.",
    }


def predict_demand(db: Session, phc_id: str, medicine: str, horizon_days: int = 1) -> dict:
    row, _ = _get_feature_row(phc_id, medicine)
    X = row[FEATURE_COLS].to_frame().T.astype(float)

    perf_rows = db.query(ModelPerformance).filter(ModelPerformance.task == "demand_forecast_1d").all()
    if not perf_rows:
        raise RuntimeError("No trained demand models found. Run app/ml/forecasting/train_demand.py first.")

    all_outputs = []
    champion_row = None
    champion_pred = None
    for pr in perf_rows:
        if pr.model_name in ("naive_lag1", "moving_average_7d"):
            pred = float(row["consumption_lag1"]) if pr.model_name == "naive_lag1" else float(row["consumption_ma7"])
        elif pr.model_name == "xgboost":
            m = xgb.XGBRegressor(); m.load_model(pr.model_artifact_path)
            pred = float(max(0, m.predict(X)[0]))
        elif pr.model_name == "lightgbm":
            booster = lgb.Booster(model_file=pr.model_artifact_path)
            pred = float(max(0, booster.predict(X)[0]))
        elif pr.model_name == "lstm":
            # LSTM needs the 14-day sequence; skipped in the lightweight live-inference
            # path unless the sequence builder is wired in -- metrics still shown for comparison.
            pred = None
        else:
            continue
        all_outputs.append({"model": pr.model_name, "prediction": round(pred, 2) if pred is not None else None,
                             "metrics": pr.metrics})
        if pr.is_current_champion and pred is not None:
            champion_row, champion_pred = pr, pred

    if champion_row is None:
        # fall back to best available model among those we could actually score live
        scored = [o for o in all_outputs if o["prediction"] is not None]
        champion_row = min(perf_rows, key=lambda r: r.metrics.get("mae", 1e9))
        champion_pred = next((o["prediction"] for o in scored if o["model"] == champion_row.model_name), None)

    final_pred = champion_pred * horizon_days if champion_pred is not None else None

    pred_log = Prediction(
        prediction_type="demand",
        phc_id=db.query(PHC).filter(PHC.code == phc_id).first().id,
        medicine_id=db.query(Medicine).filter(Medicine.name == medicine).first().id,
        horizon_days=horizon_days,
        selected_model=champion_row.model_name,
        final_prediction=final_pred,
        all_model_outputs=all_outputs,
        evaluation_metrics=champion_row.metrics,
    )
    db.add(pred_log)
    db.commit()
    db.refresh(pred_log)

    return {
        "phc_id": phc_id, "medicine": medicine, "horizon_days": horizon_days,
        "all_model_outputs": all_outputs,
        "selected_model": champion_row.model_name,
        "final_prediction": round(final_pred, 2) if final_pred is not None else None,
        "selection_reason": f"{champion_row.model_name} selected: lowest MAE "
                             f"({champion_row.metrics.get('mae')}) on held-out time-based validation set.",
    }
