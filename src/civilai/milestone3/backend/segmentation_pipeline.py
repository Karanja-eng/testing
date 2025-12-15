
import sys
import os
import json
import numpy as np
import cv2
from pathlib import Path
from typing import List, Dict, Any

# Add src/civilai to path to import segmentation and model
CURRENT_DIR = Path(__file__).parent
CIVILAI_DIR = CURRENT_DIR.parent.parent
sys.path.append(str(CIVILAI_DIR))

# Import Wall Segmentation (Furukawa) from src/civilai/segmentation.py
try:
    import segmentation
    import torch
    print("Successfully imported segmentation module")
except ImportError as e:
    print(f"Warning: Could not import segmentation module: {e}")
    segmentation = None

from ultralytics import YOLO

class FloorplanPipeline:
    def __init__(self):
        self.yolo_model = None
        self.load_yolo()

    def load_yolo(self):
        # path to best.pt in src/civilai
        weights_path = CIVILAI_DIR / "best.pt"
        if weights_path.exists():
            try:
                self.yolo_model = YOLO(str(weights_path))
                print(f"YOLO loaded from {weights_path}")
            except Exception as e:
                print(f"Failed to load YOLO: {e}")
        else:
            print(f"YOLO weights not found at {weights_path}")

    def detect_walls_furukawa(self, image_path: str, scale_factor=0.01) -> List[Dict]:
        """
        Returns list of walls using the robust segmentation module
        """
        walls = []
        if not segmentation:
            return []
            
        try:
            # Replicating logic from segmentation.process_floorplan but returning data
            print(f"Detecting walls in {image_path}")
            img = cv2.imread(image_path)
            if img is None: return []
            
            h, w = img.shape[:2]
            
            # Preprocess for Furukawa
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img_input = 2 * (img_rgb.astype(np.float32) / 255.0) - 1
            img_input = np.moveaxis(img_input, -1, 0)
            
            # Ensure device match
            device = segmentation.DEVICE
            img_tensor = torch.from_numpy(img_input).unsqueeze(0).float().to(device)
            
            # Run Model
            size_check = np.array([h, w]) % 2
            height = h - size_check[0]
            width = w - size_check[1]
            
            prediction = segmentation.run_furukawa_model(img_tensor, height, width)
            
            # Split
            SPLIT = segmentation.SPLIT
            # heatmaps = prediction[:SPLIT[0]]
            rooms = prediction[SPLIT[0]:SPLIT[0]+SPLIT[1]]
            
            # Create Mask
            wall_threshold = 0.3
            room_combined = rooms.sum(dim=0).cpu().numpy()
            wall_mask = (room_combined > wall_threshold).astype(np.uint8)
            
            # Extract Polygons
            # segment_image uses wall_thickness=0.15, scale=0.01 by default
            # We want to match our pipeline scale.
            # segmentation.create_wall_polygons_from_mask expects mask and returns List[Polygon]
            
            polygons = segmentation.create_wall_polygons_from_mask(
                wall_mask,
                threshold=wall_threshold,
                scale=1.0, # Keep in pixels for now, rename to avoid confusion
                wall_thickness=0.15
            )
            
            # Convert Shapely Polygons to Wall Segments
            for poly in polygons:
                # poly.exterior.coords is list of (x,y)
                coords = list(poly.exterior.coords)
                for i in range(len(coords) - 1):
                    p1 = coords[i]
                    p2 = coords[i+1]
                    
                    # Convert to meters
                    x1, y1 = p1[0] * scale_factor, p1[1] * scale_factor
                    x2, y2 = p2[0] * scale_factor, p2[1] * scale_factor
                    
                    # Filter tiny segments
                    length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
                    if length > 0.1:
                        walls.append({
                            'start': [x1, y1],
                            'end': [x2, y2],
                            'thickness': 0.15
                        })
                        
        except Exception as e:
            print(f"Error in wall segmentation: {e}")
            import traceback
            traceback.print_exc()
            
        return walls

    def detect_objects_yolo(self, image_path: str, ppm=100.0) -> Dict[str, List]:
        """
        Detects doors, windows, rooms, objects using YOLO.
        Returns dict of lists.
        """
        data = {
            'doors': [],
            'windows': [],
            'rooms': [],
            'objects': []
        }
        
        if not self.yolo_model:
            return data
            
        img = cv2.imread(image_path)
        if img is None: return data
        
        # Run YOLO
        try:
            results = self.yolo_model(img, conf=0.15, verbose=False)[0] # Lowered conf
            
            for box in results.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                name = results.names[cls_id].lower()
                
                # Center and Size in meters
                cx = (x1 + x2) / 2.0 / ppm
                cy = (y1 + y2) / 2.0 / ppm
                w_m = abs(x2 - x1) / ppm
                h_m = abs(y2 - y1) / ppm
                
                rotation = 0.0 if w_m > h_m else 1.5708
                width = max(w_m, h_m)
                
                item = {
                    'position': [cx, cy],
                    'width': width,
                    'rotation': rotation,
                    'confidence': conf
                }
                
                if 'door' in name:
                    item['type'] = 'door'
                    data['doors'].append(item)
                elif 'window' in name:
                    item['type'] = 'window'
                    item['sill'] = 0.9
                    data['windows'].append(item)
                elif 'room' in name or any(x in name for x in ['living', 'bed', 'bath', 'kitchen']):
                    data['rooms'].append({
                        'name': name,
                        'type': name,
                        'center': [cx, cy],
                        'polygon': [
                            [x1/ppm, y1/ppm],
                            [x2/ppm, y1/ppm],
                            [x2/ppm, y2/ppm],
                            [x1/ppm, y2/ppm]
                        ]
                    })
                else:
                    item['type'] = name
                    data['objects'].append(item)
        except Exception as e:
            print(f"YOLO detection error: {e}")
                
        return data

    def process(self, image_path: str) -> Dict[str, Any]:
        """
        Full pipeline
        """
        # 1. Estimate scale (Pixels Per Meter). 
        # Heuristic: Assume image width covers say 15 meters? 
        img = cv2.imread(image_path)
        h, w = img.shape[:2]
        ppm = 100.0 # Fixed PPM
        
        # 2. Walls
        walls = self.detect_walls_furukawa(image_path, scale_factor=1.0/ppm)
        
        # 3. Yolo
        yolo_data = self.detect_objects_yolo(image_path, ppm=ppm)
        
        # Combine
        result = {
            'walls': walls,
            'doors': yolo_data['doors'],
            'windows': yolo_data['windows'],
            'rooms': yolo_data['rooms'],
            'objects': yolo_data['objects'],
            'wallHeight': 3.0,
            'metadata': {
                'source': 'Milestone 3 Pipeline',
                'ppm': ppm
            }
        }
        
        return result

if __name__ == "__main__":
    # Test
    if len(sys.argv) > 1:
        p = FloorplanPipeline()
        res = p.process(sys.argv[1])
        print(json.dumps(res, indent=2))
