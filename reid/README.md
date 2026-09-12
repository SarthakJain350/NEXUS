# NEXUS R5 — Vehicle Re-ID

R5 provides lightweight appearance-based vehicle re-identification.

## Components

- `feature_extractor.py` — HSV/RGB/texture appearance embedding.
- `similarity.py` — cosine similarity/distance.
- `vehicle_reid.py` — online gallery and global vehicle ID assignment.

## Input

A vehicle crop as an OpenCV BGR NumPy array plus:

- `camera_id`
- ISO timestamp

## Output

`ReIDMatch`:

- `global_id`
- `similarity`
- `matched`
- previous camera/timestamp when a match is found.

## Important limitation

This is a strong integration baseline, not a claim of production-grade learned
vehicle Re-ID. For the SIH prototype, the API is deliberately isolated so R5 can
later replace the feature extractor with a trained Re-ID network without changing
the analytics or integration contract.

## Integration with R3

Vehicle crops for `match()` come from the R1/R2 pipeline; the resulting
`global_id` assignments are written back through the R3 fusion point
(`PATCH /api/v1/observations/{id}/vehicle`, provisional R6 contract — see
`docs/api_contract.md`). Offline demo: `python scripts/run_r5_demo.py`.
