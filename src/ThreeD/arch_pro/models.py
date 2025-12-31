from pydantic import BaseModel
from typing import List, Optional, Dict, Tuple

class WallSegment(BaseModel):
    start: List[float]
    end: List[float]
    height: float
    offsetZ: float = 0.0

class Wall(BaseModel):
    id: str
    start: List[float]
    end: List[float]
    thickness: float
    length: float
    polygon: Optional[List[List[float]]] = None
    holes: Optional[List[List[List[float]]]] = None
    segments: Optional[List[WallSegment]] = None

class Opening(BaseModel):
    id: str
    position: List[float]
    width: float
    height: float
    rotation: float
    type: str # door_swing, window_regular, etc.
    sillHeight: Optional[float] = 0.9
    confidence: Optional[float] = 1.0

class Furniture(BaseModel):
    id: str
    position: List[float]
    size: List[float] # [width, depth, height]
    rotation: float
    type: str # bed, chair, sink, tub, etc.
    category: str = "general" # plumbing, electrical, furniture
    confidence: Optional[float] = 1.0

class TechnicalPoint(BaseModel):
    id: str
    position: List[float]
    type: str # socket, tap, light_switch
    category: str # electrical, plumbing
    height: float # height from floor
    rotation: float = 0.0

class Conduit(BaseModel):
    id: str
    path: List[List[float]] # List of [x, y, z] points
    type: str # electrical, water, waste
    diameter: float = 0.02

class Room(BaseModel):
    id: str
    name: str
    center: List[float]
    type: str
    area: float
    polygon: Optional[List[List[float]]] = None
    holes: Optional[List[List[List[float]]]] = None
    items: List[str] = [] # IDs of items in this room
    confidence: Optional[float] = 1.0

class FloorPlan(BaseModel):
    level: int
    elevation: float = 0.0 # Vertical offset from ground
    height: float = 3.0    # Ceiling height for this floor
    walls: List[Wall]
    doors: List[Opening]
    windows: List[Opening]
    rooms: List[Room]
    furniture: List[Furniture] = []
    electrical: List[TechnicalPoint] = []
    plumbing: List[TechnicalPoint] = []
    conduits: List[Conduit] = []
    stairs: List[dict] = []
    columns: List[dict] = []

class BuildingModel(BaseModel):
    project_id: str
    floors: List[FloorPlan]
    totalFloors: int
    totalHeight: float = 0.0
    metadata: Dict = {}
