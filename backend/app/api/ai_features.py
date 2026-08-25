"""
AI features API — emergency simulation, redistribution optimization,
resilience scoring, model performance, explainability, and federated training.

Production features:
- Uses ModelRegistry for cached model loading (no per-request disk reads)
- Structured logging
- Proper response models
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.db_models import ModelPerformance, Prediction
from app.schemas.schemas import (
    EmergencySimulateRequest, EmergencySimulateResponse,
    RedistributionResponse, ResilienceScoreOut,
    FederatedTrainRequest, ModelPerformanceOut,
    ExplainabilityResponse,
)
from app.ml.preprocessing.features import load_panel, compute_stockout_labels, build_features, FEATURE_COLS
from app.services import emergency_simulation
from app.services.resilience_service import compute_resilience_scores
from app.services.model_registry import model_registry
from app.optimization import redistribution as redist
from app.core.logging import get_logger
from app.core.exceptions import EntityNotFoundError, ModelNotReadyError

logger = get_logger("api.ai_features")

router = APIRouter(prefix="/api", tags=["ai-features"])


@router.post("/emergency/simulate", response_model=EmergencySimulateResponse)
def simulate_emergency(req: EmergencySimulateRequest, db: Session = Depends(get_db)):
    """
    Simulate an emergency scenario (dengue, flu, GI outbreak, or custom sliders).
    Returns before/after risk comparison across all PHCs.
    """
    logger.info(
        "Emergency simulation: scenario=%s, patient_pct=%.1f, supply_pct=%.1f",
        req.scenario, req.patient_increase_pct, req.supply_disruption_pct,
    )

    df = load_panel()
    df = compute_stockout_labels(df)
    df = build_features(df)
    latest_date = df["date"].max()
    snapshot = df[df["date"] == latest_date]

    if snapshot.empty:
        raise EntityNotFoundError("Snapshot", "latest date")

    result = emergency_simulation.run_simulation(
        snapshot, scenario=req.scenario,
        patient_increase_pct=req.patient_increase_pct,
        supply_disruption_pct=req.supply_disruption_pct,
    )

    logger.info(
        "Emergency simulation result: avg_risk %.4f → %.4f, newly_critical=%d",
        result["avg_risk_before"], result["avg_risk_after"], result["phcs_newly_critical"],
    )
    return result


@router.post("/optimize/redistribution", response_model=RedistributionResponse)
def optimize_redistribution(db: Session = Depends(get_db)):
    """
    Run OR-Tools optimization to recommend cross-PHC medicine redistribution.
    Uses the cached champion model to score risk across all PHC/medicine combos.
    """
    logger.info("Redistribution optimization started")

    df = load_panel()
    df = compute_stockout_labels(df)
    df = build_features(df)
    latest_date = df["date"].max()
    snapshot = df[df["date"] == latest_date]

    # Use cached model from registry
    model, model_type = model_registry.get_stockout_champion(db)
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
        logger.info("Redistribution: no transfers needed")
        return {
            "as_of_date": str(latest_date.date()), "total_transfer_orders": 0,
            "total_units_redistributed": 0, "at_risk_phcs_addressed": 0, "transfers": [],
        }

    logger.info(
        "Redistribution: %d transfers, %d units, %d at-risk PHCs addressed",
        len(transfers_df), int(transfers_df["quantity"].sum()),
        int(transfers_df["to_phc"].nunique()),
    )

    return {
        "as_of_date": str(latest_date.date()),
        "total_transfer_orders": len(transfers_df),
        "total_units_redistributed": int(transfers_df["quantity"].sum()),
        "at_risk_phcs_addressed": int(transfers_df["to_phc"].nunique()),
        "transfers": transfers_df.to_dict(orient="records"),
    }


@router.get("/resilience-score", response_model=list[ResilienceScoreOut])
def resilience_score():
    """
    Compute district-level resilience scores (0-100).
    Weighted composite of medicine availability, bed capacity,
    staffing adequacy, and emergency readiness.
    """
    logger.info("Computing resilience scores")
    scores = compute_resilience_scores()
    if scores.empty:
        raise EntityNotFoundError("Resilience data", "latest date")
    return scores.to_dict(orient="records")


@router.get("/models/performance", response_model=list[ModelPerformanceOut])
def models_performance(task: str = None, db: Session = Depends(get_db)):
    """List model evaluation metrics. Optionally filter by task name."""
    q = db.query(ModelPerformance)
    if task:
        q = q.filter(ModelPerformance.task == task)
    return q.order_by(ModelPerformance.task, ModelPerformance.trained_at.desc()).all()


@router.get("/explainability/{prediction_id}", response_model=ExplainabilityResponse)
def get_explanation(prediction_id: int, db: Session = Depends(get_db)):
    """
    Retrieve SHAP-based explanation for a specific prediction.
    Shows top risk drivers, their contribution percentages, and direction.
    """
    pred = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if pred is None:
        raise EntityNotFoundError("Prediction", prediction_id)
    return {
        "prediction_id": pred.id, "prediction_type": pred.prediction_type,
        "selected_model": pred.selected_model, "final_prediction": pred.final_prediction,
        "risk_level": pred.risk_level, "explanation": pred.explanation,
        "all_model_outputs": pred.all_model_outputs,
    }


@router.post("/federated/train")
def federated_train(req: FederatedTrainRequest):
    """
    Run federated learning simulation across 5 BRICS national clients.

    NOTE: This runs the full Flower simulation synchronously and can take
    a few minutes. For production, consider running asynchronously with
    a task queue (Celery/RQ).
    """
    logger.info("Federated training started: %d rounds", req.rounds)
    from app.ml.federated.federated_train import run_federated_training
    try:
        result = run_federated_training(rounds=req.rounds)
        logger.info("Federated training completed successfully")
        return result
    except Exception as e:
        logger.exception("Federated training failed")
        raise HTTPException(status_code=500, detail=f"Federated training failed: {e}")
