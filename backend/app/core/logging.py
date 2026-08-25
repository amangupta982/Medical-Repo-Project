"""
Structured JSON logging setup.

Provides consistent, machine-parseable log output with correlation IDs
for request tracing across services.
"""
import logging
import json
import sys
from contextvars import ContextVar
from datetime import datetime, timezone

# Context variable for per-request correlation ID
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="-")


class StructuredFormatter(logging.Formatter):
    """JSON formatter that includes correlation_id, timestamp, module, and level."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "module": record.module,
            "message": record.getMessage(),
            "correlation_id": correlation_id_ctx.get("-"),
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra_data"):
            log_entry["data"] = record.extra_data
        return json.dumps(log_entry, default=str)


def setup_logging(level: str = "INFO", json_output: bool = True) -> None:
    """
    Configure root logger with structured output.

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        json_output: If True, use JSON formatter. If False, use human-readable format.
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers to avoid duplicate output
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    if json_output:
        handler.setFormatter(StructuredFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(name)s | [%(correlation_id)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
                defaults={"correlation_id": "-"},
            )
        )

    root_logger.addHandler(handler)

    # Silence noisy third-party loggers
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger("uvicorn.error").setLevel(logging.INFO)


def get_logger(name: str) -> logging.Logger:
    """Get a named logger. Use this instead of logging.getLogger() directly."""
    return logging.getLogger(f"brics.{name}")
