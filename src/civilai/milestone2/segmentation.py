# backend/segmentation_final.py
import os
import numpy as np
import torch
import torch.nn.functional as F
import cv2
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import orient, unary_union
from ultralytics import YOLO


def clean_polygon(points, min_area=50):
    """Polygon cleaning with area filter"""
    try:
        if len(points) < 3:
            return None
        poly = Polygon(points)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.area < min_area:
            return None
        poly = orient(poly, sign=1.0)
        coords = list(poly.exterior.coords)
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        return np.array(coords, dtype=np.float32)
    except:
        return None


# --- IMPORTS ---
from model import get_model
from utils.loaders import RotateNTurns

# --- CONFIG ---
BASE_DIR = Path(__file__).parent
CHECKPOINT = BASE_DIR / "model" / "model_best_val_loss_var.pkl"
YOLO_WEIGHTS = BASE_DIR / "best.pt"
MODEL_NAME = "hg_furukawa_original"
N_CLASSES = 44
SPLIT = [21, 12, 11]
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- LOAD MODELS ---
try:
    rot = RotateNTurns()
    model = get_model(MODEL_NAME, 51)
    model.conv4_ = torch.nn.Conv2d(256, N_CLASSES, bias=True, kernel_size=1)
    model.upsample = torch.nn.ConvTranspose2d(
        N_CLASSES, N_CLASSES, kernel_size=4, stride=4
    )

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
except Exception as e:
    yolo = None


def _normalize_mask(mask):
    # return uint8 0/255 mask in numpy
    if isinstance(mask, torch.Tensor):
        mask = mask.detach().cpu().numpy()
    mask = mask.copy()
    if mask.dtype == np.bool_:
        return mask.astype(np.uint8) * 255
    if mask.max() <= 1.0:
        return (mask * 255).astype(np.uint8)
    return mask.astype(np.uint8)


