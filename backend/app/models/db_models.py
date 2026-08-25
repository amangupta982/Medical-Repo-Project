"""
Core relational schema for the BRICS Health Resilience Platform.
Postgres-backed. Covers PHCs, districts, medicines, inventory, consumption,
patients, beds, staff, disease cases, predictions, alerts, redistribution,
and model performance tracking.

Production notes:
- All timestamps use datetime.now(timezone.utc) (not deprecated utcnow)
- Composite indexes on (phc_id, date) and (medicine_id, date) for query perf
- __repr__ on every model for debuggability
"""
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey,
    UniqueConstraint, Index, Text, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.session import Base


def _utcnow():
    return datetime.now(timezone.utc)


class District(Base):
    __tablename__ = "districts"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    state = Column(String(120), nullable=False, default="Karnataka")
    capacity_factor = Column(Float, default=1.0)  # relative resourcing level
    lat = Column(Float)
    lon = Column(Float)

    phcs = relationship("PHC", back_populates="district")

    def __repr__(self) -> str:
        return f"<District(id={self.id}, name='{self.name}', state='{self.state}')>"


class PHC(Base):
    __tablename__ = "phcs"
    id = Column(Integer, primary_key=True)
    code = Column(String(30), unique=True, nullable=False)  # e.g. MYS-PHC04
    name = Column(String(200))
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False, index=True)
    total_beds = Column(Integer, default=20)
    sanctioned_doctors = Column(Integer, default=3)
    sanctioned_nurses = Column(Integer, default=6)
    catchment_population = Column(Integer, default=30000)
    is_remote = Column(Boolean, default=False)
    lat = Column(Float)
    lon = Column(Float)

    district = relationship("District", back_populates="phcs")

    __table_args__ = (
        Index("ix_phcs_code", "code"),
    )

    def __repr__(self) -> str:
        return f"<PHC(id={self.id}, code='{self.code}', name='{self.name}')>"


class Medicine(Base):
    __tablename__ = "medicines"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    category = Column(String(80))  # e.g. antimalarial, antibiotic, rehydration
    disease_link = Column(String(80), nullable=True)  # e.g. malaria_dengue

    def __repr__(self) -> str:
        return f"<Medicine(id={self.id}, name='{self.name}', category='{self.category}')>"


class Inventory(Base):
    """Current stock snapshot, updated daily (or via /api/inventory writes)."""
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    date = Column(Date, nullable=False)
    current_stock = Column(Integer, default=0)
    batch_expiry_date = Column(Date, nullable=True)  # for FEFO logic
    lead_time_days = Column(Float, default=6.0)
    __table_args__ = (
        UniqueConstraint("phc_id", "medicine_id", "date", name="uq_inventory_day"),
        Index("ix_inventory_phc_date", "phc_id", "date"),
        Index("ix_inventory_medicine_date", "medicine_id", "date"),
        Index("ix_inventory_date", "date"),
    )

    def __repr__(self) -> str:
        return f"<Inventory(phc_id={self.phc_id}, med_id={self.medicine_id}, date={self.date}, stock={self.current_stock})>"


class MedicineConsumption(Base):
    __tablename__ = "medicine_consumption"
    id = Column(Integer, primary_key=True)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    date = Column(Date, nullable=False)
    quantity_consumed = Column(Integer, default=0)
    resupply_qty = Column(Integer, default=0)
    __table_args__ = (
        UniqueConstraint("phc_id", "medicine_id", "date", name="uq_consumption_day"),
        Index("ix_consumption_phc_med_date", "phc_id", "medicine_id", "date"),
        Index("ix_consumption_date", "date"),
    )

    def __repr__(self) -> str:
        return f"<MedicineConsumption(phc={self.phc_id}, med={self.medicine_id}, date={self.date}, consumed={self.quantity_consumed})>"


class PatientRecord(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=False)
    date = Column(Date, nullable=False)
    patient_count = Column(Integer, default=0)
    __table_args__ = (
        UniqueConstraint("phc_id", "date", name="uq_patients_day"),
        Index("ix_patients_phc_date", "phc_id", "date"),
    )

    def __repr__(self) -> str:
        return f"<PatientRecord(phc={self.phc_id}, date={self.date}, count={self.patient_count})>"


class BedStatus(Base):
    __tablename__ = "beds"
    id = Column(Integer, primary_key=True)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=False)
    date = Column(Date, nullable=False)
    beds_occupied = Column(Integer, default=0)
    __table_args__ = (
        UniqueConstraint("phc_id", "date", name="uq_beds_day"),
        Index("ix_beds_phc_date", "phc_id", "date"),
    )

    def __repr__(self) -> str:
        return f"<BedStatus(phc={self.phc_id}, date={self.date}, occupied={self.beds_occupied})>"


