"""
Centralized application settings using pydantic-settings.

All configuration is loaded from environment variables (or .env file).
No more scattered os.getenv() calls throughout the codebase.
"""
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings — single source of truth for all config."""

    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "BRICS Health Resilience Platform API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    API_PORT: int = 8000

    # ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="postgresql://postgres:brics_dev_pw@localhost:5432/brics_health",
        description="PostgreSQL connection string. SQLite is NOT supported in production.",
    )
    DB_POOL_SIZE: int = Field(default=10, ge=1, le=50)
    DB_MAX_OVERFLOW: int = Field(default=20, ge=0, le=100)
    DB_POOL_TIMEOUT: int = Field(default=30, ge=5)
    DB_POOL_RECYCLE: int = Field(default=1800, description="Recycle connections after N seconds")
    DB_ECHO: bool = Field(default=False, description="Echo SQL statements (debug only)")

    # ── CORS ─────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175",
        description="Comma-separated allowed origins for CORS.",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # ── Model / ML ───────────────────────────────────────────────────────
    MODEL_CACHE_TTL_SECONDS: int = Field(
        default=300,
        description="How long to cache loaded ML model artifacts in memory (seconds).",
    )
    MODELS_DIR: str = Field(
        default="",
        description="Absolute path to the trained models directory. Auto-detected if empty.",
    )

    @property
    def models_directory(self) -> str:
        """Resolve the models directory path."""
        if self.MODELS_DIR:
            return self.MODELS_DIR
        # Default: project_root/models/trained
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        return os.path.join(os.path.dirname(backend_dir), "models", "trained")

    # ── Validation ───────────────────────────────────────────────────────
    @field_validator("DATABASE_URL")
    @classmethod
    def reject_sqlite_in_prod(cls, v: str) -> str:
        if "sqlite" in v.lower():
            raise ValueError(
                "SQLite is not supported. Set DATABASE_URL to a PostgreSQL connection string. "
                "Example: postgresql://user:pass@localhost:5432/brics_health"
            )
        return v

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Cached settings loader. Call this instead of Settings() directly
    so the .env file is only read once.
    """
    return Settings()
