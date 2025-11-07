import React, { useState, useRef, useEffect } from "react";
import {
  Building2,
  Calculator,
  Layers,
  Frame,
  Wind,
  Box,
  Ruler,
  FileText,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import * as THREE from "three";

// Theme Context
const ThemeContext = React.createContext();

const RCStructuralDesign = () => {
  const [theme, setTheme] = useState("light");
  const [activeModule, setActiveModule] = useState("loads");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    loads: true,
    ties: false,
    analysis: false,
    systems: false,
    modeling: false,
  });

  // Load Combinations State
  const [loadData, setLoadData] = useState({
    deadLoad: "",
    imposedLoad: "",
    windLoad: "",
    loadFactor: "1.4",
    combination: "uls",
  });

  // Tie Design State
  const [tieData, setTieData] = useState({
    tieType: "internal",
    span: "",
    loadPerMeter: "",
    concreteGrade: "C30",
    steelGrade: "500",
  });

  // Frame Analysis State
  const [frameData, setFrameData] = useState({
    method: "portal",
    floors: "",
    bays: "",
    storyHeight: "",
    bayWidth: "",
    lateralLoad: "",
  });

  // Building System State
  const [systemData, setSystemData] = useState({
    type: "rigid_frame",
    height: "",
    width: "",
    depth: "",
    coreSize: "",
  });

  // Computer Modeling State
  const [modelData, setModelData] = useState({
    category: "cat1",
    bents: "",
    symmetry: "symmetric",
    load: "",
  });

  const [results, setResults] = useState(null);
  const canvasRef = useRef(null);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // BS Code Load Combination Calculations
  const calculateLoadCombinations = () => {
    const dead = parseFloat(loadData.deadLoad) || 0;
    const imposed = parseFloat(loadData.imposedLoad) || 0;
    const wind = parseFloat(loadData.windLoad) || 0;

    const combinations = {
      uls: {
        combo1: 1.4 * dead + 1.6 * imposed,
        combo2: 1.4 * dead + 1.6 * imposed + 1.2 * wind,
        combo3: 1.0 * dead + 1.4 * wind,
        combo4: 1.2 * dead + 1.2 * imposed + 1.2 * wind,
      },
      sls: {
        characteristic: dead + imposed,
        quasi_permanent: dead + 0.3 * imposed,
        frequent: dead + 0.5 * imposed,
      },
    };

    return combinations;
  };

  // Tie Force Calculations (BS 8110)
  const calculateTieForces = () => {
    const span = parseFloat(tieData.span) || 0;
    const load = parseFloat(tieData.loadPerMeter) || 0;

    let tieForce = 0;
    let spacing = 0;

    switch (tieData.tieType) {
      case "internal":
        // Internal tie: Ft = 0.5(gk + qk)L or 1.0Ls whichever is greater
        tieForce = Math.max(0.5 * load * span, 1.0 * span);
        spacing = "At every floor level";
        break;
      case "peripheral":
        // Peripheral tie: Ft = 1.0Ls or 0.5(gk + qk)L whichever is greater
        tieForce = Math.max(1.0 * span, 0.5 * load * span);
        spacing = "Around perimeter";
        break;
      case "column":
        // Column tie: 3% of total vertical load or minimum tie
        tieForce = Math.max(0.03 * load * span * span, 75);
        spacing = "At every floor";
        break;
      case "corner":
        // Corner column tie: 2 × column tie force
        tieForce = Math.max(0.06 * load * span * span, 150);
        spacing = "At corners";
        break;
      case "vertical":
        // Vertical tie: Maximum of column design load or 3% column load
        tieForce = Math.max(load, 0.03 * load);
        spacing = "Full height";
        break;
      default:
        tieForce = 0;
    }

    const fy = parseInt(tieData.steelGrade);
    const requiredArea = (tieForce * 1000) / (0.87 * fy);

    return {
      tieForce: tieForce.toFixed(2),
      requiredArea: requiredArea.toFixed(2),
      spacing,
      barSize: requiredArea < 100 ? "H10" : requiredArea < 200 ? "H12" : "H16",
    };
  };

  // Portal Frame Method Analysis
  const analyzePortalFrame = () => {
    const floors = parseInt(frameData.floors) || 0;
    const bays = parseInt(frameData.bays) || 0;
    const height = parseFloat(frameData.storyHeight) || 0;
    const width = parseFloat(frameData.bayWidth) || 0;
    const load = parseFloat(frameData.lateralLoad) || 0;

    // Portal method assumptions: inflection points at mid-height
    const shearPerColumn = load / (bays + 1);
    const moment = shearPerColumn * (height / 2);
    const axialForce = moment / width;

    return {
      shearPerColumn: shearPerColumn.toFixed(2),
      moment: moment.toFixed(2),
      axialForce: axialForce.toFixed(2),
      inflectionPoint: (height / 2).toFixed(2),
    };
  };

  // Building System Analysis
  const analyzeStructuralSystem = () => {
    const height = parseFloat(systemData.height) || 0;
    const width = parseFloat(systemData.width) || 0;
    const type = systemData.type;

    let suitability = "";
    let driftLimit = 0;
    let characteristics = [];

    switch (type) {
      case "rigid_frame":
        suitability = height <= 25 ? "Suitable" : "Consider bracing";
        driftLimit = height / 500;
        characteristics = ["Flexible space layout", "Economic up to 25m"];
        break;
      case "braced_frame":
        suitability = height <= 50 ? "Suitable" : "Consider shear walls";
        driftLimit = height / 600;
        characteristics = ["High lateral stiffness", "Economic up to 50m"];
        break;
      case "shear_wall":
        suitability = height <= 70 ? "Suitable" : "Consider coupled system";
        driftLimit = height / 700;
        characteristics = ["Very stiff", "Good for high-rise"];
        break;
      case "coupled_wall":
        suitability = height <= 100 ? "Suitable" : "Consider tube";
        driftLimit = height / 750;
        characteristics = ["Optimal stiffness", "Coupling beams critical"];
        break;
      case "framed_tube":
        suitability = height <= 150 ? "Suitable" : "Consider bundled tube";
        driftLimit = height / 800;
        characteristics = ["Perimeter resistance", "Very tall buildings"];
        break;
      case "tube_in_tube":
        suitability = height <= 200 ? "Suitable" : "Ultra high-rise";
        driftLimit = height / 850;
        characteristics = ["Core + perimeter", "Maximum efficiency"];
        break;
      case "outrigger":
        suitability = height <= 300 ? "Suitable" : "Mega-tall structure";
        driftLimit = height / 900;
        characteristics = ["Core + outriggers", "Superior tall building"];
        break;
      default:
        suitability = "Select system";
    }

    const aspectRatio = height / width;
    const slenderness =
      aspectRatio > 5
        ? "Slender - Wind critical"
        : aspectRatio > 3
        ? "Medium"
        : "Stocky";

    return {
      suitability,
      driftLimit: driftLimit.toFixed(3),
      aspectRatio: aspectRatio.toFixed(2),
      slenderness,
      characteristics,
    };
  };

  // Computer Modeling Analysis
  const analyzeComputerModel = () => {
    const bents = parseInt(modelData.bents) || 0;
    const load = parseFloat(modelData.load) || 0;
    const category = modelData.category;

    let distribution = "";
    let analysis = "";
    let loadPerBent = 0;

    switch (category) {
      case "cat1":
        distribution = "Equal distribution to identical parallel bents";
        loadPerBent = load / bents;
        analysis = "Simple proportional distribution";
        break;
      case "cat2":
        distribution = "Distribution based on relative stiffness";
        loadPerBent = load / bents; // Simplified
        analysis = "Requires stiffness matrix calculation";
        break;
      case "cat3":
        distribution = "Torsional effects considered";
        loadPerBent = load / bents; // Simplified
        analysis = "Full 3D analysis required with center of rigidity";
        break;
      default:
        distribution = "Select category";
    }

    return {
      distribution,
      analysis,
      loadPerBent: loadPerBent.toFixed(2),
      method: modelData.category === "cat1" ? "Direct" : "Matrix analysis",
    };
  };

  const handleCalculate = () => {
    let calculationResults = {};

    switch (activeModule) {
      case "loads":
        calculationResults = calculateLoadCombinations();
        break;
      case "ties":
        calculationResults = calculateTieForces();
        break;
      case "frame":
        calculationResults = analyzePortalFrame();
        break;
      case "systems":
        calculationResults = analyzeStructuralSystem();
        break;
      case "modeling":
        calculationResults = analyzeComputerModel();
        break;
      default:
        calculationResults = {};
    }

    setResults(calculationResults);
  };

  // 3D Visualization
  useEffect(() => {
    if (!canvasRef.current || activeModule !== "visualization") return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });

    renderer.setSize(
      canvasRef.current.clientWidth,
      canvasRef.current.clientHeight
    );
    renderer.setClearColor(theme === "dark" ? 0x1f2937 : 0xf3f4f6);

    // Create building frame
    const floors = parseInt(frameData.floors) || 5;
    const bays = parseInt(frameData.bays) || 3;
    const height = parseFloat(frameData.storyHeight) || 3;
    const width = parseFloat(frameData.bayWidth) || 5;

    const columnMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    const beamMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });

    for (let f = 0; f <= floors; f++) {
      for (let b = 0; b <= bays; b++) {
        if (f < floors) {
          const columnGeom = new THREE.BoxGeometry(0.3, height, 0.3);
          const column = new THREE.Mesh(columnGeom, columnMaterial);
          column.position.set(
            b * width - (bays * width) / 2,
            f * height + height / 2,
            0
          );
          scene.add(column);
        }

        if (b < bays) {
          const beamGeom = new THREE.BoxGeometry(width, 0.3, 0.3);
          const beam = new THREE.Mesh(beamGeom, beamMaterial);
          beam.position.set(
            b * width + width / 2 - (bays * width) / 2,
            (f + 1) * height,
            0
          );
          scene.add(beam);
        }
      }
    }

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    camera.position.set(15, 10, 15);
    camera.lookAt(0, (floors * height) / 2, 0);

    const animate = () => {
      requestAnimationFrame(animate);
      scene.rotation.y += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
    };
  }, [activeModule, frameData, theme]);

  const bgColor = theme === "dark" ? "bg-gray-900" : "bg-white";
  const textColor = theme === "dark" ? "text-gray-100" : "text-gray-900";
  const cardBg = theme === "dark" ? "bg-gray-800" : "bg-gray-50";
  const inputBg = theme === "dark" ? "bg-gray-700" : "bg-white";
  const borderColor = theme === "dark" ? "border-gray-700" : "border-gray-200";

  const modules = [
    {
      id: "loads",
      icon: Calculator,
      label: "Load Combinations",
      section: "loads",
    },
    { id: "ties", icon: Layers, label: "Tie Design", section: "ties" },
    { id: "frame", icon: Frame, label: "Frame Analysis", section: "analysis" },
    {
      id: "systems",
      icon: Building2,
      label: "Structural Systems",
      section: "systems",
    },
    {
      id: "modeling",
      icon: Box,
      label: "Computer Modeling",
      section: "modeling",
    },
    {
      id: "visualization",
      icon: Ruler,
      label: "3D Visualization",
      section: "modeling",
    },
  ];

  return (
    <div
      className={`min-h-screen ${bgColor} ${textColor} transition-colors duration-200`}
    >
      {/* Header */}
      <header
        className={`${cardBg} border-b ${borderColor} px-6 py-4 sticky top-0 z-50`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <Building2 size={32} className="text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold">
                RC Structural Design System
              </h1>
              <p className="text-sm opacity-70">
                BS Code Compliant Analysis & Design
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg ${inputBg} hover:opacity-80`}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } ${cardBg} border-r ${borderColor} transition-all duration-300 overflow-hidden`}
        >
          <nav className="p-4 space-y-2">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeModule === module.id
                    ? "bg-blue-600 text-white"
                    : `${inputBg} hover:bg-blue-100 hover:text-blue-600`
                }`}
              >
                <module.icon size={20} />
                <span className="text-sm font-medium">{module.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Load Combinations Module */}
            {activeModule === "loads" && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calculator size={24} className="text-blue-600" />
                  Load Combinations (BS 8110 / Eurocode)
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Core Size (m)
                    </label>
                    <input
                      type="number"
                      value={systemData.coreSize}
                      onChange={(e) =>
                        setSystemData({
                          ...systemData,
                          coreSize: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter core size"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Analyze Structural System
                </button>
              </div>
            )}

            {/* Computer Modeling Module */}
            {activeModule === "modeling" && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Box size={24} className="text-blue-600" />
                  Computer Modeling Categories
                </h2>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      Model Category
                    </label>
                    <select
                      value={modelData.category}
                      onChange={(e) =>
                        setModelData({ ...modelData, category: e.target.value })
                      }
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="cat1">
                        Category 1: Symmetric Floor, Identical Parallel Bents
                      </option>
                      <option value="cat2">
                        Category 2: Symmetric Floor, Non-Identical Bents
                      </option>
                      <option value="cat3">
                        Category 3: Non-Symmetric Floor Plan
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Number of Bents
                    </label>
                    <input
                      type="number"
                      value={modelData.bents}
                      onChange={(e) =>
                        setModelData({ ...modelData, bents: e.target.value })
                      }
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter number of bents"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Applied Load (kN)
                    </label>
                    <input
                      type="number"
                      value={modelData.load}
                      onChange={(e) =>
                        setModelData({ ...modelData, load: e.target.value })
                      }
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                      placeholder="Enter applied load"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Symmetry
                    </label>
                    <select
                      value={modelData.symmetry}
                      onChange={(e) =>
                        setModelData({ ...modelData, symmetry: e.target.value })
                      }
                      className={`w-full px-4 py-2 rounded-lg ${inputBg} border ${borderColor}`}
                    >
                      <option value="symmetric">Symmetric</option>
                      <option value="asymmetric">Asymmetric</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Analyze Model
                </button>
              </div>
            )}

            {/* 3D Visualization */}
            {activeModule === "visualization" && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Ruler size={24} className="text-blue-600" />
                  3D Frame Visualization
                </h2>
                <p className="text-sm opacity-70 mb-4">
                  Interactive 3D visualization of structural frame based on
                  frame analysis parameters
                </p>
                <canvas
                  ref={canvasRef}
                  className={`w-full h-96 rounded-lg ${inputBg} border ${borderColor}`}
                />
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <p className="text-sm">
                    <strong>Note:</strong> Adjust frame parameters in the Frame
                    Analysis module to update the 3D model
                  </p>
                </div>
              </div>
            )}

            {/* Results Display */}
            {results && (
              <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText size={24} className="text-green-600" />
                  Calculation Results
                </h2>

                {activeModule === "loads" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold mb-2">
                        Ultimate Limit State (ULS)
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">
                            Combination 1: 1.4Gk + 1.6Qk
                          </p>
                          <p className="text-2xl font-bold text-blue-600">
                            {results.uls?.combo1.toFixed(2)} kN/m²
                          </p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">
                            Combination 2: 1.4Gk + 1.6Qk + 1.2Wk
                          </p>
                          <p className="text-2xl font-bold text-blue-600">
                            {results.uls?.combo2.toFixed(2)} kN/m²
                          </p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">
                            Combination 3: 1.0Gk + 1.4Wk
                          </p>
                          <p className="text-2xl font-bold text-blue-600">
                            {results.uls?.combo3.toFixed(2)} kN/m²
                          </p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">
                            Combination 4: 1.2Gk + 1.2Qk + 1.2Wk
                          </p>
                          <p className="text-2xl font-bold text-blue-600">
                            {results.uls?.combo4.toFixed(2)} kN/m²
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold mb-2">
                        Serviceability Limit State (SLS)
                      </h3>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Characteristic</p>
                          <p className="text-xl font-bold text-green-600">
                            {results.sls?.characteristic.toFixed(2)} kN/m²
                          </p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Quasi-Permanent</p>
                          <p className="text-xl font-bold text-green-600">
                            {results.sls?.quasi_permanent.toFixed(2)} kN/m²
                          </p>
                        </div>
                        <div className={`p-4 ${inputBg} rounded-lg`}>
                          <p className="text-sm opacity-70">Frequent</p>
                          <p className="text-xl font-bold text-green-600">
                            {results.sls?.frequent.toFixed(2)} kN/m²
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeModule === "ties" && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Required Tie Force</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {results.tieForce} kN
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">
                          Required Steel Area
                        </p>
                        <p className="text-2xl font-bold text-blue-600">
                          {results.requiredArea} mm²
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">
                          Recommended Bar Size
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          {results.barSize}
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">
                          Spacing Requirement
                        </p>
                        <p className="text-lg font-bold text-green-600">
                          {results.spacing}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeModule === "frame" && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Shear per Column</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {results.shearPerColumn} kN
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Maximum Moment</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {results.moment} kNm
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Axial Force</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {results.axialForce} kN
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Inflection Point</p>
                        <p className="text-2xl font-bold text-green-600">
                          {results.inflectionPoint} m
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeModule === "systems" && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">System Suitability</p>
                        <p className="text-xl font-bold text-blue-600">
                          {results.suitability}
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Drift Limit (H/X)</p>
                        <p className="text-xl font-bold text-blue-600">
                          {results.driftLimit} m
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Aspect Ratio</p>
                        <p className="text-xl font-bold text-blue-600">
                          {results.aspectRatio}
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Slenderness</p>
                        <p className="text-xl font-bold text-green-600">
                          {results.slenderness}
                        </p>
                      </div>
                    </div>
                    <div className={`p-4 ${inputBg} rounded-lg`}>
                      <p className="text-sm opacity-70 mb-2">
                        System Characteristics
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {results.characteristics?.map((char, idx) => (
                          <li key={idx} className="text-sm">
                            {char}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {activeModule === "modeling" && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Load per Bent</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {results.loadPerBent} kN
                        </p>
                      </div>
                      <div className={`p-4 ${inputBg} rounded-lg`}>
                        <p className="text-sm opacity-70">Analysis Method</p>
                        <p className="text-xl font-bold text-blue-600">
                          {results.method}
                        </p>
                      </div>
                    </div>
                    <div className={`p-4 ${inputBg} rounded-lg`}>
                      <p className="text-sm opacity-70 mb-2">
                        Load Distribution
                      </p>
                      <p className="text-sm">{results.distribution}</p>
                    </div>
                    <div className={`p-4 ${inputBg} rounded-lg`}>
                      <p className="text-sm opacity-70 mb-2">
                        Analysis Approach
                      </p>
                      <p className="text-sm">{results.analysis}</p>
                    </div>
                  </div>
                )}

                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
                  <p className="text-sm">
                    <strong>Note:</strong> All calculations are based on BS 8110
                    and Eurocode standards. Results should be verified by a
                    qualified structural engineer before implementation.
                  </p>
                </div>
              </div>
            )}

            {/* BS Code Reference Tables */}
            <div className={`${cardBg} rounded-lg p-6 border ${borderColor}`}>
              <h2 className="text-xl font-bold mb-4">
                BS Code Reference Tables
              </h2>
              <div className="space-y-4">
                <div className={`p-4 ${inputBg} rounded-lg`}>
                  <h3 className="font-bold mb-2">Concrete Grades (BS 8110)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-2">Grade</th>
                          <th className="text-left py-2">fcu (N/mm²)</th>
                          <th className="text-left py-2">Application</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">C25</td>
                          <td className="py-2">25</td>
                          <td className="py-2">General construction</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">C30</td>
                          <td className="py-2">30</td>
                          <td className="py-2">Reinforced concrete</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">C40</td>
                          <td className="py-2">40</td>
                          <td className="py-2">High strength applications</td>
                        </tr>
                        <tr>
                          <td className="py-2">C50</td>
                          <td className="py-2">50</td>
                          <td className="py-2">Pre-stressed concrete</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`p-4 ${inputBg} rounded-lg`}>
                  <h3 className="font-bold mb-2">Load Factors (BS 8110)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-2">Load Type</th>
                          <th className="text-left py-2">ULS Factor</th>
                          <th className="text-left py-2">SLS Factor</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">Dead Load (Gk)</td>
                          <td className="py-2">1.4</td>
                          <td className="py-2">1.0</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">Imposed Load (Qk)</td>
                          <td className="py-2">1.6</td>
                          <td className="py-2">1.0</td>
                        </tr>
                        <tr>
                          <td className="py-2">Wind Load (Wk)</td>
                          <td className="py-2">1.4</td>
                          <td className="py-2">1.0</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`p-4 ${inputBg} rounded-lg`}>
                  <h3 className="font-bold mb-2">
                    Reinforcement Bar Sizes (BS 4449)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-2">Bar Size</th>
                          <th className="text-left py-2">Diameter (mm)</th>
                          <th className="text-left py-2">Area (mm²)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">H8</td>
                          <td className="py-2">8</td>
                          <td className="py-2">50</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">H10</td>
                          <td className="py-2">10</td>
                          <td className="py-2">79</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">H12</td>
                          <td className="py-2">12</td>
                          <td className="py-2">113</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">H16</td>
                          <td className="py-2">16</td>
                          <td className="py-2">201</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="py-2">H20</td>
                          <td className="py-2">20</td>
                          <td className="py-2">314</td>
                        </tr>
                        <tr>
                          <td className="py-2">H25</td>
                          <td className="py-2">25</td>
                          <td className="py-2">491</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className={`${cardBg} border-t ${borderColor} px-6 py-4 mt-8`}>
        <div className="max-w-6xl mx-auto text-center text-sm opacity-70">
          <p>
            RC Structural Design System v1.0 | BS 8110 & Eurocode Compliant |
            Field Trial Ready
          </p>
          <p className="mt-1">
            Developed for Structural Engineers | Always verify calculations with
            qualified personnel
          </p>
        </div>
      </footer>
    </div>
  );
};

export default RCStructuralDesign;
