from fastapi import FastAPI, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import uuid
import os

app = FastAPI()

# Allow React frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)

# ✅ Path to Blender executable
BLENDER_PATH = r"C:\blender-3.6.10-windows-x64\blender-3.6.10-windows-x64\blender.exe"


@app.post("/generate")
async def generate_beam():
    """
    Synchronously runs Blender to create a beam .glb and returns the file path.
    """
    beam_id = str(uuid.uuid4())[:8]
    output_file = os.path.join(STATIC_DIR, f"beam_{beam_id}.glb")

    blender_script = os.path.join(os.path.dirname(__file__), "blender_generate.py")

    # Call Blender headless
    cmd = [
        BLENDER_PATH,
        "--background",
        "--python",
        blender_script,
        "--",
        output_file,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    print(result.stderr)

    if not os.path.exists(output_file):
        return {"error": "Blender failed to generate the beam."}

    return {"status": "success", "file": f"/static/beam_{beam_id}.glb"}


@app.get("/static/{filename}")
async def serve_static(filename: str):
    file_path = os.path.join(STATIC_DIR, filename)
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    return FileResponse(file_path)


@app.post("/generate-detailed")
async def generate_detailed():
    return await generate_beam()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
