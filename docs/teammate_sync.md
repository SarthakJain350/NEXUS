# NEXUS — Teammate Sync Brief (pre-SIH)

> Written 2026-09-13. Everything here is the **true, defensible story** —
> same rule as `docs/viva_prep.md`: we own limitations out loud.
>
> **tl;dr for everyone:** `main` is the single source of truth (PRs #10–#16
> merged, CI green path set up). Pull a fresh copy, boot the stack once with
> `docs/demo_runbook.md`, and read the two docs listed for your module.
> No teammate action is blocking the demo.

---

## Everyone (all owners)

1. **Pull fresh main.** `git checkout main && git pull` (or re-clone; the
   fresh-clone checklist is `docs/environments.md` — 3 runtimes: root CV
   env, backend venv, frontend npm).
2. **Boot the stack once** before the day: `docs/demo_runbook.md` §1
   (docker Postgres → alembic → uvicorn → npm dev). If the dashboard shows
   the 86-observation seeded dataset and MH12AB1234's CAM_01→CAM_06 journey,
   you're good.
3. **Read `docs/viva_prep.md`** end-to-end. It contains the team answer
   script — the opener, the tech-choice table, the expected questions, and
   the limitations we present honestly.
4. **Decisions you must know** (answered by Sarthak, recorded in TODO.md):
   - **D1** demo detector = COCO `yolo11n.pt` (no custom vehicle model before SIH; never claim it's Indian-road-trained)
   - **D2** official R2 = `app.py` Fast-Plate-OCR engine; `r2_anpr/` = legacy/reference
   - **D3** cross-camera identity for the demo = plate association + seeded `NEXUS_V#####` IDs; **never claim seeded IDs as Re-ID**
   - **D4** analytics/alerts = client-side for MVP; Python `analytics/` = reference layer
   - **D6** global ID format = `NEXUS_V00001` (not `GV-XXXX`)
   - **D10** React dashboard = primary demo UI; Streamlit = reference prototype
5. **CI** now runs on PRs to main (`.github/workflows/ci.yml`): backend
   pytest on a Postgres 16 service + frontend lint/test/build. Root CV tests
   stay local (the torch stack is too heavy for CI — documented in the
   workflow header).

---

## Rohan — R1 (detection + tracking)

**What changed in your area since you last looked:**
- Your tracker is fully in the demo path: `src/tracking/r1_tracker.py` runs
  inside `scripts/run_video_live_ingest.py`, which POSTs observations to the
  backend live (idempotent — replays return 200, not duplicates).
- Live ingest now sends the full contract: `trajectory`,
  `plate_confidence`, `detection_confidence`, `ocr_confidence` — verified
  against the backend schema by `backend/tests/test_live_ingest_contract.py`.
- New doc for you: `src/tracking/README.md` (tracker usage/params/tests).

**Review before the viva (your defense surface):**
- ByteTrack's two-stage association (high/low-score) and why it survives
  occlusion; the active/lost/removed lifecycle.
- The D1 framing: the demo detector is COCO `yolo11n.pt` — say so plainly;
  fine-tuning on the Indian Road subset (autorickshaw class) is future work.
- Your tests: `python -m pytest tests/test_r1_tracking.py -q`
  (7 tests, no GPU needed).

**Not before SIH (decided):** no custom vehicle detector training (D1),
no MOTA/IDF1 evaluation. If asked "what's next": fine-tune on the Indian
Road subset for autorickshaw, evaluation metrics, CityFlowV2 as the
multi-camera validation dataset.

---

## Harshit — R5 (Re-ID/analytics/alerts)

**What changed in your area since you last looked:**
- `docs/R5_REID_ANALYTICS.md` now carries an honest status banner: R5 is
  the offline/reference layer, not wired into the runtime — by decision D4
  (the dashboard computes its own client-side analytics; the split is
  documented in the READMEs).

**Review before the viva (your defense surface):**
- Re-ID is **handcrafted features** (HSV hists, RGB stats, Sobel edges),
  cosine similarity, 0.78 threshold — a *baseline*, not learned embeddings.
  Why: no large Indian-vehicle re-id dataset in scope; the API is swappable.
- The D3 framing: plate linking is the reliable association today; Re-ID is
  the intended fallback mechanism, shown offline via
  `python scripts/run_r5_demo.py`.
- Your tests: `python -m pytest tests/test_r5.py -q` (5 tests, no GPU needed).

**Not before SIH (decided):** no real fusion engine (D3), no backend
analytics endpoints (D4), no blacklist/watchlist matching (P3). If asked
"what's next": real R6 fusion with temporal constraints, learned
embeddings, OD-matrix analytics.

---

## Rushil — R4 (frontend/GIS dashboard)

**What changed in your area (you shipped the base; later sessions fixed a lot):**
- Your dashboard is **the** demo UI (D10). Several fixes landed on top:
  - KPI/analytics/alerts now see up to 200 observations (was capped at 50)
  - Map-focus fixes: latest-waypoint focus, Leaflet zero-width-container fix
    (`ContainerSizeObserver`), no mock-journey substitution when online —
    selecting MH12AB1234 focuses CAM_06, verified in-browser
  - Re-ID workspace now shows **real plate-linked cross-camera sightings**
    (the old fake similarity scores are gone) — labeled honestly per D3
  - Alert Ack/Resolve persists across reload (localStorage)
  - **New feature:** local video upload → ANPR (`VideoUploadModal` in the
    ANPR workspace; backend runs the pipeline on a LOCAL_UPLOAD source)
  - Env-driven map tiles (`mapConfig.js` + `frontend/.env.example`) — keyless
    CARTO default, no API key in source
  - Quality: Vitest suite (26 tests, `npm test`), ESLint 9 flat config
    (`npm run lint`), CI runs lint+test+build on every PR

**Review before the viva:**
- `frontend/README.md` (stack, data flow, all 12 workspaces, honest labels,
  limitations) — it's your script.
- The honest-labels story: mock fallback exists for offline demos; when the
  backend is online everything is real except the AI-copilot drawer, which
  is openly a rule-based assistant, not an LLM.
- The D4 framing: analytics/alerts are computed client-side
  (`analyticsBridge.js` mirrors the Python logic); backend endpoints are
  future work.
- Run it yourself: `cd frontend && npm ci && npm test && npm run dev`.

**Demo tip:** the video upload expects ≤1-min in-domain clips
(`data/clip_b..e.mp4`); internet ANPR footage honestly reports 0 plates —
that's the domain-trained model refusing to hallucinate, a good viva line.

---

## khushi — R2 (ANPR/OCR)

**What changed in your area (decision D2 — important):**
- The **official R2** is the `app.py` pipeline: custom YOLOv11n plate
  detector (99.49% mAP@50) → preprocessing (pad, CLAHE, 4× Lanczos) →
  Fast-Plate-OCR (`cct-s-v2-global-model`) with GPT-4o-mini fallback.
- `r2_anpr/` (pytesseract) is marked **legacy/reference** in its README —
  it is not the competing pipeline and its known bugs are documented, not
  scheduled for fixing (D2). Don't present it as the production path.
- The engine now feeds the whole system: live ingest AND the dashboard's
  video-upload feature both run this pipeline, with `ocr_confidence` wired
  through to the DB (`plate_reads` keeps the raw OCR trail).

**Review before the viva (your defense surface):**
- Why two-stage (vehicle → plate crop → OCR) beats single-stage full-frame.
- The model card numbers: 99.49% mAP@50 plate detector, 2.6M params;
  efficiency.json in `NEXUS_Submission/` (6.5 GFLOPs / 25.49 ms / 10.04 MB).
- OCR confidence can be exactly 1.0 on clean crops — that's genuine model
  behavior (char probabilities saturate), not a bug; detection confidence
  varies 0.46–0.79 and is kept unblended (separate columns in `plate_reads`).
- The fallback chain: Fast-Plate-OCR → GPT-4o-mini (optional, env-keyed).
- Plate normalization: uppercase alnum, ≥4 chars, sentinel strings → null.

---

## Pre-SIH day checklist (one pass, any teammate)

```
# 1. Fresh main
git checkout main && git pull

# 2. Stack up (docs/demo_runbook.md §1)
cd backend && docker compose up -d && .venv\Scripts\activate
alembic upgrade head && python seed_data.py        # idempotent, safe to re-run
uvicorn app.main:app --reload                      # :8000
cd ..\frontend && npm ci && npm run dev            # :3000

# 3. Verify (docs/demo_runbook.md §4)
#   - dashboard online, 86+ observations
#   - search MH12AB1234 → NEXUS_V00001 → CAM_01..CAM_06 journey on map
#   - Re-ID workspace shows real sightings
#   - alert Ack → F5 → still acknowledged
#   - upload data/clip_b.mp4 → plates appear

# 4. Backend tests (ONLY while uvicorn is STOPPED — never both at once)
cd backend && pytest -q                            # expect 169 passed
```

**Golden rule:** never run backend pytest while uvicorn is live (it
starves the connection pool and every endpoint 500s).
