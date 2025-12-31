import React, { useMemo } from 'react';
import * as THREE from 'three';
import { SoftShadows, ContactShadows, PerspectiveCamera, OrbitControls, Environment, Line } from '@react-three/drei';

const ProScene = ({ data, layers, selectedId, onSelect, darkMode }) => {
    if (!data || !data.floors) return null;

    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[12, 12, 12]} fov={45} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ambientLight intensity={darkMode ? 0.3 : 0.6} />
            <directionalLight position={[15, 25, 15]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
            <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={40} blur={2} far={4.5} />

            {data.floors.map((floor, idx) => (
                <group key={`floor-${idx}`} position={[0, floor.elevation || 0, 0]}>
                    {/* 1. FLOOR SLAB */}
                    {layers.rooms.visible && <FloorSlab walls={floor.walls} thickness={0.1} />}

                    {/* 2. ROOM HEATMAPS */}
                    {layers.rooms.visible && floor.rooms.map(room => (
                        <RoomMesh key={room.id} room={room} opacity={layers.rooms.opacity} />
                    ))}

                    {/* 2. WALLS */}
                    {layers.walls.visible && floor.walls.map(wall => (
                        <WallMesh key={wall.id} wall={wall} height={floor.height || 3.0} opacity={layers.walls.opacity} isSelected={selectedId === wall.id} onSelect={onSelect} />
                    ))}

                    {/* 2a. OPENINGS */}
                    {layers.walls.visible && floor.doors.map(door => (
                        <OpeningMesh key={door.id} item={{ ...door, position: [door.position[0], -door.position[1]] }} color="#475569" height={2.1} />
                    ))}
                    {layers.walls.visible && floor.windows.map(win => (
                        <OpeningMesh key={win.id} item={{ ...win, position: [win.position[0], -win.position[1]] }} color="#94a3b8" height={1.2} sillHeight={0.9} />
                    ))}

                    {/* 3. ELECTRICAL LAYER */}
                    {layers.electrical.visible && floor.electrical.map(pt => (
                        <mesh key={pt.id} position={[pt.position[0], pt.height, -pt.position[1]]}>
                            <boxGeometry args={[0.1, 0.08, 0.04]} />
                            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} transparent opacity={layers.electrical.opacity} />
                        </mesh>
                    ))}

                    {/* 4. PLUMBING LAYER */}
                    {layers.plumbing.visible && floor.plumbing.map(pt => (
                        <mesh key={pt.id} position={[pt.position[0], pt.height, -pt.position[1]]}>
                            <sphereGeometry args={[0.06]} />
                            <meshStandardMaterial color="#3b82f6" transparent opacity={layers.plumbing.opacity} />
                        </mesh>
                    ))}

                    {/* 5. CONDUITS & PIPES */}
                    {layers.conduits.visible && floor.conduits.map(cond => (
                        <Line
                            key={cond.id}
                            points={cond.path.map(p => [p[0], p[2], -p[1]])}
                            color={cond.type === "electrical" ? "#a855f7" : "#06b6d4"}
                            lineWidth={cond.diameter * 100}
                            transparent
                            opacity={layers.conduits.opacity}
                        />
                    ))}

                    {/* 6. FURNITURE */}
                    {layers.furniture.visible && floor.furniture.map(item => (
                        <group key={item.id} position={[item.position[0], item.size[2] / 2, -item.position[1]]} rotation={[0, item.rotation, 0]}>
                            <mesh castShadow>
                                <boxGeometry args={[item.size[0], item.size[2], item.size[1]]} />
                                <meshStandardMaterial color={item.category === "plumbing" ? "#93c5fd" : "#cbd5e1"} transparent opacity={layers.furniture.opacity} />
                            </mesh>
                            <mesh>
                                <boxGeometry args={[item.size[0] + 0.01, item.size[2] + 0.01, item.size[1] + 0.01]} />
                                <meshBasicMaterial color="#475569" wireframe transparent opacity={0.2} />
                            </mesh>
                        </group>
                    ))}
                </group>
            ))}

            <gridHelper args={[50, 50, "#475569", "#1e293b"]} position={[0, -0.01, 0]} />
        </>
    );
};

