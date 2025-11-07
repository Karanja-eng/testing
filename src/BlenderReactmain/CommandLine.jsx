// components/CommandLine.jsx
import React, { useState, useRef, useEffect } from "react";
import { Terminal } from "lucide-react";

const CommandLine = ({
  activeTool,
  setActiveTool,
  snapSettings,
  setSnapSettings,
}) => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef(null);

  const commands = {
    L: { name: "LINE", description: "Draw a line" },
    C: { name: "CIRCLE", description: "Draw a circle" },
    R: { name: "RECTANGLE", description: "Draw a rectangle" },
    A: { name: "ARC", description: "Draw an arc" },
    PL: { name: "POLYLINE", description: "Draw a polyline" },
    H: { name: "HATCH", description: "Create hatch pattern" },
    M: { name: "MOVE", description: "Move objects" },
    CO: { name: "COPY", description: "Copy objects" },
    MI: { name: "MIRROR", description: "Mirror objects" },
    RO: { name: "ROTATE", description: "Rotate objects" },
    SC: { name: "SCALE", description: "Scale objects" },
    E: { name: "ERASE", description: "Delete objects" },
    U: { name: "UNDO", description: "Undo last action" },
    Z: { name: "ZOOM", description: "Zoom view" },
    PAN: { name: "PAN", description: "Pan view" },
    SNAP: { name: "SNAP", description: "Toggle snap modes" },
    GRID: { name: "GRID", description: "Toggle grid" },
    ORTHO: { name: "ORTHO", description: "Toggle ortho mode" },
  };

  const handleCommand = (e) => {
    if (e.key === "Enter") {
      const cmd = input.toUpperCase().trim();

      // Add to history
      setHistory([...history, cmd]);
      setHistoryIndex(-1);

      // Execute command
      switch (cmd) {
        case "L":
          setActiveTool("line");
          break;
        case "C":
          setActiveTool("circle");
          break;
        case "R":
          setActiveTool("rectangle");
          break;
        case "A":
          setActiveTool("arc");
          break;
        case "PL":
          setActiveTool("polyline");
          break;
        case "H":
          setActiveTool("hatch");
          break;
        case "M":
          setActiveTool("move");
          break;
        case "CO":
          setActiveTool("copy");
          break;
        case "MI":
          setActiveTool("mirror");
          break;
        case "RO":
          setActiveTool("rotate");
          break;
        case "SC":
          setActiveTool("scale");
          break;
        case "E":
          setActiveTool("erase");
          break;
        case "SNAP":
          // Toggle snap settings
          break;
        case "GRID":
          // Toggle grid
          break;
        case "ORTHO":
          // Toggle ortho
          break;
        default:
          // Unknown command
          break;
      }

      setInput("");
      inputRef.current?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  };

  return (
    <div className="bg-gray-900 border-t border-gray-700 p-3 space-y-2">
      {/* Command Input */}
      <div className="flex items-center gap-2">
        <Terminal size={16} className="text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleCommand}
          placeholder="Enter command (L, C, R, A, PL, H, M, CO, MI, RO, SC, E...)..."
          className="flex-1 bg-gray-800 text-gray-100 px-3 py-2 rounded text-sm border border-gray-700 focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Command Help */}
      {input.length > 0 && (
        <div className="bg-gray-800 rounded p-2 text-xs text-gray-300 max-h-20 overflow-y-auto">
          <div className="font-semibold text-gray-200 mb-1">
            Available Commands:
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(commands)
              .filter(([key]) => key.startsWith(input.toUpperCase()))
              .map(([key, { name, description }]) => (
                <div key={key} className="bg-gray-700 p-1 rounded">
                  <div className="font-mono font-bold text-blue-300">{key}</div>
                  <div className="text-gray-400 text-xs">{description}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Info */}
      <div className="text-xs text-gray-500">
        <span>Tip: Use Arrow ↑/↓ for command history, ESC to cancel</span>
      </div>
    </div>
  );
};

export default CommandLine;
