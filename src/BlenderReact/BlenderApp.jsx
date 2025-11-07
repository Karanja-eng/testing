import React, { useState, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function BeamModel({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function Viewer({ modelUrl }) {
  return (
    <Canvas camera={{ position: [2, 2, 5], fov: 60 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <Suspense fallback={null}>
        <BeamModel url={modelUrl} />
      </Suspense>
      <OrbitControls />
    </Canvas>
  );
}

export default function BlenderApp() {
  const [modelUrl, setModelUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateBeam = async () => {
    setLoading(true);
    const response = await fetch("http://localhost:8000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ length: 5, width: 0.3, height: 0.5 }),
    });
    const data = await response.json();
    setModelUrl(`http://localhost:8000${data.file}`);
    setLoading(false);
  };

  useEffect(() => {
    generateBeam();
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#f0f0f0" }}>
      {loading && (
        <div style={{ position: "absolute", top: 20, left: 20 }}>
          Generating beam...
        </div>
      )}
      {modelUrl && <Viewer modelUrl={modelUrl} />}
    </div>
  );
}
