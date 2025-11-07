// components/TopToolbar.jsx
import React, { useState } from "react";
import {
  Save,
  Undo2,
  Redo2,
  Grid3X3,
  Maximize2,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Copy,
  Move,
  RotateCw,
  Maximize,
  Circle,
  Square,
  Pen,
  Type,
  Zap,
  Settings,
  Download,
  Upload,
} from "lucide-react";

const TopToolbar = ({
  activeTool,
  setActiveTool,
  undo,
  redo,
  gridVisible,
  setGridVisible,
  orthoMode,
  setOrthoMode,
}) => {
  const [expandedMenu, setExpandedMenu] = useState(null);

  const drawingTools = [
    { id: "line", label: "Line", icon: "|" },
    { id: "polyline", label: "Polyline", icon: "∿" },
    { id: "circle", label: "Circle", icon: "◯", component: Circle },
    { id: "arc", label: "Arc", icon: "⌒" },
    { id: "rectangle", label: "Rectangle", icon: "▭", component: Square },
    { id: "hatch", label: "Hatch", icon: "⚒" },
  ];

  const modifyTools = [
    { id: "move", label: "Move", icon: Move },
    { id: "copy", label: "Copy", icon: Copy },
    { id: "mirror", label: "Mirror", icon: Eye },
    { id: "rotate", label: "Rotate", icon: RotateCw },
    { id: "scale", label: "Scale", icon: Maximize },
    { id: "stretch", label: "Stretch", icon: "↔" },
    { id: "offset", label: "Offset", icon: "+" },
  ];

  const insertTools = [
    { id: "dimension", label: "Dimension", icon: "📏" },
    { id: "text", label: "Text", icon: Type },
    { id: "annotation", label: "Annotation", icon: Type },
    { id: "table", label: "Table", icon: "▦" },
    { id: "breakline", label: "Break Line", icon: "∿" },
    { id: "leader", label: "Leader", icon: "→" },
  ];

  const ToolButton = ({ tool, isActive }) => {
    const Icon = tool.component;
    return (
      <button
        onClick={() => setActiveTool(tool.id)}
        className={`p-2 rounded transition-colors ${
          isActive
            ? "bg-blue-600 text-white"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
        }`}
        title={tool.label}
      >
        {Icon ? (
          <Icon size={18} />
        ) : (
          <span className="text-sm font-bold">{tool.icon}</span>
        )}
      </button>
    );
  };

  const ToolMenu = ({ label, tools, isOpen, onToggle }) => (
    <div className="relative group">
      <button
        onClick={() => onToggle(label)}
        className="px-3 py-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors text-sm font-semibold flex items-center gap-2"
      >
        {label}
        <span className="text-xs">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-1 bg-gray-800 rounded border border-gray-700 shadow-lg z-50 grid grid-cols-3 gap-1 p-2 w-max">
          {tools.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center gap-3 overflow-x-auto">
      {/* File Operations */}
      <div className="flex gap-2 border-r border-gray-700 pr-4">
        <button
          className="p-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
          title="New"
        >
          <Plus size={18} />
        </button>
        <button
          className="p-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
          title="Save"
        >
          <Save size={18} />
        </button>
        <button
          className="p-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
          title="Open"
        >
          <Upload size={18} />
        </button>
        <button
          className="p-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
          title="Export"
        >
          <Download size={18} />
        </button>
      </div>

      {/* Edit Operations */}
      <div className="flex gap-2 border-r border-gray-700 pr-4">
        <button
          onClick={undo}
          className="p-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
          title="Undo"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={redo}
          className="p-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
          title="Redo"
        >
          <Redo2 size={18} />
        </button>
      </div>

      {/* Drawing Tools Menu */}
      <ToolMenu
        label="Draw"
        tools={drawingTools}
        isOpen={expandedMenu === "Draw"}
        onToggle={(name) =>
          setExpandedMenu(expandedMenu === name ? null : name)
        }
      />

      {/* Modify Tools Menu */}
      <ToolMenu
        label="Modify"
        tools={modifyTools}
        isOpen={expandedMenu === "Modify"}
        onToggle={(name) =>
          setExpandedMenu(expandedMenu === name ? null : name)
        }
      />

      {/* Insert Tools Menu */}
      <ToolMenu
        label="Insert"
        tools={insertTools}
        isOpen={expandedMenu === "Insert"}
        onToggle={(name) =>
          setExpandedMenu(expandedMenu === name ? null : name)
        }
      />

      {/* View Options */}
      <div className="flex gap-2 border-r border-gray-700 pr-4 ml-auto">
        <button
          onClick={() => setGridVisible(!gridVisible)}
          className={`p-2 rounded transition-colors ${
            gridVisible
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Toggle Grid"
        >
          <Grid3X3 size={18} />
        </button>
        <button
          onClick={() => setOrthoMode(!orthoMode)}
          className={`p-2 rounded transition-colors ${
            orthoMode
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Ortho Mode (Constrain to 90°)"
        >
          <Zap size={18} />
        </button>
      </div>
    </div>
  );
};

export default TopToolbar;
