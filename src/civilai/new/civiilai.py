from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import sys
import os

app = FastAPI()

# Allow CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Prompt(BaseModel):
    text: str


@app.post("/generate")
def generate(prompt: Prompt):
    try:
        result = subprocess.run(
            ["ollama", "run", "phi:latest", prompt.text],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=300,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=result.stderr.strip())

        return {"response": result.stdout.strip()}

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Model timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import subprocess

    # 🧠 Compute module path (e.g. "civilai.civiilai:app")
    module_path = os.path.splitext(os.path.relpath(__file__, os.getcwd()))[0].replace(
        os.sep, "."
    )
    app_ref = f"{module_path}:app"

    # 🌀 Launch uvicorn as a module so reload works!
    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            app_ref,
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--reload",
        ]
    )
