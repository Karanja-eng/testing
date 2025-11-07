# main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import os
import tempfile
import shutil
import uuid
import numpy as np
import cv2
import torch
import torch.nn.functional as F
from utils.FloorplanToBlenderLib import *
from utils.loaders import RotateNTurns
from utils.post_prosessing import split_prediction, get_polygons
from model import get_model

app = FastAPI()

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static directory for output files
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)

# Blender executable path
BLENDER_PATH = r"C:\blender-3.6.10-windows-x64\blender-3.6.10-windows-x64\blender.exe"

# Your segmentation settings
rot = RotateNTurns()
room_classes = [
    "Background",
    "Outdoor",
    "Wall",
    "Kitchen",
    "Living Room",
    "Bed Room",
    "Bath",
    "Entry",
    "Railing",
    "Storage",
    "Garage",
    "Undefined",
]
icon_classes = [
    "No Icon",
    "Window",
    "Door",
    "Closet",
    "Electrical Appliance",
    "Toilet",
    "Sink",
    "Sauna Bench",
    "Fire Place",
    "Bathtub",
    "Chimney",
]
model = get_model("hg_furukawa_original", 51)
n_classes = 44
split = [21, 12, 11]
wall_height = 3.0
scale = 0.01

# Load model (CPU)
checkpoint = torch.load(
    r"src/civilai/model_best_val_loss_var.pkl", map_location=torch.device("cpu")
)
model.conv4_ = torch.nn.Conv2d(256, n_classes, bias=True, kernel_size=1)
model.upsample = torch.nn.ConvTranspose2d(n_classes, n_classes, kernel_size=4, stride=4)
model.load_state_dict(checkpoint["model_state"])
model.eval()


@app.post("/generate")
async def generate_floorplan(file: UploadFile = File(...)):
    # Save uploaded image
    floorplan_id = str(uuid.uuid4())[:8]
    img_path = os.path.join(STATIC_DIR, f"floorplan_{floorplan_id}.png")
    with open(img_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Your segmentation code (unchanged)
    img = cv2.imread(img_path)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = 2 * (img / 255.0) - 1
    img = np.moveaxis(img, -1, 0)
    img = np.array(img, dtype=np.float32)
    img = torch.tensor(img).unsqueeze(0)

    with torch.no_grad():
        size_check = np.array([img.shape[2], img.shape[3]]) % 2
        height = img.shape[2] - size_check[0]
        width = img.shape[3] - size_check[1]
        img_size = (height, width)
        rotations = [(0, 0), (1, -1), (2, 2), (-1, 1)]
        pred_count = len(rotations)
        prediction = torch.zeros([pred_count, n_classes, height, width])

        for i, r in enumerate(rotations):
            forward, back = r
            rot_image = rot(img, "tensor", forward)
            pred = model(rot_image)
            pred = rot(pred, "tensor", back)
            pred = rot(pred, "points", back)
            pred = F.interpolate(
                pred, size=(height, width), mode="bilinear", align_corners=True
            )
            prediction[i] = pred[0]

        prediction = torch.mean(prediction, 0, True)

    heatmaps, rooms, icons = split_prediction(prediction, img_size, split)
    polygons, types, room_polygons, room_types = get_polygons(
        (heatmaps, rooms, icons), 0.2, [1, 2]
    )

    # Extract walls
    wall_polygon_numbers = [i for i, j in enumerate(types) if j["type"] == "wall"]
    boxes = []
    for i, j in enumerate(polygons):
        if i in wall_polygon_numbers:
            temp = [np.array([k]) for k in j]
            boxes.append(np.array(temp))

    # Generate verts and faces
    verts, faces, wall_amount = transform.create_nx4_verts_and_faces(
        boxes, wall_height, scale
    )
    top_verts = []
    for box in boxes:
        top_verts.extend(transform.scale_point_to_vector(box, scale, wall_height))
    verts.extend(top_verts)

    # Write Blender script
    # In the /generate endpoint
    output_gltf = os.path.join(STATIC_DIR, f"floorplan_{floorplan_id}.gltf")
    blender_script = f"""
import bpy
import bmesh
from mathutils import Vector

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Create mesh
mesh = bpy.data.meshes.new("FloorplanMesh")
obj = bpy.data.objects.new("Floorplan", mesh)
bpy.context.collection.objects.link(obj)
bm = bmesh.new()

# Add vertices
verts = {verts}
for v in verts:
    bm.verts.new(Vector(v[:3]))
bm.verts.ensure_lookup_table()

# Add faces
faces = {faces}
for f in faces:
    bm.faces.new([bm.verts[i] for i in f])

bm.to_mesh(mesh)
bm.free()

# Export GLTF
bpy.ops.export_scene.gltf(filepath=r"{output_gltf}", export_format='GLTF_SEPARATE')"""
    script_path = os.path.join(STATIC_DIR, f"blender_script_{floorplan_id}.py")
    with open(script_path, "w") as f:
        f.write(blender_script)

    # Run headless Blender
    cmd = [BLENDER_PATH, "--background", "--python", script_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    print(result.stderr)

    if not os.path.exists(output_gltf):
        return {
            "error": f"Blender failed to generate the floorplan model: {result.stderr}"
        }

    return {"status": "success", "file": f"/static/floorplan_{floorplan_id}.gltf"}


@app.get("/static/{filename}")
async def serve_static(filename: str):
    file_path = os.path.join(STATIC_DIR, filename)
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    return FileResponse(file_path, media_type="model/gltf+json")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("segmentation:app", host="0.0.0.0", port=8000, reload=True)
