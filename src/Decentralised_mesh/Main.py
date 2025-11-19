#!/usr/bin/env python3
"""
Enhanced Decentralized Mesh Network with:
- AES-GCM Encryption
- RocksDB Persistence
- WebRTC Networking
- Qwen 2.5-VL via Ollama
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import meshcore
import uuid
from datetime import datetime
import logging
import asyncio
from ollama_client import OllamaClient, DistributedOllamaManager
from PIL import Image
import io
import base64

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Enhanced Mesh Network API",
    description="Distributed AI with AES-GCM, RocksDB, and Qwen 2.5-VL",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize with RocksDB and enhanced security
chunk_store = meshcore.ChunkStore(262144, "./meshnet_db")  # 256KB chunks, persistent
scheduler = meshcore.Scheduler(3)
consensus = meshcore.Consensus()
routing = meshcore.Routing()
model_manager = meshcore.ModelShardManager()

# Initialize Ollama client for Qwen 2.5-VL
ollama = OllamaClient(base_url="http://localhost:11434", model="qwen2.5-vl")
distributed_ollama = DistributedOllamaManager(ollama)

current_device_id = f"device_{uuid.uuid4().hex[:8]}"

logger.info("=" * 70)
logger.info("Enhanced Mesh Network Starting")
logger.info("=" * 70)
logger.info(f"Device ID: {current_device_id}")
logger.info(f"Encryption: AES-256-GCM")
logger.info(f"Storage: RocksDB persistent")
logger.info(f"AI Model: Qwen 2.5-VL via Ollama")
logger.info("=" * 70)

# ============================================================================
# Pydantic Models
# ============================================================================


class TelemetryUpdate(BaseModel):
    device_id: str
    battery_percent: float = 100.0
    cpu_load_percent: float = 0.0
    ram_usage_percent: float = 0.0
    idle_percent: float = 100.0
    link_quality: float = 1.0
    available_storage_mb: int = 10240
    is_plugged_in: bool = False
    ollama_available: bool = False  # New: Ollama capability


class VisionInferenceRequest(BaseModel):
    prompt: str
    image_data: Optional[str] = None  # Base64 encoded image
    temperature: float = 0.7
    max_tokens: int = 500
    use_distributed: bool = True


class TextInferenceRequest(BaseModel):
    prompt: str
    temperature: float = 0.7
    max_tokens: int = 500
    use_distributed: bool = True


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    image_data: Optional[str] = None
    temperature: float = 0.7


class OllamaNodeRegistration(BaseModel):
    node_id: str
    ollama_url: str


# ============================================================================
# System Endpoints
# ============================================================================


@app.get("/")
async def root():
    """Enhanced system info"""
    available_nodes = distributed_ollama.get_available_nodes()

    return {
        "service": "Enhanced Decentralized Mesh Network",
        "version": "2.0.0",
        "device_id": current_device_id,
        "status": "online",
        "capabilities": {
            "encryption": "AES-256-GCM",
            "compression": "zstd",
            "storage": "RocksDB persistent",
            "routing": "dijkstra",
            "consensus": "dag-crdt",
            "ai_model": "qwen2.5-vl",
            "vision": True,
            "distributed_inference": True,
        },
        "ollama": {"available": len(available_nodes) > 0, "nodes": available_nodes},
    }


@app.get("/health")
async def health():
    """Detailed health with Ollama status"""
    try:
        devices = scheduler.get_compute_devices(1000)
        ollama_models = ollama.list_models()

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "device_id": current_device_id,
            "registered_devices": len(devices),
            "consensus_chunks": len(consensus.list_chunks()),
            "ollama": {
                "available": len(ollama_models) > 0,
                "models": [m.get("name") for m in ollama_models],
            },
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Enhanced Device Management
# ============================================================================


@app.post("/telemetry")
async def update_telemetry(telemetry: TelemetryUpdate):
    """Register device with Ollama capability"""
    try:
        tel = meshcore.Telemetry()
        tel.device_id = telemetry.device_id
        tel.battery_percent = telemetry.battery_percent
        tel.cpu_load_percent = telemetry.cpu_load_percent
        tel.ram_usage_percent = telemetry.ram_usage_percent
        tel.idle_percent = telemetry.idle_percent
        tel.link_quality = telemetry.link_quality
        tel.available_storage_mb = telemetry.available_storage_mb
        tel.is_plugged_in = telemetry.is_plugged_in

        scheduler.register_device(telemetry.device_id, tel)

        logger.info(
            f"Registered device: {telemetry.device_id}, "
            f"score: {tel.compute_score():.2f}, "
            f"ollama: {telemetry.ollama_available}"
        )

        return {
            "status": "success",
            "device_id": telemetry.device_id,
            "score": tel.compute_score(),
            "ollama_capable": telemetry.ollama_available,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Failed to register device: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/devices")
async def list_devices():
    """List all devices"""
    try:
        devices = scheduler.get_compute_devices(1000)
        device_info = []

        for device_id in devices:
            try:
                tel = scheduler.get_telemetry(device_id)
                device_info.append(
                    {
                        "device_id": device_id,
                        "score": tel.compute_score(),
                        "battery": tel.battery_percent,
                        "cpu_load": tel.cpu_load_percent,
                        "ram_usage": tel.ram_usage_percent,
                        "is_plugged_in": tel.is_plugged_in,
                        "link_quality": tel.link_quality,
                    }
                )
            except:
                pass

        device_info.sort(key=lambda x: x["score"], reverse=True)

        return {
            "status": "success",
            "num_devices": len(device_info),
            "devices": device_info,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Enhanced Content Management with AES-GCM
# ============================================================================


@app.post("/publish")
async def publish_content(file: UploadFile = File(...)):
    """Upload with AES-256-GCM encryption and RocksDB persistence"""
    try:
        content = await file.read()
        content_id = f"content_{uuid.uuid4().hex}"

        logger.info(f"Publishing (AES-GCM): {content_id}, size: {len(content)} bytes")

        # Store with AES-GCM encryption (automatically persisted to RocksDB)
        chunk_hashes = chunk_store.store(list(content), content_id, True)
        content_address = chunk_store.get_content_address(content_id)

        # Place and persist
        placements = scheduler.place_chunks(chunk_hashes, 262144)

        for placement in placements:
            if placement.device_ids:
                consensus.add_entry(
                    placement.chunk_hash, placement.device_ids, current_device_id
                )
                routing.register_chunk_location(
                    placement.chunk_hash, placement.device_ids
                )

        # Force flush to disk
        chunk_store.flush_to_disk()

        logger.info(f"Published {len(chunk_hashes)} encrypted chunks to RocksDB")

        return {
            "status": "success",
            "content_id": content_id,
            "content_address": content_address,
            "file_name": file.filename,
            "file_size": len(content),
            "num_chunks": len(chunk_hashes),
            "encryption": "AES-256-GCM",
            "persisted": True,
            "placements": [
                {
                    "chunk_hash": p.chunk_hash[:16] + "...",
                    "devices": p.device_ids,
                    "score": p.score,
                }
                for p in placements
            ],
        }
    except Exception as e:
        logger.error(f"Publish failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/retrieve/{content_id}")
async def retrieve_content(content_id: str):
    """Retrieve with AES-GCM decryption"""
    try:
        logger.info(f"Retrieving (AES-GCM): {content_id}")

        # Retrieve and decrypt from RocksDB
        data = chunk_store.retrieve(content_id)
        chunk_hashes = chunk_store.list_chunks(content_id)

        return {
            "status": "success",
            "content_id": content_id,
            "size_bytes": len(data),
            "num_chunks": len(chunk_hashes),
            "data": bytes(data).hex(),
            "encryption": "AES-256-GCM",
            "source": "RocksDB",
        }
    except Exception as e:
        logger.error(f"Retrieve failed: {e}")
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================================
# Ollama Endpoints - Qwen 2.5-VL Integration
# ============================================================================


@app.post("/ollama/node/register")
async def register_ollama_node(registration: OllamaNodeRegistration):
    """Register a mesh node with Ollama capability"""
    try:
        success = distributed_ollama.register_node(
            registration.node_id, registration.ollama_url
        )

        if success:
            return {
                "status": "success",
                "node_id": registration.node_id,
                "message": "Node registered for distributed inference",
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to register node")

    except Exception as e:
        logger.error(f"Node registration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ollama/models")
async def list_ollama_models():
    """List available Ollama models"""
    try:
        models = ollama.list_models()
        return {
            "status": "success",
            "num_models": len(models),
            "models": [
                {
                    "name": m.get("name"),
                    "size": m.get("size", 0) / (1024**3),  # GB
                    "modified": m.get("modified_at", ""),
                }
                for m in models
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ollama/pull/{model_name}")
async def pull_ollama_model(model_name: str):
    """Pull a model from Ollama library"""
    try:
        logger.info(f"Pulling model: {model_name}")
        success = ollama.pull_model(model_name)

        if success:
            return {
                "status": "success",
                "model": model_name,
                "message": "Model pulled successfully",
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to pull model")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/infer/text")
async def text_inference(request: TextInferenceRequest):
    """Text-only inference with Qwen 2.5-VL"""
    try:
        logger.info(f"Text inference: {request.prompt[:50]}...")

        if request.use_distributed:
            result = distributed_ollama.distributed_inference(
                prompt=request.prompt, images=None
            )
        else:
            result = ollama.generate(
                prompt=request.prompt,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )

        if result.get("success"):
            return {
                "status": "success",
                "prompt": request.prompt,
                "response": result.get("response", ""),
                "model": result.get("model", "qwen2.5-vl"),
                "node_id": result.get("node_id", "local"),
                "latency_ms": result.get("total_duration", 0) / 1e6,  # ns to ms
                "distributed": request.use_distributed,
            }
        else:
            raise HTTPException(
                status_code=500, detail=result.get("error", "Unknown error")
            )

    except Exception as e:
        logger.error(f"Text inference failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/infer/vision")
async def vision_inference(request: VisionInferenceRequest):
    """Vision + text inference with Qwen 2.5-VL"""
    try:
        logger.info(f"Vision inference: {request.prompt[:50]}...")

        # Decode image if provided
        images = None
        if request.image_data:
            try:
                image_bytes = base64.b64decode(request.image_data)
                images = [image_bytes]
            except Exception as e:
                logger.error(f"Failed to decode image: {e}")
                raise HTTPException(status_code=400, detail="Invalid image data")

        if request.use_distributed:
            result = distributed_ollama.distributed_inference(
                prompt=request.prompt, images=images
            )
        else:
            result = ollama.generate(
                prompt=request.prompt,
                images=images,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )

        if result.get("success"):
            return {
                "status": "success",
                "prompt": request.prompt,
                "response": result.get("response", ""),
                "model": result.get("model", "qwen2.5-vl"),
                "node_id": result.get("node_id", "local"),
                "latency_ms": result.get("total_duration", 0) / 1e6,
                "has_image": images is not None,
                "distributed": request.use_distributed,
            }
        else:
            raise HTTPException(
                status_code=500, detail=result.get("error", "Unknown error")
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vision inference failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/infer/chat")
async def chat_inference(request: ChatRequest):
    """Multi-turn chat with optional vision"""
    try:
        messages = [
            {"role": msg.role, "content": msg.content} for msg in request.messages
        ]

        images = None
        if request.image_data:
            try:
                image_bytes = base64.b64decode(request.image_data)
                images = [image_bytes]
            except:
                pass

        result = ollama.chat(
            messages=messages, images=images, temperature=request.temperature
        )

        if result.get("success"):
            return {
                "status": "success",
                "message": result.get("message", {}),
                "model": result.get("model", "qwen2.5-vl"),
            }
        else:
            raise HTTPException(
                status_code=500, detail=result.get("error", "Unknown error")
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat inference failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# File Upload with Vision Analysis
# ============================================================================


@app.post("/analyze/image")
async def analyze_image(
    file: UploadFile = File(...), prompt: str = Form("Describe this image in detail")
):
    """Upload image and analyze with Qwen 2.5-VL"""
    try:
        image_data = await file.read()

        logger.info(f"Analyzing image: {file.filename}")

        result = ollama.generate(prompt=prompt, images=[image_data])

        if result.get("success"):
            return {
                "status": "success",
                "filename": file.filename,
                "prompt": prompt,
                "analysis": result.get("response", ""),
                "model": "qwen2.5-vl",
                "latency_ms": result.get("total_duration", 0) / 1e6,
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error"))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Distributed Inference Status
# ============================================================================


@app.get("/distributed/status")
async def distributed_status():
    """Get distributed inference network status"""
    try:
        available_nodes = distributed_ollama.get_available_nodes()

        return {
            "status": "success",
            "available_nodes": len(available_nodes),
            "nodes": available_nodes,
            "local_available": "local" in available_nodes,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Start Server
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    logger.info("=" * 70)
    logger.info("Starting Enhanced Mesh Network Server")
    logger.info("=" * 70)

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
