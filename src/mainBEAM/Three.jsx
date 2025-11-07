import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from "recharts";
import {
  Plus,
  Minus,
  Play,
  Download,
  BookOpen,
  Settings,
  AlertTriangle,
  CheckCircle,
  Wrench,
  Calculator,
  FileText,
  Award,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

const EnhancedThreeMomentCalculator = () => {
  const [spans, setSpans] = useState([
    { length: 6.0, E: 200e9, I: 8.33e-6, loads: [] },
  ]);
  const [supports, setSupports] = useState([
    { support_type: "Pinned", position: 0.0 },
    { support_type: "Pinned", position: 6.0 },
  ]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("input");

  // Design parameters
  const [designEnabled, setDesignEnabled] = useState(false);
  const [designParams, setDesignParams] = useState({
    beam_type: "Rectangular",
    support_condition: "Simply Supported",
    imposed_load: 10.0,
    permanent_load: 5.0,
    materials: {
      concrete_grade: "C30",
      steel_grade: "Grade 460",
      concrete_density: 25.0,
      steel_density: 78.5,
    },
    rectangular_geometry: {
      width: 300,
      depth: 500,
      cover: 25,
    },
    t_beam_geometry: {
      web_width: 300,
      web_depth: 400,
      flange_width: 1000,
      flange_thickness: 150,
      cover: 25,
    },
    l_beam_geometry: {
      web_width: 250,
      web_depth: 350,
      flange_width: 600,
      flange_thickness: 120,
      cover: 30,
    },
  });
  const [designResults, setDesignResults] = useState(null);
  const [designLoading, setDesignLoading] = useState(false);

  // Update support positions when spans change
  useEffect(() => {
    let position = 0;
    const newSupports = [{ support_type: "Pinned", position: 0.0 }];

    spans.forEach((span, index) => {
      position += span.length;
      newSupports.push({
        support_type: index === spans.length - 1 ? "Pinned" : "Pinned",
        position: position,
      });
    });

    setSupports(newSupports);
  }, [spans.length, spans.map((s) => s.length).join(",")]);

  const addSpan = () => {
    setSpans([...spans, { length: 6.0, E: 200e9, I: 8.33e-6, loads: [] }]);
  };

  const removeSpan = (index) => {
    if (spans.length > 1) {
      const newSpans = spans.filter((_, i) => i !== index);
      setSpans(newSpans);
    }
  };

  const updateSpan = (index, field, value) => {
    const newSpans = [...spans];
    newSpans[index][field] = parseFloat(value) || 0;
    setSpans(newSpans);
  };

  const addLoad = (spanIndex) => {
    const newSpans = [...spans];
    newSpans[spanIndex].loads.push({
      load_type: "Point Load",
      magnitude: 50.0,
      position: 0.0,
      length: 0.0,
      magnitude2: 0.0,
    });
    setSpans(newSpans);
  };

  const updateLoad = (spanIndex, loadIndex, field, value) => {
    const newSpans = [...spans];
    newSpans[spanIndex].loads[loadIndex][field] =
      field === "load_type" ? value : parseFloat(value) || 0;
    setSpans(newSpans);
  };

  const removeLoad = (spanIndex, loadIndex) => {
    const newSpans = [...spans];
    newSpans[spanIndex].loads.splice(loadIndex, 1);
    setSpans(newSpans);
  };

  const updateSupport = (index, field, value) => {
    const newSupports = [...supports];
    newSupports[index][field] = value;
    setSupports(newSupports);
  };

  const updateDesignParam = (path, value) => {
    const newParams = { ...designParams };
    const keys = path.split(".");
    let current = newParams;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    setDesignParams(newParams);
  };

  const analyzeBeam = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/analyze`, {
        spans,
        supports,
      });
      setResults(response.data);
      setActiveTab("results");
    } catch (err) {
      setError(err.response?.data?.detail || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const designBeam = async () => {
    if (!results) {
      setError("Please analyze beam first");
      return;
    }

    setDesignLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/integrate_analysis_design`,
        {
          analysis_results: results,
          design_parameters: designParams,
        }
      );
      setDesignResults(response.data);
      setActiveTab("design");
    } catch (err) {
      setError(err.response?.data?.detail || "Design failed");
    } finally {
      setDesignLoading(false);
    }
  };

  const loadExample = async (exampleName) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/examples`);
      const example = response.data.find((ex) => ex.name === exampleName);
      if (example) {
        setSpans(example.spans);
        setSupports(example.supports);
      }
    } catch (err) {
      setError("Failed to load example");
    }
  };

  const loadDesignExample = async (exampleName) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/beam_design_examples`);
      const example = response.data.find((ex) => ex.name === exampleName);
      if (example) {
        setDesignParams({
          ...designParams,
          beam_type: example.beam_type,
          support_condition: example.support_condition,
          imposed_load: example.imposed_load,
          permanent_load: example.permanent_load,
          materials: example.materials,
          ...(example.rectangular_geometry && {
            rectangular_geometry: example.rectangular_geometry,
          }),
          ...(example.t_beam_geometry && {
            t_beam_geometry: example.t_beam_geometry,
          }),
          ...(example.l_beam_geometry && {
            l_beam_geometry: example.l_beam_geometry,
          }),
        });
      }
    } catch (err) {
      setError("Failed to load design example");
    }
  };

  const BeamSchematic = ({ spans, supports, results }) => {
    const totalLength = spans.reduce((sum, span) => sum + span.length, 0);
    const scale = 800 / totalLength;
    const beamHeight = 20;
    let currentPos = 0;

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Beam Configuration</h3>
        <svg width="900" height="200" viewBox="0 0 900 200">
          {/* Draw spans */}
          {spans.map((span, index) => {
            const spanWidth = span.length * scale;
            const x = currentPos * scale + 50;
            const rect = (
              <g key={`span-${index}`}>
                {/* Beam segment */}
                <rect
                  x={x}
                  y={90}
                  width={spanWidth}
                  height={beamHeight}
                  fill="#4A5568"
                  stroke="#2D3748"
                  strokeWidth="2"
                />
                {/* Span label */}
                <text
                  x={x + spanWidth / 2}
                  y={85}
                  textAnchor="middle"
                  className="text-sm fill-gray-700"
                >
                  Span {index + 1}: {span.length}m
                </text>

                {/* Draw loads */}
                {span.loads.map((load, loadIndex) => {
                  const loadX = x + load.position * scale;
                  if (load.load_type === "Point Load") {
                    return (
                      <g key={`load-${index}-${loadIndex}`}>
                        <line
                          x1={loadX}
                          y1={60}
                          x2={loadX}
                          y2={90}
                          stroke="red"
                          strokeWidth="3"
                          markerEnd="url(#arrowhead)"
                        />
                        <text
                          x={loadX}
                          y={55}
                          textAnchor="middle"
                          className="text-xs fill-red-600"
                        >
                          {load.magnitude}kN
                        </text>
                      </g>
                    );
                  } else if (load.load_type === "Uniformly Distributed Load") {
                    const arrows = [];
                    for (let i = 0; i < 10; i++) {
                      const arrowX = x + (i * spanWidth) / 9;
                      arrows.push(
                        <line
                          key={i}
                          x1={arrowX}
                          y1={70}
                          x2={arrowX}
                          y2={90}
                          stroke="blue"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead-small)"
                        />
                      );
                    }
                    return (
                      <g key={`load-${index}-${loadIndex}`}>
                        {arrows}
                        <text
                          x={x + spanWidth / 2}
                          y={65}
                          textAnchor="middle"
                          className="text-xs fill-blue-600"
                        >
                          {load.magnitude}kN/m
                        </text>
                      </g>
                    );
                  }
                  return null;
                })}
              </g>
            );
            currentPos += span.length;
            return rect;
          })}

          {/* Draw supports */}
          {supports.map((support, index) => {
            const x = support.position * scale + 50;
            return (
              <g key={`support-${index}`}>
                {support.support_type === "Fixed" ? (
                  <g>
                    <rect
                      x={x - 5}
                      y={110}
                      width={10}
                      height={15}
                      fill="#2D3748"
                    />
                    <line
                      x1={x - 10}
                      y1={125}
                      x2={x + 10}
                      y2={125}
                      stroke="#2D3748"
                      strokeWidth="3"
                    />
                    {[...Array(5)].map((_, i) => (
                      <line
                        key={i}
                        x1={x - 8 + i * 4}
                        y1={125}
                        x2={x - 6 + i * 4}
                        y2={130}
                        stroke="#2D3748"
                        strokeWidth="1"
                      />
                    ))}
                  </g>
                ) : (
                  <g>
                    <polygon
                      points={`${x - 10},125 ${x + 10},125 ${x},110`}
                      fill="#4A5568"
                      stroke="#2D3748"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {results &&
                  Math.abs(results.support_reactions[index]) > 0.01 && (
                    <g>
                      <line
                        x1={x}
                        y1={140}
                        x2={x}
                        y2={results.support_reactions[index] > 0 ? 155 : 125}
                        stroke="purple"
                        strokeWidth="3"
                        markerEnd="url(#arrowhead-purple)"
                      />
                      <text
                        x={x}
                        y={170}
                        textAnchor="middle"
                        className="text-xs fill-purple-600"
                      >
                        R={results.support_reactions[index].toFixed(1)}kN
                      </text>
                    </g>
                  )}

                {results && Math.abs(results.support_moments[index]) > 0.01 && (
                  <text
                    x={x}
                    y={45}
                    textAnchor="middle"
                    className="text-xs fill-orange-600 font-semibold"
                  >
                    M={results.support_moments[index].toFixed(1)}kN⋅m
                  </text>
                )}
              </g>
            );
          })}

          {/* Arrow markers */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="red" />
            </marker>
            <marker
              id="arrowhead-small"
              markerWidth="6"
              markerHeight="4"
              refX="5"
              refY="2"
              orient="auto"
            >
              <polygon points="0 0, 6 2, 0 4" fill="blue" />
            </marker>
            <marker
              id="arrowhead-purple"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="purple" />
            </marker>
          </defs>
        </svg>
      </div>
    );
  };

  const DiagramsPanel = ({ results }) => {
    if (!results) return null;

    const combinedMomentData = results.moment_data.map((point, index) => ({
      x: point.x,
      total: point.y,
      loads: results.moment_due_to_loads_data[index]?.y || 0,
      supports: results.moment_due_to_supports_data[index]?.y || 0,
    }));

    return (
      <div className="space-y-6">
        {/* Shear Force Diagram */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-blue-600">
            Shear Force Diagram (SFD)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={results.shear_force_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                label={{
                  value: "Distance (m)",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                label={{
                  value: "Shear Force (kN)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip
                formatter={(value) => [`${value.toFixed(2)} kN`, "Shear Force"]}
              />
              <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
              <Area
                type="monotone"
                dataKey="y"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 text-sm text-gray-600">
            Max: {results.critical_values.max_shear.toFixed(2)} kN | Min:{" "}
            {results.critical_values.min_shear.toFixed(2)} kN
          </div>
        </div>

        {/* Combined Bending Moment Diagram */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-red-600">
            Bending Moment Diagram (BMD) - Combined View
          </h3>
          <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="font-semibold text-yellow-800 mb-2">
              Three-Moment Theorem Components:
            </h4>
            <div className="text-sm text-yellow-700">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-2 bg-green-500 opacity-70"></div>
                <span>Moments due to vertical loads (simple beam moments)</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-2 bg-purple-500 opacity-70"></div>
                <span>Moments due to support moments (continuity effect)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 bg-red-500"></div>
                <span>Total moments (superposition)</span>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={combinedMomentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                label={{
                  value: "Distance (m)",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                label={{
                  value: "Bending Moment (kN⋅m)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip
                formatter={(value, name) => {
                  const labels = {
                    loads: "Due to Loads",
                    supports: "Due to Supports",
                    total: "Total Moment",
                  };
                  return [`${value.toFixed(2)} kN⋅m`, labels[name] || name];
                }}
              />
              <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />

              <Area
                type="monotone"
                dataKey="loads"
                stackId="1"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.4}
                strokeWidth={2}
              />

              <Area
                type="monotone"
                dataKey="supports"
                stackId="2"
                stroke="#8B5CF6"
                fill="#8B5CF6"
                fillOpacity={0.4}
                strokeWidth={2}
              />

              <Line
                type="monotone"
                dataKey="total"
                stroke="#EF4444"
                strokeWidth={3}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="mt-2 text-sm text-gray-600">
            Max: {results.critical_values.max_moment.toFixed(2)} kN⋅m | Min:{" "}
            {results.critical_values.min_moment.toFixed(2)} kN⋅m
          </div>
        </div>

        {/* Separate BMD Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-green-600">
              BMD - Due to Vertical Loads Only
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={results.moment_due_to_loads_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [
                    `${value.toFixed(2)} kN⋅m`,
                    "Moment (Loads)",
                  ]}
                />
                <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-purple-600">
              BMD - Due to Support Moments
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={results.moment_due_to_supports_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [
                    `${value.toFixed(2)} kN⋅m`,
                    "Moment (Supports)",
                  ]}
                />
                <ReferenceLine y={0} stroke="black" strokeDasharray="2 2" />
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke="#8B5CF6"
                  fill="#8B5CF6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const DesignConfigPanel = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            BS 8110 Beam Design Configuration
          </h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => loadDesignExample("Simple Rectangular Beam")}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
            >
              Rectangle Example
            </button>
            <button
              onClick={() => loadDesignExample("Continuous T-Beam")}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
            >
              T-Beam Example
            </button>
            <button
              onClick={() => loadDesignExample("Cantilever L-Beam")}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
            >
              L-Beam Example
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Parameters */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Basic Parameters</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Beam Type
                </label>
                <select
                  value={designParams.beam_type}
                  onChange={(e) =>
                    updateDesignParam("beam_type", e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="Rectangular">Rectangular</option>
                  <option value="T-Beam">T-Beam</option>
                  <option value="L-Beam">L-Beam</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Support Condition
                </label>
                <select
                  value={designParams.support_condition}
                  onChange={(e) =>
                    updateDesignParam("support_condition", e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="Simply Supported">Simply Supported</option>
                  <option value="Continuous">Continuous</option>
                  <option value="Cantilever">Cantilever</option>
                  <option value="Fixed">Fixed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imposed Load (kN/m)
                  </label>
                  <input
                    type="number"
                    value={designParams.imposed_load}
                    onChange={(e) =>
                      updateDesignParam(
                        "imposed_load",
                        parseFloat(e.target.value)
                      )
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permanent Load (kN/m)
                  </label>
                  <input
                    type="number"
                    value={designParams.permanent_load}
                    onChange={(e) =>
                      updateDesignParam(
                        "permanent_load",
                        parseFloat(e.target.value)
                      )
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Material Properties */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Material Properties</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Concrete Grade
                  </label>
                  <select
                    value={designParams.materials.concrete_grade}
                    onChange={(e) =>
                      updateDesignParam(
                        "materials.concrete_grade",
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="C20">C20</option>
                    <option value="C25">C25</option>
                    <option value="C30">C30</option>
                    <option value="C35">C35</option>
                    <option value="C40">C40</option>
                    <option value="C45">C45</option>
                    <option value="C50">C50</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Steel Grade
                  </label>
                  <select
                    value={designParams.materials.steel_grade}
                    onChange={(e) =>
                      updateDesignParam("materials.steel_grade", e.target.value)
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="Grade 250">Grade 250</option>
                    <option value="Grade 460">Grade 460</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Geometry Configuration */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Cross-Section Geometry</h3>

          {designParams.beam_type === "Rectangular" && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Width (mm)
                </label>
                <input
                  type="number"
                  value={designParams.rectangular_geometry.width}
                  onChange={(e) =>
                    updateDesignParam(
                      "rectangular_geometry.width",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Depth (mm)
                </label>
                <input
                  type="number"
                  value={designParams.rectangular_geometry.depth}
                  onChange={(e) =>
                    updateDesignParam(
                      "rectangular_geometry.depth",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cover (mm)
                </label>
                <input
                  type="number"
                  value={designParams.rectangular_geometry.cover}
                  onChange={(e) =>
                    updateDesignParam(
                      "rectangular_geometry.cover",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
          )}

          {designParams.beam_type === "T-Beam" && (
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Web Width (mm)
                </label>
                <input
                  type="number"
                  value={designParams.t_beam_geometry.web_width}
                  onChange={(e) =>
                    updateDesignParam(
                      "t_beam_geometry.web_width",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Web Depth (mm)
                </label>
                <input
                  type="number"
                  value={designParams.t_beam_geometry.web_depth}
                  onChange={(e) =>
                    updateDesignParam(
                      "t_beam_geometry.web_depth",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flange Width (mm)
                </label>
                <input
                  type="number"
                  value={designParams.t_beam_geometry.flange_width}
                  onChange={(e) =>
                    updateDesignParam(
                      "t_beam_geometry.flange_width",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flange Thickness (mm)
                </label>
                <input
                  type="number"
                  value={designParams.t_beam_geometry.flange_thickness}
                  onChange={(e) =>
                    updateDesignParam(
                      "t_beam_geometry.flange_thickness",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cover (mm)
                </label>
                <input
                  type="number"
                  value={designParams.t_beam_geometry.cover}
                  onChange={(e) =>
                    updateDesignParam(
                      "t_beam_geometry.cover",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
          )}

          {designParams.beam_type === "L-Beam" && (
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Web Width (mm)
                </label>
                <input
                  type="number"
                  value={designParams.l_beam_geometry.web_width}
                  onChange={(e) =>
                    updateDesignParam(
                      "l_beam_geometry.web_width",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Web Depth (mm)
                </label>
                <input
                  type="number"
                  value={designParams.l_beam_geometry.web_depth}
                  onChange={(e) =>
                    updateDesignParam(
                      "l_beam_geometry.web_depth",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flange Width (mm)
                </label>
                <input
                  type="number"
                  value={designParams.l_beam_geometry.flange_width}
                  onChange={(e) =>
                    updateDesignParam(
                      "l_beam_geometry.flange_width",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flange Thickness (mm)
                </label>
                <input
                  type="number"
                  value={designParams.l_beam_geometry.flange_thickness}
                  onChange={(e) =>
                    updateDesignParam(
                      "l_beam_geometry.flange_thickness",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cover (mm)
                </label>
                <input
                  type="number"
                  value={designParams.l_beam_geometry.cover}
                  onChange={(e) =>
                    updateDesignParam(
                      "l_beam_geometry.cover",
                      parseFloat(e.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cross-section visualization would go here */}
        <div className="mt-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Cross-Section Preview
            </h4>
            <div className="text-sm text-gray-600">
              {designParams.beam_type} section with{" "}
              {designParams.materials.concrete_grade} concrete and{" "}
              {designParams.materials.steel_grade} steel
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DesignResultsPanel = ({ designResults }) => {
    if (!designResults || !designResults.span_designs) return null;

    return (
      <div className="space-y-6">
        {/* Design Summary */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Award className="h-6 w-6 mr-2 text-green-600" />
            BS 8110 Design Results Summary
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600">Total Spans Designed</div>
              <div className="text-2xl font-bold text-blue-700">
                {designResults.summary.total_spans}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600">Beam Type</div>
              <div className="text-lg font-semibold text-green-700">
                {designResults.summary.beam_type}
              </div>
            </div>
            <div
              className={`p-4 rounded-lg ${
                designResults.summary.all_designs_ok
                  ? "bg-green-50"
                  : "bg-red-50"
              }`}
            >
              <div
                className={`text-sm ${
                  designResults.summary.all_designs_ok
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                Design Status
              </div>
              <div
                className={`text-lg font-semibold ${
                  designResults.summary.all_designs_ok
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {designResults.summary.all_designs_ok
                  ? "✓ All OK"
                  : "✗ Issues Found"}
              </div>
            </div>
          </div>
        </div>

        {/* Individual Span Results */}
        {designResults.span_designs.map((spanDesign, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Wrench className="h-5 w-5 mr-2 text-blue-600" />
              Span {index + 1} Design Details
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Reinforcement Details */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">
                  Reinforcement Details
                </h4>
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Main Bars</div>
                    <div className="font-medium">
                      {spanDesign.reinforcement.main_bars.join("mm + ")}mm bars
                    </div>
                    <div className="text-sm text-gray-500">
                      Total Area:{" "}
                      {spanDesign.reinforcement.main_bars_area.toFixed(0)} mm²
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Shear Links</div>
                    <div className="font-medium">
                      {spanDesign.reinforcement.shear_links}mm @{" "}
                      {spanDesign.reinforcement.link_spacing}mm c/c
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Steel Ratio</div>
                    <div className="font-medium">
                      {spanDesign.reinforcement.steel_ratio.toFixed(3)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Design Checks */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">
                  Design Checks
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Moment Capacity</span>
                    <span
                      className={`text-sm font-medium ${
                        spanDesign.design_checks.moment_capacity_ok
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {spanDesign.design_checks.moment_capacity_ok
                        ? "✓ OK"
                        : "✗ FAIL"}
                      (
                      {(
                        spanDesign.design_checks.moment_utilization * 100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Shear Capacity</span>
                    <span
                      className={`text-sm font-medium ${
                        spanDesign.design_checks.shear_capacity_ok
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {spanDesign.design_checks.shear_capacity_ok
                        ? "✓ OK"
                        : "✗ FAIL"}
                      (
                      {(
                        spanDesign.design_checks.shear_utilization * 100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Deflection</span>
                    <span
                      className={`text-sm font-medium ${
                        spanDesign.design_checks.deflection_ok
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {spanDesign.design_checks.deflection_ok
                        ? "✓ OK"
                        : "✗ FAIL"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Minimum Steel</span>
                    <span
                      className={`text-sm font-medium ${
                        spanDesign.design_checks.minimum_steel_ok
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {spanDesign.design_checks.minimum_steel_ok
                        ? "✓ OK"
                        : "✗ FAIL"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Maximum Steel</span>
                    <span
                      className={`text-sm font-medium ${
                        spanDesign.design_checks.maximum_steel_ok
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {spanDesign.design_checks.maximum_steel_ok
                        ? "✓ OK"
                        : "✗ FAIL"}
                    </span>
                  </div>
                </div>

                {/* Warnings and Errors */}
                {spanDesign.design_checks.warnings.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <h5 className="text-sm font-semibold text-yellow-800 mb-1">
                      Warnings:
                    </h5>
                    <ul className="text-sm text-yellow-700">
                      {spanDesign.design_checks.warnings.map((warning, idx) => (
                        <li key={idx} className="flex items-start">
                          <AlertTriangle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {spanDesign.design_checks.errors.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <h5 className="text-sm font-semibold text-red-800 mb-1">
                      Errors:
                    </h5>
                    <ul className="text-sm text-red-700">
                      {spanDesign.design_checks.errors.map((error, idx) => (
                        <li key={idx} className="flex items-start">
                          <AlertTriangle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Capacity Utilization Chart */}
            <div className="mt-6">
              <h4 className="font-semibold text-gray-700 mb-3">
                Capacity Utilization
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={[
                    {
                      name: "Moment",
                      utilization:
                        spanDesign.design_checks.moment_utilization * 100,
                      limit: 100,
                    },
                    {
                      name: "Shear",
                      utilization:
                        spanDesign.design_checks.shear_utilization * 100,
                      limit: 100,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis
                    label={{
                      value: "Utilization (%)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `${value.toFixed(1)}%`,
                      "Utilization",
                    ]}
                  />
                  <ReferenceLine y={100} stroke="red" strokeDasharray="2 2" />
                  <ReferenceLine y={90} stroke="orange" strokeDasharray="2 2" />
                  <Bar dataKey="utilization" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cost Estimate */}
            {spanDesign.cost_estimate && (
              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-700 mb-3">
                  Cost Estimate (per meter)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Concrete Volume</div>
                    <div className="font-medium">
                      {spanDesign.cost_estimate.concrete_volume_per_meter.toFixed(
                        3
                      )}{" "}
                      m³
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Steel Weight</div>
                    <div className="font-medium">
                      {spanDesign.cost_estimate.steel_weight_per_meter.toFixed(
                        1
                      )}{" "}
                      kg
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Material Cost</div>
                    <div className="font-medium">
                      £
                      {spanDesign.cost_estimate.total_cost_per_meter.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Total Span Cost</div>
                    <div className="font-medium text-lg text-blue-600">
                      £
                      {(
                        spanDesign.cost_estimate.total_cost_per_meter *
                          spans[index]?.length || 0
                      ).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Design Calculations Summary */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-gray-600" />
            Design Calculations Summary
          </h3>

          <div className="space-y-4">
            {designResults.span_designs.map((spanDesign, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4"
              >
                <h4 className="font-semibold text-gray-700 mb-2">
                  Span {index + 1} Calculations
                </h4>
                <div className="bg-gray-50 p-3 rounded font-mono text-xs overflow-x-auto">
                  {spanDesign.calculations_summary.map((line, lineIdx) => (
                    <div key={lineIdx} className="whitespace-pre-wrap">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const ResultsTable = ({ results }) => {
    if (!results) return null;

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Analysis Results</h3>

        <div className="mb-6">
          <h4 className="font-semibold text-gray-700 mb-3">Support Results</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2">Support</th>
                  <th className="border border-gray-300 px-4 py-2">Type</th>
                  <th className="border border-gray-300 px-4 py-2">
                    Position (m)
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    Moment (kN⋅m)
                  </th>
                  <th className="border border-gray-300 px-4 py-2">
                    Reaction (kN)
                  </th>
                </tr>
              </thead>
              <tbody>
                {supports.map((support, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="border border-gray-300 px-4 py-2 font-semibold">
                      {index + 1}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {support.support_type}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {support.position.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {results.support_moments[index].toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {results.support_reactions[index].toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold text-gray-700 mb-3">Critical Values</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-sm text-red-600">Max Moment</div>
              <div className="text-lg font-semibold text-red-700">
                {results.critical_values.max_moment.toFixed(2)} kN⋅m
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-sm text-red-600">Min Moment</div>
              <div className="text-lg font-semibold text-red-700">
                {results.critical_values.min_moment.toFixed(2)} kN⋅m
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600">Max Shear</div>
              <div className="text-lg font-semibold text-blue-700">
                {results.critical_values.max_shear.toFixed(2)} kN
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600">Min Shear</div>
              <div className="text-lg font-semibold text-blue-700">
                {results.critical_values.min_shear.toFixed(2)} kN
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-gray-700 mb-3">
            Three-Moment Theorem Equations
          </h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            {results.equations_used.map((equation, index) => (
              <div key={index} className="text-sm font-mono text-gray-700 mb-2">
                {equation}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Settings className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Three-Moment Theorem + BS 8110 Design
                </h1>
                <p className="text-sm text-gray-600">
                  Professional Continuous Beam Analysis & Reinforced Concrete
                  Design
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadExample("Two-Span Continuous Beam")}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
              >
                <BookOpen className="h-4 w-4 inline mr-1" />
                Example 1
              </button>
              <button
                onClick={() => loadExample("UDL Three-Span Beam")}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
              >
                <BookOpen className="h-4 w-4 inline mr-1" />
                Example 2
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-200 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("input")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                activeTab === "input"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Input Configuration
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                activeTab === "results"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              disabled={!results}
            >
              <Calculator className="h-4 w-4 inline mr-2" />
              Analysis Results
            </button>
            <button
              onClick={() => setActiveTab("design-config")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                activeTab === "design-config"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Wrench className="h-4 w-4 inline mr-2" />
              Design Configuration
            </button>
            <button
              onClick={() => setActiveTab("design")}
              className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                activeTab === "design"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              disabled={!designResults}
            >
              <Award className="h-4 w-4 inline mr-2" />
              Design Results
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Success Display */}
        {results && !error && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <span className="text-green-700">
              Analysis completed successfully!
            </span>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "input" && (
          <div className="space-y-6">
            {/* Beam Configuration - Same as before */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Beam Configuration</h2>
                <button
                  onClick={addSpan}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Span
                </button>
              </div>

              {/* Spans configuration - keeping the same structure as before but condensed */}
              <div className="space-y-4">
                {spans.map((span, spanIndex) => (
                  <div
                    key={spanIndex}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-medium">
                        Span {spanIndex + 1}
                      </h3>
                      {spans.length > 1 && (
                        <button
                          onClick={() => removeSpan(spanIndex)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Length (m)
                        </label>
                        <input
                          type="number"
                          value={span.length}
                          onChange={(e) =>
                            updateSpan(spanIndex, "length", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          E (Pa)
                        </label>
                        <input
                          type="number"
                          value={span.E}
                          onChange={(e) =>
                            updateSpan(spanIndex, "E", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          I (m⁴)
                        </label>
                        <input
                          type="number"
                          value={span.I}
                          onChange={(e) =>
                            updateSpan(spanIndex, "I", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          step="1e-6"
                        />
                      </div>
                    </div>

                    {/* Load configuration - simplified */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-700">Loads</h4>
                        <button
                          onClick={() => addLoad(spanIndex)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          <Plus className="h-4 w-4 inline mr-1" />
                          Add Load
                        </button>
                      </div>

                      {span.loads.map((load, loadIndex) => (
                        <div
                          key={loadIndex}
                          className="bg-gray-50 p-3 rounded mb-2"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h5 className="text-sm font-medium text-gray-600">
                              Load {loadIndex + 1}
                            </h5>
                            <button
                              onClick={() => removeLoad(spanIndex, loadIndex)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Load Type
                              </label>
                              <select
                                value={load.load_type}
                                onChange={(e) =>
                                  updateLoad(
                                    spanIndex,
                                    loadIndex,
                                    "load_type",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              >
                                <option value="Point Load">Point Load</option>
                                <option value="Uniformly Distributed Load">
                                  UDL
                                </option>
                                <option value="Partial Uniformly Distributed Load">
                                  Partial UDL
                                </option>
                                <option value="Triangular Load">
                                  Triangular
                                </option>
                                <option value="Trapezoidal Load">
                                  Trapezoidal
                                </option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Magnitude{" "}
                                {load.load_type === "Point Load"
                                  ? "(kN)"
                                  : "(kN/m)"}
                              </label>
                              <input
                                type="number"
                                value={load.magnitude}
                                onChange={(e) =>
                                  updateLoad(
                                    spanIndex,
                                    loadIndex,
                                    "magnitude",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                step="0.1"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Position (m)
                              </label>
                              <input
                                type="number"
                                value={load.position}
                                onChange={(e) =>
                                  updateLoad(
                                    spanIndex,
                                    loadIndex,
                                    "position",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                step="0.1"
                                max={span.length}
                              />
                            </div>
                            {(load.load_type ===
                              "Partial Uniformly Distributed Load" ||
                              load.load_type === "Triangular Load" ||
                              load.load_type === "Trapezoidal Load") && (
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Length (m)
                                </label>
                                <input
                                  type="number"
                                  value={load.length}
                                  onChange={(e) =>
                                    updateLoad(
                                      spanIndex,
                                      loadIndex,
                                      "length",
                                      e.target.value
                                    )
                                  }
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                  step="0.1"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {span.loads.length === 0 && (
                        <div className="text-gray-500 text-sm text-center py-4">
                          No loads defined for this span
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Support Configuration - Same as before */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">
                Support Configuration
              </h2>

              <div className="space-y-3">
                {supports.map((support, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-4 p-3 bg-gray-50 rounded"
                  >
                    <div className="flex-shrink-0 w-20">
                      <span className="text-sm font-medium text-gray-700">
                        Support {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Support Type
                        </label>
                        <select
                          value={support.support_type}
                          onChange={(e) =>
                            updateSupport(index, "support_type", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="Pinned">Pinned</option>
                          <option value="Fixed">Fixed</option>
                          <option value="Simply Supported">
                            Simply Supported
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Position (m)
                        </label>
                        <input
                          type="number"
                          value={support.position}
                          readOnly
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <BeamSchematic
              spans={spans}
              supports={supports}
              results={results}
            />

            {/* Analyze Button */}
            <div className="flex justify-center">
              <button
                onClick={analyzeBeam}
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center text-lg font-semibold"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                ) : (
                  <Play className="h-5 w-5 mr-3" />
                )}
                {loading ? "Analyzing..." : "Analyze Beam"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "results" && results && (
          <div className="space-y-6">
            <BeamSchematic
              spans={spans}
              supports={supports}
              results={results}
            />
            <DiagramsPanel results={results} />
            <ResultsTable results={results} />
          </div>
        )}

        {activeTab === "design-config" && (
          <div className="space-y-6">
            <DesignConfigPanel />

            {/* Design Button */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={designBeam}
                disabled={designLoading || !results}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center text-lg font-semibold"
              >
                {designLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                ) : (
                  <Wrench className="h-5 w-5 mr-3" />
                )}
                {designLoading ? "Designing..." : "Design Beam (BS 8110)"}
              </button>

              {!results && (
                <div className="text-sm text-gray-500 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Please analyze beam first
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "design" && designResults && (
          <DesignResultsPanel designResults={designResults} />
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Three-Moment Theorem Calculator with BS 8110 Reinforced Concrete
            Design
          </p>
          <p className="mt-1">
            © 2024 - Professional Structural Analysis & Design Tool
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnhancedThreeMomentCalculator;
