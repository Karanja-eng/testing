# models.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal

LoadType = Literal["POINT", "UDL", "PARTIAL_UDL", "TRIANGULAR", "TRAPEZOIDAL"]
SupportType = Literal["FIXED", "PINNED", "FREE"]

class LoadModel(BaseModel):
    load_type: LoadType
    magnitude: float = Field(..., description="kN for point, kN/m for distributed")
    position: Optional[float] = Field(0.0, description="distance from left of span (m)")
    length: Optional[float] = Field(0.0, description="length of distributed load (m), for UDL variants")
    magnitude2: Optional[float] = Field(0.0, description="second intensity for trapezoidal (kN/m)")

    @validator("magnitude")
    def nonzero_magnitude(cls, v):
        if v == 0:
            raise ValueError("magnitude cannot be zero")
        return v

class SpanModel(BaseModel):
    length: float
    E: Optional[float] = 200e9
    I: Optional[float] = 1e-6
    loads: List[LoadModel] = []

class SupportModel(BaseModel):
    support_type: SupportType
    position: float

class ThreeMomentRequest(BaseModel):
    spans: List[SpanModel]
    supports: List[SupportModel]

class BeamDesignRequest(BaseModel):
    # simplified beam design request
    fcu: float = Field(..., description="Concrete cube strength N/mm2")
    fy: float = Field(..., description="Steel yield strength N/mm2")
    b: float = Field(..., description="Breadth mm")
    d: float = Field(..., description="Effective depth mm")
    Mu: float = Field(..., description="Ultimate moment kN·m")
