# backend/segmentation_robust.py
import os
import numpy as np
import torch
import torch.nn.functional as F
import cv2
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import orient
from ultralytics import YOLO


# --- CLEAN POLYGON ---
def clean_polygon(points):
    try:
        if len(points) < 4:
            return None
        poly = Polygon(points)
        if not poly.is_valid or poly.area < 250:
            return None
        poly = orient(poly, sign=1.0)
        coords = list(poly.exterior.coords)
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        return np.array(coords, dtype=np.float32)
    except Exception as e:
        print(f"Polygon cleaning failed: {e}")
        return None


# --- IMPORTS ---
from model import get_model

# --- CONFIG ---
BASE_DIR = Path(__file__).parent
CHECKPOINT = BASE_DIR / "model" / "model_best_val_loss_var.pkl"
YOLO_WEIGHTS = BASE_DIR / "best.pt"
MODEL_NAME = "hg_furukawa_original"
N_CLASSES = 44
SPLIT = [21, 12, 11]
WALL_CLASS_INDEX_START = 21
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- LOAD MODELS ---
try:
    model = get_model(MODEL_NAME, 51)
    model.conv4_ = torch.nn.Conv2d(256, N_CLASSES, bias=True, kernel_size=1)
    model.upsample = torch.nn.ConvTranspose2d(
        N_CLASSES, N_CLASSES, kernel_size=4, stride=4
    )

    if not CHECKPOINT.exists():
        raise FileNotFoundError(f"Furukawa checkpoint not found: {CHECKPOINT}")
    checkpoint = torch.load(CHECKPOINT, map_location=DEVICE)
    model.load_state_dict(checkpoint["model_state"])
    model.to(DEVICE)
    model.eval()
    print(f"✓ Furukawa model loaded on {DEVICE}")
except Exception as e:
    raise RuntimeError(f"Failed to load Furukawa model: {e}")

try:
    if not YOLO_WEIGHTS.exists():
        raise FileNotFoundError(f"YOLO weights not found: {YOLO_WEIGHTS}")
    yolo = YOLO(str(YOLO_WEIGHTS))
    yolo.to(DEVICE)
    print(f"✓ YOLO model loaded")
except Exception as e:
    raise RuntimeError(f"Failed to load YOLO model: {e}")


def map_yolo_to_furukawa(yolo_name: str) -> int:
    name = yolo_name.lower()
    if "door" in name:
        return 22
    if "window" in name:
        return 23
    if "wall" in name:
        return 2
    return -1


def safe_split_prediction(prediction, target_size, split):
    """Safely split prediction tensor into components"""
    try:
        h, w = target_size
        c = prediction.shape[0]

        print(f"  Prediction shape: {prediction.shape}, target: {target_size}")

        # Ensure prediction matches target size
        if prediction.shape[1:] != (h, w):
            print(f"  Resizing prediction from {prediction.shape[1:]} to {(h, w)}")
            prediction = prediction.unsqueeze(0)  # Add batch dim
            prediction = F.interpolate(
                prediction, size=(h, w), mode="bilinear", align_corners=True
            )
            prediction = prediction.squeeze(0)  # Remove batch dim

        # Split channels
        heatmaps = prediction[: split[0]]  # First 21 channels
        rooms = prediction[split[0] : split[0] + split[1]]  # Next 12 channels
        icons = prediction[split[0] + split[1] :]  # Remaining 11 channels

        print(
            f"  Split: heatmaps={heatmaps.shape}, rooms={rooms.shape}, icons={icons.shape}"
        )

        return heatmaps, rooms, icons
    except Exception as e:
        print(f"  Split prediction error: {e}")
        raise


