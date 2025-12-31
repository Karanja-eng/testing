# Save this as: backend/main_enhanced.py
# Run with: uvicorn main_enhanced:app --host 0.0.0.0 --port 8001 --reload

import os
import uuid
import io
import traceback
import json
import asyncio
import subprocess
from pathlib import Path
from typing import List, Optional, Dict, Tuple
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import trimesh
from scipy.spatial import ConvexHull
from shapely.geometry import LineString, Point

# Optional YOLO
try:
    from ultralytics import YOLO

    YOLO_OK = True
except ImportError:
    YOLO_OK = False

BASE_DIR = Path(__file__).parent
YOLO_WEIGHTS = BASE_DIR / "best.pt"
GENERATED = BASE_DIR / "generated"
UPLOADS = BASE_DIR / "uploads"

GENERATED.mkdir(exist_ok=True)
UPLOADS.mkdir(exist_ok=True)

DEFAULT_WALL_THICKNESS = 0.15
MIN_WALL_LENGTH = 0.3

# Load YOLO if available
yolo_model = None
if YOLO_OK and YOLO_WEIGHTS.exists():
    try:
        yolo_model = YOLO(str(YOLO_WEIGHTS))
        print("✓ YOLO model loaded")
    except Exception as e:
        print(f"YOLO load failed: {e}")

BLENDER_PATH = r"C:\blender-3.6.10-windows-x64\blender-3.6.10-windows-x64\blender.exe"
BLENDER_SCRIPT = BASE_DIR / "blender_gen.py"


# ============================================================================
# MODELS
# ============================================================================
class WallSegment(BaseModel):
    start: List[float]
    end: List[float]
    height: float
    offsetZ: float = 0.0

class Wall(BaseModel):
    id: str = "wall_unknown"
    start: List[float]
    end: List[float]
    thickness: float
    length: float
    segments: Optional[List[WallSegment]] = None


class Opening(BaseModel):
    id: str = "opening_unknown"
    position: List[float]
    width: float
    height: float
    rotation: float
    type: str # e.g. door_swing, window_regular
    sillHeight: Optional[float] = 0.9
    confidence: Optional[float] = 1.0


class Furniture(BaseModel):
    id: str = "furniture_unknown"
    position: List[float]
    size: List[float] # [width, depth, height]
    rotation: float
    type: str # e.g. closet, sink, cabinet
    confidence: Optional[float] = 1.0


class Room(BaseModel):
    id: str = "room_unknown"
    name: str
    center: List[float]
    type: str
    area: float
    polygon: Optional[List[List[float]]] = None
    confidence: Optional[float] = 1.0


class FloorPlan(BaseModel):
    level: int
    walls: List[Wall]
    doors: List[Opening]
    windows: List[Opening]
    rooms: List[Room]
    furniture: List[Furniture] = []
    stairs: List[dict] = []
    columns: List[dict] = []
    railings: List[dict] = []
    dimensions: dict = {}


class BuildingModel(BaseModel):
    floors: List[FloorPlan]
    wallHeight: float
    wallThickness: float
    totalFloors: int
    scaleFactor: float
    detectedScale: bool
    metadata: dict = {}


