"""One-off utility: generate additional demo clips for the video-upload feature.

Builds slideshow clips from the same dataset image pool that generated
data/test_video.mp4 (scripts/run_r1_tracking.generate_demo_video's source
chain), using image groups the original clip did NOT use, so every upload
yields fresh (non-idempotent) detections.

Usage: python scripts/generate_upload_clips.py
"""
import cv2

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CLIP_FRAMES = 60
CLIP_FPS = 15  # same as data/test_video.mp4


def source_images() -> list[Path]:
    for d in (
        PROJECT_ROOT / "data" / "indian_road_yolo" / "images" / "val",
        PROJECT_ROOT / "data" / "indian_road_subset" / "images",
        PROJECT_ROOT / "runs" / "detect" / "NEXUS_Local" / "RTX4060_Uniform_v1",
    ):
        if d.exists():
            imgs = sorted(d.glob("*.jpg"))
            if imgs:
                return imgs
    raise SystemExit("no dataset images found — expected one of the known pools")


def build(images: list[Path], out_path: Path) -> None:
    first = cv2.imread(str(images[0]))
    if first is None:
        raise SystemExit(f"cannot read {images[0]}")
    h, w = first.shape[:2]
    frames_per_img = max(1, CLIP_FRAMES // len(images))
    writer = cv2.VideoWriter(str(out_path), cv2.VideoWriter_fourcc(*"mp4v"), CLIP_FPS, (w, h))
    written = 0
    for img_path in images:
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        img = cv2.resize(img, (w, h))
        for _ in range(frames_per_img):
            writer.write(img)
            written += 1
    writer.release()
    print(f"  {out_path.name}: {written} frames @ {CLIP_FPS} fps, {w}x{h}, "
          f"from {len(images)} images ({images[0].name}..{images[-1].name})")


if __name__ == "__main__":
    imgs = source_images()
    print(f"source pool: {len(imgs)} images from {imgs[0].parent}")
    # data/test_video.mp4 was built from the FIRST 4 images
    # (generate_demo_video) — every clip below uses only the others so its
    # detections get fresh ingest_ids.
    groups = {
        "clip_b.mp4": imgs[4:8],
        "clip_c.mp4": imgs[8:12],
        "clip_d.mp4": imgs[4:13],   # longer mixed cut of all remaining
        "clip_e.mp4": imgs[6:13],
    }
    out_dir = PROJECT_ROOT / "data"
    for name, group in groups.items():
        if len(group) >= 2:
            build(group, out_dir / name)
    print("done.")
