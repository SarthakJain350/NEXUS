"""Shared schema constants and helpers.

Pagination bounds per Plan §6.8: list endpoints clamp page_size to
MAX_PAGE_SIZE rather than erroring.
"""

MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 50

# cameras.status values (Plan §4 + §6.3 auto-create).
CAMERA_STATUSES = ("active", "inactive", "maintenance", "unregistered")
