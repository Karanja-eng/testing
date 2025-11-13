// src/App.jsx
import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";

function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function Modeling() {
  const [gltfUrl, setGltfUrl] = useState(null);

  const handleUpload = async (event) => {
    const formData = new FormData();
    formData.append("file", event.target.files[0]);
    const res = await fetch("http://localhost:8000/generate", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.status === "success") {
      setGltfUrl(`http://localhost:8000${data.file}`);
    } else {
      console.error(data.error);
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleUpload} />
      <p className="text-center text-gray-500">Loading....</p>
      {gltfUrl && (
        <Canvas style={{ height: "80vh" }}>
          <Model url={gltfUrl} />
          <OrbitControls />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
        </Canvas>
      )}
    </div>
  );
}
