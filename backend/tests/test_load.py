"""Load / stress tests (TODO Phase 6, Plan §14).

Runs against a REAL uvicorn server on an ephemeral localhost port (not
TestClient) so requests actually execute concurrently — that is the only
way to exercise the connection pool and the §6.2 duplicate-ingest_id race
over HTTP. The app's get_db is overridden to a sessionmaker bound to the
nexus_test database with the SAME pool shape as production (10 + 20
overflow, 30s timeout — Plan §9), so pool-limit behavior is faithful.

Durations/scale are env-tunable so the default `pytest -q` run stays
seconds, while the real numbers for docs/integration.md (TODO 6.2) can be
recorded with e.g.:
    NEXUS_LOAD_SOAK_SECONDS=180 NEXUS_LOAD_CONCURRENCY=200 pytest tests/test_load.py
"""

from __future__ import annotations

import asyncio
import os
import threading
import time
import tracemalloc
from datetime import datetime, timedelta, timezone

import httpx
import pytest
import uvicorn
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.database.session import get_db
from app.main import app
from app.models import Base

UTC = timezone.utc

# Tunables (defaults keep `pytest -q` fast; env overrides for §14.3 records)
CONCURRENT_POSTS = int(os.environ.get("NEXUS_LOAD_CONCURRENCY", "200"))
JOURNEY_ROWS = int(os.environ.get("NEXUS_LOAD_JOURNEY_ROWS", "3000"))
SOAK_SECONDS = float(os.environ.get("NEXUS_LOAD_SOAK_SECONDS", "5"))
SOAK_CAMERAS = int(os.environ.get("NEXUS_LOAD_SOAK_CAMERAS", "20"))
# Generous localhost bound — the point is catching pathological behavior
# (seq-scan + sort per page), not micro-benchmarking.
P95_JOURNEY_PAGE_SECONDS = float(os.environ.get("NEXUS_LOAD_P95_SECONDS", "1.0"))


def past(seconds_ago: float) -> datetime:
    return datetime.now(UTC) - timedelta(seconds=seconds_ago)


def payload(i: int, **overrides) -> dict:
    base = dict(
        camera_id=f"CAM_LOAD_{i % 10:02d}",
        track_id=i,
        plate_number=f"LOAD{i:06d}",
        timestamp=past(60 + i).isoformat(),
        vehicle_type="car",
        confidence=0.9,
        latitude=28.60 + (i % 100) * 0.0001,
        longitude=77.20 + (i % 100) * 0.0001,
        ingest_id=f"load-{i}",
    )
    base.update(overrides)
    return base


@pytest.fixture(scope="module")
def load_engine(db_engine, db_url):
    """Engine with the production pool shape (pool_size/max_overflow/
    pool_timeout from Settings — Plan §9) pointed at nexus_test. The live
    server's sessions come from here, so its `.pool.status()` reports what
    the app actually holds."""
    settings = get_settings()
    engine = create_engine(
        db_url,
        pool_size=settings.pool_size,
        max_overflow=settings.max_overflow,
        pool_timeout=settings.pool_timeout,
        pool_pre_ping=True,
    )
    yield engine
    engine.dispose()


@pytest.fixture(scope="module")
def base_url(load_engine):
    """Real uvicorn server on an ephemeral port, wired to nexus_test via
    the load_engine."""
    factory = sessionmaker(bind=load_engine, autoflush=False, expire_on_commit=False)

    def _get_load_db():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_load_db

    config = uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(200):  # wait up to 10s for bind
        if server.started:
            break
        time.sleep(0.05)
    assert server.started, "uvicorn failed to start"
    port = server.servers[0].sockets[0].getsockname()[1]

    yield f"http://127.0.0.1:{port}"

    server.should_exit = True
    thread.join(timeout=10)
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clean_tables(db_engine):
    """Isolate load tests from each other (same wipe as conftest db_session)."""
    yield
    with db_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


def count_rows(db_engine, where: str) -> int:
    with db_engine.connect() as conn:
        return conn.execute(text(f"SELECT COUNT(*) FROM observations {where}")).scalar_one()


# --- 6.1.1 + 6.1.2: concurrent writes (§14.1) --------------------------------


