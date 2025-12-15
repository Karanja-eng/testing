# backend/main.py
"""
ArchCAD Pro 3D - Complete FastAPI Backend
Standalone file with all dependencies included
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Tuple, Dict
import cv2
import numpy as np
import io
import base64
from PIL import Image
import re
import json

# Try to import optional dependencies
try:
    import pytesseract

    pytesseract.pytesseract.tesseract_cmd = (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

try:
    import ezdxf

    DXF_AVAILABLE = True
except ImportError:
    DXF_AVAILABLE = False
    print("Warning: ezdxf not available. DXF processing will be disabled.")

# ============================================================================
# PYDANTIC MODELS (Data Structures)
# ============================================================================


class Point(BaseModel):
    x: float
    y: float


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
    type: str  # 'door' or 'window'
    sillHeight: Optional[float] = 0.9


class Room(BaseModel):
    name: str
    center: List[float]
    type: str
    area: float


class FloorPlan(BaseModel):
    level: int
    walls: List[Wall]
    doors: List[Opening]
    windows: List[Opening]
    rooms: List[Room]
    dimensions: dict


class BuildingModel(BaseModel):
    floors: List[FloorPlan]
    wallHeight: float
    wallThickness: float
    totalFloors: int
    scaleFactor: float
    detectedScale: bool


# ============================================================================
# IMAGE PROCESSOR CLASS
# ============================================================================


class ImageProcessor:
    """Process floor plan images using OpenCV"""

    def __init__(self):
        self.scale_factor = 1.0
        self.pixels_per_meter = 100  # Default: 100 pixels = 1 meter

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for better edge detection"""
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # Apply bilateral filter to reduce noise while keeping edges sharp
        filtered = cv2.bilateralFilter(gray, 9, 75, 75)

        # Apply adaptive thresholding
        binary = cv2.adaptiveThreshold(
            filtered, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )

        return binary

    def detect_walls(self, binary_image: np.ndarray) -> List[Wall]:
        """Detect walls using Hough Line Transform"""
        # Apply morphological operations to connect wall segments
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        dilated = cv2.dilate(binary_image, kernel, iterations=1)

        # Detect edges
        edges = cv2.Canny(dilated, 50, 150, apertureSize=3)

        # Detect lines using Probabilistic Hough Transform
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=100,
            minLineLength=50,
            maxLineGap=10,
        )

        walls = []
        if lines is not None:
            # Merge parallel lines
            merged_lines = self._merge_parallel_lines(lines)

            for line in merged_lines:
                x1, y1, x2, y2 = line

                # Default wall thickness
                thickness = 0.3

                # Convert pixel coordinates to meters
                start = [
                    float(x1 / self.pixels_per_meter),
                    float(y1 / self.pixels_per_meter),
                ]
                end = [
                    float(x2 / self.pixels_per_meter),
                    float(y2 / self.pixels_per_meter),
                ]

                length = float(
                    np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) / self.pixels_per_meter
                )

                # Only add walls longer than 0.5m
                if length > 0.5:
                    walls.append(
                        Wall(
                            start=start,
                            end=end,
                            thickness=thickness,
                            length=round(length, 2),
                        )
                    )

        return walls

    def _merge_parallel_lines(
        self,
        lines: np.ndarray,
        angle_threshold: float = 5,
        distance_threshold: float = 20,
    ) -> List[np.ndarray]:
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
            for j, line2 in enumerate(lines[i + 1 :], i + 1):
                if j in used:
                    continue

                x3, y3, x4, y4 = line2
                angle2 = np.arctan2(y4 - y3, x4 - x3)

                angle_diff = abs(angle1 - angle2) * 180 / np.pi
                if angle_diff > angle_threshold and angle_diff < (
                    180 - angle_threshold
                ):
                    continue

                if (
                    np.sqrt((x1 - x3) ** 2 + (y1 - y3) ** 2) < distance_threshold
                    or np.sqrt((x2 - x4) ** 2 + (y2 - y4) ** 2) < distance_threshold
                ):
                    similar.append(line2)
                    used.add(j)

            if len(similar) > 1:
                all_points = np.array(
                    [
                        [x, y]
                        for line in similar
                        for x, y in [(line[0], line[1]), (line[2], line[3])]
                    ]
                )

                if abs(angle1) < np.pi / 4:
                    min_idx = np.argmin(all_points[:, 0])
                    max_idx = np.argmax(all_points[:, 0])
                else:
                    min_idx = np.argmin(all_points[:, 1])
                    max_idx = np.argmax(all_points[:, 1])

                merged_line = np.array(
                    [
                        all_points[min_idx, 0],
                        all_points[min_idx, 1],
                        all_points[max_idx, 0],
                        all_points[max_idx, 1],
                    ]
                )
                merged.append(merged_line)
            else:
                merged.append(line1)

        return merged

    def detect_openings(
        self, binary_image: np.ndarray, walls: List[Wall]
    ) -> Tuple[List[Opening], List[Opening]]:
        """Detect doors and windows"""
        doors = []
        windows = []

        # Invert image to find openings (white gaps in walls)
        inverted = cv2.bitwise_not(binary_image)

        # Find contours
        contours, _ = cv2.findContours(
            inverted, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        for contour in contours:
            area = cv2.contourArea(contour)

            # Filter by area
            if 500 < area < 15000:
                x, y, w, h = cv2.boundingRect(contour)

                # Convert to meters
                width = float(w / self.pixels_per_meter)
                height = float(h / self.pixels_per_meter)
                center_x = float((x + w / 2) / self.pixels_per_meter)
                center_y = float((y + h / 2) / self.pixels_per_meter)

                rotation = 0.0 if w > h else float(np.pi / 2)

                # Classify as door or window
                if 0.7 < max(width, height) < 1.2 and min(width, height) < 0.3:
                    # Likely a door
                    doors.append(
                        Opening(
                            position=[center_x, center_y],
                            width=round(max(width, height), 2),
                            height=2.1,
                            rotation=rotation,
                            type="door",
                        )
                    )
                elif 0.6 < max(width, height) < 2.5 and min(width, height) < 0.3:
                    # Likely a window
                    windows.append(
                        Opening(
                            position=[center_x, center_y],
                            width=round(max(width, height), 2),
                            height=1.2,
                            rotation=rotation,
                            type="window",
                            sillHeight=0.9,
                        )
                    )

        return doors, windows

    def detect_rooms(self, binary_image: np.ndarray, walls: List[Wall]) -> List[Room]:
        """Detect and identify rooms"""
        # Invert for flood fill
        inverted = cv2.bitwise_not(binary_image)

        # Find contours representing rooms
        contours, _ = cv2.findContours(
            inverted, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        rooms = []

        for idx, contour in enumerate(contours):
            area = cv2.contourArea(contour)

            # Minimum room size filter
            if area > 3000:
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    cx = float(int(M["m10"] / M["m00"]) / self.pixels_per_meter)
                    cy = float(int(M["m01"] / M["m00"]) / self.pixels_per_meter)

                    area_m2 = float(area / (self.pixels_per_meter**2))

                    # Classify room type based on area
                    if area_m2 < 5:
                        room_type = "bathroom"
                        name = f"Bathroom {len([r for r in rooms if r.type == 'bathroom']) + 1}"
                    elif area_m2 < 12:
                        room_type = "bedroom"
                        name = f"Bedroom {len([r for r in rooms if r.type == 'bedroom']) + 1}"
                    elif area_m2 < 20:
                        room_type = "kitchen"
                        name = "Kitchen"
                    else:
                        room_type = "living"
                        name = "Living Room"

                    rooms.append(
                        Room(
                            name=name,
                            center=[round(cx, 2), round(cy, 2)],
                            type=room_type,
                            area=round(area_m2, 2),
                        )
                    )

        return rooms

    def extract_dimensions_ocr(self, image: np.ndarray) -> dict:
        """Extract dimension text using OCR (if available)"""
        if not TESSERACT_AVAILABLE:
            return {}

        try:
            # Preprocess for OCR
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image.copy()

            _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)

            # Extract text
            text = pytesseract.image_to_string(binary, config="--psm 6")

            # Parse dimensions
            dimensions = {}
            patterns = [
                r"(\d+\.?\d*)\s*m\b",
                r"(\d+\.?\d*)\s*cm\b",
                r"(\d+\.?\d*)\s*mm\b",
            ]

            for pattern in patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                for match in matches:
                    val = float(match)
                    if "m" in pattern and "mm" not in pattern:
                        dimensions[f"dim_{len(dimensions)}"] = val
                    elif "cm" in pattern:
                        dimensions[f"dim_{len(dimensions)}"] = val / 100
                    elif "mm" in pattern:
                        dimensions[f"dim_{len(dimensions)}"] = val / 1000

            # Detect scale from dimensions
            if dimensions:
                self.detect_scale_from_dimensions(list(dimensions.values()))

            return dimensions
        except Exception as e:
            print(f"OCR Error: {e}")
            return {}

    def detect_scale_from_dimensions(self, dimensions: List[float]):
        """Auto-detect scale from extracted dimensions"""
        if dimensions:
            avg_dim = np.mean(dimensions)
            if 2.5 <= avg_dim <= 8:
                self.scale_factor = avg_dim / 5.0
                self.pixels_per_meter = 100 / self.scale_factor


# ============================================================================
# DXF PROCESSOR CLASS
# ============================================================================


class DXFProcessor:
    """Process DXF CAD files"""

    def __init__(self):
        self.scale_factor = 1.0

    def parse_dxf(self, file_content: bytes) -> BuildingModel:
        """Parse DXF file and extract building geometry"""
        if not DXF_AVAILABLE:
            raise HTTPException(
                status_code=400,
                detail="DXF processing not available. Install ezdxf: pip install ezdxf",
            )

        try:
            # Load DXF from bytes
            doc = ezdxf.read(io.BytesIO(file_content))
            modelspace = doc.modelspace()

            walls = []
            doors = []
            windows = []

            # Extract lines (walls)
            for entity in modelspace.query("LINE"):
                start = entity.dxf.start
                end = entity.dxf.end

                # Convert to 2D and scale (assuming mm units)
                wall = Wall(
                    start=[float(start.x / 1000), float(start.y / 1000)],
                    end=[float(end.x / 1000), float(end.y / 1000)],
                    thickness=0.3,
                    length=round(
                        float(
                            np.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)
                            / 1000
                        ),
                        2,
                    ),
                )
                walls.append(wall)

            # Extract polylines
            for entity in modelspace.query("LWPOLYLINE"):
                points = list(entity.get_points())
                for i in range(len(points) - 1):
                    start = points[i]
                    end = points[i + 1]

                    wall = Wall(
                        start=[float(start[0] / 1000), float(start[1] / 1000)],
                        end=[float(end[0] / 1000), float(end[1] / 1000)],
                        thickness=0.3,
                        length=round(
                            float(
                                np.sqrt(
                                    (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2
                                )
                                / 1000
                            ),
                            2,
                        ),
                    )
                    walls.append(wall)

            # Extract blocks (doors, windows)
            for insert in modelspace.query("INSERT"):
                block_name = insert.dxf.name.lower()
                pos = insert.dxf.insert

                if "door" in block_name or "dr" in block_name:
                    doors.append(
                        Opening(
                            position=[float(pos.x / 1000), float(pos.y / 1000)],
                            width=0.9,
                            height=2.1,
                            rotation=float(insert.dxf.rotation * np.pi / 180),
                            type="door",
                        )
                    )
                elif "window" in block_name or "win" in block_name:
                    windows.append(
                        Opening(
                            position=[float(pos.x / 1000), float(pos.y / 1000)],
                            width=1.2,
                            height=1.2,
                            rotation=float(insert.dxf.rotation * np.pi / 180),
                            type="window",
                            sillHeight=0.9,
                        )
                    )

            # Extract text (dimensions)
            dimensions = {}
            for text in modelspace.query("TEXT"):
                content = text.dxf.text
                match = re.search(r"(\d+\.?\d*)", content)
                if match:
                    dimensions[f"dim_{len(dimensions)}"] = float(match.group(1)) / 1000

            # Create floor plan
            floor = FloorPlan(
                level=0,
                walls=walls,
                doors=doors,
                windows=windows,
                rooms=[],
                dimensions=dimensions,
            )

            # Create building model
            building = BuildingModel(
                floors=[floor],
                wallHeight=3.0,
                wallThickness=0.3,
                totalFloors=1,
                scaleFactor=1.0,
                detectedScale=len(dimensions) > 0,
            )

            return building

        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error parsing DXF: {str(e)}")


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

app = FastAPI(
    title="ArchCAD Pro 3D Backend",
    description="Professional architectural floor plan to 3D converter",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize processors
image_processor = ImageProcessor()
dxf_processor = DXFProcessor()

# ============================================================================
# API ENDPOINTS
# ============================================================================


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ArchCAD Pro 3D Backend",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/api/health",
            "process_image": "/api/process-image",
            "process_dxf": "/api/process-dxf",
            "analyze_scale": "/api/analyze-scale",
        },
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ArchCAD Pro Backend",
        "tesseract_available": TESSERACT_AVAILABLE,
        "dxf_available": DXF_AVAILABLE,
    }


