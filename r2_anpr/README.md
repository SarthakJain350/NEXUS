# NEXUS R2 — ANPR / OCR Module

R2's plate-reading stage: takes a plate crop image and produces the plate
text, a confidence score and a readability status. Owned by R2 (khushi),
merged via PR #5.

## Pipeline

```
plate crop (BGR image)
   │
   ▼ preprocess.py     2× cubic resize → grayscale → CLAHE → Gaussian blur
   ▼ ocr_engine.py     pytesseract (--psm 7), output stripped to A–Z0–9
   ▼ plate_cleaner.py  uppercase + non-alphanumeric removal
   ▼ confidence_handler.py  heuristic score (see below) + readability status
   ▼
{"plate_text": str, "confidence": 0–100, "status": readable|low_confidence|unreadable}
```

## Output contract

| Field | Meaning |
|---|---|
| `plate_text` | cleaned alphanumeric plate text (may be empty) |
| `confidence` | **heuristic 0–100 score** (not an OCR probability): 50 base + bonuses for alphanumeric-only, length 6–12, mixed letters+digits |
| `status` | `readable` (≥80) · `low_confidence` (≥50) · `unreadable` (<50) |

## Integration with R3 (backend)

The backend API is strictly [0,1] — R2's 0–100 heuristic is converted by the
R3 adapter, never at the API boundary:

```python
from app.integration import from_r2_result   # backend/app/integration/r1r2.py

plate_fields = from_r2_result(r2_anpr.process_plate(plate_crop))
# {"plate_number": ..., "plate_confidence": <0–1>, "ocr_engine": "r2_anpr"}
```

Combine with R1's tracking output via `from_r1_r2(r1_dict, r2_dict)`
(association key: **camera_id + track_id**). Full mapping table:
`docs/integration.md`.

## Known issues (flagged 2026-09-12, R2's owner to fix)

- `anpr_pipeline.py` imports `clean_plate` from `plate_cleaner`, but the
  module defines `clean_plate_text` — `process_plate` crashes on import.
- `ocr_engine.extract_plate_text` returns a `confidence` key only on the
  invalid-image path; the success path omits it.
- The OCR engine strips to alphanumerics internally, so no raw OCR trail
  survives this module — R3 preserves whatever `plate_text` arrives as the
  raw trail in `plate_reads.plate_number_raw`.

The interactive demo of the full two-stage engine (YOLO vehicle detect →
YOLO plate detect → Fast-Plate-OCR / GPT-4o-mini fallback) lives in the root
`app.py` (Streamlit, deployed on Hugging Face Spaces).
