from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import subprocess, os, uuid, sys

app = FastAPI()

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory for generated models
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Path to your Blender binary (✅ double-check this path)
BLENDER_BIN = r"C:\blender-3.6.10-windows-x64\blender-3.6.10-windows-x64\blender.exe"


@app.post("/generate")
def generate_model(length: float = 5, width: float = 0.3, height: float = 0.5):
    """
    Calls Blender in headless mode to generate a .glb file.
    """
    file_id = uuid.uuid4().hex
    output_file = os.path.join(STATIC_DIR, f"beam_{file_id}.glb")

    blender_script = "C:\\Users\\HP\\Documents\\programming\\Java script\\ReactApps\\Testing12\\src\\BlenderReact\\generate_shapes.py"

    cmd = [
        BLENDER_BIN,
        "--background",
        "--python",
        blender_script,
        "--",
        "--out",
        output_file,
        "--length",
        str(length),
        "--width",
        str(width),
        "--height",
        str(height),
    ]

    print("\n=== Running Blender Command ===")
    print(" ".join(cmd))
    print("===============================")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
        print(result.stdout)
        print(result.stderr)
    except subprocess.CalledProcessError as e:
        print("❌ Blender error:", e.stderr)
        raise HTTPException(status_code=500, detail="Blender execution failed")

    if not os.path.exists(output_file):
        raise HTTPException(status_code=500, detail="GLB file was not created")

    rel_path = f"/static/{os.path.basename(output_file)}"
    return {"file": rel_path}
