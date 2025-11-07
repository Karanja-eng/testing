import React, { Suspense, useState, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { 
  Camera, 
  Grid3x3, 
  Ruler, 
  Eye, 
  EyeOff, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Move,
  Download,
  Printer,
  Settings,
  Layers,
  Box,
  Columns,
  Home,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Compass,
  Tag,
  Crosshair,
  Minimize2,
  Code
} from "lucide-react";
import * as THREE_CONST from "three";

// ============================================================================
// MATERIAL CONSTANTS AND COLORS
// ============================================================================

const DEFAULT_COLORS = {
  concrete: '#a8a8a8',
  concreteTransparent: '#a8a8a8',
  mainRebar: '#cc3333',
  stirrups: '#3366cc',
  distributionBars: '#cc8833',
  steel: '#778899',
  highlight: '#ffff00',
  lap: '#ff6600',
  hook: '#00ff00',
};

const DEFAULT_OPACITY = {
  concrete: 0.4,
  steel: 1.0,
};
// ============================================================================
// MEASUREMENT GRID COMPONENT (Fixed)
// ============================================================================

function MeasurementGrid({ size = 20, divisions = 20, visible = true, color1 = "#444444", color2 = "#888888" }) {
  const gridGeometry = React.useMemo(() => {
    if (!visible) return null;

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const halfSize = size / 2;
    const step = size / divisions;

    for (let i = 0; i <= divisions; i++) {
      const pos = -halfSize + i * step;
      vertices.push(-halfSize, 0, pos, halfSize, 0, pos);
      vertices.push(pos, 0, -halfSize, pos, 0, halfSize);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }, [size, divisions, visible]);

  const gridMaterial = React.useMemo(() => {
    if (!visible) return null;
    return new THREE.LineBasicMaterial({ color: color1, opacity: 0.3, transparent: true });
  }, [color1, visible]);

  if (!visible || !gridGeometry || !gridMaterial) return null;

  return <lineSegments geometry={gridGeometry} material={gridMaterial} />;
}


// ============================================================================
// CAMERA CONTROLLER COMPONENT
// ============================================================================

function CameraController({ viewMode, resetTrigger }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef();

  useEffect(() => {
    if (!camera) return;

    const distance = 10;
    
    switch (viewMode) {
      case 'perspective':
        camera.position.set(distance * 0.8, distance * 0.6, distance * 0.8);
        break;
      case 'top':
        camera.position.set(0, distance, 0);
        camera.up.set(0, 0, -1);
        break;
      case 'front':
        camera.position.set(0, 0, distance);
        camera.up.set(0, 1, 0);
        break;
      case 'back':
        camera.position.set(0, 0, -distance);
        camera.up.set(0, 1, 0);
        break;
      case 'left':
        camera.position.set(-distance, 0, 0);
        camera.up.set(0, 1, 0);
        break;
      case 'right':
        camera.position.set(distance, 0, 0);
        camera.up.set(0, 1, 0);
        break;
      case 'bottom':
        camera.position.set(0, -distance, 0);
        camera.up.set(0, 0, 1);
        break;
      default:
        break;
    }
    
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [viewMode, camera]);

  useEffect(() => {
    if (resetTrigger && controlsRef.current) {
      controlsRef.current.reset();
    }
  }, [resetTrigger]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping={true}
      dampingFactor={0.05}
      enableZoom={true}
      enablePan={true}
      enableRotate={true}
      minDistance={2}
      maxDistance={100}
      mouseButtons={{
        LEFT: THREE_CONST.MOUSE.ROTATE,
        MIDDLE: THREE_CONST.MOUSE.DOLLY,
        RIGHT: THREE_CONST.MOUSE.PAN
      }}
      touches={{
        ONE: THREE_CONST.TOUCH.ROTATE,
        TWO: THREE_CONST.TOUCH.DOLLY_PAN
      }}
    />
  );
}

// ============================================================================
// AXIS HELPER COMPONENT
// ============================================================================

function AxisHelper({ size = 2, showLabels = true }) {
  return (
    <group>
      {/* X Axis - Red */}
      <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), size, 0xff0000, size * 0.2, size * 0.1]} />
      {/* Y Axis - Green */}
      <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), size, 0x00ff00, size * 0.2, size * 0.1]} />
      {/* Z Axis - Blue */}
      <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), size, 0x0000ff, size * 0.2, size * 0.1]} />
    </group>
  );
}



