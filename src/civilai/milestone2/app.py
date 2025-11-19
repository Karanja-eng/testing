# backend/app.py
import uuid
import traceback
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
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

# Store uploaded file info temporarily
uploaded_files = {}

app = FastAPI(title="Floorplan → GLB")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/generated", StaticFiles(directory=str(GENERATED)), name="generated")


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a floorplan image (doesn't process it yet)
    """
    try:
        # Generate unique ID
        file_id = uuid.uuid4().hex
        upload_path = UPLOADS / f"{file_id}_{file.filename}"

        # Save file
        content = await file.read()
        if not content:
            raise HTTPException(400, "Empty file")

        with open(upload_path, "wb") as f:
            f.write(content)

        # Validate it's an image
        test = cv2.imread(str(upload_path))
        if test is None or test.size == 0:
            upload_path.unlink()
            raise HTTPException(400, "Not a valid image file")

        h, w = test.shape[:2]

        # Store file info
        uploaded_files[file_id] = {
            "path": str(upload_path),
            "filename": file.filename,
            "width": w,
            "height": h,
        }

        print(f"✓ Uploaded: {file.filename} ({w}x{h}) -> ID: {file_id}")

        return JSONResponse(
            {"file_id": file_id, "filename": file.filename, "width": w, "height": h}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")


@app.post("/process")
async def process_file(
    file_id: str = Form(...),
    scale: float = Form(0.01),
    wall_height: float = Form(3.0),
    wall_threshold: float = Form(0.2),
    room_threshold: float = Form(0.3),
    yolo_conf: float = Form(0.3),
    use_yolo: bool = Form(True),
    min_wall_area: float = Form(200),
    max_walls: int = Form(25),
    extract_rooms: bool = Form(False),
    debug_vis: bool = Form(False),
):
    """
    Process an uploaded file with given parameters
    """
    if file_id not in uploaded_files:
        raise HTTPException(400, "File not found. Please upload first.")

    file_info = uploaded_files[file_id]
    img_path = file_info["path"]

    try:
        print(f"\n{'='*70}")
        print(f"Processing file_id: {file_id}")
        print(f"File: {file_info['filename']}")
        print(f"{'='*70}")

        # Run segmentation
        try:
            result = segment_image(
                img_path,
                wall_threshold=wall_threshold,
                room_threshold=room_threshold,
                yolo_conf=yolo_conf,
                use_yolo=use_yolo,
                min_wall_area=min_wall_area,
                max_walls=max_walls,
                extract_rooms=extract_rooms,
                debug_vis=debug_vis,
            )

            wall_polygons = result["walls"]
            room_polygons = result["rooms"]

        except Exception as e:
            error_detail = f"Segmentation failed: {str(e)}\n\n{traceback.format_exc()}"
            print(error_detail)
            raise HTTPException(500, error_detail)

        if not wall_polygons:
            raise HTTPException(
                400, f"No walls found. Try: wall_threshold=0.15, yolo_conf=0.25"
            )

        # Generate GLB
        out_glb = GENERATED / f"{file_id}_{uuid.uuid4().hex[:8]}.glb"
        try:
            # Combine walls and rooms if requested
            all_polygons = wall_polygons
            if extract_rooms and room_polygons:
                all_polygons = wall_polygons + room_polygons

            polygons_to_glb(all_polygons, out_glb, scale=scale, wall_height=wall_height)
        except Exception as e:
            error_detail = f"Mesh export failed: {str(e)}\n\n{traceback.format_exc()}"
            print(error_detail)
            raise HTTPException(500, error_detail)

        url = f"/generated/{out_glb.name}"
        print(f"✓ Success! {len(wall_polygons)} walls, {len(room_polygons)} rooms\n")

        return JSONResponse(
            {
                "glb_url": url,
                "wall_count": len(wall_polygons),
                "room_count": len(room_polygons),
                "parameters": {
                    "wall_threshold": wall_threshold,
                    "room_threshold": room_threshold,
                    "yolo_conf": yolo_conf,
                    "use_yolo": use_yolo,
                    "max_walls": max_walls,
                    "extract_rooms": extract_rooms,
                },
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}\n\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(500, error_detail)


@app.get("/health")
async def health():
    from segmentation import DEVICE

    return {
        "status": "ok",
        "device": str(DEVICE),
        "uploaded_files": len(uploaded_files),
    }


@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    """Delete an uploaded file"""
    if file_id in uploaded_files:
        file_info = uploaded_files[file_id]
        path = Path(file_info["path"])
        if path.exists():
            path.unlink()
        del uploaded_files[file_id]
        return {"status": "deleted"}
    raise HTTPException(404, "File not found")


if __name__ == "__main__":
    import uvicorn
    from segmentation import DEVICE

    print("\n" + "=" * 70)
    print("Floorplan to GLB Server")
    print(f"Device: {DEVICE}")
    print("=" * 70 + "\n")

    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=False, log_level="info")
