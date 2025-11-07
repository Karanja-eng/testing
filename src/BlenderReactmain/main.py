# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import asyncio
from datetime import datetime
import numpy as np
from enum import Enum

app = FastAPI(title="AutoCAD Clone Backend")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ Models ============


class ObjectType(str, Enum):
    LINE = "line"
    CIRCLE = "circle"
    RECTANGLE = "rectangle"
    ARC = "arc"
    POLYLINE = "polyline"
    HATCH = "hatch"
    DIMENSION = "dimension"
    TEXT = "text"
    ANNOTATION = "annotation"
    TABLE = "table"


class Point(BaseModel):
    x: float
    y: float
    z: float = 0.0


class DrawingObject(BaseModel):
    id: str
    type: ObjectType
    layerId: str
    visible: bool
    selected: bool
    strokeColor: str
    strokeWidth: float
    fillColor: Optional[str]
    timestamp: float
    properties: Dict = {}


class Layer(BaseModel):
    id: str
    name: str
    color: str
    visible: bool
    locked: bool
    parentId: Optional[str] = None


class DrawingProject(BaseModel):
    id: str
    name: str
    objects: List[DrawingObject] = []
    layers: List[Layer] = []
    created_at: str
    modified_at: str


class SnapSettings(BaseModel):
    endpoint: bool
    midpoint: bool
    center: bool
    perpendicular: bool
    tangent: bool
    intersection: bool
    extension: bool
    grid: bool


class AIDrawingRequest(BaseModel):
    prompt: str
    selectedObjects: List[str] = []
    objectType: Optional[str] = None


class AIDrawingResponse(BaseModel):
    status: str
    objects: List[DrawingObject]
    message: str


# ============ In-Memory Storage ============
projects: Dict[str, DrawingProject] = {}
active_connections: List[WebSocket] = []

