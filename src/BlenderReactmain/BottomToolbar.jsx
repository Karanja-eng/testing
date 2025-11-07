// components/BottomToolbar.jsx
import React, { useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

const BottomToolbar = ({
  zoomLevel,
  setZoomLevel,
  panOffset,
  setPanOffset,
}) => {
  const [snapStatus, setSnapStatus] = useState({
    endpoint: true,
    midpoint: true,
    center: true,
    perpendicular: true,
    tangent: true,
    intersection: true,
    extension: true,
    grid: false,
  });

  const snapModes = [
    { id: "endpoint", label: "END" },
    { id: "midpoint", label: "MID" },
    { id: "center", label: "CEN" },
    { id: "perpendicular", label: "PER" },
    { id: "tangent", label: "TAN" },
    { id: "intersection", label: "INT" },
    { id: "extension", label: "EXT" },
    { id: "grid", label: "GRI" },
  ];

  const zoomPresets = [
    { label: "Fit All", value: "fit" },
    { label: "25%", value: 0.25 },
    { label: "50%", value: 0.5 },
    { label: "100%", value: 1 },
    { label: "200%", value: 2 },
  ];

  const handleZoom = (preset) => {
    if (preset === "fit") {
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    } else {
      setZoomLevel(preset);
    }
  };

  const toggleSnap = (snapId) => {
    setSnapStatus((prev) => ({
      ...prev,
      [snapId]: !prev[snapId],
    }));
  };

  return (
    <div className="bg-gray-900 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-sm text-gray-300">
      {/* Left: Snap Modes */}
      <div className="flex gap-1 border-r border-gray-700 pr-4">
        {snapModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => toggleSnap(mode.id)}
            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
              snapStatus[mode.id]
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
            title={mode.label}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Center: Zoom Controls */}
      <div className="flex gap-2 items-center border-r border-gray-700 pr-4 ml-auto mr-auto">
        <button
          onClick={() => setZoomLevel((prev) => Math.max(prev * 0.8, 0.1))}
          className="p-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>

        <select
          value={zoomLevel}
          onChange={(e) =>
            handleZoom(
              e.target.value === "fit" ? "fit" : parseFloat(e.target.value)
            )
          }
          className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs border border-gray-600"
        >
          {zoomPresets.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>

        <span className="text-gray-400 text-xs min-w-[40px]">
          {Math.round(zoomLevel * 100)}%
        </span>

        <button
          onClick={() => setZoomLevel((prev) => Math.min(prev * 1.2, 10))}
          className="p-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>

        <button
          onClick={() => handleZoom("fit")}
          className="p-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded"
          title="Fit All"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Right: Status Information */}
      <div className="flex gap-4 text-xs text-gray-400">
        <div>
          Objects: <span className="text-gray-200">0</span>
        </div>
        <div>
          Selected: <span className="text-gray-200">0</span>
        </div>
        <div>
          Layers: <span className="text-gray-200">1</span>
        </div>
      </div>
    </div>
  );
};

export default BottomToolbar;
