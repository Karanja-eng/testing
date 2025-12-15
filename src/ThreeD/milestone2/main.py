# backend/main_hybrid.py
"""
ULTIMATE HYBRID SYSTEM
- YOLO model for door/window/room/stairs/column detection
- Segmentation model for room identification
- OpenCV for clean wall generation (from your original code)
- DXF processing for CAD files
"""
import os
import uuid
import traceback
from pathlib import Path
from typing import List, Tuple, Optional, Dict
import numpy as np
import cv2
import torch
import torch.nn.functional as F
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from shapely.geometry import box, Point, Polygon, MultiPolygon, LineString
from shapely.ops import unary_union
import trimesh
from ultralytics import YOLO

# Try to import optional dependencies
try:
    import ezdxf
    DXF_AVAILABLE = True
except ImportError:
    DXF_AVAILABLE = False
    print("Warning: ezdxf not available")

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    print("Warning: pytesseract not available")

# ============================================================================
# CONFIGURATION
# ============================================================================
BASE_DIR = Path(__file__).parent
CHECKPOINT = BASE_DIR / "model" / "model_best_val_loss_var.pkl"
YOLO_WEIGHTS = BASE_DIR / "best.pt"
GENERATED = BASE_DIR / "generated"
UPLOADS = BASE_DIR / "uploads"
DEBUG_OUTPUT = BASE_DIR / "debug_output"

GENERATED.mkdir(exist_ok=True)
UPLOADS.mkdir(exist_ok=True)
DEBUG_OUTPUT.mkdir(exist_ok=True)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DEFAULT_WALL_THICKNESS = 0.15
MIN_WALL_LENGTH = 0.5

# ============================================================================
# LOAD MODELS
# ============================================================================
print(f"Loading models on {DEVICE}...")

# Load YOLO model
yolo_model = None
if YOLO_WEIGHTS.exists():
    try:
        yolo_model = YOLO(str(YOLO_WEIGHTS))
        yolo_model.to(DEVICE)
        print("✓ YOLO model loaded")
    except Exception as e:
        print(f"Failed to load YOLO: {e}")

# Load Segmentation model
seg_model = None
try:
    from model import get_model
    from utils.loaders import RotateNTurns
    
    MODEL_NAME = "hg_furukawa_original"
    N_CLASSES = 44
    SPLIT = [21, 12, 11]
    
    rot = RotateNTurns()
    seg_model = get_model(MODEL_NAME, 51)
    seg_model.conv4_ = torch.nn.Conv2d(256, N_CLASSES, bias=True, kernel_size=1)
    seg_model.upsample = torch.nn.ConvTranspose2d(N_CLASSES, N_CLASSES, kernel_size=4, stride=4)
    
    if CHECKPOINT.exists():
        checkpoint = torch.load(CHECKPOINT, map_location=DEVICE)
        seg_model.load_state_dict(checkpoint["model_state"])
        seg_model.to(DEVICE)
        seg_model.eval()
        print("✓ Segmentation model loaded")
    else:
        seg_model = None
        print("Segmentation checkpoint not found")
except Exception as e:
    print(f"Failed to load segmentation model: {e}")
    rot = None

# ============================================================================
# PYDANTIC MODELS
# ============================================================================
class Wall(BaseModel):
    start: List[float]
    end: List[float]
    thickness: float
    length: float

class Opening(BaseModel):
    position: List[float]
    width: float
    height: float
    rotation: float
    type: str
    sillHeight: Optional[float] = 0.9
    confidence: Optional[float] = 1.0

class Room(BaseModel):
    name: str
    center: List[float]
    type: str
    area: float
    confidence: Optional[float] = 1.0

class FloorPlan(BaseModel):
    level: int
    walls: List[Wall]
    doors: List[Opening]
    windows: List[Opening]
    rooms: List[Room]
    stairs: List[dict] = []
    columns: List[dict] = []
    dimensions: dict

class BuildingModel(BaseModel):
    floors: List[FloorPlan]
    wallHeight: float
    wallThickness: float
    totalFloors: int
    scaleFactor: float
    detectedScale: bool
    metadata: dict = {}

