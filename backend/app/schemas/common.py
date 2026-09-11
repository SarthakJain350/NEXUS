"""Shared schema constants and helpers.

Pagination bounds per Plan §6.8: list endpoints clamp page_size to
MAX_PAGE_SIZE rather than erroring.
"""

from typing import Generic, TypeVar

from pydantic import BaseModel

MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 50

# cameras.status values (Plan §4 + §6.3 auto-create).
CAMERA_STATUSES = ("active", "inactive", "maintenance", "unregistered")

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Standard list-response envelope (§6.8): bounded, self-describing.

    `total` is the unfiltered-by-pagination match count so callers can
    page through everything.
    """

    items: list[T]
    total: int
    page: int
    page_size: int
