"""Engine construction (Plan §9).

Importing this module instantiates Settings, so a missing/malformed
DATABASE_URL fails at process start rather than on the first request.
"""

from sqlalchemy import create_engine

from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    pool_timeout=settings.pool_timeout,
    pool_pre_ping=True,  # survive Postgres/container restarts
)
