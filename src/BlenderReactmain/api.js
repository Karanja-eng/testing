// frontend/services/api.js
/**
 * API Service - Handles all backend communication
 * Integrates with FastAPI backend
 */

import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8000";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ============ Project APIs ============

export const projectAPI = {
  // Create new project
  create: async (name, description = "") => {
    try {
      const response = await apiClient.post("/projects", {
        name,
        description,
      });
      return response.data;
    } catch (error) {
      console.error("Failed to create project:", error);
      throw error;
    }
  },

  // Get project by ID
  get: async (projectId) => {
    try {
      const response = await apiClient.get(`/projects/${projectId}`);
      return response.data.project;
    } catch (error) {
      console.error("Failed to fetch project:", error);
      throw error;
    }
  },

  // Get all projects (paginated)
  list: async (page = 1, limit = 20) => {
    try {
      const response = await apiClient.get("/projects", {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      throw error;
    }
  },

  // Update project
  update: async (projectId, updates) => {
    try {
      const response = await apiClient.put(`/projects/${projectId}`, updates);
      return response.data;
    } catch (error) {
      console.error("Failed to update project:", error);
      throw error;
    }
  },

  // Delete project
  delete: async (projectId) => {
    try {
      const response = await apiClient.delete(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      console.error("Failed to delete project:", error);
      throw error;
    }
  },
};

// ============ Drawing Objects APIs ============

export const objectAPI = {
  // Add single object
  create: async (projectId, objectData) => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/objects`,
        objectData
      );
      return response.data.object;
    } catch (error) {
      console.error("Failed to create object:", error);
      throw error;
    }
  },

  // Add multiple objects
  batchCreate: async (projectId, objects) => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/objects/batch`,
        { objects }
      );
      return response.data.objects;
    } catch (error) {
      console.error("Failed to batch create objects:", error);
      throw error;
    }
  },

  // Update object
  update: async (projectId, objectId, updates) => {
    try {
      const response = await apiClient.put(
        `/projects/${projectId}/objects/${objectId}`,
        updates
      );
      return response.data.object;
    } catch (error) {
      console.error("Failed to update object:", error);
      throw error;
    }
  },

  // Delete object
  delete: async (projectId, objectId) => {
    try {
      const response = await apiClient.delete(
        `/projects/${projectId}/objects/${objectId}`
      );
      return response.data;
    } catch (error) {
      console.error("Failed to delete object:", error);
      throw error;
    }
  },

  // Batch delete objects
  batchDelete: async (projectId, objectIds) => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/objects/batch-delete`,
        { object_ids: objectIds }
      );
      return response.data;
    } catch (error) {
      console.error("Failed to batch delete objects:", error);
      throw error;
    }
  },
};

// ============ Layers APIs ============

export const layerAPI = {
  // Create layer
  create: async (projectId, layerData) => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/layers`,
        layerData
      );
      return response.data.layer;
    } catch (error) {
      console.error("Failed to create layer:", error);
      throw error;
    }
  },

  // Update layer
  update: async (projectId, layerId, updates) => {
    try {
      const response = await apiClient.put(
        `/projects/${projectId}/layers/${layerId}`,
        updates
      );
      return response.data.layer;
    } catch (error) {
      console.error("Failed to update layer:", error);
      throw error;
    }
  },

  // Delete layer
  delete: async (projectId, layerId) => {
    try {
      const response = await apiClient.delete(
        `/projects/${projectId}/layers/${layerId}`
      );
      return response.data;
    } catch (error) {
      console.error("Failed to delete layer:", error);
      throw error;
    }
  },
};

// ============ Geometry & Measurement APIs ============

