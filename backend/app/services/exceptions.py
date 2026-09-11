"""Service-layer exceptions — mapped to clean HTTP responses in Phase 4.

Route handlers never see raw SQLAlchemy/DB errors (TODO 3.4): missing
entities raise NotFoundError, unrecoverable write conflicts raise
ConflictError. Messages here are safe to send to clients — no DB
details, no stack traces.
"""


class ServiceError(Exception):
    """Base class carrying a client-safe message."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(ServiceError):
    """Referenced entity doesn't exist — 404 (Plan §6.8)."""


class ConflictError(ServiceError):
    """Write conflict that retries didn't resolve — surfaced, never a 500."""
