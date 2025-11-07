# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import beam_analysis

app = FastAPI(
    title="Structural Engineering - Moment Distribution Method",
    description="Full-stack application for analyzing indeterminate beams and frames",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(beam_analysis.router, prefix="/api", tags=["beam_analysis"])


@app.get("/")
async def root():
    return {"message": "Structural Engineering API - Moment Distribution Method"}