# ============================================================================
# OPENCV PROCESSOR
# ============================================================================
class OpenCVProcessor:
    def __init__(self, pixels_per_meter: float = 100):
        self.ppm = pixels_per_meter

    def preprocess(self, image: np.ndarray) -> np.ndarray:
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        binary = cv2.adaptiveThreshold(
            enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )
        return binary

    def wall_filter(self, img: np.ndarray) -> np.ndarray:
        """
        Filter out walls from an image.
        Adapted from 2D_FloorPlan_to_3D_CubiCasa_ftb.ipynb (detect.py).
        """
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()
            
        ret, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = np.ones((3, 3), np.uint8)
        
        # Morphological opening to remove noise
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        
        # Sure background
        sure_bg = cv2.dilate(opening, kernel, iterations=3)
        
        # Distance transform to find wall centers
        dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
        
        # Sure foreground
        ret, sure_fg = cv2.threshold(0.5 * dist_transform, 0.2 * dist_transform.max(), 255, 0)
        sure_fg = np.uint8(sure_fg)
        
        # Unknown region (walls)
        unknown = cv2.subtract(sure_bg, sure_fg)
        return unknown

    def remove_noise(self, img: np.ndarray, noise_removal_threshold: int = 250) -> np.ndarray:
        """Remove noise from image and return mask."""
        img_copy = img.copy()
        img_copy[img_copy < 128] = 0
        img_copy[img_copy > 128] = 255
        
        # Invert to find contours of holes/black areas if input is white?
        # Assuming input is Room=White, Background=Black.
        # detect.py calls `cv2.findContours(~img, ...)`
        contours, _ = cv2.findContours(~img_copy, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        mask = np.zeros_like(img_copy)
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > noise_removal_threshold:
                cv2.fillPoly(mask, [contour], 255)
        return mask

    def find_corners_and_draw_lines(self, img: np.ndarray, corners_threshold: float = 0.01, room_closing_max_length: int = 130) -> np.ndarray:
        """Finds corners and draw lines to close rooms."""
        dst = cv2.cornerHarris(img, 2, 3, 0.04)
        dst = cv2.dilate(dst, None)
        
        corners_mask = dst > corners_threshold * dst.max()
        
        # Draw lines to close the rooms off (Scan X)
        for y, row in enumerate(corners_mask):
            x_same_y = np.argwhere(row)
            for x1, x2 in zip(x_same_y[:-1], x_same_y[1:]):
                if x2[0] - x1[0] < room_closing_max_length:
                    cv2.line(img, (x1[0], y), (x2[0], y), 0, 1)

        # Scan Y
        for x, col in enumerate(corners_mask.T):
            y_same_x = np.argwhere(col)
            for y1, y2 in zip(y_same_x[:-1], y_same_x[1:]):
                if y2[0] - y1[0] < room_closing_max_length:
                    cv2.line(img, (x, y1[0]), (x, y2[0]), 0, 1)
                    
        return img

    def mark_outside_black(self, img: np.ndarray, mask: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Mark the area outside the house as black."""
        contours, _ = cv2.findContours(~img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return img, mask
            
        biggest_contour = max(contours, key=cv2.contourArea)
        mask = np.zeros_like(mask)
        cv2.fillPoly(mask, [biggest_contour], 255)
        img[mask == 0] = 0
        return img, mask

    def find_rooms_advanced(self, img: np.ndarray) -> List[np.ndarray]:
        """
        Advanced room detection pipeline.
        Starts by identifying walls to find the 'hollow' areas (rooms).
        """
        # 1. Identify walls
        walls = self.wall_filter(img)
        
        # 2. Invert to get room candidates (Rooms=255, Walls=0)
        room_candidates = cv2.bitwise_not(walls)
        
        # 3. Remove noise (small blobs)
        mask = self.remove_noise(room_candidates, noise_removal_threshold=1000)
        
        # 4. Close gaps (doors) using corner-based line drawing
        # find_corners_and_draw_lines expects rooms=White, walls=Black
        rooms_with_closed_doors = self.find_corners_and_draw_lines(mask.copy())
        
        # 5. Mark regions outside the house as black
        house_img, house_mask = self.mark_outside_black(rooms_with_closed_doors, mask)
        
        # 6. Use connected components to label each room
        num_labels, labels = cv2.connectedComponents(house_img)
        
        rooms = []
        for i in range(1, num_labels): # Skip background 0
            room_mask = (labels == i).astype(np.uint8) * 255
            # Filter parts that are too small to be rooms
            if cv2.countNonZero(room_mask) > 2000: # Area threshold in pixels
                rooms.append(room_mask)
                
        return rooms

    def detect_walls(self, img: np.ndarray) -> List[Wall]:
        """
        Detect walls using wall_filter and contour approximation.
        """
        wall_img = self.wall_filter(img)
        
        # Find contours of the filtered walls
        contours, _ = cv2.findContours(
            wall_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        walls = []
        for contour in contours:
            # Approximate the contour to get wall segments
            epsilon = 0.01 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)

            # Convert to wall objects
            for i in range(len(approx)):
                pt1 = approx[i][0]
                pt2 = approx[(i + 1) % len(approx)][0]

                x1, y1 = float(pt1[0]) / self.ppm, float(pt1[1]) / self.ppm
                x2, y2 = float(pt2[0]) / self.ppm, float(pt2[1]) / self.ppm
                length = float(np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2))

                if length > MIN_WALL_LENGTH:
                    walls.append(
                        Wall(
                            start=[round(x1, 2), round(y1, 2)],
                            end=[round(x2, 2), round(y2, 2)],
                            thickness=DEFAULT_WALL_THICKNESS,
                            length=round(length, 2),
                        )
                    )

        return walls

    def detect_rooms(self, img: np.ndarray) -> List[Room]:
        """
        Detect rooms using either advanced segmentation or fallback to contours.
        """
        # Try advanced segmentation first
        try:
            # Step 1: Try using find_rooms_advanced (works best on original img)
            room_masks = self.find_rooms_advanced(img)
        except Exception as e:
            print(f"Advanced room detection failed: {e}, falling back to simple")
            room_masks = []
            
        # If advanced failed or returned nothing, try simple contour-based detection
        if not room_masks:
             # Preprocess for simple detection if not already binary
             if len(img.shape) == 3 or (len(np.unique(img)) > 2):
                 binary = self.preprocess(img)
             else:
                 binary = img
                 
             inverted = cv2.bitwise_not(binary)
             contours, _ = cv2.findContours(inverted, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
             for c in contours:
                 if cv2.contourArea(c) > 5000:
                     m = np.zeros_like(inverted)
                     cv2.fillPoly(m, [c], 255)
                     room_masks.append(m)

        rooms = []
        room_id = 1

        for mask in room_masks:
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours: 
                continue
                
            contour = max(contours, key=cv2.contourArea)
            area_px = cv2.contourArea(contour)
            if area_px < 5000:
                continue

            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue

            cx = float(int(M["m10"] / M["m00"]) / self.ppm)
            cy = float(int(M["m01"] / M["m00"]) / self.ppm)
            area_m2 = float(area_px / (self.ppm**2))

            epsilon = 0.01 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            polygon = [
                [float(pt[0][0] / self.ppm), float(pt[0][1] / self.ppm)]
                for pt in approx
            ]

            if area_m2 < 5:
                room_type, name = "bathroom", f"Bathroom {room_id}"
            elif area_m2 < 12:
                room_type, name = "bedroom", f"Bedroom {room_id}"
            elif area_m2 < 20:
                room_type, name = "kitchen", "Kitchen"
            else:
                room_type, name = "living", "Living Room"

            rooms.append(
                Room(
                    name=name,
                    center=[round(cx, 2), round(cy, 2)],
                    type=room_type,
                    area=round(area_m2, 2),
                    polygon=polygon,
                    confidence=1.0,
                )
            )
            room_id += 1

        return rooms

    def detect_openings(
        self, binary: np.ndarray
    ) -> Tuple[List[Opening], List[Opening]]:
        contours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        doors, windows = [], []

        for contour in contours:
            area = cv2.contourArea(contour)
            if 1000 < area < 20000:
                x, y, w, h = cv2.boundingRect(contour)
                width = float(w / self.ppm)
                height = float(h / self.ppm)
                cx = float((x + w / 2) / self.ppm)
                cy = float((y + h / 2) / self.ppm)
                rotation = 0.0 if w > h else float(np.pi / 2)

                if 0.7 < max(width, height) < 1.2 and 1.8 < min(width, height) < 2.3:
                    doors.append(
                        Opening(
                            position=[round(cx, 2), round(cy, 2)],
                            width=round(max(width, height), 2),
                            height=2.1,
                            rotation=rotation,
                            type="door",
                            confidence=0.8,
                        )
                    )
                elif 0.6 < max(width, height) < 2.0 and 0.8 < min(width, height) < 1.5:
                    windows.append(
                        Opening(
                            position=[round(cx, 2), round(cy, 2)],
                            width=round(max(width, height), 2),
                            height=1.2,
                            rotation=rotation,
                            type="window",
                            sillHeight=0.9,
                            confidence=0.8,
                        )
                    )

        return doors, windows


# ============================================================================
# YOLO DETECTOR
# ============================================================================
class YOLODetector:
    def __init__(self, model, pixels_per_meter: float = 100):
        self.model = model
        self.ppm = pixels_per_meter

    def detect(self, image: np.ndarray, conf: float = 0.3) -> Dict:
        if self.model is None:
            return {
                "doors": [], "windows": [], "rooms": [],
                "stairs": [], "columns": [], "furniture": [], "railings": []
            }

        results = self.model(image, conf=conf, verbose=False)[0]
        doors, windows, rooms, stairs, columns, furniture, railings = [], [], [], [], [], [], []

        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            confidence = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = results.names[cls_id].lower()

            w_px, h_px = x2 - x1, y2 - y1
            cx_m = float((x1 + x2) / 2 / self.ppm)
            cy_m = float((y1 + y2) / 2 / self.ppm)
            width_m = float(w_px / self.ppm)
            depth_m = float(h_px / self.ppm)
            
            # Rotation heuristics
            rot = 0.0 if w_px > h_px else float(np.pi / 2)
            uid = f"{cls_name.split()[0]}_{i}"

            if "door" in cls_name:
                doors.append(
                    Opening(
                        id=uid,
                        position=[round(cx_m, 2), round(cy_m, 2)],
                        width=round(max(width_m, depth_m), 2),
                        height=2.1,
                        rotation=rot,
                        type=cls_name.replace(" ", "_"),
                        confidence=confidence,
                    )
                )
            elif "window" in cls_name or "glass" in cls_name:
                windows.append(
                    Opening(
                        id=uid,
                        position=[round(cx_m, 2), round(cy_m, 2)],
                        width=round(max(width_m, depth_m), 2),
                        height=1.2,
                        rotation=rot,
                        type=cls_name.replace(" ", "_"),
                        sillHeight=0.9,
                        confidence=confidence,
                    )
                )
            elif "space" in cls_name or "room" in cls_name:
                area = float((w_px * h_px) / (self.ppm**2))
                poly = [
                    [round(x1 / self.ppm, 2), round(y1 / self.ppm, 2)],
                    [round(x2 / self.ppm, 2), round(y1 / self.ppm, 2)],
                    [round(x2 / self.ppm, 2), round(y2 / self.ppm, 2)],
                    [round(x1 / self.ppm, 2), round(y2 / self.ppm, 2)]
                ]
                rooms.append(
                    Room(
                        id=uid,
                        name=cls_name.replace("space ", "").replace("_", " ").title(),
                        center=[round(cx_m, 2), round(cy_m, 2)],
                        type=cls_name.replace(" ", "_"),
                        area=round(area, 2),
                        polygon=poly,
                        confidence=confidence,
                    )
                )
            elif "fixedfurniture" in cls_name:
                furniture.append(
                    Furniture(
                        id=uid,
                        position=[round(cx_m, 2), round(cy_m, 2)],
                        size=[round(width_m, 2), round(depth_m, 2), 0.9],
                        rotation=rot,
                        type=cls_name.replace("fixedfurniture ", ""),
                        confidence=confidence,
                    )
                )
            elif "stair" in cls_name or "flight" in cls_name:
                stairs.append({
                    "id": uid,
                    "center": [round(cx_m, 2), round(cy_m, 2)],
                    "width": round(width_m, 2),
                    "length": round(depth_m, 2),
                    "confidence": confidence,
                })
            elif "column" in cls_name:
                columns.append({
                    "id": uid,
                    "center": [round(cx_m, 2), round(cy_m, 2)],
                    "size": round(max(width_m, depth_m), 2),
                    "confidence": confidence,
                })
            elif "railing" in cls_name:
                railings.append({
                    "id": uid,
                    "center": [round(cx_m, 2), round(cy_m, 2)],
                    "width": round(width_m, 2),
                    "length": round(depth_m, 2),
                    "confidence": confidence,
                })

        return {
            "doors": doors,
            "windows": windows,
            "rooms": rooms,
            "stairs": stairs,
            "columns": columns,
            "furniture": furniture,
            "railings": railings
        }


# ============================================================================
# 3D MESH GENERATION
# ============================================================================
def create_wall_segment_mesh(seg: WallSegment, thickness: float, perpendicular: np.ndarray) -> trimesh.Trimesh:
    start = np.array(seg.start + [0])
    end = np.array(seg.end + [0])
    
    corners = np.array(
        [
            start - perpendicular,
            start + perpendicular,
            end + perpendicular,
            end - perpendicular,
        ]
    )

    vertices = np.zeros((8, 3))
    vertices[:4] = corners
    vertices[:4, 2] = seg.offsetZ
    vertices[4:] = corners
    vertices[4:, 2] = seg.offsetZ + seg.height

    faces = [
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
        [3, 2, 1, 0],
        [4, 5, 6, 7],
    ]
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual.vertex_colors = [200, 200, 200, 255]
    return mesh

def get_wall_segments(wall: Wall, wall_height: float, doors: List[Opening], windows: List[Opening]) -> List[WallSegment]:
    start = np.array(wall.start)
    end = np.array(wall.end)
    direction = end - start
    length = np.linalg.norm(direction)
    
    if length < 0.01:
        return []
    
    normalized_direction = direction / length
    
    # Find openings for this wall
    wall_line = LineString([start, end])
    wall_openings = []
    
    for opening in doors + windows:
        point = Point(opening.position)
        dist = wall_line.distance(point)
        if dist < wall.thickness:
            # Project onto wall
            t = np.dot(np.array(opening.position) - start, normalized_direction)
            wall_openings.append((t, opening))
            
    if not wall_openings:
        return [WallSegment(start=wall.start, end=wall.end, height=wall_height)]
        
    # Sort openings
    wall_openings.sort(key=lambda x: x[0])
    
    segments = []
    current_t = 0
    
    for t, opening in wall_openings:
        # Segment before opening
        seg_start_t = t - opening.width / 2
        if seg_start_t > current_t + 0.01:
            segments.append(WallSegment(
                start=(start + normalized_direction * current_t).tolist(),
                end=(start + normalized_direction * seg_start_t).tolist(),
                height=wall_height
            ))
            
        # Above/Below window
        if opening.type == "window":
            win_start = (start + normalized_direction * (t - opening.width / 2)).tolist()
            win_end = (start + normalized_direction * (t + opening.width / 2)).tolist()
            
            # Sill (Below)
            if opening.sillHeight > 0:
                segments.append(WallSegment(
                    start=win_start,
                    end=win_end,
                    height=opening.sillHeight,
                    offsetZ=0
                ))
            # Lintel (Above)
            lintel_bottom = opening.sillHeight + opening.height
            if lintel_bottom < wall_height:
                segments.append(WallSegment(
                    start=win_start,
                    end=win_end,
                    height=wall_height - lintel_bottom,
                    offsetZ=lintel_bottom
                ))
        
        current_t = t + opening.width / 2
        
    # Final segment
    if current_t < length - 0.01:
        segments.append(WallSegment(
            start=(start + normalized_direction * current_t).tolist(),
            end=wall.end,
            height=wall_height
        ))
        
    return segments


def create_wall_with_openings(
    wall: Wall, height: float, doors: List[Opening], windows: List[Opening]
) -> List[trimesh.Trimesh]:
    segments = get_wall_segments(wall, height, doors, windows)
    if not segments:
        return []
        
    start = np.array(wall.start)
    end = np.array(wall.end)
    direction = end - start
    normalized_direction = direction / np.linalg.norm(direction)
    perpendicular = np.array([-normalized_direction[1], normalized_direction[0], 0]) * (wall.thickness / 2)
    
    meshes = []
    for seg in segments:
        meshes.append(create_wall_segment_mesh(seg, wall.thickness, perpendicular))
    return meshes


def create_door_mesh(opening: Opening, height: float, wall_thickness: float = 0.15) -> trimesh.Trimesh:
    pos, width, h, rot = (
        opening.position,
        opening.width,
        opening.height,
        opening.rotation,
    )
    hw = width / 2
    # Make door slightly thicker than wall or match it perfectly
    d = wall_thickness + 0.02 # Slight protrusion to ensure visibility
    
    vertices = np.array(
        [
            [-hw, -d/2, 0],
            [hw, -d/2, 0],
            [hw, d/2, 0],
            [-hw, d/2, 0],
            [-hw, -d/2, h],
            [hw, -d/2, h],
            [hw, d/2, h],
            [-hw, d/2, h],
        ]
    )

    cos_r, sin_r = np.cos(rot), np.sin(rot)
    rot_mat = np.array([[cos_r, -sin_r, 0], [sin_r, cos_r, 0], [0, 0, 1]])
    vertices = vertices @ rot_mat.T
    vertices[:, 0] += pos[0]
    vertices[:, 1] += pos[1]

    faces = [
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
        [3, 2, 1, 0],
        [4, 5, 6, 7],
    ]
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual.vertex_colors = [139, 69, 19, 255]
    return mesh


def create_window_mesh(opening: Opening, height: float, wall_thickness: float = 0.15) -> trimesh.Trimesh:
    pos, width, h, sill, rot = (
        opening.position,
        opening.width,
        opening.height,
        opening.sillHeight,
        opening.rotation,
    )
    hw = width / 2
    d = wall_thickness + 0.02
    
    vertices = np.array(
        [
            [-hw, -d/2, sill],
            [hw, -d/2, sill],
            [hw, d/2, sill],
            [-hw, d/2, sill],
            [-hw, -d/2, sill + h],
            [hw, -d/2, sill + h],
            [hw, d/2, sill + h],
            [-hw, d/2, sill + h],
        ]
    )

    cos_r, sin_r = np.cos(rot), np.sin(rot)
    rot_mat = np.array([[cos_r, -sin_r, 0], [sin_r, cos_r, 0], [0, 0, 1]])
    vertices = vertices @ rot_mat.T
    vertices[:, 0] += pos[0]
    vertices[:, 1] += pos[1]

    faces = [
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
        [3, 2, 1, 0],
        [4, 5, 6, 7],
    ]
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual.vertex_colors = [135, 206, 235, 150] # More transparent
    return mesh


def create_floor_slab(
    walls: List[Wall], thickness: float = 0.25
) -> Optional[trimesh.Trimesh]:
    if not walls:
        return None

    all_points = []
    for wall in walls:
        all_points.extend([wall.start, wall.end])
    all_points = np.array(all_points)

    try:
        hull = ConvexHull(all_points)
        hull_pts = all_points[hull.vertices]
        n = len(hull_pts)

        vertices = np.zeros((n * 2, 3))
        vertices[:n, :2] = hull_pts
        vertices[:n, 2] = -thickness
        vertices[n:, :2] = hull_pts
        vertices[n:, 2] = 0

        faces = []
        faces.append(list(range(n - 1, -1, -1)))
        faces.append(list(range(n, 2 * n)))
        for i in range(n):
            next_i = (i + 1) % n
            faces.append([i, next_i, n + next_i])
            faces.append([i, n + next_i, n + i])

        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        mesh.visual.vertex_colors = [180, 180, 180, 255]
        return mesh
    except:
        return None

def create_room_floor_mesh(room: Room, thickness: float = 0.05) -> Optional[trimesh.Trimesh]:
    if not room.polygon or len(room.polygon) < 3:
        return None
        
    try:
        # Convert room polygon points to numpy array
        points = np.array(room.polygon)
        
        # Triangulate the polygon using trimesh.creation.triangulate_polygon
        # If unavailable, we can use scipy.spatial.Delaunay but trimesh usually handles basic polygons
        
        # Create vertices for top and bottom faces
        n = len(points)
        vertices = np.zeros((n * 2, 3))
        vertices[:n, :2] = points
        vertices[:n, 2] = 0.02 # Slightly above main floor to prevent z-fighting
        vertices[n:, :2] = points
        vertices[n:, 2] = 0.02 + thickness
        
        # Simple triangulation for convex polygons (rooms are usually simple)
        # For complex non-convex rooms, we'd need a proper triangulation library
        # Here we use a simple fan from the first point for simplicity, or we can use the ConvexHull if we assume convexity
        # A better approach for general polygons in 3D without external huge libs:
        # We can use the center point to create a fan
        
        c = np.array(room.center)
        # Add center point
        vertices = np.vstack([vertices, [c[0], c[1], 0.02], [c[0], c[1], 0.02 + thickness]])
        center_idx_bottom = n * 2
        center_idx_top = n * 2 + 1
        
        faces = []
        
        # Create fan triangles
        for i in range(n):
            next_i = (i + 1) % n
            
            # Bottom face (fan from center)
            faces.append([center_idx_bottom, next_i, i])
            
            # Top face
            faces.append([center_idx_top, i + n, next_i + n])
            
            # Sides
            faces.append([i, next_i, next_i + n])
            faces.append([i, next_i + n, i + n])
            
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        
        # Color based on room type ("heatmap")
        color = [200, 200, 200, 255]
        rtype = room.type.lower()
        if "bedroom" in rtype:
            color = [100, 149, 237, 255] # Cornflower Blue
        elif "bathroom" in rtype or "bath" in rtype:
            color = [60, 179, 113, 255] # Medium Sea Green
        elif "kitchen" in rtype:
            color = [255, 165, 0, 255] # Orange
        elif "living" in rtype:
            color = [255, 215, 0, 255] # Gold
        elif "entry" in rtype or "hall" in rtype:
            color = [147, 112, 219, 255] # Medium Purple
        elif "storage" in rtype:
            color = [169, 169, 169, 255] # Dark Gray
        elif "garage" in rtype:
            color = [105, 105, 105, 255] # Dim Gray
        else:
             # Hash-based color for unknown types to stay consistent
             import hashlib
             h = int(hashlib.md5(rtype.encode()).hexdigest(), 16)
             color = [(h & 0xFF), ((h >> 8) & 0xFF), ((h >> 16) & 0xFF), 255]

        mesh.visual.vertex_colors = color
        return mesh
    except Exception as e:
        print(f"Error creating room mesh: {e}")
        return None


async def run_blender_generation(model: BuildingModel, output_path: str) -> bool:
    if not os.path.exists(BLENDER_PATH):
        print(f"❌ Blender not found at {BLENDER_PATH}")
        return False
        
    # Save model to temp JSON
    data_path = GENERATED / f"temp_{uuid.uuid4().hex}.json"
    with open(data_path, "w") as f:
        # Use simple json.dump or model.json()
        f.write(model.json())
        
    try:
        # Run Blender headless
        # Command: blender -b -P script.py -- --input data.json --output out.glb
        cmd = [
            BLENDER_PATH,
            "-b",
            "-P", str(BLENDER_SCRIPT),
            "--",
            "--input", str(data_path),
            "--output", str(output_path)
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            return True
        else:
            print(f"❌ Blender failed with code {process.returncode}")
            print(f"Stderr: {stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"❌ Blender execution error: {e}")
        return False
    finally:
        if data_path.exists():
            data_path.unlink()


def create_3d_scene(
    floor: FloorPlan, height: float, show_floor: bool, show_roof: bool
) -> trimesh.Scene:
    scene = trimesh.Scene()

    if show_floor:
        # Create main slab
        floor_mesh = create_floor_slab(floor.walls)
        if floor_mesh:
            scene.add_geometry(floor_mesh, node_name="floor_base")
            
        # Create individual room floor meshes (Heatmap)
        for i, room in enumerate(floor.rooms):
            room_mesh = create_room_floor_mesh(room)
            if room_mesh:
                scene.add_geometry(room_mesh, node_name=f"room_{i}_{room.type}")

    # Estimate average wall thickness for openings if not uniform
    avg_thickness = sum([w.thickness for w in floor.walls]) / len(floor.walls) if floor.walls else 0.15

    for i, wall in enumerate(floor.walls):
        meshes = create_wall_with_openings(wall, height, floor.doors, floor.windows)
        for j, mesh in enumerate(meshes):
            scene.add_geometry(mesh, node_name=f"wall_{i}_{j}")

    for i, door in enumerate(floor.doors):
        # Use wall thickness for door depth
        mesh = create_door_mesh(door, height, avg_thickness)
        if mesh:
            scene.add_geometry(mesh, node_name=f"door_{i}")

    for i, window in enumerate(floor.windows):
         # Use wall thickness for window depth
        mesh = create_window_mesh(window, height, avg_thickness)
        if mesh:
            scene.add_geometry(mesh, node_name=f"window_{i}")

    if show_roof:
        roof = create_floor_slab(floor.walls, 0.25)
        if roof:
            roof.apply_translation([0, height + 0.25, 0])
            roof.visual.vertex_colors = [139, 115, 85, 255]
            scene.add_geometry(roof, node_name="roof")

    return scene


# ============================================================================
# FASTAPI
# ============================================================================
app = FastAPI(title="ArchCAD Pro Enhanced")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/generated", StaticFiles(directory=str(GENERATED)), name="generated")

uploaded_files = {}
opencv_proc = OpenCVProcessor()
yolo_det = YOLODetector(yolo_model) if yolo_model else None


@app.get("/")
async def root():
    return {
        "service": "ArchCAD Pro Enhanced",
        "version": "3.0",
        "yolo_available": yolo_model is not None,
    }


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    try:
        file_id = uuid.uuid4().hex[:12]
        path = UPLOADS / f"{file_id}_{file.filename}"

        content = await file.read()
        with open(path, "wb") as f:
            f.write(content)

        img = cv2.imread(str(path))
        if img is None:
            path.unlink()
            raise HTTPException(400, "Invalid image")

        h, w = img.shape[:2]
        uploaded_files[file_id] = {
            "path": str(path),
            "filename": file.filename,
            "width": w,
            "height": h,
        }

        return JSONResponse(
            {"file_id": file_id, "filename": file.filename, "width": w, "height": h}
        )
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/process", response_model=BuildingModel)
async def process(
    file_id: str = Form(...),
    wall_height: float = Form(3.0),
    wall_thickness: float = Form(0.15),
    num_floors: int = Form(1),
    pixels_per_meter: float = Form(100),
    use_yolo: bool = Form(True),
    # Support snake_case and camelCase
    wallHeight: float = Form(None),
    wallThickness: float = Form(None),
    numFloors: int = Form(None),
    pixelsPerMeter: float = Form(None),
    useYolo: bool = Form(None),
):
    # Handle both naming conventions
    wall_height = wallHeight if wallHeight is not None else wall_height
    wall_thickness = wallThickness if wallThickness is not None else wall_thickness
    num_floors = numFloors if numFloors is not None else num_floors
    pixels_per_meter = (
        pixelsPerMeter if pixelsPerMeter is not None else pixels_per_meter
    )
    use_yolo = useYolo if useYolo is not None else use_yolo
    if file_id not in uploaded_files:
        raise HTTPException(400, "File not found")

    try:
        img = cv2.imread(uploaded_files[file_id]["path"])
        opencv_proc.ppm = pixels_per_meter
        if yolo_det:
            yolo_det.ppm = pixels_per_meter

        print("\n🧠 Running floorplan segmentation...")
        # OpenCV detection
        walls = opencv_proc.detect_walls(img)
        rooms_cv = opencv_proc.detect_rooms(img)
        binary = opencv_proc.preprocess(img)
        doors_cv, windows_cv = opencv_proc.detect_openings(binary)

        print(f"✅ Found {len(walls)} wall segments")
        print(f"✅ Found {len(rooms_cv)} rooms")

        # YOLO detection
        doors, windows, rooms = doors_cv, windows_cv, rooms_cv
        stairs, columns, furniture, railings = [], [], [], []

        if use_yolo and yolo_det:
            yolo_data = yolo_det.detect(img)
            if yolo_data["doors"]: doors = yolo_data["doors"]
            if yolo_data["windows"]: windows = yolo_data["windows"]
            if yolo_data["rooms"]: rooms = yolo_data["rooms"]
            stairs = yolo_data["stairs"]
            columns = yolo_data["columns"]
            furniture = yolo_data["furniture"]
            railings = yolo_data["railings"]

        # Post-process walls to include segments for frontend & generate IDs
        for i, wall in enumerate(walls):
            wall.id = f"wall_{i}"
            wall.segments = get_wall_segments(wall, wall_height, doors, windows)

        floors = []
        for i in range(num_floors):
            floors.append(
                FloorPlan(
                    level=i,
                    walls=walls,
                    doors=doors,
                    windows=windows,
                    rooms=rooms,
                    furniture=furniture,
                    stairs=stairs,
                    columns=columns,
                    railings=railings,
                    dimensions={},
                )
            )

        return BuildingModel(
            floors=floors,
            wallHeight=wall_height,
            wallThickness=wall_thickness,
            totalFloors=num_floors,
            scaleFactor=1.0,
            detectedScale=True,
            metadata={"yolo_used": use_yolo and yolo_det is not None},
        )

    except Exception as e:
        raise HTTPException(500, f"{str(e)}\n{traceback.format_exc()}")


@app.post("/api/generate-3d")
async def generate_3d(
    file_id: str = Form(...),
    wall_height: float = Form(3.0),
    show_floor: bool = Form(True),
    show_roof: bool = Form(True),
    use_yolo: bool = Form(True),
):
    if file_id not in uploaded_files:
        raise HTTPException(400, "File not found")

    try:
        img = cv2.imread(uploaded_files[file_id]["path"])

        print("\n🧠 Running 3D generation pipeline...")
        opencv_proc.ppm = 100
        walls = opencv_proc.detect_walls(img)
        rooms = opencv_proc.detect_rooms(img)
        binary = opencv_proc.preprocess(img)
        doors, windows = opencv_proc.detect_openings(binary)

        print(f"✅ Geometry ready for 3D export: {len(walls)} walls, {len(rooms)} rooms")

        stairs, columns, furniture, railings = [], [], [], []
        if use_yolo and yolo_det:
            yolo_data = yolo_det.detect(img)
            if yolo_data["doors"]: doors = yolo_data["doors"]
            if yolo_data["windows"]: windows = yolo_data["windows"]
            if yolo_data["rooms"]: rooms = yolo_data["rooms"]
            stairs = yolo_data["stairs"]
            columns = yolo_data["columns"]
            furniture = yolo_data["furniture"]
            railings = yolo_data["railings"]

        # Apply IDs and segments
        for i, wall in enumerate(walls):
            wall.id = f"wall_{i}"
            wall.segments = get_wall_segments(wall, wall_height, doors, windows)

        floor = FloorPlan(
            level=0,
            walls=walls,
            doors=doors,
            windows=windows,
            rooms=rooms,
            furniture=furniture,
            stairs=stairs,
            columns=columns,
            railings=railings,
            dimensions={},
        )

        model = BuildingModel(
            floors=[floor],
            wallHeight=wall_height,
            wallThickness=0.15,
            totalFloors=1,
            scaleFactor=1.0,
            detectedScale=True
        )

        output_name = f"{file_id}_{uuid.uuid4().hex[:8]}.glb"
        output_path = GENERATED / output_name
        
        # Invoke Blender for high-quality production GLB
        success = await run_blender_generation(model, str(output_path))
        
        if not success:
            print("⚠️ Blender generation failed, falling back to trimesh")
            scene = create_3d_scene(floor, wall_height, show_floor, show_roof)
            scene.export(file_type="glb", file_obj=str(output_path))

        print(f"🎉 Pro Scene generated: {output_name}")
        return JSONResponse(
            {
                "glb_url": f"/generated/{output_name}",
                "wall_count": len(walls),
                "door_count": len(doors),
                "window_count": len(windows),
                "room_count": len(rooms),
            }
        )

    except Exception as e:
        raise HTTPException(500, f"{str(e)}\n{traceback.format_exc()}")


@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    if file_id in uploaded_files:
        path = Path(uploaded_files[file_id]["path"])
        if path.exists():
            path.unlink()
        del uploaded_files[file_id]
        return {"status": "deleted"}
    raise HTTPException(404, "File not found")


if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 70)
    print("ArchCAD Pro - Enhanced Hybrid System")
    print("=" * 70)
    print(f"YOLO: {'✓ Available' if yolo_model else '✗ Not available'}")
    print(f"OpenCV: ✓ Available")
    print("=" * 70 + "\n")
    # reload=True is removed because it requires string import, which is failing due to path issues
    uvicorn.run('main2:app', host="0.0.0.0", port=8001, log_level="info",reload=True)
