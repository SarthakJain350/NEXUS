"""Batch ingest — per-item results, never atomic failure (Plan §6.7, TODO 3.2).

One bad row must not sink the batch: each item is validated and ingested
independently; the response says exactly which indexes failed and why.
"""

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.schemas.observation import (
    BatchIngestResult,
    ObservationCreate,
    ObservationRead,
    RejectedItem,
)
from app.services import observation_service
from app.services.exceptions import ServiceError


def ingest_batch(
    db: Session, items: list[dict | ObservationCreate]
) -> BatchIngestResult:
    accepted: list[ObservationRead] = []
    rejected: list[RejectedItem] = []

    for index, item in enumerate(items):
        reason: str | None = None
        try:
            payload = (
                item
                if isinstance(item, ObservationCreate)
                else ObservationCreate.model_validate(item)
            )
        except ValidationError as error:
            reason = _validation_reason(error)

        if reason is None:
            try:
                result = observation_service.ingest(db, payload)
                accepted.append(ObservationRead.model_validate(result.observation))
                continue
            except ServiceError as error:
                reason = error.message

        rejected.append(RejectedItem(index=index, reason=reason))

    return BatchIngestResult(accepted=accepted, rejected=rejected)


def _validation_reason(error: ValidationError) -> str:
    """Compact, client-safe summary of every failed field."""
    parts = []
    for err in error.errors():
        loc = ".".join(str(part) for part in err["loc"]) or "(root)"
        parts.append(f"{loc}: {err['msg']}")
    return "; ".join(parts)
