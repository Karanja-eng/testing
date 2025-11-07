// components/PropertiesPanel.jsx
import React, { useState } from "react";
import { X } from "lucide-react";

const PropertiesPanel = ({ selectedObjects, layers, onClose }) => {
  const [activeTab, setActiveTab] = useState("geometry");

  const hatchPatterns = [
    { id: "concrete", name: "Concrete", symbol: "▩" },
    { id: "steel", name: "Steel", symbol: "▨" },
    { id: "soil", name: "Soil", symbol: ":::" },
    { id: "sand", name: "Sand", symbol: "..." },
    { id: "gravel", name: "Gravel", symbol: "***" },
    { id: "grass", name: "Grass", symbol: "~~~" },
    { id: "water", name: "Water", symbol: "≈≈≈" },
    { id: "brick", name: "Brick", symbol: "╋" },
  ];

  return (
    <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-700 p-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-100">Properties</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 flex">
        <button
          onClick={() => setActiveTab("geometry")}
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${
            activeTab === "geometry"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Geometry
        </button>
        <button
          onClick={() => setActiveTab("appearance")}
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${
            activeTab === "appearance"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Appearance
        </button>
        <button
          onClick={() => setActiveTab("hatch")}
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${
            activeTab === "hatch"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Hatch
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {selectedObjects.length === 0 ? (
          <div className="text-gray-500 text-sm">No objects selected</div>
        ) : (
          <>
            {/* Geometry Tab */}
            {activeTab === "geometry" && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-300 uppercase">
                  Position
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400">
                      X Coordinate
                    </label>
                    <input
                      type="number"
                      defaultValue="0.00"
                      className="w-full bg-gray-700 text-gray-100 px-2 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">
                      Y Coordinate
                    </label>
                    <input
                      type="number"
                      defaultValue="0.00"
                      className="w-full bg-gray-700 text-gray-100 px-2 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="text-xs font-bold text-gray-300 uppercase">
                  Dimensions
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400">Width</label>
                    <input
                      type="number"
                      defaultValue="100.00"
                      className="w-full bg-gray-700 text-gray-100 px-2 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Height</label>
                    <input
                      type="number"
                      defaultValue="100.00"
                      className="w-full bg-gray-700 text-gray-100 px-2 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Rotation</label>
                    <input
                      type="number"
                      defaultValue="0"
                      min="0"
                      max="360"
                      className="w-full bg-gray-700 text-gray-100 px-2 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-300 uppercase">
                  Line Properties
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400">Color</label>
                    <div className="flex gap-2 mt-1">
                      {[
                        "#FFFFFF",
                        "#FF0000",
                        "#00FF00",
                        "#0000FF",
                        "#FFFF00",
                      ].map((color) => (
                        <div
                          key={color}
                          className="w-8 h-8 rounded border-2 border-gray-600 cursor-pointer hover:border-blue-500"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Line Width</label>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      defaultValue="2"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Line Style</label>
                    <select className="w-full bg-gray-700 text-gray-100 px-2 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500">
                      <option>Solid</option>
                      <option>Dashed</option>
                      <option>Dotted</option>
                      <option>Dash-Dot</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">
                      Transparency
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      defaultValue="0"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Hatch Tab */}
            {activeTab === "hatch" && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-300 uppercase">
                  Hatch Patterns
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {hatchPatterns.map((pattern) => (
                    <button
                      key={pattern.id}
                      className="p-3 bg-gray-700 hover:bg-gray-600 rounded border-2 border-gray-600 hover:border-blue-500 transition-colors text-left"
                    >
                      <div className="text-lg font-bold text-gray-300">
                        {pattern.symbol}
                      </div>
                      <div className="text-xs text-gray-400">
                        {pattern.name}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="text-xs font-bold text-gray-300 uppercase mt-4">
                  Hatch Properties
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400">Hatch Angle</label>
                    <input
                      type="number"
                      defaultValue="0"
                      min="0"
                      max="360"
                      className="w-full bg-gray-700 text-gray-100 px-2 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Scale</label>
                    <input
                      type="number"
                      defaultValue="1.0"
                      step="0.1"
                      className="w-full bg-gray-700 text-gray-100 px-2 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Color</label>
                    <input
                      type="color"
                      defaultValue="#FFFFFF"
                      className="w-full h-8 rounded border border-gray-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;