// ============================================================================
// SAMPLE BEAM COMPONENT (Example)
// ============================================================================

function SampleBeam({ colors, showConcrete, showRebar }) {
  const span = 5.0;
  const width = 0.3;
  const depth = 0.5;
  const cover = 0.025;
  const barDiameter = 0.020;

  const concreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(width, depth, span),
    [width, depth, span]
  );

  const concreteMaterial = React.useMemo(
    () => new THREE.MeshStandardMaterial({ 
      color: colors.concrete, 
      transparent: true, 
      opacity: DEFAULT_OPACITY.concrete 
    }),
    [colors.concrete]
  );

  const barGeometry = React.useMemo(
    () => new THREE.CylinderGeometry(barDiameter / 2, barDiameter / 2, span, 16),
    [barDiameter, span]
  );

  const barMaterial = React.useMemo(
    () => new THREE.MeshStandardMaterial({ color: colors.mainRebar, metalness: 0.7, roughness: 0.3 }),
    [colors.mainRebar]
  );

  return (
    <group>
      {showConcrete && <mesh geometry={concreteGeometry} material={concreteMaterial} />}
      {showRebar && (
        <>
          {[-0.1, 0.1].map((x, i) => (
            <mesh
              key={`bottom-${i}`}
              geometry={barGeometry}
              material={barMaterial}
              position={[x, -depth / 2 + cover + barDiameter / 2, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          ))}
        </>
      )}
    </group>
  );
}

// ============================================================================
// SAMPLE COLUMN COMPONENT (Example)
// ============================================================================

function SampleColumn({ colors, showConcrete, showRebar }) {
  const width = 0.4;
  const height = 3.0;
  const cover = 0.030;
  const barDiameter = 0.020;

  const concreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(width, width, height),
    [width, height]
  );

  const concreteMaterial = React.useMemo(
    () => new THREE.MeshStandardMaterial({ 
      color: colors.concrete, 
      transparent: true, 
      opacity: DEFAULT_OPACITY.concrete 
    }),
    [colors.concrete]
  );

  const barGeometry = React.useMemo(
    () => new THREE.CylinderGeometry(barDiameter / 2, barDiameter / 2, height, 16),
    [barDiameter, height]
  );

  const barMaterial = React.useMemo(
    () => new THREE.MeshStandardMaterial({ color: colors.mainRebar, metalness: 0.7, roughness: 0.3 }),
    [colors.mainRebar]
  );

  const offset = width / 2 - cover - barDiameter / 2;

  return (
    <group>
      {showConcrete && <mesh geometry={concreteGeometry} material={concreteMaterial} rotation={[Math.PI / 2, 0, 0]} />}
      {showRebar && (
        <>
          {[
            [-offset, -offset],
            [offset, -offset],
            [offset, offset],
            [-offset, offset]
          ].map(([x, y], i) => (
            <mesh
              key={`bar-${i}`}
              geometry={barGeometry}
              material={barMaterial}
              position={[x, y, 0]}
            />
          ))}
        </>
      )}
    </group>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StructuralVisualizationComponent({ 
  theme = 'dark',
  initialMemberType = 'beam',
  onExport,
  onPrint,
  onMeasure
}) {
  // ========== STATE MANAGEMENT ==========
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [viewMode, setViewMode] = useState('perspective');
  const [resetTrigger, setResetTrigger] = useState(0);
  
  // Display controls
  const [showConcrete, setShowConcrete] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showAxis, setShowAxis] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(false);
  
  // Member and colors
  const [memberType, setMemberType] = useState(initialMemberType);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  
  // Rendering options
  const [wireframe, setWireframe] = useState(false);
  const [shadows, setShadows] = useState(true);
  const [antialiasing, setAntialiasing] = useState(true);
  
  // Measurement mode
  const [measurementMode, setMeasurementMode] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  
  // View settings
  const [backgroundColor, setBackgroundColor] = useState(theme === 'dark' ? '#0a0a0a' : '#f5f5f5');
  const [ambientIntensity, setAmbientIntensity] = useState(0.5);
  const [directionalIntensity, setDirectionalIntensity] = useState(1.0);

  // ========== THEME ADAPTATION ==========
  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-gray-900' : 'bg-gray-100';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-300';
  const hoverBg = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200';
  const activeBg = isDark ? 'bg-gray-700' : 'bg-gray-300';

  // ========== HANDLERS ==========
  const handleResetView = () => {
    setViewMode('perspective');
    setResetTrigger(prev => prev + 1);
  };

  const handleColorChange = (key, value) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = (format) => {
    if (onExport) {
      onExport(format);
    } else {
      console.log(`Exporting as ${format}...`);
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      console.log('Printing...');
    }
  };

  const toggleMeasurement = () => {
    setMeasurementMode(!measurementMode);
    if (onMeasure) {
      onMeasure(!measurementMode);
    }
  };

  // ========== VIEW MODES ==========
  const viewModes = [
    { id: 'perspective', name: '3D', icon: Box },
    { id: 'top', name: 'Top', icon: Compass },
    { id: 'front', name: 'Front', icon: Columns },
    { id: 'back', name: 'Back', icon: Columns },
    { id: 'left', name: 'Left', icon: Columns },
    { id: 'right', name: 'Right', icon: Columns },
  ];

  // ========== RENDER ==========
  return (
    <div className={`w-full h-screen flex ${bgClass} ${textPrimary}`}>
      {/* ==================== LEFT SIDEBAR ==================== */}
      <div 
        className={`${cardBg} border-r ${borderColor} transition-all duration-300 flex flex-col ${
          sidebarOpen ? 'w-80' : 'w-0'
        } overflow-hidden`}
      >
        {sidebarOpen && (
          <>
            {/* Sidebar Header */}
            <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
              <div className="flex items-center space-x-2">
                <Box className="w-6 h-6 text-blue-500" />
                <h2 className="text-lg font-bold">Visualization</h2>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className={`p-1 rounded ${hoverBg}`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Member Type Section */}
              <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                  <Layers className="w-4 h-4 mr-2" />
                  Member Type
                </h3>
                <div className="space-y-2">
                  {['beam', 'column', 'slab', 'foundation'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setMemberType(type)}
                      className={`w-full px-3 py-2 rounded text-left text-sm ${
                        memberType === type 
                          ? 'bg-blue-600 text-white' 
                          : `${hoverBg} ${textSecondary}`
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </section>

              {/* Visibility Controls */}
              <section className={`p-3 rounded ${isDark ? 'bg-gray-750' : 'bg-gray-50'}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                  <Eye className="w-4 h-4 mr-2" />
                  Display Options
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Concrete</span>
                    <input 
                      type="checkbox" 
                      checked={showConcrete}
                      onChange={(e) => setShowConcrete(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Reinforcement</span>
                    <input 
                      type="checkbox" 
                      checked={showRebar}
                      onChange={(e) => setShowRebar(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Grid</span>
                    <input 
                      type="checkbox" 
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Axis</span>
                    <input 
                      type="checkbox" 
                      checked={showAxis}
                      onChange={(e) => setShowAxis(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Dimensions</span>
                    <input 
                      type="checkbox" 
                      checked={showDimensions}
                      onChange={(e) => setShowDimensions(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Annotations</span>
                    <input 
                      type="checkbox" 
                      checked={showAnnotations}
                      onChange={(e) => setShowAnnotations(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                </div>
              </section>

              {/* Color Customization */}
              <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                  <Tag className="w-4 h-4 mr-2" />
                  Material Colors
                </h3>
                <div className="space-y-3">
                  {Object.entries(colors).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <label className="text-xs capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="w-10 h-8 rounded cursor-pointer border border-gray-600"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Rendering Options */}
              <section className={`p-3 rounded ${isDark ? 'bg-gray-750' : 'bg-gray-50'}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  Rendering
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Wireframe</span>
                    <input 
                      type="checkbox" 
                      checked={wireframe}
                      onChange={(e) => setWireframe(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Shadows</span>
                    <input 
                      type="checkbox" 
                      checked={shadows}
                      onChange={(e) => setShadows(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Anti-aliasing</span>
                    <input 
                      type="checkbox" 
                      checked={antialiasing}
                      onChange={(e) => setAntialiasing(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Snap to Grid</span>
                    <input 
                      type="checkbox" 
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                </div>
              </section>

              {/* Lighting Controls */}
              <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                  <Sun className="w-4 h-4 mr-2" />
                  Lighting
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs block mb-1">Ambient: {ambientIntensity.toFixed(2)}</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={ambientIntensity}
                      onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1">Directional: {directionalIntensity.toFixed(2)}</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={directionalIntensity}
                      onChange={(e) => setDirectionalIntensity(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </section>

              {/* Color Legend */}
              <section className={`p-3 rounded ${isDark ? 'bg-blue-900 bg-opacity-20' : 'bg-blue-50'}`}>
                <h3 className="text-sm font-semibold mb-2">Color Legend</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded mr-2" style={{backgroundColor: colors.mainRebar}}></div>
                    <span>Main Reinforcement</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded mr-2" style={{backgroundColor: colors.stirrups}}></div>
                    <span>Stirrups/Links</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded mr-2" style={{backgroundColor: colors.distributionBars}}></div>
                    <span>Distribution Bars</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded mr-2 border" style={{backgroundColor: colors.concrete}}></div>
                    <span>Concrete</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Sidebar Footer */}
            <div className={`p-3 border-t ${borderColor} text-xs ${textSecondary}`}>
              <p className="flex items-center">
                <Code className="w-3 h-3 mr-1" />
                Version 1.0.0
              </p>
            </div>
          </>
        )}
      </div>

      {/* Sidebar Toggle (when closed) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className={`absolute left-0 top-1/2 -translate-y-1/2 ${cardBg} border ${borderColor} p-2 rounded-r-lg shadow-lg z-10 ${hoverBg}`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* ==================== MAIN VIEWPORT ==================== */}
      <div className="flex-1 flex flex-col relative">
        {/* Top Toolbar */}
        <div className={`${cardBg} border-b ${borderColor} px-4 py-2 flex items-center justify-between`}>
          {/* Left Section - View Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetView}
              className={`p-2 rounded ${hoverBg} flex items-center space-x-1`}
              title="Reset View"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm">Reset</span>
            </button>
            
            <div className={`h-6 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

            <button
              onClick={toggleMeasurement}
              className={`p-2 rounded ${measurementMode ? activeBg : hoverBg} flex items-center space-x-1`}
              title="Measurement Mode"
            >
              <Ruler className="w-4 h-4" />
              <span className="text-sm">Measure</span>
            </button>

            <button
              className={`p-2 rounded ${hoverBg}`}
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              className={`p-2 rounded ${hoverBg}`}
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              className={`p-2 rounded ${hoverBg}`}
              title="Zoom Extents"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Center Section - Member Info */}
          <div className="flex items-center space-x-3">
            <div className={`px-3 py-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'} text-sm font-medium`}>
              {memberType.charAt(0).toUpperCase() + memberType.slice(1)}
            </div>
            <div className={`text-sm ${textSecondary}`}>
              View: {viewModes.find(v => v.id === viewMode)?.name}
            </div>
          </div>

          {/* Right Section - Export Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('pdf')}
              className={`p-2 rounded ${hoverBg}`}
              title="Export PDF"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handlePrint}
              className={`p-2 rounded ${hoverBg}`}
              title="Print"
            >
              <Printer className="w-4 h-4" />
            </button>

            <div className={`h-6 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

            <button
              onClick={() => setPropertiesOpen(!propertiesOpen)}
              className={`p-2 rounded ${hoverBg}`}
              title="Properties"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div className="flex-1 relative" style={{ backgroundColor }}>
          <Canvas
            camera={{ position: [8, 6, 8], fov: 50 }}
            gl={{ antialias: antialiasing, preserveDrawingBuffer: true }}
            shadows={shadows}
          >
            <Suspense fallback={null}>
              {/* Lighting */}
              <ambientLight intensity={ambientIntensity} />
              <directionalLight 
                position={[10, 10, 5]} 
                intensity={directionalIntensity}
                castShadow={shadows}
              />
              <directionalLight position={[-10, 10, -5]} intensity={directionalIntensity * 0.6} />
              <directionalLight position={[0, -10, 0]} intensity={directionalIntensity * 0.3} />
              <hemisphereLight args={['#ffffff', '#444444', 0.4]} />

              {/* Grid */}
              {showGrid && (
                <MeasurementGrid 
                  size={20} 
                  divisions={20} 
                  visible={showGrid}
                  color1={isDark ? "#444444" : "#cccccc"}
                  color2={isDark ? "#888888" : "#999999"}
                />
              )}

              {/* Axis */}
              {showAxis && <AxisHelper size={2} showLabels={true} />}

              {/* Render Sample Members */}
              {memberType === 'beam' && (
                <SampleBeam colors={colors} showConcrete={showConcrete} showRebar={showRebar} />
              )}
              {memberType === 'column' && (
                <SampleColumn colors={colors} showConcrete={showConcrete} showRebar={showRebar} />
              )}

              {/* Camera Controller */}
              <CameraController viewMode={viewMode} resetTrigger={resetTrigger} />
            </Suspense>
          </Canvas>

          {/* View Cube - Top Right Corner */}
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            <div className={`${cardBg} border ${borderColor} rounded-lg shadow-lg p-2`}>
              <div className="grid grid-cols-3 gap-1">
                {/* Top Row */}
                <div className="col-span-3 flex justify-center mb-1">
                  <button
                    onClick={() => setViewMode('top')}
                    className={`px-3 py-1.5 rounded text-xs font-medium ${
                      viewMode === 'top' ? 'bg-blue-600 text-white' : `${hoverBg} ${textSecondary}`
                    }`}
                    title="Top View (Plan)"
                  >
                    TOP
                  </button>
                </div>

                {/* Middle Row */}
                <button
                  onClick={() => setViewMode('left')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    viewMode === 'left' ? 'bg-blue-600 text-white' : `${hoverBg} ${textSecondary}`
                  }`}
                  title="Left Elevation"
                >
                  L
                </button>
                
                <button
                  onClick={() => setViewMode('front')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    viewMode === 'front' ? 'bg-blue-600 text-white' : `${hoverBg} ${textSecondary}`
                  }`}
                  title="Front Elevation"
                >
                  F
                </button>
                
                <button
                  onClick={() => setViewMode('right')}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    viewMode === 'right' ? 'bg-blue-600 text-white' : `${hoverBg} ${textSecondary}`
                  }`}
                  title="Right Elevation"
                >
                  R
                </button>

                {/* Bottom Row */}
                <div className="col-span-3 flex justify-center mt-1">
                  <button
                    onClick={() => setViewMode('back')}
                    className={`px-3 py-1.5 rounded text-xs font-medium ${
                      viewMode === 'back' ? 'bg-blue-600 text-white' : `${hoverBg} ${textSecondary}`
                    }`}
                    title="Back Elevation"
                  >
                    BACK
                  </button>
                </div>

                {/* 3D View Button */}
                <div className="col-span-3 mt-2 pt-2 border-t border-gray-600">
                  <button
                    onClick={() => setViewMode('perspective')}
                    className={`w-full px-3 py-1.5 rounded text-xs font-medium flex items-center justify-center space-x-1 ${
                      viewMode === 'perspective' ? 'bg-blue-600 text-white' : `${hoverBg} ${textSecondary}`
                    }`}
                    title="3D Perspective"
                  >
                    <Box className="w-3 h-3" />
                    <span>3D</span>
                  </button>
                </div>
              </div>

              {/* Compass Rose Indicator */}
              <div className="mt-3 pt-2 border-t border-gray-600 flex justify-center">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Compass className="w-10 h-10 text-blue-500 opacity-30" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 text-xs font-bold text-red-500">N</div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs font-bold opacity-50">S</div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold opacity-50">E</div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-xs font-bold opacity-50">W</div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Bar - Bottom */}
          <div className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-4 py-2 flex items-center justify-between text-xs`}>
            {/* Left - Coordinate Display */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Crosshair className="w-3 h-3" />
                <span className={textSecondary}>X: 0.00</span>
                <span className={textSecondary}>Y: 0.00</span>
                <span className={textSecondary}>Z: 0.00</span>
              </div>
              {measurementMode && (
                <div className={`px-2 py-1 rounded ${isDark ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-800'}`}>
                  Measurement Mode Active
                </div>
              )}
            </div>

            {/* Center - Active Tool */}
            <div className="flex items-center space-x-4">
              <span className={textSecondary}>Scale: 1:100</span>
              {snapToGrid && (
                <div className="flex items-center space-x-1">
                  <Grid3x3 className="w-3 h-3" />
                  <span>Snap: ON</span>
                </div>
              )}
            </div>

            {/* Right - View Info */}
            <div className="flex items-center space-x-3">
              <span className={textSecondary}>Units: m</span>
              <span className={textSecondary}>
                {showConcrete && 'Concrete'} {showConcrete && showRebar && '+'} {showRebar && 'Rebar'}
              </span>
              <span className={`font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>Ready</span>
            </div>
          </div>

          {/* Floating Action Buttons - Left Side */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col space-y-2">
            <button
              className={`${cardBg} border ${borderColor} p-2 rounded-lg shadow-lg ${hoverBg}`}
              title="Pan View"
            >
              <Move className="w-5 h-5" />
            </button>
            <button
              className={`${cardBg} border ${borderColor} p-2 rounded-lg shadow-lg ${hoverBg}`}
              title="Rotate View"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`${cardBg} border ${borderColor} p-2 rounded-lg shadow-lg ${showGrid ? activeBg : hoverBg}`}
              title="Toggle Grid"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>

          {/* Measurement Tools Overlay */}
          {measurementMode && (
            <div className={`absolute top-20 left-1/2 -translate-x-1/2 ${cardBg} border ${borderColor} rounded-lg shadow-lg p-4`}>
              <div className="flex items-center space-x-3 mb-3">
                <Ruler className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold">Measurement Tools</h3>
                <button
                  onClick={() => setMeasurementMode(false)}
                  className={`ml-auto p-1 rounded ${hoverBg}`}
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <button className={`px-3 py-2 rounded ${hoverBg} text-left`}>
                  Linear Distance
                </button>
                <button className={`px-3 py-2 rounded ${hoverBg} text-left`}>
                  Angular
                </button>
                <button className={`px-3 py-2 rounded ${hoverBg} text-left`}>
                  Area
                </button>
                <button className={`px-3 py-2 rounded ${hoverBg} text-left`}>
                  Volume
                </button>
              </div>
              <div className={`mt-3 pt-3 border-t ${borderColor} text-xs ${textSecondary}`}>
                Click two points to measure distance
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== RIGHT PROPERTIES PANEL ==================== */}
      <div 
        className={`${cardBg} border-l ${borderColor} transition-all duration-300 flex flex-col ${
          propertiesOpen ? 'w-72' : 'w-0'
        } overflow-hidden`}
      >
        {propertiesOpen && (
          <>
            {/* Properties Header */}
            <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-bold">Properties</h2>
              </div>
              <button
                onClick={() => setPropertiesOpen(false)}
                className={`p-1 rounded ${hoverBg}`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Properties Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Object Information */}
              <section>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide">Object Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={textSecondary}>Type:</span>
                    <span className="font-medium capitalize">{memberType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>ID:</span>
                    <span className="font-medium">#{Math.floor(Math.random() * 10000)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Material:</span>
                    <span className="font-medium">Concrete C30/37</span>
                  </div>
                </div>
              </section>

              {/* Dimensions Section */}
              <section className={`p-3 rounded ${isDark ? 'bg-gray-750' : 'bg-gray-50'}`}>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide">Dimensions</h3>
                {memberType === 'beam' && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Span:</span>
                      <span className="font-medium">5.00 m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Width:</span>
                      <span className="font-medium">300 mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Depth:</span>
                      <span className="font-medium">500 mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Cover:</span>
                      <span className="font-medium">25 mm</span>
                    </div>
                  </div>
                )}
                {memberType === 'column' && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Height:</span>
                      <span className="font-medium">3.00 m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Width:</span>
                      <span className="font-medium">400 mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Depth:</span>
                      <span className="font-medium">400 mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Cover:</span>
                      <span className="font-medium">30 mm</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Reinforcement Details */}
              <section>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide">Reinforcement</h3>
                {memberType === 'beam' && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Bottom:</span>
                      <span className="font-medium">4T20</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Top:</span>
                      <span className="font-medium">2T16</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Stirrups:</span>
                      <span className="font-medium">T10 @ 150</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Steel Grade:</span>
                      <span className="font-medium">B500B</span>
                    </div>
                  </div>
                )}
                {memberType === 'column' && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Longitudinal:</span>
                      <span className="font-medium">8T20</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Links:</span>
                      <span className="font-medium">T10 @ 200</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Steel Grade:</span>
                      <span className="font-medium">B500B</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Material Properties */}
              <section className={`p-3 rounded ${isDark ? 'bg-gray-750' : 'bg-gray-50'}`}>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide">Materials</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={textSecondary}>Concrete:</span>
                    <span className="font-medium">C30/37</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>fck:</span>
                    <span className="font-medium">30 MPa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Steel:</span>
                    <span className="font-medium">B500B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>fyk:</span>
                    <span className="font-medium">500 MPa</span>
                  </div>
                </div>
              </section>

              {/* Code Compliance */}
              <section>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide">Code Compliance</h3>
                <div className="space-y-2">
                  <div className={`flex items-center justify-between p-2 rounded ${isDark ? 'bg-green-900 bg-opacity-20' : 'bg-green-50'}`}>
                    <span className="text-xs">Min. Cover</span>
                    <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>✓ Pass</span>
                  </div>
                  <div className={`flex items-center justify-between p-2 rounded ${isDark ? 'bg-green-900 bg-opacity-20' : 'bg-green-50'}`}>
                    <span className="text-xs">Bar Spacing</span>
                    <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>✓ Pass</span>
                  </div>
                  <div className={`flex items-center justify-between p-2 rounded ${isDark ? 'bg-green-900 bg-opacity-20' : 'bg-green-50'}`}>
                    <span className="text-xs">Link Spacing</span>
                    <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>✓ Pass</span>
                  </div>
                </div>
              </section>

              {/* Quantities */}
              <section className={`p-3 rounded ${isDark ? 'bg-gray-750' : 'bg-gray-50'}`}>
                <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide">Quantities</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={textSecondary}>Concrete:</span>
                    <span className="font-medium">0.75 m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Steel:</span>
                    <span className="font-medium">45.2 kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Formwork:</span>
                    <span className="font-medium">8.0 m²</span>
                  </div>
                </div>
              </section>

              {/* Notes Section */}
              <section>
                <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide">Notes</h3>
                <textarea
                  className={`w-full p-2 text-xs rounded border ${borderColor} ${isDark ? 'bg-gray-700' : 'bg-white'} resize-none`}
                  rows="3"
                  placeholder="Add notes or comments..."
                />
              </section>
            </div>

            {/* Properties Footer */}
            <div className={`p-3 border-t ${borderColor}`}>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors">
                Apply Changes
              </button>
            </div>
          </>
        )}
      </div>

      {/* Properties Toggle (when closed) */}
      {!propertiesOpen && (
        <button
          onClick={() => setPropertiesOpen(true)}
          className={`absolute right-0 top-1/2 -translate-y-1/2 ${cardBg} border ${borderColor} p-2 rounded-l-lg shadow-lg z-10 ${hoverBg}`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Keyboard Shortcuts Overlay (Optional) */}
      {/* Can be toggled with a help button */}
      
    </div>
  );
}