const FloorSlab = ({ walls, thickness }) => {
    const coords = useMemo(() => {
        if (!walls || walls.length === 0) return null;
        const pts = walls.flatMap(w => w.start && w.end ? [w.start, w.end] : []);
        if (pts.length === 0) return null;
        const xs = pts.map(p => p[0]);
        const ys = pts.map(p => p[1]);
        return {
            minX: Math.min(...xs) - 0.5, maxX: Math.max(...xs) + 0.5,
            minY: Math.min(...ys) - 0.5, maxY: Math.max(...ys) + 0.5
        };
    }, [walls]);

    if (!coords) return null;
    const w = coords.maxX - coords.minX;
    const d = coords.maxY - coords.minY;

    return (
        <mesh position={[(coords.minX + coords.maxX) / 2, -thickness / 2, -(coords.minY + coords.maxY) / 2]} receiveShadow>
            <boxGeometry args={[w, thickness, d]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.9} />
        </mesh>
    );
};

const RoomMesh = ({ room, opacity }) => {
    const shape = useMemo(() => {
        if (!room.polygon || room.polygon.length < 3) return null;
        const s = new THREE.Shape();
        s.moveTo(room.polygon[0][0], -room.polygon[0][1]);
        room.polygon.slice(1).forEach(p => s.lineTo(p[0], -p[1]));
        s.closePath();

        if (room.holes) {
            room.holes.forEach(hole => {
                const h = new THREE.Path();
                h.moveTo(hole[0][0], -hole[0][1]);
                hole.slice(1).forEach(p => h.lineTo(p[0], -p[1]));
                h.closePath();
                s.holes.push(h);
            });
        }
        return s;
    }, [room.polygon, room.holes]);

    if (!shape) return null;

    return (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color="#3b82f6" transparent opacity={opacity * 0.15} />
            <Line points={room.polygon.map(p => [p[0], -p[1], 0.01]).concat([[room.polygon[0][0], -room.polygon[0][1], 0.01]])} color="#3b82f6" lineWidth={1} />
        </mesh>
    );
};

const WallMesh = ({ wall, height, opacity, isSelected, onSelect }) => {
    const { start, end, thickness, polygon } = wall;
    const color = isSelected ? "#3b82f6" : "#fafaf9"; // Architectural Bone White

    const geometry = useMemo(() => {
        if (polygon && polygon.length >= 3) {
            const shape = new THREE.Shape();
            shape.moveTo(polygon[0][0], -polygon[0][1]);
            polygon.slice(1).forEach(p => shape.lineTo(p[0], -p[1]));
            shape.closePath();

            if (wall.holes) {
                wall.holes.forEach(hole => {
                    const h = new THREE.Path();
                    h.moveTo(hole[0][0], -hole[0][1]);
                    hole.slice(1).forEach(p => h.lineTo(p[0], -p[1]));
                    h.closePath();
                    shape.holes.push(h);
                });
            }
            return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
        }
        return null;
    }, [polygon, wall.holes, height]);

    // 1. Prioritize Segments (Crisp Lines) if available
    if (start && end) {
        const angle = Math.atan2(-(end[1] - start[1]), end[0] - start[0]);
        const len = Math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2);
        return (
            <mesh
                position={[(start[0] + end[0]) / 2, height / 2, -(start[1] + end[1]) / 2]}
                rotation={[0, angle, 0]}
                onClick={(e) => { e.stopPropagation(); onSelect(wall); }}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[len, height, thickness || 0.15]} />
                <meshStandardMaterial color={color} roughness={0.8} metalness={0.0} transparent opacity={opacity} />
            </mesh>
        );
    }

    // 2. Fallback to Polygon (Neural Blob)
    if (geometry) {
        return (
            <mesh
                geometry={geometry}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0, 0]}
                onClick={(e) => { e.stopPropagation(); onSelect(wall); }}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial color={color} roughness={0.8} metalness={0.0} transparent opacity={opacity} />
            </mesh>
        );
    }

    return null;
};

const OpeningMesh = ({ item, color, height, sillHeight = 0 }) => {
    return (
        <group position={[item.position[0], sillHeight + height / 2, item.position[1]]} rotation={[0, -item.rotation || 0, 0]}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={[item.width || 0.9, height, 0.16]} />
                <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
            {/* Subtle Frame */}
            <mesh>
                <boxGeometry args={[item.width || 0.9 + 0.02, height + 0.02, 0.18]} />
                <meshStandardMaterial color="#334155" transparent opacity={0.3} />
            </mesh>
        </group>
    );
};

export default ProScene;
