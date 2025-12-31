import React, { useState, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
    Upload,
    Eye,
    Download,
    Settings,
    Loader2,
    AlertCircle,
    CheckCircle2,
    X,
    Box,
    Home,
    Menu,
    Sun,
    Moon,
    EyeOff,
} from "lucide-react";

const API_BASE = "http://localhost:8001";

// ============================================================================
// 3D COMPONENTS
// ============================================================================
const Wall = ({ start, end, height, thickness, floorLevel }) => {
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
            <meshStandardMaterial color="#C8C8C8" roughness={0.8} metalness={0.1} />
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
                <meshStandardMaterial color="#654321" roughness={0.7} />
            </mesh>
            <mesh position={[width * 0.4, height * 0.5, 0.03]}>
                <sphereGeometry args={[0.04, 16, 16]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.2} />
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
                    color="#87CEEB"
                    transparent
                    opacity={0.3}
                    transmission={0.9}
                    roughness={0.1}
                />
            </mesh>
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width * 0.03, height, 0.04]} />
                <meshStandardMaterial color="#FFFFFF" />
            </mesh>
        </group>
    );
};

const FloorSlab = ({ walls, thickness, floorLevel, wallHeight }) => {
    if (!walls || walls.length === 0) return null;

    const points = [];
    walls.forEach((wall) => {
        points.push([wall.start[0], wall.start[1]]);
        points.push([wall.end[0], wall.end[1]]);
    });

    const centerX = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p[1], 0) / points.length;

    const minX = Math.min(...points.map((p) => p[0]));
    const maxX = Math.max(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1]));
    const maxY = Math.max(...points.map((p) => p[1]));

    const width = maxX - minX + 0.5;
    const depth = maxY - minY + 0.5;
    const baseHeight = floorLevel * wallHeight;

    return (
        <mesh
            position={[centerX, baseHeight - thickness / 2, centerY]}
            receiveShadow
        >
            <boxGeometry args={[width, thickness, depth]} />
            <meshStandardMaterial color="#D0D0D0" roughness={0.9} />
        </mesh>
    );
};

const RoofSlab = ({ walls, thickness, totalFloors, wallHeight }) => {
    if (!walls || walls.length === 0) return null;

    const points = [];
    walls.forEach((wall) => {
        points.push([wall.start[0], wall.start[1]]);
        points.push([wall.end[0], wall.end[1]]);
    });

    const centerX = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p[1], 0) / points.length;

    const minX = Math.min(...points.map((p) => p[0]));
    const maxX = Math.max(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1]));
    const maxY = Math.max(...points.map((p) => p[1]));

    const width = maxX - minX + 0.5;
    const depth = maxY - minY + 0.5;
    const roofHeight = totalFloors * wallHeight + thickness / 2;

    return (
        <mesh position={[centerX, roofHeight, centerY]} receiveShadow castShadow>
            <boxGeometry args={[width, thickness, depth]} />
            <meshStandardMaterial color="#8B7355" roughness={0.8} />
        </mesh>
    );
};