def extract_polygons_from_mask(mask, min_area=50, max_polygons=30):
    """Robust polygon extraction. Returns list of Nx2 float32 numpy arrays (closed)."""
    try:
        mask_uint8 = _normalize_mask(mask)
    except Exception as e:
        print(f"extract_polygons_from_mask: normalize failed: {e}")
        return []

    # Optional: morphological close then small open to connect thin walls
    kernel = np.ones((3, 3), np.uint8)
    mask_uint8 = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask_uint8 = cv2.morphologyEx(mask_uint8, cv2.MORPH_OPEN, kernel, iterations=1)

    # find contours
    contours, _ = cv2.findContours(
        mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return []

    # sort and filter
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    polygons = []
    for cnt in contours[:max_polygons]:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        perim = cv2.arcLength(cnt, True)
        eps = max(1.0, 0.01 * perim)  # clamp to at least 1 pixel
        approx = cv2.approxPolyDP(cnt, eps, True)

        if approx is None or len(approx) < 3:
            continue

        poly = approx.squeeze()
        if poly.ndim == 1:
            poly = poly.reshape(-1, 2)
        poly = poly.tolist()
        if poly[0] != poly[-1]:
            poly.append(poly[0])

        cleaned = clean_polygon(poly, min_area=min_area)
        if cleaned is not None:
            # simplify a bit to reduce jaggedness (shapely)
            try:
                shp = Polygon(cleaned)
                shp = shp.buffer(0)  # fix geometry
                shp = shp.simplify(1.0, preserve_topology=True)
                coords = np.array(shp.exterior.coords, dtype=np.float32)
                polygons.append(coords)
            except Exception:
                polygons.append(cleaned)

    return polygons


def merge_nearby_polygons(polygons, distance_threshold=8, smooth_buffer=2.0):
    """Merge touching/overlapping polygons, then smooth with buffer/simplify."""
    if not polygons:
        return []

    try:
        shapely_polys = [
            Polygon(p) for p in polygons if Polygon(p).is_valid and Polygon(p).area > 0
        ]
        if not shapely_polys:
            return []

        # fast union of everything that intersects/buffers slightly
        merged_groups = []
        used = [False] * len(shapely_polys)
        for i, p in enumerate(shapely_polys):
            if used[i]:
                continue
            group = p
            used[i] = True
            for j in range(i + 1, len(shapely_polys)):
                if used[j]:
                    continue
                pj = shapely_polys[j]
                if group.intersects(pj) or group.buffer(distance_threshold).intersects(
                    pj
                ):
                    group = unary_union([group, pj])
                    used[j] = True
            merged_groups.append(group)

        # smooth and simplify each merged group
        merged_out = []
        for g in merged_groups:
            if not g.is_valid or g.area < 1.0:
                continue
            # buffer to close small holes/spikes, then inverse buffer
            g = g.buffer(smooth_buffer).buffer(-smooth_buffer)
            # final simplify to remove jagged edges
            g = g.simplify(max(1.0, smooth_buffer), preserve_topology=True)
            if g.is_empty:
                continue
            # if MultiPolygon, split
            if g.geom_type == "MultiPolygon":
                for part in g:
                    if part.area > 50:
                        merged_out.append(
                            np.array(list(part.exterior.coords), dtype=np.float32)
                        )
            else:
                merged_out.append(np.array(list(g.exterior.coords), dtype=np.float32))

        return merged_out
    except Exception as e:
        print(f"merge_nearby_polygons error: {e}")
        return polygons


def segment_image(
    img_path,
    wall_threshold=0.2,
    room_threshold=0.3,
    yolo_conf=0.3,
    use_yolo=True,
    min_wall_area=200,
    max_walls=25,
    extract_rooms=False,
    debug_vis=False,
):
    """
    Balanced segmentation with proper polygon limits
    """
    print(f"\n{'='*70}")
    print(f"Processing: {img_path}")
    print(
        f"Params: wall_th={wall_threshold}, room_th={room_threshold}, yolo_conf={yolo_conf}"
    )
    print(f"Max walls: {max_walls}, Extract rooms: {extract_rooms}")
    print(f"{'='*70}")

    img = cv2.imread(str(img_path))
    if img is None:
        raise ValueError(f"Failed to load: {img_path}")

    h, w = img.shape[:2]
    print(f"Image size: {w}x{h}")

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_input = 2 * (img_rgb.astype(np.float32) / 255.0) - 1
    img_input = np.moveaxis(img_input, -1, 0)
    img_tensor = torch.from_numpy(img_input).unsqueeze(0).float().to(DEVICE)

    # --- FURUKAWA PREDICTION ---
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

    prediction = prediction.squeeze(0)
    heatmaps = prediction[: SPLIT[0]]
    rooms = prediction[SPLIT[0] : SPLIT[0] + SPLIT[1]]
    icons = prediction[SPLIT[0] + SPLIT[1] :]

    print(f"  Model output - Heatmaps: {heatmaps.shape}, Rooms: {rooms.shape}")
    # --- EXTRACT WALLS (robust + smooth) ---
    print("\nExtracting walls...")

    # Upsample heatmap to original image resolution (h,w)
    # heatmaps shape: (C, Hm, Wm) -> we want one combined heatmap at (h,w)
    comb = heatmaps[:10].mean(dim=0, keepdim=True).unsqueeze(0)  # shape (1,1,Hm,Wm)
    comb_up = F.interpolate(
        comb, size=(h, w), mode="bicubic", align_corners=False
    ).squeeze()  # now (h,w)
    combined_heatmap = comb_up.detach().cpu().numpy().astype(np.float32)

    # Smooth a bit (Gaussian) to connect thin lines but preserve continuity
    combined_heatmap = cv2.GaussianBlur(combined_heatmap, (5, 5), 0)

    # Adaptive threshold: use a percentile but clamp to reasonable range
    p90 = np.percentile(combined_heatmap, 90)
    effective_th = min(
        max(wall_threshold, 0.02), p90 * 0.6
    )  # tune this scalar as needed
    wall_mask_np = (combined_heatmap > effective_th).astype(np.uint8) * 255

    # gentle morphological close to connect thin fragments; then small open to remove dots
    kernel = np.ones((3, 3), np.uint8)
    wall_mask_np = cv2.morphologyEx(wall_mask_np, cv2.MORPH_CLOSE, kernel, iterations=2)
    wall_mask_np = cv2.morphologyEx(wall_mask_np, cv2.MORPH_OPEN, kernel, iterations=1)

    # Convert to torch for possible YOLO boost, but keep primary mask as numpy for polygonization
    wall_mask = torch.from_numpy(wall_mask_np.astype(np.float32) / 255.0)

    print(
        f"  Wall mask coverage: {wall_mask.sum().item() / wall_mask.numel() * 100:.1f}%"
    )

    # Optionally do YOLO boosting now (augment wall_mask_np), see below for proper YOLO integration
    # YOLO boost (augment mask) - run only if yolo available
    if use_yolo and yolo is not None:
        try:
            yolo_res = yolo(img_rgb, conf=yolo_conf, verbose=False)[0]
            if yolo_res.boxes is not None and len(yolo_res.boxes) > 0:
                boxes = yolo_res.boxes.xyxy.cpu().numpy()
                cls_ids = yolo_res.boxes.cls.cpu().numpy().astype(int)
                confs = yolo_res.boxes.conf.cpu().numpy()

                yolo_mask = np.zeros((h, w), dtype=np.float32)
                for box, cls_id, conf in zip(boxes, cls_ids, confs):
                    name = yolo.names.get(int(cls_id), "").lower()
                    if "wall" in name and conf >= yolo_conf:
                        x1, y1, x2, y2 = map(int, box)
                        # scale YOLO box coords from YOLO image size to original (if needed)
                        # if YOLO ran on original img size this is identity
                        x1 = np.clip(x1, 0, w - 1)
                        x2 = np.clip(x2, 0, w - 1)
                        y1 = np.clip(y1, 0, h - 1)
                        y2 = np.clip(y2, 0, h - 1)
                        if x2 > x1 and y2 > y1:
                            yolo_mask[y1:y2, x1:x2] = np.maximum(
                                yolo_mask[y1:y2, x1:x2], conf
                            )

                if yolo_mask.max() > 0:
                    yolo_mask = cv2.GaussianBlur(
                        (yolo_mask * 255).astype(np.uint8), (7, 7), 0
                    )
                    # combine: any strong YOLO pixel forces mask on
                    wall_mask_np[yolo_mask > 100] = 255
        except Exception as e:
            print(f"YOLO boost error: {e}")

    # Polygonize after smoothing
    wall_polygons = extract_polygons_from_mask(
        wall_mask_np, min_area=int(min_wall_area * 0.5), max_polygons=max_walls
    )
    print(f"  Initial extraction: {len(wall_polygons)} wall polygons")

    # Merge (smoothes and reduces count)
    if len(wall_polygons) > max_walls:
        print("  Merging nearby polygons...")
        wall_polygons = merge_nearby_polygons(
            wall_polygons, distance_threshold=8, smooth_buffer=2.0
        )
        print(f"  After merging: {len(wall_polygons)} wall polygons")

    # final area filter (after merge) — remove tiny leftover islands
    wall_polygons = [
        p for p in wall_polygons if Polygon(p).area > (min_wall_area * 0.5)
    ]

    # --- EXTRACT ROOMS (Optional) ---
    room_polygons = []
    if extract_rooms:
        print("\nExtracting rooms...")

        # Extract individual room types
        for i in range(rooms.shape[0]):
            room_channel = rooms[i]
            room_mask = (room_channel > room_threshold).float()

            if room_mask.sum() > 0:
                polys = extract_polygons_from_mask(
                    room_mask,
                    min_area=min_wall_area * 2,  # Rooms should be larger
                    max_polygons=5,
                )
                room_polygons.extend(polys)

        print(f"  Extracted {len(room_polygons)} room polygons")

    # --- YOLO BOOST (Conservative) ---
    if use_yolo and yolo is not None:
        print(f"\nRunning YOLO (conf={yolo_conf})...")
        try:
            yolo_res = yolo(img_rgb, conf=yolo_conf, verbose=False)[0]
            if yolo_res.boxes is not None and len(yolo_res.boxes) > 0:
                boxes = yolo_res.boxes.xyxy.cpu().numpy()
                cls_ids = yolo_res.boxes.cls.cpu().numpy().astype(int)
                confs = yolo_res.boxes.conf.cpu().numpy()

                # Count by class
                class_counts = {}
                for cls_id in cls_ids:
                    name = yolo.names.get(cls_id, f"class_{cls_id}")
                    class_counts[name] = class_counts.get(name, 0) + 1

                print(f"  YOLO detected {len(boxes)} objects:")
                for name, count in sorted(class_counts.items()):
                    print(f"    {name}: {count}")

                # Only use high-confidence wall detections
                wall_count_before = len(wall_polygons)
                yolo_wall_mask = np.zeros((height, width), dtype=np.float32)

                for box, cls_id, conf in zip(boxes, cls_ids, confs):
                    if conf < yolo_conf + 0.2:  # Higher threshold for YOLO
                        continue

                    name = yolo.names.get(cls_id, "").lower()
                    if "wall" in name:
                        x1, y1, x2, y2 = map(int, box)
                        x1 = max(0, int(x1 * width / w))
                        y1 = max(0, int(y1 * height / h))
                        x2 = min(width, int(x2 * width / w))
                        y2 = min(height, int(y2 * height / h))

                        if x2 > x1 and y2 > y1:
                            yolo_wall_mask[y1:y2, x1:x2] += conf

                if yolo_wall_mask.max() > 0:
                    yolo_boost = torch.from_numpy(
                        cv2.GaussianBlur(yolo_wall_mask, (5, 5), 0)
                    )
                    yolo_boost = torch.tensor(
                        yolo_boost / yolo_boost.max(), dtype=torch.float32
                    )
                    yolo_boost = yolo_boost.to(wall_mask.device)
                    wall_mask = torch.clamp(wall_mask + 0.5 * yolo_boost, 0, 1)
                    # # Add non-duplicate YOLO polygons
                    for poly in yolo_polys:
                        try:
                            p1 = Polygon(poly)
                            is_duplicate = any(
                                p1.intersection(Polygon(existing)).area / p1.area > 0.7
                                for existing in wall_polygons
                            )
                            if not is_duplicate:
                                wall_polygons.append(poly)
                        except:
                            pass

                    print(
                        f"  YOLO added {len(wall_polygons) - wall_count_before} walls"
                    )

        except Exception as e:
            print(f"  YOLO error: {e}")

    print(f"\n{'='*70}")
    print(f"✓ FINAL: {len(wall_polygons)} walls, {len(room_polygons)} rooms")
    print(f"{'='*70}\n")

    return {"walls": wall_polygons, "rooms": room_polygons}
