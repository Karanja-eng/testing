import React, { useState, useRef, useEffect, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  Upload,
  Home,
  Layers,
  Settings,
  Download,
  Eye,
  Palette,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileImage,
  FileCode,
} from "lucide-react";

// Backend API Configuration
const API_BASE_URL = "http://localhost:8001/api";

// Wall Material Component
const WallMaterial = ({ color, texture }) => {
  if (texture === "solid") {
    return (
      <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
    );
  }

  // Texture patterns simulation
  const getPattern = () => {
    switch (texture) {
      case "brick":
        return { roughness: 0.9, metalness: 0.05 };
      case "stone":
        return { roughness: 0.95, metalness: 0.02 };
      case "concrete":
        return { roughness: 0.85, metalness: 0.1 };
      default:
        return { roughness: 0.8, metalness: 0.1 };
    }
  };

  const props = getPattern();
  return <meshStandardMaterial color={color} {...props} />;
};

// 3D Components
const Wall = ({
  start,
  end,
  height,
  thickness,
  color,
  texture,
  floorLevel,
}) => {
  const length = Math.sqrt(
    Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2)
  );
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const midX = (start[0] + end[0]) / 2;
  const midY = (start[1] + end[1]) / 2;
  const baseHeight = floorLevel * height;

  return (
    <mesh
      position={[midX, baseHeight + height / 2, midY]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, height, thickness]} />
      <WallMaterial color={color} texture={texture} />
    </mesh>
  );
};

const Door = ({
  position,
  width,
  height,
  rotation,
  floorLevel,
  wallHeight,
}) => {
  const baseHeight = floorLevel * wallHeight;

  return (
    <group
      position={[position[0], baseHeight, position[1]]}
      rotation={[0, rotation, 0]}
    >
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[width, height, 0.05]} />
        <meshStandardMaterial color="#654321" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[width * 0.4, height * 0.5, 0.03]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[width + 0.1, 0.05, 0.05]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </group>
  );
};

const Window = ({
  position,
  width,
  height,
  rotation,
  floorLevel,
  wallHeight,
  sillHeight,
}) => {
  const baseHeight = floorLevel * wallHeight;

  return (
    <group
      position={[position[0], baseHeight + sillHeight, position[1]]}
      rotation={[0, rotation, 0]}
    >
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, 0.03]} />
        <meshPhysicalMaterial
          color="#E0F4FF"
          transparent
          opacity={0.4}
          transmission={0.9}
          thickness={0.5}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width * 0.03, height, 0.04]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height * 0.03, 0.04]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, -sillHeight * 0.5, 0]}>
        <boxGeometry args={[width + 0.05, 0.05, 0.15]} />
        <meshStandardMaterial color="#D3D3D3" />
      </mesh>
    </group>
  );
};

const FloorSlab = ({ bounds, thickness, floorLevel, wallHeight }) => {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxY - bounds.minY;
  const centerX = (bounds.maxX + bounds.minX) / 2;
  const centerY = (bounds.maxY + bounds.minY) / 2;
  const baseHeight = floorLevel * wallHeight;

  return (
    <mesh
      position={[centerX, baseHeight - thickness / 2, centerY]}
      receiveShadow
    >
      <boxGeometry args={[width, thickness, depth]} />
      <meshStandardMaterial color="#E8E8E8" roughness={0.9} metalness={0.1} />
    </mesh>
  );
};

const RoofSlab = ({ bounds, thickness, totalFloors, wallHeight }) => {
  const width = bounds.maxX - bounds.minX + 0.5;
  const depth = bounds.maxY - bounds.minY + 0.5;
  const centerX = (bounds.maxX + bounds.minX) / 2;
  const centerY = (bounds.maxY + bounds.minY) / 2;
  const roofHeight = totalFloors * wallHeight + thickness / 2;

  return (
    <mesh position={[centerX, roofHeight, centerY]} receiveShadow castShadow>
      <boxGeometry args={[width, thickness, depth]} />
      <meshStandardMaterial color="#8B7355" roughness={0.8} metalness={0.05} />
    </mesh>
  );
};

