import numpy as np
import cv2
from typing import List, Dict, Tuple
from ultralytics import YOLO
from models import Opening, Room, Furniture, TechnicalPoint

class YOLODetector:
    def __init__(self, layout_model_path: str, furniture_model_path: str, ppm: float = 100):
        self.ppm = ppm
        self.layout_model = None
        self.furniture_model = None
        
        try:
            self.layout_model = YOLO(layout_model_path)
            print(f"✓ Layout Model Loaded: {layout_model_path}")
        except Exception as e:
            print(f"✗ Layout Model Error: {e}")
            
        try:
            self.furniture_model = YOLO(furniture_model_path)
            print(f"✓ Furniture Model Loaded: {furniture_model_path}")
        except Exception as e:
            print(f"✗ Furniture Model Error: {e}")

    def detect_all(self, image: np.ndarray, conf: float = 0.25) -> Dict:
        results = {
            "doors": [], "windows": [], "rooms": [],
            "furniture": [], "electrical": [], "plumbing": [],
            "stairs": [], "columns": [], "railings": []
        }
        
        # 1. Layout Model (Walls, Doors, Windows, Spaces)
        if self.layout_model:
            layout_res = self.layout_model(image, conf=conf, verbose=False)[0]
            self._parse_layout(layout_res, results)
            
        # 2. Furniture & Symbols Model (Beds, Chairs, Sinks, Tubs)
        if self.furniture_model:
            furn_res = self.furniture_model(image, conf=conf, verbose=False)[0]
            self._parse_furniture(furn_res, results)
            
        return results

    def _parse_layout(self, results, data: Dict):
        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0])
            cls_name = results.names[int(box.cls[0])].lower()
            
            w_px, h_px = float(x2 - x1), float(y2 - y1)
            cx_m, cy_m = float((x1 + x2) / 2 / self.ppm), float((y1 + y2) / 2 / self.ppm)
            width_m, depth_m = float(w_px / self.ppm), float(h_px / self.ppm)
            rot = float(0.0 if w_px > h_px else np.pi / 2)
            uid = f"layout_{i}"

            if "door" in cls_name:
                data["doors"].append(Opening(id=uid, position=[cx_m, cy_m], width=float(max(width_m, depth_m)), height=2.1, rotation=rot, type=cls_name, confidence=conf))
            elif "window" in cls_name or "glass" in cls_name:
                data["windows"].append(Opening(id=uid, position=[cx_m, cy_m], width=float(max(width_m, depth_m)), height=1.2, rotation=rot, type=cls_name, sillHeight=0.9, confidence=conf))
            elif "space" in cls_name or "room" in cls_name:
                poly = [[float(x1/self.ppm), float(y1/self.ppm)], [float(x2/self.ppm), float(y1/self.ppm)], [float(x2/self.ppm), float(y2/self.ppm)], [float(x1/self.ppm), float(y2/self.ppm)]]
                data["rooms"].append(Room(id=uid, name=cls_name.replace("space ", "").title(), center=[cx_m, cy_m], type=cls_name, area=float(width_m*depth_m), polygon=poly, confidence=conf))
            elif "electricitysign" in cls_name:
                data["electrical"].append(TechnicalPoint(id=uid, position=[cx_m, cy_m], type="db_panel", category="electrical", height=1.5))
            elif "column" in cls_name:
                data["columns"].append({"id": uid, "center": [cx_m, cy_m], "size": max(width_m, depth_m)})

    def _parse_furniture(self, results, data: Dict):
        plumbing_types = ["sink", "tub", "shower", "toilet", "doublesink"]
        electrical_types = ["tv", "fridge", "oven", "stove"]
        
        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0])
            cls_name = results.names[int(box.cls[0])].lower()
            
            w_px, h_px = float(x2 - x1), float(y2 - y1)
            cx_m, cy_m = float((x1 + x2) / 2 / self.ppm), float((y1 + y2) / 2 / self.ppm)
            width_m, depth_m = float(w_px / self.ppm), float(h_px / self.ppm)
            rot = float(0.0 if w_px > h_px else np.pi / 2)
            uid = f"furn_{i}"

            category = "furniture"
            if any(t in cls_name for t in plumbing_types): category = "plumbing"
            elif any(t in cls_name for t in electrical_types): category = "electrical"
            
            data["furniture"].append(Furniture(id=uid, position=[cx_m, cy_m], size=[width_m, depth_m, 0.8], rotation=rot, type=cls_name, category=category, confidence=conf))
            
            # Auto-add plumbing/electrical points for specific items
            if category == "plumbing":
                data["plumbing"].append(TechnicalPoint(id=f"pt_{uid}", position=[cx_m, cy_m], type="water_inlet", category="plumbing", height=0.5))
            elif category == "electrical":
                data["electrical"].append(TechnicalPoint(id=f"pt_{uid}", position=[cx_m, cy_m], type="power_socket", category="electrical", height=0.4))
