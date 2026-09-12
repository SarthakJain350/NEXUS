# NEXUS — Backup Walkthrough Video Script

Timed narration script for the **backup walkthrough recording** (runbook §5
fallback, NEXT-5 item 2). Read the narration aloud while performing the
on-screen action. Target length **~7 minutes**. Record in one take if
possible — a backup video does not need to be perfect, only complete.

> Recording tips: 1080p, browser zoom ~110% so text is legible; keep the
> terminal font large; record system audio off (you narrate live); if a step
> fails, keep recording, say the fallback line, and move on — the fallback
> moment is itself good evidence the system degrades gracefully.

---

## 0. Setup BEFORE hitting record (≈5 min, off-camera)

1. Start the full stack per `docs/demo_runbook.md` §1 (Postgres → uvicorn →
   dashboard). Verify the header shows **ONLINE**.
2. Run `python seed_data.py` once (§2).
3. Have a second terminal open in the CV env, `cd C:\NEXUS`, with the
   live-ingest command typed and ready (§3).
4. Open http://localhost:3000 on the **Overview** workspace.
5. Close all other tabs; clear notifications; do a dry click-through once so
   nothing surprises you on camera.

---

## 1. Opening — what NEXUS is (0:00–0:40)

**On screen:** Overview workspace, idle.

**Narration:**

> "This is NEXUS — the Networked EXplainable Vehicle Intelligence System,
> built for Smart India Hackathon problem statement SIH26127: a city-wide AI
> engine for multi-camera ANPR, trajectory tracking, and urban traffic
> analytics. The idea: any plain city CCTV feed becomes a queryable traffic
> record. In the next few minutes I'll show the full chain — live video in,
> detection, tracking, plate recognition, storage in PostgreSQL, and the
> cross-camera journey of one vehicle on a GIS map."

---

## 2. The live pipeline — terminal moment (0:40–2:10)

**On screen:** switch to the CV terminal, run the live ingest command:

```powershell
python scripts/run_video_live_ingest.py --video data/test_video.mp4 --camera CAM_01 --max-frames 200 --stride 2
```

**Narration (while it runs — each console line is a pipeline hit):**

> "This is the real pipeline, running now. YOLO detects every vehicle;
> ByteTrack assigns each one a persistent track ID that survives occlusion;
> the vehicle crop is passed to a custom-trained plate detector — 99.49
> percent mAP at 50 — and Fast-Plate-OCR reads the plate. Each line you see
> is one full pass: frame, track, plate, detection and OCR confidences, and
> a POST into the backend."

**Point at one console line** (e.g. `[Frame 042] Track #3 (car) -> Plate: ... -> Ingested [201]`):

> "A 201 here means the observation was stored. If the same frame is ever
> resent, the backend is idempotent — it returns 200 and stores nothing
> twice. That's what makes this safe for retries and camera reconnects."

**Second-camera moment (optional, strong):** re-run with `--camera CAM_02`:

> "Now the same system on a second camera. The backend links observations by
> plate, so this vehicle's journey grows across cameras — that's the
> cross-camera story."

---

## 3. Dashboard — the command center (2:10–4:40)

**On screen:** back to the browser.

**Overview (2:10–2:30):**

> "The React command center polls the backend every 12 seconds. Overview
> shows corridor KPIs, camera fleet status, and the live observation feed —
> the detections you just watched in the terminal are already here."

**GIS map (2:30–3:00):**

> "Eight cameras along the Mumbai–Pune corridor. Clicking a camera opens its
> recent observations with plate numbers and confidences."

Click CAM_01 marker, open the drawer.

**Vehicle search + journey (3:00–3:45) — THE money shot:**

Type `MH12AB1234` in vehicle search, select it, show the journey/trajectory.

> "Searching by plate — this vehicle was observed at five different cameras.
> The map shows its full cross-camera trajectory as one polyline, ordered by
> timestamp. One identity, one journey, across the city — this is the core
> of the problem statement. The global ID NEXUS_V00001 links every
> observation of this vehicle."

**ANPR + upload feature (3:45–4:20):**

Open the ANPR workspace, click **Upload Video**, pick `data/clip_b.mp4`
(test clips beforehand — labels can cover plates).

> "Judges can feed their own footage: this upload runs the identical
> pipeline server-side and streams results back — plate, detection
> confidence, OCR confidence, and the real timestamp of when it was
> processed. Uploading the same clip again is correctly rejected as a
> replay, proving idempotency."

**Analytics + alerts (4:20–4:40):**

> "Traffic level, vehicle-type split, and camera load are computed from the
> live data, and the alert engine flags low-confidence reads, congestion,
> and camera health issues. Acknowledging or resolving an alert now
> persists — it survives a page reload."

---

## 4. Honest architecture minute (4:40–6:00)

**On screen:** any workspace; narrate over it.

> "Quickly, what's real and what isn't — because we built this to be
> honestly presented. Real: the YOLO vehicle detection, ByteTrack tracking,
> the custom plate detector, Fast-Plate-OCR, the idempotent PostgreSQL
> ingest, the journeys, and everything you've seen on this dashboard.
> The cross-camera global IDs you saw are plate-linked associations — the
> MVP approach. A visual re-identification module with handcrafted feature
> embeddings ships as a reference baseline; it's future work to fuse it in,
> and CityFlowV2 is our designated validation dataset for that. We'd rather
> show a working plate-linked system than a decorative Re-ID demo."

**On screen:** open the Re-ID studio briefly.

> "This Re-ID view shows the vehicle's real cross-camera sightings — the
> actual observations behind the association, with no invented similarity
> scores."

---

## 5. Close (6:00–6:30)

**On screen:** back to Overview, zoom out.

> "Everything you saw is one integrated system: video in, structured
> city-scale traffic intelligence out, queryable by plate, camera, or
> vehicle. Thanks for watching."

---

## Fallback lines (if something fails mid-recording)

| Failure | Say this |
|---|---|
| Live ingest crashes | "The pipeline is also captured in this annotated output video from an earlier run" — play `runs/tracking/live_ingest_output.mp4` |
| Dashboard shows SIMULATED | "The backend dropped — note it degrades gracefully rather than blanking out" — restart stack, re-record section 3 |
| Upload clip finds 0 plates | "Out-of-domain footage is reported honestly as zero rather than hallucinating a plate — the model is trained on corridor footage" — switch to `test_video.mp4` |

## After recording

- Save as `NEXUS_Demo_Walkthrough_<date>.mp4` (NOT inside the repo, or add to
  the LFS-ignored output dirs) plus screenshots of: overview, journey map,
  upload modal results, re-id sightings.
- Mark TODO §11 "Screenshots/video recording" done.
