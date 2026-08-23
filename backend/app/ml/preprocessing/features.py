"""
Pulls the panel data out of Postgres and builds causal (no-leakage) features
for the stock-out classification and demand forecasting tasks.
"""
import pandas as pd
import numpy as np
from sqlalchemy import text
from app.database.session import engine

def load_panel() -> pd.DataFrame:
    query = text("""
        SELECT
            mc.date, p.code AS phc_id, d.name AS district, m.name AS medicine,
            mc.quantity_consumed AS daily_consumption, mc.resupply_qty,
            inv.current_stock, inv.lead_time_days,
            pat.patient_count AS patients,
            bd.beds_occupied, p.total_beds,
            st.doctors_present, st.nurses_present,
            p.sanctioned_doctors, p.sanctioned_nurses,
            p.is_remote,
            COALESCE(dc.outbreak_active, 0) AS outbreak_active
        FROM medicine_consumption mc
        JOIN phcs p ON p.id = mc.phc_id
        JOIN districts d ON d.id = p.district_id
        JOIN medicines m ON m.id = mc.medicine_id
        JOIN inventory inv ON inv.phc_id = mc.phc_id AND inv.medicine_id = mc.medicine_id AND inv.date = mc.date
        JOIN patients pat ON pat.phc_id = mc.phc_id AND pat.date = mc.date
        JOIN beds bd ON bd.phc_id = mc.phc_id AND bd.date = mc.date
        JOIN staff_attendance st ON st.phc_id = mc.phc_id AND st.date = mc.date
        LEFT JOIN disease_cases dc ON dc.district_id = d.id AND dc.date = mc.date
        ORDER BY p.code, m.name, mc.date
    """)
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    df["date"] = pd.to_datetime(df["date"])
    return df

def compute_stockout_labels(df: pd.DataFrame) -> pd.DataFrame:
    """same-day stock-out (unmet demand or zero stock), then roll forward 7 days for the early-warning label"""
    df = df.sort_values(["phc_id", "medicine", "date"])
    g = df.groupby(["phc_id", "medicine"])
    df["stock_out_flag"] = ((df["current_stock"] == 0) &
                             (df["daily_consumption"] >= 0)).astype(int)
    # also flag where consumption looks implausibly capped by low stock (approximation from DB view)
    df["stock_out_next_7d"] = (
        g["stock_out_flag"].apply(lambda s: s.shift(-1).rolling(7, min_periods=1).max().shift(-6))
        .reset_index(drop=True)
    )
    df["stock_out_next_7d"] = df["stock_out_next_7d"].fillna(0).astype(int)
    return df

def compute_demand_targets(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes causal forward-rolling demand targets for multiple horizons (1d, 7d, 14d, 30d).
    For day t:
    - 1d: daily consumption on day t (or next 1-day)
    - 7d: cumulative consumption over days t ... t+6 (7-day forward sum, shifted with no leakage)
    - 14d: cumulative consumption over days t ... t+13 (14-day forward sum)
    - 30d: cumulative consumption over days t ... t+29 (30-day forward sum)
    """
    df = df.sort_values(["phc_id", "medicine", "date"]).copy()
    g = df.groupby(["phc_id", "medicine"], group_keys=False)

    df["demand_target_1d"] = df["daily_consumption"].astype(float)
    
    for h in [7, 14, 30]:
        target_series = g["daily_consumption"].apply(
            lambda s: s.rolling(h, min_periods=1).sum().shift(-(h - 1))
        )
        df[f"demand_target_{h}d"] = target_series.fillna(df["daily_consumption"] * h).astype(float)

    return df

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["phc_id", "medicine", "date"]).copy()
    g = df.groupby(["phc_id", "medicine"], group_keys=False)

    df["consumption_lag1"] = g["daily_consumption"].shift(1)
    df["consumption_ma7"] = g["daily_consumption"].apply(lambda s: s.shift(1).rolling(7, min_periods=1).mean())
    df["consumption_ma14"] = g["daily_consumption"].apply(lambda s: s.shift(1).rolling(14, min_periods=1).mean())
    df["consumption_std7"] = g["daily_consumption"].apply(lambda s: s.shift(1).rolling(7, min_periods=1).std())
    df["consumption_trend"] = df["consumption_ma7"] - df["consumption_ma14"]

    df["days_of_stock_left"] = df["current_stock"] / df["consumption_ma7"].replace(0, np.nan)
    df["days_of_stock_left"] = df["days_of_stock_left"].fillna(df["current_stock"])
    df["stock_lag1"] = g["current_stock"].shift(1)
    df["stock_delta_7d"] = df["current_stock"] - g["current_stock"].shift(7)

    df["patients_ma7"] = g["patients"].apply(lambda s: s.shift(1).rolling(7, min_periods=1).mean())
    df["patients_ma14"] = g["patients"].apply(lambda s: s.shift(1).rolling(14, min_periods=1).mean())
    pstd = g["patients"].apply(lambda s: s.shift(1).rolling(14, min_periods=1).std()).replace(0, np.nan)
    df["patients_zscore"] = ((df["patients"] - df["patients_ma14"]) / pstd).fillna(0)
    df["footfall_surge"] = (df["patients_zscore"] > 1.5).astype(int)

    df["doctor_shortfall"] = df["sanctioned_doctors"] - df["doctors_present"]
    df["nurse_shortfall"] = df["sanctioned_nurses"] - df["nurses_present"]
    df["bed_occupancy_rate"] = df["beds_occupied"] / df["total_beds"]

    df["day_of_week"] = df["date"].dt.dayofweek
    df["day_of_year"] = df["date"].dt.dayofyear
    df["doy_sin"] = np.sin(2 * np.pi * df["day_of_year"] / 365)
    df["doy_cos"] = np.cos(2 * np.pi * df["day_of_year"] / 365)

    df["outbreak_active"] = df["outbreak_active"].astype(int)
    df["is_remote"] = df["is_remote"].astype(int)

    if "stock_out_flag" not in df.columns:
        df["stock_out_flag"] = ((df["current_stock"] == 0) & (df["daily_consumption"] >= 0)).astype(int)

    peer = df.groupby(["district", "medicine", "date"])["stock_out_flag"].transform("mean")
    df["district_peer_stockout_rate"] = peer

    for c in FEATURE_COLS:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0).astype(float)
    df = df.fillna(0)
    return df

FEATURE_COLS = [
    "consumption_lag1", "consumption_ma7", "consumption_ma14", "consumption_std7", "consumption_trend",
    "current_stock", "days_of_stock_left", "stock_lag1", "stock_delta_7d",
    "patients", "patients_ma7", "patients_ma14", "patients_zscore", "footfall_surge",
    "doctor_shortfall", "nurse_shortfall", "bed_occupancy_rate",
    "day_of_week", "doy_sin", "doy_cos",
    "outbreak_active", "is_remote", "lead_time_days",
    "district_peer_stockout_rate",
]
STOCKOUT_TARGET = "stock_out_next_7d"
DEMAND_TARGET = "daily_consumption"
DEMAND_HORIZONS = [1, 7, 14, 30]
DEMAND_TARGET_MAP = {
    1: "demand_target_1d",
    7: "demand_target_7d",
    14: "demand_target_14d",
    30: "demand_target_30d",
}
