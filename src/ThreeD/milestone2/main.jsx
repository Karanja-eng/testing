import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Upload, Home, Layers, Settings, Download, Eye, Palette, Loader2, AlertCircle, CheckCircle, FileImage, FileCode, Menu, X, Sun, Moon, EyeOff } from 'lucide-react';

// Backend API Configuration
const API_BASE_URL = 'http://localhost:8001/api';

// ============================================================================
// MATERIAL COMPONENTS WITH ACTUAL TEXTURES
// ============================================================================
const WallMaterial = ({ color, texture, darkMode }) => {
    const textureLoader = new THREE.TextureLoader();

    // Create actual texture patterns
    const createBrickTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base color
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 512, 512);

        // Brick pattern
        const brickW = 128;
        const brickH = 64;
        ctx.strokeStyle = darkMode ? '#000000' : '#8B4513';
        ctx.lineWidth = 3;

        for (let y = 0; y < 512; y += brickH) {
            for (let x = 0; x < 512; x += brickW) {
                const offset = (y / brickH) % 2 === 0 ? 0 : brickW / 2;
                ctx.strokeRect(x + offset, y, brickW, brickH);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    };

    const createStoneTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 512, 512);

        // Stone pattern
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = 20 + Math.random() * 40;

            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let j = 0; j < 6; j++) {
                const angle = (j / 6) * Math.PI * 2;
                const r = size * (0.8 + Math.random() * 0.4);
                ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
            }
            ctx.closePath();

            ctx.strokeStyle = darkMode ? '#000000' : '#666666';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 3);
        return texture;
    };

    const createConcreteTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 512, 512);

        // Concrete noise
        const imageData = ctx.getImageData(0, 0, 512, 512);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = Math.random() * 30 - 15;
            imageData.data[i] += noise;
            imageData.data[i + 1] += noise;
            imageData.data[i + 2] += noise;
        }
        ctx.putImageData(imageData, 0, 0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    };

    if (texture === 'brick') {
        return <meshStandardMaterial map={createBrickTexture()} roughness={0.9} metalness={0.05} />;
    } else if (texture === 'stone') {
        return <meshStandardMaterial map={createStoneTexture()} roughness={0.95} metalness={0.02} />;
    } else if (texture === 'concrete') {
        return <meshStandardMaterial map={createConcreteTexture()} roughness={0.85} metalness={0.1} />;
    }

    return <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />;
};

// ============================================================================
// 3D COMPONENTS
// ============================================================================
const Wall = ({ start, end, height, thickness, color, texture, floorLevel, darkMode }) => {
    const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;
    const baseHeight = floorLevel * height;

    return (
        <mesh position={[midX, baseHeight + height / 2, midY]} rotation={[0, -angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[length, height, thickness]} />
            <WallMaterial color={color} texture={texture} darkMode={darkMode} />
        </mesh>
    );
};

const Door = ({ position, width, height, rotation, floorLevel, wallHeight }) => {
    const baseHeight = floorLevel * wallHeight;

    return (
        <group position={[position[0], baseHeight, position[1]]} rotation={[0, rotation, 0]}>
            <mesh position={[0, height / 2, 0]} castShadow>
                <boxGeometry args={[width, height, 0.05]} />
                <meshStandardMaterial color="#654321" roughness={0.7} metalness={0.1} />
            </mesh>
            <mesh position={[width * 0.4, height * 0.5, 0.03]}>
                <sphereGeometry args={[0.04, 16, 16]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, -0.01]}>
                <boxGeometry args={[width + 0.1, 0.05, 0.05]} />
                <meshStandardMaterial color="#8B4513" />
            </mesh>
        </group>
    );
};

const Window = ({ position, width, height, rotation, floorLevel, wallHeight, sillHeight }) => {
    const baseHeight = floorLevel * wallHeight;

    return (
        <group position={[position[0], baseHeight + sillHeight, position[1]]} rotation={[0, rotation, 0]}>
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width, height, 0.03]} />
                <meshPhysicalMaterial
                    color="#87CEEB"
                    transparent
                    opacity={0.3}
                    transmission={0.95}
                    thickness={0.5}
                    roughness={0.05}
                    metalness={0.05}
                />
            </mesh>
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width * 0.03, height, 0.04]} />
                <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width, height * 0.03, 0.04]} />
                <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0, -sillHeight * 0.3, 0]}>
                <boxGeometry args={[width + 0.05, 0.05, 0.15]} />
                <meshStandardMaterial color="#D3D3D3" />
            </mesh>
        </group>
    );
};

