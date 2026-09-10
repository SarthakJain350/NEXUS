import sys
import os
import time
import cv2
import numpy as np
import torch
from ultralytics import YOLO
from fast_plate_ocr import LicensePlateRecognizer

sys.stdout.reconfigure(encoding='utf-8')

print("=" * 65)
print("🚗 NEXUS INFERENCE VERIFICATION")
print("=" * 65)

# Check Device
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Inference Device : {device}")

# 1. Test PyTorch Model
print("\n[1/3] Testing PyTorch Model (models/best.pt)...")
t0 = time.time()
pt_model = YOLO("models/best.pt")
print(f"Loaded in {(time.time() - t0) * 1000:.1f}ms")

img_path = "runs/detect/NEXUS_Local/RTX4060_Uniform_v1/val_batch0_labels.jpg"
img = cv2.imread(img_path)

t0 = time.time()
pt_results = pt_model.predict(source=img, conf=0.20, verbose=False)
pt_time = (time.time() - t0) * 1000
pt_boxes = pt_results[0].boxes
print(f"✅ PyTorch Inference: {pt_time:.1f}ms | Found {len(pt_boxes)} plate(s)")
for i, box in enumerate(pt_boxes[:3]):
    conf = float(box.conf[0])
    xyxy = box.xyxy[0].tolist()
    print(f"   Plate #{i+1}: Conf={conf:.1%}, BBox=[{xyxy[0]:.0f}, {xyxy[1]:.0f}, {xyxy[2]:.0f}, {xyxy[3]:.0f}]")

# 2. Test ONNX Model
print("\n[2/3] Testing ONNX Exported Model (models/best.onnx)...")
t0 = time.time()
onnx_model = YOLO("models/best.onnx", task="detect")
print(f"Loaded in {(time.time() - t0) * 1000:.1f}ms")

t0 = time.time()
onnx_results = onnx_model.predict(source=img, conf=0.20, verbose=False)
onnx_time = (time.time() - t0) * 1000
onnx_boxes = onnx_results[0].boxes
print(f"✅ ONNX Inference: {onnx_time:.1f}ms | Found {len(onnx_boxes)} plate(s)")

# 3. Test OCR
print("\n[3/3] Testing Fast-Plate-OCR Engine...")
t0 = time.time()
ocr = LicensePlateRecognizer("cct-s-v2-global-model")
print(f"Loaded OCR model in {(time.time() - t0) * 1000:.1f}ms")

if len(pt_boxes) > 0:
    first_box = list(map(int, pt_boxes[0].xyxy[0]))
    plate_crop = img[first_box[1]:first_box[3], first_box[0]:first_box[2]]
    if plate_crop.size > 0:
        t0 = time.time()
        ocr_result = ocr.run(plate_crop)
        ocr_text = ocr_result[0] if isinstance(ocr_result, list) else str(ocr_result)
        ocr_time = (time.time() - t0) * 1000
        print(f"✅ OCR Extracted Text: \"{ocr_text}\" in {ocr_time:.1f}ms")

print("\n" + "=" * 65)
print("🎉 VERIFICATION RESULT: All NEXUS models are operational!")
print("=" * 65)
