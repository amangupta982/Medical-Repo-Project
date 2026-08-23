from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from app.database.session import get_db
from app.models.db_models import PHC, District, Alert
from app.schemas.schemas import PHCOut, DistrictOut, AlertOut

router = APIRouter(tags=["network"])


@router.get("/api/phcs", response_model=List[dict])
def list_phcs(db: Session = Depends(get_db)):
    rows = db.query(PHC, District.name).join(District, PHC.district_id == District.id).all()
    return [
        {
            "code": p.code, "name": p.name, "district": dname,
            "total_beds": p.total_beds, "sanctioned_doctors": p.sanctioned_doctors,
            "sanctioned_nurses": p.sanctioned_nurses, "catchment_population": p.catchment_population,
            "is_remote": p.is_remote, "lat": p.lat, "lon": p.lon,
        }
        for p, dname in rows
    ]


@router.get("/api/districts", response_model=List[DistrictOut])
def list_districts(db: Session = Depends(get_db)):
    return db.query(District).all()


@router.get("/api/inventory")
def get_inventory(phc_id: str = None, medicine: str = None, db: Session = Depends(get_db)):
    query = text("""
        SELECT p.code AS phc_id, m.name AS medicine, inv.date, inv.current_stock, inv.lead_time_days
        FROM inventory inv
        JOIN phcs p ON p.id = inv.phc_id
        JOIN medicines m ON m.id = inv.medicine_id
        WHERE inv.date = (SELECT MAX(date) FROM inventory)
          AND (:phc_id IS NULL OR p.code = :phc_id)
          AND (:medicine IS NULL OR m.name = :medicine)
        ORDER BY p.code, m.name
    """)
    result = db.execute(query, {"phc_id": phc_id, "medicine": medicine})
    return [dict(row._mapping) for row in result]


@router.get("/api/alerts", response_model=List[dict])
def list_alerts(resolved: bool = None, db: Session = Depends(get_db)):
    q = db.query(Alert)
    if resolved is not None:
        q = q.filter(Alert.resolved == resolved)
    rows = q.order_by(Alert.created_at.desc()).limit(200).all()
    return [
        {"id": a.id, "created_at": a.created_at, "alert_type": a.alert_type,
         "severity": a.severity, "message": a.message, "resolved": a.resolved}
        for a in rows
    ]


@router.get("/api/stats/overview")
def overview_stats(db: Session = Depends(get_db)):
    """Aggregated stats for the dashboard Overview — single call instead of 3."""
    phcs = db.query(PHC).all()
    districts = db.query(District).all()
    return {
        "total_phcs": len(phcs),
        "total_districts": len(districts),
        "remote_phcs": sum(1 for p in phcs if p.is_remote),
        "total_catchment_population": sum(p.catchment_population for p in phcs),
        "avg_beds_per_phc": round(sum(p.total_beds for p in phcs) / max(len(phcs), 1), 1),
    }
