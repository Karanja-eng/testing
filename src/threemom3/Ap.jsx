import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

const ThreeMomentCalculator = () => {
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

  // Update support positions when spans change
  const computedSupports = useMemo(() => {
    let position = 0;
    const newSupports = [{ support_type: "Pinned", position: 0.0 }];

    spans.forEach((span, index) => {
      position += span.length;
      newSupports.push({
        support_type: index === spans.length - 1 ? "Pinned" : "Pinned",
        position: position,
      });
    });

    return newSupports;
  }, [spans]);

  useEffect(() => {
    setSupports(computedSupports);
  }, [computedSupports]);

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

  const BeamSchematic = ({ spans, supports, results }) => {
    const totalLength = spans.reduce((sum, span) => sum + span.length, 0);
    const scale = 800 / totalLength; // SVG width scaling
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
                        {/* Load arrow */}
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
                    {/* Fixed support */}
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
                    {/* Hatching */}
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
                    {/* Pinned support */}
                    <polygon
                      points={`${x - 10},125 ${x + 10},125 ${x},110`}
                      fill="#4A5568"
                      stroke="#2D3748"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {/* Support reactions */}
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

                {/* Support moments */}
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

    // Combine moment diagrams data for stacked visualization
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
              <Legend />
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

              {/* Moment due to loads */}
              <Area
                type="monotone"
                dataKey="loads"
                stackId="1"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.4}
                strokeWidth={2}
              />

              {/* Moment due to supports */}
              <Area
                type="monotone"
                dataKey="supports"
                stackId="2"
                stroke="#8B5CF6"
                fill="#8B5CF6"
                fillOpacity={0.4}
                strokeWidth={2}
              />

              {/* Total moment line */}
              <Line
                type="monotone"
                dataKey="total"
                stroke="#EF4444"
                strokeWidth={3}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Download / small overview */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Max: {results.critical_values.max_moment.toFixed(2)} kN⋅m | Min:{" "}
              {results.critical_values.min_moment.toFixed(2)} kN⋅m
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  // Build CSV from moment_data
                  const rows = ["x,total,loads,supports"];
                  combinedMomentData.forEach((p) => {
                    rows.push(`${p.x},${p.total},${p.loads},${p.supports}`);
                  });
                  const blob = new Blob([rows.join("\n")], {
                    type: "text/csv",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "moment_data.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 flex items-center text-sm"
                title="Download moment data CSV"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>

              {/* Small overview LineChart (uses LineChart + Legend) */}
              <div
                style={{ width: 220, height: 60 }}
                className="bg-white p-2 rounded border"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.moment_due_to_loads_data}>
                    <XAxis dataKey="x" hide />
                    <YAxis hide />
                    <Tooltip formatter={(v) => `${v.toFixed(2)} kN⋅m`} />
                    <Legend />
                    <Line
                      dataKey="y"
                      stroke="#10B981"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-2 text-sm text-gray-600">
            Max: {results.critical_values.max_moment.toFixed(2)} kN⋅m | Min:{" "}
            {results.critical_values.min_moment.toFixed(2)} kN⋅m
          </div>
        </div>

        {/* Separate BMD Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Moments due to loads only */}
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

          {/* Moments due to support moments */}
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

  const ResultsTable = ({ results }) => {
    if (!results) return null;

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Analysis Results</h3>

        {/* Support Results */}
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

        {/* Critical Values */}
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

        {/* Equations Used */}
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
                  Three-Moment Theorem Calculator
                </h1>
                <p className="text-sm text-gray-600">
                  Professional Continuous Beam Analysis
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => loadExample("Two-Span Continuous Beam")}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <BookOpen className="h-4 w-4 inline mr-2" />
                Load Example 1
              </button>
              <button
                onClick={() => loadExample("UDL Three-Span Beam")}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <BookOpen className="h-4 w-4 inline mr-2" />
                Load Example 2
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
              Analysis Results
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
            {/* Beam Configuration */}
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

              {/* Spans */}
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

                    {/* Span Properties */}
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

                    {/* Loads */}
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

                          {load.load_type === "Trapezoidal Load" && (
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                End Magnitude (kN/m)
                              </label>
                              <input
                                type="number"
                                value={load.magnitude2}
                                onChange={(e) =>
                                  updateLoad(
                                    spanIndex,
                                    loadIndex,
                                    "magnitude2",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm md:w-1/4"
                                step="0.1"
                              />
                            </div>
                          )}
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

            {/* Support Configuration */}
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

            {/* Beam Schematic */}
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

        {/* Results Tab */}
        {activeTab === "results" && results && (
          <div className="space-y-6">
            {/* Beam Schematic with Results */}
            <BeamSchematic
              spans={spans}
              supports={supports}
              results={results}
            />

            {/* Diagrams */}
            <DiagramsPanel results={results} />

            {/* Results Table */}
            <ResultsTable results={results} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Three-Moment Theorem Calculator - Professional Structural Analysis
            Tool
          </p>
          <p className="mt-1">
            © 2024 - Built with React, FastAPI, and advanced structural
            engineering principles
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThreeMomentCalculator;