@pytest.mark.asyncio
async def test_concurrent_posts_no_pool_exhaustion(base_url, db_engine):
    """N concurrent POSTs, all unique: every one lands, no 5xx, no hang."""
    async with httpx.AsyncClient(base_url=base_url, timeout=60) as client:
        responses = await asyncio.gather(
            *(client.post("/api/v1/observations", json=payload(i))
              for i in range(CONCURRENT_POSTS))
        )
    statuses = [r.status_code for r in responses]
    assert all(s == 201 for s in statuses), sorted(set(statuses))
    assert count_rows(db_engine, "") == CONCURRENT_POSTS


@pytest.mark.asyncio
async def test_same_ingest_id_concurrent_exactly_one_row(base_url, db_engine):
    """The classic §6.2 race: 50 concurrent POSTs of the SAME payload.

    Two requests both check "exists?", both see no, both insert — the
    nullable-unique index must catch it and the retry loop must return a
    clean idempotent response. Exactly one row, exactly one 201, rest 200,
    never a 500.
    """
    same = payload(0, ingest_id="race-dup-1")
    async with httpx.AsyncClient(base_url=base_url, timeout=60) as client:
        responses = await asyncio.gather(
            *(client.post("/api/v1/observations", json=same) for _ in range(50))
        )
    statuses = [r.status_code for r in responses]
    assert all(s in (200, 201) for s in statuses), sorted(set(statuses))
    assert statuses.count(201) == 1  # exactly one true insert
    ids = {r.json()["id"] for r in responses}
    assert len(ids) == 1  # everyone got the same existing record back
    assert count_rows(db_engine, "WHERE ingest_id = 'race-dup-1'") == 1


# --- 6.1.3: large journey result set (§14.1) ---------------------------------


def seed_journey(db_engine, rows: int) -> int:
    """Bulk-seed `rows` observations for ONE vehicle, out-of-order on
    purpose (§13 journey test), via direct inserts — seeding is not under
    test, speed is."""
    with db_engine.begin() as conn:
        conn.execute(
            text("INSERT INTO cameras (camera_id, status) VALUES ('CAM_J', 'active')")
        )
        vehicle_id = conn.execute(
            text("INSERT INTO vehicles (plate_number_best_guess, vehicle_type) "
                 "VALUES ('JOURNEY1', 'car') RETURNING id")
        ).scalar_one()
        base = past(3600)
        obs = [
            {
                "vehicle_id": vehicle_id,
                "camera_id": "CAM_J",
                "track_id": i % 50,
                "plate_number": "JOURNEY1",
                "timestamp": base - timedelta(seconds=rows - i),  # reverse order
                "vehicle_type": "car",
                "confidence": 0.9,
                "latitude": 28.60,
                "longitude": 77.20,
            }
            for i in range(rows)
        ]
        conn.execute(
            text(
                "INSERT INTO observations (vehicle_id, camera_id, track_id, "
                "plate_number, timestamp, vehicle_type, confidence, latitude, "
                "longitude) VALUES (:vehicle_id, :camera_id, :track_id, "
                ":plate_number, :timestamp, :vehicle_type, :confidence, "
                ":latitude, :longitude)"
            ),
            obs,
        )
    return vehicle_id


def journey_page_latencies(base_url: str, vehicle_id: int) -> list[float]:
    """Fetch the whole journey (page_size=200) and return per-page
    latencies; asserts nothing, measuring."""
    latencies: list[float] = []
    with httpx.Client(base_url=base_url, timeout=30) as client:
        page, total = 1, None
        while True:
            start = time.perf_counter()
            response = client.get(
                f"/api/v1/vehicles/{vehicle_id}/journey",
                params={"page": page, "page_size": 200},
            )
            latencies.append(time.perf_counter() - start)
            assert response.status_code == 200
            body = response.json()
            total = body["total"]
            if page * 200 >= total:
                break
            page += 1
    return latencies


