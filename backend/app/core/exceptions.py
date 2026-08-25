"""
Custom exception hierarchy for structured error responses.

Every exception maps to a specific HTTP status code and produces
a consistent JSON error body with correlation_id for debugging.
"""
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from app.core.logging import correlation_id_ctx, get_logger

logger = get_logger("exceptions")


# ── Base Exception ───────────────────────────────────────────────────────

class AppException(HTTPException):
    """Base application exception with structured error response."""

    def __init__(
        self,
        status_code: int = 500,
        code: str = "INTERNAL_ERROR",
        message: str = "An unexpected error occurred.",
        details: dict | None = None,
    ):
        self.code = code
        self.error_message = message
        self.details = details or {}
        super().__init__(status_code=status_code, detail=message)


# ── Specific Exceptions ─────────────────────────────────────────────────

class EntityNotFoundError(AppException):
    """Resource not found (404)."""

    def __init__(self, entity: str, identifier: str | int):
        super().__init__(
            status_code=404,
            code="ENTITY_NOT_FOUND",
            message=f"{entity} not found: {identifier}",
            details={"entity": entity, "identifier": str(identifier)},
        )


class ModelNotReadyError(AppException):
    """ML model not trained or not available (503)."""

    def __init__(self, model_task: str, hint: str = ""):
        msg = f"No trained model available for task: {model_task}."
        if hint:
            msg += f" {hint}"
        super().__init__(
            status_code=503,
            code="MODEL_NOT_READY",
            message=msg,
            details={"task": model_task},
        )


class InvalidRequestError(AppException):
    """Client sent an invalid request (422)."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(
            status_code=422,
            code="INVALID_REQUEST",
            message=message,
            details=details or {},
        )


class DatabaseError(AppException):
    """Database connectivity or query failure (503)."""

    def __init__(self, message: str = "Database operation failed."):
        super().__init__(
            status_code=503,
            code="DATABASE_ERROR",
            message=message,
        )


# ── Exception Handlers (registered in main.py) ──────────────────────────

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle all AppException subclasses with structured JSON response."""
    correlation_id = correlation_id_ctx.get("-")
    logger.warning(
        "AppException: %s [%s] — %s",
        exc.code, exc.status_code, exc.error_message,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.error_message,
                "details": exc.details,
                "correlation_id": correlation_id,
            }
        },
    )


async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    """Handle ValueError as 404 (entity not found) — matches existing convention."""
    correlation_id = correlation_id_ctx.get("-")
    logger.warning("ValueError: %s", str(exc))
    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "code": "NOT_FOUND",
                "message": str(exc),
                "correlation_id": correlation_id,
            }
        },
    )


async def runtime_error_handler(request: Request, exc: RuntimeError) -> JSONResponse:
    """Handle RuntimeError as 503 (service not ready) — matches existing convention."""
    correlation_id = correlation_id_ctx.get("-")
    logger.error("RuntimeError: %s", str(exc))
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "SERVICE_UNAVAILABLE",
                "message": str(exc),
                "correlation_id": correlation_id,
            }
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions — never leak stack traces to client."""
    correlation_id = correlation_id_ctx.get("-")
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Check logs with the correlation_id.",
                "correlation_id": correlation_id,
            }
        },
    )
