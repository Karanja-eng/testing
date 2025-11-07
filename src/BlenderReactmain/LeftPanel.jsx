// components/LeftPanel.jsx
import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronDown,
} from "lucide-react";

const LeftPanel = ({
  layers = [],
  setLayers = () => {},
  activeLayer = null,
  setActiveLayer = () => {},
  drawingObjects = [],
  setDrawingObjects = () => {},
  selectedObjects = [],
  setSelectedObjects = () => {},
  addToHistory = () => {},
}) => {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [newLayerName, setNewLayerName] = useState("");
  const [showNewLayer, setShowNewLayer] = useState(false);

  const colors = [
    "#FFFFFF",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
    "#FFA500",
    "#808080",
    "#FFC0CB",
  ];

  // Create new layer
  const createLayer = () => {
    if (!newLayerName.trim()) return;
    const newLayer = {
      id: Math.random().toString(36).substr(2, 9),
      name: newLayerName,
      color: colors[layers.length % colors.length],
      visible: true,
      locked: false,
      objects: [],
      isGroup: false,
      parentId: null,
    };
    setLayers([...layers, newLayer]);
    setActiveLayer(newLayer.id);
    setNewLayerName("");
    setShowNewLayer(false);
  };

  // Delete layer
  const deleteLayer = (layerId) => {
    if (layers.length === 1) return;
    const updated = layers.filter((l) => l.id !== layerId);
    setLayers(updated);
    if (activeLayer === layerId) {
      setActiveLayer(updated[0].id);
    }
    // Remove objects from this layer
    const filtered = drawingObjects.filter((obj) => obj.layerId !== layerId);
    setDrawingObjects(filtered);
    addToHistory(filtered);
  };

  // Toggle layer visibility
  const toggleVisibility = (layerId) => {
    const updated = layers.map((l) =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    setLayers(updated);
    const objsUpdated = drawingObjects.map((obj) =>
      obj.layerId === layerId ? { ...obj, visible: !obj.visible } : obj
    );
    setDrawingObjects(objsUpdated);
  };

  // Toggle layer lock
  const toggleLock = (layerId) => {
    const updated = layers.map((l) =>
      l.id === layerId ? { ...l, locked: !l.locked } : l
    );
    setLayers(updated);
  };

  // Change layer color
  const changeColor = (layerId, color) => {
    const updated = layers.map((l) => (l.id === layerId ? { ...l, color } : l));
    setLayers(updated);
    const objsUpdated = drawingObjects.map((obj) =>
      obj.layerId === layerId ? { ...obj, strokeColor: color } : obj
    );
    setDrawingObjects(objsUpdated);
    addToHistory(objsUpdated);
  };

  // Get objects in layer
  const getLayerObjects = (layerId) => {
    if (!Array.isArray(drawingObjects)) return [];
    const objs = drawingObjects.filter((obj) => obj.layerId === layerId);
    return Array.isArray(objs) ? objs : [];
  };

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
      {/* Layers Header */}
      <div className="border-b border-gray-700 p-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-100">Layers</h3>
        <button
          onClick={() => setShowNewLayer(!showNewLayer)}
          className="p-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
          title="New Layer"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* New Layer Input */}
      {showNewLayer && (
        <div className="border-b border-gray-700 p-2 flex gap-2">
          <input
            type="text"
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            placeholder="Layer name"
            className="flex-1 bg-gray-700 text-gray-100 px-2 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") createLayer();
              if (e.key === "Escape") setShowNewLayer(false);
            }}
            autoFocus
          />
          <button
            onClick={createLayer}
            className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto">
        {(layers || []).map((layer) => (
          <div key={layer.id} className="border-b border-gray-700">
            {/* Layer Header */}
            <div
              onClick={() => setActiveLayer(layer.id)}
              className={`p-3 flex items-center gap-2 cursor-pointer transition-colors ${
                activeLayer === layer.id
                  ? "bg-blue-900 bg-opacity-50"
                  : "hover:bg-gray-700"
              }`}
            >
              {/* Color Indicator */}
              <div
                className="w-4 h-4 rounded border border-gray-600 cursor-pointer flex-shrink-0"
                style={{ backgroundColor: layer.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Color picker would go here
                }}
                title="Click to change color"
              />

              {/* Layer Name */}
              <span className="flex-1 text-sm text-gray-200 truncate font-medium">
                {layer.name}
              </span>

              {/* Object Count */}
              <span className="text-xs text-gray-500 flex-shrink-0">
                ({getLayerObjects(layer.id).length})
              </span>

              {/* Visibility Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisibility(layer.id);
                }}
                className="p-1 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
                title={layer.visible ? "Hide" : "Show"}
              >
                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>

              {/* Lock Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLock(layer.id);
                }}
                className="p-1 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
                title={layer.locked ? "Unlock" : "Lock"}
              >
                {layer.locked ? <Lock size={16} /> : <Unlock size={16} />}
              </button>

              {/* Delete */}
              {layers.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayer(layer.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Delete Layer"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Layer Objects */}
            {getLayerObjects(layer.id).length > 0 && (
              <div className="bg-gray-900 bg-opacity-50 text-xs text-gray-400 px-4 py-2 space-y-1">
                {getLayerObjects(layer.id).map((obj) => (
                  <div
                    key={obj.id}
                    onClick={() => setSelectedObjects([obj.id])}
                    className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                      selectedObjects.includes(obj.id)
                        ? "bg-blue-700 text-white"
                        : "hover:bg-gray-700"
                    }`}
                  >
                    <span className="capitalize">{obj.type}</span>
                    <span className="text-gray-500">
                      {" "}
                      #{obj.id.slice(0, 4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeftPanel;
