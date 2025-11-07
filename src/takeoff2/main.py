# main.py - FastAPI Backend for Quantity Survey System
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import math
import uvicorn

app = FastAPI(
    title="Quantity Survey API",
    description="Professional Quantity Survey Calculation System",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# PYDANTIC MODELS
# =====================================================

class CalculationItem(BaseModel):
    description: str
    quantity: float
    unit: str

class CalculationResponse(BaseModel):
    items: List[CalculationItem]
    summary: Dict[str, Any]
    total_cost: Optional[float] = None

# Individual Calculator Models
class StairsRequest(BaseModel):
    height: float
    length: float
    width: float
    riser_height: int  # mm
    tread_width: int   # mm
    thickness: int     # mm

class FoundationRequest(BaseModel):
    length: float
    width: float
    depth: float
    concrete_grade: str
    reinforcement_type: str

class SuperstructureRequest(BaseModel):
    floor_area: float
    storey_height: float
    number_floors: int
    slab_thickness: int  # mm
    beam_size: str       # e.g., "230x450"
    column_size: str     # e.g., "230x230"

class ManholesRequest(BaseModel):
    internal_diameter: int  # mm
    depth: float
    wall_thickness: int     # mm
    base_thickness: int     # mm
    number_manholes: int

class PavementsRequest(BaseModel):
    area: float
    subbase_thickness: int    # mm
    base_thickness: int       # mm
    surface_thickness: int    # mm
    pavement_type: str

class RetainingWallsRequest(BaseModel):
    length: float
    height: float
    thickness: int              # mm
    foundation_width: float
    foundation_thickness: int   # mm

class SepticTanksRequest(BaseModel):
    capacity: float
    length: float
    width: float
    depth: float
    wall_thickness: int  # mm

class SwimmingPoolsRequest(BaseModel):
    length: float
    width: float
    shallow_depth: float
    deep_depth: float
    wall_thickness: int   # mm
    floor_thickness: int  # mm

class BasementsRequest(BaseModel):
    length: float
    width: float
    depth: float
    wall_thickness: int   # mm
    floor_thickness: int  # mm
    waterproofing: bool

class WaterTanksRequest(BaseModel):
    capacity: float
    tank_type: str  # "Circular" or "Rectangular"
    height: float
    wall_thickness: int  # mm
    base_thickness: int  # mm

class LandscapingRequest(BaseModel):
    total_area: float
    lawn_area: float
    planting_area: float
    paving_area: float
    topsoil_depth: int  # mm

# =====================================================
# CALCULATION FUNCTIONS
# =====================================================

@app.post("/api/calculate/stairs", response_model=CalculationResponse)
async def calculate_stairs(request: StairsRequest):
    try:
        # Calculate number of steps
        steps_count = math.ceil((request.height * 1000) / request.riser_height)
        
        # Calculate concrete volume
        concrete_volume = (request.length * request.width * request.thickness / 1000)
        
        # Calculate formwork area
        formwork_area = (
            (request.length * 2 + request.width * 2) * 
            (request.height + request.thickness / 1000)
        )
        
        # Calculate reinforcement weight (80kg per m³ of concrete)
        reinforcement_weight = concrete_volume * 80
        
        items = [
            CalculationItem(
                description="Landscape irrigation system",
                quantity=round(request.total_area, 2),
                unit="m²"
            )
        ]
        
        summary = {
            "total_area": request.total_area,
            "topsoil_volume": round(topsoil_volume, 2),
            "grass_area": round(grass_area, 2),
            "planting_area": round(request.planting_area, 2),
            "paving_area": round(paving_area, 2),
            "estimated_plants": round(plants_number, 0)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# =====================================================
# HEALTH CHECK AND INFO ENDPOINTS
# =====================================================

@app.get("/")
async def root():
    return {
        "message": "Professional Quantity Survey API",
        "version": "1.0.0",
        "status": "active",
        "available_calculators": [
            "stairs", "foundation", "superstructure", "manholes",
            "pavements", "retaining_walls", "septic_tanks", 
            "swimming_pools", "basements", "water_tanks", "landscaping"
        ]
    }

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "API is running successfully"}

@app.get("/api/calculators")
async def get_available_calculators():
    return {
        "calculators": [
            {
                "id": "stairs",
                "name": "Stairs Calculator",
                "description": "Calculate stairs concrete, formwork & reinforcement",
                "fields": ["height", "length", "width", "riser_height", "tread_width", "thickness"]
            },
            {
                "id": "foundation", 
                "name": "Foundation Calculator",
                "description": "Calculate foundation excavation, concrete & reinforcement",
                "fields": ["length", "width", "depth", "concrete_grade", "reinforcement_type"]
            },
            {
                "id": "superstructure",
                "name": "Superstructure Calculator", 
                "description": "Calculate beams, columns, slabs",
                "fields": ["floor_area", "storey_height", "number_floors", "slab_thickness", "beam_size", "column_size"]
            },
            {
                "id": "manholes",
                "name": "Manholes Calculator",
                "description": "Calculate manhole excavation, concrete & covers", 
                "fields": ["internal_diameter", "depth", "wall_thickness", "base_thickness", "number_manholes"]
            },
            {
                "id": "pavements",
                "name": "Pavements Calculator",
                "description": "Calculate pavement layers & materials",
                "fields": ["area", "subbase_thickness", "base_thickness", "surface_thickness", "pavement_type"]
            },
            {
                "id": "retaining_walls",
                "name": "Retaining Walls Calculator", 
                "description": "Calculate retaining wall concrete & reinforcement",
                "fields": ["length", "height", "thickness", "foundation_width", "foundation_thickness"]
            },
            {
                "id": "septic_tanks",
                "name": "Septic Tanks Calculator",
                "description": "Calculate septic tank excavation & construction",
                "fields": ["capacity", "length", "width", "depth", "wall_thickness"]
            },
            {
                "id": "swimming_pools", 
                "name": "Swimming Pools Calculator",
                "description": "Calculate swimming pool excavation & construction",
                "fields": ["length", "width", "shallow_depth", "deep_depth", "wall_thickness", "floor_thickness"]
            },
            {
                "id": "basements",
                "name": "Basements Calculator",
                "description": "Calculate basement excavation, walls & waterproofing", 
                "fields": ["length", "width", "depth", "wall_thickness", "floor_thickness", "waterproofing"]
            },
            {
                "id": "water_tanks",
                "name": "Water Tanks Calculator",
                "description": "Calculate water tank construction materials",
                "fields": ["capacity", "tank_type", "height", "wall_thickness", "base_thickness"]
            },
            {
                "id": "landscaping",
                "name": "Landscaping Calculator", 
                "description": "Calculate landscaping materials & quantities",
                "fields": ["total_area", "lawn_area", "planting_area", "paving_area", "topsoil_depth"]
            }
        ]
    }

# =====================================================
# ERROR HANDLERS
# =====================================================

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {
        "error": "Endpoint not found",
        "message": "The requested calculator or endpoint does not exist",
        "available_endpoints": ["/api/calculate/{calculator_id}", "/api/health", "/api/calculators"]
    }

@app.exception_handler(422)
async def validation_error_handler(request, exc):
    return {
        "error": "Validation Error",
        "message": "Invalid input data provided",
        "details": str(exc)
    }

# =====================================================
# RUN SERVER
# =====================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

# =====================================================
# INSTALLATION AND SETUP INSTRUCTIONS
# =====================================================

"""
INSTALLATION INSTRUCTIONS:

1. Create a new directory for the backend:
   mkdir quantity_survey_backend
   cd quantity_survey_backend

2. Create a virtual environment:
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate

3. Install required packages:
   pip install fastapi uvicorn python-multipart

4. Create requirements.txt:
   pip freeze > requirements.txt

5. Save this code as main.py

6. Run the server:
   python main.py

   Or using uvicorn directly:
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload

7. Access the API documentation:
   http://localhost:8000/docs (Swagger UI)
   http://localhost:8000/redoc (ReDoc)

8. Test the API:
   curl -X POST "http://localhost:8000/api/calculate/stairs" \
   -H "Content-Type: application/json" \
   -d '{
     "height": 3.0,
     "length": 4.0, 
     "width": 1.2,
     "riser_height": 175,
     "tread_width": 250,
     "thickness": 150
   }'

DEPLOYMENT INSTRUCTIONS:

For production deployment:

1. Install additional packages:
   pip install gunicorn

2. Create Dockerfile:
   FROM python:3.9-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY . .
   CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "main:app", "--host", "0.0.0.0", "--port", "8000"]

3. Deploy to cloud platform (Heroku, AWS, DigitalOcean, etc.)

INTEGRATION WITH REACT:

1. Update your React app's API calls to use:
   const API_BASE_URL = 'http://localhost:8000/api';

2. Install axios in your React app:
   npm install axios

3. The React components are already configured to use this backend structure.
"""E100.1.2 - Excavation for stairs foundation, depth 0.25-1m",
                quantity=round(concrete_volume * 1.2, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F100 - Concrete grade C25/30 for stairs",
                quantity=round(concrete_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="G100.1.1 - Formwork to stairs, vertical faces",
                quantity=round(formwork_area, 2),
                unit="m²"
            ),
            CalculationItem(
                description="G600.1.3 - Reinforcement bars Y12, straight",
                quantity=round(reinforcement_weight, 2),
                unit="kg"
            )
        ]
        
        summary = {
            "steps_count": steps_count,
            "concrete_volume": round(concrete_volume, 2),
            "formwork_area": round(formwork_area, 2),
            "reinforcement_weight": round(reinforcement_weight, 2)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/foundation", response_model=CalculationResponse)
async def calculate_foundation(request: FoundationRequest):
    try:
        # Calculate volumes
        foundation_volume = request.length * request.width * request.depth
        excavation_volume = foundation_volume * 1.2  # Include working space
        
        # Calculate reinforcement (60kg per m³ for foundations)
        reinforcement_weight = foundation_volume * 60
        
        items = [
            CalculationItem(
                description=f"E200.1.3 - Excavation for foundations, depth {request.depth}m",
                quantity=round(excavation_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description=f"F100 - Foundation concrete {request.concrete_grade}",
                quantity=round(foundation_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description=f"G600 - Reinforcement bars {request.reinforcement_type}",
                quantity=round(reinforcement_weight, 2),
                unit="kg"
            )
        ]
        
        summary = {
            "excavation_volume": round(excavation_volume, 2),
            "concrete_volume": round(foundation_volume, 2),
            "reinforcement_weight": round(reinforcement_weight, 2)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/superstructure", response_model=CalculationResponse)
async def calculate_superstructure(request: SuperstructureRequest):
    try:
        total_floor_area = request.floor_area * request.number_floors
        
        # Calculate volumes
        slab_volume = total_floor_area * (request.slab_thickness / 1000)
        beam_volume = total_floor_area * 0.05  # Estimate 5% of floor area
        column_volume = (
            request.number_floors * request.storey_height * 
            0.02 * total_floor_area  # 2% estimate
        )
        total_concrete = slab_volume + beam_volume + column_volume
        
        # Calculate formwork
        formwork_area = total_floor_area * 1.5  # Factor for beams, columns, slabs
        
        # Calculate reinforcement (100kg per m³ for superstructure)
        reinforcement_weight = total_concrete * 100
        
        items = [
            CalculationItem(
                description="F200.1.2 - Slab concrete C25/30, thickness 150-300mm",
                quantity=round(slab_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F300.1.2 - Beam concrete C25/30",
                quantity=round(beam_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F400.1.2 - Column concrete C25/30",
                quantity=round(column_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="G100.2.2 - Formwork to superstructure elements",
                quantity=round(formwork_area, 2),
                unit="m²"
            ),
            CalculationItem(
                description="G600 - Reinforcement bars, mixed sizes",
                quantity=round(reinforcement_weight, 2),
                unit="kg"
            )
        ]
        
        summary = {
            "slab_volume": round(slab_volume, 2),
            "beam_volume": round(beam_volume, 2),
            "column_volume": round(column_volume, 2),
            "total_concrete": round(total_concrete, 2),
            "formwork_area": round(formwork_area, 2),
            "reinforcement_weight": round(reinforcement_weight, 2)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/manholes", response_model=CalculationResponse)
async def calculate_manholes(request: ManholesRequest):
    try:
        # Convert mm to m
        diameter = request.internal_diameter / 1000
        wall_thickness = request.wall_thickness / 1000
        base_thickness = request.base_thickness / 1000
        
        # Calculate excavation (including working space)
        excavation_diameter = diameter + (wall_thickness * 2) + 0.5
        excavation_volume = (
            math.pi * (excavation_diameter / 2) ** 2 * 
            (request.depth + base_thickness) * request.number_manholes
        )
        
        # Calculate concrete volume
        base_concrete = math.pi * (diameter / 2 + wall_thickness) ** 2 * base_thickness
        wall_concrete = (
            math.pi * wall_thickness * (diameter + wall_thickness) * request.depth
        )
        total_concrete = (base_concrete + wall_concrete) * request.number_manholes
        
        # Calculate reinforcement (70kg per m³)
        reinforcement_weight = total_concrete * 70
        
        items = [
            CalculationItem(
                description="E100.1.3 - Excavation for manholes, depth 1-2m",
                quantity=round(excavation_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F100 - Concrete C25/30 for manhole construction",
                quantity=round(total_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="G600 - Reinforcement for manholes",
                quantity=round(reinforcement_weight, 2),
                unit="kg"
            ),
            CalculationItem(
                description=f"J600 - Manhole covers {request.internal_diameter}mm diameter",
                quantity=request.number_manholes,
                unit="no"
            )
        ]
        
        summary = {
            "excavation_volume": round(excavation_volume, 2),
            "concrete_volume": round(total_concrete, 2),
            "reinforcement_weight": round(reinforcement_weight, 2),
            "cover_area": round(math.pi * (excavation_diameter / 2) ** 2 * request.number_manholes, 2)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/pavements", response_model=CalculationResponse)
async def calculate_pavements(request: PavementsRequest):
    try:
        # Calculate material volumes
        subbase_volume = request.area * (request.subbase_thickness / 1000)
        base_volume = request.area * (request.base_thickness / 1000)
        surface_volume = request.area * (request.surface_thickness / 1000)
        
        items = [
            CalculationItem(
                description="E100.1.1 - General excavation for pavement, depth ≤ 0.25m",
                quantity=round(subbase_volume * 1.1, 2),  # 10% extra for excavation
                unit="m³"
            ),
            CalculationItem(
                description="P100.1.2 - Granular sub-base material Type 1",
                quantity=round(subbase_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="P200.1.1 - Road base material",
                quantity=round(base_volume, 2),
                unit="m³"
            )
        ]
        
        if request.pavement_type == "Flexible":
            items.append(
                CalculationItem(
                    description="P300.1.1 - Asphaltic concrete surface course",
                    quantity=round(surface_volume, 2),
                    unit="m³"
                )
            )
        elif request.pavement_type == "Rigid":
            items.append(
                CalculationItem(
                    description="F200 - Concrete pavement C30/37",
                    quantity=round(surface_volume, 2),
                    unit="m³"
                )
            )
        else:  # Interlocking
            items.append(
                CalculationItem(
                    description="Interlocking concrete blocks",
                    quantity=round(request.area, 2),
                    unit="m²"
                )
            )
        
        summary = {
            "pavement_area": round(request.area, 2),
            "subbase_volume": round(subbase_volume, 2),
            "base_volume": round(base_volume, 2),
            "surface_volume": round(surface_volume, 2),
            "total_volume": round(subbase_volume + base_volume + surface_volume, 2)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/retaining_walls", response_model=CalculationResponse)
async def calculate_retaining_walls(request: RetainingWallsRequest):
    try:
        # Convert mm to m
        wall_thickness = request.thickness / 1000
        foundation_thickness = request.foundation_thickness / 1000
        
        # Calculate volumes
        wall_volume = request.length * wall_thickness * request.height
        foundation_volume = request.length * request.foundation_width * foundation_thickness
        total_concrete = wall_volume + foundation_volume
        
        # Calculate excavation
        excavation_volume = (
            request.length * request.foundation_width * 
            (foundation_thickness + 0.2)  # Extra depth for working
        )
        
        # Calculate reinforcement (120kg per m³ for retaining walls)
        reinforcement_weight = total_concrete * 120
        
        # Calculate formwork
        formwork_area = (
            (request.length * request.height * 2) +  # Both faces of wall
            (request.length * request.foundation_width * 2)  # Foundation edges
        )
        
        items = [
            CalculationItem(
                description="E200.1.1 - Excavation for retaining wall foundation",
                quantity=round(excavation_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F100 - Foundation concrete C25/30",
                quantity=round(foundation_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F300.1.2 - Wall concrete C30/37",
                quantity=round(wall_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="G100.2.2 - Formwork to retaining wall",
                quantity=round(formwork_area, 2),
                unit="m²"
            ),
            CalculationItem(
                description="G600 - Reinforcement bars for retaining wall",
                quantity=round(reinforcement_weight, 2),
                unit="kg"
            )
        ]
        
        summary = {
            "wall_volume": round(wall_volume, 2),
            "foundation_volume": round(foundation_volume, 2),
            "total_concrete": round(total_concrete, 2),
            "excavation_volume": round(excavation_volume, 2),
            "formwork_area": round(formwork_area, 2),
            "reinforcement_weight": round(reinforcement_weight, 2)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/septic_tanks", response_model=CalculationResponse)
async def calculate_septic_tanks(request: SepticTanksRequest):
    try:
        # Convert mm to m
        wall_thickness = request.wall_thickness / 1000
        
        # Calculate volumes
        excavation_volume = (
            (request.length + 0.5) * (request.width + 0.5) * (request.depth + 0.3)
        )
        
        # Concrete volumes
        base_concrete = request.length * request.width * 0.15  # 150mm base
        wall_concrete = (
            2 * (request.length * wall_thickness * request.depth) +
            2 * (request.width * wall_thickness * request.depth)
        )
        cover_concrete = request.length * request.width * 0.1  # 100mm cover
        total_concrete = base_concrete + wall_concrete + cover_concrete
        
        # Reinforcement (80kg per m³)
        reinforcement_weight = total_concrete * 80
        
        items = [
            CalculationItem(
                description="E100.1.3 - Excavation for septic tank, depth 1-2m",
                quantity=round(excavation_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F100 - Concrete C20/25 for septic tank base",
                quantity=round(base_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F300.1.1 - Concrete C25/30 for septic tank walls",
                quantity=round(wall_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F200.1.1 - Concrete C20/25 for septic tank cover",
                quantity=round(cover_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="G600 - Reinforcement for septic tank",
                quantity=round(reinforcement_weight, 2),
                unit="kg"
            ),
            CalculationItem(
                description="E500.1.1 - Backfill with selected material",
                quantity=round(excavation_volume - (request.length * request.width * request.depth), 2),
                unit="m³"
            )
        ]
        
        summary = {
            "capacity": request.capacity,
            "excavation_volume": round(excavation_volume, 2),
            "total_concrete": round(total_concrete, 2),
            "reinforcement_weight": round(reinforcement_weight, 2)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/swimming_pools", response_model=CalculationResponse)
async def calculate_swimming_pools(request: SwimmingPoolsRequest):
    try:
        # Convert mm to m
        wall_thickness = request.wall_thickness / 1000
        floor_thickness = request.floor_thickness / 1000
        
        # Calculate average depth
        avg_depth = (request.shallow_depth + request.deep_depth) / 2
        
        # Calculate volumes
        excavation_volume = (
            (request.length + 1) * (request.width + 1) * (avg_depth + 0.5)  # Working space
        )
        
        # Pool concrete volumes
        floor_concrete = request.length * request.width * floor_thickness
        wall_concrete = (
            2 * (request.length * wall_thickness * avg_depth) +
            2 * (request.width * wall_thickness * avg_depth)
        )
        total_concrete = floor_concrete + wall_concrete
        
        # Reinforcement (150kg per m³ for swimming pools)
        reinforcement_weight = total_concrete * 150
        
        # Formwork area
        formwork_area = (
            (request.length * avg_depth * 2) +  # Long walls
            (request.width * avg_depth * 2) +   # Short walls
            (request.length * request.width)     # Floor
        )
        
        items = [
            CalculationItem(
                description="E100.1.4 - Excavation for swimming pool, depth 2-5m",
                quantity=round(excavation_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F200.2.1 - Pool floor concrete C30/37",
                quantity=round(floor_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F300.2.2 - Pool wall concrete C30/37",
                quantity=round(wall_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="G100.2.2 - Formwork to swimming pool",
                quantity=round(formwork_area, 2),
                unit="m²"
            ),
            CalculationItem(
                description="G600 - Reinforcement for swimming pool",
                quantity=round(reinforcement_weight, 2),
                unit="kg"
            ),
            CalculationItem(
                description="Pool waterproofing system",
                quantity=round(formwork_area, 2),
                unit="m²"
            )
        ]
        
        summary = {
            "pool_volume": round(request.length * request.width * avg_depth, 2),
            "excavation_volume": round(excavation_volume, 2),
            "concrete_volume": round(total_concrete, 2),
            "reinforcement_weight": round(reinforcement_weight, 2),
            "formwork_area": round(formwork_area, 2)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/basements", response_model=CalculationResponse)
async def calculate_basements(request: BasementsRequest):
    try:
        # Convert mm to m
        wall_thickness = request.wall_thickness / 1000
        floor_thickness = request.floor_thickness / 1000
        
        # Calculate volumes
        excavation_volume = (
            (request.length + 1) * (request.width + 1) * (request.depth + 0.3)
        )
        
        # Concrete volumes
        floor_concrete = request.length * request.width * floor_thickness
        wall_concrete = (
            2 * (request.length * wall_thickness * request.depth) +
            2 * (request.width * wall_thickness * request.depth)
        )
        total_concrete = floor_concrete + wall_concrete
        
        # Reinforcement (100kg per m³)
        reinforcement_weight = total_concrete * 100
        
        # Waterproofing area
        waterproof_area = (
            request.length * request.width +  # Floor
            2 * (request.length * request.depth) +  # Long walls
            2 * (request.width * request.depth)     # Short walls
        ) if request.waterproofing else 0
        
        items = [
            CalculationItem(
                description="E100.1.4 - Excavation for basement, depth 2-5m",
                quantity=round(excavation_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F200.2.2 - Basement floor concrete C25/30",
                quantity=round(floor_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F300.2.2 - Basement wall concrete C25/30",
                quantity=round(wall_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="G600 - Reinforcement for basement",
                quantity=round(reinforcement_weight, 2),
                unit="kg"
            )
        ]
        
        if request.waterproofing:
            items.append(
                CalculationItem(
                    description="Basement waterproofing membrane system",
                    quantity=round(waterproof_area, 2),
                    unit="m²"
                )
            )
        
        summary = {
            "excavation_volume": round(excavation_volume, 2),
            "floor_concrete": round(floor_concrete, 2),
            "wall_concrete": round(wall_concrete, 2),
            "total_concrete": round(total_concrete, 2),
            "reinforcement_weight": round(reinforcement_weight, 2),
            "waterproof_area": round(waterproof_area, 2) if request.waterproofing else 0
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/water_tanks", response_model=CalculationResponse)
async def calculate_water_tanks(request: WaterTanksRequest):
    try:
        # Convert mm to m
        wall_thickness = request.wall_thickness / 1000
        base_thickness = request.base_thickness / 1000
        
        if request.tank_type == "Circular":
            # Calculate diameter from capacity and height
            diameter = math.sqrt(4 * request.capacity / (math.pi * request.height))
            
            # Excavation
            excavation_volume = math.pi * ((diameter + 1) / 2) ** 2 * (request.height + 0.5)
            
            # Concrete volumes
            base_concrete = math.pi * ((diameter / 2) + wall_thickness) ** 2 * base_thickness
            wall_concrete = math.pi * wall_thickness * (diameter + wall_thickness) * request.height
            
        else:  # Rectangular
            # Estimate dimensions (assume square base)
            side_length = math.sqrt(request.capacity / request.height)
            
            # Excavation
            excavation_volume = (side_length + 1) ** 2 * (request.height + 0.5)
            
            # Concrete volumes
            base_concrete = (side_length + 2 * wall_thickness) ** 2 * base_thickness
            wall_concrete = (
                4 * side_length * wall_thickness * request.height +
                4 * wall_thickness ** 2 * request.height
            )
        
        total_concrete = base_concrete + wall_concrete
        
        # Reinforcement (90kg per m³ for water tanks)
        reinforcement_weight = total_concrete * 90
        
        items = [
            CalculationItem(
                description="E100.1.2 - Excavation for water tank, depth 0.25-1m",
                quantity=round(excavation_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F100 - Base concrete C25/30 for water tank",
                quantity=round(base_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="F300.1.2 - Wall concrete C30/37 for water tank",
                quantity=round(wall_concrete, 2),
                unit="m³"
            ),
            CalculationItem(
                description="G600 - Reinforcement for water tank",
                quantity=round(reinforcement_weight, 2),
                unit="kg"
            ),
            CalculationItem(
                description="Water tank waterproofing",
                quantity=round(base_concrete / base_thickness + wall_concrete / wall_thickness, 2),
                unit="m²"
            )
        ]
        
        summary = {
            "capacity": request.capacity,
            "tank_type": request.tank_type,
            "excavation_volume": round(excavation_volume, 2),
            "total_concrete": round(total_concrete, 2),
            "reinforcement_weight": round(reinforcement_weight, 2)
        }
        
        return CalculationResponse(items=items, summary=summary)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/calculate/landscaping", response_model=CalculationResponse)
async def calculate_landscaping(request: LandscapingRequest):
    try:
        # Convert mm to m
        topsoil_depth = request.topsoil_depth / 1000
        
        # Calculate volumes
        topsoil_volume = (request.lawn_area + request.planting_area) * topsoil_depth
        
        # Estimate quantities
        grass_area = request.lawn_area
        plants_number = request.planting_area * 2  # 2 plants per m²
        paving_area = request.paving_area
        
        items = [
            CalculationItem(
                description="E100.1.1 - Site preparation and excavation",
                quantity=round(request.total_area * 0.1, 2),  # 100mm depth
                unit="m³"
            ),
            CalculationItem(
                description="E500.2.1 - Imported topsoil",
                quantity=round(topsoil_volume, 2),
                unit="m³"
            ),
            CalculationItem(
                description="Grass seeding and lawn establishment",
                quantity=round(grass_area, 2),
                unit="m²"
            ),
            CalculationItem(
                description="Planting of shrubs and plants",
                quantity=round(plants_number, 0),
                unit="no"
            ),
            CalculationItem(
                description="Paving stones and installation",
                quantity=round(paving_area, 2),
                unit="m²"
            )]
        