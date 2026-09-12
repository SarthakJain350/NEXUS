# NEXUS — SIH Demo Runbook

One page. Exact commands, in order, with fallbacks. The **React dashboard is
the primary demo UI** (decision D10); `app.py` (Streamlit) is the standalone
ANPR reference prototype only.

> Decisions referenced: D1 (COCO detector), D2 (app.py engine = official R2),
> D3 (plate association + seeded IDs for MVP), D4 (client-side analytics),
> D6 (`NEXUS_V#####` global IDs), D8 (CityFlowV2 for R6 validation).

---

## 0. Prerequisites (once per machine)

- Docker Desktop running (Postgres 16)
- Two Python environments (never mixed):
  - **CV env** (root): `pip install -r requirements.txt` — needs
    `ultralytics`, `fast-plate-ocr`, `opencv`, `torch`
  - **Backend env**: `cd backend && python -m venv .venv && .venv\Scripts\activate
    && pip install -r requirements.txt` (includes `python-multipart`, needed
    by the video-upload feature)
- Node 18+ for the frontend (`cd frontend && npm install`)

## 1. Start the stack (≈2 min)

```powershell
# Terminal 1 — database
cd C:\NEXUS\backend
docker compose up -d            # wait for "healthy": docker ps

# Terminal 2 — backend
cd C:\NEXUS\backend
.venv\Scripts\activate
alembic upgrade head            # no-op if already migrated
uvicorn app.main:app --reload   # http://localhost:8000/docs

# Terminal 3 — dashboard
cd C:\NEXUS\frontend
npm run dev                     # http://localhost:3000
```

**Verify:** open http://localhost:3000 — header shows `ONLINE` + database
connected. If it says simulated, the backend isn't up (see Troubleshooting).

## 2. Seed the cross-camera corridor story (≈10 s)

```powershell
cd C:\NEXUS\backend
.venv\Scripts\activate
python seed_data.py
```

This creates 8 Mumbai–Pune cameras and 5 journeys, including:

- **MH12AB1234** (`NEXUS_V00001`): CAM_01 → CAM_02 → CAM_03 → CAM_05 → CAM_06
- **MH02CD5678** (`NEXUS_V00002`): CAM_03 → CAM_02 → CAM_01 → CAM_04
- **MH14EF9900** truck, **DL01XY9999** interstate bus, a motorcycle, and a
  no-plate auto (shows unreadable-plate handling)
- Re-running is safe (stable `ingest_id`s — replays are idempotent 200s).

## 3. Live single-camera ingest — R1→R2→R3 (the real pipeline)

```powershell
# Terminal 4 — CV env (root anaconda env / venv)
cd C:\NEXUS
python scripts/run_video_live_ingest.py --video data/test_video.mp4 --camera CAM_01 --max-frames 200 --stride 2
```

Watch the console: each line is a full pipeline hit —
`[Frame 042] Track #3 (car) -> Plate: MH12AB1234 (det 87%, ocr 94%) -> Ingested to R3 [201]`.
Annotated video is saved to `runs/tracking/live_ingest_output.mp4`.

- Second camera moment: re-run with `--camera CAM_02` and another clip.
  The backend links observations by plate, so the same vehicle's journey
  grows across cameras.
- If the video is missing, the script auto-generates a synthetic clip from
  dataset images.
- `--show` opens a live OpenCV window (use sparingly on CPU).

## 4. Dashboard walkthrough (the demo script)

1. **Overview** — corridor KPIs, camera status, live feed.
2. **GIS map** — camera markers along Mumbai–Pune; click a camera → drawer
   with its recent observations.
3. **Vehicle search** — type `MH12AB1234` → select the vehicle.
4. **Journey / trajectory** — cross-camera waypoints on the map + timeline;
   this is the cross-camera story (seeded global IDs, D3).
5. **Live feed / ANPR** — observations appear within ~12 s of ingest
   (dashboard polls every 12 s).
6. **Analytics** — traffic level, vehicle-type split, camera load
   (client-computed, D4).
7. **Alerts** — congestion/low-confidence alerts derived from live data.
8. **Re-ID studio** — clearly labeled simulation of the reference matcher.
9. **System health** — backend/DB status, camera fleet.

## 5. Backup / fallbacks

- **Backend down at demo time:** dashboard degrades gracefully to simulation
  mode (clearly bad for the demo — restart the stack, it takes 2 min).
- **Live video fails:** the seeded data alone carries the whole dashboard
  story; `runs/tracking/live_ingest_output.mp4` shows the pipeline offline.
- **Record a full walkthrough video + screenshots before SIH** as the last
  resort (P1 item — do this once the demo is stable).

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard shows "SIMULATED" | Backend not reachable: check `uvicorn` on :8000, then http://localhost:8000/api/v1/health/ready |
| `connection refused` from ingest script | Same — backend must be up before step 3 |
| `alembic upgrade head` fails | `docker ps` — is `backend-db-1` healthy? Then check `backend/.env` `DATABASE_URL` |
| Ingest 422 in console | Read the printed reason — usually plate-length (OCR garbage) or confidence out of [0,1] |
| No plates detected on custom video | Try `--plate-conf 0.15` and lower `--stride`; plates need ~40+ px height |
| Frontend proxy errors | Vite proxy targets :8000 — don't change the backend port, or edit `frontend/vite.config.js` |
| Models downloading on first run | YOLO weights are in `models/` (LFS) — verify `git lfs pull` after a fresh clone |

## 7. What we claim (viva honesty)

- Real: detection (YOLOv11n COCO, D1), plate detection (custom 99.49% mAP@50),
  OCR (Fast-Plate-OCR), ByteTrack tracking, idempotent PostgreSQL ingest,
  journeys, dashboard, client-side analytics.
- Simulated/seeded: cross-camera global IDs (`NEXUS_V#####` assigned in
  `seed_data.py`), Re-ID studio scores. **Not claimed as a trained Re-ID
  model** — `reid/` is the reference baseline; CityFlowV2 is the designated
  future validation dataset (D8).
