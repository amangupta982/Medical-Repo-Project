"""
Database session management — production configuration.

- PostgreSQL only (no SQLite fallback — fail loudly if DB is unreachable).
- Proper connection pooling with configurable pool size, overflow, and recycle.
- Health-check function for readiness probes.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("database")
settings = get_settings()

# ── Engine ───────────────────────────────────────────────────────────────

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    echo=settings.DB_ECHO,
)

logger.info(
    "Database engine created — pool_size=%d, max_overflow=%d, recycle=%ds",
    settings.DB_POOL_SIZE,
    settings.DB_MAX_OVERFLOW,
    settings.DB_POOL_RECYCLE,
)

# ── Session Factory ──────────────────────────────────────────────────────

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ── Dependency ───────────────────────────────────────────────────────────

def get_db():
    """FastAPI dependency that yields a DB session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Health Check ─────────────────────────────────────────────────────────

def check_db_connection() -> dict:
    """
    Test database connectivity for readiness probes.
    Returns a dict with connection status and pool stats.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        pool = engine.pool
        return {
            "status": "connected",
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
        }
    except Exception as e:
        logger.error("Database health check failed: %s", str(e))
        return {
            "status": "disconnected",
            "error": str(e),
        }
