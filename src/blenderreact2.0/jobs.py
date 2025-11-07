# backend/jobs.py
import os, subprocess, json, uuid

BLENDER_PATH = r"C:\blender-3.6.10-windows-x64\blender.exe"
BASE_DIR = os.path.dirname(__file__)
STATIC_DIR = os.path.join(BASE_DIR, "static")


def generate_beam_job(job_id, params):
    """Worker function to call Blender headless and export GLB"""
    os.makedirs(STATIC_DIR, exist_ok=True)
    filename = f"beam_{uuid.uuid4().hex}.glb"
    output_path = os.path.join(STATIC_DIR, filename)

    params_path = os.path.join(BASE_DIR, f"params_{job_id}.json")
    with open(params_path, "w") as f:
        json.dump(params, f)

    blender_script = os.path.join(BASE_DIR, "blender_generate.py")

    cmd = [
        BLENDER_PATH,
        "--background",
        "--python",
        blender_script,
        "--",
        params_path,
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Blender failed: {result.stderr}")

    return {"filename": filename}
