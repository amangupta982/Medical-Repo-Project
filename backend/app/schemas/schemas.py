from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime


class PHCOut(BaseModel):
    code: str
    name: str
    district: str
    total_beds: int
    sanctioned_doctors: int
    sanctioned_nurses: int
    catchment_population: int
    is_remote: bool
    lat: float
    lon: float
    class Config:
        from_attributes = True


class DistrictOut(BaseModel):
    name: str
    state: str
    capacity_factor: float
    lat: Optional[float]
    lon: Optional[float]
    class Config:
        from_attributes = True


class InventoryOut(BaseModel):
    phc_id: str
    medicine: str
    date: date
    current_stock: int
    lead_time_days: float


class AlertOut(BaseModel):
    id: int
    created_at: datetime
    phc_id: Optional[str]
    district_id: Optional[str]
    alert_type: str
    severity: str
    message: str
    resolved: bool
    class Config:
        from_attributes = True


class DemandPredictRequest(BaseModel):
    phc_id: str
    medicine: str
    horizon_days: int = Field(default=1, ge=1, le=30)


class ModelResult(BaseModel):
    model: str
    prediction: Optional[float] = None
    metrics: Dict[str, Any]


class DemandPredictResponse(BaseModel):
    phc_id: str
    medicine: str
    horizon_days: int
    all_model_outputs: List[ModelResult]
    selected_model: str
    final_prediction: float
    selection_reason: str


class StockoutPredictRequest(BaseModel):
    phc_id: str
    medicine: str


class RiskDriver(BaseModel):
    factor: str
    contribution_pct: float
    direction: str


class StockoutPredictResponse(BaseModel):
    phc_id: str
    medicine: str
    current_stock: int
    predicted_demand_per_day: float
    expected_stockout_days: Optional[float]
    stockout_probability: float
    risk_level: str
    selected_model: str
    all_model_outputs: List[ModelResult]
    top_drivers: List[RiskDriver]
    prediction_id: int


class BedForecastResponse(BaseModel):
    phc_id: str
    current_occupancy_pct: float
    forecast_occupancy_pct: float
    horizon_days: int
    risk_level: str


class EmergencySimulateRequest(BaseModel):
    scenario: Optional[str] = None  # "dengue_outbreak" | "flu_surge" | "gi_outbreak" | None
    patient_increase_pct: float = 0.0
    supply_disruption_pct: float = 0.0


class RedistributionTransfer(BaseModel):
    medicine: str
    from_phc: str
    to_phc: str
    quantity: int
    distance_km: float
    recipient_risk_score: float
    fefo_priority: bool
    from_district: str
    to_district: str


class RedistributionResponse(BaseModel):
    as_of_date: str
    total_transfer_orders: int
    total_units_redistributed: int
    at_risk_phcs_addressed: int
    transfers: List[RedistributionTransfer]


class ResilienceScoreOut(BaseModel):
    district: str
    rank: int
    resilience_score: float
    medicine_availability: float
    bed_capacity: float
    staffing_adequacy: float
    emergency_readiness: float
    weakest_factor: str


class FederatedTrainRequest(BaseModel):
    rounds: int = Field(default=5, ge=1, le=20)


class ModelPerformanceOut(BaseModel):
    task: str
    model_name: str
    metrics: Dict[str, Any]
    is_current_champion: bool
    trained_at: datetime
    class Config:
        from_attributes = True