def test_journey_latency_with_thousands_of_rows(base_url, db_engine):
    vehicle_id = seed_journey(db_engine, JOURNEY_ROWS)

    latencies = journey_page_latencies(base_url, vehicle_id)
    pages = len(latencies)
    assert pages == (JOURNEY_ROWS + 199) // 200
    assert sum(latencies) > 0

    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95) - 1]
    print(f"\njourney: {JOURNEY_ROWS} rows over {pages} pages — "
          f"p50={latencies[len(latencies)//2]*1000:.1f}ms p95={p95*1000:.1f}ms")

    # Informational index comparison (§14.1 "if feasible"): same pages
    # without the composite index. Non-asserting — the gap at 3k rows is
    # small; this documents direction, and the p95 bound below is the gate.
    with db_engine.begin() as conn:
        conn.execute(text("DROP INDEX ix_observations_vehicle_timestamp"))
    try:
        no_index = sorted(journey_page_latencies(base_url, vehicle_id))
        print(f"journey (no index): p50={no_index[len(no_index)//2]*1000:.1f}ms "
              f"p95={no_index[int(len(no_index)*0.95)-1]*1000:.1f}ms")
    finally:
        with db_engine.begin() as conn:
            conn.execute(
                text("CREATE INDEX ix_observations_vehicle_timestamp "
                     "ON observations (vehicle_id, timestamp)")
            )

    assert p95 < P95_JOURNEY_PAGE_SECONDS, f"p95 journey page {p95:.3f}s exceeds bound"

    # Correctness under load too: total + ascending order across pages.
    with httpx.Client(base_url=base_url, timeout=30) as client:
        seen: list[datetime] = []
        for page in range(1, pages + 1):
            body = client.get(
                f"/api/v1/vehicles/{vehicle_id}/journey",
                params={"page": page, "page_size": 200},
            ).json()
            assert body["total"] == JOURNEY_ROWS
            seen.extend(datetime.fromisoformat(p["timestamp"]) for p in body["items"])
    assert len(seen) == JOURNEY_ROWS
    assert seen == sorted(seen)


# --- 6.1.4: mixed batch (§14.1 / §6.7) ----------------------------------------


@pytest.mark.asyncio
async def test_mixed_valid_invalid_batch_partial_success(base_url, db_engine):
    valid = [payload(1000 + i) for i in range(20)]
    invalid = [
        dict(payload(2000), confidence=1.5),          # out of [0,1]
        dict(payload(2001), latitude=91.0),           # out of range
        dict(payload(2002), timestamp="not-a-date"),  # malformed
        dict(payload(2003), plate_number="X" * 13),   # too long after normalize
        {k: v for k, v in payload(2004).items() if k != "track_id"},  # missing
    ]
    response = await _post_batch(base_url, valid + invalid)

    assert response.status_code == 200
    result = response.json()
    assert len(result["accepted"]) == 20
    assert len(result["rejected"]) == 5
    assert {r["index"] for r in result["rejected"]} == set(range(20, 25))
    assert all(r["reason"] for r in result["rejected"])
    assert count_rows(db_engine, "") == 20  # only the valid rows persisted


async def _post_batch(base_url: str, rows: list[dict]) -> httpx.Response:
    async with httpx.AsyncClient(base_url=base_url, timeout=60) as client:
        return await client.post("/api/v1/observations/batch", json=rows)


# --- 6.1.5: malformed-input fuzzing (§14.1) -----------------------------------


@pytest.mark.asyncio
async def test_fuzz_malformed_payloads_clean_422_never_500(base_url, db_engine):
    bad_payloads = [
        dict(payload(3000), confidence="high"),        # wrong type
        dict(payload(3001), track_id="seventeen"),     # wrong type
        dict(payload(3002), camera_id=""),             # empty string
        dict(payload(3003), camera_id="C" * 65),       # oversized
        dict(payload(3004), plate_number="A" * 13),    # oversized after normalize
        dict(payload(3005), timestamp=past(-3600).isoformat()),  # future → 422
        dict(payload(3006), timestamp="2026-13-45T99:99:99Z"),   # malformed
        dict(payload(3007), latitude=-91.0),
        dict(payload(3008), longitude=200.0),
        dict(payload(3009), vehicle_type=""),          # empty → 422, not "other"
        {k: v for k, v in payload(3010).items() if k != "camera_id"},   # missing
        {k: v for k, v in payload(3011).items() if k != "timestamp"},   # missing
        {k: v for k, v in payload(3012).items() if k != "confidence"},  # missing
        {"camera_id": "CAM_FUZZ"},                     # near-empty body
        [],                                            # not an object
    ]
    async with httpx.AsyncClient(base_url=base_url, timeout=60) as client:
        for i, bad in enumerate(bad_payloads):
            response = await client.post("/api/v1/observations", json=bad)
            assert response.status_code == 422, (i, response.status_code, response.text)
            body = response.json()
            assert set(body) == {"error"}, (i, body)
            assert body["error"]["code"] == "validation_error"
            # No internals ever leak (Plan §16).
            blob = response.text.lower()
            assert "traceback" not in blob, i
            assert "psycopg" not in blob and "select" not in blob, i
    assert count_rows(db_engine, "") == 0  # nothing malformed persisted


