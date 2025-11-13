# backend/app.py
import uuid
import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import cv2


from segmentation import segment_image
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

# Serve the generated folder statically
app.mount("/generated", StaticFiles(directory=str(GENERATED)), name="generated")


@app.post("/convert")
async def convert(
    file: UploadFile = File(...), scale: float = 0.01, wall_height: float = 3.0
):
    # save uploaded file
    uid = uuid.uuid4().hex
    upload_path = UPLOADS / f"{uid}_{file.filename}"

    # In /convert
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    with open(upload_path, "wb") as f:
        f.write(content)

    # CRITICAL: Test load
    test = cv2.imread(str(upload_path))
    if test is None or test.size == 0:
        upload_path.unlink()
        raise HTTPException(400, "Not a valid image file")
    try:
        polygons = segment_image(str(upload_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {e}")

    if not polygons:
        raise HTTPException(status_code=400, detail="No wall polygons found by model.")

    out_glb = GENERATED / f"{uid}.glb"
    try:
        polygons_to_glb(polygons, out_glb, scale=scale, wall_height=wall_height)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mesh export failed: {e}")

    # return URL
    url = f"/generated/{out_glb.name}"
    return JSONResponse({"glb_url": url})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True, log_level="info")
