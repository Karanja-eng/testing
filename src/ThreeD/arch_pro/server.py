import time
from typing import List, Dict, Tuple
import os
import uuid
import cv2
from pathlib import Path
import numpy as np
import traceback
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from models import BuildingModel, FloorPlan, Wall, Opening, Room
from detectors import YOLODetector
from geometry import GeometryProcessor, StructuralGapCloser
from engine_rules import EngineeringEngine
from segmentation import ArchSegmentation
from exporter import MeshGenerator

app = FastAPI(title="ArchCAD Pro 5.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

UPLOADS = os.path.join(os.path.dirname(__file__), "uploads")
GENERATED = os.path.join(os.path.dirname(__file__), "generated")
os.makedirs(UPLOADS, exist_ok=True)
os.makedirs(GENERATED, exist_ok=True)

app.mount("/generated", StaticFiles(directory=GENERATED), name="generated")

# Paths
BASE_DIR = Path(__file__).parent
STRUCT_MODEL = str(BASE_DIR / "best.pt")
FURN_MODEL = str(BASE_DIR / "model" / "best_casa1.pt")
FURUKAWA_PKL = str(BASE_DIR / "model" / "model_best_val_loss_var.pkl")

detector = YOLODetector(STRUCT_MODEL, FURN_MODEL)
geometry = GeometryProcessor()
engine = EngineeringEngine()
segmentation = ArchSegmentation(FURUKAWA_PKL, STRUCT_MODEL)
gap_closer = StructuralGapCloser()
mesh_gen = MeshGenerator()

@app.post("/v4/process", response_model=BuildingModel)
async def process_pro(
    files: List[UploadFile] = File(...),
    ppm: float = Form(100.0)
):
    try:
        floors = []
        current_elevation = 0.0
        all_mesh_data = {"walls": [], "rooms": [], "openings": []}

        for i, file in enumerate(files):
            file_id = uuid.uuid4().hex[:8]
            path = os.path.join(UPLOADS, f"{file_id}_{file.filename}")
            with open(path, "wb") as f:
                f.write(await file.read())
            
            img = cv2.imread(path)
            detector.ppm = ppm
            
            # 1. Furniture & Technical Points (YOLO)
            det_data = detector.detect_all(img)
            
            # 2. Structural Segmentation (Furukawa + YOLO Boost + PRO 5.0 Gap Closing)
            struct = segmentation.segment(path, ppm, gap_closer=gap_closer.close_gaps)
            
            # Convert structural lines to models
            walls = []
            if "wall_segments" in struct and struct["wall_segments"]:
                for j, seg in enumerate(struct["wall_segments"]):
                    walls.append(Wall(
                        id=f"f{i}_wall_{j}",
                        start=seg["start"],
                        end=seg["end"],
                        thickness=seg["thickness"],
                        length=seg["length"]
                    ))
            else:
                # Fallback to polygons if no lines detected
                for j, item in enumerate(struct["walls"]):
                    poly = item["polygon"]
                    holes = item.get("holes", [])
                    p = np.array(poly)
                    x1, y1 = p.min(axis=0); x2, y2 = p.max(axis=0)
                    walls.append(Wall(
                        id=f"f{i}_poly_wall_{j}", 
                        start=[float(x1), float(y1)], 
                        end=[float(x2), float(y2)], 
                        thickness=0.15, 
                        length=float(np.sqrt((x2-x1)**2 + (y2-y1)**2)),
                        polygon=poly,
                        holes=holes
                    ))

            rooms = []
            for j, item in enumerate(struct["rooms"]):
                poly = item["polygon"]
                holes = item.get("holes", [])
                rooms.append(Room(
                    id=f"f{i}_room_{j}", 
                    name=f"Room {j}", 
                    center=[0, 0], # Placeholder
                    area=0.0,      # Placeholder
                    polygon=poly, 
                    holes=holes,
                    type="generic"
                ))

            doors = []
            for j, item in enumerate(struct["doors"]):
                poly = item["polygon"]
                p = np.array(poly)
                center = p.mean(axis=0)
                rect = cv2.minAreaRect(p.astype(np.float32))
                (cx, cy), (w_box, h_box), angle = rect
                width = max(w_box, h_box)
                rot = np.radians(angle)
                doors.append(Opening(id=f"f{i}_door_{j}", position=[float(center[0]), float(center[1])], width=float(width), height=2.1, rotation=float(rot), type="door", confidence=1.0))

            windows = []
            for j, item in enumerate(struct["windows"]):
                poly = item["polygon"]
                p = np.array(poly)
                center = p.mean(axis=0)
                rect = cv2.minAreaRect(p.astype(np.float32))
                (cx, cy), (w_box, h_box), angle = rect
                width = max(w_box, h_box)
                rot = np.radians(angle)
                windows.append(Opening(id=f"f{i}_win_{j}", position=[float(center[0]), float(center[1])], width=float(width), height=1.2, rotation=float(rot), type="window", sillHeight=0.9, confidence=1.0))
            
            # 3. Apply Engineering Rules (Simplified for multi-floor)
            db_pt = det_data["electrical"][0].position if det_data["electrical"] else [5, 5]
            rule_points = engine.auto_place_electrical(det_data["furniture"], walls)
            det_data["electrical"].extend(rule_points)
            conduits = engine.generate_conduits(det_data["electrical"], db_pt)
            
            floor = FloorPlan(
                level=i,
                elevation=current_elevation,
                height=3.0,
                walls=walls,
                doors=doors,
                windows=windows,
                rooms=rooms,
                furniture=det_data["furniture"],
                electrical=det_data["electrical"],
                plumbing=det_data["plumbing"],
                conduits=conduits,
                stairs=det_data["stairs"],
                columns=det_data["columns"]
            )
            floors.append(floor)
            
            # Collect mesh data for Blender export
            for w in walls:
                if w.polygon:
                    # Apply elevation to mesh verts in exporter or here?
                    # Let's keep MeshGenerator simple and just pass elevation if we update it.
                    # For now, let's just collect.
                    all_mesh_data["walls"].append(mesh_gen.generate_wall_mesh(w.polygon, 3.0))

            current_elevation += 3.0 # Stack next floor

        # Export for Blender orchestration
        export_path = os.path.join(GENERATED, f"project_{int(time.time())}.json")
        os.makedirs("exports", exist_ok=True) # This line is redundant if GENERATED is used, but kept for safety.
        mesh_gen.export_as_json(all_mesh_data, export_path)

        return BuildingModel(
            project_id=f"pro_{int(time.time())}",
            floors=floors,
            totalFloors=len(floors),
            totalHeight=current_elevation,
            metadata={"processed_with": "ArchCAD Pro 5.0", "mesh_export": export_path}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run('server:app', host="0.0.0.0", port=8002, reload=True)