@app.post("/api/process-image", response_model=BuildingModel)
async def process_floor_plan_image(
    file: UploadFile = File(...),
    wall_thickness: float = 0.3,
    wall_height: float = 3.0,
    num_floors: int = 1,
    reference_dimension: Optional[float] = None,
):
    """Process uploaded floor plan image"""

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, detail="File must be an image (PNG, JPG, JPEG)"
        )

    try:
        # Read image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(
                status_code=400, detail="Invalid or corrupted image file"
            )

        # Set reference dimension if provided
        if reference_dimension and reference_dimension > 0:
            image_processor.pixels_per_meter = image.shape[1] / reference_dimension

        # Preprocess image
        binary = image_processor.preprocess_image(image)

        # Extract dimensions using OCR
        dimensions = image_processor.extract_dimensions_ocr(image)

        # Detect walls
        walls = image_processor.detect_walls(binary)

        # Detect doors and windows
        doors, windows = image_processor.detect_openings(binary, walls)

        # Detect rooms
        rooms = image_processor.detect_rooms(binary, walls)

        # Create floor plans for multiple floors
        floors = []
        for floor_num in range(num_floors):
            floor = FloorPlan(
                level=floor_num,
                walls=walls,
                doors=doors,
                windows=windows,
                rooms=rooms,
                dimensions=dimensions,
            )
            floors.append(floor)

        # Create building model
        building = BuildingModel(
            floors=floors,
            wallHeight=wall_height,
            wallThickness=wall_thickness,
            totalFloors=num_floors,
            scaleFactor=image_processor.scale_factor,
            detectedScale=len(dimensions) > 0,
        )

        return building

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/api/process-dxf", response_model=BuildingModel)
async def process_dxf_file(
    file: UploadFile = File(...), wall_height: float = 3.0, num_floors: int = 1
):
    """Process uploaded DXF CAD file"""

    if not file.filename or not file.filename.lower().endswith((".dxf", ".dwg")):
        raise HTTPException(status_code=400, detail="File must be a DXF or DWG file")

    try:
        contents = await file.read()

        building = dxf_processor.parse_dxf(contents)
        building.wallHeight = wall_height
        building.totalFloors = num_floors

        # Duplicate floor for multi-story buildings
        if num_floors > 1:
            base_floor = building.floors[0]
            for floor_num in range(1, num_floors):
                new_floor = FloorPlan(
                    level=floor_num,
                    walls=base_floor.walls,
                    doors=base_floor.doors,
                    windows=base_floor.windows,
                    rooms=base_floor.rooms,
                    dimensions=base_floor.dimensions,
                )
                building.floors.append(new_floor)

        return building

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing DXF: {str(e)}")


