"""
Core relational schema for the BRICS Health Resilience Platform.
Postgres-backed. Covers PHCs, districts, medicines, inventory, consumption,
patients, beds, staff, disease cases, predictions, alerts, redistribution,
and model performance tracking.
"""
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey,
    UniqueConstraint, Text, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.session import Base


class District(Base):
    __tablename__ = "districts"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    state = Column(String(120), nullable=False, default="Karnataka")
    capacity_factor = Column(Float, default=1.0)  # relative resourcing level
    lat = Column(Float)
    lon = Column(Float)

    phcs = relationship("PHC", back_populates="district")


class PHC(Base):
    __tablename__ = "phcs"
    id = Column(Integer, primary_key=True)
    code = Column(String(30), unique=True, nullable=False)  # e.g. MYS-PHC04
    name = Column(String(200))
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    total_beds = Column(Integer, default=20)
    sanctioned_doctors = Column(Integer, default=3)
    sanctioned_nurses = Column(Integer, default=6)
    catchment_population = Column(Integer, default=30000)
    is_remote = Column(Boolean, default=False)
    lat = Column(Float)
    lon = Column(Float)

    district = relationship("District", back_populates="phcs")


class Medicine(Base):
    __tablename__ = "medicines"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    category = Column(String(80))  # e.g. antimalarial, antibiotic, rehydration
    disease_link = Column(String(80), nullable=True)  # e.g. malaria_dengue


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
    __table_args__ = (UniqueConstraint("phc_id", "medicine_id", "date", name="uq_inventory_day"),)


class MedicineConsumption(Base):
    __tablename__ = "medicine_consumption"
    id = Column(Integer, primary_key=True)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    date = Column(Date, nullable=False)
    quantity_consumed = Column(Integer, default=0)
    resupply_qty = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint("phc_id", "medicine_id", "date", name="uq_consumption_day"),)


class PatientRecord(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=False)
    date = Column(Date, nullable=False)
    patient_count = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint("phc_id", "date", name="uq_patients_day"),)


class BedStatus(Base):
    __tablename__ = "beds"
    id = Column(Integer, primary_key=True)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=False)
    date = Column(Date, nullable=False)
    beds_occupied = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint("phc_id", "date", name="uq_beds_day"),)


class StaffAttendance(Base):
    __tablename__ = "staff_attendance"
    id = Column(Integer, primary_key=True)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=False)
    date = Column(Date, nullable=False)
    doctors_present = Column(Integer, default=0)
    nurses_present = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint("phc_id", "date", name="uq_staff_day"),)


class DiseaseCase(Base):
    __tablename__ = "disease_cases"
    id = Column(Integer, primary_key=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    date = Column(Date, nullable=False)
    disease = Column(String(80))  # dengue, malaria, gi_outbreak, flu, none
    outbreak_active = Column(Boolean, default=False)
    intensity = Column(Float, default=1.0)


class Prediction(Base):
    """Every prediction served by the API is logged here for auditability
    and for the /api/explainability/{prediction_id} endpoint to look up."""
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    prediction_type = Column(String(40))  # demand | stockout | beds
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=True)
    horizon_days = Column(Integer, nullable=True)
    selected_model = Column(String(40))
    final_prediction = Column(Float)
    all_model_outputs = Column(JSON)  # {"xgboost": .., "lightgbm": .., "lstm": ..}
    evaluation_metrics = Column(JSON)  # metrics used to pick the winner
    risk_level = Column(String(20), nullable=True)
    explanation = Column(JSON, nullable=True)  # SHAP top-driver payload


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    phc_id = Column(Integer, ForeignKey("phcs.id"), nullable=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    alert_type = Column(String(40))  # stockout_risk | surge | bed_capacity
    severity = Column(String(20))  # LOW/MEDIUM/HIGH/CRITICAL
    message = Column(Text)
    resolved = Column(Boolean, default=False)


class RedistributionRecommendation(Base):
    __tablename__ = "redistribution_recommendations"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    from_phc_id = Column(Integer, ForeignKey("phcs.id"))
    to_phc_id = Column(Integer, ForeignKey("phcs.id"))
    quantity = Column(Integer)
    distance_km = Column(Float)
    recipient_risk_score = Column(Float)
    status = Column(String(20), default="RECOMMENDED")  # RECOMMENDED | EXECUTED | REJECTED


class ModelPerformance(Base):
    """Stored evaluation results per model per task, so the Prediction endpoint
    doesn't need to retrain on every click -- it loads these to compare + pick a winner."""
    __tablename__ = "model_performance"
    id = Column(Integer, primary_key=True)
    trained_at = Column(DateTime, default=datetime.utcnow)
    task = Column(String(40))  # demand_forecast_7d | stockout_classification | bed_forecast
    model_name = Column(String(40))  # baseline | xgboost | lightgbm | lstm
    metrics = Column(JSON)  # {"mae":.., "rmse":.., "recall":.., "pr_auc":..}
    is_current_champion = Column(Boolean, default=False)
    model_artifact_path = Column(String(300), nullable=True)
