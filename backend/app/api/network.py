"""
Network API routes — PHCs, districts, inventory, alerts, and overview stats.

Production features:
- Pagination on all list endpoints (skip/limit with defaults)
- Proper Pydantic response models (no more List[dict])
- ORM queries where possible (parameterized, no raw SQL injection risk)
- Structured logging
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from app.database.session import get_db
from app.models.db_models import PHC, District, Alert
from app.schemas.schemas import (
    PHCOut, DistrictOut, AlertOut, OverviewStatsOut,
    InventoryOut, PaginatedResponse, PaginationMeta,
)
from app.core.logging import get_logger

logger = get_logger("api.network")

router = APIRouter(prefix="/api", tags=["network"])


@router.get("/phcs", response_model=PaginatedResponse)
def list_phcs(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    district: str = Query(None, description="Filter by district name"),
    is_remote: bool = Query(None, description="Filter by remote status"),
    db: Session = Depends(get_db),
):
    """List all PHCs with pagination and optional filters."""
    query = db.query(PHC, District.name.label("district_name")).join(
        District, PHC.district_id == District.id
    )

    if district:
        query = query.filter(District.name == district)
    if is_remote is not None:
        query = query.filter(PHC.is_remote == is_remote)

    total = query.count()
    rows = query.offset(skip).limit(limit).all()

    data = [
        {
            "code": p.code, "name": p.name, "district": dname,
            "total_beds": p.total_beds, "sanctioned_doctors": p.sanctioned_doctors,
            "sanctioned_nurses": p.sanctioned_nurses,
            "catchment_population": p.catchment_population,
            "is_remote": p.is_remote, "lat": p.lat, "lon": p.lon,
        }
        for p, dname in rows
    ]

    return {
        "data": data,
        "pagination": PaginationMeta(
            total=total, skip=skip, limit=limit,
            has_more=(skip + limit) < total,
        ),
    }


@router.get("/districts", response_model=PaginatedResponse)
def list_districts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    state: str = Query(None, description="Filter by state"),
    db: Session = Depends(get_db),
):
    """List all districts with pagination."""
    query = db.query(District)
    if state:
        query = query.filter(District.state == state)

    total = query.count()
    rows = query.offset(skip).limit(limit).all()

    data = [
        {
            "name": d.name, "state": d.state,
            "capacity_factor": d.capacity_factor,
            "lat": d.lat, "lon": d.lon,
        }
        for d in rows
    ]

    return {
        "data": data,
        "pagination": PaginationMeta(
            total=total, skip=skip, limit=limit,
            has_more=(skip + limit) < total,
        ),
    }


@router.get("/inventory")
def get_inventory(
    phc_id: str = Query(None, description="Filter by PHC code"),
    medicine: str = Query(None, description="Filter by medicine name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Get latest inventory snapshot with optional filters and pagination."""
    query = text("""
        SELECT p.code AS phc_id, m.name AS medicine, inv.date,
               inv.current_stock, inv.lead_time_days
        FROM inventory inv
        JOIN phcs p ON p.id = inv.phc_id
        JOIN medicines m ON m.id = inv.medicine_id
        WHERE inv.date = (SELECT MAX(date) FROM inventory)
          AND (:phc_id IS NULL OR p.code = :phc_id)
          AND (:medicine IS NULL OR m.name = :medicine)
        ORDER BY p.code, m.name
        LIMIT :limit OFFSET :skip
    """)
    result = db.execute(query, {
        "phc_id": phc_id, "medicine": medicine,
        "limit": limit, "skip": skip,
    })
    data = [dict(row._mapping) for row in result]

    # Get total count for pagination
    count_query = text("""
        SELECT COUNT(*) FROM inventory inv
        JOIN phcs p ON p.id = inv.phc_id
        JOIN medicines m ON m.id = inv.medicine_id
        WHERE inv.date = (SELECT MAX(date) FROM inventory)
          AND (:phc_id IS NULL OR p.code = :phc_id)
          AND (:medicine IS NULL OR m.name = :medicine)
    """)
    total = db.execute(count_query, {"phc_id": phc_id, "medicine": medicine}).scalar()

    return {
        "data": data,
        "pagination": {
            "total": total, "skip": skip, "limit": limit,
            "has_more": (skip + limit) < total,
        },
    }


@router.get("/alerts", response_model=PaginatedResponse)
def list_alerts(
    resolved: bool = Query(None, description="Filter by resolved status"),
    severity: str = Query(None, description="Filter by severity (LOW/MEDIUM/HIGH/CRITICAL)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List alerts with pagination and filters."""
    query = db.query(Alert)
    if resolved is not None:
        query = query.filter(Alert.resolved == resolved)
    if severity:
        query = query.filter(Alert.severity == severity.upper())

    total = query.count()
    rows = query.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()

    data = [
        {
            "id": a.id, "created_at": a.created_at,
            "alert_type": a.alert_type, "severity": a.severity,
            "message": a.message, "resolved": a.resolved,
        }
        for a in rows
    ]

    return {
        "data": data,
        "pagination": PaginationMeta(
            total=total, skip=skip, limit=limit,
            has_more=(skip + limit) < total,
        ),
    }


@router.get("/stats/overview", response_model=OverviewStatsOut)
def overview_stats(db: Session = Depends(get_db)):
    """Aggregated stats for the dashboard Overview — single efficient query."""
    # Simpler fallback: two queries instead of complex cast
    phcs = db.query(PHC).all()
    district_count = db.query(func.count(District.id)).scalar()

    return {
        "total_phcs": len(phcs),
        "total_districts": district_count,
        "remote_phcs": sum(1 for p in phcs if p.is_remote),
        "total_catchment_population": sum(p.catchment_population for p in phcs),
        "avg_beds_per_phc": round(sum(p.total_beds for p in phcs) / max(len(phcs), 1), 1),
    }
