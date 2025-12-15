# backend/segmentation_improved.py
import os
import numpy as np
import torch
import torch.nn.functional as F
import cv2
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import orient, unary_union
from ultralytics import YOLO


def clean_polygon(points, min_area=100):
    """More lenient polygon cleaning"""
    try:
        if len(points) < 3:
            return None
        poly = Polygon(points)
        if not poly.is_valid:
            poly = poly.buffer(0)  # Fix invalid polygons
        if poly.area < min_area:
            return None
        poly = orient(poly, sign=1.0)
        coords = list(poly.exterior.coords)
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        return np.array(coords, dtype=np.float32)
    except Exception as e:
        print(f"  Polygon cleaning failed: {e}")
        return None


# --- IMPORTS ---
from model import get_model
from utils.loaders import RotateNTurns
from utils.post_prosessing import split_prediction, get_polygons

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
    rot = RotateNTurns()
    model = get_model(MODEL_NAME, 51)
    model.conv4_ = torch.nn.Conv2d(256, N_CLASSES, bias=True, kernel_size=1)
    model.upsample = torch.nn.ConvTranspose2d(
        N_CLASSES, N_CLASSES, kernel_size=4, stride=4
    )

    if not CHECKPOINT.exists():
        raise FileNotFoundError(f"Checkpoint not found: {CHECKPOINT}")
    checkpoint = torch.load(CHECKPOINT, map_location=DEVICE)
    model.load_state_dict(checkpoint["model_state"])
    model.to(DEVICE)
    model.eval()
    print(f"✓ Furukawa model loaded on {DEVICE}")
except Exception as e:
    raise RuntimeError(f"Failed to load Furukawa model: {e}")

try:
    if YOLO_WEIGHTS.exists():
        yolo = YOLO(str(YOLO_WEIGHTS))
        yolo.to(DEVICE)
        print(f"✓ YOLO model loaded")
    else:
        yolo = None
        print(f"⚠ YOLO weights not found, skipping YOLO boost")
except Exception as e:
    print(f"⚠ YOLO loading failed: {e}")
    yolo = None


def map_yolo_to_furukawa(yolo_name: str) -> int:
    name = yolo_name.lower()
    if "door" in name:
        return 22
    if "window" in name:
        return 23
    if "wall" in name:
        return 2
    return -1


def enhance_wall_mask(mask, kernel_size=5):
    """Apply morphological operations to improve wall detection"""
    kernel = np.ones((kernel_size, kernel_size), np.uint8)

    # Close small gaps in walls
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Remove small noise
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    # Dilate slightly to ensure wall continuity
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)

    return mask


def extract_polygons_advanced(mask, min_area=100, epsilon_factor=0.003):
    """Advanced polygon extraction with better approximation"""
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    polygons = []
    for i, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        # Approximate polygon
        epsilon = epsilon_factor * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        if len(approx) >= 3:
            poly = approx.squeeze()
            if poly.ndim == 1:
                poly = poly.reshape(-1, 2)
            poly = poly.tolist()
            if poly[0] != poly[-1]:
                poly.append(poly[0])

            cleaned = clean_polygon(poly, min_area=min_area)
            if cleaned is not None:
                polygons.append(cleaned)

    return polygons


