import React, { useState } from "react";
import { Plus, Minus, Calculator, Download, Zap } from "lucide-react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_BASE = "http://localhost:8000/api";

const StructuralAnalysisApp = () => {
  const [beamData, setBeamData] = useState({
    spans: [6.0, 8.0, 5.0],
    supports: ["fixed", "fixed", "fixed", "fixed"],
    material: {
      E: 200000,
      I: 50000000,
    },
    point_loads: [
      { magnitude: 50, position: 3.0, span_index: 0 },
      { magnitude: 75, position: 4.0, span_index: 1 },
    ],
    udl_loads: [
      { magnitude: 25, start_position: 0, end_position: 6.0, span_index: 0 },
    ],
    varying_loads: [],
    applied_moments: [],
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("input");

  const supportTypes = ["fixed", "pinned", "roller", "free"];
  const loadTypes = ["point", "udl", "varying", "moment"];

  const analyzeBeam = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/analyze-beam`, beamData);
      setResults(response.data);
      setActiveTab("results");
    } catch (error) {
      console.error("Analysis failed:", error);
      alert(
        "Analysis failed: " + (error.response?.data?.detail || error.message)
      );
    }
    setLoading(false);
  };

  const addSpan = () => {
    setBeamData((prev) => ({
      ...prev,
      spans: [...prev.spans, 5.0],
      supports: [...prev.supports, "pinned"],
    }));
  };

  const removeSpan = () => {
    if (beamData.spans.length > 2) {
      setBeamData((prev) => ({
        ...prev,
        spans: prev.spans.slice(0, -1),
        supports: prev.supports.slice(0, -1),
      }));
    }
  };

  const updateSpan = (index, value) => {
    const newSpans = [...beamData.spans];
    newSpans[index] = parseFloat(value) || 0;
    setBeamData((prev) => ({ ...prev, spans: newSpans }));
  };

  const updateSupport = (index, value) => {
    const newSupports = [...beamData.supports];
    newSupports[index] = value;
    setBeamData((prev) => ({ ...prev, supports: newSupports }));
  };

  const addPointLoad = () => {
    setBeamData((prev) => ({
      ...prev,
      point_loads: [
        ...prev.point_loads,
        { magnitude: 50, position: 2.0, span_index: 0 },
      ],
    }));
  };

  const addUDLLoad = () => {
    setBeamData((prev) => ({
      ...prev,
      udl_loads: [
        ...prev.udl_loads,
        { magnitude: 20, start_position: 0, end_position: 5.0, span_index: 0 },
      ],
    }));
  };

  const removeLoad = (type, index) => {
    setBeamData((prev) => ({
      ...prev,
      [`${type}_loads`]: prev[`${type}_loads`].filter((_, i) => i !== index),
    }));
  };

  const updateLoad = (type, index, field, value) => {
    const newLoads = [...beamData[`${type}_loads`]];
    newLoads[index][field] = parseFloat(value) || 0;
    setBeamData((prev) => ({ ...prev, [`${type}_loads`]: newLoads }));
  };

  function BeamSchematic({ beamData }) {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Set up drawing parameters
      const margin = 50;
      const beamY = height / 2;
      const totalLength = beamData.spans.reduce((sum, span) => sum + span, 0);
      const scale = (width - 2 * margin) / totalLength;

      // Draw beam
      ctx.strokeStyle = "#3B82F6";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(margin, beamY);
      ctx.lineTo(width - margin, beamY);
      ctx.stroke();

      // Draw spans and supports
      let currentX = margin;
      beamData.supports.forEach((support, i) => {
        const x = currentX;

        // Draw support symbol
        ctx.strokeStyle = "#1F2937";
        ctx.lineWidth = 3;

        switch (support) {
          case "fixed":
            // Fixed support - rectangle
            ctx.fillStyle = "#374151";
            ctx.fillRect(x - 8, beamY, 16, 30);
            ctx.strokeRect(x - 8, beamY, 16, 30);
            break;
          case "pinned":
            // Pinned support - triangle
            ctx.beginPath();
            ctx.moveTo(x, beamY);
            ctx.lineTo(x - 15, beamY + 25);
            ctx.lineTo(x + 15, beamY + 25);
            ctx.closePath();
            ctx.fillStyle = "#374151";
            ctx.fill();
            ctx.stroke();
            break;
          case "roller":
            // Roller support - triangle with circle
            ctx.beginPath();
            ctx.moveTo(x, beamY);
            ctx.lineTo(x - 15, beamY + 20);
            ctx.lineTo(x + 15, beamY + 20);
            ctx.closePath();
            ctx.fillStyle = "#374151";
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, beamY + 27, 7, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            break;
          default:
            // Default case - unknown support
            console.warn(`Unknown support type: ${support}`);
            break;
        }

        // Move to next support
        if (i < beamData.spans.length) {
          currentX += beamData.spans[i] * scale;
        }
      });

      // Draw loads
      ctx.strokeStyle = "#DC2626";
      ctx.fillStyle = "#DC2626";
      ctx.lineWidth = 2;

      // Point loads
      beamData.point_loads.forEach((load) => {
        const spanStart =
          margin +
          beamData.spans
            .slice(0, load.span_index)
            .reduce((sum, span) => sum + span * scale, 0);
        const loadX = spanStart + load.position * scale;

        // Draw arrow
        ctx.beginPath();
        ctx.moveTo(loadX, beamY - 40);
        ctx.lineTo(loadX, beamY - 10);
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(loadX - 5, beamY - 15);
        ctx.lineTo(loadX, beamY - 10);
        ctx.lineTo(loadX + 5, beamY - 15);
        ctx.stroke();

        // Label
        ctx.fillStyle = "#DC2626";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${load.magnitude}kN`, loadX, beamY - 45);
      });

      // UDL loads
      beamData.udl_loads.forEach((load) => {
        const spanStart =
          margin +
          beamData.spans
            .slice(0, load.span_index)
            .reduce((sum, span) => sum + span * scale, 0);
        const startX = spanStart + load.start_position * scale;
        const endX = spanStart + load.end_position * scale;

        // Draw distributed load arrows
        const numArrows = Math.floor((endX - startX) / 15);
        for (let i = 0; i <= numArrows; i++) {
          const arrowX = startX + (i / numArrows) * (endX - startX);

          ctx.beginPath();
          ctx.moveTo(arrowX, beamY - 30);
          ctx.lineTo(arrowX, beamY - 10);
          ctx.stroke();

          // Arrow head
          ctx.beginPath();
          ctx.moveTo(arrowX - 3, beamY - 13);
          ctx.lineTo(arrowX, beamY - 10);
          ctx.lineTo(arrowX + 3, beamY - 13);
          ctx.stroke();
        }

        // Top line
        ctx.beginPath();
        ctx.moveTo(startX, beamY - 30);
        ctx.lineTo(endX, beamY - 30);
        ctx.stroke();

        // Label
        ctx.fillStyle = "#DC2626";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${load.magnitude}kN/m`, (startX + endX) / 2, beamY - 35);
      });
    }, [beamData]);

    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">
          Beam Schematic
        </h3>
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full bg-gray-700 rounded border"
        />
      </div>
    );
  }

  const renderChart = (data, positions, title, color, yLabel) => {
    const chartData = data
      .map((spanData, spanIndex) =>
        spanData.map((value, pointIndex) => ({
          x: positions[spanIndex][pointIndex],
          y: value,
          span: spanIndex,
        }))
      )
      .flat();

    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="x"
              stroke="#9CA3AF"
              label={{
                value: "Position (m)",
                position: "insideBottom",
                offset: -10,
                fill: "#9CA3AF",
              }}
            />
            <YAxis
              stroke="#9CA3AF"
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                fill: "#9CA3AF",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#374151",
                border: "1px solid #6B7280",
                borderRadius: "6px",
                color: "#F9FAFB",
              }}
              formatter={(value, name) => [`${value.toFixed(2)}`, yLabel]}
              labelFormatter={(value) => `Position: ${value.toFixed(2)} m`}
            />
            <Line
              type="monotone"
              dataKey="y"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="w-8 h-8 text-blue-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Structural Analysis Suite
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Indeterminate Beam Analysis using Moment Distribution Method
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Following British Standards (BS) Conventions
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("input")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "input"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              Input Design
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "results"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
              disabled={!results}
            >
              Analysis Results
            </button>
          </div>
        </div>

        {activeTab === "input" && (
          <div className="space-y-8">
            {/* Beam Configuration */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <Calculator className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-bold text-white">
                  Beam Configuration
                </h2>
              </div>

              {/* Spans */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-200">Spans</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={addSpan}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Span
                    </button>
                    <button
                      onClick={removeSpan}
                      disabled={beamData.spans.length <= 2}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {beamData.spans.map((span, i) => (
                    <div key={i} className="bg-gray-700 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Span {i + 1} Length (m)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={span}
                        onChange={(e) => updateSpan(i, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Supports */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-200 mb-4">
                  Support Conditions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {beamData.supports.map((support, i) => (
                    <div key={i} className="bg-gray-700 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Support {i + 1}
                      </label>
                      <select
                        value={support}
                        onChange={(e) => updateSupport(i, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {supportTypes.map((type) => (
                          <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Material Properties */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-200 mb-4">
                  Material Properties
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Young's Modulus E (MPa)
                    </label>
                    <input
                      type="number"
                      value={beamData.material.E}
                      onChange={(e) =>
                        setBeamData((prev) => ({
                          ...prev,
                          material: {
                            ...prev.material,
                            E: parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Second Moment of Area I (mm⁴)
                    </label>
                    <input
                      type="number"
                      value={beamData.material.I}
                      onChange={(e) =>
                        setBeamData((prev) => ({
                          ...prev,
                          material: {
                            ...prev.material,
                            I: parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Loading Configuration */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                Loading Configuration
              </h2>

              {/* Point Loads */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-200">
                    Point Loads
                  </h3>

                  <button
                    onClick={addPointLoad}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Point Load
                  </button>

                  <button
                    onClick={addUDLLoad}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add UDL Load
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Point Load Addition */}

                  {beamData.point_loads.map((load, i) => (
                    <div key={i} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-200">
                          Point Load {i + 1}
                        </h4>
                        <button
                          onClick={() => removeLoad("point", i)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Magnitude (kN)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={load.magnitude}
                            onChange={(e) =>
                              updateLoad(
                                "point",
                                i,
                                "magnitude",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Span
                          </label>
                          <select
                            value={load.span_index}
                            onChange={(e) =>
                              updateLoad("udl", i, "span_index", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {beamData.spans.map((_, spanIndex) => (
                              <option key={spanIndex} value={spanIndex}>
                                Span {spanIndex + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* UDL Load Addition */}
                  {beamData.udl_loads.map((load, i) => (
                    <div key={i} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-200">
                          UDL Load {i + 1}
                        </h4>
                        <button
                          onClick={() => removeLoad("udl", i)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Magnitude (kN)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={load.magnitude}
                            onChange={(e) =>
                              updateLoad("udlt", i, "magnitude", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Span
                          </label>
                          <select
                            value={load.span_index}
                            onChange={(e) =>
                              updateLoad("udl", i, "span_index", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {beamData.spans.map((_, spanIndex) => (
                              <option key={spanIndex} value={spanIndex}>
                                Span {spanIndex + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Beam Schematic */}
            <BeamSchematic beamData={beamData} />

            {/* Analyze Button */}
            <div className="text-center">
              <button
                onClick={analyzeBeam}
                disabled={loading}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-lg text-lg shadow-lg transform transition-all duration-200 hover:scale-105 disabled:scale-100"
              >
                <Calculator className="w-6 h-6" />
                {loading ? "Analyzing..." : "Analyze Beam"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "results" && results && (
          <div className="space-y-8">
            {/* Analysis Summary */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                Analysis Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {results.convergence_achieved
                      ? "CONVERGED"
                      : "NOT CONVERGED"}
                  </div>
                  <div className="text-gray-300 text-sm">Analysis Status</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {results.max_iterations}
                  </div>
                  <div className="text-gray-300 text-sm">Iterations</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {results.distribution_steps.length}
                  </div>
                  <div className="text-gray-300 text-sm">
                    Distribution Steps
                  </div>
                </div>
              </div>
            </div>

            {/* Moment Distribution Table */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                Moment Distribution Steps
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left py-3 px-4 text-gray-300">
                        Iteration
                      </th>
                      <th className="text-left py-3 px-4 text-gray-300">
                        Joint
                      </th>
                      <th className="text-right py-3 px-4 text-gray-300">
                        Unbalanced Moment
                      </th>
                      <th className="text-right py-3 px-4 text-gray-300">
                        Distribution Factors
                      </th>
                      <th className="text-right py-3 px-4 text-gray-300">
                        Distributed Moments
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.distribution_steps.map((step, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-700 hover:bg-gray-750"
                      >
                        <td className="py-3 px-4 text-white">
                          {step.iteration}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {step.joint_index + 1}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {step.unbalanced_moment.toFixed(2)} kN·m
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          [
                          {step.distribution_factors
                            .map((f) => f.toFixed(3))
                            .join(", ")}
                          ]
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          [
                          {step.distributed_moments
                            .map((m) => m.toFixed(2))
                            .join(", ")}
                          ]
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Support Reactions */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                Support Reactions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {results.support_reactions.map((reaction, i) => (
                  <div
                    key={i}
                    className="bg-gray-700 rounded-lg p-4 text-center"
                  >
                    <div className="text-xl font-bold text-blue-400">
                      {reaction.toFixed(2)} kN
                    </div>
                    <div className="text-gray-300 text-sm">Support {i + 1}</div>
                    <div className="text-gray-400 text-xs mt-1">
                      ({beamData.supports[i]})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Moments */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                Final Support Moments
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {results.final_moments.map((moment, i) => (
                  <div
                    key={i}
                    className="bg-gray-700 rounded-lg p-4 text-center"
                  >
                    <div className="text-xl font-bold text-purple-400">
                      {moment.toFixed(2)} kN·m
                    </div>
                    <div className="text-gray-300 text-sm">Support {i + 1}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Diagrams */}

            <BeamSchematic beamData={beamData} />

            <div className="space-y-6">
              {/* Shear Force Diagram */}
              {renderChart(
                results.sfd_values,
                results.sfd_positions,
                "Shear Force Diagram",
                "#10B981",
                "Shear Force (kN)"
              )}

              {/* Bending Moment Diagram */}
              {renderChart(
                results.bmd_values,
                results.bmd_positions,
                "Bending Moment Diagram",
                "#F59E0B",
                "Bending Moment (kN·m)"
              )}
            </div>

            {/* Export Options */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                Export Results
              </h2>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    const dataStr = JSON.stringify(results, null, 2);
                    const dataBlob = new Blob([dataStr], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "beam_analysis_results.json";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download JSON
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StructuralAnalysisApp;