const FloorSlab = ({ bounds, thickness, floorLevel, wallHeight, walls }) => {
    // Create slab that matches building outline
    const vertices = [];
    const wallPoints = [];

    walls.forEach(wall => {
        wallPoints.push([wall.start[0], wall.start[1]]);
        wallPoints.push([wall.end[0], wall.end[1]]);
    });

    if (wallPoints.length === 0) {
        const width = bounds.maxX - bounds.minX;
        const depth = bounds.maxY - bounds.minY;
        const centerX = (bounds.maxX + bounds.minX) / 2;
        const centerY = (bounds.maxY + bounds.minY) / 2;
        const baseHeight = floorLevel * wallHeight;

        return (
            <mesh position={[centerX, baseHeight - thickness / 2, centerY]} receiveShadow>
                <boxGeometry args={[width, thickness, depth]} />
                <meshStandardMaterial color="#E8E8E8" roughness={0.9} metalness={0.1} />
            </mesh>
        );
    }

    // Use convex hull for floor shape
    const uniquePoints = [...new Set(wallPoints.map(p => JSON.stringify(p)))].map(p => JSON.parse(p));
    const centerX = uniquePoints.reduce((sum, p) => sum + p[0], 0) / uniquePoints.length;
    const centerY = uniquePoints.reduce((sum, p) => sum + p[1], 0) / uniquePoints.length;

    const sortedPoints = uniquePoints.sort((a, b) => {
        const angleA = Math.atan2(a[1] - centerY, a[0] - centerX);
        const angleB = Math.atan2(b[1] - centerY, b[0] - centerX);
        return angleA - angleB;
    });

    const shape = new THREE.Shape();
    shape.moveTo(sortedPoints[0][0] - centerX, sortedPoints[0][1] - centerY);
    sortedPoints.forEach(point => {
        shape.lineTo(point[0] - centerX, point[1] - centerY);
    });
    shape.closePath();

    const baseHeight = floorLevel * wallHeight;

    return (
        <mesh position={[centerX, baseHeight - thickness / 2, centerY]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <extrudeGeometry args={[shape, { depth: thickness, bevelEnabled: false }]} />
            <meshStandardMaterial color="#E8E8E8" roughness={0.9} metalness={0.1} />
        </mesh>
    );
};

const RoofSlab = ({ bounds, thickness, totalFloors, wallHeight, walls }) => {
    const wallPoints = [];

    walls.forEach(wall => {
        wallPoints.push([wall.start[0], wall.start[1]]);
        wallPoints.push([wall.end[0], wall.end[1]]);
    });

    if (wallPoints.length === 0) {
        const width = bounds.maxX - bounds.minX + 0.5;
        const depth = bounds.maxY - bounds.minY + 0.5;
        const centerX = (bounds.maxX + bounds.minX) / 2;
        const centerY = (bounds.maxY + bounds.minY) / 2;
        const roofHeight = totalFloors * wallHeight + thickness / 2;

        return (
            <mesh position={[centerX, roofHeight, centerY]} receiveShadow castShadow>
                <boxGeometry args={[width, thickness, depth]} />
                <meshStandardMaterial color="#8B7355" roughness={0.8} metalness={0.05} />
            </mesh>
        );
    }

    const uniquePoints = [...new Set(wallPoints.map(p => JSON.stringify(p)))].map(p => JSON.parse(p));
    const centerX = uniquePoints.reduce((sum, p) => sum + p[0], 0) / uniquePoints.length;
    const centerY = uniquePoints.reduce((sum, p) => sum + p[1], 0) / uniquePoints.length;

    const sortedPoints = uniquePoints.sort((a, b) => {
        const angleA = Math.atan2(a[1] - centerY, a[0] - centerX);
        const angleB = Math.atan2(b[1] - centerY, b[0] - centerX);
        return angleA - angleB;
    });

    const shape = new THREE.Shape();
    shape.moveTo(sortedPoints[0][0] - centerX, sortedPoints[0][1] - centerY);
    sortedPoints.forEach(point => {
        shape.lineTo(point[0] - centerX, point[1] - centerY);
    });
    shape.closePath();

    const roofHeight = totalFloors * wallHeight + thickness / 2;

    return (
        <mesh position={[centerX, roofHeight, centerY]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
            <extrudeGeometry args={[shape, { depth: thickness, bevelEnabled: false }]} />
            <meshStandardMaterial color="#8B7355" roughness={0.8} metalness={0.05} />
        </mesh>
    );
};

// ============================================================================
// 3D SCENE
// ============================================================================
const Scene3D = ({ buildingData, wallColor, wallTexture, showFloor, showRoof, darkMode }) => {
    const { camera } = useThree();

    useEffect(() => {
        if (buildingData && buildingData.floors.length > 0) {
            const bounds = calculateBounds(buildingData);
            const center = new THREE.Vector3(
                (bounds.maxX + bounds.minX) / 2,
                buildingData.wallHeight * buildingData.floors.length / 2,
                (bounds.maxY + bounds.minY) / 2
            );
            const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
            camera.position.set(center.x + size * 1.5, center.y + size * 1.2, center.z + size * 1.5);
            camera.lookAt(center);
        }
    }, [buildingData, camera]);

    if (!buildingData || buildingData.floors.length === 0) {
        return null;
    }

    const bounds = calculateBounds(buildingData);

    return (
        <>
            <ambientLight intensity={darkMode ? 0.3 : 0.4} />
            <directionalLight position={[20, 30, 20]} intensity={darkMode ? 1.0 : 1.2} castShadow shadow-mapSize={[2048, 2048]} />
            <directionalLight position={[-20, 25, -15]} intensity={darkMode ? 0.4 : 0.6} />
            <hemisphereLight args={[darkMode ? '#4a5568' : '#ffffff', darkMode ? '#1a202c' : '#444444', darkMode ? 0.4 : 0.6]} />
            <pointLight position={[0, 15, 0]} intensity={darkMode ? 0.3 : 0.4} />

            {buildingData.floors.map((floor, floorIndex) => (
                <group key={`floor-${floorIndex}`}>
                    {showFloor && (
                        <FloorSlab
                            bounds={bounds}
                            thickness={0.25}
                            floorLevel={floorIndex}
                            wallHeight={buildingData.wallHeight}
                            walls={floor.walls}
                        />
                    )}

                    {floor.walls.map((wall, i) => (
                        <Wall
                            key={`wall-${floorIndex}-${i}`}
                            start={wall.start}
                            end={wall.end}
                            height={buildingData.wallHeight}
                            thickness={wall.thickness}
                            color={wallColor}
                            texture={wallTexture}
                            floorLevel={floorIndex}
                            darkMode={darkMode}
                        />
                    ))}

                    {floor.doors.map((door, i) => (
                        <Door
                            key={`door-${floorIndex}-${i}`}
                            position={door.position}
                            width={door.width}
                            height={door.height}
                            rotation={door.rotation}
                            floorLevel={floorIndex}
                            wallHeight={buildingData.wallHeight}
                        />
                    ))}

                    {floor.windows.map((window, i) => (
                        <Window
                            key={`window-${floorIndex}-${i}`}
                            position={window.position}
                            width={window.width}
                            height={window.height}
                            rotation={window.rotation}
                            floorLevel={floorIndex}
                            wallHeight={buildingData.wallHeight}
                            sillHeight={window.sillHeight}
                        />
                    ))}
                </group>
            ))}

            {showRoof && (
                <RoofSlab
                    bounds={bounds}
                    thickness={0.25}
                    totalFloors={buildingData.floors.length}
                    wallHeight={buildingData.wallHeight}
                    walls={buildingData.floors[0].walls}
                />
            )}

            <gridHelper args={[100, 100, darkMode ? '#4a5568' : '#444444', darkMode ? '#2d3748' : '#222222']} />
        </>
    );
};

const calculateBounds = (buildingData) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    buildingData.floors.forEach(floor => {
        floor.walls.forEach(wall => {
            minX = Math.min(minX, wall.start[0], wall.end[0]);
            maxX = Math.max(maxX, wall.start[0], wall.end[0]);
            minY = Math.min(minY, wall.start[1], wall.end[1]);
            maxY = Math.max(maxY, wall.start[1], wall.end[1]);
        });
    });

    return { minX, maxX, minY, maxY };
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function ArchitecturalCAD() {
    const [buildingData, setBuildingData] = useState(null);
    const [activeTab, setActiveTab] = useState('upload');
    const [wallColor, setWallColor] = useState('#F5F5DC');
    const [wallTexture, setWallTexture] = useState('solid');
    const [numFloors, setNumFloors] = useState(1);
    const [wallHeight, setWallHeight] = useState(3.0);
    const [wallThickness, setWallThickness] = useState(0.3);
    const [showFloor, setShowFloor] = useState(true);
    const [showRoof, setShowRoof] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [useYOLO, setUseYOLO] = useState(true);
    const [useSegmentation, setUseSegmentation] = useState(true);
    const fileInputRef = useRef(null);

    // Detect system theme
    useEffect(() => {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setDarkMode(darkModeQuery.matches);

        const handler = (e) => setDarkMode(e.matches);
        darkModeQuery.addEventListener('change', handler);
        return () => darkModeQuery.removeEventListener('change', handler);
    }, []);

    const processFile = async (file) => {
        setProcessing(true);
        setError('');
        setSuccess('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('wall_height', wallHeight.toString());
            formData.append('wall_thickness', wallThickness.toString());
            formData.append('num_floors', numFloors.toString());
            formData.append('use_yolo', useYOLO.toString());
            formData.append('use_segmentation', useSegmentation.toString());

            const endpoint = file.name.toLowerCase().endsWith('.dxf')
                ? `${API_BASE_URL}/process-dxf`
                : `${API_BASE_URL}/process-image-hybrid`;

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to process file');
            }

            const data = await response.json();
            setBuildingData(data);
            setSuccess(`✓ Processed: ${data.floors[0].walls.length} walls, ${data.floors[0].doors.length} doors, ${data.floors[0].windows.length} windows, ${data.floors[0].rooms.length} rooms`);
            setActiveTab('3d-view');
        } catch (err) {
            setError(err.message || 'Processing failed. Ensure backend is running.');
            console.error('Processing error:', err);
        } finally {
            setProcessing(false);
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            processFile(file);
        }
    };

    const loadSamplePlan = () => {
        const sampleData = {
            floors: [
                {
                    level: 0,
                    walls: [
                        { start: [0, 0], end: [12, 0], thickness: 0.3, length: 12 },
                        { start: [12, 0], end: [12, 10], thickness: 0.3, length: 10 },
                        { start: [12, 10], end: [0, 10], thickness: 0.3, length: 12 },
                        { start: [0, 10], end: [0, 0], thickness: 0.3, length: 10 },
                        { start: [6, 0], end: [6, 5], thickness: 0.2, length: 5 },
                        { start: [0, 5], end: [12, 5], thickness: 0.2, length: 12 },
                        { start: [6, 5], end: [6, 10], thickness: 0.2, length: 5 },
                    ],
                    doors: [
                        { position: [6, 0], width: 0.9, height: 2.1, rotation: 0, type: 'door' },
                        { position: [3, 5], width: 0.9, height: 2.1, rotation: Math.PI / 2, type: 'door' },
                        { position: [9, 5], width: 0.9, height: 2.1, rotation: Math.PI / 2, type: 'door' },
                    ],
                    windows: [
                        { position: [2, 0], width: 1.5, height: 1.2, rotation: 0, type: 'window', sillHeight: 0.9 },
                        { position: [10, 0], width: 1.5, height: 1.2, rotation: 0, type: 'window', sillHeight: 0.9 },
                        { position: [12, 2.5], width: 1.2, height: 1.2, rotation: Math.PI / 2, type: 'window', sillHeight: 0.9 },
                        { position: [12, 7.5], width: 1.2, height: 1.2, rotation: Math.PI / 2, type: 'window', sillHeight: 0.9 },
                        { position: [0, 2.5], width: 1.2, height: 1.2, rotation: -Math.PI / 2, type: 'window', sillHeight: 0.9 },
                        { position: [0, 7.5], width: 1.2, height: 1.2, rotation: -Math.PI / 2, type: 'window', sillHeight: 0.9 },
                    ],
                    rooms: [
                        { name: "Living Room", center: [3, 2.5], type: "living", area: 30 },
                        { name: "Bedroom 1", center: [9, 2.5], type: "bedroom", area: 15 },
                        { name: "Kitchen", center: [3, 7.5], type: "kitchen", area: 15 },
                        { name: "Bedroom 2", center: [9, 7.5], type: "bedroom", area: 15 },
                    ],
                    dimensions: {}
                }
            ],
            wallHeight: wallHeight,
            wallThickness: wallThickness,
            totalFloors: numFloors,
            scaleFactor: 1.0,
            detectedScale: false
        };

        setBuildingData(sampleData);
        setSuccess('Sample floor plan loaded!');
        setActiveTab('3d-view');
    };

    const exportModel = () => {
        if (!buildingData) return;

        const dataStr = JSON.stringify(buildingData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'building-model.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    const bgClass = darkMode ? 'bg-gray-900' : 'bg-gray-100';
    const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
    const textColor = darkMode ? 'text-white' : 'text-gray-900';
    const borderColor = darkMode ? 'border-gray-700' : 'border-gray-300';

    return (
        <div className={`w-full h-screen ${bgClass} ${textColor} flex flex-col transition-colors duration-300`}>
            {/* Header */}
            <header className={`${darkMode ? 'bg-gradient-to-r from-blue-900 to-purple-900' : 'bg-gradient-to-r from-blue-600 to-purple-600'} border-b ${borderColor} px-6 py-4 shadow-2xl`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all"
                        >
                            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                        <div className="bg-blue-500 p-2 rounded-lg shadow-lg">
                            <Home className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">
                                ArchCAD Pro 3D
                            </h1>
                            <p className="text-sm text-blue-200">AI-Powered Hybrid System</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all"
                        >
                            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={exportModel}
                            disabled={!buildingData}
                            className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 rounded-lg flex items-center space-x-2 shadow-lg transition-all text-white"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Alerts */}
            {error && (
                <div className={`${darkMode ? 'bg-red-900' : 'bg-red-100'} border ${darkMode ? 'border-red-700' : 'border-red-400'} ${darkMode ? 'text-red-100' : 'text-red-800'} px-6 py-3 flex items-center space-x-3`}>
                    <AlertCircle className="w-5 h-5" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError('')} className="hover:opacity-70">✕</button>
                </div>
            )}
            {success && (
                <div className={`${darkMode ? 'bg-green-900' : 'bg-green-100'} border ${darkMode ? 'border-green-700' : 'border-green-400'} ${darkMode ? 'text-green-100' : 'text-green-800'} px-6 py-3 flex items-center space-x-3`}>
                    <CheckCircle className="w-5 h-5" />
                    <span className="flex-1">{success}</span>
                    <button onClick={() => setSuccess('')} className="hover:opacity-70">✕</button>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                {/* Collapsible Sidebar */}
                <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} ${cardBg} border-r ${borderColor} overflow-y-auto shadow-2xl transition-all duration-300`}>
                    {sidebarOpen && (
                        <div className="p-4 space-y-4">
                            {/* Navigation Tabs */}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setActiveTab('upload')}
                                    className={`p-3 rounded-lg flex flex-col items-center space-y-1 transition-all ${activeTab === 'upload'
                                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg'
                                        : `${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`
                                        }`}
                                >
                                    <Upload className="w-5 h-5" />
                                    <span className="text-xs font-medium">Upload</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`p-3 rounded-lg flex flex-col items-center space-y-1 transition-all ${activeTab === 'settings'
                                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg'
                                        : `${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`
                                        }`}
                                >
                                    <Settings className="w-5 h-5" />
                                    <span className="text-xs font-medium">Settings</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('3d-view')}
                                    disabled={!buildingData}
                                    className={`p-3 rounded-lg flex flex-col items-center space-y-1 transition-all ${activeTab === '3d-view'
                                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg'
                                        : buildingData
                                            ? `${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`
                                            : `${darkMode ? 'bg-gray-800' : 'bg-gray-100'} opacity-50 cursor-not-allowed`
                                        }`}
                                >
                                    <Eye className="w-5 h-5" />
                                    <span className="text-xs font-medium">3D View</span>
                                </button>
                            </div>

                            {/* Upload Tab */}
                            {activeTab === 'upload' && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold flex items-center space-x-2 text-blue-400">
                                        <Upload className="w-5 h-5" />
                                        <span>Upload Floor Plan</span>
                                    </h3>

                                    <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4`}>
                                        <label className="block text-sm font-medium mb-2">AI Detection Models</label>
                                        <div className="space-y-2">
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={useYOLO}
                                                    onChange={(e) => setUseYOLO(e.target.checked)}
                                                    className="w-4 h-4 rounded"
                                                />
                                                <span className="text-sm">Use YOLO (doors, windows, rooms, stairs, columns)</span>
                                            </label>
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={useSegmentation}
                                                    onChange={(e) => setUseSegmentation(e.target.checked)}
                                                    className="w-4 h-4 rounded"
                                                />
                                                <span className="text-sm">Use Segmentation (room identification)</span>
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2">OpenCV wall detection always active</p>
                                    </div>

                                    <div className={`border-2 border-dashed ${darkMode ? 'border-gray-600 hover:border-blue-500' : 'border-gray-400 hover:border-blue-600'} rounded-xl p-8 text-center ${darkMode ? 'bg-gray-750' : 'bg-gray-50'} transition-all`}>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".png,.jpg,.jpeg,.dxf,.dwg"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            disabled={processing}
                                        />
                                        {processing ? (
                                            <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
                                        ) : (
                                            <Upload className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                                        )}
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={processing}
                                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg mb-2 shadow-lg transition-all"
                                        >
                                            {processing ? 'Processing...' : 'Choose File'}
                                        </button>
                                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            PNG, JPG, JPEG, DXF, DWG
                                        </p>
                                    </div>

                                    <button
                                        onClick={loadSamplePlan}
                                        disabled={processing}
                                        className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg flex items-center justify-center space-x-2 shadow-lg transition-all"
                                    >
                                        <Home className="w-5 h-5" />
                                        <span>Load Sample Plan</span>
                                    </button>

                                    <div className={`${darkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-blue-50 to-purple-50'} rounded-lg p-4 shadow-lg`}>
                                        <h4 className="font-semibold mb-3 text-blue-400">Building Parameters</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm mb-1">Floors</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={numFloors}
                                                    onChange={(e) => setNumFloors(parseInt(e.target.value))}
                                                    className={`w-full px-3 py-2 ${darkMode ? 'bg-gray-600' : 'bg-white'} rounded-lg focus:ring-2 focus:ring-blue-500 outline-none`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm mb-1">Wall Height (m)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="2.4"
                                                    max="5.0"
                                                    value={wallHeight}
                                                    onChange={(e) => setWallHeight(parseFloat(e.target.value))}
                                                    className={`w-full px-3 py-2 ${darkMode ? 'bg-gray-600' : 'bg-white'} rounded-lg focus:ring-2 focus:ring-blue-500 outline-none`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm mb-1">Wall Thickness (m)</label>
                                                <input
                                                    type="number"
                                                    step="0.05"
                                                    min="0.1"
                                                    max="0.6"
                                                    value={wallThickness}
                                                    onChange={(e) => setWallThickness(parseFloat(e.target.value))}
                                                    className={`w-full px-3 py-2 ${darkMode ? 'bg-gray-600' : 'bg-white'} rounded-lg focus:ring-2 focus:ring-blue-500 outline-none`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Settings Tab */}
                            {activeTab === 'settings' && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold flex items-center space-x-2 text-purple-400">
                                        <Palette className="w-5 h-5" />
                                        <span>Appearance</span>
                                    </h3>

                                    <div className={`${darkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-blue-50 to-purple-50'} rounded-lg p-4 shadow-lg`}>
                                        <h4 className="font-semibold mb-3 text-blue-400">Wall Style</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm mb-2">Color</label>
                                                <div className="flex items-center space-x-3">
                                                    <input
                                                        type="color"
                                                        value={wallColor}
                                                        onChange={(e) => setWallColor(e.target.value)}
                                                        className="w-16 h-16 rounded-lg cursor-pointer border-2 border-gray-600"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={wallColor}
                                                        onChange={(e) => setWallColor(e.target.value)}
                                                        className={`flex-1 px-3 py-2 ${darkMode ? 'bg-gray-600' : 'bg-white'} rounded-lg focus:ring-2 focus:ring-blue-500 outline-none`}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm mb-2">Texture</label>
                                                <select
                                                    value={wallTexture}
                                                    onChange={(e) => setWallTexture(e.target.value)}
                                                    className={`w-full px-3 py-2 ${darkMode ? 'bg-gray-600' : 'bg-white'} rounded-lg focus:ring-2 focus:ring-blue-500 outline-none`}
                                                >
                                                    <option value="solid">Solid Color</option>
                                                    <option value="brick">Brick Pattern</option>
                                                    <option value="stone">Stone Pattern</option>
                                                    <option value="concrete">Concrete</option>
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-4 gap-2 mt-4">
                                                {[
                                                    { color: '#F5F5DC', name: 'Beige' },
                                                    { color: '#FFFFFF', name: 'White' },
                                                    { color: '#D3D3D3', name: 'Gray' },
                                                    { color: '#8B7355', name: 'Brown' },
                                                    { color: '#CD853F', name: 'Tan' },
                                                    { color: '#696969', name: 'Dark' },
                                                    { color: '#BC8F8F', name: 'Rose' },
                                                    { color: '#A0522D', name: 'Sienna' },
                                                ].map((preset) => (
                                                    <button
                                                        key={preset.color}
                                                        onClick={() => setWallColor(preset.color)}
                                                        className="h-12 rounded-lg border-2 border-gray-600 hover:border-blue-500 transition-all"
                                                        style={{ backgroundColor: preset.color }}
                                                        title={preset.name}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`${darkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-blue-50 to-purple-50'} rounded-lg p-4 shadow-lg`}>
                                        <h4 className="font-semibold mb-3 text-blue-400">Visibility Controls</h4>
                                        <div className="space-y-3">
                                            <label className="flex items-center justify-between">
                                                <span className="text-sm">Show Floor Slabs</span>
                                                <button
                                                    onClick={() => setShowFloor(!showFloor)}
                                                    className={`p-2 rounded-lg transition-all ${showFloor ? 'bg-blue-600 text-white' : `${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}`}
                                                >
                                                    {showFloor ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                </button>
                                            </label>
                                            <label className="flex items-center justify-between">
                                                <span className="text-sm">Show Roof Slabs</span>
                                                <button
                                                    onClick={() => setShowRoof(!showRoof)}
                                                    className={`p-2 rounded-lg transition-all ${showRoof ? 'bg-blue-600 text-white' : `${darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}`}
                                                >
                                                    {showRoof ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                </button>
                                            </label>
                                        </div>
                                    </div>

                                    {buildingData && (
                                        <button
                                            onClick={() => {
                                                const updated = { ...buildingData, wallHeight, wallThickness };
                                                setBuildingData(updated);
                                                setSuccess('Settings applied successfully!');
                                            }}
                                            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg shadow-lg transition-all"
                                        >
                                            Apply Changes to Model
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* 3D View Tab */}
                            {activeTab === '3d-view' && buildingData && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold flex items-center space-x-2 text-green-400">
                                        <Layers className="w-5 h-5" />
                                        <span>Building Data</span>
                                    </h3>

                                    <div className={`${darkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-blue-50 to-purple-50'} rounded-lg p-4 shadow-lg`}>
                                        <h4 className="font-semibold mb-3 text-blue-400">Statistics</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-400">Total Floors</span>
                                                <span className="font-semibold text-blue-400">{buildingData.floors.length}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-400">Floor Height</span>
                                                <span className="font-semibold text-blue-400">{buildingData.wallHeight}m</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-400">Total Height</span>
                                                <span className="font-semibold text-blue-400">
                                                    {(buildingData.wallHeight * buildingData.floors.length + 0.25).toFixed(2)}m
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-400">Total Walls</span>
                                                <span className="font-semibold text-blue-400">
                                                    {buildingData.floors.reduce((sum, f) => sum + f.walls.length, 0)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-400">Doors</span>
                                                <span className="font-semibold text-blue-400">
                                                    {buildingData.floors.reduce((sum, f) => sum + f.doors.length, 0)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-400">Windows</span>
                                                <span className="font-semibold text-blue-400">
                                                    {buildingData.floors.reduce((sum, f) => sum + f.windows.length, 0)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-400">Rooms</span>
                                                <span className="font-semibold text-blue-400">
                                                    {buildingData.floors.reduce((sum, f) => sum + f.rooms.length, 0)}
                                                </span>
                                            </div>
                                            {buildingData.metadata && (
                                                <>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-gray-400">YOLO Used</span>
                                                        <span className={`font-semibold ${buildingData.metadata.used_yolo ? 'text-green-400' : 'text-yellow-400'}`}>
                                                            {buildingData.metadata.used_yolo ? 'Yes' : 'No'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-gray-400">Segmentation Used</span>
                                                        <span className={`font-semibold ${buildingData.metadata.used_segmentation ? 'text-green-400' : 'text-yellow-400'}`}>
                                                            {buildingData.metadata.used_segmentation ? 'Yes' : 'No'}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {buildingData.floors[0].rooms.length > 0 && (
                                        <div className={`${darkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-blue-50 to-purple-50'} rounded-lg p-4 shadow-lg`}>
                                            <h4 className="font-semibold mb-3 text-blue-400">Rooms (Floor 1)</h4>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {buildingData.floors[0].rooms.map((room, i) => (
                                                    <div key={i} className={`flex justify-between items-center py-2 border-b ${darkMode ? 'border-gray-600' : 'border-gray-300'} last:border-0`}>
                                                        <span className="text-sm">{room.name}</span>
                                                        <span className="text-xs text-gray-400">{room.area}m²</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className={`${darkMode ? 'bg-gradient-to-br from-blue-900 to-purple-900' : 'bg-gradient-to-br from-blue-100 to-purple-100'} rounded-lg p-4 shadow-lg`}>
                                        <h4 className="font-semibold mb-2 text-blue-300">3D Controls</h4>
                                        <ul className="text-sm space-y-1 text-blue-200">
                                            <li className="flex items-center space-x-2">
                                                <span className="w-24 text-gray-400">Rotate:</span>
                                                <span>Left Click + Drag</span>
                                            </li>
                                            <li className="flex items-center space-x-2">
                                                <span className="w-24 text-gray-400">Pan:</span>
                                                <span>Right Click + Drag</span>
                                            </li>
                                            <li className="flex items-center space-x-2">
                                                <span className="w-24 text-gray-400">Zoom:</span>
                                                <span>Mouse Wheel</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                {/* Main 3D Viewport */}
                <main className={`flex-1 ${darkMode ? 'bg-gradient-to-br from-gray-950 via-gray-900 to-black' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'} relative`}>
                    {buildingData ? (
                        <Canvas
                            shadows
                            camera={{ position: [15, 15, 15], fov: 50 }}
                            gl={{ antialias: true, alpha: false }}
                        >
                            <Suspense fallback={null}>
                                <Scene3D
                                    buildingData={buildingData}
                                    wallColor={wallColor}
                                    wallTexture={wallTexture}
                                    showFloor={showFloor}
                                    showRoof={showRoof}
                                    darkMode={darkMode}
                                />
                                <OrbitControls
                                    enableDamping
                                    dampingFactor={0.05}
                                    minDistance={5}
                                    maxDistance={150}
                                    maxPolarAngle={Math.PI / 2}
                                />
                            </Suspense>
                        </Canvas>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-full p-8 inline-block mb-6 shadow-2xl`}>
                                    <Home className={`w-24 h-24 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                                </div>
                                <h2 className={`text-3xl font-bold ${darkMode ? 'text-gray-500' : 'text-gray-600'} mb-3`}>No Building Model Loaded</h2>
                                <p className={`${darkMode ? 'text-gray-600' : 'text-gray-500'} mb-6`}>Upload a floor plan image or DXF file to start</p>
                                <div className="flex items-center justify-center space-x-4">
                                    <button
                                        onClick={() => setActiveTab('upload')}
                                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg shadow-lg transition-all"
                                    >
                                        Upload Floor Plan
                                    </button>
                                    <button
                                        onClick={loadSamplePlan}
                                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg shadow-lg transition-all"
                                    >
                                        Load Sample
                                    </button>
                                </div>
                                <div className={`mt-8 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 max-w-md mx-auto text-left shadow-lg`}>
                                    <h3 className="font-semibold text-blue-400 mb-3">🚀 Hybrid AI System</h3>
                                    <ul className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} space-y-1`}>
                                        <li>✓ OpenCV: Clean wall detection</li>
                                        <li>✓ YOLO: Doors, windows, rooms, stairs, columns</li>
                                        <li>✓ Segmentation: Advanced room identification</li>
                                        <li>✓ DXF: Professional CAD files</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Watermark */}
                    <div className={`absolute bottom-4 right-4 ${darkMode ? 'bg-black' : 'bg-white'} bg-opacity-50 px-4 py-2 rounded-lg backdrop-blur-sm`}>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>ArchCAD Pro 3D v2.0 - Hybrid</p>
                    </div>
                </main>
            </div>
        </div>
    );
}