def segment_image(
    img_path,
    wall_threshold=0.15,  # Much lower threshold for walls
    yolo_conf=0.25,  # Lower YOLO confidence
    use_yolo=True,
    min_wall_area=100,
):
    """
    Enhanced segmentation with configurable parameters

    Args:
        img_path: Path to image
        wall_threshold: Threshold for wall detection (0.1-0.3 recommended)
        yolo_conf: YOLO confidence threshold (0.2-0.5 recommended)
        use_yolo: Whether to use YOLO boost
        min_wall_area: Minimum area for wall polygons
    """
    print(f"\n{'='*60}")
    print(f"Processing: {img_path}")
    print(f"Parameters: wall_thresh={wall_threshold}, yolo_conf={yolo_conf}")
    print(f"{'='*60}")

    img_path = str(img_path)
    if not os.path.exists(img_path):
        raise FileNotFoundError(f"Image not found: {img_path}")

    img = cv2.imread(img_path)
    if img is None:
        raise ValueError(f"Failed to load image: {img_path}")

    h, w = img.shape[:2]
    print(f"Image size: {w}x{h}")

    # Prepare input
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_input = 2 * (img_rgb.astype(np.float32) / 255.0) - 1
    img_input = np.moveaxis(img_input, -1, 0)
    img_tensor = torch.from_numpy(img_input).unsqueeze(0).float().to(DEVICE)

    # --- YOLO DETECTION ---
    yolo_detections = []
    if use_yolo and yolo is not None:
        print("Running YOLO detection...")
        try:
            yolo_res = yolo(img_rgb, conf=yolo_conf, verbose=False)[0]
            if yolo_res.boxes is not None:
                boxes = yolo_res.boxes.xyxy.cpu().numpy()
                cls_ids = yolo_res.boxes.cls.cpu().numpy().astype(int)
                confs = yolo_res.boxes.conf.cpu().numpy()
                yolo_detections = list(zip(boxes, cls_ids, confs))
                print(f"  Found {len(yolo_detections)} objects")
        except Exception as e:
            print(f"  YOLO failed: {e}")

    # --- FURUKAWA PREDICTION (Original working code) ---
    print("Running Furukawa model...")

    size_check = np.array([img_tensor.shape[2], img_tensor.shape[3]]) % 2
    height = int(img_tensor.shape[2] - size_check[0])
    width = int(img_tensor.shape[3] - size_check[1])

    rotations = [(0, 0), (1, -1), (2, 2), (-1, 1)]
    pred_stack = torch.zeros([len(rotations), N_CLASSES, height, width], device=DEVICE)

    with torch.no_grad():
        for i, r in enumerate(rotations):
            forward, back = r
            rot_img = rot(img_tensor, "tensor", forward)
            pred = model(rot_img)
            pred = rot(pred, "tensor", back)
            pred = rot(pred, "points", back)
            pred = F.interpolate(
                pred, size=(height, width), mode="bilinear", align_corners=True
            )
            pred_stack[i] = pred[0]

        prediction = torch.mean(pred_stack, dim=0, keepdim=True).cpu()

    # --- SPLIT & GET POLYGONS (Original method) ---
    print("Extracting polygons...")
    try:
        heatmaps, rooms, icons = split_prediction(prediction, (height, width), SPLIT)
        polygons, types, room_polygons, room_types = get_polygons(
            (heatmaps, rooms, icons), wall_threshold, [1, 2]
        )

        # Extract wall polygons
        wall_polygon_indices = [
            i for i, t in enumerate(types) if t.get("type") == "wall"
        ]
        print(f"  Found {len(wall_polygon_indices)} wall polygons from Furukawa")

        initial_boxes = []
        for i in wall_polygon_indices:
            poly = polygons[i]
            pts = [[float(pt[0]), float(pt[1])] for pt in poly]
            if len(pts) >= 3:
                cleaned = clean_polygon(pts, min_area=min_wall_area)
                if cleaned is not None:
                    initial_boxes.append(cleaned)

    except Exception as e:
        print(f"  Original extraction failed: {e}, trying backup method...")
        initial_boxes = []

    # --- BACKUP: Direct wall extraction from rooms tensor ---
    if len(initial_boxes) < 5:  # If too few walls detected
        print("  Using backup extraction method...")

        # Combine all room channels to get building structure
        combined_mask = rooms.sum(0).numpy()
        combined_mask = (combined_mask > wall_threshold).astype(np.uint8) * 255

        # Enhance mask
        combined_mask = enhance_wall_mask(combined_mask, kernel_size=7)

        # Extract polygons
        backup_boxes = extract_polygons_advanced(
            combined_mask, min_area=min_wall_area, epsilon_factor=0.005
        )

        print(f"  Backup method found {len(backup_boxes)} polygons")

        # Merge with initial results
        all_boxes = initial_boxes + backup_boxes

        # Remove duplicates using shapely
        unique_boxes = []
        for box in all_boxes:
            is_duplicate = False
            poly1 = Polygon(box)
            for existing in unique_boxes:
                poly2 = Polygon(existing)
                if poly1.intersection(poly2).area / poly1.area > 0.7:
                    is_duplicate = True
                    break
            if not is_duplicate:
                unique_boxes.append(box)

        initial_boxes = unique_boxes

    # --- YOLO BOOST ---
    if len(yolo_detections) > 0 and use_yolo:
        print(f"Applying YOLO boost with {len(yolo_detections)} detections...")

        refined_rooms = rooms.clone()
        boost_count = 0

        for box, cls_id, conf in yolo_detections:
            yolo_name = yolo.names.get(cls_id, "")
            furukawa_idx = map_yolo_to_furukawa(yolo_name)
            if furukawa_idx == -1:
                continue

            x1, y1, x2, y2 = map(int, box)
            x1 = max(0, int(x1 * width // w))
            y1 = max(0, int(y1 * height // h))
            x2 = min(width, int(x2 * width // w))
            y2 = min(height, int(y2 * height // h))

            if x2 <= x1 or y2 <= y1:
                continue

            if furukawa_idx < WALL_CLASS_INDEX_START:
                channel = furukawa_idx
            else:
                channel = furukawa_idx - WALL_CLASS_INDEX_START

            if channel >= refined_rooms.shape[0]:
                continue

            region = refined_rooms[channel, y1:y2, x1:x2]
            boost_strength = conf * 0.6  # Stronger boost
            region = torch.clamp(region + boost_strength, 0, 1)
            refined_rooms[channel, y1:y2, x1:x2] = region
            boost_count += 1

        print(f"  Applied {boost_count} YOLO boosts")

        # Re-extract with boosted predictions
        boosted_mask = (refined_rooms.sum(0) > wall_threshold * 0.8).numpy().astype(
            np.uint8
        ) * 255
        boosted_mask = enhance_wall_mask(boosted_mask)

        boosted_boxes = extract_polygons_advanced(
            boosted_mask, min_area=min_wall_area, epsilon_factor=0.005
        )

        if len(boosted_boxes) > len(initial_boxes):
            print(
                f"  YOLO improved: {len(initial_boxes)} -> {len(boosted_boxes)} walls"
            )
            initial_boxes = boosted_boxes

    print(f"✓ Final result: {len(initial_boxes)} wall polygons\n")
    return initial_boxes
