# backend/app.py
import uuid
import traceback
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import cv2

from segmentation_improved import segment_image
from mesh_export import polygons_to_glb

BASE = Path(__file__).parent
GENERATED = BASE / "generated"
UPLOADS = BASE / "uploads"
GENERATED.mkdir(exist_ok=True)
UPLOADS.mkdir(exist_ok=True)

app = FastAPI(title="Floorplan → GLB")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/generated", StaticFiles(directory=str(GENERATED)), name="generated")


@app.post("/convert")
async def convert(
    file: UploadFile = File(...),
    scale: float = Form(0.01),
    wall_height: float = Form(3.0),
    wall_threshold: float = Form(0.1),  # Lower = more walls
    yolo_conf: float = Form(0.1),  # Lower = more detections
    use_yolo: bool = Form(True),
    min_wall_area: float = Form(100),
):
    """
    Convert floorplan to GLB with configurable parameters

    Parameters:
    - file: Image file
    - scale: Scaling factor for 3D model (default: 0.01)
    - wall_height: Height of walls in 3D model (default: 3.0)
    - wall_threshold: Threshold for wall detection, 0.1-0.3 (default: 0.15, lower=more walls)
    - yolo_conf: YOLO confidence threshold, 0.2-0.5 (default: 0.25, lower=more detections)
    - use_yolo: Enable YOLO boost (default: True)
    - min_wall_area: Minimum area for wall polygons (default: 100)
    """
    uid = uuid.uuid4().hex
    upload_path = UPLOADS / f"{uid}_{file.filename}"

    try:
        # Save uploaded file
        content = await file.read()
        if not content:
            raise HTTPException(400, "Empty file")

        with open(upload_path, "wb") as f:
            f.write(content)

        # Validate image
        test = cv2.imread(str(upload_path))
        if test is None or test.size == 0:
            upload_path.unlink()
            raise HTTPException(400, "Not a valid image file")

        # Run segmentation with parameters
        try:
            polygons = segment_image(
                str(upload_path),
                wall_threshold=wall_threshold,
                yolo_conf=yolo_conf,
                use_yolo=use_yolo,
                min_wall_area=min_wall_area,
            )
        except Exception as e:
            error_detail = f"Segmentation failed: {str(e)}\n\n{traceback.format_exc()}"
            print(error_detail)
            raise HTTPException(status_code=500, detail=error_detail)

        if not polygons:
            raise HTTPException(
                status_code=400,
                detail="No wall polygons found. Try lowering wall_threshold (e.g., 0.1) or yolo_conf (e.g., 0.2)",
            )

        # Generate 3D mesh
        out_glb = GENERATED / f"{uid}.glb"
        try:
            polygons_to_glb(polygons, out_glb, scale=scale, wall_height=wall_height)
        except Exception as e:
            error_detail = f"Mesh export failed: {str(e)}\n\n{traceback.format_exc()}"
            print(error_detail)
            raise HTTPException(status_code=500, detail=error_detail)

        # Return URL
        url = f"/generated/{out_glb.name}"
        print(f"✓ Success! {len(polygons)} walls extracted\n")

        return JSONResponse(
            {
                "glb_url": url,
                "polygon_count": len(polygons),
                "parameters": {
                    "wall_threshold": wall_threshold,
                    "yolo_conf": yolo_conf,
                    "use_yolo": use_yolo,
                    "min_wall_area": min_wall_area,
                },
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}\n\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(status_code=500, detail=error_detail)


@app.get("/health")
async def health():
    from segmentation import DEVICE

    return {"status": "ok", "device": str(DEVICE)}


if __name__ == "__main__":
    import uvicorn
    from segmentation import DEVICE

    print("\n" + "=" * 60)
    print("Floorplan to GLB Server")
    print(f"Device: {DEVICE}")
    print("=" * 60 + "\n")

    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True, log_level="info")
