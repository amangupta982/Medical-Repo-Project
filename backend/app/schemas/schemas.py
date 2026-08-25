"""
Pydantic schemas for request/response validation.

Production notes:
- All schemas use `model_config` (Pydantic v2) instead of inner `Config` class.
- Added pagination support, error response schema, and health check models.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Generic, TypeVar
from datetime import date, datetime


# ── Pagination ───────────────────────────────────────────────────────────

T = TypeVar("T")


class PaginationMeta(BaseModel):
    """Pagination metadata included in paginated responses."""
    total: int
    skip: int
    limit: int
    has_more: bool


class PaginatedResponse(BaseModel, Generic[T]):
    """Wrapper for paginated list endpoints."""
    data: List[Any]
    pagination: PaginationMeta


# ── Error Responses ──────────────────────────────────────────────────────

class ErrorDetail(BaseModel):
    """Structured error response body."""
    code: str
    message: str
    details: Dict[str, Any] = {}
    correlation_id: str = ""


class ErrorResponse(BaseModel):
    """Top-level error envelope."""
    error: ErrorDetail


# ── Health Checks ────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str


class ReadinessResponse(BaseModel):
    status: str
    database: Dict[str, Any]
    models: Dict[str, Any]


# ── Network / PHC / District ────────────────────────────────────────────

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

    model_config = {"from_attributes": True}


class DistrictOut(BaseModel):
    name: str
    state: str
    capacity_factor: float
    lat: Optional[float] = None
    lon: Optional[float] = None

    model_config = {"from_attributes": True}


class InventoryOut(BaseModel):
    phc_id: str
    medicine: str
    date: date
    current_stock: int
    lead_time_days: float


class AlertOut(BaseModel):
    id: int
    created_at: datetime
    phc_id: Optional[str] = None
    district_id: Optional[str] = None
    alert_type: str
    severity: str
    message: str
    resolved: bool

    model_config = {"from_attributes": True}


class OverviewStatsOut(BaseModel):
    """Aggregated dashboard stats."""
    total_phcs: int
    total_districts: int
    remote_phcs: int
    total_catchment_population: int
    avg_beds_per_phc: float


# ── Predictions ──────────────────────────────────────────────────────────

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
    expected_stockout_days: Optional[float] = None
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


# ── Emergency Simulation ────────────────────────────────────────────────

class EmergencySimulateRequest(BaseModel):
    scenario: Optional[str] = None  # "dengue_outbreak" | "flu_surge" | "gi_outbreak" | None
    patient_increase_pct: float = 0.0
    supply_disruption_pct: float = 0.0


class ImpactedPHC(BaseModel):
    """Single PHC entry in the simulation impact list."""
    phc_id: Optional[str] = None
    district: Optional[str] = None
    medicine: Optional[str] = None
    risk_before: float
    risk_after: float
    risk_delta: float


class EmergencySimulateResponse(BaseModel):
    """Response for emergency simulation endpoint."""
    scenario: str
    patient_increase_pct: float
    supply_disruption_pct: float
    avg_risk_before: float
    avg_risk_after: float
    phcs_newly_critical: int
    max_risk_before: float
    max_risk_after: float
    top_impacted: List[ImpactedPHC]


# ── Redistribution ──────────────────────────────────────────────────────

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


# ── Resilience Score ─────────────────────────────────────────────────────

class ResilienceScoreOut(BaseModel):
    district: str
    rank: int
    resilience_score: float
    medicine_availability: float
    bed_capacity: float
    staffing_adequacy: float
    emergency_readiness: float
    weakest_factor: str


# ── Federated Learning ──────────────────────────────────────────────────

class FederatedTrainRequest(BaseModel):
    rounds: int = Field(default=5, ge=1, le=20)


# ── Model Performance ───────────────────────────────────────────────────

class ModelPerformanceOut(BaseModel):
    task: str
    model_name: str
    metrics: Dict[str, Any]
    is_current_champion: bool
    trained_at: datetime

    model_config = {"from_attributes": True}


# ── Explainability ──────────────────────────────────────────────────────

class ExplainabilityResponse(BaseModel):
    prediction_id: int
    prediction_type: Optional[str] = None
    selected_model: Optional[str] = None
    final_prediction: Optional[float] = None
    risk_level: Optional[str] = None
    explanation: Optional[Dict[str, Any]] = None
    all_model_outputs: Optional[List[Dict[str, Any]]] = None