# ============================================================================
# OPENCV WALL DETECTION (YOUR CLEAN METHOD)
# ============================================================================
class OpenCVWallDetector:
    """Clean wall detection using OpenCV edge detection and Hough Transform"""
    
    def __init__(self, pixels_per_meter: float = 100):
        self.ppm = pixels_per_meter
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Enhanced preprocessing for floor plans"""
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        
        # Enhance contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        
        # Adaptive threshold
        binary = cv2.adaptiveThreshold(
            enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        return binary
    
    def detect_walls(self, binary_image: np.ndarray) -> List[Wall]:
        """Detect walls using Hough Line Transform"""
        # Morphological operations
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        dilated = cv2.dilate(binary_image, kernel, iterations=1)
        
        # Edge detection
        edges = cv2.Canny(dilated, 50, 150, apertureSize=3)
        
        # Hough Line Transform
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi/180,
            threshold=100,
            minLineLength=50,
            maxLineGap=10
        )
        
        if lines is None:
            return []
        
        # Merge parallel lines
        merged_lines = self._merge_parallel_lines(lines)
        
        walls = []
        for line in merged_lines:
            x1, y1, x2, y2 = line
            
            start = [float(x1 / self.ppm), float(y1 / self.ppm)]
            end = [float(x2 / self.ppm), float(y2 / self.ppm)]
            length = float(np.sqrt((x2-x1)**2 + (y2-y1)**2) / self.ppm)
            
            if length > MIN_WALL_LENGTH:
                walls.append(Wall(
                    start=start,
                    end=end,
                    thickness=DEFAULT_WALL_THICKNESS,
                    length=round(length, 2)
                ))
        
        return walls
    
    def _merge_parallel_lines(self, lines: np.ndarray, 
                              angle_threshold: float = 5,
                              distance_threshold: float = 20) -> List[np.ndarray]:
        """Merge parallel and collinear lines"""
        if len(lines) == 0:
            return []
        
        lines = lines.reshape(-1, 4)
        merged = []
        used = set()
        
        for i, line1 in enumerate(lines):
            if i in used:
                continue
            
            x1, y1, x2, y2 = line1
            angle1 = np.arctan2(y2 - y1, x2 - x1)
            
            similar = [line1]
            for j, line2 in enumerate(lines[i+1:], i+1):
                if j in used:
                    continue
                
                x3, y3, x4, y4 = line2
                angle2 = np.arctan2(y4 - y3, x4 - x3)
                
                angle_diff = abs(angle1 - angle2) * 180 / np.pi
                if angle_diff > angle_threshold and angle_diff < (180 - angle_threshold):
                    continue
                
                if (np.sqrt((x1-x3)**2 + (y1-y3)**2) < distance_threshold or
                    np.sqrt((x2-x4)**2 + (y2-y4)**2) < distance_threshold):
                    similar.append(line2)
                    used.add(j)
            
            if len(similar) > 1:
                all_points = np.array([[x, y] for line in similar 
                                      for x, y in [(line[0], line[1]), (line[2], line[3])]])
                
                if abs(angle1) < np.pi/4:
                    min_idx = np.argmin(all_points[:, 0])
                    max_idx = np.argmax(all_points[:, 0])
                else:
                    min_idx = np.argmin(all_points[:, 1])
                    max_idx = np.argmax(all_points[:, 1])
                
                merged_line = np.array([
                    all_points[min_idx, 0], all_points[min_idx, 1],
                    all_points[max_idx, 0], all_points[max_idx, 1]
                ])
                merged.append(merged_line)
            else:
                merged.append(line1)
        
        return merged

# ============================================================================
# YOLO DETECTOR
# ============================================================================
class YOLODetector:
    """Detect doors, windows, rooms, stairs, columns using YOLO"""
    
    def __init__(self, model, pixels_per_meter: float = 100):
        self.model = model
        self.ppm = pixels_per_meter
        
        # YOLO class mapping (adjust based on your model)
        self.class_map = {
            'door': ['door', 'door_frame'],
            'window': ['window'],
            'room': ['bedroom', 'bathroom', 'kitchen', 'living_room', 'dining_room'],
            'stairs': ['stairs', 'staircase'],
            'column': ['column', 'pillar']
        }
    
    def detect(self, image: np.ndarray) -> Dict:
        """Run YOLO detection"""
        if self.model is None:
            return {'doors': [], 'windows': [], 'rooms': [], 'stairs': [], 'columns': []}
        
        results = self.model(image, verbose=False)[0]
        
        doors = []
        windows = []
        rooms = []
        stairs = []
        columns = []
        
        for box_data in results.boxes:
            # Get box coordinates
            x1, y1, x2, y2 = box_data.xyxy[0].cpu().numpy()
            conf = float(box_data.conf[0])
            cls_id = int(box_data.cls[0])
            
            # Get class name
            cls_name = results.names[cls_id].lower()
            
            # Calculate properties
            width_px = x2 - x1
            height_px = y2 - y1
            center_x = float((x1 + x2) / 2 / self.ppm)
            center_y = float((y1 + y2) / 2 / self.ppm)
            width_m = float(max(width_px, height_px) / self.ppm)
            height_m = float(min(width_px, height_px) / self.ppm)
            rotation = 0.0 if width_px > height_px else float(np.pi/2)
            
            # Classify detection
            if any(door_cls in cls_name for door_cls in self.class_map['door']):
                doors.append(Opening(
                    position=[center_x, center_y],
                    width=round(width_m, 2),
                    height=2.1,
                    rotation=rotation,
                    type='door',
                    confidence=conf
                ))
            
            elif any(win_cls in cls_name for win_cls in self.class_map['window']):
                windows.append(Opening(
                    position=[center_x, center_y],
                    width=round(width_m, 2),
                    height=1.2,
                    rotation=rotation,
                    type='window',
                    sillHeight=0.9,
                    confidence=conf
                ))
            
            elif any(room_cls in cls_name for room_cls in self.class_map['room']):
                area = float((width_px * height_px) / (self.ppm ** 2))
                rooms.append(Room(
                    name=cls_name.replace('_', ' ').title(),
                    center=[center_x, center_y],
                    type=cls_name,
                    area=round(area, 2),
                    confidence=conf
                ))
            
            elif any(stair_cls in cls_name for stair_cls in self.class_map['stairs']):
                stairs.append({
                    'center': [center_x, center_y],
                    'width': round(width_m, 2),
                    'length': round(height_m, 2),
                    'confidence': conf
                })
            
            elif any(col_cls in cls_name for col_cls in self.class_map['column']):
                columns.append({
                    'center': [center_x, center_y],
                    'size': round(max(width_m, height_m), 2),
                    'confidence': conf
                })
        
        return {
            'doors': doors,
            'windows': windows,
            'rooms': rooms,
            'stairs': stairs,
            'columns': columns
        }

# ============================================================================
# SEGMENTATION MODEL PROCESSOR
# ============================================================================
class SegmentationProcessor:
    """Process Furukawa segmentation model for room identification"""
    
    def __init__(self, model, rot_helper, pixels_per_meter: float = 100):
        self.model = model
        self.rot = rot_helper
        self.ppm = pixels_per_meter
        self.n_classes = 44
        self.split = [21, 12, 11]
    
    def run_model(self, img_tensor: torch.Tensor, height: int, width: int) -> torch.Tensor:
        """Run segmentation with rotation augmentation"""
        rotations = [(0, 0), (1, -1), (2, 2), (-1, 1)]
        pred_stack = torch.zeros([len(rotations), self.n_classes, height, width], device=DEVICE)
        
        with torch.no_grad():
            for i, (forward, back) in enumerate(rotations):
                rot_img = self.rot(img_tensor, "tensor", forward)
                pred = self.model(rot_img)
                pred = self.rot(pred, "tensor", back)
                pred = self.rot(pred, "points", back)
                pred = F.interpolate(pred, size=(height, width), mode="bilinear", align_corners=True)
                pred_stack[i] = pred[0]
            
            prediction = torch.mean(pred_stack, dim=0, keepdim=True).cpu()
        
        return prediction.squeeze(0)
    
    def extract_rooms(self, prediction: torch.Tensor) -> List[Room]:
        """Extract room polygons from segmentation"""
        rooms_tensor = prediction[self.split[0]:self.split[0]+self.split[1]]
        
        rooms = []
        room_types = ['living', 'bedroom', 'bathroom', 'kitchen', 'dining', 
                     'corridor', 'balcony', 'closet', 'laundry', 'office', 'storage']
        
        for i, room_type in enumerate(room_types[:rooms_tensor.shape[0]]):
            room_mask = (rooms_tensor[i].numpy() > 0.5).astype(np.uint8)
            
            if room_mask.sum() < 100:
                continue
            
            # Find contours
            contours, _ = cv2.findContours(room_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for cnt in contours:
                area_px = cv2.contourArea(cnt)
                if area_px < 500:
                    continue
                
                M = cv2.moments(cnt)
                if M['m00'] == 0:
                    continue
                
                cx = float(int(M['m10'] / M['m00']) / self.ppm)
                cy = float(int(M['m01'] / M['m00']) / self.ppm)
                area_m2 = float(area_px / (self.ppm ** 2))
                
                rooms.append(Room(
                    name=room_type.replace('_', ' ').title(),
                    center=[round(cx, 2), round(cy, 2)],
                    type=room_type,
                    area=round(area_m2, 2),
                    confidence=float(rooms_tensor[i].max())
                ))
        
        return rooms

# ============================================================================
# DXF PROCESSOR (for CAD files)
# ============================================================================
class DXFProcessor:
    """Process DXF files"""
    
    def parse_dxf(self, file_content: bytes) -> BuildingModel:
        """Parse DXF and extract geometry"""
        if not DXF_AVAILABLE:
            raise HTTPException(400, "DXF processing not available. Install ezdxf")
        
        doc = ezdxf.read(io.BytesIO(file_content))
        modelspace = doc.modelspace()
        
        walls = []
        doors = []
        windows = []
        
        # Extract lines (walls)
        for entity in modelspace.query('LINE'):
            start = entity.dxf.start
            end = entity.dxf.end
            
            wall = Wall(
                start=[float(start.x / 1000), float(start.y / 1000)],
                end=[float(end.x / 1000), float(end.y / 1000)],
                thickness=0.3,
                length=round(float(np.sqrt((end.x - start.x)**2 + (end.y - start.y)**2) / 1000), 2)
            )
            walls.append(wall)
        
        # Create floor plan
        floor = FloorPlan(
            level=0,
            walls=walls,
            doors=doors,
            windows=windows,
            rooms=[],
            dimensions={}
        )
        
        building = BuildingModel(
            floors=[floor],
            wallHeight=3.0,
            wallThickness=0.3,
            totalFloors=1,
            scaleFactor=1.0,
            detectedScale=False
        )
        
        return building

# ============================================================================
# 3D MESH GENERATION
# ============================================================================
def create_floor_mesh(walls: List[Wall], bounds: dict, thickness: float = 0.25) -> trimesh.Trimesh:
    """Create floor slab matching building outline"""
    # Get all wall points
    all_points = []
    for wall in walls:
        all_points.append(wall.start)
        all_points.append(wall.end)
    
    if not all_points:
        return None
    
    all_points = np.array(all_points)
    
    # Create convex hull for floor shape
    from scipy.spatial import ConvexHull
    try:
        hull = ConvexHull(all_points)
        hull_points = all_points[hull.vertices]
        
        # Create 3D vertices
        n = len(hull_points)
        vertices = np.zeros((n * 2, 3))
        vertices[:n, :2] = hull_points
        vertices[:n, 2] = -thickness
        vertices[n:, :2] = hull_points
        vertices[n:, 2] = 0
        
        # Create faces
        faces = []
        faces.append(list(range(n-1, -1, -1)))  # Bottom
        faces.append(list(range(n, 2*n)))  # Top
        
        for i in range(n):
            next_i = (i + 1) % n
            faces.append([i, next_i, n + next_i])
            faces.append([i, n + next_i, n + i])
        
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        mesh.visual.vertex_colors = [180, 180, 180, 255]
        return mesh
    except:
        return None

def create_roof_mesh(walls: List[Wall], bounds: dict, wall_height: float, thickness: float = 0.25) -> trimesh.Trimesh:
    """Create roof slab"""
    floor_mesh = create_floor_mesh(walls, bounds, thickness)
    if floor_mesh is None:
        return None
    
    # Translate to roof height
    floor_mesh.apply_translation([0, wall_height + thickness, 0])
    floor_mesh.visual.vertex_colors = [139, 115, 85, 255]  # Brown roof
    return floor_mesh

def create_wall_mesh(wall: Wall, wall_height: float) -> trimesh.Trimesh:
    """Create 3D mesh for a single wall"""
    start = np.array(wall.start)
    end = np.array(wall.end)
    thickness = wall.thickness
    
    # Calculate perpendicular direction
    direction = end - start
    length = np.linalg.norm(direction)
    if length < 0.01:
        return None
    
    direction = direction / length
    perpendicular = np.array([-direction[1], direction[0]]) * (thickness / 2)
    
    # Create 4 corners
    corners = np.array([
        start - perpendicular,
        start + perpendicular,
        end + perpendicular,
        end - perpendicular
    ])
    
    # Create 3D vertices
    vertices = np.zeros((8, 3))
    vertices[:4, :2] = corners
    vertices[:4, 2] = 0
    vertices[4:, :2] = corners
    vertices[4:, 2] = wall_height
    
    # Create faces
    faces = [
        [3, 2, 1, 0],  # Bottom
        [4, 5, 6, 7],  # Top
        [0, 1, 5, 4],  # Side 1
        [1, 2, 6, 5],  # Front
        [2, 3, 7, 6],  # Side 2
        [3, 0, 4, 7],  # Back
    ]
    
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual.vertex_colors = [200, 200, 200, 255]
    return mesh

def create_door_mesh(opening: Opening, wall_height: float) -> trimesh.Trimesh:
    """Create door mesh"""
    pos = opening.position
    width = opening.width
    height = opening.height
    rot = opening.rotation
    
    # Create door rectangle
    hw = width / 2
    vertices = np.array([
        [-hw, 0, 0],
        [hw, 0, 0],
        [hw, 0.05, 0],
        [-hw, 0.05, 0],
        [-hw, 0, height],
        [hw, 0, height],
        [hw, 0.05, height],
        [-hw, 0.05, height]
    ])
    
    # Rotate
    cos_r = np.cos(rot)
    sin_r = np.sin(rot)
    rot_matrix = np.array([[cos_r, -sin_r, 0], [sin_r, cos_r, 0], [0, 0, 1]])
    vertices = vertices @ rot_matrix.T
    
    # Translate
    vertices[:, 0] += pos[0]
    vertices[:, 1] += pos[1]
    
    faces = [
        [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
        [3, 2, 1, 0], [4, 5, 6, 7]
    ]
    
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual.vertex_colors = [139, 69, 19, 255]
    return mesh

def create_window_mesh(opening: Opening, wall_height: float) -> trimesh.Trimesh:
    """Create window mesh"""
    pos = opening.position
    width = opening.width
    height = opening.height
    sill = opening.sillHeight
    rot = opening.rotation
    
    hw = width / 2
    vertices = np.array([
        [-hw, 0, sill],
        [hw, 0, sill],
        [hw, 0.03, sill],
        [-hw, 0.03, sill],
        [-hw, 0, sill + height],
        [hw, 0, sill + height],
        [hw, 0.03, sill + height],
        [-hw, 0.03, sill + height]
    ])
    
    cos_r = np.cos(rot)
    sin_r = np.sin(rot)
    rot_matrix = np.array([[cos_r, -sin_r, 0], [sin_r, cos_r, 0], [0, 0, 1]])
    vertices = vertices @ rot_matrix.T
    
    vertices[:, 0] += pos[0]
    vertices[:, 1] += pos[1]
    
    faces = [
        [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
        [3, 2, 1, 0], [4, 5, 6, 7]
    ]
    
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual.vertex_colors = [135, 206, 235, 200]
    return mesh

def create_complete_3d_model(floor_plan: FloorPlan, wall_height: float, 
                            show_floor: bool = True, show_roof: bool = True) -> trimesh.Scene:
    """Create complete 3D scene"""
    scene = trimesh.Scene()
    
    # Calculate bounds
    bounds = {
        'minX': float('inf'), 'maxX': float('-inf'),
        'minY': float('inf'), 'maxY': float('-inf')
    }
    
    for wall in floor_plan.walls:
        bounds['minX'] = min(bounds['minX'], wall.start[0], wall.end[0])
        bounds['maxX'] = max(bounds['maxX'], wall.start[0], wall.end[0])
        bounds['minY'] = min(bounds['minY'], wall.start[1], wall.end[1])
        bounds['maxY'] = max(bounds['maxY'], wall.start[1], wall.end[1])
    
    # Add floor slab
    if show_floor:
        floor_mesh = create_floor_mesh(floor_plan.walls, bounds)
        if floor_mesh:
            scene.add_geometry(floor_mesh, node_name="floor")
    
    # Add walls
    for i, wall in enumerate(floor_plan.walls):
        mesh = create_wall_mesh(wall, wall_height)
        if mesh:
            scene.add_geometry(mesh, node_name=f"wall_{i}")
    
    # Add doors
    for i, door in enumerate(floor_plan.doors):
        mesh = create_door_mesh(door, wall_height)
        if mesh:
            scene.add_geometry(mesh, node_name=f"door_{i}")
    
    # Add windows
    for i, window in enumerate(floor_plan.windows):
        mesh = create_window_mesh(window, wall_height)
        if mesh:
            scene.add_geometry(mesh, node_name=f"window_{i}")
    
    # Add roof slab
    if show_roof:
        roof_mesh = create_roof_mesh(floor_plan.walls, bounds, wall_height)
        if roof_mesh:
            scene.add_geometry(roof_mesh, node_name="roof")
    
    return scene

# ============================================================================
# FASTAPI APPLICATION
# ============================================================================
app = FastAPI(title="ArchCAD Pro - Hybrid System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/generated", StaticFiles(directory=str(GENERATED)), name="generated")

# Global storage
uploaded_files = {}

# Initialize processors
opencv_detector = OpenCVWallDetector()
yolo_detector = YOLODetector(yolo_model) if yolo_model else None
seg_processor = SegmentationProcessor(seg_model, rot) if seg_model and rot else None
dxf_processor = DXFProcessor()

# ============================================================================
# API ENDPOINTS
# ============================================================================
@app.get("/")
async def root():
    return {
        "service": "ArchCAD Pro - Hybrid System",
        "version": "2.0.0",
        "models": {
            "yolo": yolo_model is not None,
            "segmentation": seg_model is not None,
            "opencv": True,
            "dxf": DXF_AVAILABLE
        },
        "device": str(DEVICE)
    }

@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "yolo_available": yolo_model is not None,
        "segmentation_available": seg_model is not None,
        "dxf_available": DXF_AVAILABLE,
        "tesseract_available": TESSERACT_AVAILABLE,
        "device": str(DEVICE)
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload floor plan image"""
    try:
        file_id = uuid.uuid4().hex
        upload_path = UPLOADS / f"{file_id}_{file.filename}"
        
        content = await file.read()
        if not content:
            raise HTTPException(400, "Empty file")
        
        with open(upload_path, "wb") as f:
            f.write(content)
        
        # Verify image
        test = cv2.imread(str(upload_path))
        if test is None or test.size == 0:
            upload_path.unlink()
            raise HTTPException(400, "Invalid image file")
        
        h, w = test.shape[:2]
        
        uploaded_files[file_id] = {
            "path": str(upload_path),
            "filename": file.filename,
            "width": w,
            "height": h
        }
        
        print(f"✓ Uploaded: {file.filename} ({w}x{h}) -> ID: {file_id}")
        
        return JSONResponse({
            "file_id": file_id,
            "filename": file.filename,
            "width": w,
            "height": h
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

@app.post("/api/process-image-hybrid", response_model=BuildingModel)
async def process_image_hybrid(
    file_id: str = Form(None),
    file: UploadFile = File(None),
    wall_height: float = Form(3.0),
    wall_thickness: float = Form(0.3),
    num_floors: int = Form(1),
    use_yolo: bool = Form(True),
    use_segmentation: bool = Form(True),
    pixels_per_meter: float = Form(100)
):
    """
    HYBRID PROCESSING: Combines all methods
    1. OpenCV for clean walls
    2. YOLO for door/window/room/stairs/column detection
    3. Segmentation model for room identification
    """
    
    # Get image path
    if file_id and file_id in uploaded_files:
        img_path = uploaded_files[file_id]["path"]
    elif file:
        # Handle direct upload
        content = await file.read()
        temp_path = UPLOADS / f"temp_{uuid.uuid4().hex}.png"
        with open(temp_path, "wb") as f:
            f.write(content)
        img_path = str(temp_path)
    else:
        raise HTTPException(400, "Provide file_id or file")
    
    try:
        print(f"\n{'='*70}")
        print(f"HYBRID PROCESSING PIPELINE")
        print(f"Image: {img_path}")
        print(f"YOLO: {use_yolo}, Segmentation: {use_segmentation}")
        print(f"{'='*70}\n")
        
        # Load image
        img = cv2.imread(str(img_path))
        if img is None:
            raise HTTPException(400, "Failed to load image")
        
        h, w = img.shape[:2]
        print(f"✓ Image loaded: {w}x{h}")
        
        # Update detector scale
        opencv_detector.ppm = pixels_per_meter
        if yolo_detector:
            yolo_detector.ppm = pixels_per_meter
        if seg_processor:
            seg_processor.ppm = pixels_per_meter
        
        # STEP 1: OpenCV Wall Detection (ALWAYS USE - YOUR CLEAN METHOD)
        print("\n[STEP 1] OpenCV Wall Detection")
        binary = opencv_detector.preprocess_image(img)
        walls = opencv_detector.detect_walls(binary)
        print(f"✓ Detected {len(walls)} walls using OpenCV")
        
        # Save debug image
        cv2.imwrite(str(DEBUG_OUTPUT / "opencv_walls.png"), binary)
        
        # STEP 2: YOLO Detection (doors, windows, rooms, stairs, columns)
        doors = []
        windows = []
        yolo_rooms = []
        stairs = []
        columns = []
        
        if use_yolo and yolo_detector:
            print("\n[STEP 2] YOLO Detection")
            detections = yolo_detector.detect(img)
            doors = detections['doors']
            windows = detections['windows']
            yolo_rooms = detections['rooms']
            stairs = detections['stairs']
            columns = detections['columns']
            
            print(f"✓ YOLO detected:")
            print(f"  - Doors: {len(doors)}")
            print(f"  - Windows: {len(windows)}")
            print(f"  - Rooms: {len(yolo_rooms)}")
            print(f"  - Stairs: {len(stairs)}")
            print(f"  - Columns: {len(columns)}")
        
        # STEP 3: Segmentation Model (room identification)
        seg_rooms = []
        if use_segmentation and seg_processor:
            print("\n[STEP 3] Segmentation Model")
            
            # Prepare input
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img_input = 2 * (img_rgb.astype(np.float32) / 255.0) - 1
            img_input = np.moveaxis(img_input, -1, 0)
            img_tensor = torch.from_numpy(img_input).unsqueeze(0).float().to(DEVICE)
            
            # Run model
            size_check = np.array([h, w]) % 2
            height = h - size_check[0]
            width = w - size_check[1]
            
            prediction = seg_processor.run_model(img_tensor, height, width)
            seg_rooms = seg_processor.extract_rooms(prediction)
            
            print(f"✓ Segmentation identified {len(seg_rooms)} rooms")
        
        # STEP 4: Merge room detections (prefer YOLO, fallback to segmentation)
        final_rooms = []
        
        if yolo_rooms:
            final_rooms = yolo_rooms
            print(f"\n[MERGE] Using {len(yolo_rooms)} YOLO rooms")
        elif seg_rooms:
            final_rooms = seg_rooms
            print(f"\n[MERGE] Using {len(seg_rooms)} segmentation rooms")
        else:
            # Fallback: Simple room detection from walls
            print("\n[MERGE] No rooms detected, creating default room")
            if walls:
                # Calculate center from walls
                all_x = [p for w in walls for p in [w.start[0], w.end[0]]]
                all_y = [p for w in walls for p in [w.start[1], w.end[1]]]
                center_x = (min(all_x) + max(all_x)) / 2
                center_y = (min(all_y) + max(all_y)) / 2
                area = (max(all_x) - min(all_x)) * (max(all_y) - min(all_y))
                
                final_rooms.append(Room(
                    name="Room",
                    center=[round(center_x, 2), round(center_y, 2)],
                    type="room",
                    area=round(area, 2),
                    confidence=0.5
                ))
        
        # STEP 5: Create floor plan
        print("\n[BUILD] Creating floor plan structure")
        
        floors = []
        for floor_num in range(num_floors):
            floor = FloorPlan(
                level=floor_num,
                walls=walls,
                doors=doors,
                windows=windows,
                rooms=final_rooms,
                stairs=stairs,
                columns=columns,
                dimensions={}
            )
            floors.append(floor)
        
        # STEP 6: Build model
        building = BuildingModel(
            floors=floors,
            wallHeight=wall_height,
            wallThickness=wall_thickness,
            totalFloors=num_floors,
            scaleFactor=1.0,
            detectedScale=True,
            metadata={
                'used_yolo': use_yolo and yolo_detector is not None,
                'used_segmentation': use_segmentation and seg_processor is not None,
                'opencv_walls': len(walls),
                'total_detections': len(doors) + len(windows) + len(final_rooms) + len(stairs) + len(columns)
            }
        )
        
        print(f"\n{'='*70}")
        print(f"✓ HYBRID PIPELINE COMPLETE")
        print(f"  Walls: {len(walls)}")
        print(f"  Doors: {len(doors)}")
        print(f"  Windows: {len(windows)}")
        print(f"  Rooms: {len(final_rooms)}")
        print(f"  Stairs: {len(stairs)}")
        print(f"  Columns: {len(columns)}")
        print(f"{'='*70}\n")
        
        return building
    
    except HTTPException:
        raise
    except Exception as e:
        error_detail = f"Processing failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(500, error_detail)

@app.post("/api/process-dxf", response_model=BuildingModel)
async def process_dxf_file(
    file: UploadFile = File(...),
    wall_height: float = Form(3.0),
    num_floors: int = Form(1)
):
    """Process DXF CAD file (no AI models, pure geometry)"""
    
    if not file.filename.lower().endswith(('.dxf', '.dwg')):
        raise HTTPException(400, "File must be DXF or DWG")
    
    try:
        contents = await file.read()
        building = dxf_processor.parse_dxf(contents)
        building.wallHeight = wall_height
        building.totalFloors = num_floors
        
        # Duplicate floors if multi-story
        if num_floors > 1:
            base_floor = building.floors[0]
            for floor_num in range(1, num_floors):
                new_floor = FloorPlan(
                    level=floor_num,
                    walls=base_floor.walls,
                    doors=base_floor.doors,
                    windows=base_floor.windows,
                    rooms=base_floor.rooms,
                    dimensions=base_floor.dimensions
                )
                building.floors.append(new_floor)
        
        return building
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"DXF processing failed: {str(e)}")

@app.post("/api/generate-3d")
async def generate_3d_model(
    file_id: str = Form(...),
    wall_height: float = Form(3.0),
    show_floor: bool = Form(True),
    show_roof: bool = Form(True),
    use_yolo: bool = Form(True),
    use_segmentation: bool = Form(True)
):
    """
    Generate GLB 3D model from processed data
    """
    
    if file_id not in uploaded_files:
        raise HTTPException(400, "File not found. Upload first.")
    
    try:
        # Process image first
        img_path = uploaded_files[file_id]["path"]
        img = cv2.imread(img_path)
        
        # Run hybrid processing
        opencv_detector.ppm = 100
        binary = opencv_detector.preprocess_image(img)
        walls = opencv_detector.detect_walls(binary)
        
        doors = []
        windows = []
        rooms = []
        stairs = []
        columns = []
        
        if use_yolo and yolo_detector:
            detections = yolo_detector.detect(img)
            doors = detections['doors']
            windows = detections['windows']
            rooms = detections['rooms']
            stairs = detections['stairs']
            columns = detections['columns']
        
        # Create floor plan
        floor = FloorPlan(
            level=0,
            walls=walls,
            doors=doors,
            windows=windows,
            rooms=rooms,
            stairs=stairs,
            columns=columns,
            dimensions={}
        )
        
        # Generate 3D scene
        scene = create_complete_3d_model(floor, wall_height, show_floor, show_roof)
        
        # Export to GLB
        output_glb = GENERATED / f"{file_id}_{uuid.uuid4().hex[:8]}.glb"
        glb_data = scene.export(file_type='glb')
        
        with open(output_glb, 'wb') as f:
            f.write(glb_data)
        
        url = f"/generated/{output_glb.name}"
        
        return JSONResponse({
            "glb_url": url,
            "wall_count": len(walls),
            "door_count": len(doors),
            "window_count": len(windows),
            "room_count": len(rooms),
            "stairs_count": len(stairs),
            "column_count": len(columns)
        })
    
    except Exception as e:
        error_detail = f"3D generation failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(500, error_detail)

@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    """Delete uploaded file"""
    if file_id in uploaded_files:
        file_info = uploaded_files[file_id]
        path = Path(file_info["path"])
        if path.exists():
            path.unlink()
        del uploaded_files[file_id]
        return {"status": "deleted"}
    raise HTTPException(404, "File not found")

# ============================================================================
# RUN SERVER
# ============================================================================
if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "=" * 70)
    print("ARCHCAD PRO - HYBRID SYSTEM")
    print("=" * 70)
    print(f"Device: {DEVICE}")
    print(f"YOLO Model: {'✓ Loaded' if yolo_model else '✗ Not available'}")
    print(f"Segmentation Model: {'✓ Loaded' if seg_model else '✗ Not available'}")
    print(f"OpenCV: ✓ Always available")
    print(f"DXF Support: {'✓ Available' if DXF_AVAILABLE else '✗ Install ezdxf'}")
    print("=" * 70)
    print("\nStarting server on http://0.0.0.0:8001")
    print("API Documentation: http://0.0.0.0:8001/docs")
    print("=" * 70 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")