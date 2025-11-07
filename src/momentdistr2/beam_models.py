# models/beam_models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from enum import Enum


class SupportType(str, Enum):
    FIXED = "fixed"
    PINNED = "pinned"
    ROLLER = "roller"
    FREE = "free"


class LoadType(str, Enum):
    POINT = "point"
    UDL = "udl"
    VARYING = "varying"
    MOMENT = "moment"


class PointLoad(BaseModel):
    magnitude: float = Field(..., description="Load magnitude in kN")
    position: float = Field(..., description="Position from left end of span in m")
    span_index: int = Field(..., description="Span index (0-based)")


class UDLLoad(BaseModel):
    magnitude: float = Field(..., description="Load per unit length in kN/m")
    start_position: float = Field(..., description="Start position from left end in m")
    end_position: float = Field(..., description="End position from left end in m")
    span_index: int = Field(..., description="Span index (0-based)")


class VaryingLoad(BaseModel):
    start_magnitude: float = Field(..., description="Load at start in kN/m")
    end_magnitude: float = Field(..., description="Load at end in kN/m")
    start_position: float = Field(..., description="Start position from left end in m")
    end_position: float = Field(..., description="End position from left end in m")
    span_index: int = Field(..., description="Span index (0-based)")


class AppliedMoment(BaseModel):
    magnitude: float = Field(..., description="Moment magnitude in kN.m")
    position: float = Field(..., description="Position from left end of span in m")
    span_index: int = Field(..., description="Span index (0-based)")


class MaterialProperties(BaseModel):
    E: float = Field(default=200000, description="Young's modulus in MPa")
    I: float = Field(..., description="Second moment of area in mm^4")


class BeamInput(BaseModel):
    spans: List[float] = Field(..., description="List of span lengths in meters")
    supports: List[SupportType] = Field(..., description="Support conditions")
    material: MaterialProperties
    point_loads: Optional[List[PointLoad]] = Field(
        default=[], description="Point loads"
    )
    udl_loads: Optional[List[UDLLoad]] = Field(default=[], description="UDL loads")
    varying_loads: Optional[List[VaryingLoad]] = Field(
        default=[], description="Varying loads"
    )
    applied_moments: Optional[List[AppliedMoment]] = Field(
        default=[], description="Applied moments"
    )


class MomentDistributionStep(BaseModel):
    iteration: int
    joint_index: int
    unbalanced_moment: float
    distribution_factors: List[float]
    distributed_moments: List[float]
    carry_over_moments: List[float]


class BeamResults(BaseModel):
    distribution_steps: List[MomentDistributionStep]
    final_moments: List[float]
    support_reactions: List[float]
    sfd_values: List[List[float]]  # Shear force values for each span
    bmd_values: List[List[float]]  # Bending moment values for each span
    sfd_positions: List[List[float]]  # X-positions for SFD points
    bmd_positions: List[List[float]]  # X-positions for BMD points
    convergence_achieved: bool
    max_iterations: int
