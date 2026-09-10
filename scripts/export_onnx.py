from ultralytics import YOLO

import os
local_model = os.path.join("runs", "detect", "NEXUS_Local", "RTX4060_Uniform_v1", "weights", "best.pt")
model_path = local_model if os.path.exists(local_model) else (r"models/best.pt" if os.path.exists("models/best.pt") else r"E:\deepsight\runs\detect\KnightSight_Local\RTX4060_Uniform_v1\weights\best.pt")
model = YOLO(model_path)

# 2. Export to ONNX format
# ONNX is highly optimized for CPU inference (Colab / Edge devices)
print("Exporting model to ONNX...")
model.export(format="onnx", imgsz=480, simplify=True)

print("Export Complete! Check the weights folder for 'best.onnx'")