class StaffAttendance(Base):
    __tablename__ = "staff_attendance"
    id = Column(Integer, primary_key=True)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=False)
    date = Column(Date, nullable=False)
    doctors_present = Column(Integer, default=0)
    nurses_present = Column(Integer, default=0)
    __table_args__ = (
        UniqueConstraint("phc_id", "date", name="uq_staff_day"),
        Index("ix_staff_phc_date", "phc_id", "date"),
    )

    def __repr__(self) -> str:
        return f"<StaffAttendance(phc={self.phc_id}, date={self.date}, docs={self.doctors_present}, nurses={self.nurses_present})>"


class DiseaseCase(Base):
    __tablename__ = "disease_cases"
    id = Column(Integer, primary_key=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    disease = Column(String(80))  # dengue, malaria, gi_outbreak, flu, none
    outbreak_active = Column(Boolean, default=False)
    intensity = Column(Float, default=1.0)

    __table_args__ = (
        Index("ix_disease_district_date", "district_id", "date"),
    )

    def __repr__(self) -> str:
        return f"<DiseaseCase(district={self.district_id}, date={self.date}, disease='{self.disease}')>"


class Prediction(Base):
    """Every prediction served by the API is logged here for auditability
    and for the /api/explainability/{prediction_id} endpoint to look up."""
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=_utcnow)
    prediction_type = Column(String(40))  # demand | stockout | beds
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=True)
    horizon_days = Column(Integer, nullable=True)
    selected_model = Column(String(40))
    final_prediction = Column(Float)
    all_model_outputs = Column(JSON)  # {"xgboost": .., "lightgbm": .., "lstm": ..}
    evaluation_metrics = Column(JSON)  # metrics used to pick the winner
    risk_level = Column(String(20), nullable=True)
    explanation = Column(JSON, nullable=True)  # SHAP top-driver payload

    __table_args__ = (
        Index("ix_predictions_type_created", "prediction_type", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Prediction(id={self.id}, type='{self.prediction_type}', model='{self.selected_model}', risk='{self.risk_level}')>"


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=_utcnow)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    alert_type = Column(String(40))  # stockout_risk | surge | bed_capacity
    severity = Column(String(20))  # LOW/MEDIUM/HIGH/CRITICAL
    message = Column(Text)
    resolved = Column(Boolean, default=False)

    __table_args__ = (
        Index("ix_alerts_type_severity", "alert_type", "severity"),
        Index("ix_alerts_resolved", "resolved"),
    )

    def __repr__(self) -> str:
        return f"<Alert(id={self.id}, type='{self.alert_type}', severity='{self.severity}')>"


class RedistributionRecommendation(Base):
    __tablename__ = "redistribution_recommendations"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=_utcnow)
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    from_phc_id = Column(Integer, ForeignKey("phcs.id"))
    to_phc_id = Column(Integer, ForeignKey("phcs.id"))
    quantity = Column(Integer)
    distance_km = Column(Float)
    recipient_risk_score = Column(Float)
    status = Column(String(20), default="RECOMMENDED")  # RECOMMENDED | EXECUTED | REJECTED

    __table_args__ = (
        Index("ix_redist_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<RedistributionRecommendation(id={self.id}, med={self.medicine_id}, qty={self.quantity}, status='{self.status}')>"


class ModelPerformance(Base):
    """Stored evaluation results per model per task, so the Prediction endpoint
    doesn't need to retrain on every click -- it loads these to compare + pick a winner."""
    __tablename__ = "model_performance"
    id = Column(Integer, primary_key=True)
    trained_at = Column(DateTime, default=_utcnow)
    task = Column(String(40))  # demand_forecast_7d | stockout_classification | bed_forecast
    model_name = Column(String(40))  # baseline | xgboost | lightgbm | lstm
    metrics = Column(JSON)  # {"mae":.., "rmse":.., "recall":.., "pr_auc":..}
    is_current_champion = Column(Boolean, default=False)
    model_artifact_path = Column(String(300), nullable=True)

    __table_args__ = (
        Index("ix_model_perf_task_champion", "task", "is_current_champion"),
    )

    def __repr__(self) -> str:
        return f"<ModelPerformance(id={self.id}, task='{self.task}', model='{self.model_name}', champion={self.is_current_champion})>"
