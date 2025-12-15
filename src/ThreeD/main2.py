# Save this as: backend/main_enhanced.py
# Run with: uvicorn main_enhanced:app --host 0.0.0.0 --port 8001 --reload

import os
import uuid
import io
import traceback
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


# ============================================================================
# MODELS
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
    polygon: Optional[List[List[float]]] = None
    confidence: Optional[float] = 1.0


class FloorPlan(BaseModel):
    level: int
    walls: List[Wall]
    doors: List[Opening]
    windows: List[Opening]
    rooms: List[Room]
    stairs: List[dict] = []
    columns: List[dict] = []
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

    def detect_walls(self, binary: np.ndarray) -> List[Wall]:
        contours, _ = cv2.findContours(
            binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        h, w = binary.shape[:2]
        min_area = (h * w) * 0.01
        filtered = [c for c in contours if cv2.contourArea(c) > min_area]

        walls = []
        for contour in filtered:
            epsilon = 0.01 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)

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

    def detect_rooms(self, binary: np.ndarray) -> List[Room]:
        inverted = cv2.bitwise_not(binary)
        contours, _ = cv2.findContours(
            inverted, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        rooms = []
        room_id = 1

        for contour in contours:
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
                "doors": [],
                "windows": [],
                "rooms": [],
                "stairs": [],
                "columns": [],
            }

        results = self.model(image, conf=conf, verbose=False)[0]
        doors, windows, rooms, stairs, columns = [], [], [], [], []

        for box in results.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            confidence = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = results.names[cls_id].lower()

            w_px, h_px = x2 - x1, y2 - y1
            cx = float((x1 + x2) / 2 / self.ppm)
            cy = float((y1 + y2) / 2 / self.ppm)
            width_m = float(max(w_px, h_px) / self.ppm)
            height_m = float(min(w_px, h_px) / self.ppm)
            rot = 0.0 if w_px > h_px else float(np.pi / 2)

            if "door" in cls_name:
                doors.append(
                    Opening(
                        position=[round(cx, 2), round(cy, 2)],
                        width=round(width_m, 2),
                        height=2.1,
                        rotation=rot,
                        type="door",
                        confidence=confidence,
                    )
                )
            elif "window" in cls_name:
                windows.append(
                    Opening(
                        position=[round(cx, 2), round(cy, 2)],
                        width=round(width_m, 2),
                        height=1.2,
                        rotation=rot,
                        type="window",
                        sillHeight=0.9,
                        confidence=confidence,
                    )
                )
            elif any(
                r in cls_name for r in ["bedroom", "bathroom", "kitchen", "living"]
            ):
                area = float((w_px * h_px) / (self.ppm**2))
                rooms.append(
                    Room(
                        name=cls_name.replace("_", " ").title(),
                        center=[round(cx, 2), round(cy, 2)],
                        type=cls_name,
                        area=round(area, 2),
                        confidence=confidence,
                    )
                )
            elif "stair" in cls_name:
                stairs.append(
                    {
                        "center": [round(cx, 2), round(cy, 2)],
                        "width": round(width_m, 2),
                        "length": round(height_m, 2),
                        "confidence": confidence,
                    }
                )
            elif "column" in cls_name:
                columns.append(
                    {
                        "center": [round(cx, 2), round(cy, 2)],
                        "size": round(max(width_m, height_m), 2),
                        "confidence": confidence,
                    }
                )

        return {
            "doors": doors,
            "windows": windows,
            "rooms": rooms,
            "stairs": stairs,
            "columns": columns,
        }


# ============================================================================
# 3D MESH GENERATION
# ============================================================================
def create_wall_segment(start, end, thickness, height, perpendicular):
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
    vertices[:4, 2] = 0
    vertices[4:] = corners
    vertices[4:, 2] = height

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


def create_wall_with_openings(
    wall: Wall, height: float, doors: List[Opening], windows: List[Opening]
) -> List[trimesh.Trimesh]:
    start = np.array(wall.start + [0])
    end = np.array(wall.end + [0])
    thickness = wall.thickness

    direction = end - start
    length = np.linalg.norm(direction[:2])
    if length < 0.01:
        return []

    direction = direction / np.linalg.norm(direction)
    perpendicular = np.array([-direction[1], direction[0], 0]) * (thickness / 2)

    # Find openings on this wall
    wall_line = LineString([start[:2], end[:2]])
    wall_openings = []

    for opening in doors + windows:
        point = Point(opening.position)
        dist = wall_line.distance(point)
        if dist < thickness:
            # Project onto wall
            t = np.dot(np.array(opening.position + [0]) - start, direction)
            wall_openings.append((t, opening))

    if not wall_openings:
        return [create_wall_segment(start, end, thickness, height, perpendicular)]

    # Sort openings
    wall_openings.sort(key=lambda x: x[0])

    meshes = []
    current_pos = 0

    for t, opening in wall_openings:
        # Segment before opening
        if t > current_pos + 0.1:
            seg_start = start + direction * current_pos
            seg_end = start + direction * (t - opening.width / 2)
            mesh = create_wall_segment(
                seg_start, seg_end, thickness, height, perpendicular
            )
            if mesh:
                meshes.append(mesh)

        # Wall above window
        if opening.type == "window":
            opening_center = start + direction * t
            above_start = opening_center - direction * (opening.width / 2)
            above_end = opening_center + direction * (opening.width / 2)

            corners = np.array(
                [
                    above_start - perpendicular,
                    above_start + perpendicular,
                    above_end + perpendicular,
                    above_end - perpendicular,
                ]
            )

            sill_top = opening.sillHeight + opening.height
            vertices = np.zeros((8, 3))
            vertices[:4] = corners
            vertices[:4, 2] = sill_top
            vertices[4:] = corners
            vertices[4:, 2] = height

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
            meshes.append(mesh)

        current_pos = t + opening.width / 2

    # Final segment
    if current_pos < length - 0.1:
        seg_start = start + direction * current_pos
        mesh = create_wall_segment(seg_start, end, thickness, height, perpendicular)
        if mesh:
            meshes.append(mesh)

    return meshes