@app.post("/api/analyze-scale")
async def analyze_scale(
    file: UploadFile = File(...), reference_length_mm: Optional[float] = None
):
    """Analyze image to detect scale"""

    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Extract dimensions
        dimensions = image_processor.extract_dimensions_ocr(image)

        # Detect scale
        binary = image_processor.preprocess_image(image)
        walls = image_processor.detect_walls(binary)

        avg_wall_length = float(np.mean([w.length for w in walls])) if walls else 0.0

        return {
            "detected_dimensions": dimensions,
            "average_wall_length": round(avg_wall_length, 2),
            "suggested_scale": float(image_processor.scale_factor),
            "pixels_per_meter": float(image_processor.pixels_per_meter),
            "num_walls_detected": len(walls),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing scale: {str(e)}")


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("ArchCAD Pro 3D Backend Server")
    print("=" * 60)
    print(f"Tesseract OCR: {'Available' if TESSERACT_AVAILABLE else 'Not Available'}")
    print(f"DXF Processing: {'Available' if DXF_AVAILABLE else 'Not Available'}")
    print("=" * 60)
    print("Starting server on http://0.0.0.0:8001")
    print("API Documentation: http://0.0.0.0:8001/docs")
    print("=" * 60)

    uvicorn.run("main:app", host="0.0.0.0", port=8001, log_level="info", reload=True)
