"""
Shared test fixtures for the BRICS Health Platform backend.

Provides:
- TestClient with proper app import
- Database session override for test isolation
- Helper functions for creating test data
"""
import sys
import os

# Ensure backend is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient that runs the full app in-process."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def base_url():
    """Base URL for API v1 endpoints."""
    return "/api/v1"
