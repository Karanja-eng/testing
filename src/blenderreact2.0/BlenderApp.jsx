// frontend/src/BlenderApp.jsx
import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

// Component to load and display a GLB model
function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function BlenderApp() {
  const [modelUrl, setModelUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateBeam = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Trigger detailed generation (calls Blender headless)
      const res = await fetch("http://localhost:8000/generate-detailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beam_length: 5,
          beam_width: 0.3,
          beam_height: 0.5,
          num_bottom_bars: 4,
          num_top_bars: 2,
          cover: 0.025,
          stirrup_spacing: 0.15,
        }),
      });

      if (!res.ok) throw new Error("Backend error while generating beam");
      const data = await res.json();

      // Step 2: Extract the returned URL to GLB model
      setModelUrl(`http://localhost:8000${data.file}`);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically generate once when page loads
  useEffect(() => {
    generateBeam();
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#f4f4f4" }}>
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          background: "#fff",
          padding: "8px 12px",
          borderRadius: "8px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}
      >
        <button
          onClick={generateBeam}
          disabled={isLoading}
          style={{
            background: "#007bff",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {isLoading ? "Generating..." : "Generate Detailed Beam"}
        </button>
      </div>

      {error && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 10,
            background: "#f8d7da",
            color: "#721c24",
            padding: "8px 12px",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      )}

      {modelUrl ? (
        <Canvas camera={{ position: [0, 1, 6], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <OrbitControls enableZoom enablePan />
          <Model url={modelUrl} />
        </Canvas>
      ) : (
        !isLoading && (
          <p style={{ textAlign: "center", marginTop: "40vh" }}>
            No model loaded.
          </p>
        )
      )}
    </div>
  );
}

export default BlenderApp;