const Scene3D = ({ buildingData, showFloor, showRoof, darkMode }) => {
    if (!buildingData || buildingData.floors.length === 0) return null;

    return (
        <>
            <ambientLight intensity={darkMode ? 0.3 : 0.5} />
            <directionalLight
                position={[20, 30, 20]}
                intensity={darkMode ? 0.8 : 1.2}
                castShadow
            />
            <directionalLight
                position={[-20, 25, -15]}
                intensity={darkMode ? 0.4 : 0.6}
            />
            <hemisphereLight
                args={[
                    darkMode ? "#4a5568" : "#ffffff",
                    darkMode ? "#1a202c" : "#444444",
                    darkMode ? 0.4 : 0.6,
                ]}
            />

            {buildingData.floors.map((floor, floorIndex) => (
                <group key={`floor-${floorIndex}`}>
                    {showFloor && (
                        <FloorSlab
                            walls={floor.walls}
                            thickness={0.25}
                            floorLevel={floorIndex}
                            wallHeight={buildingData.wallHeight}
                        />
                    )}

                    {floor.walls.map((wall, i) => (
                        <Wall
                            key={`wall-${floorIndex}-${i}`}
                            start={wall.start}
                            end={wall.end}
                            height={buildingData.wallHeight}
                            thickness={wall.thickness}
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
                </group>
            ))}

            {showRoof && (
                <RoofSlab
                    walls={buildingData.floors[0].walls}
                    thickness={0.25}
                    totalFloors={buildingData.floors.length}
                    wallHeight={buildingData.wallHeight}
                />
            )}

            <gridHelper
                args={[
                    100,
                    100,
                    darkMode ? "#4a5568" : "#888888",
                    darkMode ? "#2d3748" : "#cccccc",
                ]}
            />
        </>
    );
};

// ============================================================================
// MAIN APP
// ============================================================================
export default function FloorPlanVisualizer() {
    const [file, setFile] = useState(null);
    const [fileId, setFileId] = useState(null);
    const [preview, setPreview] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [buildingData, setBuildingData] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [activeTab, setActiveTab] = useState("upload");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    const [settings, setSettings] = useState({
        wallHeight: 3.0,
        wallThickness: 0.15,
        numFloors: 1,
        pixelsPerMeter: 100,
        useYolo: true,
        showFloor: true,
        showRoof: true,
    });

    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        const validExtensions = [".png", ".jpg", ".jpeg", ".dxf", ".dwg"];
        const hasValidExtension = validExtensions.some((ext) =>
            selectedFile.name.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
            setError("Please select PNG, JPG, DXF, or DWG file");
            return;
        }

        setFile(selectedFile);
        setError(null);

        if (selectedFile.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target.result);
            reader.readAsDataURL(selectedFile);
        }
    };

    const uploadFile = async () => {
        if (!file) return;
        setProcessing(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${API_BASE}/upload`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Upload failed");

            const data = await response.json();
            setFileId(data.file_id);
            setSuccess(`✓ Uploaded: ${data.filename}`);
            setActiveTab("process");
        } catch (err) {
            setError(
                err.message || "Upload failed. Check backend at http://localhost:8001"
            );
        } finally {
            setProcessing(false);
        }
    };

    const processFloorPlan = async () => {
        if (!fileId) return;
        setProcessing(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file_id", fileId);
            formData.append("wall_height", settings.wallHeight);
            formData.append("wall_thickness", settings.wallThickness);
            formData.append("num_floors", settings.numFloors);
            formData.append("pixels_per_meter", settings.pixelsPerMeter);
            formData.append("use_yolo", settings.useYolo);

            const isDxf = file && file.name.toLowerCase().endsWith(".dxf");
            const endpoint = isDxf
                ? `${API_BASE}/api/process-dxf`
                : `${API_BASE}/api/process`;

            const response = await fetch(endpoint, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Processing failed");
            }

            const data = await response.json();
            setBuildingData(data);

            const f = data.floors[0];
            setSuccess(
                `✓ Detected: ${f.walls.length} walls, ${f.doors.length} doors, ${f.windows.length} windows, ${f.rooms.length} rooms`
            );
            setActiveTab("view");
        } catch (err) {
            setError(err.message || "Processing failed");
        } finally {
            setProcessing(false);
        }
    };

    const loadSample = () => {
        setBuildingData({
            floors: [
                {
                    level: 0,
                    walls: [
                        { start: [0, 0], end: [10, 0], thickness: 0.3, length: 10 },
                        { start: [10, 0], end: [10, 8], thickness: 0.3, length: 8 },
                        { start: [10, 8], end: [0, 8], thickness: 0.3, length: 10 },
                        { start: [0, 8], end: [0, 0], thickness: 0.3, length: 8 },
                        { start: [5, 0], end: [5, 4], thickness: 0.2, length: 4 },
                        { start: [0, 4], end: [10, 4], thickness: 0.2, length: 10 },
                    ],
                    doors: [
                        {
                            position: [5, 0],
                            width: 0.9,
                            height: 2.1,
                            rotation: 0,
                            type: "door",
                        },
                        {
                            position: [2.5, 4],
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
                            position: [8, 0],
                            width: 1.5,
                            height: 1.2,
                            rotation: 0,
                            type: "window",
                            sillHeight: 0.9,
                        },
                    ],
                    rooms: [
                        { name: "Living Room", center: [5, 2], type: "living", area: 40 },
                        { name: "Bedroom", center: [5, 6], type: "bedroom", area: 40 },
                    ],
                    dimensions: {},
                },
            ],
            wallHeight: 3.0,
            wallThickness: 0.15,
            totalFloors: 1,
            scaleFactor: 1.0,
            detectedScale: false,
        });
        setSuccess("✓ Sample loaded!");
        setActiveTab("view");
    };

    const reset = () => {
        setFile(null);
        setFileId(null);
        setPreview(null);
        setBuildingData(null);
        setError(null);
        setSuccess(null);
        setActiveTab("upload");
    };

    const bg = darkMode ? "bg-gray-900" : "bg-gray-50";
    const card = darkMode ? "bg-gray-800" : "bg-white";
    const text = darkMode ? "text-gray-100" : "text-gray-900";
    const border = darkMode ? "border-gray-700" : "border-gray-200";

    return (
        <div className={`w-full h-screen ${bg} flex flex-col`}>
            <header
                className={`${darkMode
                    ? "bg-gradient-to-r from-blue-900 to-purple-900"
                    : "bg-gradient-to-r from-blue-600 to-purple-600"
                    } border-b ${border} shadow-lg`}
            >
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition text-white"
                        >
                            {sidebarOpen ? (
                                <X className="w-6 h-6" />
                            ) : (
                                <Menu className="w-6 h-6" />
                            )}
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500 rounded-lg">
                                <Box className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">
                                    ArchCAD Pro 3D
                                </h1>
                                <p className="text-sm text-blue-200">Three.js Visualizer</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition text-white"
                        >
                            {darkMode ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>
                        {fileId && (
                            <button
                                onClick={reset}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
                            >
                                <X className="w-4 h-4" /> Reset
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {error && (
                <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-500 p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="flex-1 text-sm text-red-800 dark:text-red-200">
                        {error}
                    </span>
                    <button onClick={() => setError(null)}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 dark:bg-green-900 border-l-4 border-green-500 p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="flex-1 text-sm text-green-800 dark:text-green-200">
                        {success}
                    </span>
                    <button onClick={() => setSuccess(null)}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                <aside
                    className={`${sidebarOpen ? "w-80" : "w-0"
                        } ${card} border-r ${border} overflow-y-auto transition-all`}
                >
                    {sidebarOpen && (
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { key: "upload", icon: Upload, label: "Upload" },
                                    {
                                        key: "process",
                                        icon: Settings,
                                        label: "Process",
                                        disabled: !fileId,
                                    },
                                    {
                                        key: "view",
                                        icon: Eye,
                                        label: "View",
                                        disabled: !buildingData,
                                    },
                                ].map((t) => (
                                    <button
                                        key={t.key}
                                        onClick={() => !t.disabled && setActiveTab(t.key)}
                                        disabled={t.disabled}
                                        className={`p-3 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === t.key
                                            ? "bg-blue-600 text-white"
                                            : t.disabled
                                                ? "bg-gray-200 opacity-50 cursor-not-allowed"
                                                : "bg-gray-200 hover:bg-gray-300"
                                            }`}
                                    >
                                        <t.icon className="w-5 h-5" />
                                        <span className="text-xs font-medium">{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            {activeTab === "upload" && (
                                <div className="space-y-4">
                                    <h3 className={`text-lg font-semibold ${text}`}>
                                        Upload Floor Plan
                                    </h3>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed ${border} hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition`}
                                    >
                                        {preview ? (
                                            <img
                                                src={preview}
                                                alt="Preview"
                                                className="max-w-full h-48 object-contain mx-auto"
                                            />
                                        ) : (
                                            <div>
                                                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                                <p className={text}>Click to upload</p>
                                                <p className="text-sm text-gray-400 mt-2">
                                                    PNG, JPG, DXF, DWG
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".png,.jpg,.jpeg,.dxf,.dwg"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    {file && !fileId && (
                                        <button
                                            onClick={uploadFile}
                                            disabled={processing}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                                        >
                                            {processing ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />{" "}
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-5 h-5" /> Upload
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={loadSample}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                                    >
                                        <Home className="w-5 h-5" /> Load Sample
                                    </button>
                                </div>
                            )}

                            {activeTab === "process" && (
                                <div className="space-y-4">
                                    <h3 className={`text-lg font-semibold ${text}`}>
                                        Configuration
                                    </h3>
                                    {[
                                        { key: "wallHeight", label: "Wall Height (m)", step: 0.1 },
                                        {
                                            key: "wallThickness",
                                            label: "Wall Thickness (m)",
                                            step: 0.01,
                                        },
                                        { key: "numFloors", label: "Number of Floors", step: 1 },
                                        {
                                            key: "pixelsPerMeter",
                                            label: "Pixels Per Meter",
                                            step: 10,
                                        },
                                    ].map(({ key, label, step }) => (
                                        <div key={key}>
                                            <label
                                                className={`block text-sm font-medium ${text} mb-2`}
                                            >
                                                {label}
                                            </label>
                                            <input
                                                type="number"
                                                step={step}
                                                value={settings[key]}
                                                onChange={(e) =>
                                                    setSettings({
                                                        ...settings,
                                                        [key]:
                                                            parseFloat(e.target.value) ||
                                                            parseInt(e.target.value),
                                                    })
                                                }
                                                className={`w-full px-4 py-2 ${darkMode ? "bg-gray-700" : "bg-white"
                                                    } border ${border} rounded-lg`}
                                            />
                                        </div>
                                    ))}
                                    <button
                                        onClick={processFloorPlan}
                                        disabled={processing}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                                    >
                                        {processing ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />{" "}
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Settings className="w-5 h-5" /> Process
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {activeTab === "view" && buildingData && (
                                <div className="space-y-4">
                                    <h3 className={`text-lg font-semibold ${text}`}>
                                        Building Stats
                                    </h3>
                                    <div
                                        className={`${darkMode ? "bg-gray-700" : "bg-gray-100"
                                            } rounded-lg p-4`}
                                    >
                                        <div className="space-y-2 text-sm">
                                            {[
                                                ["Walls", buildingData.floors[0].walls.length],
                                                ["Doors", buildingData.floors[0].doors.length],
                                                ["Windows", buildingData.floors[0].windows.length],
                                                ["Rooms", buildingData.floors[0].rooms.length],
                                            ].map(([label, value]) => (
                                                <div key={label} className="flex justify-between">
                                                    <span className="text-gray-400">{label}</span>
                                                    <span className="font-semibold">{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            { key: "showFloor", label: "Show Floor" },
                                            { key: "showRoof", label: "Show Roof" },
                                        ].map(({ key, label }) => (
                                            <label
                                                key={key}
                                                className="flex items-center justify-between"
                                            >
                                                <span className="text-sm">{label}</span>
                                                <button
                                                    onClick={() =>
                                                        setSettings({ ...settings, [key]: !settings[key] })
                                                    }
                                                    className={`p-2 rounded-lg transition ${settings[key]
                                                        ? "bg-blue-600 text-white"
                                                        : darkMode
                                                            ? "bg-gray-700"
                                                            : "bg-gray-300"
                                                        }`}
                                                >
                                                    {settings[key] ? (
                                                        <Eye className="w-4 h-4" />
                                                    ) : (
                                                        <EyeOff className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                <main className={`flex-1 ${darkMode ? "bg-gray-950" : "bg-white"}`}>
                    {buildingData ? (
                        <Canvas shadows camera={{ position: [15, 15, 15], fov: 50 }}>
                            <Suspense fallback={null}>
                                <Scene3D
                                    buildingData={buildingData}
                                    showFloor={settings.showFloor}
                                    showRoof={settings.showRoof}
                                    darkMode={darkMode}
                                />
                                <OrbitControls
                                    enableDamping
                                    dampingFactor={0.05}
                                    minDistance={5}
                                    maxDistance={100}
                                />
                            </Suspense>
                        </Canvas>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <Home className="w-24 h-24 mx-auto mb-4 text-gray-400" />
                                <h2 className="text-3xl font-bold text-gray-600 mb-3">
                                    No Model Loaded
                                </h2>
                                <p className="text-gray-500 mb-6">
                                    Upload a floor plan to start
                                </p>
                                <button
                                    onClick={() => setActiveTab("upload")}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                                >
                                    Upload Floor Plan
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
