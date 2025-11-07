// frontend/hooks/useDrawingAPI.js
/**
 * Custom React hooks for AutoCAD Clone API integration
 * Simplifies state management and API calls
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  projectAPI,
  objectAPI,
  layerAPI,
  geometryAPI,
  aiAPI,
  renderingAPI,
  exportAPI,
  DrawingWebSocket,
  uploadFile,
} from "../services/api";

// ============ useProject Hook ============

/**
 * Hook for project management
 * Handles loading, creating, updating projects
 */
export function useProject(projectId) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load project
  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        const data = await projectAPI.get(projectId);
        setProject(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setProject(null);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const updateProject = useCallback(
    async (updates) => {
      try {
        const updated = await projectAPI.update(projectId, updates);
        setProject(updated.project);
        return updated;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [projectId]
  );

  const deleteProject = useCallback(async () => {
    try {
      const result = await projectAPI.delete(projectId);
      setProject(null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [projectId]);

  return {
    project,
    loading,
    error,
    updateProject,
    deleteProject,
  };
}

// ============ useDrawingObjects Hook ============

/**
 * Hook for managing drawing objects
 * Handles CRUD operations and sync
 */
export function useDrawingObjects(projectId) {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create object
  const createObject = useCallback(
    async (objectData) => {
      try {
        setLoading(true);
        const newObject = await objectAPI.create(projectId, objectData);
        setObjects((prev) => [...prev, newObject]);
        setError(null);
        return newObject;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Create multiple objects
  const batchCreateObjects = useCallback(
    async (objectsData) => {
      try {
        setLoading(true);
        const newObjects = await objectAPI.batchCreate(projectId, objectsData);
        setObjects((prev) => [...prev, ...newObjects]);
        setError(null);
        return newObjects;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Update object
  const updateObject = useCallback(
    async (objectId, updates) => {
      try {
        setLoading(true);
        const updated = await objectAPI.update(projectId, objectId, updates);
        setObjects((prev) =>
          prev.map((obj) => (obj.id === objectId ? updated : obj))
        );
        setError(null);
        return updated;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Delete object
  const deleteObject = useCallback(
    async (objectId) => {
      try {
        setLoading(true);
        await objectAPI.delete(projectId, objectId);
        setObjects((prev) => prev.filter((obj) => obj.id !== objectId));
        setError(null);
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Batch delete objects
  const batchDeleteObjects = useCallback(
    async (objectIds) => {
      try {
        setLoading(true);
        await objectAPI.batchDelete(projectId, objectIds);
        setObjects((prev) => prev.filter((obj) => !objectIds.includes(obj.id)));
        setError(null);
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  const getObject = useCallback(
    (objectId) => {
      return objects.find((obj) => obj.id === objectId);
    },
    [objects]
  );

  const getObjectsByLayer = useCallback(
    (layerId) => {
      return objects.filter((obj) => obj.layer_id === layerId);
    },
    [objects]
  );

  return {
    objects,
    loading,
    error,
    createObject,
    batchCreateObjects,
    updateObject,
    deleteObject,
    batchDeleteObjects,
    getObject,
    getObjectsByLayer,
  };
}

// ============ useLayers Hook ============

/**
 * Hook for layer management
 */
export function useLayers(projectId) {
  const [layers, setLayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create layer
  const createLayer = useCallback(
    async (layerData) => {
      try {
        setLoading(true);
        const newLayer = await layerAPI.create(projectId, layerData);
        setLayers((prev) => [...prev, newLayer]);
        setError(null);
        return newLayer;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Update layer
  const updateLayer = useCallback(
    async (layerId, updates) => {
      try {
        setLoading(true);
        const updated = await layerAPI.update(projectId, layerId, updates);
        setLayers((prev) =>
          prev.map((layer) => (layer.id === layerId ? updated : layer))
        );
        setError(null);
        return updated;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Delete layer
  const deleteLayer = useCallback(
    async (layerId) => {
      try {
        setLoading(true);
        await layerAPI.delete(projectId, layerId);
        setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
        setError(null);
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  const getLayer = useCallback(
    (layerId) => {
      return layers.find((layer) => layer.id === layerId);
    },
    [layers]
  );

  return {
    layers,
    loading,
    error,
    createLayer,
    updateLayer,
    deleteLayer,
    getLayer,
  };
}

// ============ useGeometry Hook ============

/**
 * Hook for geometry operations
 */
export function useGeometry(projectId) {
  const [measurements, setMeasurements] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Measure objects
  const measure = useCallback(async (objectIds) => {
    try {
      setLoading(true);
      const result = await geometryAPI.measure(objectIds);
      setMeasurements(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Offset geometry
  const offset = useCallback(
    async (objectId, distance) => {
      try {
        setLoading(true);
        const result = await geometryAPI.offset(projectId, objectId, distance);
        setError(null);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Find intersections
  const findIntersections = useCallback(async (objectIds) => {
    try {
      setLoading(true);
      const result = await geometryAPI.findIntersections(objectIds);
      setError(null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    measurements,
    loading,
    error,
    measure,
    offset,
    findIntersections,
  };
}

// ============ useAI Hook ============

/**
 * Hook for AI drawing generation
 */
export function useAI(projectId) {
  const [aiState, setAIState] = useState({
    status: null,
    progress: 0,
    objects: [],
    error: null,
  });
  const [loading, setLoading] = useState(false);

  // Generate drawing from prompt
  const generate = useCallback(
    async (prompt, parameters = {}) => {
      try {
        setLoading(true);
        setAIState((prev) => ({ ...prev, status: "processing", progress: 0 }));

        const response = await aiAPI.generate(projectId, prompt, parameters);
        setAIState({
          status: response.status,
          progress: response.progress,
          objects: response.objects,
          error: null,
        });

        return response;
      } catch (err) {
        setAIState((prev) => ({ ...prev, error: err.message }));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Check AI status
  const checkStatus = useCallback(async (requestId) => {
    try {
      const response = await aiAPI.getStatus(requestId);
      setAIState((prev) => ({
        ...prev,
        status: response.status,
        progress: response.progress,
      }));
      return response;
    } catch (err) {
      setAIState((prev) => ({ ...prev, error: err.message }));
      throw err;
    }
  }, []);

  return {
    ...aiState,
    loading,
    generate,
    checkStatus,
  };
}

// ============ useRendering Hook ============

/**
 * Hook for rendering operations
 */
export function useRendering(projectId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Render to 2D
  const render2D = useCallback(
    async (format = "pdf") => {
      try {
        setLoading(true);
        const blob = await renderingAPI.render2D(projectId, format);
        return blob;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Render to 3D
  const render3D = useCallback(
    async (format = "glb") => {
      try {
        setLoading(true);
        const blob = await renderingAPI.render3D(projectId, format);
        return blob;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  return {
    loading,
    error,
    render2D,
    render3D,
  };
}

// ============ useExport Hook ============

/**
 * Hook for exporting projects
 */
export function useExport(projectId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const exportDWG = useCallback(async () => {
    try {
      setLoading(true);
      await exportAPI.exportDWG(projectId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const exportDXF = useCallback(async () => {
    try {
      setLoading(true);
      await exportAPI.exportDXF(projectId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const exportPDF = useCallback(async () => {
    try {
      setLoading(true);
      await exportAPI.exportPDF(projectId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const exportJSON = useCallback(async () => {
    try {
      setLoading(true);
      await exportAPI.exportJSON(projectId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return {
    loading,
    error,
    exportDWG,
    exportDXF,
    exportPDF,
    exportJSON,
  };
}

// ============ useWebSocket Hook ============

/**
 * Hook for WebSocket real-time updates
 */
export function useWebSocket(projectId) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);

  // Initialize WebSocket
  useEffect(() => {
    wsRef.current = new DrawingWebSocket(projectId);

    wsRef.current.on("connect", () => {
      setConnected(true);
      setError(null);
    });

    wsRef.current.on("disconnect", () => {
      setConnected(false);
    });

    wsRef.current.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    wsRef.current.on("error", (err) => {
      setError(err.message);
    });

    wsRef.current.connect().catch((err) => {
      setError(err.message);
    });

    return () => {
      wsRef.current?.disconnect();
    };
  }, [projectId]);

  const send = useCallback((message) => {
    wsRef.current?.send(message);
  }, []);

  const notifyObjectAdded = useCallback((object) => {
    wsRef.current?.notifyObjectAdded(object);
  }, []);

  const notifyObjectUpdated = useCallback((object) => {
    wsRef.current?.notifyObjectUpdated(object);
  }, []);

  const notifyObjectDeleted = useCallback((objectId) => {
    wsRef.current?.notifyObjectDeleted(objectId);
  }, []);

  return {
    connected,
    error,
    messages,
    send,
    notifyObjectAdded,
    notifyObjectUpdated,
    notifyObjectDeleted,
  };
}

// ============ useFile Hook ============

/**
 * Hook for file upload/import
 */
export function useFile(projectId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const uploadAndImport = useCallback(
    async (file) => {
      try {
        setLoading(true);
        const result = await uploadFile(projectId, file);
        setError(null);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  return {
    loading,
    error,
    uploadAndImport,
  };
}

export default {
  useProject,
  useDrawingObjects,
  useLayers,
  useGeometry,
  useAI,
  useRendering,
  useExport,
  useWebSocket,
  useFile,
};
