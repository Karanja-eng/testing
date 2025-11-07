from fastapi import FastAPI, WebSocket, UploadFile, File
from fastapi.responses import FileResponse
import bpy  # Requires Blender Python env or subprocess
import subprocess
import json
import os
import tempfile
import shutil
from pathlib import Path

app = FastAPI()


@app.post("/api/blender/render")
async def render_scene(render_data: dict):
    script = render_data["script"]
    output_dir = tempfile.mkdtemp()
    output_path = os.path.join(output_dir, "render.png")

    # Add output path to script
    script += f"\nscene.render.filepath = r'{output_path}'\nbpy.ops.render.render(write_still=True)"

    with open("temp_render.py", "w") as f:
        f.write(script)

    try:
        result = subprocess.run(
            [
                "blender",
                "--background",
                "--factory-startup",  # Use factory to avoid loading defaults
                "--python",
                "temp_render.py",
            ],
            capture_output=True,
            cwd=output_dir,
            timeout=300,
        )  # 5min timeout

        if result.returncode == 0 and os.path.exists(output_path):
            return {
                "imageUrl": f"/api/render/{os.path.basename(output_path)}",
                "success": True,
            }
        else:
            return {"error": result.stderr.decode(), "success": False}
    finally:
        os.remove("temp_render.py")
        # Cleanup on success/failure


@app.get("/api/render/{filename}")
async def get_render(filename: str):
    return FileResponse(f"./temp_output/{filename}")  # Serve static renders


# WebSocket for progress (incomplete in original)
@app.websocket("/ws/blender")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_json()
        if data["type"] == "RENDER_REQUEST":
            await websocket.send_json({"status": "rendering", "progress": 50})
            # Trigger render via internal call or queue
