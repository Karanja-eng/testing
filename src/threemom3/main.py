"""
Three-Moment Theorem FastAPI Backend
Professional structural engineering API for continuous beam analysis
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Dict, Optional, Union, Tuple
from enum import Enum
import numpy as np
import uvicorn

app = FastAPI(
    title="Three-Moment Theorem Calculator API",
    description="Professional structural engineering API for continuous beam analysis",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enums
class SupportTypeEnum(str, Enum):
    FIXED = "Fixed"
    PINNED = "Pinned" 
    SIMPLY_SUPPORTED = "Simply Supported"
    FREE = "Free"

class LoadTypeEnum(str, Enum):
    POINT = "Point Load"
    UDL = "Uniformly Distributed Load"
    PARTIAL_UDL = "Partial Uniformly Distributed Load"
    TRIANGULAR = "Triangular Load"
    TRAPEZOIDAL = "Trapezoidal Load"

# Pydantic Models
class LoadModel(BaseModel):
    load_type: LoadTypeEnum
    magnitude: float
    position: float = 0.0
    length: float = 0.0
    magnitude2: float = 0.0  # For trapezoidal loads
    
    @validator('magnitude')
    def magnitude_must_be_nonzero(cls, v):
        if v == 0:
            raise ValueError('Load magnitude cannot be zero')
        return v
    
    @validator('position')
    def position_must_be_positive(cls, v):
        if v < 0:
            raise ValueError('Load position cannot be negative')
        return v

class SupportModel(BaseModel):
    support_type: SupportTypeEnum
    position: float
    
    @validator('position')
    def position_must_be_positive(cls, v):
        if v < 0:
            raise ValueError('Support position cannot be negative')
        return v

class SpanModel(BaseModel):
    length: float
    E: float = 200e9  # Pa
    I: float = 1e-6   # m^4
    loads: List[LoadModel] = []
    
    @validator('length', 'E', 'I')
    def must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('Length, E, and I must be positive')
        return v

class BeamModel(BaseModel):
    spans: List[SpanModel]
    supports: List[SupportModel]
    
    @validator('supports')
    def validate_supports_count(cls, v, values):
        if 'spans' in values and len(v) != len(values['spans']) + 1:
            raise ValueError('Number of supports must be number of spans + 1')
        return v

class BeamResponse(BaseModel):
    support_moments: List[float]
    support_reactions: List[float]
    shear_force_data: List[Dict]
    moment_data: List[Dict]
    moment_due_to_loads_data: List[Dict]
    moment_due_to_supports_data: List[Dict]
    beam_configuration: Dict
    critical_values: Dict
    equations_used: List[str]

# Core Engineering Classes (Simplified for API)
class Load:
    def __init__(self, load_model: LoadModel):
        self.load_type = load_model.load_type
        self.magnitude = load_model.magnitude
        self.position = load_model.position
        self.length = load_model.length if load_model.load_type != LoadTypeEnum.UDL else 0
        self.magnitude2 = load_model.magnitude2

class Support:
    def __init__(self, support_model: SupportModel):
        self.support_type = support_model.support_type
        self.position = support_model.position

class Span:
    def __init__(self, span_model: SpanModel):
        self.length = span_model.length
        self.E = span_model.E
        self.I = span_model.I
        self.EI = span_model.E * span_model.I
        self.loads = [Load(load) for load in span_model.loads]
    
    def calculate_fixed_end_moments(self) -> Tuple[float, float]:
        """Calculate fixed-end moments for this span"""
        M_left = 0.0
        M_right = 0.0
        L = self.length
        
        for load in self.loads:
            if load.load_type == LoadTypeEnum.POINT:
                P = load.magnitude
                a = load.position
                b = L - a
                M_left += -P * a * b**2 / L**2
                M_right += P * a**2 * b / L**2
                
            elif load.load_type == LoadTypeEnum.UDL:
                w = load.magnitude
                M_left += -w * L**2 / 12
                M_right += w * L**2 / 12
                
            elif load.load_type == LoadTypeEnum.PARTIAL_UDL:
                w = load.magnitude
                a = load.position
                c = load.length
                P_eq = w * c
                x_centroid = a + c/2
                a_eq = x_centroid
                b_eq = L - a_eq
                M_left += -P_eq * a_eq * b_eq**2 / L**2
                M_right += P_eq * a_eq**2 * b_eq / L**2
                
            elif load.load_type == LoadTypeEnum.TRIANGULAR:
                w = load.magnitude
                a = load.position
                c = load.length
                P_eq = w * c / 2
                x_centroid = a + 2*c/3
                a_eq = x_centroid
                b_eq = L - a_eq
                if b_eq > 0:
                    M_left += -P_eq * a_eq * b_eq**2 / L**2
                    M_right += P_eq * a_eq**2 * b_eq / L**2
                    
            elif load.load_type == LoadTypeEnum.TRAPEZOIDAL:
                w1 = load.magnitude
                w2 = load.magnitude2
                a = load.position
                c = load.length
                P_eq = (w1 + w2) * c / 2
                if abs(w2 - w1) < 1e-6:
                    x_centroid = a + c/2
                else:
                    x_centroid = a + c * (2*w2 + w1) / (3 * (w1 + w2))
                a_eq = x_centroid
                b_eq = L - a_eq
                if b_eq > 0:
                    M_left += -P_eq * a_eq * b_eq**2 / L**2
                    M_right += P_eq * a_eq**2 * b_eq / L**2
        
        return M_left, M_right
    
    def calculate_area_term(self) -> float:
        """Calculate area term for Three-Moment Theorem"""
        A = 0.0
        L = self.length
        
        for load in self.loads:
            if load.load_type == LoadTypeEnum.POINT:
                P = load.magnitude
                a = load.position
                b = L - a
                A += P * a * b * (L**2 - a**2 - b**2) / (6 * L)
                
            elif load.load_type == LoadTypeEnum.UDL:
                w = load.magnitude
                A += w * L**4 / 24
                
            elif load.load_type == LoadTypeEnum.PARTIAL_UDL:
                w = load.magnitude
                c = load.length
                a = load.position
                P_eq = w * c
                x_centroid = a + c/2
                a_eq = x_centroid
                b_eq = L - a_eq
                A += P_eq * a_eq * b_eq * (L**2 - a_eq**2 - b_eq**2) / (6 * L)
                
            elif load.load_type == LoadTypeEnum.TRIANGULAR:
                w = load.magnitude
                c = load.length
                a = load.position
                P_eq = w * c / 2
                x_centroid = a + 2*c/3
                a_eq = x_centroid
                b_eq = L - a_eq
                if b_eq > 0:
                    A += P_eq * a_eq * b_eq * (L**2 - a_eq**2 - b_eq**2) / (6 * L)
                    
            elif load.load_type == LoadTypeEnum.TRAPEZOIDAL:
                w1 = load.magnitude
                w2 = load.magnitude2
                c = load.length
                a = load.position
                P_eq = (w1 + w2) * c / 2
                if abs(w2 - w1) < 1e-6:
                    x_centroid = a + c/2
                else:
                    x_centroid = a + c * (2*w2 + w1) / (3 * (w1 + w2))
                a_eq = x_centroid
                b_eq = L - a_eq
                if b_eq > 0:
                    A += P_eq * a_eq * b_eq * (L**2 - a_eq**2 - b_eq**2) / (6 * L)
        
        return A / (self.EI * L)

class ContinuousBeamSolver:
    def __init__(self, spans: List[Span], supports: List[Support]):
        self.spans = spans
        self.supports = supports
        self.n_spans = len(spans)
        self.support_moments = [0.0] * (self.n_spans + 1)
        self.reactions = [0.0] * (self.n_spans + 1)
        self.equations_used = []
    
    def solve(self):
        """Solve using Three-Moment Theorem"""
        self._solve_three_moment_equations()
        self._calculate_reactions()
    
    def _solve_three_moment_equations(self):
        """Solve the three-moment equations system"""
        self.equations_used.append("Three-Moment Theorem: M_i*L_i + 2*M_{i+1}*(L_i + L_{i+1}) + M_{i+2}*L_{i+1} = -6*(A_i/L_i + A_{i+1}/L_{i+1})")
        
        # Handle boundary conditions
        for i, support in enumerate(self.supports):
            if support.support_type in [SupportTypeEnum.PINNED, SupportTypeEnum.SIMPLY_SUPPORTED]:
                self.support_moments[i] = 0.0
        
        if self.n_spans == 1:
            # Single span analysis
            left_support = self.supports[0]
            right_support = self.supports[1]
            
            if (left_support.support_type == SupportTypeEnum.FIXED and 
                right_support.support_type == SupportTypeEnum.FIXED):
                M_left, M_right = self.spans[0].calculate_fixed_end_moments()
                self.support_moments[0] = M_left
                self.support_moments[1] = M_right
                self.equations_used.append(f"Fixed-end moments: M_left = {M_left:.2f}, M_right = {M_right:.2f}")
            elif left_support.support_type == SupportTypeEnum.FIXED:
                M_left, _ = self.spans[0].calculate_fixed_end_moments()
                self.support_moments[0] = M_left / 2
                self.equations_used.append("Fixed-pinned beam modification applied")
            elif right_support.support_type == SupportTypeEnum.FIXED:
                _, M_right = self.spans[0].calculate_fixed_end_moments()
                self.support_moments[1] = M_right / 2
                self.equations_used.append("Pinned-fixed beam modification applied")
        else:
            # Multi-span analysis
            self._solve_multi_span_system()
    
    def _solve_multi_span_system(self):
        """Solve system for multi-span beams"""
        unknowns = []
        for i in range(1, self.n_spans):
            if self.supports[i].support_type != SupportTypeEnum.FIXED:
                unknowns.append(i)
        
        if not unknowns:
            return
        
        n_eq = self.n_spans - 1
        A_matrix = np.zeros((n_eq, len(unknowns)))
        b_vector = np.zeros(n_eq)
        
        for eq in range(n_eq):
            i = eq
            L_i = self.spans[i].length
            L_i1 = self.spans[i+1].length
            A_i = self.spans[i].calculate_area_term()
            A_i1 = self.spans[i+1].calculate_area_term()
            
            b_vector[eq] = -6 * (A_i + A_i1)
            
            for j, unknown_idx in enumerate(unknowns):
                if unknown_idx == i:
                    A_matrix[eq, j] += L_i
                elif unknown_idx == i + 1:
                    A_matrix[eq, j] += 2 * (L_i + L_i1)
                elif unknown_idx == i + 2:
                    A_matrix[eq, j] += L_i1
            
            self.equations_used.append(f"Equation {eq+1}: {L_i:.1f}*M{i+1} + {2*(L_i+L_i1):.1f}*M{i+2} + {L_i1:.1f}*M{i+3} = {b_vector[eq]:.2f}")
        
        try:
            if len(unknowns) > 0:
                solution = np.linalg.solve(A_matrix, b_vector)
                for j, unknown_idx in enumerate(unknowns):
                    self.support_moments[unknown_idx] = solution[j]
        except np.linalg.LinAlgError:
            # Fallback for ill-conditioned systems
            for i in range(1, self.n_spans):
                if self.supports[i].support_type != SupportTypeEnum.FIXED:
                    self.support_moments[i] = 0.0
    
    def _calculate_reactions(self):
        """Calculate support reactions"""
        for i in range(len(self.supports)):
            reaction = 0.0
            
            # Left span contribution
            if i > 0:
                span = self.spans[i-1]
                L = span.length
                M_left = self.support_moments[i-1]
                M_right = self.support_moments[i]
                
                reaction += (M_right - M_left) / L
                
                for load in span.loads:
                    if load.load_type == LoadTypeEnum.POINT:
                        P = load.magnitude
                        a = load.position
                        reaction += P * (L - a) / L
                    elif load.load_type == LoadTypeEnum.UDL:
                        w = load.magnitude
                        reaction += w * L / 2
                    elif load.load_type == LoadTypeEnum.PARTIAL_UDL:
                        w = load.magnitude
                        c = load.length
                        a = load.position
                        P_eq = w * c
                        x_centroid = a + c/2
                        reaction += P_eq * (L - x_centroid) / L
                    elif load.load_type == LoadTypeEnum.TRIANGULAR:
                        w = load.magnitude
                        c = load.length
                        a = load.position
                        P_eq = w * c / 2
                        x_centroid = a + 2*c/3
                        reaction += P_eq * (L - x_centroid) / L
                    elif load.load_type == LoadTypeEnum.TRAPEZOIDAL:
                        w1 = load.magnitude
                        w2 = load.magnitude2
                        c = load.length
                        a = load.position
                        P_eq = (w1 + w2) * c / 2
                        if abs(w2 - w1) < 1e-6:
                            x_centroid = a + c/2
                        else:
                            x_centroid = a + c * (2*w2 + w1) / (3 * (w1 + w2))
                        reaction += P_eq * (L - x_centroid) / L
            
            # Right span contribution
            if i < len(self.spans):
                span = self.spans[i]
                L = span.length
                M_left = self.support_moments[i]
                M_right = self.support_moments[i+1]
                
                reaction += (M_left - M_right) / L
                
                for load in span.loads:
                    if load.load_type == LoadTypeEnum.POINT:
                        P = load.magnitude
                        a = load.position
                        reaction += P * a / L
                    elif load.load_type == LoadTypeEnum.UDL:
                        w = load.magnitude
                        reaction += w * L / 2
                    elif load.load_type == LoadTypeEnum.PARTIAL_UDL:
                        w = load.magnitude
                        c = load.length
                        a = load.position
                        P_eq = w * c
                        x_centroid = a + c/2
                        reaction += P_eq * x_centroid / L
                    elif load.load_type == LoadTypeEnum.TRIANGULAR:
                        w = load.magnitude
                        c = load.length
                        a = load.position
                        P_eq = w * c / 2
                        x_centroid = a + 2*c/3
                        reaction += P_eq * x_centroid / L
                    elif load.load_type == LoadTypeEnum.TRAPEZOIDAL:
                        w1 = load.magnitude
                        w2 = load.magnitude2
                        c = load.length
                        a = load.position
                        P_eq = (w1 + w2) * c / 2
                        if abs(w2 - w1) < 1e-6:
                            x_centroid = a + c/2
                        else:
                            x_centroid = a + c * (2*w2 + w1) / (3 * (w1 + w2))
                        reaction += P_eq * x_centroid / L
            
            self.reactions[i] = reaction
    
    def calculate_shear_force(self, span_idx: int, x: float) -> float:
        """Calculate shear force at position x in span"""
        span = self.spans[span_idx]
        V = self.reactions[span_idx]
        
        for load in span.loads:
            if load.load_type == LoadTypeEnum.POINT:
                if load.position <= x:
                    V -= load.magnitude
            elif load.load_type == LoadTypeEnum.UDL:
                if x > load.position:
                    length_covered = min(x - load.position, span.length - load.position)
                    V -= load.magnitude * length_covered
            elif load.load_type == LoadTypeEnum.PARTIAL_UDL:
                if x > load.position:
                    length_covered = min(x - load.position, load.length)
                    V -= load.magnitude * length_covered
            elif load.load_type == LoadTypeEnum.TRIANGULAR:
                if x > load.position:
                    length_covered = min(x - load.position, load.length)
                    w_at_x = load.magnitude * length_covered / load.length
                    V -= 0.5 * w_at_x * length_covered
            elif load.load_type == LoadTypeEnum.TRAPEZOIDAL:
                if x > load.position:
                    length_covered = min(x - load.position, load.length)
                    w1 = load.magnitude
                    w2 = load.magnitude2
                    w_avg = w1 + (w2 - w1) * length_covered / (2 * load.length)
                    V -= w_avg * length_covered
        
        return V
    
    def calculate_moment_due_to_loads(self, span_idx: int, x: float) -> float:
        """Calculate bending moment due to loads only (simple beam moments)"""
        span = self.spans[span_idx]
        M = 0.0
        L = span.length
        
        # Simple beam moment calculation
        total_load = 0.0
        moment_about_left = 0.0
        
        for load in span.loads:
            if load.load_type == LoadTypeEnum.POINT:
                total_load += load.magnitude
                moment_about_left += load.magnitude * load.position
            elif load.load_type == LoadTypeEnum.UDL:
                total_load += load.magnitude * L
                moment_about_left += load.magnitude * L * L / 2
            elif load.load_type == LoadTypeEnum.PARTIAL_UDL:
                P_eq = load.magnitude * load.length
                total_load += P_eq
                moment_about_left += P_eq * (load.position + load.length/2)
            elif load.load_type == LoadTypeEnum.TRIANGULAR:
                P_eq = load.magnitude * load.length / 2
                total_load += P_eq
                moment_about_left += P_eq * (load.position + 2*load.length/3)
            elif load.load_type == LoadTypeEnum.TRAPEZOIDAL:
                P_eq = (load.magnitude + load.magnitude2) * load.length / 2
                total_load += P_eq
                if abs(load.magnitude2 - load.magnitude) < 1e-6:
                    x_centroid = load.position + load.length/2
                else:
                    x_centroid = load.position + load.length * (2*load.magnitude2 + load.magnitude) / (3 * (load.magnitude + load.magnitude2))
                moment_about_left += P_eq * x_centroid
        
        # Simple beam reactions
        if L > 0:
            R_left = (total_load * L - moment_about_left) / L
            R_right = total_load - R_left
        else:
            R_left = R_right = 0
        
        # Moment at x due to left reaction
        M = R_left * x
        
        # Subtract moments from loads to the left of x
        for load in span.loads:
            if load.load_type == LoadTypeEnum.POINT:
                if load.position <= x:
                    M -= load.magnitude * (x - load.position)
            elif load.load_type == LoadTypeEnum.UDL:
                if x > 0:
                    M -= load.magnitude * x**2 / 2
            # Add other load types as needed
        
        return M
    
    def calculate_moment_due_to_supports(self, span_idx: int, x: float) -> float:
        """Calculate bending moment due to support moments only"""
        L = self.spans[span_idx].length
        M_left = self.support_moments[span_idx]
        M_right = self.support_moments[span_idx + 1]
        
        # Linear interpolation of support moments
        return M_left * (1 - x/L) + M_right * (x/L)
    
    def calculate_total_moment(self, span_idx: int, x: float) -> float:
        """Calculate total bending moment (loads + support moments)"""
        return (self.calculate_moment_due_to_loads(span_idx, x) + 
                self.calculate_moment_due_to_supports(span_idx, x))
    
    def get_analysis_data(self) -> dict:
        """Generate all analysis data for frontend"""
        # Generate points for plotting
        all_x = []
        all_V = []
        all_M_total = []
        all_M_loads = []
        all_M_supports = []
        current_pos = 0
        
        for span_idx, span in enumerate(self.spans):
            n_points = 100
            x_local = np.linspace(0, span.length, n_points)
            x_global = x_local + current_pos
            
            V_local = [self.calculate_shear_force(span_idx, x) for x in x_local]
            M_total_local = [self.calculate_total_moment(span_idx, x) for x in x_local]
            M_loads_local = [self.calculate_moment_due_to_loads(span_idx, x) for x in x_local]
            M_supports_local = [self.calculate_moment_due_to_supports(span_idx, x) for x in x_local]
            
            all_x.extend(x_global.tolist())
            all_V.extend(V_local)
            all_M_total.extend(M_total_local)
            all_M_loads.extend(M_loads_local)
            all_M_supports.extend(M_supports_local)
            
            current_pos += span.length
        
        # Format data for frontend
        shear_data = [{"x": x, "y": V} for x, V in zip(all_x, all_V)]
        moment_data = [{"x": x, "y": M} for x, M in zip(all_x, all_M_total)]
        moment_loads_data = [{"x": x, "y": M} for x, M in zip(all_x, all_M_loads)]
        moment_supports_data = [{"x": x, "y": M} for x, M in zip(all_x, all_M_supports)]
        
        # Beam configuration
        beam_config = {
            "spans": [{"length": span.length, "loads": len(span.loads)} for span in self.spans],
            "supports": [{"type": support.support_type.value, "position": support.position} 
                        for support in self.supports],
            "total_length": sum(span.length for span in self.spans)
        }
        
        # Critical values
        critical_values = {
            "max_moment": max(all_M_total) if all_M_total else 0,
            "min_moment": min(all_M_total) if all_M_total else 0,
            "max_shear": max(all_V) if all_V else 0,
            "min_shear": min(all_V) if all_V else 0
        }
        
        return {
            "support_moments": self.support_moments,
            "support_reactions": self.reactions,
            "shear_force_data": shear_data,
            "moment_data": moment_data,
            "moment_due_to_loads_data": moment_loads_data,
            "moment_due_to_supports_data": moment_supports_data,
            "beam_configuration": beam_config,
            "critical_values": critical_values,
            "equations_used": self.equations_used
        }

# API Endpoints
@app.get("/")
async def root():
    return {"message": "Three-Moment Theorem Calculator API", "version": "1.0.0"}

@app.post("/analyze", response_model=BeamResponse)
async def analyze_beam(beam: BeamModel):
    """Analyze continuous beam using Three-Moment Theorem"""
    try:
        # Convert Pydantic models to internal classes
        spans = [Span(span_model) for span_model in beam.spans]
        supports = [Support(support_model) for support_model in beam.supports]
        
        # Solve beam
        solver = ContinuousBeamSolver(spans, supports)
        solver.solve()
        
        # Get analysis data
        data = solver.get_analysis_data()
        
        return BeamResponse(**data)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/examples")
async def get_examples():
    """Get example beam configurations"""
    examples = [
        {
            "name": "Two-Span Continuous Beam",
            "description": "Simple two-span beam with point loads",
            "spans": [
                {"length": 6.0, "E": 200e9, "I": 8.33e-6, "loads": [
                    {"load_type": "Point Load", "magnitude": 50.0, "position": 3.0}
                ]},
                {"length": 8.0, "E": 200e9, "I": 8.33e-6, "loads": [
                    {"load_type": "Point Load", "magnitude": 30.0, "position": 4.0}
                ]}
            ],
            "supports": [
                {"support_type": "Pinned", "position": 0.0},
                {"support_type": "Pinned", "position": 6.0},
                {"support_type": "Pinned", "position": 14.0}
            ]
        },
        {
            "name": "UDL Three-Span Beam",
            "description": "Three spans with uniform distributed loads",
            "spans": [
                {"length": 4.0, "E": 200e9, "I": 1e-5, "loads": [
                    {"load_type": "Uniformly Distributed Load", "magnitude": 20.0}
                ]},
                {"length": 6.0, "E": 200e9, "I": 1e-5, "loads": [
                    {"load_type": "Uniformly Distributed Load", "magnitude": 20.0}
                ]},
                {"length": 4.0, "E": 200e9, "I": 1e-5, "loads": [
                    {"load_type": "Uniformly Distributed Load", "magnitude": 20.0}
                ]}
            ],
            "supports": [
                {"support_type": "Pinned", "position": 0.0},
                {"support_type": "Pinned", "position": 4.0},
                {"support_type": "Pinned", "position": 10.0},
                {"support_type": "Pinned", "position": 14.0}
            ]
        }
    ]
    return examples

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)