"""
BS 8110 Reinforced Concrete Beam Design Module
Professional structural design according to British Standard 8110
Integrated with Three-Moment Theorem analysis
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, validator
from typing import List, Dict, Optional, Union, Tuple
from enum import Enum
import numpy as np
import math

# Additional imports for the design module
class BeamType(str, Enum):
    RECTANGULAR = "Rectangular"
    T_BEAM = "T-Beam"
    L_BEAM = "L-Beam"

class SupportCondition(str, Enum):
    SIMPLY_SUPPORTED = "Simply Supported"
    CONTINUOUS = "Continuous" 
    CANTILEVER = "Cantilever"
    FIXED = "Fixed"

class ConcreteGrade(str, Enum):
    C20 = "C20"
    C25 = "C25" 
    C30 = "C30"
    C35 = "C35"
    C40 = "C40"
    C45 = "C45"
    C50 = "C50"

class SteelGrade(str, Enum):
    GRADE_250 = "Grade 250"
    GRADE_460 = "Grade 460"

# Pydantic Models for Design
class MaterialProperties(BaseModel):
    concrete_grade: ConcreteGrade = ConcreteGrade.C30
    steel_grade: SteelGrade = SteelGrade.GRADE_460
    concrete_density: float = 25.0  # kN/m³
    steel_density: float = 78.5     # kN/m³
    
    @property
    def fcu(self) -> float:
        """Characteristic cube strength"""
        grades = {
            "C20": 20, "C25": 25, "C30": 30, "C35": 35,
            "C40": 40, "C45": 45, "C50": 50
        }
        # concrete_grade is an Enum; use its value
        return grades[self.concrete_grade.value]
    
    @property
    def fy(self) -> float:
        """Characteristic yield strength of steel"""
        return 250.0 if self.steel_grade == SteelGrade.GRADE_250 else 460.0

class RectangularBeamGeometry(BaseModel):
    width: float  # mm
    depth: float  # mm
    cover: float = 25.0  # mm
    
    @validator('width', 'depth')
    def positive_dimensions(cls, v):
        if v <= 0:
            raise ValueError('Dimensions must be positive')
        return v
    
    @property
    def effective_depth(self) -> float:
        return self.depth - self.cover - 10.0  # Assuming 20mm dia bars

class TBeamGeometry(BaseModel):
    web_width: float      # mm
    web_depth: float      # mm
    flange_width: float   # mm
    flange_thickness: float # mm
    cover: float = 25.0   # mm
    
    @validator('web_width', 'web_depth', 'flange_width', 'flange_thickness')
    def positive_dimensions(cls, v):
        if v <= 0:
            raise ValueError('Dimensions must be positive')
        return v
    
    @property
    def total_depth(self) -> float:
        return self.web_depth + self.flange_thickness
    
    @property
    def effective_depth(self) -> float:
        return self.total_depth - self.cover - 10.0

class LBeamGeometry(BaseModel):
    web_width: float      # mm
    web_depth: float      # mm
    flange_width: float   # mm
    flange_thickness: float # mm
    cover: float = 25.0   # mm
    
    @property
    def total_depth(self) -> float:
        return self.web_depth + self.flange_thickness
    
    @property
    def effective_depth(self) -> float:
        return self.total_depth - self.cover - 10.0

class BeamDesignRequest(BaseModel):
    beam_type: BeamType
    support_condition: SupportCondition
    span_length: float  # m
    
    # Geometry (use appropriate one based on beam_type)
    rectangular_geometry: Optional[RectangularBeamGeometry] = None
    t_beam_geometry: Optional[TBeamGeometry] = None
    l_beam_geometry: Optional[LBeamGeometry] = None
    
    # Material properties
    materials: MaterialProperties = MaterialProperties()
    
    # Design forces from Three-Moment analysis
    design_moments: List[float]  # kN⋅m at critical locations
    design_shears: List[float]   # kN at critical locations
    moment_positions: List[float] # m from left end
    shear_positions: List[float]  # m from left end
    
    # Loading
    imposed_load: float = 0.0    # kN/m
    permanent_load: float = 0.0  # kN/m (excluding self-weight)
    
    @validator('design_moments', 'design_shears')
    def non_empty_forces(cls, v):
        if not v:
            raise ValueError('Design forces cannot be empty')
        return v

class ReinforcementDetails(BaseModel):
    main_bars: List[int]  # Bar diameters in mm
    main_bars_area: float # mm²
    shear_links: int      # Link diameter in mm
    link_spacing: float   # mm
    minimum_steel_provided: bool
    steel_ratio: float    # As/(b*d)

class DesignChecks(BaseModel):
    moment_capacity_ok: bool
    shear_capacity_ok: bool
    deflection_ok: bool
    minimum_steel_ok: bool
    maximum_steel_ok: bool
    spacing_ok: bool
    
    moment_utilization: float  # M_design / M_capacity
    shear_utilization: float   # V_design / V_capacity
    
    warnings: List[str] = []
    errors: List[str] = []

class BeamDesignResponse(BaseModel):
    beam_geometry: Dict
    materials_used: MaterialProperties
    design_summary: Dict
    reinforcement: ReinforcementDetails
    design_checks: DesignChecks
    calculations_summary: List[str]
    cost_estimate: Optional[Dict] = None

class BS8110BeamDesigner:
    """BS 8110 Reinforced Concrete Beam Designer"""
    
    def __init__(self):
        # BS 8110 constants
        self.gamma_c = 1.5  # Partial safety factor for concrete
        self.gamma_s = 1.15 # Partial safety factor for steel
        self.gamma_f = 1.4  # Load factor for permanent loads
        self.gamma_q = 1.6  # Load factor for imposed loads
        
    def design_beam(self, request: BeamDesignRequest) -> BeamDesignResponse:
        """Main design method"""
        try:
            # Get geometry
            geometry = self._get_geometry(request)
            
            # Calculate design forces
            design_forces = self._calculate_design_forces(request)
            
            # Design for flexure
            flexural_design = self._design_flexure(geometry, request.materials, design_forces)
            
            # Design for shear
            shear_design = self._design_shear(geometry, request.materials, design_forces)
            
            # Check deflection
            deflection_check = self._check_deflection(geometry, request, flexural_design)
            
            # Check minimum and maximum steel
            steel_checks = self._check_steel_limits(geometry, request.materials, flexural_design)
            
            # Combine reinforcement
            reinforcement = self._combine_reinforcement(flexural_design, shear_design)
            
            # Perform design checks
            checks = self._perform_design_checks(
                geometry, request.materials, design_forces, 
                flexural_design, shear_design, deflection_check, steel_checks
            )
            
            # Create response
            return BeamDesignResponse(
                beam_geometry=self._format_geometry(geometry, request.beam_type),
                materials_used=request.materials,
                design_summary=design_forces,
                reinforcement=reinforcement,
                design_checks=checks,
                calculations_summary=self._generate_calculations_summary(
                    request, geometry, design_forces, flexural_design, shear_design
                ),
                cost_estimate=self._estimate_cost(geometry, reinforcement, request.materials)
            )
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Design failed: {str(e)}")
    
    def _get_geometry(self, request: BeamDesignRequest) -> Dict:
        """Extract geometry based on beam type"""
        if request.beam_type == BeamType.RECTANGULAR:
            if not request.rectangular_geometry:
                raise ValueError("Rectangular geometry required")
            return {
                'type': 'rectangular',
                'width': request.rectangular_geometry.width,
                'depth': request.rectangular_geometry.depth,
                'effective_depth': request.rectangular_geometry.effective_depth,
                'cover': request.rectangular_geometry.cover
            }
        elif request.beam_type == BeamType.T_BEAM:
            if not request.t_beam_geometry:
                raise ValueError("T-beam geometry required")
            return {
                'type': 't_beam',
                'web_width': request.t_beam_geometry.web_width,
                'web_depth': request.t_beam_geometry.web_depth,
                'flange_width': request.t_beam_geometry.flange_width,
                'flange_thickness': request.t_beam_geometry.flange_thickness,
                'total_depth': request.t_beam_geometry.total_depth,
                'effective_depth': request.t_beam_geometry.effective_depth,
                'cover': request.t_beam_geometry.cover
            }
        elif request.beam_type == BeamType.L_BEAM:
            if not request.l_beam_geometry:
                raise ValueError("L-beam geometry required")
            return {
                'type': 'l_beam',
                'web_width': request.l_beam_geometry.web_width,
                'web_depth': request.l_beam_geometry.web_depth,
                'flange_width': request.l_beam_geometry.flange_width,
                'flange_thickness': request.l_beam_geometry.flange_thickness,
                'total_depth': request.l_beam_geometry.total_depth,
                'effective_depth': request.l_beam_geometry.effective_depth,
                'cover': request.l_beam_geometry.cover
            }
    
    def _calculate_design_forces(self, request: BeamDesignRequest) -> Dict:
        """Calculate design forces with BS 8110 load factors"""
        
        # Apply load factors
        max_moment = max(abs(m) for m in request.design_moments)
        max_shear = max(abs(v) for v in request.design_shears)
        
        # Self-weight calculation
        geometry = self._get_geometry(request)
        self_weight = self._calculate_self_weight(geometry, request.materials)
        
        # Total permanent load
        total_permanent = request.permanent_load + self_weight
        
        # Factored loads
        factored_permanent = self.gamma_f * total_permanent
        factored_imposed = self.gamma_q * request.imposed_load
        
        return {
            'max_design_moment': max_moment,
            'max_design_shear': max_shear,
            'self_weight': self_weight,
            'total_permanent_load': total_permanent,
            'factored_permanent_load': factored_permanent,
            'factored_imposed_load': factored_imposed,
            'moment_envelope': request.design_moments,
            'shear_envelope': request.design_shears,
            'moment_positions': request.moment_positions,
            'shear_positions': request.shear_positions
        }
    
    def _calculate_self_weight(self, geometry: Dict, materials: MaterialProperties) -> float:
        """Calculate self-weight of beam"""
        if geometry['type'] == 'rectangular':
            area = geometry['width'] * geometry['depth'] * 1e-6  # m²
        elif geometry['type'] == 't_beam':
            flange_area = geometry['flange_width'] * geometry['flange_thickness']
            web_area = geometry['web_width'] * (geometry['web_depth'])
            area = (flange_area + web_area) * 1e-6  # m²
        elif geometry['type'] == 'l_beam':
            flange_area = geometry['flange_width'] * geometry['flange_thickness']
            web_area = geometry['web_width'] * geometry['web_depth']
            area = (flange_area + web_area) * 1e-6  # m²
        
        return area * materials.concrete_density  # kN/m
    
    def _design_flexure(self, geometry: Dict, materials: MaterialProperties, forces: Dict) -> Dict:
        """Design for flexural reinforcement according to BS 8110"""
        
        M = forces['max_design_moment'] * 1e6  # Convert to N⋅mm
        
        if geometry['type'] == 'rectangular':
            return self._design_rectangular_flexure(geometry, materials, M)
        elif geometry['type'] == 't_beam':
            return self._design_t_beam_flexure(geometry, materials, M)
        elif geometry['type'] == 'l_beam':
            return self._design_l_beam_flexure(geometry, materials, M)
    
    def _design_rectangular_flexure(self, geometry: Dict, materials: MaterialProperties, M: float) -> Dict:
        """Design rectangular beam for flexure"""
        
        b = geometry['width']  # mm
        d = geometry['effective_depth']  # mm
        fcu = materials.fcu  # N/mm²
        fy = materials.fy   # N/mm²
        
        # Design concrete stress (BS 8110 Clause 3.4.4.4)
        fcc = 0.67 * fcu / self.gamma_c  # = 0.447 * fcu for normal weight concrete
        
        # Design steel stress
        fs = fy / self.gamma_s
        
        # Calculate K = M/(fcc × b × d²)
        K = M / (fcc * b * d**2)
        
        # Determine if compression steel is needed
        K_bal = 0.156  # Balanced section constant for BS 8110
        
        calculations = []
        calculations.append(f"Design moment M = {M/1e6:.2f} kN⋅m")
        calculations.append(f"Concrete design strength fcc = 0.67 × {fcu} / 1.5 = {fcc:.2f} N/mm²")
        calculations.append(f"Steel design strength fs = {fy} / 1.15 = {fs:.2f} N/mm²")
        calculations.append(f"K = M/(fcc × b × d²) = {K:.4f}")
        
        if K <= K_bal:
            # Singly reinforced section
            calculations.append("K ≤ 0.156, singly reinforced section")
            
            # Calculate lever arm
            z = d * (0.5 + math.sqrt(0.25 - K/0.9))
            if z > 0.95 * d:
                z = 0.95 * d
                calculations.append(f"Lever arm z = 0.95d = {z:.1f} mm (limited)")
            else:
                calculations.append(f"Lever arm z = {z:.1f} mm")
            
            # Calculate required steel area
            As_req = M / (fs * z)
            calculations.append(f"Required steel area As = M/(fs × z) = {As_req:.0f} mm²")
            
            # Check minimum steel (BS 8110 Clause 3.12.5.3)
            As_min = 0.13 * b * d / 100  # 0.13% of gross concrete area
            As_provided = max(As_req, As_min)
            
            if As_provided > As_req:
                calculations.append(f"Minimum steel controls: As,min = {As_min:.0f} mm²")
            
            return {
                'type': 'singly_reinforced',
                'As_tension': As_provided,
                'As_compression': 0.0,
                'lever_arm': z,
                'moment_capacity': As_provided * fs * z / 1e6,
                'calculations': calculations,
                'steel_ratio': As_provided / (b * d) * 100
            }
        else:
            # Doubly reinforced section
            calculations.append("K > 0.156, doubly reinforced section required")
            
            # Moment carried by concrete and minimum compression steel
            M1 = K_bal * fcc * b * d**2
            M2 = M - M1
            
            calculations.append(f"Moment by concrete M1 = {M1/1e6:.2f} kN⋅m")
            calculations.append(f"Additional moment M2 = {M2/1e6:.2f} kN⋅m")
            
            # Compression steel
            d_dash = geometry['cover'] + 10  # Assuming 20mm bars, 10mm to center
            fs_comp = fs  # Assume compression steel yields
            As_comp = M2 / (fs_comp * (d - d_dash))
            
            # Tension steel
            As1 = M1 / (fs * 0.87 * d)  # From balanced section
            As2 = M2 / (fs * (d - d_dash))  # Additional steel
            As_tension = As1 + As2
            
            calculations.append(f"Compression steel As' = {As_comp:.0f} mm²")
            calculations.append(f"Tension steel As = {As_tension:.0f} mm²")
            
            return {
                'type': 'doubly_reinforced',
                'As_tension': As_tension,
                'As_compression': As_comp,
                'lever_arm': 0.87 * d,
                'moment_capacity': M / 1e6,
                'calculations': calculations,
                'steel_ratio': As_tension / (b * d) * 100
            }
    
    def _design_t_beam_flexure(self, geometry: Dict, materials: MaterialProperties, M: float) -> Dict:
        """Design T-beam for flexure"""
        
        bf = geometry['flange_width']  # mm
        hf = geometry['flange_thickness']  # mm
        bw = geometry['web_width']  # mm
        d = geometry['effective_depth']  # mm
        fcu = materials.fcu
        fy = materials.fy
        
        fcc = 0.67 * fcu / self.gamma_c
        fs = fy / self.gamma_s
        
        calculations = []
        calculations.append(f"T-beam design for M = {M/1e6:.2f} kN⋅m")
        calculations.append(f"Flange: {bf} × {hf} mm, Web: {bw} × {geometry['web_depth']} mm")
        
        # Check if neutral axis is in flange
        # Moment capacity if entire flange is in compression
        Mf = fcc * bf * hf * (d - hf/2)
        
        if M <= Mf:
            # Neutral axis in flange - design as rectangular beam
            calculations.append("Neutral axis in flange - designing as rectangular beam")
            result = self._design_rectangular_flexure(
                {'width': bf, 'effective_depth': d, 'cover': geometry['cover']},
                materials, M
            )
            result['calculations'] = calculations + result['calculations']
            return result
        else:
            # Neutral axis in web
            calculations.append("Neutral axis in web")
            
            # Moment carried by flange overhang
            Mf_overhang = fcc * (bf - bw) * hf * (d - hf/2)
            
            # Remaining moment to be carried by web
            Mw = M - Mf_overhang
            
            calculations.append(f"Moment by flange overhang = {Mf_overhang/1e6:.2f} kN⋅m")
            calculations.append(f"Moment by web = {Mw/1e6:.2f} kN⋅m")
            
            # Design web as rectangular beam
            web_result = self._design_rectangular_flexure(
                {'width': bw, 'effective_depth': d, 'cover': geometry['cover']},
                materials, Mw
            )
            
            # Steel area for flange overhang
            As_flange = fcc * (bf - bw) * hf / fs
            
            # Total steel area
            As_total = web_result['As_tension'] + As_flange
            
            calculations.append(f"Steel for flange overhang = {As_flange:.0f} mm²")
            calculations.append(f"Steel for web = {web_result['As_tension']:.0f} mm²")
            calculations.append(f"Total tension steel = {As_total:.0f} mm²")
            
            return {
                'type': 't_beam',
                'As_tension': As_total,
                'As_compression': web_result.get('As_compression', 0),
                'As_flange': As_flange,
                'As_web': web_result['As_tension'],
                'lever_arm': web_result['lever_arm'],
                'moment_capacity': M / 1e6,
                'calculations': calculations + web_result['calculations'],
                'steel_ratio': As_total / (bf * d) * 100
            }
    
    def _design_l_beam_flexure(self, geometry: Dict, materials: MaterialProperties, M: float) -> Dict:
        """Design L-beam for flexure"""
        # Similar to T-beam but with flange on one side only
        # For simplicity, using T-beam method with reduced effective flange width
        
        # Effective flange width for L-beam (conservative approach)
        effective_bf = geometry['web_width'] + geometry['flange_width']
        
        # Create modified geometry for T-beam analysis
        modified_geometry = geometry.copy()
        modified_geometry['flange_width'] = effective_bf
        
        result = self._design_t_beam_flexure(modified_geometry, materials, M)
        result['calculations'].insert(0, f"L-beam analysis using effective flange width = {effective_bf} mm")
        
        return result
    
    def _design_shear(self, geometry: Dict, materials: MaterialProperties, forces: Dict) -> Dict:
        """Design for shear according to BS 8110"""
        
        V = max(abs(v) for v in forces['shear_envelope']) * 1000  # Convert to N
        
        if geometry['type'] == 'rectangular':
            bw = geometry['width']
        else:
            bw = geometry['web_width']
        
        d = geometry['effective_depth']
        fcu = materials.fcu
        fy = materials.fy
        
        calculations = []
        calculations.append(f"Design shear force V = {V/1000:.1f} kN")
        calculations.append(f"Web width bw = {bw} mm, Effective depth d = {d:.0f} mm")
        
        # Design shear stress
        v = V / (bw * d)  # N/mm²
        calculations.append(f"Design shear stress v = V/(bw×d) = {v:.2f} N/mm²")
        
        # Concrete shear stress (BS 8110 Table 3.8)
        # This is simplified - actual calculation depends on steel ratio
        steel_ratio = 1.0  # Assumed for initial calculation, will be updated
        
        if fcu <= 25:
            vc = 0.79 * math.pow(steel_ratio * fcu / 25, 1/3) / self.gamma_c
        else:
            vc = 0.79 * math.pow(steel_ratio * 25 / 25, 1/3) * math.pow(fcu/25, 1/3) / self.gamma_c
        
        vc = max(vc, 0.4)  # Minimum value
        vc = min(vc, 5.0)  # Maximum value for normal weight concrete
        
        calculations.append(f"Concrete shear stress vc = {vc:.2f} N/mm²")
        
        if v <= vc:
            # Minimum links only
            calculations.append("v ≤ vc, minimum links required")
            
            # Minimum link requirements (BS 8110 Clause 3.4.5.5)
            Asv_min = 0.4 * bw / fy  # mm²/mm
            
            # Try standard link sizes and spacings
            link_options = [6, 8, 10, 12]  # mm diameters
            spacing_options = [300, 250, 200, 150, 100]  # mm
            
            selected_link = 8  # mm
            selected_spacing = 300  # mm
            
            for link_dia in link_options:
                for spacing in spacing_options:
                    Asv_provided = 2 * math.pi * (link_dia/2)**2 / spacing  # 2-leg links
                    if Asv_provided >= Asv_min:
                        selected_link = link_dia
                        selected_spacing = spacing
                        break
                if Asv_provided >= Asv_min:
                    break
            
            calculations.append(f"Minimum links: {selected_link}mm @ {selected_spacing}mm c/c")
            
            return {
                'links_required': True,
                'link_diameter': selected_link,
                'link_spacing': selected_spacing,
                'shear_capacity': vc * bw * d / 1000,  # kN
                'link_area_provided': 2 * math.pi * (selected_link/2)**2,  # mm²
                'calculations': calculations
            }
        else:
            # Design links for shear
            calculations.append("v > vc, design links required")
            
            # Required link area per unit length
            vs_req = v - vc  # Additional shear to be carried by links
            Asv_req = vs_req * bw / (0.87 * fy)  # mm²/mm
            
            calculations.append(f"Additional shear stress vs = {vs_req:.2f} N/mm²")
            calculations.append(f"Required link area Asv = {Asv_req:.4f} mm²/mm")
            
            # Design links
            link_options = [8, 10, 12, 16, 20]
            spacing_options = [300, 250, 200, 150, 100, 75, 50]
            
            selected_link = None
            selected_spacing = None
            
            for link_dia in link_options:
                for spacing in spacing_options:
                    Asv_provided = 2 * math.pi * (link_dia/2)**2 / spacing  # 2-leg links
                    if Asv_provided >= Asv_req:
                        selected_link = link_dia
                        selected_spacing = spacing
                        break
                if selected_link:
                    break
            
            if not selected_link:
                # Need larger links or closer spacing
                selected_link = 12
                selected_spacing = 50
                calculations.append("WARNING: Very close link spacing required")
            
            # Check maximum spacing limits (BS 8110)
            max_spacing = min(0.75 * d, 300)  # mm
            if selected_spacing > max_spacing:
                selected_spacing = max_spacing
                calculations.append(f"Spacing limited to {max_spacing} mm")
            
            calculations.append(f"Design links: {selected_link}mm @ {selected_spacing}mm c/c")
            
            # Calculate shear capacity
            Asv_provided = 2 * math.pi * (selected_link/2)**2 / selected_spacing
            vs_provided = Asv_provided * 0.87 * fy / bw
            v_capacity = vc + vs_provided
            
            calculations.append(f"Shear capacity = {v_capacity:.2f} N/mm²")
            
            return {
                'links_required': True,
                'link_diameter': selected_link,
                'link_spacing': selected_spacing,
                'shear_capacity': v_capacity * bw * d / 1000,  # kN
                'link_area_provided': 2 * math.pi * (selected_link/2)**2,
                'calculations': calculations
            }
    
    def _check_deflection(self, geometry: Dict, request: BeamDesignRequest, flexural_design: Dict) -> Dict:
        """Check deflection according to BS 8110"""
        
        # Basic span/depth ratios (BS 8110 Table 3.10)
        span = request.span_length * 1000  # mm
        
        if geometry['type'] == 'rectangular':
            d = geometry['effective_depth']
        else:
            d = geometry['effective_depth']
        
        # Basic ratios
        if request.support_condition == SupportCondition.SIMPLY_SUPPORTED:
            basic_ratio = 20
        elif request.support_condition == SupportCondition.CONTINUOUS:
            basic_ratio = 26
        elif request.support_condition == SupportCondition.CANTILEVER:
            basic_ratio = 7
        else:
            basic_ratio = 20  # Conservative
        
        # Modification factors
        steel_ratio = flexural_design['steel_ratio']
        
        # Steel ratio modification (simplified)
        if steel_ratio <= 0.5:
            mod_factor = 2.0
        elif steel_ratio <= 1.0:
            mod_factor = 1.4 + (2.0 - 1.4) * (1.0 - steel_ratio) / 0.5
        elif steel_ratio <= 1.5:
            mod_factor = 1.2 + (1.4 - 1.2) * (1.5 - steel_ratio) / 0.5
        else:
            mod_factor = 1.0
        
        # Compression steel modification (if present)
        if flexural_design.get('As_compression', 0) > 0:
            comp_ratio = flexural_design['As_compression'] / flexural_design['As_tension']
            comp_factor = 1.0 + comp_ratio / 3.0
        else:
            comp_factor = 1.0
        
        allowable_ratio = basic_ratio * mod_factor * comp_factor
        actual_ratio = span / d
        
        calculations = []
        calculations.append(f"Deflection check:")
        calculations.append(f"Basic span/depth ratio = {basic_ratio}")
        calculations.append(f"Steel ratio modification factor = {mod_factor:.2f}")
        calculations.append(f"Compression steel factor = {comp_factor:.2f}")
        calculations.append(f"Allowable span/depth ratio = {allowable_ratio:.1f}")
        calculations.append(f"Actual span/depth ratio = {actual_ratio:.1f}")
        
        deflection_ok = actual_ratio <= allowable_ratio
        
        if deflection_ok:
            calculations.append("✓ Deflection check PASSED")
        else:
            calculations.append("✗ Deflection check FAILED - increase depth")
        
        return {
            'deflection_ok': deflection_ok,
            'allowable_ratio': allowable_ratio,
            'actual_ratio': actual_ratio,
            'calculations': calculations
        }
    
    def _check_steel_limits(self, geometry: Dict, materials: MaterialProperties, flexural_design: Dict) -> Dict:
        """Check minimum and maximum steel requirements"""
        
        if geometry['type'] == 'rectangular':
            b = geometry['width']
        else:
            b = geometry['web_width']  # Use web width for T/L beams
            
        d = geometry['effective_depth']
        gross_area = b * d
        
        # Minimum steel (BS 8110 Clause 3.12.5.3)
        As_min = 0.13 * gross_area / 100  # 0.13%
        
        # Maximum steel (BS 8110 Clause 3.12.5.2)
        As_max = 4.0 * gross_area / 100  # 4.0%
        
        As_provided = flexural_design['As_tension']
        
        calculations = []
        calculations.append(f"Steel limit checks:")
        calculations.append(f"Minimum steel (0.13%) = {As_min:.0f} mm²")
        calculations.append(f"Maximum steel (4.0%) = {As_max:.0f} mm²")
        calculations.append(f"Provided steel = {As_provided:.0f} mm²")
        
        min_steel_ok = As_provided >= As_min
        max_steel_ok = As_provided <= As_max
        
        if min_steel_ok:
            calculations.append("✓ Minimum steel requirement satisfied")
        else:
            calculations.append("✗ Minimum steel requirement NOT satisfied")
            
        if max_steel_ok:
            calculations.append("✓ Maximum steel requirement satisfied")
        else:
            calculations.append("✗ Maximum steel requirement exceeded")
        
        return {
            'minimum_steel_ok': min_steel_ok,
            'maximum_steel_ok': max_steel_ok,
            'As_min': As_min,
            'As_max': As_max,
            'As_provided': As_provided,
            'calculations': calculations
        }
    
    def _combine_reinforcement(self, flexural_design: Dict, shear_design: Dict) -> ReinforcementDetails:
        """Combine flexural and shear reinforcement details"""
        
        # Convert steel area to bar sizes
        As_required = flexural_design['As_tension']
        
        # Standard bar sizes (mm)
        bar_sizes = [12, 16, 20, 25, 32, 40]
        bar_areas = {12: 113, 16: 201, 20: 314, 25: 491, 32: 804, 40: 1257}  # mm²
        
        # Find suitable combination
        main_bars = []
        remaining_area = As_required
        
        # Start with larger bars
        for bar_size in reversed(bar_sizes):
            if remaining_area > 0:
                n_bars = int(remaining_area / bar_areas[bar_size])
                if n_bars > 0:
                    main_bars.extend([bar_size] * n_bars)
                    remaining_area -= n_bars * bar_areas[bar_size]
        
        # Add smaller bars if needed
        if remaining_area > 50:  # If significant area remaining
            for bar_size in bar_sizes:
                if bar_areas[bar_size] >= remaining_area * 0.8:  # Within 20%
                    main_bars.append(bar_size)
                    break
        
        # Calculate provided area
        main_bars_area = sum(bar_areas.get(bar, 0) for bar in main_bars)
        
        # Steel ratio
        if flexural_design['type'] == 'rectangular':
            steel_ratio = flexural_design['steel_ratio']
        else:
            steel_ratio = main_bars_area / (flexural_design.get('effective_area', 100000)) * 100
        
        return ReinforcementDetails(
            main_bars=sorted(main_bars, reverse=True),
            main_bars_area=main_bars_area,
            shear_links=shear_design['link_diameter'],
            link_spacing=shear_design['link_spacing'],
            minimum_steel_provided=main_bars_area >= As_required,
            steel_ratio=steel_ratio
        )
    
    def _perform_design_checks(self, geometry: Dict, materials: MaterialProperties, 
                             forces: Dict, flexural_design: Dict, shear_design: Dict,
                             deflection_check: Dict, steel_checks: Dict) -> DesignChecks:
        """Perform all design checks"""
        
        warnings = []
        errors = []
        
        # Moment capacity check
        M_design = forces['max_design_moment']
        M_capacity = flexural_design['moment_capacity']
        moment_utilization = M_design / M_capacity if M_capacity > 0 else 0
        moment_capacity_ok = moment_utilization <= 1.0
        
        if moment_utilization > 0.9:
            warnings.append(f"High moment utilization: {moment_utilization:.2f}")
        if not moment_capacity_ok:
            errors.append("Moment capacity insufficient")
        
        # Shear capacity check
        V_design = max(abs(v) for v in forces['shear_envelope'])
        V_capacity = shear_design['shear_capacity']
        shear_utilization = V_design / V_capacity if V_capacity > 0 else 0
        shear_capacity_ok = shear_utilization <= 1.0
        
        if shear_utilization > 0.9:
            warnings.append(f"High shear utilization: {shear_utilization:.2f}")
        if not shear_capacity_ok:
            errors.append("Shear capacity insufficient")
        
        # Spacing checks
        spacing_ok = True
        if shear_design['link_spacing'] < 50:
            warnings.append("Very close link spacing - consider larger links")
        if shear_design['link_spacing'] > 300:
            warnings.append("Link spacing exceeds typical maximum")
        
        return DesignChecks(
            moment_capacity_ok=moment_capacity_ok,
            shear_capacity_ok=shear_capacity_ok,
            deflection_ok=deflection_check['deflection_ok'],
            minimum_steel_ok=steel_checks['minimum_steel_ok'],
            maximum_steel_ok=steel_checks['maximum_steel_ok'],
            spacing_ok=spacing_ok,
            moment_utilization=moment_utilization,
            shear_utilization=shear_utilization,
            warnings=warnings,
            errors=errors
        )
    
    def _format_geometry(self, geometry: Dict, beam_type: BeamType) -> Dict:
        """Format geometry for response"""
        formatted = {
            'beam_type': beam_type.value,
            'effective_depth': geometry['effective_depth'],
            'cover': geometry['cover']
        }
        
        if beam_type == BeamType.RECTANGULAR:
            formatted.update({
                'width': geometry['width'],
                'depth': geometry['depth']
            })
        elif beam_type == BeamType.T_BEAM:
            formatted.update({
                'web_width': geometry['web_width'],
                'web_depth': geometry['web_depth'],
                'flange_width': geometry['flange_width'],
                'flange_thickness': geometry['flange_thickness'],
                'total_depth': geometry['total_depth']
            })
        elif beam_type == BeamType.L_BEAM:
            formatted.update({
                'web_width': geometry['web_width'],
                'web_depth': geometry['web_depth'],
                'flange_width': geometry['flange_width'],
                'flange_thickness': geometry['flange_thickness'],
                'total_depth': geometry['total_depth']
            })
        
        return formatted
    
    def _generate_calculations_summary(self, request: BeamDesignRequest, geometry: Dict,
                                     forces: Dict, flexural_design: Dict, shear_design: Dict) -> List[str]:
        """Generate comprehensive calculations summary"""
        
        summary = []
        summary.append("=== BS 8110 REINFORCED CONCRETE BEAM DESIGN ===")
        summary.append("")
        summary.append(f"Beam Type: {request.beam_type.value}")
        summary.append(f"Support Condition: {request.support_condition.value}")
        summary.append(f"Span Length: {request.span_length} m")
        summary.append("")
        summary.append("MATERIAL PROPERTIES:")
        summary.append(f"Concrete Grade: {request.materials.concrete_grade.value} (fcu = {request.materials.fcu} N/mm²)")
        summary.append(f"Steel Grade: {request.materials.steel_grade.value} (fy = {request.materials.fy} N/mm²)")
        summary.append("")
        summary.append("DESIGN FORCES:")
        summary.extend([f"  {line}" for line in forces.get('summary', [])])
        summary.append("")
        summary.append("FLEXURAL DESIGN:")
        summary.extend([f"  {line}" for line in flexural_design.get('calculations', [])])
        summary.append("")
        summary.append("SHEAR DESIGN:")
        summary.extend([f"  {line}" for line in shear_design.get('calculations', [])])
        
        return summary
    
    def _estimate_cost(self, geometry: Dict, reinforcement: ReinforcementDetails, 
                      materials: MaterialProperties) -> Dict:
        """Estimate material costs (simplified)"""
        
        # Calculate concrete volume
        if geometry['type'] == 'rectangular':
            volume = geometry['width'] * geometry['depth'] * 1e-9  # m³ per meter length
        elif geometry['type'] == 't_beam':
            flange_vol = geometry['flange_width'] * geometry['flange_thickness']
            web_vol = geometry['web_width'] * geometry['web_depth']
            volume = (flange_vol + web_vol) * 1e-9  # m³ per meter length
        else:  # L-beam
            flange_vol = geometry['flange_width'] * geometry['flange_thickness']
            web_vol = geometry['web_width'] * geometry['web_depth']
            volume = (flange_vol + web_vol) * 1e-9  # m³ per meter length
        
        # Steel weight
        steel_density = 7850  # kg/m³
        main_steel_weight = reinforcement.main_bars_area * 1e-6 * steel_density  # kg per meter
        
        # Rough link weight (simplified)
        link_weight = 0.5  # kg per meter (approximate)
        
        total_steel_weight = main_steel_weight + link_weight
        
        # Cost estimates (simplified - actual costs vary by location and time)
        concrete_rate = 100  # per m³
        steel_rate = 1.5  # per kg
        
        concrete_cost = volume * concrete_rate
        steel_cost = total_steel_weight * steel_rate
        total_cost = concrete_cost + steel_cost
        
        return {
            'concrete_volume_per_meter': volume,
            'steel_weight_per_meter': total_steel_weight,
            'concrete_cost_per_meter': concrete_cost,
            'steel_cost_per_meter': steel_cost,
            'total_cost_per_meter': total_cost,
            'currency': 'GBP'  # Assuming British Pounds for BS 8110
        }

# Additional API endpoints for beam design
def add_beam_design_endpoints(app: FastAPI):
    """Add beam design endpoints to FastAPI app"""
    
    designer = BS8110BeamDesigner()
    
    @app.post("/design_beam", response_model=BeamDesignResponse)
    async def design_beam(request: BeamDesignRequest):
        """Design reinforced concrete beam according to BS 8110"""
        try:
            return designer.design_beam(request)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @app.get("/beam_design_examples")
    async def get_beam_design_examples():
        """Get example beam design configurations"""
        examples = [
            {
                "name": "Simple Rectangular Beam",
                "description": "Simply supported rectangular beam with UDL",
                "beam_type": "Rectangular",
                "support_condition": "Simply Supported",
                "span_length": 6.0,
                "rectangular_geometry": {
                    "width": 300,
                    "depth": 500,
                    "cover": 25
                },
                "materials": {
                    "concrete_grade": "C30",
                    "steel_grade": "Grade 460"
                },
                "design_moments": [75.0, 150.0, 75.0],  # kN⋅m
                "design_shears": [100.0, 0.0, -100.0],   # kN
                "moment_positions": [0.0, 3.0, 6.0],
                "shear_positions": [0.0, 3.0, 6.0],
                "imposed_load": 10.0,
                "permanent_load": 5.0
            },
            {
                "name": "Continuous T-Beam",
                "description": "Two-span continuous T-beam",
                "beam_type": "T-Beam",
                "support_condition": "Continuous",
                "span_length": 8.0,
                "t_beam_geometry": {
                    "web_width": 300,
                    "web_depth": 400,
                    "flange_width": 1000,
                    "flange_thickness": 150,
                    "cover": 25
                },
                "materials": {
                    "concrete_grade": "C35",
                    "steel_grade": "Grade 460"
                },
                "design_moments": [120.0, -180.0, 150.0, -100.0, 80.0],
                "design_shears": [150.0, 50.0, -50.0, -120.0, 80.0],
                "moment_positions": [0.0, 2.0, 4.0, 6.0, 8.0],
                "shear_positions": [0.0, 2.0, 4.0, 6.0, 8.0],
                "imposed_load": 15.0,
                "permanent_load": 8.0
            },
            {
                "name": "Cantilever L-Beam",
                "description": "Cantilever L-beam with point load",
                "beam_type": "L-Beam",
                "support_condition": "Cantilever",
                "span_length": 3.0,
                "l_beam_geometry": {
                    "web_width": 250,
                    "web_depth": 350,
                    "flange_width": 600,
                    "flange_thickness": 120,
                    "cover": 30
                },
                "materials": {
                    "concrete_grade": "C30",
                    "steel_grade": "Grade 460"
                },
                "design_moments": [0.0, -90.0],  # kN⋅m
                "design_shears": [60.0, 60.0],   # kN
                "moment_positions": [0.0, 3.0],
                "shear_positions": [0.0, 3.0],
                "imposed_load": 12.0,
                "permanent_load": 8.0
            }
        ]
        return examples
    
    @app.get("/material_properties")
    async def get_material_properties():
        """Get standard material properties for different grades"""
        return {
            "concrete_grades": {
                "C20": {"fcu": 20, "density": 25.0, "E": 26000},
                "C25": {"fcu": 25, "density": 25.0, "E": 28000},
                "C30": {"fcu": 30, "density": 25.0, "E": 30000},
                "C35": {"fcu": 35, "density": 25.0, "E": 32000},
                "C40": {"fcu": 40, "density": 25.0, "E": 34000},
                "C45": {"fcu": 45, "density": 25.0, "E": 36000},
                "C50": {"fcu": 50, "density": 25.0, "E": 38000}
            },
            "steel_grades": {
                "Grade 250": {"fy": 250, "fu": 410, "E": 200000},
                "Grade 460": {"fy": 460, "fu": 540, "E": 200000}
            },
            "units": {
                "fcu": "N/mm²",
                "fy": "N/mm²", 
                "density": "kN/m³",
                "E": "N/mm²"
            }
        }
    
    @app.post("/integrate_analysis_design_beam_designer")
    async def integrate_analysis_design_for_designer(data: dict):
        """Integrate Three-Moment analysis with beam design"""
        try:
            # Extract analysis results
            analysis_results = data.get('analysis_results')
            design_parameters = data.get('design_parameters')
            
            if not analysis_results or not design_parameters:
                raise ValueError("Both analysis results and design parameters required")
            
            # Create design requests for each span
            design_results = []
            
            spans_data = analysis_results.get('beam_configuration', {}).get('spans', [])
            
            for span_idx, span_data in enumerate(spans_data):
                # Extract moments and shears for this span
                span_moments = []
                span_shears = []
                span_moment_positions = []
                span_shear_positions = []
                
                # Get data points for this span
                current_pos = 0
                for i in range(span_idx):
                    current_pos += spans_data[i]['length']
                
                span_length = span_data['length']
                
                # Filter data for current span
                for i, pos in enumerate(analysis_results.get('moment_positions', [])):
                    if current_pos <= pos <= current_pos + span_length:
                        span_moments.append(analysis_results['moment_data'][i]['y'])
                        span_moment_positions.append(pos - current_pos)
                
                for i, pos in enumerate(analysis_results.get('shear_positions', [])):
                    if current_pos <= pos <= current_pos + span_length:
                        span_shears.append(analysis_results['shear_force_data'][i]['y'])
                        span_shear_positions.append(pos - current_pos)
                
                # Create design request
                design_request = BeamDesignRequest(
                    beam_type=BeamType(design_parameters['beam_type']),
                    support_condition=SupportCondition(design_parameters['support_condition']),
                    span_length=span_length,
                    design_moments=span_moments if span_moments else [0.0],
                    design_shears=span_shears if span_shears else [0.0],
                    moment_positions=span_moment_positions if span_moment_positions else [0.0],
                    shear_positions=span_shear_positions if span_shear_positions else [0.0],
                    imposed_load=design_parameters.get('imposed_load', 0.0),
                    permanent_load=design_parameters.get('permanent_load', 0.0)
                )
                
                # Add geometry based on beam type
                if design_parameters['beam_type'] == 'Rectangular':
                    design_request.rectangular_geometry = RectangularBeamGeometry(
                        **design_parameters['rectangular_geometry']
                    )
                elif design_parameters['beam_type'] == 'T-Beam':
                    design_request.t_beam_geometry = TBeamGeometry(
                        **design_parameters['t_beam_geometry']
                    )
                elif design_parameters['beam_type'] == 'L-Beam':
                    design_request.l_beam_geometry = LBeamGeometry(
                        **design_parameters['l_beam_geometry']
                    )
                
                # Add materials
                design_request.materials = MaterialProperties(
                    **design_parameters.get('materials', {})
                )
                
                # Design the span
                span_design = designer.design_beam(design_request)
                span_design.span_number = span_idx + 1
                design_results.append(span_design)
            
            return {
                "success": True,
                "span_designs": [d.dict() if hasattr(d, 'dict') else d for d in design_results],
                "summary": {
                    "total_spans": len(design_results),
                    "beam_type": design_parameters['beam_type'],
                    "all_designs_ok": all(
                        (result.design_checks.moment_capacity_ok and result.design_checks.shear_capacity_ok)
                        if hasattr(result, 'design_checks') else True
                        for result in design_results
                    )
                }
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Integration failed: {str(e)}")

# Export the designer for use in main API
__all__ = ['BS8110BeamDesigner', 'BeamDesignRequest', 'BeamDesignResponse', 'add_beam_design_endpoints']