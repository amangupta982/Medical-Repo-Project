"""
SHAP explainability service. Loads the champion stock-out model (as recorded
in model_performance) and produces per-PHC-medicine local explanations:
which factors are pushing THIS prediction toward/away from stock-out risk,
in a format non-technical health officials can read (named factor + % contribution).
"""
import os
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
import lightgbm as lgb

from app.database.session import SessionLocal
from app.models.db_models import ModelPerformance
from app.ml.preprocessing.features import FEATURE_COLS

READABLE_NAMES = {
    "consumption_lag1": "Yesterday's consumption",
    "consumption_ma7": "7-day avg consumption",
    "consumption_ma14": "14-day avg consumption",
    "consumption_std7": "Consumption volatility (7d)",
    "consumption_trend": "Rising/falling demand trend",
    "current_stock": "Current stock level",
    "days_of_stock_left": "Days of stock remaining",
    "stock_lag1": "Yesterday's stock level",
    "stock_delta_7d": "Stock change over 7 days",
    "patients": "Today's patient footfall",
    "patients_ma7": "7-day avg patient footfall",
    "patients_ma14": "14-day avg patient footfall",
    "patients_zscore": "Footfall anomaly (z-score)",
    "footfall_surge": "Footfall surge flag",
    "doctor_shortfall": "Doctor staffing shortfall",
    "nurse_shortfall": "Nurse staffing shortfall",
    "bed_occupancy_rate": "Bed occupancy rate",
    "day_of_week": "Day of week",
    "doy_sin": "Seasonal position (sin)",
    "doy_cos": "Seasonal position (cos)",
    "outbreak_active": "Active disease outbreak",
    "is_remote": "Remote PHC (longer resupply)",
    "lead_time_days": "Resupply lead time (days)",
    "district_peer_stockout_rate": "Peer PHCs' stock-out rate",
}


def _load_champion_model():
    db = SessionLocal()
    row = db.query(ModelPerformance).filter(
        ModelPerformance.task == "stockout_classification",
        ModelPerformance.is_current_champion == True,
    ).first()
    db.close()
    if row is None:
        raise RuntimeError("No champion stock-out model found. Run train_stockout.py first.")

    if row.model_name == "xgboost":
        model = xgb.XGBClassifier()
        model.load_model(row.model_artifact_path)
        return model, "xgboost"
    elif row.model_name == "lightgbm":
        booster = lgb.Booster(model_file=row.model_artifact_path)
        return booster, "lightgbm"
    else:
        raise RuntimeError(f"Champion model '{row.model_name}' has no SHAP loader configured.")


def explain_row(feature_row: pd.Series, top_k: int = 5) -> dict:
    """feature_row must contain all FEATURE_COLS. Returns top_k drivers with
    plain-language names and their SHAP contribution (positive = increases risk)."""
    model, model_type = _load_champion_model()
    X = pd.DataFrame([[float(feature_row[c]) for c in FEATURE_COLS]], columns=FEATURE_COLS)

    if model_type == "xgboost":
        explainer = shap.TreeExplainer(model)
        sv = explainer.shap_values(X)[0]
    else:  # lightgbm booster
        explainer = shap.TreeExplainer(model)
        raw = explainer.shap_values(X)
        sv = raw[1][0] if isinstance(raw, list) else raw[0]

    contribs = sorted(zip(FEATURE_COLS, sv, X.iloc[0].values), key=lambda t: abs(t[1]), reverse=True)[:top_k]
    total_abs = sum(abs(v) for _, v, _ in contribs) or 1.0
    return {
        "top_drivers": [
            {
                "factor": READABLE_NAMES.get(f, f),
                "feature": f,
                "contribution_pct": round(abs(v) / total_abs * 100, 1),
                "direction": "increases_risk" if v > 0 else "decreases_risk",
                "value": round(float(val), 2),
            }
            for f, v, val in contribs
        ]
    }


def explain_batch(features_df: pd.DataFrame, top_k: int = 5) -> pd.DataFrame:
    """Vectorized version for the /api/explainability bulk use case (e.g. dashboard load)."""
    model, model_type = _load_champion_model()
    X = features_df[FEATURE_COLS]
    explainer = shap.TreeExplainer(model)
    sv = explainer.shap_values(X)
    if isinstance(sv, list):
        sv = sv[1]

    out = []
    for i in range(len(X)):
        row_sv = sv[i]
        contribs = sorted(zip(FEATURE_COLS, row_sv), key=lambda t: abs(t[1]), reverse=True)[:top_k]
        total_abs = sum(abs(v) for _, v in contribs) or 1.0
        out.append([
            {"factor": READABLE_NAMES.get(f, f), "contribution_pct": round(abs(v) / total_abs * 100, 1),
             "direction": "increases_risk" if v > 0 else "decreases_risk"}
            for f, v in contribs
        ])
    features_df = features_df.copy()
    features_df["top_drivers"] = out
    return features_df
