
import React, { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Stage } from "@react-three/drei";
import * as THREE from "three";

function Model({ url }) {
    const { scene } = useGLTF(url);

    // Center map/scene?
    // const box = new THREE.Box3().setFromObject(scene);
    // const center = box.getCenter(new THREE.Vector3());
    // scene.position.sub(center); // auto center

    return <primitive object={scene} />;
}

export default function Viewer3D({ url }) {
    return (
        <div style={{ width: "100%", height: "100%", background: "#1a1a1a" }}>
            <Canvas shadows dpr={[1, 2]} camera={{ position: [10, 10, 10], fov: 50 }}>
                <Suspense fallback={null}>
                    <Stage environment="city" intensity={0.5}>
                        <Model url={url} />
                    </Stage>
                </Suspense>
                <OrbitControls makeDefault />
                <ambientLight intensity={0.2} />
                <gridHelper args={[20, 20]} />
            </Canvas>
            <div style={{
                position: "absolute",
                bottom: 10,
                left: 10,
                color: "white",
                background: "rgba(0,0,0,0.5)",
                padding: "5px 10px",
                borderRadius: 4,
                pointerEvents: "none"
            }}>
                Left Click: Rotate | Right Click: Pan | Scroll: Zoom
            </div>
        </div>
    );
}
