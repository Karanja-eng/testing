// frontend/components/DrawingEditor.jsx
/**
 * Complete DrawingEditor Component
 * Shows how to integrate all the API hooks and services
 */

import React, { useState, useEffect } from 'react';
import {
  useProject,
  useDrawingObjects,
  useLayers,
  useGeometry,
  useAI,
  useRendering,
  useExport,
  useWebSocket,
  useFile
} from '../hooks/useDrawingAPI';
import DrawingCanvas from './DrawingCanvas';
import TopToolbar from './TopToolbar';
import LeftPanel from './LeftPanel';
import CopilotSidebar from './CopilotSidebar';

const DrawingEditor = ({ projectId }) => {
  // API Hooks
  const project = useProject(projectId);
  const objects = useDrawingObjects(projectId);
  const layers = useLayers(projectId);
  const geometry = useGeometry(projectId);
  const ai = useAI(projectId);
  const rendering = useRendering(projectId);
  const exportAPI = useExport(projectId);
  const ws = useWebSocket(projectId);
  const file = useFile(projectId);

  // Local state
  const [activeTool, setActiveTool] = useState(null);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [showSaveStatus, setShowSaveStatus] = useState(false);

  // ============ Drawing Tool Handlers ============

  /**
   * Handle line drawing
   */
  const handleDrawLine = async (start, end) => {
    try {
      const newObject = {
        type: 'line',
        layer_id: layers.layers[0]?.id,
        stroke_color: '#FFFFFF',
        stroke_width: 2,
        properties: {
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y }
        }
      };

      const created = await objects.createObject(newObject);
      
      // Notify via WebSocket for real-time sync
      ws.notifyObjectAdded(created);
      
      setShowSaveStatus(true);
      setTimeout(() => setShowSaveStatus(false), 2000);
    } catch (error) {
      console.error('Failed to draw line:', error);
      alert('Failed to draw line');
    }
  };

  /**
   * Handle circle drawing
   */
  const handleDrawCircle = async (center, radius) => {
    try {
      const newObject = {
        type: 'circle',
        layer_id: layers.layers[0]?.id,
        stroke_color: '#FFFFFF',
        stroke_width: 2,
        properties: {
          center: { x: center.x, y: center.y },
          radius
        }
      };

      const created = await objects.createObject(newObject);
      ws.notifyObjectAdded(created);
    } catch (error) {
      console.error('Failed to draw circle:', error);
      alert('Failed to draw circle');
    }
  };

  /**
   * Handle rectangle drawing
   */
  const handleDrawRectangle = async (start, end) => {
    try {
      const newObject = {
        type: 'rectangle',
        layer_id: layers.layers[0]?.id,
        stroke_color: '#FFFFFF',
        stroke_width: 2,
        properties: {
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y }
        }
      };

      const created = await objects.createObject(newObject);
      ws.notifyObjectAdded(created);
    } catch (error) {
      console.error('Failed to draw rectangle:', error);
      alert('Failed to draw rectangle');
    }
  };

  /**
   * Handle hatch filling
   */
  const handleApplyHatch = async (objectIds, pattern, angle = 45) => {
    try {
      const hatchObject = {
        type: 'hatch',
        layer_id: layers.layers[0]?.id,
        stroke_color: '#CCCCCC',
        properties: {
          pattern,
          angle,
          filled_object_ids: objectIds
        }
      };

      const created = await objects.createObject(hatchObject);
      ws.notifyObjectAdded(created);
    } catch (error) {
      console.error('Failed to apply hatch:', error);
      alert('Failed to apply hatch');
    }
  };

  // ============ Modification Tool Handlers ============

  /**
   * Handle move operation
   */
  const handleMove = async (objectIds, deltaX, deltaY) => {
    try {
      for (const objId of objectIds) {
        const obj = objects.getObject(objId);
        if (obj) {
          const updated = {
            ...obj,
            properties: {
              ...obj.properties,
              offset: { x: deltaX, y: deltaY }
            }
          };
          await objects.updateObject(objId, updated);
          ws.notifyObjectUpdated(updated);
        }
      }
    } catch (error) {
      console.error('Failed to move objects:', error);
    }
  };

  /**
   * Handle copy operation
   */
  const handleCopy = async (objectIds) => {
    try {
      const toCopy = objectIds.map(id => objects.getObject(id));
      const copies = toCopy.map(obj => ({
        ...obj,
        id: undefined, // Let backend generate new ID
        properties: {
          ...obj.properties,
          offset: { x: 50, y: 50 } // Offset copy
        }
      }));

      const created = await objects.batchCreateObjects(copies);
      created.forEach(obj => ws.notifyObjectAdded(obj));
    } catch (error) {
      console.error('Failed to copy objects:', error);
    }
  };

  /**
   * Handle rotate operation
   */
  const handleRotate = async (objectIds, angle, centerPoint) => {
    try {
      for (const objId of objectIds) {
        const obj = objects.getObject(objId);
        if (obj) {
          const updated = {
            ...obj,
            properties: {
              ...obj.properties,
              rotation: angle,
              rotation_center: centerPoint
            }
          };
          await objects.updateObject(objId, updated);
          ws.notifyObjectUpdated(updated);
        }
      }
    } catch (error) {
      console.error('Failed to rotate objects:', error);
    }
  };

  /**
   * Handle mirror operation
   */
  const handleMirror = async (objectIds, mirrorLineStart, mirrorLineEnd) => {
    try {
      for (const objId of objectIds) {
        const obj = objects.getObject(objId);
        if (obj) {
          const updated = {
            ...obj,
            properties: {
              ...obj.properties,
              mirror_line: { start: mirrorLineStart, end: mirrorLineEnd }
            }
          };
          await objects.updateObject(objId, updated);
          ws.notifyObjectUpdated(updated);
        }
      }
    } catch (error) {
      console.error('Failed to mirror objects:', error);
    }
  };

  /**
   * Handle scale operation
   */
  const handleScale = async (objectIds, scale, centerPoint) => {
    try {
      for (const objId of objectIds) {
        const obj = objects.getObject(objId);
        if (obj) {
          const updated = {
            ...obj,
            properties: {
              ...obj.properties,
              scale,
              scale_center: centerPoint
            }
          };
          await objects.updateObject(objId, updated);
          ws.notifyObjectUpdated(updated);
        }
      }
    } catch (error) {
      console.error('Failed to scale objects:', error);
    }
  };

  /**
   * Handle offset operation
   */
  const handleOffset = async (objectIds, distance) => {
    try {
      for (const objId of objectIds) {
        const offsetObjects = await geometry.offset(objId, distance);
        // Add offset objects to drawing
        await objects.batchCreateObjects(offsetObjects);
        offsetObjects.forEach(obj => ws.notifyObjectAdded(obj));
      }
    } catch (error) {
      console.error('Failed to offset objects:', error);
    }
  };

  // ============ Measurement Handlers ============

  /**
   * Measure selected objects
   */
  const handleMeasure = async () => {
    try {
      const measurements = await geometry.measure(selectedObjects);
      console.log('Measurements:', measurements);
      // Display in properties panel or toast
      alert(`Length: ${measurements.total_length}mm, Area: ${measurements.total_area}mm²`);
    } catch (error) {
      console.error('Failed to measure:', error);
    }
  };

  /**
   * Find intersections
   */
  const handleFindIntersections = async () => {
    try {
      const intersections = await geometry.findIntersections(selectedObjects);
      console.log('Intersections:', intersections);
      // Highlight intersection points
    } catch (error) {
      console.error('Failed to find intersections:', error);
    }
  };

  // ============ AI Handlers ============

  /**
   * Generate drawing from AI prompt
   */
  const handleAIGenerate = async (prompt) => {
    try {
      const response = await ai.generate(prompt, {
        style: 'engineering',
        auto_dimension: true
      });

      if (response.objects && response.objects.length > 0) {
        // Add generated objects
        await objects.batchCreateObjects(response.objects);
        response.objects.forEach(obj => ws.notifyObjectAdded(obj));
        alert(`Generated ${response.objects.length} objects`);
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      alert('AI generation failed');
    }
}