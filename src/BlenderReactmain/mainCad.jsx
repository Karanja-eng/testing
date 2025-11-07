import React, { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Menu,
  Save,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Move,
  RotateCw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
} from "lucide-react";
import DrawingCanvas from "./DrawingCanvas";
import TopToolbar from "./TopToolbar";
import BottomToolbar from "./BottomToolbar";
import LeftPanel from "./LeftPanel";
import CopilotSidebar from "./CopilotSidebar";
import PropertiesPanel from "./PropertiesPanel";
import CommandLine from "./CommandLine";

export default function AutoCADClone() {
  const [activeTool, setActiveTool] = useState(null);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [layers, setLayers] = useState([
    {
      id: 1,
      name: "Layer 0",
      color: "#FFFFFF",
      visible: true,
      locked: false,
      objects: [],
    },
  ]);
  const [activeLayer, setActiveLayer] = useState(1);
  const [drawingObjects, setDrawingObjects] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copilotTab, setCopilotTab] = useState("ai"); // ai, properties, history, commands
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [showProperties, setShowProperties] = useState(false);
  const [snapSettings, setSnapSettings] = useState({
    endpoint: true,
    midpoint: true,
    center: true,
    perpendicular: true,
    tangent: true,
    intersection: true,
    extension: true,
    grid: false,
  });
  const [gridVisible, setGridVisible] = useState(true);
  const [orthoMode, setOrthoMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);

  // Add to history
  const addToHistory = (objects) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...objects]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setDrawingObjects([...objects]);
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setDrawingObjects([...history[historyIndex - 1]]);
      setSelectedObjects([]);
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setDrawingObjects([...history[historyIndex + 1]]);
      setSelectedObjects([]);
    }
  };

  // Initialize history
  useEffect(() => {
    addToHistory([]);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* Top Toolbar */}
      <TopToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        undo={undo}
        redo={redo}
        gridVisible={gridVisible}
        setGridVisible={setGridVisible}
        orthoMode={orthoMode}
        setOrthoMode={setOrthoMode}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <LeftPanel
          layers={layers}
          setLayers={setLayers}
          activeLayer={activeLayer}
          setActiveLayer={setActiveLayer}
          drawingObjects={drawingObjects}
          setDrawingObjects={setDrawingObjects}
          selectedObjects={selectedObjects}
          setSelectedObjects={setSelectedObjects}
          addToHistory={addToHistory}
        />

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col">
          <DrawingCanvas
            ref={canvasRef}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            drawingObjects={drawingObjects}
            setDrawingObjects={setDrawingObjects}
            selectedObjects={selectedObjects}
            setSelectedObjects={setSelectedObjects}
            layers={layers}
            activeLayer={activeLayer}
            snapSettings={snapSettings}
            gridVisible={gridVisible}
            orthoMode={orthoMode}
            zoomLevel={zoomLevel}
            panOffset={panOffset}
            addToHistory={addToHistory}
          />

          {/* Command Line */}
          <CommandLine
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            snapSettings={snapSettings}
            setSnapSettings={setSnapSettings}
          />
        </div>

        {/* Properties Panel - Auto hide */}
        {showProperties && (
          <PropertiesPanel
            selectedObjects={selectedObjects}
            layers={layers}
            onClose={() => setShowProperties(false)}
          />
        )}

        {/* Copilot Sidebar */}
        <CopilotSidebar
          copilotOpen={copilotOpen}
          setCopilotOpen={setCopilotOpen}
          copilotTab={copilotTab}
          setCopilotTab={setCopilotTab}
          selectedObjects={selectedObjects}
          history={history}
          historyIndex={historyIndex}
          drawingObjects={drawingObjects}
        />
      </div>

      {/* Bottom Toolbar */}
      <BottomToolbar
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        panOffset={panOffset}
        setPanOffset={setPanOffset}
      />
    </div>
  );
}
