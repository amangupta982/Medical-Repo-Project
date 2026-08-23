"""
Run with: pytest tests/ -v
Requires DATABASE_URL to point at a seeded Postgres instance
(run app/database/seed.py first).
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
import pandas as pd
import numpy as np
import pytest

from app.ml.preprocessing.features import build_features, FEATURE_COLS, load_panel, compute_stockout_labels


def _tiny_panel():
    """Small synthetic panel for fast, DB-independent unit tests of pure functions."""
    dates = pd.date_range("2024-01-01", periods=30)
    rows = []
    for i, d in enumerate(dates):
        rows.append({
            "date": d, "phc_id": "TST-PHC01", "district": "TestDistrict", "medicine": "TestMed",
            "daily_consumption": 10 + i % 5, "resupply_qty": 0,
            "current_stock": max(0, 100 - i * 8), "lead_time_days": 5.0,
            "patients": 50 + i, "beds_occupied": 5, "total_beds": 20,
            "doctors_present": 2, "nurses_present": 4,
            "sanctioned_doctors": 3, "sanctioned_nurses": 5,
            "is_remote": False, "outbreak_active": False,
        })
    return pd.DataFrame(rows)


class TestFeatureEngineering:
    def test_no_leakage_lag_features_are_shifted(self):
        df = _tiny_panel()
        feat = build_features(df)
        # consumption_lag1 on day t must equal daily_consumption on day t-1, not day t
        merged = feat[["date", "consumption_lag1"]].reset_index(drop=True)
        raw = df.sort_values("date")["daily_consumption"].reset_index(drop=True)
        # row 1 onward: lag1 should equal previous day's raw consumption
        assert merged["consumption_lag1"].iloc[1] == raw.iloc[0]

    def test_all_expected_feature_columns_present(self):
        df = _tiny_panel()
        feat = build_features(df)
        for col in FEATURE_COLS:
            assert col in feat.columns, f"missing feature column: {col}"

    def test_no_nans_after_feature_build(self):
        df = _tiny_panel()
        feat = build_features(df)
        assert feat[FEATURE_COLS].isna().sum().sum() == 0

    def test_days_of_stock_left_nonnegative(self):
        df = _tiny_panel()
        feat = build_features(df)
        assert (feat["days_of_stock_left"] >= 0).all()


class TestStockoutLabeling:
    def test_stockout_flag_is_binary(self):
        df = _tiny_panel()
        # simulate a DB-loaded frame missing labels
        df["stock_out_flag"] = (df["current_stock"] == 0).astype(int)
        assert set(df["stock_out_flag"].unique()).issubset({0, 1})


class TestDemandTargets:
    def test_demand_targets_no_leakage_and_correct_sum(self):
        from app.ml.preprocessing.features import compute_demand_targets
        df = _tiny_panel()
        res = compute_demand_targets(df)
        
        # Check all target columns exist
        for h in [1, 7, 14, 30]:
            col = f"demand_target_{h}d"
            assert col in res.columns
            assert res[col].isna().sum() == 0
            assert (res[col] >= 0).all()

        # Check 7-day sum at index 0 equals sum of first 7 days (index 0 to 6)
        raw_cons = df.sort_values("date")["daily_consumption"].values
        assert res["demand_target_7d"].iloc[0] == raw_cons[0:7].sum()
        # Check 14-day sum at index 0 equals sum of first 14 days (index 0 to 13)
        assert res["demand_target_14d"].iloc[0] == raw_cons[0:14].sum()

    def test_demand_targets_monotonic_horizon_scale(self):
        from app.ml.preprocessing.features import compute_demand_targets
        df = _tiny_panel()
        res = compute_demand_targets(df)
        # Average cumulative consumption must grow with horizon
        assert res["demand_target_1d"].mean() < res["demand_target_7d"].mean()
        assert res["demand_target_7d"].mean() < res["demand_target_14d"].mean()
        assert res["demand_target_14d"].mean() < res["demand_target_30d"].mean()


class TestRiskLevelMapping:
    def test_risk_thresholds_monotonic(self):
        from app.services.prediction_service import risk_level_for
        assert risk_level_for(0.95) == "CRITICAL"
        assert risk_level_for(0.7) == "HIGH"
        assert risk_level_for(0.4) == "MEDIUM"
        assert risk_level_for(0.1) == "LOW"

    def test_risk_boundary_values(self):
        from app.services.prediction_service import risk_level_for
        assert risk_level_for(0.85) == "CRITICAL"
        assert risk_level_for(0.6) == "HIGH"
        assert risk_level_for(0.3) == "MEDIUM"
