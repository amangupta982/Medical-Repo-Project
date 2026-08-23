"""
Cross-PHC resource redistribution optimizer using Google OR-Tools (linear sum
assignment / MILP via CP-SAT), solving a transportation problem:

  minimize: transport_cost - risk_priority_bonus - expiry_urgency_bonus
  subject to:
    - donor can't ship below its own safety stock
    - recipient isn't over-shipped beyond its deficit
    - per-link transfer capped by realistic single-trip logistics limits

FEFO (First-Expire-First-Out) is incorporated as an objective bonus: stock
close to expiry is preferentially redistributed rather than left to expire
unused at a low-demand PHC, which is measured separately as "wastage avoided".
"""
import numpy as np
import pandas as pd
from math import radians, sin, cos, sqrt, atan2
from ortools.sat.python import cp_model
from datetime import datetime
from sqlalchemy import text
from app.database.session import engine

SAFETY_BUFFER_DAYS = 5
MAX_TRANSFER_PER_LINK = 150
COST_PER_KM_UNIT = 0.02
RISK_PRIORITY_WEIGHT = 40   # objective units per risk-point (0-1) per unit shipped
EXPIRY_URGENCY_WEIGHT = 25  # bonus for shipping stock expiring soon (FEFO)
EXPIRY_URGENCY_DAYS = 30    # "expiring soon" horizon


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def _load_snapshot(medicine_name: str, risk_scores: dict, as_of_date=None) -> pd.DataFrame:
    """risk_scores: {phc_code: risk_probability} from the live stockout model."""
    query = text("""
        SELECT p.code AS phc_id, d.name AS district, p.lat, p.lon,
               inv.current_stock, inv.date, inv.batch_expiry_date,
               m.name AS medicine
        FROM inventory inv
        JOIN phcs p ON p.id = inv.phc_id
        JOIN districts d ON d.id = p.district_id
        JOIN medicines m ON m.id = inv.medicine_id
        WHERE m.name = :med
          AND inv.date = COALESCE(:as_of_date, (SELECT MAX(date) FROM inventory))
    """)
    with engine.connect() as conn:
        snap = pd.read_sql(query, conn, params={"med": medicine_name, "as_of_date": as_of_date})

    cons_query = text("""
        SELECT p.code AS phc_id, AVG(mc.quantity_consumed) AS avg_daily_consumption
        FROM medicine_consumption mc
        JOIN phcs p ON p.id = mc.phc_id
        JOIN medicines m ON m.id = mc.medicine_id
        WHERE m.name = :med
        GROUP BY p.code
    """)
    with engine.connect() as conn:
        cons = pd.read_sql(cons_query, conn, params={"med": medicine_name})

    snap = snap.merge(cons, on="phc_id", how="left")
    snap["avg_daily_consumption"] = snap["avg_daily_consumption"].fillna(1.0)
    snap["days_of_stock_left"] = snap["current_stock"] / snap["avg_daily_consumption"].replace(0, 1)
    snap["risk_score"] = snap["phc_id"].map(risk_scores).fillna(0.05)

    if snap["batch_expiry_date"].notna().any() and snap["date"].notna().any():
        snap["days_to_expiry"] = (pd.to_datetime(snap["batch_expiry_date"]) - pd.to_datetime(snap["date"])).dt.days
    else:
        snap["days_to_expiry"] = 9999
    return snap


def optimize_medicine(medicine_name: str, risk_scores: dict, as_of_date=None) -> list:
    snap = _load_snapshot(medicine_name, risk_scores, as_of_date)
    if snap.empty:
        return []

    donors = snap[snap["days_of_stock_left"] > SAFETY_BUFFER_DAYS * 1.5].copy()
    donors["surplus"] = np.maximum(0, donors["current_stock"] - donors["avg_daily_consumption"] * SAFETY_BUFFER_DAYS).round().astype(int)
    donors = donors[donors["surplus"] > 5]

    recipients = snap[snap["risk_score"] > 0.5].copy()
    recipients["deficit"] = np.maximum(
        0, (recipients["avg_daily_consumption"] * (SAFETY_BUFFER_DAYS + 3)) - recipients["current_stock"]
    ).round().astype(int)
    recipients = recipients[recipients["deficit"] > 5]

    if donors.empty or recipients.empty:
        return []

    donor_ids = donors["phc_id"].tolist()
    recip_ids = recipients["phc_id"].tolist()
    links = [(d, r) for d in donor_ids for r in recip_ids if d != r]
    if not links:
        return []

    donor_loc = donors.set_index("phc_id")[["lat", "lon"]]
    recip_loc = recipients.set_index("phc_id")[["lat", "lon"]]
    recip_risk = recipients.set_index("phc_id")["risk_score"]
    donor_expiry = donors.set_index("phc_id")["days_to_expiry"]
    donor_surplus = donors.set_index("phc_id")["surplus"]
    recip_deficit = recipients.set_index("phc_id")["deficit"]

    dist = {(d, r): haversine(*donor_loc.loc[d], *recip_loc.loc[r]) for d, r in links}

    model = cp_model.CpModel()
    x = {}
    for d, r in links:
        x[(d, r)] = model.NewIntVar(0, MAX_TRANSFER_PER_LINK, f"x_{d}_{r}")

    # supply constraints
    for d in donor_ids:
        model.Add(sum(x[(d, r)] for r in recip_ids if (d, r) in x) <= int(donor_surplus.loc[d]))
    # demand constraints
    for r in recip_ids:
        model.Add(sum(x[(d, r)] for d in donor_ids if (d, r) in x) <= int(recip_deficit.loc[r]))

    # objective (scaled to integers for CP-SAT): minimize cost - risk_bonus - expiry_bonus
    obj_terms = []
    for d, r in links:
        cost_coef = int(round(dist[(d, r)] * COST_PER_KM_UNIT * 100))
        risk_bonus = int(round(recip_risk.loc[r] * RISK_PRIORITY_WEIGHT * 100))
        expiry_bonus = int(round(EXPIRY_URGENCY_WEIGHT * 100)) if donor_expiry.loc[d] <= EXPIRY_URGENCY_DAYS else 0
        net_coef = cost_coef - risk_bonus - expiry_bonus
        obj_terms.append(net_coef * x[(d, r)])
    model.Minimize(sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    status = solver.Solve(model)

    results = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for (d, r), var in x.items():
            qty = solver.Value(var)
            if qty > 0:
                results.append({
                    "medicine": medicine_name, "from_phc": d, "to_phc": r,
                    "quantity": int(qty), "distance_km": round(dist[(d, r)], 1),
                    "recipient_risk_score": round(float(recip_risk.loc[r]), 3),
                    "donor_days_to_expiry": int(donor_expiry.loc[d]) if donor_expiry.loc[d] < 9999 else None,
                    "fefo_priority": bool(donor_expiry.loc[d] <= EXPIRY_URGENCY_DAYS),
                    "from_district": donors.set_index("phc_id").loc[d, "district"],
                    "to_district": recipients.set_index("phc_id").loc[r, "district"],
                })
    return results


def optimize_all_medicines(risk_scores_by_medicine: dict, as_of_date=None) -> pd.DataFrame:
    """risk_scores_by_medicine: {medicine_name: {phc_code: risk_score}}"""
    all_results = []
    for med, risk_scores in risk_scores_by_medicine.items():
        all_results.extend(optimize_medicine(med, risk_scores, as_of_date))
    return pd.DataFrame(all_results)
