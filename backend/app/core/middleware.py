"""
Production middleware stack.

- CorrelationIDMiddleware: Generates/propagates X-Correlation-ID for request tracing.
- RequestTimingMiddleware: Logs request duration, method, path, and status code.
"""
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import correlation_id_ctx, get_logger

logger = get_logger("middleware")

CORRELATION_HEADER = "X-Correlation-ID"


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    Extracts X-Correlation-ID from incoming request headers, or generates a
    new UUID if not present. Sets it in the contextvars for structured logging
    and includes it in the response headers.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Extract or generate correlation ID
        cid = request.headers.get(CORRELATION_HEADER, str(uuid.uuid4()))
        token = correlation_id_ctx.set(cid)

        try:
            response: Response = await call_next(request)
            response.headers[CORRELATION_HEADER] = cid
            return response
        finally:
            correlation_id_ctx.reset(token)


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """
    Logs every request with method, path, status code, and duration in ms.
    Useful for performance monitoring and slow-query detection.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response: Response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        # Only log non-health-check requests to keep logs clean
        path = request.url.path
        if path not in ("/health", "/health/ready"):
            logger.info(
                "%s %s → %d (%.1f ms)",
                request.method,
                path,
                response.status_code,
                duration_ms,
            )

        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
        return response
