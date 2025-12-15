
import os
import shutil
import uuid
import subprocess
import json
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Import our pipeline
from segmentation_pipeline import FloorplanPipeline

app = FastAPI(title="Milestone 3: Advanced Floorplan to 3D via Blender")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
GENERATED_DIR = BASE_DIR / "generated"
UPLOADS_DIR.mkdir(exist_ok=True)
GENERATED_DIR.mkdir(exist_ok=True)

# Mount static files
app.mount("/generated", StaticFiles(directory=str(GENERATED_DIR)), name="generated")

# Pipeline instance
pipeline = FloorplanPipeline()

# Blender Configuration
# Using the specific Blender installation path
BLENDER_EXECUTABLE = r"C:\blender-3.6.10-windows-x64\blender.exe"

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Milestone 3 Blender Backend"}

@app.post("/convert")
async def convert_to_3d(file: UploadFile = File(...)):
    """
    1. Save Image
    2. Run Process -> JSON
    3. Run Blender -> GLB
    4. Return URL
    """
    uid = uuid.uuid4().hex
    filename = f"{uid}_{file.filename}"
    file_path = UPLOADS_DIR / filename
    
    # 1. Save File
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to save file: {str(e)}"})

    # 2. Process to JSON
    try:
        print(f"Processing {file_path}...")
        data = pipeline.process(str(file_path))
        
        # Save JSON for debugging and for Blender
        json_path = GENERATED_DIR / f"{uid}.json"
        with open(json_path, 'w') as f:
            json.dump(data, f, indent=2)
            
    except Exception as e:
        print(f"Pipeline error: {e}")
        return JSONResponse(status_code=500, content={"error": f"Pipeline failed: {str(e)}"})

    # 3. Run Blender
    glb_filename = f"{uid}.glb"
    glb_path = GENERATED_DIR / glb_filename
    script_path = BASE_DIR / "blender_builder.py"
    
    # Command: blender -b -P script.py -- <json> <glb>
    cmd = [
        BLENDER_EXECUTABLE,
        "-b", # background (headless)
        "-P", str(script_path),
        "--",
        str(json_path),
        str(glb_path)
    ]
    
    print(f"Running Blender: {' '.join(cmd)}")
    
    try:
        # verify blender exists first
        # shutil.which might filter .exe, calling it directly is better test
        process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if process.returncode != 0:
            print("Blender Log:\n", process.stdout)
            print("Blender Error:\n", process.stderr)
            raise Exception("Blender returned non-zero exit code")
            
        print("Blender finished successfully.")
        
    except FileNotFoundError:
        return JSONResponse(status_code=500, content={
            "error": "Blender executable not found. Please ensure 'blender' is in your PATH or update BLENDER_EXECUTABLE in main.py"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Blender generation failed: {str(e)}"})

    # 4. Return URL
    return {
        "glb_url": f"/generated/{glb_filename}",
        "raw_json_url": f"/generated/{uid}.json",
        "stats": {
            "walls": len(data['walls']),
            "rooms": len(data['rooms']),
            "objects": len(data['objects'])
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
