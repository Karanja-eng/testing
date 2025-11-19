#!/usr/bin/env python3
"""
Ollama Integration for Qwen 2.5-VL Model
Handles local model inference with vision capabilities
"""

import requests
import json
import base64
from typing import List, Dict, Optional, Union
from PIL import Image
import io
import logging

logger = logging.getLogger(__name__)


class OllamaClient:
    """Client for Ollama API with Qwen 2.5-VL support"""

    def __init__(
        self, base_url: str = "http://localhost:11434", model: str = "qwen2.5-vl"
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.session = requests.Session()

        # Check if model is available
        self._check_model_availability()

    def _check_model_availability(self):
        """Check if the Qwen model is pulled and available"""
        try:
            response = self.session.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                available_models = [m["name"] for m in models]

                if not any(self.model in m for m in available_models):
                    logger.warning(
                        f"Model {self.model} not found. Available models: {available_models}"
                    )
                    logger.info(f"Pull the model with: ollama pull {self.model}")
                else:
                    logger.info(f"Model {self.model} is available")
            else:
                logger.error(f"Failed to check models: {response.status_code}")
        except Exception as e:
            logger.error(f"Error checking Ollama: {e}")

    def generate(
        self,
        prompt: str,
        images: Optional[List[Union[str, bytes, Image.Image]]] = None,
        stream: bool = False,
        **kwargs,
    ) -> Dict:
        """
        Generate text/vision completion

        Args:
            prompt: Text prompt
            images: Optional list of images (file paths, bytes, or PIL Images)
            stream: Whether to stream the response
            **kwargs: Additional Ollama parameters (temperature, top_p, etc.)

        Returns:
            Dict with response and metadata
        """

        # Prepare request
        request_data = {"model": self.model, "prompt": prompt, "stream": stream}

        # Add images if provided (for vision model)
        if images:
            encoded_images = []
            for img in images:
                encoded_images.append(self._encode_image(img))
            request_data["images"] = encoded_images

        # Add optional parameters
        if kwargs:
            request_data.update(kwargs)

        try:
            response = self.session.post(
                f"{self.base_url}/api/generate",
                json=request_data,
                timeout=120,  # 2 minute timeout for large models
            )

            if response.status_code == 200:
                if stream:
                    return self._handle_stream_response(response)
                else:
                    result = response.json()
                    return {
                        "success": True,
                        "response": result.get("response", ""),
                        "model": result.get("model", self.model),
                        "created_at": result.get("created_at", ""),
                        "done": result.get("done", False),
                        "total_duration": result.get("total_duration", 0),
                        "load_duration": result.get("load_duration", 0),
                        "prompt_eval_count": result.get("prompt_eval_count", 0),
                        "eval_count": result.get("eval_count", 0),
                    }
            else:
                logger.error(
                    f"Ollama API error: {response.status_code} - {response.text}"
                )
                return {
                    "success": False,
                    "error": f"API returned {response.status_code}",
                    "details": response.text,
                }

        except requests.exceptions.Timeout:
            logger.error("Ollama request timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Ollama request failed: {e}")
            return {"success": False, "error": str(e)}

    def _encode_image(self, image: Union[str, bytes, Image.Image]) -> str:
        """Encode image to base64 string"""
        try:
            if isinstance(image, str):
                # File path
                with open(image, "rb") as f:
                    image_bytes = f.read()
            elif isinstance(image, bytes):
                image_bytes = image
            elif isinstance(image, Image.Image):
                # PIL Image
                buffer = io.BytesIO()
                image.save(buffer, format="PNG")
                image_bytes = buffer.getvalue()
            else:
                raise ValueError(f"Unsupported image type: {type(image)}")

            return base64.b64encode(image_bytes).decode("utf-8")

        except Exception as e:
            logger.error(f"Failed to encode image: {e}")
            raise

    def _handle_stream_response(self, response):
        """Handle streaming response"""
        full_response = ""
        for line in response.iter_lines():
            if line:
                chunk = json.loads(line)
                if "response" in chunk:
                    full_response += chunk["response"]
                    yield chunk

        return {"success": True, "response": full_response}

    def chat(
        self,
        messages: List[Dict[str, str]],
        images: Optional[List[Union[str, bytes, Image.Image]]] = None,
        **kwargs,
    ) -> Dict:
        """
        Chat-style completion

        Args:
            messages: List of message dicts with 'role' and 'content'
            images: Optional images for vision model
            **kwargs: Additional parameters

        Returns:
            Dict with response
        """

        request_data = {"model": self.model, "messages": messages, "stream": False}

        if images:
            encoded_images = []
            for img in images:
                encoded_images.append(self._encode_image(img))
            request_data["images"] = encoded_images

        if kwargs:
            request_data.update(kwargs)

        try:
            response = self.session.post(
                f"{self.base_url}/api/chat", json=request_data, timeout=120
            )

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "message": result.get("message", {}),
                    "model": result.get("model", self.model),
                    "done": result.get("done", False),
                }
            else:
                return {
                    "success": False,
                    "error": f"API returned {response.status_code}",
                }

        except Exception as e:
            logger.error(f"Chat request failed: {e}")
            return {"success": False, "error": str(e)}

    def embeddings(self, text: str) -> Dict:
        """Generate embeddings for text"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=30,
            )

            if response.status_code == 200:
                result = response.json()
                return {"success": True, "embedding": result.get("embedding", [])}
            else:
                return {
                    "success": False,
                    "error": f"API returned {response.status_code}",
                }

        except Exception as e:
            logger.error(f"Embeddings request failed: {e}")
            return {"success": False, "error": str(e)}

    def pull_model(self, model_name: Optional[str] = None):
        """Pull a model from Ollama library"""
        model = model_name or self.model

        try:
            logger.info(f"Pulling model: {model}")
            response = self.session.post(
                f"{self.base_url}/api/pull",
                json={"name": model},
                stream=True,
                timeout=3600,  # 1 hour timeout for large downloads
            )

            for line in response.iter_lines():
                if line:
                    status = json.loads(line)
                    if "status" in status:
                        logger.info(status["status"])

            logger.info(f"Model {model} pulled successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to pull model: {e}")
            return False

    def list_models(self) -> List[Dict]:
        """List available models"""
        try:
            response = self.session.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                return response.json().get("models", [])
            return []
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []


class DistributedOllamaManager:
    """Manage distributed Qwen inference across mesh nodes"""

    def __init__(self, local_client: OllamaClient):
        self.local_client = local_client
        self.node_clients = {}  # node_id -> OllamaClient

    def register_node(self, node_id: str, ollama_url: str):
        """Register a mesh node with Ollama capability"""
        try:
            client = OllamaClient(base_url=ollama_url)
            self.node_clients[node_id] = client
            logger.info(f"Registered Ollama node: {node_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to register node {node_id}: {e}")
            return False

    def distributed_inference(
        self,
        prompt: str,
        images: Optional[List] = None,
        preferred_nodes: Optional[List[str]] = None,
    ) -> Dict:
        """
        Route inference to best available node

        Strategy:
        1. Try preferred nodes first
        2. Fall back to local node
        3. Load balance across available nodes
        """

        # Try preferred nodes
        if preferred_nodes:
            for node_id in preferred_nodes:
                if node_id in self.node_clients:
                    try:
                        result = self.node_clients[node_id].generate(prompt, images)
                        if result.get("success"):
                            result["node_id"] = node_id
                            return result
                    except Exception as e:
                        logger.warning(f"Node {node_id} failed: {e}")
                        continue

        # Try local node
        try:
            result = self.local_client.generate(prompt, images)
            if result.get("success"):
                result["node_id"] = "local"
                return result
        except Exception as e:
            logger.error(f"Local inference failed: {e}")

        return {"success": False, "error": "No available nodes for inference"}

    def get_available_nodes(self) -> List[str]:
        """Get list of nodes with working Ollama"""
        available = []

        # Check local
        try:
            models = self.local_client.list_models()
            if models:
                available.append("local")
        except:
            pass

        # Check remote nodes
        for node_id, client in self.node_clients.items():
            try:
                models = client.list_models()
                if models:
                    available.append(node_id)
            except:
                pass

        return available
