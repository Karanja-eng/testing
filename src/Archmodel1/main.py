# backend/main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import pandas as pd
import base64

app = FastAPI()

# Allow CORS so React can call FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change "*" to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLO model once
model = YOLO("best.pt")


@app.post("/detect")
async def detect_objects(
    file: UploadFile = File(...), confidence: float = 0.5, labels: list[str] = None
):
    # Read image
    img_bytes = await file.read()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    # Predict
    results = model.predict(img, conf=confidence)
    detections = results[0]

    # Filter labels if provided
    filtered_boxes = []
    if labels:
        filtered_boxes = [
            box for box in detections.boxes if model.names[int(box.cls)] in labels
        ]
    else:
        filtered_boxes = detections.boxes

    # Count objects
    counts = {}
    for box in filtered_boxes:
        label = model.names[int(box.cls)]
        counts[label] = counts.get(label, 0) + 1

    # Get plotted image
    img_plot = detections.plot()
    img_bytes = Image.fromarray(img_plot[..., ::-1])  # BGR -> RGB
    buf = io.BytesIO()
    img_bytes.save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    # Return JSON
    return {"counts": counts, "image": img_b64}
