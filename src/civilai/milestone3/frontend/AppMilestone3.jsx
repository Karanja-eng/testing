
import React, { useState } from "react";
import Viewer3D from "./Viewer3D";

// Assuming backend runs on port 8002
const API_URL = "http://localhost:8002";

export default function AppMilestone3() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [modelUrl, setModelUrl] = useState(null);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);
        setModelUrl(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_URL}/convert`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Upload failed");
            }

            // Success
            setModelUrl(`${API_URL}${data.glb_url}`);
            if (data.stats) setStats(data.stats);

        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
            {/* Header */}
            <header style={{ padding: "1rem 2rem", background: "#222", color: "white", borderBottom: "1px solid #444" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>CivilAI - Milestone 3: Advanced Floorplan 3D (Blender)</h1>
            </header>

            {/* Main Content */}
            <div style={{ flex: 1, display: "flex" }}>

                {/* Sidebar */}
                <div style={{ width: "300px", background: "#f5f5f5", padding: "1rem", borderRight: "1px solid #ddd", display: "flex", flexDirection: "column", gap: "1rem" }}>

                    <div style={{ padding: "1rem", background: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                        <h3>1. Upload</h3>
                        <p style={{ fontSize: "0.9rem", color: "#666" }}>Select a 2D floorplan image (JPG/PNG).</p>
                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ marginBottom: "1rem", width: "100%" }} />

                        <button
                            onClick={handleUpload}
                            disabled={!file || loading}
                            style={{
                                width: "100%",
                                padding: "10px",
                                background: loading ? "#ccc" : "#0070f3",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: loading ? "not-allowed" : "pointer",
                                fontWeight: "bold"
                            }}
                        >
                            {loading ? "Processing..." : "Generate 3D Model"}
                        </button>
                    </div>

                    {error && (
                        <div style={{ padding: "1rem", background: "#fee", color: "#c00", borderRadius: "8px", border: "1px solid #fcc" }}>
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {stats && (
                        <div style={{ padding: "1rem", background: "#eef", color: "#336", borderRadius: "8px", border: "1px solid #cce" }}>
                            <strong>Statistics:</strong>
                            <ul style={{ paddingLeft: "1.2rem", margin: "0.5rem 0" }}>
                                <li>Walls: {stats.walls}</li>
                                <li>Rooms: {stats.rooms}</li>
                                <li>Objects: {stats.objects}</li>
                            </ul>
                        </div>
                    )}

                    <div style={{ flex: 1 }}></div>
                    <div style={{ fontSize: "0.8rem", color: "#888", textAlign: "center" }}>
                        Powered by Blender & YOLO
                    </div>
                </div>

                {/* 3D Viewport */}
                <div style={{ flex: 1, position: "relative", background: "#333" }}>
                    {loading && (
                        <div style={{
                            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                            color: "white", flexDirection: "column", gap: "1rem", background: "rgba(0,0,0,0.7)", zIndex: 10
                        }}>
                            <div className="spinner"></div> {/* Basic spinner styling needed or just text */}
                            <h3>Processing Floorplan...</h3>
                            <p>Running Segmentation & Blender...</p>
                        </div>
                    )}

                    {modelUrl ? (
                        <Viewer3D url={modelUrl} />
                    ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
                            {!loading && <p>No model generated yet.</p>}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
