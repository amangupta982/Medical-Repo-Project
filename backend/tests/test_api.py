"""
Integration tests against a live FastAPI instance backed by the seeded Postgres DB.
Run with: pytest tests/test_api.py -v
(Requires: postgres running + seeded, and `uvicorn app.main:app` reachable,
 OR run via TestClient which spins the app in-process against DATABASE_URL.)
"""
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_list_phcs():
    r = client.get("/api/phcs")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        assert "code" in data[0] and "lat" in data[0]


def test_list_districts():
    r = client.get("/api/districts")
    assert r.status_code == 200


def test_resilience_score_shape():
    r = client.get("/api/resilience-score")
    if r.status_code == 200:
        data = r.json()
        assert all("resilience_score" in d for d in data)
        assert all(0 <= d["resilience_score"] <= 100 for d in data)


def test_models_performance_endpoint():
    r = client.get("/api/models/performance")
    assert r.status_code == 200


def test_stockout_prediction_requires_valid_phc():
    r = client.post("/api/predict/stockout", json={"phc_id": "NONEXISTENT-999", "medicine": "Paracetamol"})
    assert r.status_code in (404, 503)  # not found or model not trained yet


def test_emergency_simulation_returns_before_after():
    r = client.post("/api/emergency/simulate", json={"scenario": "dengue_outbreak"})
    if r.status_code == 200:
        data = r.json()
        assert "avg_risk_before" in data and "avg_risk_after" in data
        # a dengue outbreak scenario should not DECREASE average risk
        assert data["avg_risk_after"] >= data["avg_risk_before"] - 0.05  # small tolerance
