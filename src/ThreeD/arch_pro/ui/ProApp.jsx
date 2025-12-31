import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader2, Box, Activity, Ruler, Download, Upload, Zap, Eye, Settings, Layers } from 'lucide-react';
import ProScene from './ProScene';
import LayersPanel from './LayersPanel';

const API_BASE = "http://localhost:8002";

export default function ProApp() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [darkMode, setDarkMode] = useState(true);
    const [error, setError] = useState(null);
    const [layers, setLayers] = useState({
        walls: { visible: true, opacity: 1.0 },
        rooms: { visible: true, opacity: 0.8 },
        furniture: { visible: true, opacity: 1.0 },
        electrical: { visible: true, opacity: 1.0 },
        plumbing: { visible: true, opacity: 1.0 },
        conduits: { visible: true, opacity: 0.6 }
    });

    const toggleLayer = (name) => {
        setLayers(prev => ({ ...prev, [name]: { ...prev[name], visible: !prev[name].visible } }));
    };

    const setOpacity = (name, val) => {
        setLayers(prev => ({ ...prev, [name]: { ...prev[name], opacity: val } }));
    };

    const [currentFloor, setCurrentFloor] = useState(0);

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setLoading(true);
        setError(null);
        const fd = new FormData();
        files.forEach(file => fd.append("files", file));
        fd.append("ppm", "100.0");
        try {
            const res = await fetch(`${API_BASE}/v4/process`, { method: "POST", body: fd });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Processing failed");
            }
            const proData = await res.json();
            if (!proData.floors || proData.floors.length === 0) {
                throw new Error("No floorplans detected in upload.");
            }
            setData(proData);
        } catch (err) {
            console.error(err);
            setError(err.message);
            setData(null);
        }
        setLoading(false);
    };

    return (
        <div className={`flex h-screen w-full overflow-hidden ${darkMode ? "bg-[#020617] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
            {/* SIDEBAR - FUTURISTIC GLASS */}
            <aside className={`w-84 flex flex-col border-r ${darkMode ? "border-white/5" : "border-slate-200"} z-20 shadow-[20px_0_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl bg-slate-950/40`}>
                <div className="p-8 border-b border-white/5 flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg blur opacity-40 animate-pulse"></div>
                        <div className="relative p-2.5 bg-slate-900 rounded-lg border border-white/10 shadow-2xl">
                            <Box className="text-blue-400" size={22} />
                        </div>
                    </div>
                    <div>
                        <h1 className="font-black text-2xl tracking-tighter leading-none">ARCH<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">PRO</span></h1>
                        <p className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase mt-1">Version 5.0 Stable</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {!data && (
                        <div className="relative group overflow-hidden">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                            <div className="relative h-64 flex flex-col items-center justify-center border border-white/10 rounded-3xl gap-4 bg-slate-900/40 p-8 text-center backdrop-blur-sm">
                                <div className="p-4 bg-slate-950 rounded-full border border-white/5 shadow-inner">
                                    <Upload className="text-blue-500" size={32} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-bold tracking-tight">AI Structural Input</p>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">System ready for architectural high-fidelity scanning. Tip: Select multiple files for stacking.</p>
                                    {error && (
                                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-tighter animate-pulse mt-2">Error: {error}</p>
                                    )}
                                </div>
                                <input type="file" multiple onChange={handleUpload} className="hidden" id="pro-upload" />
                                <label htmlFor="pro-upload" className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)]">Initialize Stream</label>
                            </div>
                        </div>
                    )}

                    {data && (
                        <>
                            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Layers size={14} className="text-cyan-400" /> Structure Stack
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {data.floors.map((f, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentFloor(i)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentFloor === i ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-slate-950 text-slate-500 border border-white/5 hover:bg-slate-900"}`}
                                        >
                                            Level {i}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 shadow-2xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Activity size={14} className="text-blue-400" /> Neural Metrics (L{currentFloor})
                                        </label>
                                        <span className="text-[10px] font-mono text-green-500 animate-pulse">● LIVE</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatBox label="Structural" val={data.floors[currentFloor].walls.length} unit="Walls" />
                                        <StatBox label="Energy" val={data.floors[currentFloor].electrical.length} unit="Nodes" />
                                        <StatBox label="Nodes" val={data.floors[currentFloor].rooms.length} unit="Rooms" />
                                        <StatBox label="Confidence" val="98.2" unit="%" />
                                    </div>
                                    <div className="pt-2">
                                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 w-[98%] shadow-[0_0_10px_rgba(59,130,246,0.6)]"></div>
                                        </div>
                                    </div>
                                </div>

                                <LayersPanel
                                    layers={layers}
                                    onToggle={toggleLayer}
                                    onOpacityChange={setOpacity}
                                    darkMode={darkMode}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-white/5 bg-slate-950/60 backdrop-blur-xl flex gap-3">
                    <button className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95">
                        <Settings size={20} />
                    </button>
                    <button className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3">
                        <Download size={18} />
                        Export Meta
                    </button>
                </div>
            </aside>

            {/* MAIN VIEWPORT */}
            <main className="flex-1 relative bg-[#020617]">
                {loading && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-2xl">
                        <div className="relative mb-8">
                            <div className="absolute -inset-4 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                            <Loader2 className="animate-spin text-blue-500 relative" size={80} strokeWidth={1} />
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black tracking-tighter text-white">GENETIC_ASSEMBLY_IN_PROGRESS</h2>
                            <p className="text-xs text-blue-400 font-mono tracking-widest uppercase opacity-60">Synchronizing Spatial Polygons with Neural Weights_</p>
                        </div>
                        <div className="mt-12 w-64 h-0.5 bg-slate-900 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 animate-progress shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
                        </div>
                    </div>
                )}

                {/* HUD HUD */}
                <div className="absolute top-8 left-8 z-10 space-y-4">
                    <StatusBadge icon={<Ruler size={14} />} text="Kernel: Metric-v5" />
                    <StatusBadge icon={<Zap size={14} />} text="Auto-Route: Active" color="text-cyan-400" />
                    <div className="px-4 py-2 bg-black/40 border border-white/5 rounded-2xl backdrop-blur-xl text-[10px] font-mono text-slate-500 flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        VIRTUAL_MESH_RENDERER: STABLE
                    </div>
                </div>

                <div className="absolute top-8 right-8 z-10">
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="p-3 bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl text-slate-400 hover:text-white transition-all shadow-2xl"
                    >
                        <Eye size={20} />
                    </button>
                </div>

                <Canvas shadows dpr={[1, 2]} camera={{ position: [10, 10, 10], fov: 45 }}>
                    <Suspense fallback={null}>
                        <ProScene
                            data={data}
                            layers={layers}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            darkMode={darkMode}
                        />
                    </Suspense>
                </Canvas>
            </main>
        </div>
    );
}

const StatBox = ({ label, val, unit }) => (
    <div className="p-4 bg-slate-900/40 rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-all">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">{label}</span>
        <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-white">{val}</span>
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">{unit}</span>
        </div>
    </div>
);

const StatusBadge = ({ icon, text, color = "text-blue-400" }) => (
    <div className="px-5 py-2.5 bg-slate-950/60 border border-white/5 rounded-2xl backdrop-blur-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-4 group hover:bg-slate-900/80 transition-all">
        <div className={`${color} group-hover:scale-110 transition-transform`}>{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">{text}</span>
    </div>
);
