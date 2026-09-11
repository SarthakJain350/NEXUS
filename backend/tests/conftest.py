"""Shared fixtures: an isolated nexus_test database on the local Postgres.

metadata.create_all is a test-only convenience here (Plan §11) — the
deployment path is always `alembic upgrade head`.
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.models import Base

TEST_DB_NAME = "nexus_test"


@pytest.fixture(scope="session")
def db_url() -> str:
    return make_url(get_settings().database_url).set(database=TEST_DB_NAME)


@pytest.fixture(scope="session")
def db_engine(db_url):
    # Create the test database via the maintenance connection.
    admin_url = make_url(get_settings().database_url).set(database="postgres")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"'))
        conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
    admin_engine.dispose()

    engine = create_engine(db_url)
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()

    # Drop again so re-runs start clean even if creation is skipped.
    cleanup = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with cleanup.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"'))
    cleanup.dispose()


@pytest.fixture
def db_session(db_engine) -> Session:
    factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    db = factory()
    try:
        yield db
    finally:
        db.rollback()
        db.close()
        # Isolate tests from each other: wipe all rows between tests.
        with db_engine.begin() as conn:
            for table in reversed(Base.metadata.sorted_tables):
                conn.execute(table.delete())
