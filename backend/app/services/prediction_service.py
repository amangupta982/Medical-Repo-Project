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

Production notes:
  - Uses ModelRegistry for cached model loading (avoids ~200ms disk reads per request)
  - Structured logging for auditability
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
from app.services.model_registry import model_registry
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("services.prediction")
settings = get_settings()

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
    logger.info("Running stockout prediction: phc=%s, medicine=%s", phc_id, medicine)

    row, _ = _get_feature_row(phc_id, medicine)
    X = pd.DataFrame([[float(row[c]) for c in FEATURE_COLS]], columns=FEATURE_COLS)

    perf_rows = db.query(ModelPerformance).filter(ModelPerformance.task == "stockout_classification").all()
    if not perf_rows:
        raise RuntimeError("No trained stock-out models found. Run app/ml/classification/train_stockout.py first.")

    all_outputs = []
    champion_row = None
    models_dir = settings.models_directory

    for pr in perf_rows:
        if pr.model_name == "baseline":
            prob = 1.0 if row["days_of_stock_left"] < row["lead_time_days"] * 1.3 else 0.0
        elif pr.model_name == "logistic_regression":
            continue  # secondary baseline, not served live (kept for the comparison table only)
        elif pr.model_name == "xgboost":
            m = xgb.XGBClassifier()
            artifact_name = pr.model_artifact_path.replace('\\', '/').split('/')[-1] if pr.model_artifact_path else "xgb_stockout.json"
            local_path = os.path.join(models_dir, artifact_name)
            m.load_model(local_path)
            prob = float(m.predict_proba(X)[:, 1][0])
        elif pr.model_name == "lightgbm":
            artifact_name = pr.model_artifact_path.replace('\\', '/').split('/')[-1] if pr.model_artifact_path else "lgb_stockout.txt"
            local_path = os.path.join(models_dir, artifact_name)
            booster = lgb.Booster(model_file=local_path)
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

    logger.info(
        "Stockout prediction complete: phc=%s, medicine=%s, risk=%s, prob=%.4f, model=%s",
        phc_id, medicine, risk_level_for(champion_prob), champion_prob, champion_row.model_name,
    )

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
    logger.info(
        "Running demand prediction: phc=%s, medicine=%s, horizon=%dd",
        phc_id, medicine, horizon_days,
    )

    row, _ = _get_feature_row(phc_id, medicine)
    X = pd.DataFrame([[float(row[c]) for c in FEATURE_COLS]], columns=FEATURE_COLS)

    SUPPORTED_HORIZONS = [1, 7, 14, 30]
    mapped_horizon = min(SUPPORTED_HORIZONS, key=lambda h: abs(h - horizon_days))
    task_name = f"demand_forecast_{mapped_horizon}d"

    perf_rows = db.query(ModelPerformance).filter(ModelPerformance.task == task_name).all()
    if not perf_rows and mapped_horizon != 1:
        # Fallback if specific horizon rows not yet populated
        perf_rows = db.query(ModelPerformance).filter(ModelPerformance.task == "demand_forecast_1d").all()

    if not perf_rows:
        raise RuntimeError(f"No trained demand models found for task {task_name}. Run app/ml/forecasting/train_demand.py first.")

    all_outputs = []
    champion_row = None
    champion_pred = None
    models_dir = settings.models_directory

    for pr in perf_rows:
        if pr.model_name == "naive_lag1":
            pred = float(row["consumption_lag1"]) * mapped_horizon
        elif pr.model_name == "moving_average_7d":
            pred = float(row["consumption_ma7"]) * mapped_horizon
        elif pr.model_name == "xgboost":
            try:
                m, _ = model_registry.get_demand_model(db, "xgboost", mapped_horizon)
                pred = float(max(0, m.predict(X)[0]))
            except Exception:
                # Fallback to direct load
                m = xgb.XGBRegressor()
                artifact_file = pr.model_artifact_path.replace('\\', '/').split('/')[-1] if pr.model_artifact_path else f"xgb_demand_{mapped_horizon}d.json"
                local_path = os.path.join(models_dir, artifact_file)
                if not os.path.exists(local_path):
                    local_path = os.path.join(models_dir, "xgb_demand.json")
                m.load_model(local_path)
                pred = float(max(0, m.predict(X)[0]))
        elif pr.model_name == "lightgbm":
            try:
                booster, _ = model_registry.get_demand_model(db, "lightgbm", mapped_horizon)
                pred = float(max(0, booster.predict(X)[0]))
            except Exception:
                # Fallback to direct load
                artifact_file = pr.model_artifact_path.replace('\\', '/').split('/')[-1] if pr.model_artifact_path else f"lgb_demand_{mapped_horizon}d.txt"
                local_path = os.path.join(models_dir, artifact_file)
                if not os.path.exists(local_path):
                    local_path = os.path.join(models_dir, "lgb_demand.txt")
                booster = lgb.Booster(model_file=local_path)
                pred = float(max(0, booster.predict(X)[0]))
        elif pr.model_name == "lstm":
            # LSTM requires a 14-day sequential sliding window tensor reconstruction at request time.
            # To preserve sub-50ms API responsiveness for interactive dashboards, LSTM is evaluated as
            # an offline 1-day benchmark (train_demand_lstm.py) and excluded from live multi-horizon scoring.
            pred = None
        else:
            continue

        all_outputs.append({
            "model": pr.model_name,
            "prediction": round(pred, 2) if pred is not None else None,
            "metrics": pr.metrics
        })
        if pr.is_current_champion and pred is not None:
            champion_row, champion_pred = pr, pred

    if champion_row is None:
        # Fall back to lowest MAE among scored candidates
        scored = [o for o in all_outputs if o["prediction"] is not None]
        champion_row = min(perf_rows, key=lambda r: r.metrics.get("mae", 1e9))
        champion_pred = next((o["prediction"] for o in scored if o["model"] == champion_row.model_name), None)

    # For exact supported horizons (1, 7, 14, 30), final_pred is directly the model output.
    # For custom off-grid horizons, scale proportionally from the nearest modeled horizon.
    if horizon_days == mapped_horizon:
        final_pred = champion_pred
    else:
        final_pred = (champion_pred / mapped_horizon) * horizon_days if (champion_pred is not None and mapped_horizon > 0) else champion_pred

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

    logger.info(
        "Demand prediction complete: phc=%s, medicine=%s, horizon=%dd, model=%s, prediction=%.2f",
        phc_id, medicine, horizon_days, champion_row.model_name,
        final_pred if final_pred is not None else 0,
    )

    return {
        "phc_id": phc_id,
        "medicine": medicine,
        "horizon_days": horizon_days,
        "all_model_outputs": all_outputs,
        "selected_model": champion_row.model_name,
        "final_prediction": round(final_pred, 2) if final_pred is not None else None,
        "selection_reason": f"{champion_row.model_name} selected for {task_name}: lowest MAE "
                             f"({champion_row.metrics.get('mae')}) on held-out time-based validation set.",
    }
