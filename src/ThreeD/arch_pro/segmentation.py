import os
import sys
import numpy as np
import torch
import torch.nn.functional as F
import cv2
from typing import List, Dict, Tuple
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import orient
from ultralytics import YOLO

# Add local path to find model and utils folders
sys.path.append(str(Path(__file__).parent))

from model import get_model
from utils.loaders import RotateNTurns
from utils.post_prosessing import split_prediction, get_polygons
from opencv_utils import extract_wall_lines, clean_noisy_mask

# Configuration
N_CLASSES = 44
SPLIT = [21, 12, 11]
WALL_CLASS_INDEX_START = 21
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Furukawa class mapping
ROOM_CLASSES = ["Background", "Outdoor", "Wall", "Kitchen", "Living Room", "Bed Room", "Bath",
                "Entry", "Railing", "Storage", "Garage", "Undefined"]
ICON_CLASSES = ["No Icon", "Window", "Door", "Closet", "Electrical Applience", "Toilet", "Sink",
                "Sauna Bench", "Fire Place", "Bathtub", "Chimney"]

class ArchSegmentation:
    def __init__(self, model_path: str, yolo_path: str):
        self.rot = RotateNTurns()
        self.device = DEVICE
        
        # Load Furukawa Model
        self.model = get_model("hg_furukawa_original", 51)
        self.model.conv4_ = torch.nn.Conv2d(256, N_CLASSES, bias=True, kernel_size=1)
        self.model.upsample = torch.nn.ConvTranspose2d(N_CLASSES, N_CLASSES, kernel_size=4, stride=4)
        
        checkpoint = torch.load(model_path, map_location=self.device)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.to(self.device).eval()
        
        # Load YOLO for boosting
        self.yolo = YOLO(yolo_path)
        self.yolo.to(self.device)
        
        # Build fuzzy map
        self.name_to_idx = {}
        for i, name in enumerate(ROOM_CLASSES): self.name_to_idx[name.lower()] = i
        for i, name in enumerate(ICON_CLASSES): self.name_to_idx[name.lower()] = WALL_CLASS_INDEX_START + i

    def _map_yolo_to_furukawa(self, name: str) -> int:
        n = name.lower()
        if "door" in n: return self.name_to_idx.get("door", -1)
        if "window" in n: return self.name_to_idx.get("window", -1)
        if "wall" in n: return self.name_to_idx.get("wall", -1)
        return -1

    def segment(self, img_path: str, ppm: float = 100.0, gap_closer=None) -> Dict:
        """Process floorplan image and return architectural elements."""
        img = cv2.imread(img_path)
        if img is None: return {"walls": [], "doors": [], "windows": [], "rooms": []}
        
        # Initialize outputs to avoid NameError in edge cases
        rooms_map = None
        icons = None
        
        h, w = img.shape[:2]
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_input = 2 * (img_rgb / 255.0) - 1
        img_input = np.moveaxis(img_input, -1, 0)
        img_input = np.array([img_input.astype(np.float32)], dtype=np.float32)
        img_tensor = torch.from_numpy(img_input).float().to(self.device)

        # 1. YOLO Detection
        yolo_res = self.yolo(img_rgb, verbose=False)[0]
        
        # 2. Furukawa Inference (Rotations)
        size_check = np.array([img_tensor.shape[2], img_tensor.shape[3]]) % 2
        sh, sw = img_tensor.shape[2] - size_check[0], img_tensor.shape[3] - size_check[1]
        rotations = [(0, 0), (1, -1), (2, 2), (-1, 1)]
        pred_stack = torch.zeros([len(rotations), N_CLASSES, sh, sw], device=self.device)

        with torch.no_grad():
            for i, (forward, back) in enumerate(rotations):
                rot_img = self.rot(img_tensor, "tensor", forward)
                pred = self.model(rot_img)
                pred = self.rot(pred, "tensor", back)
                pred = F.interpolate(pred, size=(sh, sw), mode="bilinear", align_corners=True)
                pred_stack[i] = pred[0]

        prediction = torch.mean(pred_stack, 0, True).cpu()
        heatmaps, rooms_map, icons = split_prediction(prediction, (sh, sw), SPLIT)
        
        # 3. YOLO Boosting
        if yolo_res.boxes is not None:
            boxes = yolo_res.boxes.xyxy.cpu().numpy()
            cls_ids = yolo_res.boxes.cls.cpu().numpy().astype(int)
            confs = yolo_res.boxes.conf.cpu().numpy()
            
            for box, cid, conf in zip(boxes, cls_ids, confs):
                if conf < 0.5: continue
                f_idx = self._map_yolo_to_furukawa(self.yolo.names[cid])
                if f_idx == -1: continue
                
                x1, y1, x2, y2 = map(int, box)
                x1, y1 = max(0, int(x1 * sw // w)), max(0, int(y1 * sh // h))
                x2, y2 = min(sw, int(x2 * sw // w)), min(sh, int(y2 * sh // h))
                
                target = rooms_map if f_idx < WALL_CLASS_INDEX_START else icons
                channel = f_idx if f_idx < WALL_CLASS_INDEX_START else f_idx - WALL_CLASS_INDEX_START
                if target is not None and channel < target.shape[0]:
                    target[channel, y1:y2, x1:x2] = np.clip(target[channel, y1:y2, x1:x2] + conf * 0.5, 0, 1)

        # 4. Extract Objects
        results = {"walls": [], "doors": [], "windows": [], "rooms": []}
        
        # Walls
        wall_mask = (rooms_map[self.name_to_idx["wall"]] > 0.5).astype(np.uint8) * 255
        if gap_closer:
            wall_mask = gap_closer(wall_mask)
            
        wall_mask = clean_noisy_mask(wall_mask)
        results["walls"] = self._mask_to_polygons(wall_mask, w/sw/ppm, h/sh/ppm)
        results["wall_segments"] = extract_wall_lines(wall_mask, ppm, w/sw/ppm, h/sh/ppm)
        
        # Rooms
        inverted = cv2.bitwise_not(wall_mask)
        inverted = clean_noisy_mask(inverted)
        results["rooms"] = self._mask_to_polygons(inverted, w/sw/ppm, h/sh/ppm, min_area=100)
        
        # Doors & Windows
        door_mask = (icons[self.name_to_idx["door"] - WALL_CLASS_INDEX_START] > 0.5).astype(np.uint8) * 255
        results["doors"] = self._mask_to_polygons(door_mask, w/sw/ppm, h/sh/ppm)
        
        window_mask = (icons[self.name_to_idx["window"] - WALL_CLASS_INDEX_START] > 0.5).astype(np.uint8) * 255
        results["windows"] = self._mask_to_polygons(window_mask, w/sw/ppm, h/sh/ppm)
            
        return results

    def _approx_poly(self, cnt, scale_x, scale_y):
        epsilon = 0.005 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        return [[float(p[0][0]) * scale_x, float(p[0][1]) * scale_y] for p in approx]

    def _mask_to_polygons(self, mask, scale_x, scale_y, min_area=10):
        contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is None: return []
        
        results = []
        hierarchy = hierarchy[0]
        for i, cnt in enumerate(contours):
            if hierarchy[i][3] == -1:
                if cv2.contourArea(cnt) < min_area: continue
                poly = self._approx_poly(cnt, scale_x, scale_y)
                holes = []
                child_idx = hierarchy[i][2]
                while child_idx != -1:
                    child_cnt = contours[child_idx]
                    if cv2.contourArea(child_cnt) > min_area / 5:
                        holes.append(self._approx_poly(child_cnt, scale_x, scale_y))
                    child_idx = hierarchy[child_idx][0]
                
                if holes:
                    results.append({"polygon": poly, "holes": holes})
                else:
                    results.append({"polygon": poly})
        return results
