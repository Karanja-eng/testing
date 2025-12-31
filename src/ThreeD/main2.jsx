import React, { useState, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";
import {
    Upload, Settings, Loader2,
    X, Box, Sun, Moon, Layers, MousePointer2,
    Maximize2, Trash2, Cpu, Ruler, Activity
} from "lucide-react";

const API_BASE = "http://localhost:8001";

// ============================================================================
// 3D COMPONENTS (REACTIVE)
// ============================================================================

const Wall = ({ wall, height, floorLevel, isSelected, onSelect }) => {
    const { start, end, thickness, segments } = wall;
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const baseHeight = floorLevel * height;
    const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;

    const wallColor = isSelected ? "#3b82f6" : "#e2e8f0";

    if (segments && segments.length > 0) {
        return (
            <group onClick={(e) => { e.stopPropagation(); onSelect(wall); }}>
                {segments.map((seg, idx) => {
                    const s = seg.start;
                    const e = seg.end;
                    const segLen = Math.sqrt(Math.pow(e[0] - s[0], 2) + Math.pow(e[1] - s[1], 2));
                    const mX = (s[0] + e[0]) / 2;
                    const mY = (s[1] + e[1]) / 2;
                    return (
                        <mesh key={idx} position={[mX, baseHeight + seg.offsetZ + seg.height / 2, mY]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                            <boxGeometry args={[segLen, seg.height, thickness]} />
                            <meshStandardMaterial color={wallColor} roughness={0.6} metalness={0.1} />
                        </mesh>
                    );
                })}
            </group>
        );
    }

    return (
        <mesh position={[midX, baseHeight + height / 2, midY]} rotation={[0, -angle, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(wall); }}>
            <boxGeometry args={[length, height, thickness]} />
            <meshStandardMaterial color={wallColor} roughness={0.6} metalness={0.1} />
        </mesh>
    );
};

const Window = ({ window, floorLevel, wallHeight, isSelected, onSelect }) => {
    const { position, width, height, rotation, sillHeight } = window;
    const baseHeight = floorLevel * wallHeight;
    const frameColor = isSelected ? "#3b82f6" : "#1e293b"; // Bold dark frames

    return (
        <group position={[position[0], baseHeight + sillHeight, position[1]]} rotation={[0, rotation, 0]} onClick={(e) => { e.stopPropagation(); onSelect(window); }}>
            {/* Glass */}
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width - 0.1, height - 0.1, 0.02]} />
                <meshPhysicalMaterial color="#93c5fd" transparent opacity={0.4} transmission={0.9} roughness={0} />
            </mesh>
            {/* Frame - Outer */}
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width, height, 0.1]} />
                <meshStandardMaterial color={frameColor} wireframe={false} roughness={0.5} />
            </mesh>
            {/* Sill */}
            <mesh position={[0, 0, 0.08]} scale={[1.1, 1, 1]}>
                <boxGeometry args={[width, 0.05, 0.2]} />
                <meshStandardMaterial color={frameColor} />
            </mesh>
        </group>
    );
};

const Door = ({ door, floorLevel, wallHeight, isSelected, onSelect }) => {
    const { position, width, height, rotation } = door;
    const baseHeight = floorLevel * wallHeight;
    const frameColor = isSelected ? "#3b82f6" : "#475569";

    return (
        <group position={[position[0], baseHeight, position[1]]} rotation={[0, rotation, 0]} onClick={(e) => { e.stopPropagation(); onSelect(door); }}>
            {/* Frame */}
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width, height, 0.12]} />
                <meshStandardMaterial color={frameColor} />
            </mesh>
            {/* Leaf */}
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width - 0.08, height - 0.04, 0.04]} />
                <meshStandardMaterial color="#334155" roughness={0.8} />
            </mesh>
        </group>
    );
};