def create_door_mesh(opening: Opening, height: float) -> trimesh.Trimesh:
    pos, width, h, rot = (
        opening.position,
        opening.width,
        opening.height,
        opening.rotation,
    )
    hw = width / 2
    vertices = np.array(
        [
            [-hw, 0, 0],
            [hw, 0, 0],
            [hw, 0.05, 0],
            [-hw, 0.05, 0],
            [-hw, 0, h],
            [hw, 0, h],
            [hw, 0.05, h],
            [-hw, 0.05, h],
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


def create_window_mesh(opening: Opening, height: float) -> trimesh.Trimesh:
    pos, width, h, sill, rot = (
        opening.position,
        opening.width,
        opening.height,
        opening.sillHeight,
        opening.rotation,
    )
    hw = width / 2
    vertices = np.array(
        [
            [-hw, 0, sill],
            [hw, 0, sill],
            [hw, 0.03, sill],
            [-hw, 0.03, sill],
            [-hw, 0, sill + h],
            [hw, 0, sill + h],
            [hw, 0.03, sill + h],
            [-hw, 0.03, sill + h],
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
    mesh.visual.vertex_colors = [135, 206, 235, 200]
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


def create_3d_scene(
    floor: FloorPlan, height: float, show_floor: bool, show_roof: bool
) -> trimesh.Scene:
    scene = trimesh.Scene()

    if show_floor:
        floor_mesh = create_floor_slab(floor.walls)
        if floor_mesh:
            scene.add_geometry(floor_mesh, node_name="floor")

    for i, wall in enumerate(floor.walls):
        meshes = create_wall_with_openings(wall, height, floor.doors, floor.windows)
        for j, mesh in enumerate(meshes):
            scene.add_geometry(mesh, node_name=f"wall_{i}_{j}")

    for i, door in enumerate(floor.doors):
        mesh = create_door_mesh(door, height)
        if mesh:
            scene.add_geometry(mesh, node_name=f"door_{i}")

    for i, window in enumerate(floor.windows):
        mesh = create_window_mesh(window, height)
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

        # OpenCV detection
        binary = opencv_proc.preprocess(img)
        walls = opencv_proc.detect_walls(binary)
        rooms_cv = opencv_proc.detect_rooms(binary)
        doors_cv, windows_cv = opencv_proc.detect_openings(binary)

        # YOLO detection
        doors, windows, rooms = doors_cv, windows_cv, rooms_cv
        stairs, columns = [], []

        if use_yolo and yolo_det:
            yolo_data = yolo_det.detect(img)
            if yolo_data["doors"]:
                doors = yolo_data["doors"]
            if yolo_data["windows"]:
                windows = yolo_data["windows"]
            if yolo_data["rooms"]:
                rooms = yolo_data["rooms"]
            stairs = yolo_data["stairs"]
            columns = yolo_data["columns"]

        floors = []
        for i in range(num_floors):
            floors.append(
                FloorPlan(
                    level=i,
                    walls=walls,
                    doors=doors,
                    windows=windows,
                    rooms=rooms,
                    stairs=stairs,
                    columns=columns,
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

        opencv_proc.ppm = 100
        binary = opencv_proc.preprocess(img)
        walls = opencv_proc.detect_walls(binary)
        rooms = opencv_proc.detect_rooms(binary)
        doors, windows = opencv_proc.detect_openings(binary)

        stairs, columns = [], []
        if use_yolo and yolo_det:
            yolo_data = yolo_det.detect(img)
            if yolo_data["doors"]:
                doors = yolo_data["doors"]
            if yolo_data["windows"]:
                windows = yolo_data["windows"]
            stairs = yolo_data["stairs"]
            columns = yolo_data["columns"]

        floor = FloorPlan(
            level=0,
            walls=walls,
            doors=doors,
            windows=windows,
            rooms=rooms,
            stairs=stairs,
            columns=columns,
            dimensions={},
        )

        scene = create_3d_scene(floor, wall_height, show_floor, show_roof)

        output = GENERATED / f"{file_id}_{uuid.uuid4().hex[:8]}.glb"
        glb_data = scene.export(file_type="glb")

        with open(output, "wb") as f:
            f.write(glb_data)

        return JSONResponse(
            {
                "glb_url": f"/generated/{output.name}",
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
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
