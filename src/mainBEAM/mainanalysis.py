"""
Complete Structural Engineering Suite
Integrated Three-Moment Theorem, Moment Distribution Method, and BS 8110 Design
Professional structural analysis and design platform
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import uvicorn

# Import all analysis modules (use package-relative imports so this module is
# importable as `src.mainBEAM.main`)
from threemain import (
    # Three-Moment Theorem
    ThreeMomentSolver,
    BeamModel,
    BeamResponse,
    # BS 8110 Design
    BS8110Designer,
    BeamDesignRequest,
    BeamDesignResponse,
    BeamType,
    SupportCondition,
    MaterialProperties,
    RectangularBeamGeometry,
    TBeamGeometry,
    LBeamGeometry,
)

from moment_distribution_backend import (
    # Moment Distribution Method
    MomentDistributionSolver,
    FrameMD,
    MomentDistributionResponse,
    JointMD,
    MemberMD,
    LoadMD,
    MemberType,
    EndCondition,
    JointType,
)

# Also import the backend module object so we can forward legacy routes to its
# handlers (the module defines its own FastAPI app but we forward calls into
# the implementation functions here so the main app exposes them).
import moment_distribution_backend as mdb

# Create the main FastAPI application
app = FastAPI(
    title="Professional Structural Engineering Suite",
    description="""
    Complete structural analysis and design platform featuring:
    - Three-Moment Theorem for continuous beam analysis
    - Moment Distribution Method (Hardy Cross) for frame analysis  
    - BS 8110 reinforced concrete beam design
    - Integrated design workflows
    """,
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# ROOT ENDPOINT
# ============================================================================


@app.get("/")
async def root():
    """Main API information endpoint"""
    return {
        "name": "Professional Structural Engineering Suite",
        "version": "3.0.0",
        "description": "Complete structural analysis and design platform",
        "features": {
            "analysis_methods": [
                "Three-Moment Theorem (Continuous Beams)",
                "Moment Distribution Method (Hardy Cross for Frames)",
                "Matrix Analysis (Future Enhancement)",
            ],
            "design_codes": [
                "BS 8110 (British Standard for Reinforced Concrete)",
                "Eurocode 2 (Future Enhancement)",
                "ACI 318 (Future Enhancement)",
            ],
            "beam_sections": [
                "Rectangular Sections",
                "T-Beam Sections",
                "L-Beam Sections",
            ],
            "load_types": [
                "Point Loads",
                "Uniformly Distributed Loads (UDL)",
                "Partial UDL",
                "Triangular Loads",
                "Trapezoidal Loads",
            ],
        },
        "capabilities": [
            "Continuous beam analysis with multiple spans",
            "Frame analysis with beams and columns",
            "Reinforced concrete design with complete checks",
            "Professional diagram generation (SFD, BMD, deflection)",
            "Integrated design workflows",
            "Cost estimation and material optimization",
        ],
    }


# ============================================================================
# MOMENT DISTRIBUTION METHOD ENDPOINTS
# ============================================================================


@app.post("/moment_distribution/analyze", response_model=MomentDistributionResponse)
async def analyze_moment_distribution(frame: FrameMD):
    """Analyze frame using Moment Distribution Method (Hardy Cross)"""
    try:
        solver = MomentDistributionSolver(frame)
        return solver.solve()
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Moment Distribution analysis failed: {str(e)}"
        )


# Compatibility aliases (some frontends use underscore-style paths)
@app.post("/analyze_moment_distribution", response_model=MomentDistributionResponse)
async def analyze_moment_distribution_legacy(frame: FrameMD):
    """Legacy alias for POST /moment_distribution/analyze"""
    # Forward to implementation in moment_distribution_backend module
    return await mdb.analyze_moment_distribution(frame)


@app.get("/moment_distribution_examples")
async def get_moment_distribution_examples_legacy():
    """Legacy alias for GET /moment_distribution/examples"""
    return await mdb.get_moment_distribution_examples()


# ============================================================================
# THREE-MOMENT THEOREM ENDPOINTS
# ============================================================================


@app.post("/three_moment/analyze", response_model=BeamResponse)
async def analyze_three_moment(beam: BeamModel):
    """Analyze continuous beam using Three-Moment Theorem"""
    try:
        solver = ThreeMomentSolver(beam.spans, beam.supports)
        solver.solve()
        data = solver.get_analysis_data()
        return BeamResponse(**data)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Three-Moment analysis failed: {str(e)}"
        )


@app.post("/analyze_three_moment", response_model=BeamResponse)
async def analyze_three_moment_legacy(beam: BeamModel):
    """Legacy alias for POST /three_moment/analyze"""
    return await analyze_three_moment(beam)


@app.get("/three_moment/examples")
async def get_three_moment_examples():
    """Get Three-Moment Theorem example configurations"""
    examples = [
        {
            "name": "Two-Span Continuous Beam",
            "description": "Classic continuous beam with point loads",
            "method": "Three-Moment Theorem",
            "spans": [
                {
                    "member_id": "BC",
                    "member_type": "Beam",
                    "start_joint_id": "B",
                    "end_joint_id": "C",
                    "length": 6.0,
                    "E": 200e9,
                    "I": 8.33e-6,
                    "loads": [{"load_type": "UDL", "magnitude": 15.0}],
                }
            ],
            "convergence_tolerance": 0.001,
            "max_iterations": 50,
        },
        {
            "name": "Portal Frame",
            "description": "Simple portal frame with vertical and lateral loads",
            "method": "Moment Distribution (Hardy Cross)",
            "joints": [
                {
                    "joint_id": "A",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 0.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "B",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 0.0,
                    "y_coordinate": 4.0,
                    "is_support": False,
                },
                {
                    "joint_id": "C",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 8.0,
                    "y_coordinate": 4.0,
                    "is_support": False,
                },
                {
                    "joint_id": "D",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 8.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
            ],
            "members": [
                {
                    "member_id": "AB",
                    "member_type": "Column",
                    "start_joint_id": "A",
                    "end_joint_id": "B",
                    "length": 4.0,
                    "E": 200e9,
                    "I": 5e-6,
                    "loads": [],
                },
                {
                    "member_id": "BC",
                    "member_type": "Beam",
                    "start_joint_id": "B",
                    "end_joint_id": "C",
                    "length": 8.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [{"load_type": "UDL", "magnitude": 25.0}],
                },
                {
                    "member_id": "CD",
                    "member_type": "Column",
                    "start_joint_id": "C",
                    "end_joint_id": "D",
                    "length": 4.0,
                    "E": 200e9,
                    "I": 5e-6,
                    "loads": [],
                },
            ],
            "convergence_tolerance": 0.001,
            "max_iterations": 50,
        },
        {
            "name": "Multi-Span Continuous Beam - MD",
            "description": "Three-span beam with various load types",
            "method": "Moment Distribution (Hardy Cross)",
            "joints": [
                {
                    "joint_id": "A",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 0.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "B",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 5.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "C",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 10.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "D",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 15.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
            ],
            "members": [
                {
                    "member_id": "AB",
                    "member_type": "Beam",
                    "start_joint_id": "A",
                    "end_joint_id": "B",
                    "length": 5.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [
                        {"load_type": "Point", "magnitude": 100.0, "position": 2.5}
                    ],
                },
                {
                    "member_id": "BC",
                    "member_type": "Beam",
                    "start_joint_id": "B",
                    "end_joint_id": "C",
                    "length": 5.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [{"load_type": "UDL", "magnitude": 30.0}],
                },
                {
                    "member_id": "CD",
                    "member_type": "Beam",
                    "start_joint_id": "C",
                    "end_joint_id": "D",
                    "length": 5.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [
                        {
                            "load_type": "Triangular",
                            "magnitude": 40.0,
                            "position": 0.0,
                            "length": 3.0,
                        }
                    ],
                },
            ],
            "convergence_tolerance": 0.001,
            "max_iterations": 50,
        },
    ]
    return examples


@app.get("/three_moment_examples")
async def get_three_moment_examples_legacy():
    """Legacy alias for GET /three_moment/examples"""
    return await get_three_moment_examples()


# ============================================================================
# BS 8110 DESIGN ENDPOINTS
# ============================================================================


@app.post("/design/bs8110", response_model=BeamDesignResponse)
async def design_beam_bs8110(request: BeamDesignRequest):
    """Design reinforced concrete beam according to BS 8110"""
    try:
        designer = BS8110Designer()
        return designer.design_beam(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"BS 8110 design failed: {str(e)}")


@app.get("/design/examples")
async def get_design_examples():
    """Get BS 8110 design example configurations"""
    examples = [
        {
            "name": "Standard Rectangular Beam",
            "description": "Typical rectangular beam design",
            "beam_type": "Rectangular",
            "support_condition": "Simply Supported",
            "rectangular_geometry": {"width": 300, "depth": 500, "cover": 25},
            "materials": {"concrete_grade": "C30", "steel_grade": "Grade 460"},
            "imposed_load": 10.0,
            "permanent_load": 5.0,
        },
        {
            "name": "Continuous T-Beam",
            "description": "T-beam for continuous spans",
            "beam_type": "T-Beam",
            "support_condition": "Continuous",
            "t_beam_geometry": {
                "web_width": 300,
                "web_depth": 400,
                "flange_width": 1000,
                "flange_thickness": 150,
                "cover": 25,
            },
            "materials": {"concrete_grade": "C35", "steel_grade": "Grade 460"},
            "imposed_load": 15.0,
            "permanent_load": 8.0,
        },
        {
            "name": "Cantilever L-Beam",
            "description": "L-beam for cantilever applications",
            "beam_type": "L-Beam",
            "support_condition": "Cantilever",
            "l_beam_geometry": {
                "web_width": 250,
                "web_depth": 350,
                "flange_width": 600,
                "flange_thickness": 120,
                "cover": 30,
            },
            "materials": {"concrete_grade": "C30", "steel_grade": "Grade 460"},
            "imposed_load": 12.0,
            "permanent_load": 8.0,
        },
    ]
    return examples


@app.get("/design/material_properties")
async def get_material_properties():
    """Get standard material properties for design"""
    return {
        "concrete_grades": {
            "C20": {
                "fcu": 20,
                "density": 25.0,
                "E": 26000,
                "description": "Standard grade for general use",
            },
            "C25": {
                "fcu": 25,
                "density": 25.0,
                "E": 28000,
                "description": "Common grade for residential",
            },
            "C30": {
                "fcu": 30,
                "density": 25.0,
                "E": 30000,
                "description": "Standard grade for commercial",
            },
            "C35": {
                "fcu": 35,
                "density": 25.0,
                "E": 32000,
                "description": "High strength for heavy loads",
            },
            "C40": {
                "fcu": 40,
                "density": 25.0,
                "E": 34000,
                "description": "Very high strength applications",
            },
            "C45": {
                "fcu": 45,
                "density": 25.0,
                "E": 36000,
                "description": "Specialized high-rise construction",
            },
            "C50": {
                "fcu": 50,
                "density": 25.0,
                "E": 38000,
                "description": "Maximum grade for normal construction",
            },
        },
        "steel_grades": {
            "Grade 250": {
                "fy": 250,
                "fu": 410,
                "E": 200000,
                "description": "Mild steel (obsolete but still used)",
            },
            "Grade 460": {
                "fy": 460,
                "fu": 540,
                "E": 200000,
                "description": "High yield steel (modern standard)",
            },
        },
        "design_parameters": {
            "partial_safety_factors": {
                "concrete": 1.5,
                "steel": 1.15,
                "permanent_loads": 1.4,
                "imposed_loads": 1.6,
            },
            "minimum_cover": {
                "internal_exposure": 25,
                "external_exposure": 35,
                "severe_exposure": 50,
            },
        },
        "units": {
            "fcu": "N/mm² (cube strength)",
            "fy": "N/mm² (yield strength)",
            "density": "kN/m³",
            "E": "N/mm² (elastic modulus)",
        },
    }


# ============================================================================
# INTEGRATED ANALYSIS AND DESIGN ENDPOINTS
# ============================================================================


@app.post("/integrated/three_moment_design")
async def integrate_three_moment_design(data: dict):
    """Integrate Three-Moment analysis with BS 8110 beam design"""
    try:
        analysis_results = data.get("analysis_results")
        design_parameters = data.get("design_parameters")

        if not analysis_results or not design_parameters:
            raise ValueError("Both analysis results and design parameters required")

        designer = BS8110Designer()
        design_results = []
        spans_data = analysis_results.get("beam_configuration", {}).get("spans", [])

        for span_idx, span_data in enumerate(spans_data):
            span_length = span_data["length"]

            # Extract moments and shears for this span
            moment_data = analysis_results.get("moment_data", [])
            shear_data = analysis_results.get("shear_force_data", [])

            span_moments = []
            span_shears = []
            span_positions = []

            current_pos = sum(spans_data[i]["length"] for i in range(span_idx))

            for point in moment_data:
                if current_pos <= point["x"] <= current_pos + span_length:
                    span_moments.append(point["y"])
                    span_positions.append(point["x"] - current_pos)

            for point in shear_data:
                if current_pos <= point["x"] <= current_pos + span_length:
                    span_shears.append(point["y"])

            if not span_moments:
                span_moments = [0.0]
                span_positions = [0.0]
            if not span_shears:
                span_shears = [0.0]

            # Create design request
            design_request = BeamDesignRequest(
                beam_type=BeamType(design_parameters["beam_type"]),
                support_condition=SupportCondition(
                    design_parameters["support_condition"]
                ),
                span_length=span_length,
                design_moments=span_moments,
                design_shears=span_shears,
                moment_positions=span_positions,
                shear_positions=span_positions,
                imposed_load=design_parameters.get("imposed_load", 0.0),
                permanent_load=design_parameters.get("permanent_load", 0.0),
                materials=MaterialProperties(**design_parameters.get("materials", {})),
            )

            # Add geometry
            if design_parameters["beam_type"] == "Rectangular":
                design_request.rectangular_geometry = RectangularBeamGeometry(
                    **design_parameters["rectangular_geometry"]
                )
            elif design_parameters["beam_type"] == "T-Beam":
                design_request.t_beam_geometry = TBeamGeometry(
                    **design_parameters["t_beam_geometry"]
                )
            elif design_parameters["beam_type"] == "L-Beam":
                design_request.l_beam_geometry = LBeamGeometry(
                    **design_parameters["l_beam_geometry"]
                )

            # Design the span
            span_design = designer.design_beam(design_request)
            design_results.append(span_design)

        return {
            "success": True,
            "analysis_method": "Three-Moment Theorem",
            "design_code": "BS 8110",
            "span_designs": design_results,
            "summary": {
                "total_spans": len(design_results),
                "beam_type": design_parameters["beam_type"],
                "all_designs_ok": all(
                    result.design_checks.moment_capacity_ok
                    and result.design_checks.shear_capacity_ok
                    for result in design_results
                ),
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Three-Moment + BS 8110 integration failed: {str(e)}",
        )


@app.post("/integrated/moment_distribution_design")
async def integrate_moment_distribution_design(data: dict):
    """Integrate Moment Distribution analysis with BS 8110 beam design"""
    try:
        md_results = data.get("md_results")
        design_parameters = data.get("design_parameters")

        if not md_results or not design_parameters:
            raise ValueError("Both MD results and design parameters required")

        designer = BS8110Designer()
        design_results = []

        # Process each member for design
        for member_id, moment_data in md_results.get("moment_data", {}).items():
            if not moment_data:
                continue

            # Extract design forces
            moments = [point["y"] for point in moment_data]
            positions = [point["x"] for point in moment_data]

            shear_data = md_results.get("shear_force_data", {}).get(member_id, [])
            shears = [point["y"] for point in shear_data] if shear_data else [0.0]

            member_length = max(positions) if positions else 6.0

            # Create design request
            design_request = BeamDesignRequest(
                beam_type=BeamType(design_parameters["beam_type"]),
                support_condition=SupportCondition(
                    design_parameters["support_condition"]
                ),
                span_length=member_length,
                design_moments=moments,
                design_shears=shears,
                moment_positions=positions,
                shear_positions=positions,
                imposed_load=design_parameters.get("imposed_load", 0.0),
                permanent_load=design_parameters.get("permanent_load", 0.0),
                materials=MaterialProperties(**design_parameters.get("materials", {})),
            )

            # Add geometry
            if design_parameters["beam_type"] == "Rectangular":
                design_request.rectangular_geometry = RectangularBeamGeometry(
                    **design_parameters["rectangular_geometry"]
                )
            elif design_parameters["beam_type"] == "T-Beam":
                design_request.t_beam_geometry = TBeamGeometry(
                    **design_parameters["t_beam_geometry"]
                )
            elif design_parameters["beam_type"] == "L-Beam":
                design_request.l_beam_geometry = LBeamGeometry(
                    **design_parameters["l_beam_geometry"]
                )

            # Design the member
            member_design = designer.design_beam(design_request)
            member_design.member_id = member_id
            design_results.append(member_design)

        return {
            "success": True,
            "analysis_method": "Moment Distribution Method (Hardy Cross)",
            "design_code": "BS 8110",
            "member_designs": design_results,
            "summary": {
                "total_members": len(design_results),
                "beam_type": design_parameters["beam_type"],
                "all_designs_ok": all(
                    result.design_checks.moment_capacity_ok
                    and result.design_checks.shear_capacity_ok
                    for result in design_results
                ),
                "convergence_info": {
                    "achieved": md_results.get("convergence_achieved", False),
                    "iterations": md_results.get("iterations_performed", 0),
                },
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Moment Distribution + BS 8110 integration failed: {str(e)}",
        )


# Legacy alias used by some frontends
@app.post("/integrate_md_analysis_design")
async def integrate_md_analysis_design_legacy(data: dict):
    """Forward legacy POST /integrate_md_analysis_design to the MD backend implementation."""
    # Forward to implementation in moment_distribution_backend
    return await mdb.integrate_md_analysis_design(data)


# ============================================================================
# UTILITY ENDPOINTS
# ============================================================================


@app.get("/methods/comparison")
async def get_methods_comparison():
    """Compare different structural analysis methods"""
    return {
        "analysis_methods": {
            "three_moment_theorem": {
                "name": "Three-Moment Theorem",
                "best_for": "Continuous beams",
                "advantages": [
                    "Direct solution for continuous beams",
                    "Clear physical interpretation",
                    "Suitable for hand calculations",
                    "Excellent for teaching",
                ],
                "limitations": [
                    "Limited to beams only",
                    "Cannot handle frames with columns",
                    "Manual setup for complex loading",
                ],
                "typical_applications": [
                    "Bridge analysis",
                    "Building floor beams",
                    "Continuous girders",
                ],
            },
            "moment_distribution": {
                "name": "Moment Distribution Method (Hardy Cross)",
                "best_for": "Frames with beams and columns",
                "advantages": [
                    "Handles complex frame geometries",
                    "Iterative convergence provides insight",
                    "Can analyze frames with rigid joints",
                    "No matrix operations required",
                ],
                "limitations": [
                    "Slower convergence for large structures",
                    "Manual iteration can be tedious",
                    "Less efficient than matrix methods for large systems",
                ],
                "typical_applications": [
                    "Portal frames",
                    "Multi-story buildings",
                    "Industrial frames",
                    "Bridge bents",
                ],
            },
            "matrix_methods": {
                "name": "Matrix Methods (Direct Stiffness)",
                "best_for": "Large complex structures",
                "advantages": [
                    "Handles any structural configuration",
                    "Direct solution - no iteration",
                    "Easily automated",
                    "Basis for modern FEA software",
                ],
                "limitations": [
                    "Requires matrix operations",
                    "Less physical insight",
                    "Complex for hand calculations",
                ],
                "typical_applications": [
                    "High-rise buildings",
                    "Complex space frames",
                    "Finite element analysis",
                ],
            },
        },
        "selection_guide": {
            "continuous_beams": "Use Three-Moment Theorem",
            "simple_frames": "Use Moment Distribution Method",
            "complex_structures": "Use Matrix Methods",
            "educational_purposes": "Three-Moment Theorem or Moment Distribution",
            "professional_design": "Any method - choose based on complexity",
        },
    }


@app.get("/design_codes/comparison")
async def get_design_codes_comparison():
    """Compare different concrete design codes"""
    return {
        "design_codes": {
            "bs_8110": {
                "name": "BS 8110 (British Standard)",
                "status": "Legacy but still used",
                "region": "UK and former British territories",
                "key_features": [
                    "Permissible stress approach",
                    "Simple design procedures",
                    "Conservative safety factors",
                    "Well-established methods",
                ],
                "typical_usage": "Existing projects, simple structures",
            },
            "eurocode_2": {
                "name": "Eurocode 2 (EN 1992)",
                "status": "Current European standard",
                "region": "European Union and many international projects",
                "key_features": [
                    "Limit state design approach",
                    "Advanced analysis methods",
                    "Performance-based design",
                    "Harmonized across Europe",
                ],
                "typical_usage": "New projects in Europe",
            },
            "aci_318": {
                "name": "ACI 318 (American Concrete Institute)",
                "status": "Current US standard",
                "region": "United States and American-influenced regions",
                "key_features": [
                    "Strength design method",
                    "Regular updates",
                    "Extensive research backing",
                    "Performance-based provisions",
                ],
                "typical_usage": "Projects in Americas",
            },
        },
        "implementation_status": {
            "implemented": ["BS 8110"],
            "planned": ["Eurocode 2", "ACI 318"],
            "under_consideration": ["CSA A23.3 (Canadian)", "AS 3600 (Australian)"],
        },
    }


@app.get("/health")
async def health_check():
    """API health check endpoint"""
    return {
        "status": "healthy",
        "version": "3.0.0",
        "services": {
            "three_moment_analysis": "operational",
            "moment_distribution_analysis": "operational",
            "bs8110_design": "operational",
            "integration_services": "operational",
        },
        "last_updated": "2024-12-20",
    }


# ============================================================================
# MAIN APPLICATION ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
