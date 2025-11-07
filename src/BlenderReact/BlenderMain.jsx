import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Ruler,
  Edit3,
  Trash2,
  RotateCw,
  FileText,
  Maximize2,
  Settings,
  Type,
  ArrowRight,
  Upload,
  Droplet,
  Mountain,
  Scissors,
  Copy,
  FileDown,
  Maximize,
  Target,
  AlertCircle,
} from "lucide-react";
import "./BlenderMain.css"; // Assumed CSS file for styling

function BlenderMain() {
  // State and refs from ESLint warnings
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [elements, setElements] = useState([]);
  const [curvePoints, setCurvePoints] = useState([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedElements, setSelectedElements] = useState([]);
  const [hatchPattern, setHatchPattern] = useState(null);
  const [dimensionMode, setDimensionMode] = useState(false);
  const [drawingScale, setDrawingScale] = useState(1);
  const [clashDetection, setClashDetection] = useState(false);
  const [clashes, setClashes] = useState([]);
  const [clipboard, setClipboard] = useState(null);
  const [titleBlockData, setTitleBlockData] = useState({});
  const [activeLayer, setActiveLayer] = useState("default");
  const [selectionBox, setSelectionBox] = useState(null);
  const [scaleFactors, setScaleFactors] = useState({ x: 1, y: 1 });
  const [mode, setMode] = useState("draw"); // For switch statements
  const [websocket, setWebsocket] = useState(null);
  const [renderStatus, setRenderStatus] = useState(null);

  // Blender settings (example)
  const blenderSettings = { lightIntensity: 2 };

  // Generate Blender script (from prior messages)
  const generateBlenderScript = (els) => {
    let script = `
import bpy
from mathutils import Vector

# Clear existing scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Set EEVEE engine
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.filepath = 'C:\\\\Users\\\\HP\\\\AppData\\\\Local\\\\Temp\\\\render.png'
scene.eevee.taa_samples = 16

# Set world background
world = bpy.data.worlds["World"]
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.05, 0.05, 1.0)

# Add lights
bpy.ops.object.light_add(type='SUN', location=(10, 10, 20))
sun = bpy.context.active_object
sun.data.energy = ${blenderSettings.lightIntensity || 2}

# Add key light
bpy.ops.object.light_add(type='AREA', location=(5, -5, 15))
key_light = bpy.context.active_object
key_light.data.energy = 500

# Create materials
def create_material(name, color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat

concrete_mat = create_material("Concrete", (0.5, 0.5, 0.5), 0.0, 0.8)
steel_mat = create_material("Steel", (0.7, 0.7, 0.8), 0.8, 0.2)
soil_mat = create_material("Soil", (0.6, 0.4, 0.2), 0.0, 0.9)

# Objects data
objects_data = ${JSON.stringify(
      els.map((el) => ({
        type: el.type,
        x: el.x || el.x1 || 0,
        y: el.y || el.y1 || 0,
        width: el.width || 0,
        height: el.height || el.radius || 0,
        depth: el.depth || 100,
        color: el.color || "#3b82f6",
        reinforcement: el.reinforcement || "",
      }))
    )}

# Create objects
for i, obj_data in enumerate(objects_data):
    obj_type = obj_data['type']
    x = obj_data['x'] / 1000
    y = obj_data['y'] / 1000
    
    if obj_type in ['beam', 'column', 'slab', 'rectangle']:
        bpy.ops.mesh.primitive_cube_add(
            size=1,
            location=(x, y, obj_data['depth'] / 2000)
        )
        obj = bpy.context.active_object
        obj.scale.x = obj_data['width'] / 1000
        obj.scale.y = obj_data['height'] / 1000
        obj.scale.z = obj_data['depth'] / 2000
        obj.data.materials.append(concrete_mat if not obj_data['reinforcement'] else steel_mat)
    
    elif obj_type == 'circle':
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16,
            radius=obj_data['height'] / 1000,
            depth=obj_data['depth'] / 1000,
            location=(x, y, 0)
        )
        obj = bpy.context.active_object
        obj.data.materials.append(concrete_mat)

# Set camera
bpy.ops.object.camera_add(location=(15, 15, 12))
scene.camera = bpy.context.active_object

# Render
bpy.context.view_layer.update()
bpy.ops.render.render(write_still=True)
`;
    return script;
  };

  // Render via WebSocket
  const renderViaBlender = async () => {
    if (!websocket) {
      setRenderStatus("Connecting to Blender...");
      const ws = new WebSocket("ws://localhost:9999");
      ws.onopen = () => {
        setWebsocket(ws);
        const script = generateBlenderScript(elements);
        ws.send(JSON.stringify({ type: "RENDER_REQUEST", script }));
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.status === "rendered" && data.imageUrl) {
          setRenderStatus(`Rendered: ${data.imageUrl}`);
        } else if (data.error) {
          setRenderStatus(`Error: ${data.error}`);
        }
      };
      ws.onerror = () => setRenderStatus("WebSocket connection failed");
    } else {
      const script = generateBlenderScript(elements);
      websocket.send(JSON.stringify({ type: "RENDER_REQUEST", script }));
    }
  };

  // Render via FastAPI
  const renderViaFastAPI = async () => {
    try {
      setRenderStatus("Rendering via FastAPI...");
      const script = generateBlenderScript(elements);
      const response = await fetch("http://localhost:8000/api/blender/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      const data = await response.json();
      if (data.success) {
        setRenderStatus(`Rendered: ${data.imageUrl}`);
      } else {
        setRenderStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setRenderStatus(`FastAPI error: ${error.message}`);
    }
  };

  // Export script
  const scriptBlob = () => {
    const script = generateBlenderScript(elements);
    const blob = new Blob([script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "blender_render_script.py";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Canvas drawing
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scaleFactors.x, scaleFactors.y);

    elements.forEach((el) => {
      ctx.beginPath();
      if (
        el.type === "rectangle" ||
        el.type === "beam" ||
        el.type === "column" ||
        el.type === "slab"
      ) {
        ctx.rect(el.x, el.y, el.width, el.height);
        ctx.fillStyle = el.color || "#3b82f6";
        if (hatchPattern) {
          ctx.fillStyle = ctx.createPattern(hatchPattern, "repeat");
        }
        ctx.fill();
      } else if (el.type === "circle") {
        ctx.arc(el.x, el.y, el.radius, 0, 2 * Math.PI);
        ctx.fillStyle = el.color || "#3b82f6";
        ctx.fill();
      }
    });

    // Draw curve points
    if (curvePoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
      curvePoints.forEach((pt) => ctx.lineTo(pt.x, pt.y));
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }

    // Draw selection box
    if (selectionBox) {
      ctx.beginPath();
      ctx.rect(
        selectionBox.x,
        selectionBox.y,
        selectionBox.width,
        selectionBox.height
      );
      ctx.strokeStyle = "#00f";
      ctx.stroke();
    }

    // Draw dimension lines (if dimensionMode)
    if (dimensionMode && elements.length > 0) {
      const el = elements[0];
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(el.x + el.width, el.y);
      ctx.strokeStyle = "#f00";
      ctx.stroke();
      ctx.fillText(
        `${el.width / drawingScale}mm`,
        el.x + el.width / 2,
        el.y - 10
      );
    }

    ctx.restore();
  }, [
    elements,
    pan,
    scaleFactors,
    curvePoints,
    hatchPattern,
    selectionBox,
    dimensionMode,
    drawingScale,
  ]);

  // Handle mouse events
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / scaleFactors.x;
    const y = (e.clientY - rect.top - pan.y) / scaleFactors.y;

    switch (mode) {
      case "draw":
        setElements([
          ...elements,
          {
            type: "beam",
            x,
            y,
            width: 100,
            height: 50,
            depth: 3000,
            color: "#3b82f6",
          },
        ]);
        break;
      case "select":
        setSelectionBox({ x, y, width: 0, height: 0 });
        break;
      case "curve":
        setCurvePoints([...curvePoints, { x, y }]);
        break;
      default:
        console.warn("Unknown mode:", mode);
        break;
    }
  };

  const handleMouseMove = (e) => {
    if (selectionBox) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / scaleFactors.x;
      const y = (e.clientY - rect.top - pan.y) / scaleFactors.y;
      setSelectionBox((prev) => ({
        ...prev,
        width: x - prev.x,
        height: y - prev.y,
      }));
      setSelectedElements(
        elements.filter(
          (el) =>
            el.x >= selectionBox.x &&
            el.x + el.width <= selectionBox.x + selectionBox.width &&
            el.y >= selectionBox.y &&
            el.y + el.height <= selectionBox.y + selectionBox.height
        )
      );
    }
  };

  const handleMouseUp = () => {
    if (selectionBox) {
      setSelectionBox(null);
    }
  };

  // Handle panning
  const handleWheel = (e) => {
    e.preventDefault();
    setPan((prev) => ({
      x: prev.x - e.deltaX,
      y: prev.y - e.deltaY,
    }));
  };

  // Clash detection
  const checkClashes = () => {
    setClashDetection(true);
    const newClashes = [];
    elements.forEach((el1, i) =>
      elements.forEach((el2, j) => {
        if (
          i !== j &&
          el1.x < el2.x + el2.width &&
          el1.x + el1.width > el2.x &&
          el1.y < el2.y + el2.height &&
          el1.y + el1.height > el2.y
        ) {
          newClashes.push({ el1, el2 });
        }
      })
    );
    setClashes(newClashes);
  };

  // File import
  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          setElements(importedData.elements || []);
          setTitleBlockData(importedData.titleBlock || {});
        } catch (error) {
          setRenderStatus("Invalid file format");
        }
      };
      reader.readAsText(file);
    }
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    if (selectedElements.length > 0) {
      setClipboard([...selectedElements]);
    }
  };

  // Paste from clipboard
  const pasteFromClipboard = () => {
    if (clipboard) {
      setElements([
        ...elements,
        ...clipboard.map((el) => ({ ...el, x: el.x + 10, y: el.y + 10 })),
      ]);
    }
  };

  // Set hatch pattern
  const createHatchPattern = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(10, 10);
    ctx.stroke();
    setHatchPattern(canvas);
  };

  // Set drawing scale
  const updateDrawingScale = (scale) => {
    setDrawingScale(scale);
    setScaleFactors({ x: scale, y: scale });
  };

  // Set active layer
  const changeLayer = (layer) => {
    setActiveLayer(layer);
    setElements(elements.filter((el) => el.layer === layer || !el.layer));
  };

  // useEffect for canvas rendering
  useEffect(() => {
    drawCanvas();
  }, [
    drawCanvas,
    elements,
    pan,
    scaleFactors,
    curvePoints,
    hatchPattern,
    selectionBox,
    dimensionMode,
  ]);

  // Example switch statements (lines 700, 850, 887)
  const handleModeChange = (newMode) => {
    switch (newMode) {
      case "draw":
        setMode("draw");
        break;
      case "select":
        setMode("select");
        break;
      case "curve":
        setMode("curve");
        break;
      default:
        console.warn("Unknown mode:", newMode);
        break;
    }
  };

  const handleToolAction = (tool) => {
    switch (tool) {
      case "delete":
        setElements(elements.filter((el) => !selectedElements.includes(el)));
        setSelectedElements([]);
        break;
      case "rotate":
        setElements(
          elements.map((el) =>
            selectedElements.includes(el)
              ? { ...el, rotation: (el.rotation || 0) + 90 }
              : el
          )
        );
        break;
      default:
        console.warn("Unknown tool:", tool);
        break;
    }
  };

  const handleExport = (type) => {
    switch (type) {
      case "script":
        scriptBlob();
        break;
      case "image":
        renderViaFastAPI();
        break;
      default:
        console.warn("Unknown export type:", type);
        break;
    }
  };

  return (
    <div className="flex h-screen">
      {/* Toolbar */}
      <div className="w-16 bg-gray-100 p-2 flex flex-col gap-2">
        <button title="Ruler" onClick={() => setDimensionMode(!dimensionMode)}>
          <Ruler size={20} />
        </button>
        <button title="Edit" onClick={() => handleModeChange("edit")}>
          <Edit3 size={20} />
        </button>
        <button title="Delete" onClick={() => handleToolAction("delete")}>
          <Trash2 size={20} />
        </button>
        <button title="Rotate" onClick={() => handleToolAction("rotate")}>
          <RotateCw size={20} />
        </button>
        <button title="Export Script" onClick={() => handleExport("script")}>
          <FileText size={20} />
        </button>
        <button
          title="Zoom"
          onClick={() => updateDrawingScale(drawingScale + 0.1)}
        >
          <Maximize2 size={20} />
        </button>
        <button
          title="Settings"
          onClick={() => setTitleBlockData({ project: "New Project" })}
        >
          <Settings size={20} />
        </button>
        <button
          title="Text"
          onClick={() =>
            setElements([
              ...elements,
              { type: "text", x: 0, y: 0, text: "Label" },
            ])
          }
        >
          <Type size={20} />
        </button>
        <button
          title="Next Layer"
          onClick={() =>
            changeLayer(
              `layer-${
                activeLayer.split("-")[1]
                  ? parseInt(activeLayer.split("-")[1]) + 1
                  : 1
              }`
            )
          }
        >
          <ArrowRight size={20} />
        </button>
        <button title="Import" onClick={() => fileInputRef.current.click()}>
          <Upload size={20} />
        </button>
        <button
          title="Color"
          onClick={() =>
            setElements(
              elements.map((el) =>
                selectedElements.includes(el) ? { ...el, color: "#ff0000" } : el
              )
            )
          }
        >
          <Droplet size={20} />
        </button>
        <button
          title="Terrain"
          onClick={() =>
            setElements([
              ...elements,
              {
                type: "terrain",
                x: 0,
                y: 0,
                width: 1000,
                height: 1000,
                color: "#8B4513",
              },
            ])
          }
        >
          <Mountain size={20} />
        </button>
        <button
          title="Cut"
          onClick={() =>
            setElements(elements.filter((el) => !selectedElements.includes(el)))
          }
        >
          <Scissors size={20} />
        </button>
        <button title="Copy" onClick={copyToClipboard}>
          <Copy size={20} />
        </button>
        <button title="Paste" onClick={pasteFromClipboard}>
          <FileDown size={20} />
        </button>
        <button
          title="Full Screen"
          onClick={() => document.documentElement.requestFullscreen()}
        >
          <Maximize size={20} />
        </button>
        <button title="Target" onClick={() => setPan({ x: 0, y: 0 })}>
          <Target size={20} />
        </button>
        <button title="Check Clashes" onClick={checkClashes}>
          <AlertCircle size={20} />
        </button>
        <button title="Hatch Pattern" onClick={createHatchPattern}>
          <Scissors size={20} />
        </button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileImport}
        accept=".json"
      />
      {/* Canvas */}
      <div className="flex-1">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="border"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 p-4">
        <h2>Controls</h2>
        <button
          className="bg-blue-500 text-white p-2"
          onClick={renderViaBlender}
        >
          Connect to Blender
        </button>
        <button
          className="bg-green-500 text-white p-2 mt-2"
          onClick={() => handleExport("image")}
        >
          Render via FastAPI
        </button>
        <button
          className="bg-gray-500 text-white p-2 mt-2"
          onClick={scriptBlob}
        >
          Export to Blender
        </button>
        <p>Status: {renderStatus || "Idle"}</p>
        <p>Active Layer: {activeLayer}</p>
        <p>Scale: {drawingScale}x</p>
        {clashDetection && clashes.length > 0 && (
          <p>Clashes: {clashes.length}</p>
        )}
        {titleBlockData.project && <p>Project: {titleBlockData.project}</p>}
      </div>
    </div>
  );
}

export default BlenderMain;
