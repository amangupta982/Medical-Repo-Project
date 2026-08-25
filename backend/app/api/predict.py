"""
Prediction API routes — demand forecasting and stock-out risk.

Production features:
- Structured error responses via exception hierarchy (no bare try/except)
- Structured logging for every prediction request
- Response models enforced
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.schemas import (
    DemandPredictRequest, DemandPredictResponse,
    StockoutPredictRequest, StockoutPredictResponse,
)
from app.services import prediction_service
from app.core.logging import get_logger

logger = get_logger("api.predict")

router = APIRouter(prefix="/api/predict", tags=["prediction"])


@router.post("/demand", response_model=DemandPredictResponse)
def predict_demand(req: DemandPredictRequest, db: Session = Depends(get_db)):
    """
    Predict medicine demand for a PHC at a given horizon (1-30 days).

    Runs all trained candidate models, selects the champion based on stored
    validation metrics, and returns the full comparison.
    """
    logger.info(
        "Demand prediction request: phc=%s, medicine=%s, horizon=%dd",
        req.phc_id, req.medicine, req.horizon_days,
    )
    # Exceptions (ValueError, RuntimeError) are handled globally
    result = prediction_service.predict_demand(db, req.phc_id, req.medicine, req.horizon_days)
    logger.info(
        "Demand prediction result: phc=%s, medicine=%s, model=%s, prediction=%.2f",
        req.phc_id, req.medicine, result["selected_model"], result["final_prediction"],
    )
    return result


@router.post("/stockout", response_model=StockoutPredictResponse)
def predict_stockout(req: StockoutPredictRequest, db: Session = Depends(get_db)):
    """
    Predict stock-out risk for a PHC/medicine pair (7-day horizon).

    Returns probability, risk level, SHAP-based top drivers, and
    full multi-model comparison.
    """
    logger.info(
        "Stockout prediction request: phc=%s, medicine=%s",
        req.phc_id, req.medicine,
    )
    # Exceptions (ValueError, RuntimeError) are handled globally
    result = prediction_service.predict_stockout(db, req.phc_id, req.medicine)
    logger.info(
        "Stockout prediction result: phc=%s, medicine=%s, risk=%s, prob=%.4f",
        req.phc_id, req.medicine, result["risk_level"], result["stockout_probability"],
    )
    return result
