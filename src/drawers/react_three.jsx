import { useState } from "react";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function Model() {
  const { scene } = useGLTF("/result.glb");
  return <primitive object={scene} />;
}
function Viewer() {
  return (
    <Canvas>
      <OrbitControls />
      <Model />
    </Canvas>
  );
}

export default function SegformerApp() {
  const [glb, setGlb] = useState("");

  const upload = async (e: any) => {
    const form = new FormData();
    form.append("file", e.target.files[0]);
    const res = await fetch("http://localhost:8001/convert", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setGlb("http://localhost:8001/" + data.glb);
  };

  return (
    <div>
      <input type="file" onChange={upload} />
      {glb && <Viewer url={glb} />}
    </div>
  );
}
