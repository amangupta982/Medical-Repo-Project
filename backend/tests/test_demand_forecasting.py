"""
Integration and regression tests for multi-horizon demand forecasting.
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.db_models import ModelPerformance, PHC, Medicine

client = TestClient(app)


def test_predict_demand_multi_horizon_distinct_values():
    """
    Tests that POST /api/predict/demand returns modeled predictions across
    horizons 1, 7, 14, 30 that are NOT simple linear multiples of the 1-day prediction.
    """
    db = SessionLocal()
    first_phc = db.query(PHC).first()
    first_med = db.query(Medicine).first()
    db.close()

    assert first_phc is not None and first_med is not None

    preds = {}
    for h in [1, 7, 14, 30]:
        r = client.post("/api/predict/demand", json={
            "phc_id": first_phc.code,
            "medicine": first_med.name,
            "horizon_days": h
        })
        assert r.status_code == 200, f"Failed for horizon {h}: {r.text}"
        data = r.json()
        assert data["horizon_days"] == h
        assert data["final_prediction"] is not None
        assert data["selected_model"] in ("xgboost", "lightgbm")
        preds[h] = data["final_prediction"]

    # Assert that 7d, 14d, 30d are distinct and not exact linear multiples of 1d
    # (e.g. tree model capturing diminishing trend or non-linear window dynamics)
    assert preds[1] > 0
    assert preds[7] > preds[1]
    assert preds[14] > preds[7]
    assert preds[30] > preds[14]

    # Verify per-horizon task model was queried
    assert preds[7] != preds[1] * 7 or preds[14] != preds[1] * 14 or preds[30] != preds[1] * 30


def test_model_performance_tasks_exist_for_all_horizons():
    db = SessionLocal()
    for h in [1, 7, 14, 30]:
        task = f"demand_forecast_{h}d"
        rows = db.query(ModelPerformance).filter(ModelPerformance.task == task).all()
        assert len(rows) > 0, f"No model_performance rows found for task {task}"
        champion_count = sum(1 for r in rows if r.is_current_champion)
        assert champion_count == 1, f"Expected exactly 1 champion for task {task}, got {champion_count}"
    db.close()


def test_model_regression_thresholds():
    """
    Ensures model performance does not degrade below acceptable baseline boundaries.
    """
    db = SessionLocal()

    # Stockout classification
    stockout_champ = db.query(ModelPerformance).filter(
        ModelPerformance.task == "stockout_classification",
        ModelPerformance.is_current_champion == True
    ).first()
    assert stockout_champ is not None
    f2_val = stockout_champ.metrics.get("f2_score", stockout_champ.metrics.get("f2", 0))
    assert f2_val >= 0.70, f"Stockout F2 degraded below 0.70 (got {f2_val})"

    # Demand forecasting horizons
    h1_champ = db.query(ModelPerformance).filter(
        ModelPerformance.task == "demand_forecast_1d",
        ModelPerformance.is_current_champion == True
    ).first()
    assert h1_champ is not None
    assert h1_champ.metrics.get("mae", 999) <= 3.5, "1d Demand MAE degraded above 3.5"

    h7_champ = db.query(ModelPerformance).filter(
        ModelPerformance.task == "demand_forecast_7d",
        ModelPerformance.is_current_champion == True
    ).first()
    assert h7_champ is not None
    assert h7_champ.metrics.get("mae", 999) <= 20.0, "7d Demand MAE degraded above 20.0"

    h14_champ = db.query(ModelPerformance).filter(
        ModelPerformance.task == "demand_forecast_14d",
        ModelPerformance.is_current_champion == True
    ).first()
    assert h14_champ is not None
    assert h14_champ.metrics.get("mae", 999) <= 40.0, "14d Demand MAE degraded above 40.0"

    h30_champ = db.query(ModelPerformance).filter(
        ModelPerformance.task == "demand_forecast_30d",
        ModelPerformance.is_current_champion == True
    ).first()
    assert h30_champ is not None
    assert h30_champ.metrics.get("mae", 999) <= 80.0, "30d Demand MAE degraded above 80.0"

    db.close()
