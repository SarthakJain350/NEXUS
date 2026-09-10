"""Application settings (Plan §9).

Importing get_settings() fails fast and loudly when DATABASE_URL is
missing or malformed — at process start, not on the first request.
"""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # PostgreSQL connection — required, no default, no hard-coded creds.
    database_url: str

    # Comma-separated CORS origins (Plan §20) — never "*" in production.
    allowed_origins: str = "http://localhost:3000,http://localhost:8501"

    # Explicit pool settings (Plan §9) — the default pool starves under
    # the §14 stress test, producing timeouts that look like DB outages.
    pool_size: int = 10
    max_overflow: int = 20
    pool_timeout: int = 30  # seconds waiting for a connection

    @field_validator("database_url")
    @classmethod
    def _validate_database_url(cls, v: str) -> str:
        v = v.strip()
        if v.startswith("postgresql://"):
            # psycopg v3 driver (D4) — SQLAlchemy's bare `postgresql://`
            # defaults to psycopg2, which isn't installed.
            v = "postgresql+psycopg://" + v[len("postgresql://"):]
        if not v.startswith("postgresql+psycopg://"):
            raise ValueError(
                "DATABASE_URL must be a PostgreSQL URL, e.g. "
                "postgresql+psycopg://user:password@localhost:5432/nexus"
            )
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