const RoomLabel = ({ position, name, floorLevel, wallHeight }) => {
  const baseHeight = floorLevel * wallHeight + 0.05;

  return (
    <group position={[position[0], baseHeight, position[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[name.length * 0.15, 0.3]} />
        <meshBasicMaterial color="#333333" opacity={0.7} transparent />
      </mesh>
    </group>
  );
};

// 3D Scene
const Scene3D = ({ buildingData, wallColor, wallTexture }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (buildingData && buildingData.floors.length > 0) {
      const bounds = calculateBounds(buildingData);
      const center = new THREE.Vector3(
        (bounds.maxX + bounds.minX) / 2,
        (buildingData.wallHeight * buildingData.floors.length) / 2,
        (bounds.maxY + bounds.minY) / 2
      );
      const size = Math.max(
        bounds.maxX - bounds.minX,
        bounds.maxY - bounds.minY
      );
      camera.position.set(
        center.x + size * 1.5,
        center.y + size * 1.2,
        center.z + size * 1.5
      );
      camera.lookAt(center);
    }
  }, [buildingData, camera]);

  if (!buildingData || buildingData.floors.length === 0) {
    return null;
  }

  const bounds = calculateBounds(buildingData);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, 30, 20]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-20, 25, -15]} intensity={0.6} />
      <hemisphereLight args={["#ffffff", "#444444", 0.6]} />
      <pointLight position={[0, 15, 0]} intensity={0.4} />

      <fog attach="fog" args={["#1a1a2e", 50, 150]} />

      {buildingData.floors.map((floor, floorIndex) => (
        <group key={`floor-${floorIndex}`}>
          <FloorSlab
            bounds={bounds}
            thickness={0.25}
            floorLevel={floorIndex}
            wallHeight={buildingData.wallHeight}
          />

          {floor.walls.map((wall, i) => (
            <Wall
              key={`wall-${floorIndex}-${i}`}
              start={wall.start}
              end={wall.end}
              height={buildingData.wallHeight}
              thickness={wall.thickness}
              color={wallColor}
              texture={wallTexture}
              floorLevel={floorIndex}
            />
          ))}

          {floor.doors.map((door, i) => (
            <Door
              key={`door-${floorIndex}-${i}`}
              position={door.position}
              width={door.width}
              height={door.height}
              rotation={door.rotation}
              floorLevel={floorIndex}
              wallHeight={buildingData.wallHeight}
            />
          ))}

          {floor.windows.map((window, i) => (
            <Window
              key={`window-${floorIndex}-${i}`}
              position={window.position}
              width={window.width}
              height={window.height}
              rotation={window.rotation}
              floorLevel={floorIndex}
              wallHeight={buildingData.wallHeight}
              sillHeight={window.sillHeight}
            />
          ))}

          {floor.rooms &&
            floor.rooms.map((room, i) => (
              <RoomLabel
                key={`room-${floorIndex}-${i}`}
                position={room.center}
                name={room.name}
                floorLevel={floorIndex}
                wallHeight={buildingData.wallHeight}
              />
            ))}
        </group>
      ))}

      <RoofSlab
        bounds={bounds}
        thickness={0.25}
        totalFloors={buildingData.floors.length}
        wallHeight={buildingData.wallHeight}
      />

      <gridHelper args={[100, 100, "#444444", "#222222"]} />
    </>
  );
};

const calculateBounds = (buildingData) => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  buildingData.floors.forEach((floor) => {
    floor.walls.forEach((wall) => {
      minX = Math.min(minX, wall.start[0], wall.end[0]);
      maxX = Math.max(maxX, wall.start[0], wall.end[0]);
      minY = Math.min(minY, wall.start[1], wall.end[1]);
      maxY = Math.max(maxY, wall.start[1], wall.end[1]);
    });
  });

  return { minX, maxX, minY, maxY };
};

