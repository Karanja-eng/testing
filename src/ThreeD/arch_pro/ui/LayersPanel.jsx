import React from 'react';
import { Eye, EyeOff, Layers, Sliders, Zap, Droplets, Box, Home } from 'lucide-react';

const LayersPanel = ({ layers, onToggle, onOpacityChange, darkMode }) => {
    const layerIcons = {
        walls: <Home size={14} className="text-blue-400" />,
        rooms: <Layers size={14} className="text-cyan-400" />,
        furniture: <Box size={14} className="text-slate-400" />,
        electrical: <Zap size={14} className="text-yellow-400" />,
        plumbing: <Droplets size={14} className="text-sky-400" />,
        conduits: <Sliders size={14} className="text-purple-400" />
    };

    return (
        <div className={`p-6 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-3xl bg-slate-900/40 space-y-6`}>
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
                    <Layers size={14} /> System Layers
                </h3>
            </div>

            <div className="grid gap-4">
                {Object.entries(layers).map(([key, config]) => (
                    <div key={key} className="group">
                        <div className="flex items-center justify-between p-3 rounded-2xl border border-transparent hover:border-white/5 hover:bg-white/[0.02] transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-slate-950 rounded-xl border border-white/5 shadow-inner group-hover:scale-110 transition-transform">
                                    {layerIcons[key] || <Box size={14} />}
                                </div>
                                <span className="text-xs font-bold tracking-tight text-slate-300 capitalize">{key}</span>
                            </div>
                            <button
                                onClick={() => onToggle(key)}
                                className={`p-2 rounded-xl transition-all ${config.visible ? "bg-blue-500/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "bg-slate-950/50 text-slate-600"}`}
                            >
                                {config.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                        </div>
                        {config.visible && (
                            <div className="px-14 pt-2 pb-4">
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range" min="0" max="1" step="0.1"
                                        value={config.opacity}
                                        onChange={(e) => onOpacityChange(key, parseFloat(e.target.value))}
                                        className="flex-1 h-0.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <span className="text-[9px] font-mono text-slate-600">{Math.round(config.opacity * 100)}%</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LayersPanel;