const FurnitureMesh = ({ item, floorLevel, wallHeight, isSelected, onSelect }) => {
    const [w, d, h] = item.size;
    const baseHeight = floorLevel * wallHeight;
    const color = isSelected ? "#3b82f6" : "#cbd5e1";

    return (
        <mesh position={[item.position[0], baseHeight + h / 2, item.position[1]]} rotation={[0, item.rotation, 0]} onClick={(e) => { e.stopPropagation(); onSelect(item); }} castShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
    );
};

const RoomMesh = ({ room, floorLevel, wallHeight }) => {
    const shape = useMemo(() => {
        if (!room.polygon || room.polygon.length < 3) return null;
        const s = new THREE.Shape();
        s.moveTo(room.polygon[0][0], room.polygon[0][1]);
        room.polygon.slice(1).forEach(p => s.lineTo(p[0], p[1]));
        s.closePath();
        return s;
    }, [room.polygon]);

    const color = useMemo(() => {
        const t = room.type.toLowerCase();
        if (t.includes("bedroom")) return "#60a5fa";
        if (t.includes("bath")) return "#34d399";
        if (t.includes("kitchen")) return "#fb923c";
        if (t.includes("living")) return "#fbbf24";
        return "#94a3b8";
    }, [room.type]);

    if (!shape) return null;

    return (
        <mesh position={[0, floorLevel * wallHeight + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color={color} opacity={0.6} transparent roughness={1} />
        </mesh>
    );
};

const FloorSlab = ({ walls, thickness, floorLevel, wallHeight }) => {
    const bounds = useMemo(() => {
        if (!walls.length) return null;
        const pts = walls.flatMap(w => [w.start, w.end]);
        const xs = pts.map(p => p[0]);
        const ys = pts.map(p => p[1]);
        return {
            minX: Math.min(...xs) - 1, maxX: Math.max(...xs) + 1,
            minY: Math.min(...ys) - 1, maxY: Math.max(...ys) + 1
        };
    }, [walls]);

    if (!bounds) return null;
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxY - bounds.minY;

    return (
        <mesh position={[(bounds.minX + bounds.maxX) / 2, floorLevel * wallHeight - thickness / 2, (bounds.minY + bounds.maxY) / 2]} receiveShadow>
            <boxGeometry args={[w, thickness, d]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
        </mesh>
    );
};

const Scene3D = ({ buildingData, selectedId, onSelect, showFloor, darkMode }) => {
    if (!buildingData) return null;
    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />

            {buildingData.floors.map((floor, fIdx) => (
                <group key={`f-${fIdx}`}>
                    {showFloor && <FloorSlab walls={floor.walls} thickness={0.15} floorLevel={fIdx} wallHeight={buildingData.wallHeight} />}
                    {floor.walls.map(w => (
                        <Wall key={w.id} wall={w} height={buildingData.wallHeight} floorLevel={fIdx} isSelected={selectedId === w.id} onSelect={onSelect} />
                    ))}
                    {floor.doors.map(d => (
                        <Door key={d.id} door={d} wallHeight={buildingData.wallHeight} floorLevel={fIdx} isSelected={selectedId === d.id} onSelect={onSelect} />
                    ))}
                    {floor.windows.map(w => (
                        <Window key={w.id} window={w} wallHeight={buildingData.wallHeight} floorLevel={fIdx} isSelected={selectedId === w.id} onSelect={onSelect} />
                    ))}
                    {floor.furniture.map(item => (
                        <FurnitureMesh key={item.id} item={item} wallHeight={buildingData.wallHeight} floorLevel={fIdx} isSelected={selectedId === item.id} onSelect={onSelect} />
                    ))}
                    {floor.rooms.map(r => (
                        <RoomMesh key={r.id} room={r} floorLevel={fIdx} wallHeight={buildingData.wallHeight} />
                    ))}
                </group>
            ))}
            <gridHelper args={[100, 100, "#cbd5e1", "#f1f5f9"]} position={[0, -0.01, 0]} />
        </>
    );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function FloorPlanVisualizer() {
    const [fileId, setFileId] = useState(null);
    const [buildingData, setBuildingData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedElement, setSelectedElement] = useState(null);
    const [showFloor, setShowFloor] = useState(true);
    const [darkMode, setDarkMode] = useState(true);
    const [generating3D, setGenerating3D] = useState(false);

    // Update building data in real-time
    const updateElement = (id, field, value) => {
        if (!buildingData) return;
        const newData = JSON.parse(JSON.stringify(buildingData));
        newData.floors.forEach(floor => {
            const collections = [floor.walls, floor.doors, floor.windows, floor.furniture];
            collections.forEach(col => {
                const item = col.find(i => i.id === id);
                if (item) {
                    item[field] = parseFloat(value);
                    // Also update selectedElement so Sidebar stays in sync
                    setSelectedElement({ ...item });
                }
            });
        });
        setBuildingData(newData);
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
            const data = await res.json();
            setFileId(data.file_id);
            await processFloorplan(data.file_id);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const processFloorplan = async (fid) => {
        const fd = new FormData();
        fd.append("file_id", fid);
        fd.append("use_yolo", "true");
        try {
            const res = await fetch(`${API_BASE}/api/process`, { method: "POST", body: fd });
            const data = await res.json();
            setBuildingData(data);
        } catch (err) { console.error(err); }
    };

    const generateHighResGLB = async () => {
        if (!fileId) return;
        setGenerating3D(true);
        const fd = new FormData();
        fd.append("file_id", fileId);
        fd.append("wall_height", buildingData.wallHeight);
        try {
            const res = await fetch(`${API_BASE}/api/generate-3d`, { method: "POST", body: fd });
            const data = await res.json();
            window.open(`${API_BASE}${data.glb_url}`, "_blank");
        } catch (err) { console.error(err); }
        setGenerating3D(false);
    };

    return (
        <div className={`flex h-screen w-full overflow-hidden ${darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
            {/* Left Sidebar: Elements & Controls */}
            <aside className={`w-80 flex flex-col border-r ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
                <div className="p-4 border-b border-inherit bg-slate-900/50 flex items-center gap-3">
                    <Box className="text-blue-500" />
                    <h1 className="font-bold text-lg tracking-tight">ArchCAD Pro</h1>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Project Config */}
                    <section className="space-y-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                            <Settings size={14} /> Project Settings
                        </label>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm">Global Wall Height (m)</label>
                                <input
                                    type="range" min="2" max="5" step="0.1"
                                    value={buildingData?.wallHeight || 3}
                                    onChange={(e) => setBuildingData({ ...buildingData, wallHeight: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <div className="text-right text-xs text-blue-500 font-mono">{buildingData?.wallHeight.toFixed(1)}m</div>
                            </div>
                        </div>
                    </section>

                    {/* Inspector */}
                    {selectedElement && (
                        <section className={`p-4 rounded-xl border animate-in slide-in-from-left duration-300 ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200 shadow-sm"}`}>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-xs font-bold text-blue-500 uppercase tracking-wider">Inspector</label>
                                <button onClick={() => setSelectedElement(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-2 bg-blue-500/10 rounded-lg">
                                    <Cpu size={18} className="text-blue-500" />
                                    <span className="text-sm font-medium capitalize">{selectedElement.type?.replace(/_/g, " ") || "Element"}</span>
                                </div>
                                {selectedElement.width !== undefined && (
                                    <div className="space-y-2">
                                        <label className="text-xs flex items-center justify-between">
                                            <span>Width (m)</span>
                                            <span className="font-mono text-blue-400">{selectedElement.width.toFixed(2)}</span>
                                        </label>
                                        <input type="range" min="0.5" max="5" step="0.05" value={selectedElement.width} onChange={(e) => updateElement(selectedElement.id, "width", e.target.value)} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                    </div>
                                )}
                                {selectedElement.height !== undefined && (
                                    <div className="space-y-2">
                                        <label className="text-xs flex items-center justify-between">
                                            <span>Height (m)</span>
                                            <span className="font-mono text-blue-400">{selectedElement.height.toFixed(2)}</span>
                                        </label>
                                        <input type="range" min="0.5" max="3" step="0.05" value={selectedElement.height} onChange={(e) => updateElement(selectedElement.id, "height", e.target.value)} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                    </div>
                                )}
                                {selectedElement.sillHeight !== undefined && (
                                    <div className="space-y-2">
                                        <label className="text-xs flex items-center justify-between">
                                            <span>Sill Height (m)</span>
                                            <span className="font-mono text-blue-400">{selectedElement.sillHeight.toFixed(2)}</span>
                                        </label>
                                        <input type="range" min="0" max="2" step="0.05" value={selectedElement.sillHeight} onChange={(e) => updateElement(selectedElement.id, "sillHeight", e.target.value)} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {!fileId && (
                        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-800 rounded-2xl gap-4 text-center p-4">
                            <Upload className="text-slate-700" size={32} />
                            <p className="text-sm text-slate-500 leading-relaxed">Upload building plan to begin architectural modeling</p>
                            <input type="file" onChange={handleUpload} className="hidden" id="plan-upload" />
                            <label htmlFor="plan-upload" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-95">Select Image</label>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-inherit space-y-3 bg-slate-900/50">
                    <button
                        onClick={generateHighResGLB}
                        disabled={!fileId || generating3D}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                    >
                        {generating3D ? <Loader2 className="animate-spin" /> : <Layers size={18} />}
                        {generating3D ? "Blender Processing..." : "Export Pro 3D"}
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => setDarkMode(!darkMode)} className="flex-1 p-2 border border-inherit rounded-lg flex justify-center hover:bg-slate-800 transition-colors">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
                        <button className="flex-1 p-2 border border-inherit rounded-lg flex justify-center text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={18} /></button>
                    </div>
                </div>
            </aside>

            {/* Main View: 3D Canvas */}
            <main className="flex-1 relative bg-slate-950">
                {loading && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md">
                        <div className="relative">
                            <Loader2 className="animate-spin text-blue-500 mb-6" size={64} />
                            <div className="absolute inset-0 blur-xl bg-blue-500/20 animate-pulse"></div>
                        </div>
                        <p className="text-xl font-bold tracking-tight mb-2">Analyzing Floorplan...</p>
                        <p className="text-sm text-slate-500 font-mono italic">YOLO CV v8 active_</p>
                    </div>
                )}

                {/* Toolbox Overlays */}
                <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-xl shadow-2xl">
                        <Activity size={16} className="text-green-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Status: Live Render</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-xl shadow-2xl">
                        <Ruler size={16} className="text-blue-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Analysis Units: Metric (m)</span>
                    </div>
                </div>

                <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-3">
                    <button onClick={() => setShowFloor(!showFloor)} title="Toggle Foundation" className={`p-4 rounded-2xl shadow-2xl backdrop-blur-md transition-all active:scale-90 ${showFloor ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 border border-slate-800"}`}>
                        <Maximize2 size={24} />
                    </button>
                    <button onClick={() => setSelectedElement(null)} title="Clear Selection" className="p-4 bg-slate-900 text-slate-400 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md hover:text-white transition-all active:scale-90">
                        <MousePointer2 size={24} />
                    </button>
                </div>

                <Canvas shadows dpr={[1, 2]}>
                    <Suspense fallback={null}>
                        <Scene3D
                            buildingData={buildingData}
                            selectedId={selectedElement?.id}
                            onSelect={setSelectedElement}
                            showFloor={showFloor}
                            darkMode={darkMode}
                        />
                    </Suspense>
                </Canvas>
            </main>
        </div>
    );
}