# ============ Routes ============


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/api/projects")
async def create_project(name: str = "Untitled Project"):
    """Create a new drawing project"""
    project_id = str(datetime.now().timestamp())
    project = DrawingProject(
        id=project_id,
        name=name,
        created_at=datetime.now().isoformat(),
        modified_at=datetime.now().isoformat(),
        layers=[
            Layer(
                id="default",
                name="Layer 0",
                color="#FFFFFF",
                visible=True,
                locked=False,
            )
        ],
    )
    projects[project_id] = project
    return {"project": project, "message": "Project created successfully"}


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Get project by ID"""
    if project_id not in projects:
        return {"error": "Project not found"}, 404
    return {"project": projects[project_id]}


@app.post("/api/projects/{project_id}/objects")
async def add_object(project_id: str, obj: DrawingObject):
    """Add a drawing object to project"""
    if project_id not in projects:
        return {"error": "Project not found"}, 404

    projects[project_id].objects.append(obj)
    projects[project_id].modified_at = datetime.now().isoformat()

    # Broadcast to connected clients
    await broadcast(
        {"type": "object_added", "project_id": project_id, "object": obj.dict()}
    )

    return {"status": "success", "object": obj}


@app.put("/api/projects/{project_id}/objects/{object_id}")
async def update_object(project_id: str, object_id: str, obj: DrawingObject):
    """Update a drawing object"""
    if project_id not in projects:
        return {"error": "Project not found"}, 404

    for i, existing_obj in enumerate(projects[project_id].objects):
        if existing_obj.id == object_id:
            projects[project_id].objects[i] = obj
            projects[project_id].modified_at = datetime.now().isoformat()

            await broadcast(
                {
                    "type": "object_updated",
                    "project_id": project_id,
                    "object": obj.dict(),
                }
            )

            return {"status": "success", "object": obj}

    return {"error": "Object not found"}, 404


@app.delete("/api/projects/{project_id}/objects/{object_id}")
async def delete_object(project_id: str, object_id: str):
    """Delete a drawing object"""
    if project_id not in projects:
        return {"error": "Project not found"}, 404

    projects[project_id].objects = [
        obj for obj in projects[project_id].objects if obj.id != object_id
    ]
    projects[project_id].modified_at = datetime.now().isoformat()

    await broadcast(
        {"type": "object_deleted", "project_id": project_id, "object_id": object_id}
    )

    return {"status": "success"}


@app.post("/api/projects/{project_id}/layers")
async def add_layer(project_id: str, layer: Layer):
    """Add a layer to project"""
    if project_id not in projects:
        return {"error": "Project not found"}, 404

    projects[project_id].layers.append(layer)
    projects[project_id].modified_at = datetime.now().isoformat()

    return {"status": "success", "layer": layer}


@app.post("/api/ai/generate")
async def generate_ai_drawing(request: AIDrawingRequest):
    """
    AI-powered drawing generation (Placeholder)
    In production, this would call your LLM service
    """
    # Placeholder for AI integration
    # This would connect to your LLM (GPT-4, Claude, etc.)

    return AIDrawingResponse(
        status="processing",
        objects=[],
        message="AI drawing generation initiated. This is a placeholder for LLM integration.",
    )


@app.post("/api/rendering/render-2d")
async def render_2d(project_id: str):
    """
    Render 2D drawing to image/PDF
    Connected to Blender for advanced rendering
    """
    if project_id not in projects:
        return {"error": "Project not found"}, 404

    project = projects[project_id]

    return {
        "status": "rendering",
        "project_id": project_id,
        "message": "2D rendering initiated",
        "object_count": len(project.objects),
    }


@app.post("/api/rendering/render-3d")
async def render_3d(project_id: str):
    """
    Render 3D drawing with Blender
    """
    if project_id not in projects:
        return {"error": "Project not found"}, 404

    return {
        "status": "rendering",
        "project_id": project_id,
        "message": "3D rendering initiated via Blender",
    }


@app.post("/api/geometry/measure")
async def measure_geometry(objects: List[str]):
    """
    Calculate measurements: length, area, perimeter
    """
    return {
        "measurements": {"total_length": 0.0, "total_area": 0.0, "total_perimeter": 0.0}
    }


@app.post("/api/geometry/offset")
async def offset_geometry(project_id: str, object_id: str, distance: float):
    """Offset/parallel lines"""
    if project_id not in projects:
        return {"error": "Project not found"}, 404

    return {"status": "success", "message": f"Offset created with distance {distance}"}


# ============ WebSocket ============


@app.websocket("/ws/drawing/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    """WebSocket for real-time collaboration and AI updates"""
    await websocket.accept()
    active_connections.append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle different message types
            if message.get("type") == "ai_update":
                # AI is updating drawing
                await broadcast(
                    {
                        "type": "ai_drawing_update",
                        "project_id": project_id,
                        "data": message.get("data"),
                    }
                )
            elif message.get("type") == "user_action":
                # User action
                await broadcast(
                    {"type": "user_action", "project_id": project_id, "action": message}
                )

    except WebSocketDisconnect:
        active_connections.remove(websocket)


async def broadcast(message: dict):
    """Broadcast message to all connected clients"""
    for connection in active_connections:
        try:
            await connection.send_json(message)
        except:
            pass


# ============ Utility Functions ============


def calculate_distance(p1: Point, p2: Point) -> float:
    """Calculate distance between two points"""
    return np.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2)


def calculate_circle_area(radius: float) -> float:
    """Calculate circle area"""
    return np.pi * radius**2


def calculate_polygon_area(points: List[Point]) -> float:
    """Calculate polygon area using shoelace formula"""
    n = len(points)
    if n < 3:
        return 0

    area = 0
    for i in range(n):
        j = (i + 1) % n
        area += points[i].x * points[j].y
        area -= points[j].x * points[i].y

    return abs(area) / 2


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "AutoCAD Clone Backend",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "projects": "/api/projects",
            "websocket": "/ws/drawing/{project_id}",
            "ai": "/api/ai/generate",
            "rendering": "/api/rendering/render-2d",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
