from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.schemas import (
    DemandPredictRequest, DemandPredictResponse,
    StockoutPredictRequest, StockoutPredictResponse,
)
from app.services import prediction_service

router = APIRouter(prefix="/api/predict", tags=["prediction"])


@router.post("/demand", response_model=DemandPredictResponse)
def predict_demand(req: DemandPredictRequest, db: Session = Depends(get_db)):
    try:
        result = prediction_service.predict_demand(db, req.phc_id, req.medicine, req.horizon_days)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/stockout", response_model=StockoutPredictResponse)
def predict_stockout(req: StockoutPredictRequest, db: Session = Depends(get_db)):
    try:
        result = prediction_service.predict_stockout(db, req.phc_id, req.medicine)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
