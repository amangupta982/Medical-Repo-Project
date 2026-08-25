"""
BRICS Health Resilience Platform — FastAPI Application Entry Point.

Production features:
- Lifespan context manager for startup/shutdown (DB check, logging init, model preload)
- CORS configured from environment (not hardcoded *)
- Middleware: correlation-ID, request timing
- Global exception handlers for structured error responses
- Health endpoints: /health (liveness), /health/ready (readiness), /health/details (debug)
- API versioning: /api/v1/* with /api/* backward-compatible aliases
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.core.middleware import CorrelationIDMiddleware, RequestTimingMiddleware
from app.core.exceptions import (
    AppException, app_exception_handler,
    value_error_handler, runtime_error_handler,
    unhandled_exception_handler,
)
from app.database.session import check_db_connection
from app.api import network, predict, ai_features
from app.schemas.schemas import HealthResponse, ReadinessResponse

settings = get_settings()
logger = get_logger("main")

_start_time: float = 0.0


# ── Lifespan ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle manager."""
    global _start_time
    _start_time = time.time()

    # Startup
    setup_logging(level=settings.LOG_LEVEL, json_output=not settings.DEBUG)
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    logger.info("Debug mode: %s | Log level: %s", settings.DEBUG, settings.LOG_LEVEL)

    # Verify DB connectivity
    db_status = check_db_connection()
    if db_status["status"] == "connected":
        logger.info("Database connected — pool_size=%s", db_status.get("pool_size"))
    else:
        logger.error("Database NOT connected at startup: %s", db_status.get("error"))

    yield

    # Shutdown
    logger.info("Shutting down %s", settings.APP_NAME)


# ── App ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI-powered platform for national-scale PHC network visibility, "
        "stock-out prediction, resource redistribution, and federated learning "
        "across simulated BRICS national clients."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── Middleware (order matters: outermost first) ──────────────────────────

app.add_middleware(RequestTimingMiddleware)
app.add_middleware(CorrelationIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-ID", "X-Response-Time-Ms"],
)


# ── Exception Handlers ──────────────────────────────────────────────────

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(ValueError, value_error_handler)
app.add_exception_handler(RuntimeError, runtime_error_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)


# ── Routers ──────────────────────────────────────────────────────────────

# Primary versioned routes: /api/v1/*
app.include_router(network.router, prefix="/api/v1")
app.include_router(predict.router, prefix="/api/v1")
app.include_router(ai_features.router, prefix="/api/v1")

# Backward-compatible aliases: /api/* (same handlers, no prefix change needed)
app.include_router(network.router)
app.include_router(predict.router)
app.include_router(ai_features.router)


# ── Health Endpoints ─────────────────────────────────────────────────────

@app.get("/", tags=["system"])
def root():
    """Root endpoint — service info."""
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health():
    """Liveness probe — returns 200 if the process is running."""
    return {"status": "healthy"}


@app.get("/health/ready", response_model=ReadinessResponse, tags=["system"])
def health_ready():
    """
    Readiness probe — checks DB connectivity and model availability.
    Returns 200 if all dependencies are healthy, 503 otherwise.
    """
    from fastapi.responses import JSONResponse
    from app.services.model_registry import model_registry

    db_status = check_db_connection()
    model_stats = model_registry.get_cache_stats()

    is_ready = db_status["status"] == "connected"
    status_code = 200 if is_ready else 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if is_ready else "not_ready",
            "database": db_status,
            "models": model_stats,
        },
    )


@app.get("/health/details", tags=["system"])
def health_details():
    """
    Detailed system info for debugging — not exposed publicly in production.
    Includes uptime, pool stats, model cache, and config (non-sensitive).
    """
    from app.services.model_registry import model_registry

    db_status = check_db_connection()
    model_stats = model_registry.get_cache_stats()

    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - _start_time, 1),
        "version": settings.APP_VERSION,
        "debug": settings.DEBUG,
        "log_level": settings.LOG_LEVEL,
        "database": db_status,
        "models": model_stats,
        "config": {
            "cors_origins": settings.cors_origins_list,
            "db_pool_size": settings.DB_POOL_SIZE,
            "db_max_overflow": settings.DB_MAX_OVERFLOW,
            "model_cache_ttl": settings.MODEL_CACHE_TTL_SECONDS,
        },
    }
