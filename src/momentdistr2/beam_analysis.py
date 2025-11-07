# routers/beam_analysis.py
from fastapi import APIRouter, HTTPException
from beam_models import BeamInput, BeamResults
from beam_services import BeamAnalysisService

router = APIRouter()


@router.post("/analyze-beam", response_model=BeamResults)
async def analyze_beam(beam_data: BeamInput):
    """
    Analyze indeterminate beam using Moment Distribution Method
    following British Standards conventions.
    """
    try:
        service = BeamAnalysisService()
        results = service.analyze(beam_data)
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "beam_analysis"}


@router.post("/validate-input")
async def validate_beam_input(beam_data: BeamInput):
    """
    Validate beam input data without performing analysis
    """
    try:
        service = BeamAnalysisService()
        validation_result = service.validate_input(beam_data)
        return {
            "valid": True,
            "message": "Input validation successful",
            "details": validation_result,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