export const geometryAPI = {
  // Measure geometry
  measure: async (objectIds) => {
    try {
      const response = await apiClient.post("/geometry/measure", {
        object_ids: objectIds,
      });
      return response.data.measurements;
    } catch (error) {
      console.error("Failed to measure objects:", error);
      throw error;
    }
  },

  // Offset lines
  offset: async (projectId, objectId, distance) => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/geometry/offset`,
        { object_id: objectId, distance }
      );
      return response.data.objects;
    } catch (error) {
      console.error("Failed to offset geometry:", error);
      throw error;
    }
  },

  // Find intersections
  findIntersections: async (objectIds) => {
    try {
      const response = await apiClient.post("/geometry/intersections", {
        object_ids: objectIds,
      });
      return response.data.intersections;
    } catch (error) {
      console.error("Failed to find intersections:", error);
      throw error;
    }
  },
};

// ============ AI APIs ============

export const aiAPI = {
  // Generate drawing from prompt
  generate: async (projectId, prompt, parameters = {}) => {
    try {
      const response = await apiClient.post("/ai/generate", {
        prompt,
        parameters,
        project_id: projectId,
      });
      return response.data;
    } catch (error) {
      console.error("Failed to generate drawing:", error);
      throw error;
    }
  },

  // Get AI generation status
  getStatus: async (requestId) => {
    try {
      const response = await apiClient.get(`/ai/generate/${requestId}`);
      return response.data;
    } catch (error) {
      console.error("Failed to get AI status:", error);
      throw error;
    }
  },
};

// ============ Rendering APIs ============

export const renderingAPI = {
  // Render to 2D format
  render2D: async (projectId, format = "pdf") => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/rendering/2d`,
        { format },
        { responseType: "blob" }
      );
      return response.data;
    } catch (error) {
      console.error("Failed to render 2D:", error);
      throw error;
    }
  },

  // Render to 3D format
  render3D: async (projectId, format = "glb") => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/rendering/3d`,
        { format },
        { responseType: "blob" }
      );
      return response.data;
    } catch (error) {
      console.error("Failed to render 3D:", error);
      throw error;
    }
  },
};

// ============ WebSocket Service ============

export class DrawingWebSocket {
  constructor(projectId) {
    this.projectId = projectId;
    this.ws = null;
    this.listeners = {
      connect: [],
      disconnect: [],
      message: [],
      error: [],
    };
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Connect to WebSocket
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${WS_URL}/ws/drawing/${this.projectId}`);

        this.ws.onopen = () => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          this.emit("connect");
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit("message", data);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.emit("error", error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("WebSocket disconnected");
          this.emit("disconnect");
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Attempt to reconnect
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      console.log(`Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    }
  }

  // Send message via WebSocket
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected");
    }
  }

  // Notify object was added
  notifyObjectAdded(object) {
    this.send({
      type: "object_added",
      project_id: this.projectId,
      object,
    });
  }

  // Notify object was updated
  notifyObjectUpdated(object) {
    this.send({
      type: "object_updated",
      project_id: this.projectId,
      object,
    });
  }

  // Notify object was deleted
  notifyObjectDeleted(objectId) {
    this.send({
      type: "object_deleted",
      project_id: this.projectId,
      object_id: objectId,
    });
  }

  // Subscribe to events
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  // Emit event
  emit(event, data = null) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// ============ Export Service ============

export const exportAPI = {
  // Export project as DWG
  exportDWG: async (projectId) => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/export/dwg`,
        {},
        { responseType: "blob" }
      );
      downloadBlob(response.data, `project-${projectId}.dwg`);
    } catch (error) {
      console.error("Failed to export DWG:", error);
      throw error;
    }
  },

  // Export project as DXF
  exportDXF: async (projectId) => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/export/dxf`,
        {},
        { responseType: "blob" }
      );
      downloadBlob(response.data, `project-${projectId}.dxf`);
    } catch (error) {
      console.error("Failed to export DXF:", error);
      throw error;
    }
  },

  // Export project as PDF
  exportPDF: async (projectId) => {
    try {
      const response = await apiClient.post(
        `/projects/${projectId}/export/pdf`,
        {},
        { responseType: "blob" }
      );
      downloadBlob(response.data, `project-${projectId}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      throw error;
    }
  },
};