// Main App
export default function ArchitecturalCAD() {
  const [buildingData, setBuildingData] = useState(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [wallColor, setWallColor] = useState("#F5F5DC");
  const [wallTexture, setWallTexture] = useState("solid");
  const [numFloors, setNumFloors] = useState(1);
  const [wallHeight, setWallHeight] = useState(3.0);
  const [wallThickness, setWallThickness] = useState(0.3);
  const [referenceDimension, setReferenceDimension] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileType, setFileType] = useState("image");
  const fileInputRef = useRef(null);

  const processFile = async (file) => {
    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("wall_height", wallHeight.toString());
      formData.append("wall_thickness", wallThickness.toString());
      formData.append("num_floors", numFloors.toString());

      if (referenceDimension) {
        formData.append("reference_dimension", referenceDimension);
      }

      const endpoint = file.name.toLowerCase().endsWith(".dwg")
        ? `${API_BASE_URL}/process-dxf`
        : `${API_BASE_URL}/process-image`;

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process file");
      }

      const data = await response.json();
      setBuildingData(data);
      setSuccess("Floor plan processed successfully!");
      setActiveTab("3d-view");
    } catch (err) {
      setError(
        err.message ||
          "Error processing file. Make sure the backend is running on http://localhost:8000"
      );
      console.error("Processing error:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const loadSamplePlan = () => {
    const sampleData = {
      floors: [
        {
          level: 0,
          walls: [
            { start: [0, 0], end: [12, 0], thickness: 0.3, length: 12 },
            { start: [12, 0], end: [12, 10], thickness: 0.3, length: 10 },
            { start: [12, 10], end: [0, 10], thickness: 0.3, length: 12 },
            { start: [0, 10], end: [0, 0], thickness: 0.3, length: 10 },
            { start: [6, 0], end: [6, 5], thickness: 0.2, length: 5 },
            { start: [0, 5], end: [12, 5], thickness: 0.2, length: 12 },
            { start: [6, 5], end: [6, 10], thickness: 0.2, length: 5 },
          ],
          doors: [
            {
              position: [6, 0],
              width: 0.9,
              height: 2.1,
              rotation: 0,
              type: "door",
            },
            {
              position: [3, 5],
              width: 0.9,
              height: 2.1,
              rotation: Math.PI / 2,
              type: "door",
            },
            {
              position: [9, 5],
              width: 0.9,
              height: 2.1,
              rotation: Math.PI / 2,
              type: "door",
            },
          ],
          windows: [
            {
              position: [2, 0],
              width: 1.5,
              height: 1.2,
              rotation: 0,
              type: "window",
              sillHeight: 0.9,
            },
            {
              position: [10, 0],
              width: 1.5,
              height: 1.2,
              rotation: 0,
              type: "window",
              sillHeight: 0.9,
            },
            {
              position: [12, 2.5],
              width: 1.2,
              height: 1.2,
              rotation: Math.PI / 2,
              type: "window",
              sillHeight: 0.9,
            },
            {
              position: [12, 7.5],
              width: 1.2,
              height: 1.2,
              rotation: Math.PI / 2,
              type: "window",
              sillHeight: 0.9,
            },
            {
              position: [0, 2.5],
              width: 1.2,
              height: 1.2,
              rotation: -Math.PI / 2,
              type: "window",
              sillHeight: 0.9,
            },
            {
              position: [0, 7.5],
              width: 1.2,
              height: 1.2,
              rotation: -Math.PI / 2,
              type: "window",
              sillHeight: 0.9,
            },
          ],
          rooms: [
            { name: "Living Room", center: [3, 2.5], type: "living", area: 30 },
            { name: "Bedroom 1", center: [9, 2.5], type: "bedroom", area: 15 },
            { name: "Kitchen", center: [3, 7.5], type: "kitchen", area: 15 },
            { name: "Bedroom 2", center: [9, 7.5], type: "bedroom", area: 15 },
          ],
          dimensions: {},
        },
      ],
      wallHeight: wallHeight,
      wallThickness: wallThickness,
      totalFloors: numFloors,
      scaleFactor: 1.0,
      detectedScale: false,
    };

    setBuildingData(sampleData);
    setSuccess("Sample floor plan loaded!");
    setActiveTab("3d-view");
  };

  const exportModel = () => {
    if (!buildingData) return;

    const dataStr = JSON.stringify(buildingData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "building-model.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-purple-900 border-b border-blue-700 px-6 py-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-500 p-2 rounded-lg shadow-lg">
              <Home className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
                ArchCAD Pro 3D
              </h1>
              <p className="text-sm text-blue-200">
                AI-Powered Architectural Rendering System
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right mr-4">
              <div className="text-xs text-blue-300">Backend Status</div>
              <div className="text-sm font-semibold">
                {processing ? (
                  <span className="text-yellow-400">Processing...</span>
                ) : (
                  <span className="text-green-400">Ready</span>
                )}
              </div>
            </div>
            <button
              onClick={exportModel}
              disabled={!buildingData}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 rounded-lg flex items-center space-x-2 shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-6 py-3 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-auto text-red-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
      {success && (
        <div className="bg-green-900 border border-green-700 text-green-100 px-6 py-3 flex items-center space-x-3">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
          <button
            onClick={() => setSuccess("")}
            className="ml-auto text-green-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-gray-800 border-r border-gray-700 overflow-y-auto shadow-2xl">
          <div className="p-4 space-y-4">
            {/* Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setActiveTab("upload")}
                className={`p-3 rounded-lg flex flex-col items-center space-y-1 transition-all ${
                  activeTab === "upload"
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs font-medium">Upload</span>
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`p-3 rounded-lg flex flex-col items-center space-y-1 transition-all ${
                  activeTab === "settings"
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="text-xs font-medium">Settings</span>
              </button>
              <button
                onClick={() => setActiveTab("3d-view")}
                disabled={!buildingData}
                className={`p-3 rounded-lg flex flex-col items-center space-y-1 transition-all ${
                  activeTab === "3d-view"
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg"
                    : buildingData
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-gray-800 opacity-50 cursor-not-allowed"
                }`}
              >
                <Eye className="w-5 h-5" />
                <span className="text-xs font-medium">3D View</span>
              </button>
            </div>

            {/* Upload Tab */}
            {activeTab === "upload" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center space-x-2 text-blue-300">
                  <Upload className="w-5 h-5" />
                  <span>Upload Floor Plan</span>
                </h3>

                <div className="bg-gray-700 rounded-lg p-4">
                  <label className="block text-sm font-medium mb-2">
                    File Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFileType("image")}
                      className={`p-3 rounded-lg flex flex-col items-center space-y-2 ${
                        fileType === "image"
                          ? "bg-blue-600"
                          : "bg-gray-600 hover:bg-gray-500"
                      }`}
                    >
                      <FileImage className="w-6 h-6" />
                      <span className="text-xs">Image</span>
                    </button>
                    <button
                      onClick={() => setFileType("dxf")}
                      className={`p-3 rounded-lg flex flex-col items-center space-y-2 ${
                        fileType === "dxf"
                          ? "bg-blue-600"
                          : "bg-gray-600 hover:bg-gray-500"
                      }`}
                    >
                      <FileCode className="w-6 h-6" />
                      <span className="text-xs">DXF/DWG</span>
                    </button>
                  </div>
                </div>

                <div className="border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl p-8 text-center bg-gray-750 transition-all">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={
                      fileType === "image" ? ".png,.jpg,.jpeg" : ".dxf,.dwg"
                    }
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={processing}
                  />
                  {processing ? (
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
                  ) : (
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processing}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 rounded-lg mb-2 shadow-lg transition-all"
                  >
                    {processing ? "Processing..." : "Choose File"}
                  </button>
                  <p className="text-sm text-gray-400">
                    {fileType === "image" ? "PNG, JPG, JPEG" : "DXF, DWG"}
                  </p>
                </div>

                <button
                  onClick={loadSamplePlan}
                  disabled={processing}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg flex items-center justify-center space-x-2 shadow-lg transition-all"
                >
                  <Home className="w-5 h-5" />
                  <span>Load Sample Plan</span>
                </button>

                <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-4 shadow-lg">
                  <h4 className="font-semibold mb-3 text-blue-300">
                    Building Parameters
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm mb-1 text-gray-300">
                        Floors
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={numFloors}
                        onChange={(e) => setNumFloors(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-gray-300">
                        Wall Height (m)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="2.4"
                        max="5.0"
                        value={wallHeight}
                        onChange={(e) =>
                          setWallHeight(parseFloat(e.target.value))
                        }
                        className="w-full px-3 py-2 bg-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-gray-300">
                        Wall Thickness (m)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="0.6"
                        value={wallThickness}
                        onChange={(e) =>
                          setWallThickness(parseFloat(e.target.value))
                        }
                        className="w-full px-3 py-2 bg-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-gray-300">
                        Reference Dimension (m)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Optional"
                        value={referenceDimension}
                        onChange={(e) => setReferenceDimension(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        For scale calibration
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center space-x-2 text-purple-300">
                  <Palette className="w-5 h-5" />
                  <span>Appearance</span>
                </h3>

                <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-4 shadow-lg">
                  <h4 className="font-semibold mb-3 text-blue-300">
                    Wall Style
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm mb-2 text-gray-300">
                        Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={wallColor}
                          onChange={(e) => setWallColor(e.target.value)}
                          className="w-16 h-16 rounded-lg cursor-pointer border-2 border-gray-600"
                        />
                        <input
                          type="text"
                          value={wallColor}
                          onChange={(e) => setWallColor(e.target.value)}
                          className="flex-1 px-3 py-2 bg-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-gray-300">
                        Texture
                      </label>
                      <select
                        value={wallTexture}
                        onChange={(e) => setWallTexture(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="solid">Solid Color</option>
                        <option value="brick">Brick Pattern</option>
                        <option value="stone">Stone Pattern</option>
                        <option value="concrete">Concrete</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {[
                        { color: "#F5F5DC", name: "Beige" },
                        { color: "#FFFFFF", name: "White" },
                        { color: "#D3D3D3", name: "Gray" },
                        { color: "#8B7355", name: "Brown" },
                        { color: "#CD853F", name: "Tan" },
                        { color: "#696969", name: "Dark" },
                        { color: "#BC8F8F", name: "Rose" },
                        { color: "#A0522D", name: "Sienna" },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          onClick={() => setWallColor(preset.color)}
                          className="h-12 rounded-lg border-2 border-gray-600 hover:border-blue-500 transition-all"
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-4 shadow-lg">
                  <h4 className="font-semibold mb-3 text-blue-300">
                    Building Configuration
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Wall Height</span>
                      <span className="font-mono text-blue-300">
                        {wallHeight}m
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">
                        Wall Thickness
                      </span>
                      <span className="font-mono text-blue-300">
                        {wallThickness}m
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">
                        Number of Floors
                      </span>
                      <span className="font-mono text-blue-300">
                        {numFloors}
                      </span>
                    </div>
                  </div>
                </div>

                {buildingData && (
                  <button
                    onClick={() => {
                      const updated = {
                        ...buildingData,
                        wallHeight,
                        wallThickness,
                      };
                      setBuildingData(updated);
                      setSuccess("Settings applied successfully!");
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg shadow-lg transition-all"
                  >
                    Apply Changes to Model
                  </button>
                )}
              </div>
            )}

            {/* 3D View Tab */}
            {activeTab === "3d-view" && buildingData && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center space-x-2 text-green-300">
                  <Layers className="w-5 h-5" />
                  <span>Building Data</span>
                </h3>

                <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-4 shadow-lg">
                  <h4 className="font-semibold mb-3 text-blue-300">
                    Statistics
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">
                        Total Floors
                      </span>
                      <span className="font-semibold text-blue-300">
                        {buildingData.floors.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">
                        Floor Height
                      </span>
                      <span className="font-semibold text-blue-300">
                        {buildingData.wallHeight}m
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">
                        Total Height
                      </span>
                      <span className="font-semibold text-blue-300">
                        {(
                          buildingData.wallHeight * buildingData.floors.length +
                          0.25
                        ).toFixed(2)}
                        m
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Total Walls</span>
                      <span className="font-semibold text-blue-300">
                        {buildingData.floors.reduce(
                          (sum, f) => sum + f.walls.length,
                          0
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Doors</span>
                      <span className="font-semibold text-blue-300">
                        {buildingData.floors.reduce(
                          (sum, f) => sum + f.doors.length,
                          0
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Windows</span>
                      <span className="font-semibold text-blue-300">
                        {buildingData.floors.reduce(
                          (sum, f) => sum + f.windows.length,
                          0
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">
                        Scale Detected
                      </span>
                      <span
                        className={`font-semibold ${
                          buildingData.detectedScale
                            ? "text-green-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {buildingData.detectedScale ? "Yes" : "Manual"}
                      </span>
                    </div>
                  </div>
                </div>

                {buildingData.floors[0].rooms.length > 0 && (
                  <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-4 shadow-lg">
                    <h4 className="font-semibold mb-3 text-blue-300">
                      Rooms (Floor 1)
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {buildingData.floors[0].rooms.map((room, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center py-2 border-b border-gray-600 last:border-0"
                        >
                          <span className="text-sm text-gray-300">
                            {room.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {room.area}m²
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-br from-blue-900 to-purple-900 rounded-lg p-4 shadow-lg">
                  <h4 className="font-semibold mb-2 text-blue-200">
                    3D Controls
                  </h4>
                  <ul className="text-sm space-y-1 text-blue-200">
                    <li className="flex items-center space-x-2">
                      <span className="w-24 text-gray-300">Rotate:</span>
                      <span>Left Click + Drag</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-24 text-gray-300">Pan:</span>
                      <span>Right Click + Drag</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-24 text-gray-300">Zoom:</span>
                      <span>Mouse Wheel</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main 3D Viewport */}
        <main className="flex-1 bg-gradient-to-br from-gray-950 via-gray-900 to-black relative">
          {buildingData ? (
            <Canvas
              shadows
              camera={{ position: [15, 15, 15], fov: 50 }}
              gl={{ antialias: true, alpha: false }}
            >
              <Suspense fallback={null}>
                <Scene3D
                  buildingData={buildingData}
                  wallColor={wallColor}
                  wallTexture={wallTexture}
                />
                <OrbitControls
                  enableDamping
                  dampingFactor={0.05}
                  minDistance={5}
                  maxDistance={150}
                  maxPolarAngle={Math.PI / 2}
                />
              </Suspense>
            </Canvas>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="bg-gray-800 rounded-full p-8 inline-block mb-6 shadow-2xl">
                  <Home className="w-24 h-24 text-gray-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-500 mb-3">
                  No Building Model Loaded
                </h2>
                <p className="text-gray-600 mb-6">
                  Upload a floor plan image or DXF file to start
                </p>
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg shadow-lg transition-all"
                  >
                    Upload Floor Plan
                  </button>
                  <button
                    onClick={loadSamplePlan}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg shadow-lg transition-all"
                  >
                    Load Sample
                  </button>
                </div>
                <div className="mt-8 bg-gray-800 rounded-lg p-6 max-w-md mx-auto text-left">
                  <h3 className="font-semibold text-blue-300 mb-3">
                    Backend Setup Required
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">
                    To process real floor plans, start the backend:
                  </p>
                  <code className="block bg-gray-900 text-green-400 p-3 rounded text-xs">
                    cd backend
                    <br />
                    pip install -r requirements.txt
                    <br />
                    python main.py
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Watermark */}
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 px-4 py-2 rounded-lg backdrop-blur-sm">
            <p className="text-xs text-gray-400">ArchCAD Pro 3D v1.0</p>
          </div>
        </main>
      </div>
    </div>
  );
}
