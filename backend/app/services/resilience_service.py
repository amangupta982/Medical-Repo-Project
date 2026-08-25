"""
District Resilience Score: 0-100 composite index. See docs/RESILIENCE_SCORE.md
for the full methodology writeup (weights are intentionally documented and
tunable, not a black box).

Production notes:
- TTL-based cache with configurable timeout (replaces lru_cache with no expiry)
- Structured logging
"""
import time
import threading
import pandas as pd
import numpy as np
from sqlalchemy import text
from app.database.session import engine
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("services.resilience")
settings = get_settings()

WEIGHTS = {
    "medicine_availability": 0.35,
    "bed_capacity": 0.20,
    "staffing_adequacy": 0.25,
    "emergency_readiness": 0.20,
}


def _minmax(s: pd.Series) -> pd.Series:
    rng = s.max() - s.min()
    if rng == 0:
        return pd.Series(50.0, index=s.index)
    return (s - s.min()) / rng * 100


# ── TTL Cache ────────────────────────────────────────────────────────────

_cache: dict = {}  # (as_of_date) -> (DataFrame, timestamp)
_cache_lock = threading.Lock()
_CACHE_TTL = 300  # 5 minutes


def _compute_scores(as_of_date) -> pd.DataFrame:
    """Core computation — runs the SQL query and calculates scores."""
    query = text("""
        SELECT d.name AS district,
               p.code AS phc_id,
               inv.date,
               inv.current_stock,
               CASE WHEN inv.current_stock = 0 THEN 1 ELSE 0 END AS stock_out_flag,
               bd.beds_occupied, p.total_beds,
               st.doctors_present, st.nurses_present,
               p.sanctioned_doctors, p.sanctioned_nurses,
               COALESCE(dc.outbreak_active, false)::int AS outbreak_active
        FROM inventory inv
        JOIN phcs p ON p.id = inv.phc_id
        JOIN districts d ON d.id = p.district_id
        JOIN beds bd ON bd.phc_id = inv.phc_id AND bd.date = inv.date
        JOIN staff_attendance st ON st.phc_id = inv.phc_id AND st.date = inv.date
        LEFT JOIN disease_cases dc ON dc.district_id = d.id AND dc.date = inv.date
        WHERE inv.date = COALESCE(:as_of_date, (SELECT MAX(date) FROM inventory))
    """)

    logger.info("Computing resilience scores for as_of_date=%s", as_of_date)

    with engine.connect() as conn:
        snap = pd.read_sql(query, conn, params={"as_of_date": as_of_date})

    if snap.empty:
        logger.warning("No data found for resilience calculation")
        return pd.DataFrame()

    med_avail = snap.groupby(["district", "phc_id"])["stock_out_flag"].apply(lambda s: 1 - s.mean()).groupby("district").mean()
    bed_cap = snap.groupby("district").apply(lambda g: 1 - (g["beds_occupied"].sum() / g["total_beds"].sum()))
    staff = snap.groupby("district").apply(
        lambda g: (g["doctors_present"].sum() + g["nurses_present"].sum()) /
                  (g["sanctioned_doctors"].sum() + g["sanctioned_nurses"].sum())
    )
    outbreak_exposure = snap.groupby("district")["outbreak_active"].mean()
    readiness = 1 - outbreak_exposure

    idx = med_avail.index
    scores = pd.DataFrame({
        "medicine_availability": _minmax(med_avail),
        "bed_capacity": _minmax(bed_cap.reindex(idx)),
        "staffing_adequacy": _minmax(staff.reindex(idx)),
        "emergency_readiness": _minmax(readiness.reindex(idx)),
    })
    scores["resilience_score"] = sum(scores[k] * w for k, w in WEIGHTS.items())
    scores = scores.sort_values("resilience_score", ascending=False)
    scores["rank"] = range(1, len(scores) + 1)
    scores["weakest_factor"] = scores[list(WEIGHTS.keys())].idxmin(axis=1)
    scores = scores.reset_index().rename(columns={"index": "district"})

    logger.info("Resilience scores computed for %d districts", len(scores))
    return scores.round(1)


def compute_resilience_scores(as_of_date=None) -> pd.DataFrame:
    """
    Get resilience scores with TTL-based caching.
    Cache key is as_of_date; cache auto-expires after _CACHE_TTL seconds.
    """
    cache_key = str(as_of_date)

    with _cache_lock:
        if cache_key in _cache:
            df, cached_at = _cache[cache_key]
            if (time.time() - cached_at) < _CACHE_TTL:
                logger.debug("Resilience scores cache hit (key=%s)", cache_key)
                return df.copy()

    # Compute outside lock to avoid blocking
    result = _compute_scores(as_of_date)

    with _cache_lock:
        _cache[cache_key] = (result, time.time())

    return result.copy()
