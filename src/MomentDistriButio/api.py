from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional
from momentdistribution import MomentDistributionCalculator
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enhanced CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow React frontend
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods for testing (restrict later if needed)
    allow_headers=["*"],  # Allow all headers for testing
    expose_headers=["*"],
)

class Load(BaseModel):
    load_type: str
    magnitude: float
    position: Optional[float] = None

    @validator("load_type")
    def validate_load_type(cls, v):
        if v not in ["none", "udl", "point"]:
            raise ValueError("Load type must be 'none', 'udl', or 'point'")
        return v

class Cantilever(BaseModel):
    length: float
    load: Load

class InputData(BaseModel):
    spans: List[float]
    loads: List[Load]
    supports: List[str]
    settlements: List[float]
    E: float
    I: float
    left_cantilever: Optional[Cantilever] = None
    right_cantilever: Optional[Cantilever] = None

    @validator("spans")
    def validate_spans(cls, v):
        if not v or len(v) < 1:
            raise ValueError("At least one span is required")
        if any(l <= 0 for l in v):
            raise ValueError("Span lengths must be positive")
        return v

    @validator("supports")
    def validate_supports(cls, v, values):
        if "spans" in values and len(v) != len(values["spans"]) + 1:
            raise ValueError("Number of supports must be number of spans + 1")
        if any(s not in ["fixed", "pinned", "roller"] for s in v):
            raise ValueError("Support types must be 'fixed', 'pinned', or 'roller'")
        return v

    @validator("loads")
    def validate_loads(cls, v, values):
        if "spans" in values and len(v) != len(values["spans"]):
            raise ValueError("Number of loads must match number of spans")
        for i, load in enumerate(v):
            if load.load_type == "point" and (load.position is None or load.position < 0 or ("spans" in values and load.position > values["spans"][i])):
                raise ValueError(f"Point load position for span {i+1} is invalid")
        return v

    @validator("settlements")
    def validate_settlements(cls, v, values):
        if "spans" in values and len(v) != len(values["spans"]) + 1:
            raise ValueError("Number of settlements must match number of supports")
        return v

@app.post("/calculate")
async def calculate_moment_distribution(data: InputData):
    logger.info(f"Received POST request with data: {data}")
    try:
        calculator = MomentDistributionCalculator()
        calculator.spans = data.spans
        calculator.loads = [(load.load_type, load.magnitude, load.position) for load in data.loads]
        calculator.supports = data.supports
        calculator.settlements = data.settlements
        calculator.E = data.E
        calculator.I = data.I
        if data.left_cantilever:
            calculator.left_cantilever = (data.left_cantilever.length, data.left_cantilever.load.load_type, data.left_cantilever.load.magnitude, data.left_cantilever.load.position)
        if data.right_cantilever:
            calculator.right_cantilever = (data.right_cantilever.length, data.right_cantilever.load.load_type, data.right_cantilever.load.magnitude, data.right_cantilever.load.position)

        calculator.calculate_stiffness()
        calculator.calculate_distribution_factors()
        calculator.moment_distribution()
        calculator.calculate_reactions()
        x, sf, bm, initial_bm, midspan_bm = calculator.plot_diagrams()  # Unpack five values
        beam_diagram = calculator.plot_beam_diagram()

        response = {
            "moments": [round(m, 2) for m in calculator.moments],  # Support moments (hogging at interior)
            "midspan_moments": midspan_bm,  # Midspan moments (sagging)
            "reactions": [round(r, 2) for r in calculator.reactions],
            "sf_data": [{"x": x_val, "sf": sf_val} for x_val, sf_val in zip(x, sf)],
            "bm_data": [{"x": x_val, "bm": bm_val} for x_val, bm_val in zip(x, bm)],
            "initial_bm_data": [{"x": x_val, "bm": initial_bm_val} for x_val, initial_bm_val in zip(x, initial_bm)],
            "beam_diagram": beam_diagram
        }
        logger.info("Calculation successful, returning response")
        return response
    except Exception as e:
        logger.error(f"Error in calculation: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)