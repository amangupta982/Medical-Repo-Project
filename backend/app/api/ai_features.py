from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import xgboost as xgb
import lightgbm as lgb

from app.database.session import get_db
from app.models.db_models import ModelPerformance, Prediction
from app.schemas.schemas import (
    EmergencySimulateRequest, RedistributionResponse, ResilienceScoreOut,
    FederatedTrainRequest, ModelPerformanceOut,
)
from app.ml.preprocessing.features import load_panel, compute_stockout_labels, build_features, FEATURE_COLS
from app.services import emergency_simulation
from app.services.resilience_service import compute_resilience_scores
from app.optimization import redistribution as redist

router = APIRouter(prefix="/api", tags=["ai-features"])


def _load_champion_stockout_model(db: Session):
    row = db.query(ModelPerformance).filter(
        ModelPerformance.task == "stockout_classification",
        ModelPerformance.is_current_champion == True,
    ).first()
    if row is None:
        raise HTTPException(status_code=503, detail="No trained stock-out model available.")
    if row.model_name == "xgboost":
        m = xgb.XGBClassifier(); m.load_model(row.model_artifact_path)
        return m, "xgboost"
    booster = lgb.Booster(model_file=row.model_artifact_path)
    return booster, "lightgbm"


@router.post("/emergency/simulate")
def simulate_emergency(req: EmergencySimulateRequest, db: Session = Depends(get_db)):
    df = load_panel()
    df = compute_stockout_labels(df)
    df = build_features(df)
    latest_date = df["date"].max()
    snapshot = df[df["date"] == latest_date]
    if snapshot.empty:
        raise HTTPException(status_code=404, detail="No current snapshot available.")

    result = emergency_simulation.run_simulation(
        snapshot, scenario=req.scenario,
        patient_increase_pct=req.patient_increase_pct,
        supply_disruption_pct=req.supply_disruption_pct,
    )
    return result


@router.post("/optimize/redistribution", response_model=RedistributionResponse)
def optimize_redistribution(db: Session = Depends(get_db)):
    df = load_panel()
    df = compute_stockout_labels(df)
    df = build_features(df)
    latest_date = df["date"].max()
    snapshot = df[df["date"] == latest_date]

    model, model_type = _load_champion_stockout_model(db)
    X = snapshot[FEATURE_COLS]
    if model_type == "xgboost":
        probs = model.predict_proba(X)[:, 1]
    else:
        probs = model.predict(X)
    snapshot = snapshot.copy()
    snapshot["risk_score"] = probs

    risk_by_medicine = {}
    for med in snapshot["medicine"].unique():
        sub = snapshot[snapshot["medicine"] == med]
        risk_by_medicine[med] = dict(zip(sub["phc_id"], sub["risk_score"]))

    transfers_df = redist.optimize_all_medicines(risk_by_medicine, as_of_date=str(latest_date.date()))

    if transfers_df.empty:
        return {
            "as_of_date": str(latest_date.date()), "total_transfer_orders": 0,
            "total_units_redistributed": 0, "at_risk_phcs_addressed": 0, "transfers": [],
        }

    return {
        "as_of_date": str(latest_date.date()),
        "total_transfer_orders": len(transfers_df),
        "total_units_redistributed": int(transfers_df["quantity"].sum()),
        "at_risk_phcs_addressed": int(transfers_df["to_phc"].nunique()),
        "transfers": transfers_df.to_dict(orient="records"),
    }


@router.get("/resilience-score", response_model=list[ResilienceScoreOut])
def resilience_score():
    scores = compute_resilience_scores()
    if scores.empty:
        raise HTTPException(status_code=404, detail="No resilience data available.")
    return scores.to_dict(orient="records")


@router.get("/models/performance", response_model=list[ModelPerformanceOut])
def models_performance(task: str = None, db: Session = Depends(get_db)):
    q = db.query(ModelPerformance)
    if task:
        q = q.filter(ModelPerformance.task == task)
    return q.order_by(ModelPerformance.task, ModelPerformance.trained_at.desc()).all()


@router.get("/explainability/{prediction_id}")
def get_explanation(prediction_id: int, db: Session = Depends(get_db)):
    pred = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if pred is None:
        raise HTTPException(status_code=404, detail="Prediction not found.")
    return {
        "prediction_id": pred.id, "prediction_type": pred.prediction_type,
        "selected_model": pred.selected_model, "final_prediction": pred.final_prediction,
        "risk_level": pred.risk_level, "explanation": pred.explanation,
        "all_model_outputs": pred.all_model_outputs,
    }


@router.post("/federated/train")
def federated_train(req: FederatedTrainRequest):
    """NOTE: this runs the full Flower simulation synchronously and can take
    a few minutes depending on machine specs. For a snappier demo, pre-run
    `python app/ml/federated/federated_train.py` and cache the JSON output;
    this endpoint is wired for the live/real run per the spec."""
    from app.ml.federated.federated_train import run_federated_training
    try:
        result = run_federated_training(rounds=req.rounds)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Federated training failed: {e}")
