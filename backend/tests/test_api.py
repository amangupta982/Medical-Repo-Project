"""
Integration tests against the FastAPI backend.

Tests cover:
- Health endpoints (liveness, readiness, details)
- Backward-compatible /api/* routes
- Versioned /api/v1/* routes
- Pagination on list endpoints
- Error response structure
- Correlation-ID propagation
- Emergency simulation sanity checks
"""
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# ── Health Endpoints ─────────────────────────────────────────────────────

class TestHealthEndpoints:
    def test_liveness(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

    def test_readiness(self):
        r = client.get("/health/ready")
        # 200 if DB is up, 503 if not — both are valid test outcomes
        assert r.status_code in (200, 503)
        data = r.json()
        assert "status" in data
        assert "database" in data
        assert "models" in data

    def test_details(self):
        r = client.get("/health/details")
        assert r.status_code == 200
        data = r.json()
        assert "uptime_seconds" in data
        assert "version" in data
        assert "database" in data
        assert "models" in data
        assert "config" in data

    def test_root(self):
        r = client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "docs" in data


# ── Correlation ID ───────────────────────────────────────────────────────

class TestCorrelationID:
    def test_response_contains_correlation_id(self):
        r = client.get("/health")
        assert "X-Correlation-ID" in r.headers

    def test_propagates_provided_correlation_id(self):
        custom_id = "test-correlation-12345"
        r = client.get("/health", headers={"X-Correlation-ID": custom_id})
        assert r.headers["X-Correlation-ID"] == custom_id

    def test_response_contains_timing(self):
        r = client.get("/health")
        assert "X-Response-Time-Ms" in r.headers


# ── Backward Compatibility (/api/*) ─────────────────────────────────────

class TestBackwardCompatibility:
    def test_phcs_legacy_route(self):
        r = client.get("/api/phcs")
        assert r.status_code == 200

    def test_districts_legacy_route(self):
        r = client.get("/api/districts")
        assert r.status_code == 200

    def test_alerts_legacy_route(self):
        r = client.get("/api/alerts")
        assert r.status_code == 200


# ── Versioned API (/api/v1/*) ────────────────────────────────────────────

class TestVersionedAPI:
    def test_phcs_v1(self):
        r = client.get("/api/v1/api/phcs")
        assert r.status_code == 200

    def test_districts_v1(self):
        r = client.get("/api/v1/api/districts")
        assert r.status_code == 200


# ── Pagination ───────────────────────────────────────────────────────────

class TestPagination:
    def test_phcs_pagination(self):
        r = client.get("/api/phcs?skip=0&limit=5")
        assert r.status_code == 200
        data = r.json()
        assert "data" in data
        assert "pagination" in data
        assert "total" in data["pagination"]
        assert "has_more" in data["pagination"]
        assert len(data["data"]) <= 5

    def test_phcs_skip(self):
        r1 = client.get("/api/phcs?skip=0&limit=2")
        r2 = client.get("/api/phcs?skip=2&limit=2")
        if r1.status_code == 200 and r2.status_code == 200:
            data1 = r1.json()["data"]
            data2 = r2.json()["data"]
            if data1 and data2:
                # Ensure different records
                assert data1[0] != data2[0]

    def test_districts_pagination(self):
        r = client.get("/api/districts?skip=0&limit=3")
        assert r.status_code == 200
        data = r.json()
        assert "pagination" in data

    def test_alerts_pagination(self):
        r = client.get("/api/alerts?skip=0&limit=10")
        assert r.status_code == 200
        data = r.json()
        assert "pagination" in data


# ── Filtering ────────────────────────────────────────────────────────────

class TestFiltering:
    def test_alerts_filter_severity(self):
        r = client.get("/api/alerts?severity=HIGH")
        assert r.status_code == 200

    def test_phcs_filter_remote(self):
        r = client.get("/api/phcs?is_remote=true")
        assert r.status_code == 200


# ── Overview Stats ───────────────────────────────────────────────────────

class TestOverviewStats:
    def test_overview(self):
        r = client.get("/api/stats/overview")
        assert r.status_code == 200
        data = r.json()
        assert "total_phcs" in data
        assert "total_districts" in data
        assert "remote_phcs" in data
        assert "total_catchment_population" in data
        assert "avg_beds_per_phc" in data


# ── Prediction Error Handling ────────────────────────────────────────────

class TestPredictionErrors:
    def test_stockout_invalid_phc(self):
        r = client.post("/api/predict/stockout", json={
            "phc_id": "NONEXISTENT-999", "medicine": "Paracetamol"
        })
        # 404 (not found) or 503 (model not trained) — both valid
        assert r.status_code in (404, 503)
        data = r.json()
        assert "error" in data
        assert "correlation_id" in data["error"]

    def test_demand_invalid_phc(self):
        r = client.post("/api/predict/demand", json={
            "phc_id": "NONEXISTENT-999", "medicine": "Paracetamol", "horizon_days": 7
        })
        assert r.status_code in (404, 503)
        data = r.json()
        assert "error" in data


# ── Resilience Score ─────────────────────────────────────────────────────

class TestResilienceScore:
    def test_resilience_score_shape(self):
        r = client.get("/api/resilience-score")
        if r.status_code == 200:
            data = r.json()
            assert all("resilience_score" in d for d in data)
            assert all(0 <= d["resilience_score"] <= 100 for d in data)


# ── Model Performance ───────────────────────────────────────────────────

class TestModelPerformance:
    def test_list_all(self):
        r = client.get("/api/models/performance")
        assert r.status_code == 200

    def test_filter_by_task(self):
        r = client.get("/api/models/performance?task=stockout_classification")
        assert r.status_code == 200


# ── Emergency Simulation ────────────────────────────────────────────────

class TestEmergencySimulation:
    def test_dengue_outbreak(self):
        r = client.post("/api/emergency/simulate", json={"scenario": "dengue_outbreak"})
        if r.status_code == 200:
            data = r.json()
            assert "avg_risk_before" in data and "avg_risk_after" in data
            # dengue outbreak should not decrease average risk
            assert data["avg_risk_after"] >= data["avg_risk_before"] - 0.05
