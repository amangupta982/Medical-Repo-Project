"""
Emergency Simulation / What-If Engine.

Takes the current feature snapshot, applies a scenario perturbation
(demand shock, disease outbreak preset, or supply disruption), re-runs the
SAME trained champion models (no retraining -- this is a stress-test of the
existing model, which is both faster and methodologically correct: we want
to know how the current system responds, not fit a new model to the scenario),
and returns before/after risk comparisons.
"""
import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb

from app.database.session import SessionLocal
from app.models.db_models import ModelPerformance
from app.ml.preprocessing.features import FEATURE_COLS

PRESETS = {
    "dengue_outbreak": {"patients_mult": 1.8, "consumption_mult_disease_linked": 2.2, "outbreak_flag": 1},
    "flu_surge": {"patients_mult": 1.4, "consumption_mult_disease_linked": 1.3, "outbreak_flag": 1},
    "gi_outbreak": {"patients_mult": 1.6, "consumption_mult_disease_linked": 2.0, "outbreak_flag": 1},
}


def _load_champion():
    db = SessionLocal()
    row = db.query(ModelPerformance).filter(
        ModelPerformance.task == "stockout_classification",
        ModelPerformance.is_current_champion == True,
    ).first()
    db.close()
    if row is None:
        raise RuntimeError("No champion stock-out model found.")
    import os
    if row.model_name == "xgboost":
        m = xgb.XGBClassifier()
        local_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", "trained", os.path.basename(row.model_artifact_path))
        m.load_model(local_path)
        return m, "xgboost"
    local_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", "trained", os.path.basename(row.model_artifact_path))
    booster = lgb.Booster(model_file=local_path)
    return booster, "lightgbm"


def _predict(model, model_type, X):
    if model_type == "xgboost":
        return model.predict_proba(X)[:, 1]
    return model.predict(X)


def apply_scenario(features_df: pd.DataFrame, scenario: str = None,
                    patient_increase_pct: float = 0.0,
                    supply_disruption_pct: float = 0.0) -> pd.DataFrame:
    """Applies either a named preset (e.g. 'dengue_outbreak') or manual sliders
    (patient_increase_pct, supply_disruption_pct) to the feature snapshot."""
    df = features_df.copy()

    if scenario and scenario in PRESETS:
        p = PRESETS[scenario]
        df["patients"] = df["patients"] * p["patients_mult"]
        df["patients_ma7"] = df["patients_ma7"] * p["patients_mult"]
        df["patients_ma14"] = df["patients_ma14"] * p["patients_mult"]
        df["outbreak_active"] = p["outbreak_flag"]
        df["consumption_ma7"] = df["consumption_ma7"] * p["consumption_mult_disease_linked"]
        df["consumption_ma14"] = df["consumption_ma14"] * p["consumption_mult_disease_linked"]
        df["consumption_lag1"] = df["consumption_lag1"] * p["consumption_mult_disease_linked"]
        df["days_of_stock_left"] = df["current_stock"] / df["consumption_ma7"].replace(0, np.nan)
        df["days_of_stock_left"] = df["days_of_stock_left"].fillna(df["current_stock"])

    if patient_increase_pct:
        mult = 1 + patient_increase_pct / 100
        df["patients"] *= mult
        df["patients_ma7"] *= mult
        df["patients_ma14"] *= mult
        df["consumption_ma7"] *= mult
        df["consumption_lag1"] *= mult
        df["days_of_stock_left"] = df["current_stock"] / df["consumption_ma7"].replace(0, np.nan)
        df["days_of_stock_left"] = df["days_of_stock_left"].fillna(df["current_stock"])

    if supply_disruption_pct:
        # simulate a lead-time blowout (supplier delay), which raises effective risk
        df["lead_time_days"] *= (1 + supply_disruption_pct / 100)

    return df


def run_simulation(features_df: pd.DataFrame, scenario: str = None,
                    patient_increase_pct: float = 0.0, supply_disruption_pct: float = 0.0) -> dict:
    model, model_type = _load_champion()

    before_prob = _predict(model, model_type, features_df[FEATURE_COLS])
    scenario_df = apply_scenario(features_df, scenario, patient_increase_pct, supply_disruption_pct)
    after_prob = _predict(model, model_type, scenario_df[FEATURE_COLS])

    result = features_df[["phc_id", "district", "medicine"]].copy() if "phc_id" in features_df.columns else pd.DataFrame()
    result["risk_before"] = before_prob
    result["risk_after"] = after_prob
    result["risk_delta"] = after_prob - before_prob

    newly_critical = result[(result["risk_after"] > 0.7) & (result["risk_before"] <= 0.7)]

    summary = {
        "scenario": scenario or "custom",
        "patient_increase_pct": patient_increase_pct,
        "supply_disruption_pct": supply_disruption_pct,
        "avg_risk_before": round(float(before_prob.mean()), 4),
        "avg_risk_after": round(float(after_prob.mean()), 4),
        "phcs_newly_critical": int(len(newly_critical)),
        "max_risk_before": round(float(before_prob.max()), 4),
        "max_risk_after": round(float(after_prob.max()), 4),
        "top_impacted": result.sort_values("risk_delta", ascending=False).head(10).to_dict(orient="records"),
    }
    return summary
