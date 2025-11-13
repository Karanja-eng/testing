from fastapi import FastAPI, UploadFile, File
from blender_export import convert_floorplan_to_glb
import uuid, shutil
from pathlib import Path

app = FastAPI()
TARGET = Path("./generated")
TARGET.mkdir(exist_ok=True)


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    img_name = f"{uuid.uuid4()}.png"
    img_path = TARGET / img_name
    img_path.write_bytes(await file.read())

    out_path = TARGET / f"{img_name}.glb"
    convert_floorplan_to_glb(str(img_path), str(out_path))

    return {"url": f"/generated/{out_path.name}"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("segformer_script:app", host="0.0.0.0", port=8001, reload=True)
