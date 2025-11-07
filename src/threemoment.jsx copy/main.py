

# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Any
from models import ThreeMomentRequest, BeamDesignRequest, SupportModel
from three_moment import build_beam_from_dict, ContinuousBeam, SupportType, Span, Load, LoadType
from beam_calculator import design_beam_bs_simple
import tests_data

app = FastAPI(title="Three-Moment + Beam Design API", version="1.0")

# ✅ Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # you can restrict to ["http://localhost:3000"] later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



def _convert_request_to_beam(req: ThreeMomentRequest):
    # Build spans list in dict form for build_beam_from_dict helper
    spans_data = []
    for sp in req.spans:
        loads = []
        for l in sp.loads:
            loads.append({
                "load_type": l.load_type,
                "magnitude": l.magnitude,
                "position": l.position or 0.0,
                "length": l.length or 0.0,
                "magnitude2": l.magnitude2 or 0.0
            })
        spans_data.append({
            "length": sp.length,
            "E": sp.E,
            "I": sp.I,
            "loads": loads
        })
    supports_data = [{"support_type": s.support_type, "position": s.position} for s in req.supports]
    return spans_data, supports_data

@app.post("/api/three-moment/")
def three_moment_api(req: ThreeMomentRequest):
    spans_data, supports_data = _convert_request_to_beam(req)
    try:
        beam = build_beam_from_dict(spans_data, supports_data)
        beam.solve()
        return beam.to_json(resolution_per_span=150)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/design-beam/")
def design_beam_api(req: BeamDesignRequest):
    # Simple design route. Accepts Mu and returns Ast suggestions.
    try:
        res = design_beam_bs_simple(req.fcu, req.fy, req.b, req.d, req.Mu)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/default-tests/")
def get_default_tests():
    return {"test1": tests_data.test1, "test2": tests_data.test2}