def extract_walls_from_heatmaps(heatmaps, threshold=0.5):
    """Extract wall polygons directly from heatmaps"""
    try:
        # Take wall-related channels (typically first few channels)
        # Adjust indices based on your model's channel layout
        wall_channels = heatmaps[:3]  # Adjust this based on your model

        # Combine into single mask
        wall_mask = (wall_channels.max(dim=0)[0] > threshold).numpy().astype(
            np.uint8
        ) * 255

        # Morphological operations to clean up
        kernel = np.ones((3, 3), np.uint8)
        wall_mask = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel)
        wall_mask = cv2.morphologyEx(wall_mask, cv2.MORPH_OPEN, kernel)

        # Find contours
        contours, _ = cv2.findContours(
            wall_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        polygons = []
        for cnt in contours:
            if len(cnt) >= 4:
                poly = cnt.squeeze()
                if poly.ndim == 1:
                    poly = poly.reshape(-1, 2)
                poly = poly.tolist()
                if poly[0] != poly[-1]:
                    poly.append(poly[0])
                cleaned = clean_polygon(poly)
                if cleaned is not None:
                    polygons.append(cleaned)

        return polygons
    except Exception as e:
        print(f"  Wall extraction error: {e}")
        return []


def extract_walls_from_rooms(rooms, threshold=0.5):
    """Extract wall polygons from room segmentation"""
    try:
        # Sum across all room channels to get overall structure
        wall_mask = (rooms.sum(0) > threshold).numpy().astype(np.uint8) * 255

        # Clean up mask
        kernel = np.ones((5, 5), np.uint8)
        wall_mask = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel)

        # Find contours
        contours, _ = cv2.findContours(
            wall_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        polygons = []
        for cnt in contours:
            if len(cnt) >= 4:
                # Simplify contour
                epsilon = 0.005 * cv2.arcLength(cnt, True)
                approx = cv2.approxPolyDP(cnt, epsilon, True)

                poly = approx.squeeze()
                if poly.ndim == 1:
                    poly = poly.reshape(-1, 2)
                poly = poly.tolist()
                if poly[0] != poly[-1]:
                    poly.append(poly[0])
                cleaned = clean_polygon(poly)
                if cleaned is not None:
                    polygons.append(cleaned)

        return polygons
    except Exception as e:
        print(f"  Room extraction error: {e}")
        return []


def segment_image(img_path):
    print(f"\n=== Processing: {img_path} ===")

    img_path = str(img_path)
    if not os.path.exists(img_path):
        raise FileNotFoundError(f"Image not found: {img_path}")

    img = cv2.imread(img_path)
    if img is None:
        raise ValueError(f"Failed to load image: {img_path}")

    h, w = img.shape[:2]
    print(f"Original image size: {w}x{h}")

    if h == 0 or w == 0:
        raise ValueError("Image has zero dimension")

    # Prepare input
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_input = 2 * (img_rgb.astype(np.float32) / 255.0) - 1
    img_input = np.moveaxis(img_input, -1, 0)
    img_tensor = torch.from_numpy(img_input).unsqueeze(0).float().to(DEVICE)

    print(f"Input tensor shape: {img_tensor.shape}")

    # --- YOLO DETECTION ---
    print("Running YOLO detection...")
    try:
        yolo_res = yolo(img_rgb, verbose=False)[0]
        boxes = yolo_res.boxes.xyxy.cpu().numpy() if yolo_res.boxes is not None else []
        cls_ids = yolo_res.boxes.cls.cpu().numpy().astype(int) if yolo_res.boxes else []
        confs = yolo_res.boxes.conf.cpu().numpy() if yolo_res.boxes else []
        print(f"  Found {len(boxes)} objects")
    except Exception as e:
        print(f"  YOLO failed: {e}")
        boxes, cls_ids, confs = [], [], []

    # --- FURUKAWA PREDICTION ---
    print("Running Furukawa model...")

    # Calculate target size (even dimensions)
    target_h = h - (h % 2)
    target_w = w - (w % 2)
    print(f"Target output size: {target_w}x{target_h}")

    with torch.no_grad():
        pred = model(img_tensor)
        print(f"  Raw model output: {pred.shape}")

        # Ensure batch dimension
        if pred.dim() == 3:
            pred = pred.unsqueeze(0)
            print(f"  Added batch dim: {pred.shape}")

        # Interpolate to target size
        print(f"  Interpolating to ({target_h}, {target_w})...")
        pred = F.interpolate(
            pred, size=(target_h, target_w), mode="bilinear", align_corners=True
        )
        print(f"  After interpolation: {pred.shape}")

        prediction = pred[0].cpu()  # Remove batch dim
        print(f"  Final prediction: {prediction.shape}")

    # --- SPLIT PREDICTION ---
    print("Splitting prediction...")
    try:
        heatmaps, rooms, icons = safe_split_prediction(
            prediction, (target_h, target_w), SPLIT
        )
    except Exception as e:
        raise RuntimeError(f"Splitting failed: {e}")

    # --- EXTRACT POLYGONS (multiple strategies) ---
    print("Extracting wall polygons...")

    # Strategy 1: From rooms
    polygons = extract_walls_from_rooms(rooms, threshold=0.4)
    print(f"  Found {len(polygons)} polygons from rooms")

    # Strategy 2: From heatmaps (if strategy 1 failed)
    if len(polygons) == 0:
        print("  Trying heatmap extraction...")
        polygons = extract_walls_from_heatmaps(heatmaps, threshold=0.3)
        print(f"  Found {len(polygons)} polygons from heatmaps")

    # --- YOLO BOOST ---
    if len(boxes) > 0:
        print("Applying YOLO boost...")
        refined_rooms = rooms.clone()

        for box, cls_id, conf in zip(boxes, cls_ids, confs):
            if conf < 0.5:
                continue
            yolo_name = yolo.names.get(cls_id, "")
            furukawa_idx = map_yolo_to_furukawa(yolo_name)
            if furukawa_idx == -1:
                continue

            x1, y1, x2, y2 = map(int, box)
            x1 = max(0, int(x1 * target_w // w))
            y1 = max(0, int(y1 * target_h // h))
            x2 = min(target_w, int(x2 * target_w // w))
            y2 = min(target_h, int(y2 * target_h // h))

            if x2 <= x1 or y2 <= y1:
                continue

            if furukawa_idx < WALL_CLASS_INDEX_START:
                channel = furukawa_idx
            else:
                channel = furukawa_idx - WALL_CLASS_INDEX_START

            if channel >= refined_rooms.shape[0]:
                continue

            region = refined_rooms[channel, y1:y2, x1:x2]
            region = torch.clamp(region + conf * 0.5, 0, 1)
            refined_rooms[channel, y1:y2, x1:x2] = region

        # Re-extract with boosted predictions
        boosted_polygons = extract_walls_from_rooms(refined_rooms, threshold=0.4)
        if len(boosted_polygons) > len(polygons):
            print(
                f"  YOLO boost improved: {len(polygons)} -> {len(boosted_polygons)} polygons"
            )
            polygons = boosted_polygons

    print(f"✓ Extracted {len(polygons)} wall polygons\n")
    return polygons