@pytest.mark.asyncio
async def test_fuzz_extra_fields_ignored_and_accepted(base_url):
    """Documented decision (§14.1): extra fields are IGNORED, not rejected
    — upstream pipelines may add fields before the contract catches up.
    The full NEXUSVehicle ML contract (frame_id, vehicle_bbox, vehicle_crop,
    trajectory, plate_bbox) POSTs as-is today."""
    full_contract = payload(4000) | {
        "frame_id": 12345,
        "vehicle_class": "car",
        "vehicle_bbox": [100, 200, 300, 400],
        "vehicle_crop": "crops/17.jpg",
        "trajectory": [[28.60, 77.20], [28.61, 77.21]],
        "plate_bbox": [150, 250, 290, 270],
        "plate_text": "load4000",
        "plate_confidence": 0.87,
    }
    async with httpx.AsyncClient(base_url=base_url, timeout=60) as client:
        response = await client.post("/api/v1/observations", json=full_contract)
    assert response.status_code == 201
    assert response.json()["id"] > 0


# --- 6.1.6: sustained simulated camera rate (§14.1) ---------------------------


@pytest.mark.asyncio
async def test_sustained_camera_rate_no_leak(base_url, db_engine, load_engine):
    """SOAK_CAMERAS cameras × 1 obs/sec for SOAK_SECONDS (default 5s;
    set NEXUS_LOAD_SOAK_SECONDS=180 for the real §14.3 record).

    Gates: every observation accepted, row count exact, every connection
    returned to the pool at the end (no leak), and tracemalloc shows the
    peak was reclaimed (no unbounded growth).
    """
    ticks = int(SOAK_SECONDS)
    assert ticks >= 1, "NEXUS_LOAD_SOAK_SECONDS must be >= 1"
    sent = 0
    failures: list[str] = []

    tracemalloc.start()
    async with httpx.AsyncClient(base_url=base_url, timeout=60) as client:
        for tick in range(ticks):
            batch = [
                client.post(
                    "/api/v1/observations",
                    json=payload(10_000 + tick * SOAK_CAMERAS + c,
                                 camera_id=f"CAM_SOAK_{c:02d}",
                                 ingest_id=f"soak-{tick}-{c}"),
                )
                for c in range(SOAK_CAMERAS)
            ]
            responses = await asyncio.gather(*batch)
            sent += len(responses)
            for r in responses:
                if r.status_code != 201:
                    failures.append(f"tick {tick}: {r.status_code} {r.text[:200]}")
            if tick < ticks - 1:
                await asyncio.sleep(1.0)
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    assert not failures, failures[:3]
    assert count_rows(db_engine, "") == sent

    # No connection leak: every checked-out connection was returned.
    # .status() format: "Pool size: N Connections in pool: N Current
    # Overflow: N Current Checked out connections: N"
    status = load_engine.pool.status()
    print(f"\nsoak: {SOAK_CAMERAS} cameras x {ticks}s = {sent} obs "
          f"({sent / max(ticks, 1):.0f} obs/sec) — pool: {status} — "
          f"tracemalloc current={current/1e6:.1f}MB peak={peak/1e6:.1f}MB")
    assert "Checked out connections: 0" in status, status

    # No unbounded Python-side growth: virtually all of the peak is
    # reclaimed once the burst ends.
    assert current < peak * 0.5 + 5_000_000, (
        f"memory not reclaimed: current={current/1e6:.1f}MB peak={peak/1e6:.1f}MB"
    )
