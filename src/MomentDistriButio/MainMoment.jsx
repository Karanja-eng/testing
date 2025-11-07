// src/App.js
import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
} from "recharts";
import { calculateMomentDistribution } from "./api";
import BeamDiagram from "./BeamDiagram";

const App = () => {
  const [activeForm, setActiveForm] = useState("material");
  const [formData, setFormData] = useState({
    spans: [4], // Default to 1 span
    loads: [{ load_type: "udl", magnitude: 3, position: null }],
    supports: ["pinned", "pinned"],
    settlements: [0, 0],
    E: 2e8,
    I: 2e-4,
    left_cantilever: {
      length: 0,
      load: { load_type: "none", magnitude: 0, position: 0 },
    },
    right_cantilever: {
      length: 2,
      load: { load_type: "udl", magnitude: 3, position: null },
    },
  });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const inputRefs = useRef([]);

  // Update dependent arrays when span count changes
  useEffect(() => {
    const spanCount = formData.spans.length;
    const newLoads = Array(spanCount)
      .fill()
      .map(
        (_, i) =>
          formData.loads[i] || {
            load_type: "none",
            magnitude: 0,
            position: null,
          }
      );
    const newSupports = Array(spanCount + 1)
      .fill()
      .map((_, i) => formData.supports[i] || "pinned");
    const newSettlements = Array(spanCount + 1)
      .fill()
      .map((_, i) => formData.settlements[i] || 0);
    setFormData((prev) => ({
      ...prev,
      loads: newLoads,
      supports: newSupports,
      settlements: newSettlements,
    }));
    inputRefs.current = inputRefs.current.slice(0, spanCount); // Reset refs based on span count
  }, [formData.spans.length]);

  const handleSpanChange = (index, field, value) => {
    const newSpans = [...formData.spans];
    const newLoads = [...formData.loads];
    const newSupports = [...formData.supports];
    const newSettlements = [...formData.settlements];

    if (field === "count") {
      const count = parseInt(value) || 1;
      newSpans.length = count;
      newLoads.length = count;
      newSupports.length = count + 1;
      newSettlements.length = count + 1;
      for (let i = 0; i < count; i++) {
        newSpans[i] = newSpans[i] || 4;
        newLoads[i] = newLoads[i] || {
          load_type: "none",
          magnitude: 0,
          position: null,
        };
      }
      for (let i = 0; i <= count; i++) {
        newSupports[i] = newSupports[i] || "pinned";
        newSettlements[i] = newSettlements[i] || 0;
      }
    } else if (field === "length") {
      newSpans[index] = parseFloat(value) || 0;
    } else if (field === "load_type") {
      newLoads[index] = {
        ...newLoads[index],
        load_type: value,
        position: value === "point" ? 0 : null,
      };
    } else if (field === "magnitude") {
      newLoads[index] = {
        ...newLoads[index],
        magnitude: parseFloat(value) || 0,
      };
    } else if (field === "position") {
      newLoads[index] = {
        ...newLoads[index],
        position: parseFloat(value) || 0,
      };
    } else if (field === "support") {
      newSupports[index] = value;
    } else if (field === "settlement") {
      newSettlements[index] = parseFloat(value) || 0;
    }

    setFormData({
      ...formData,
      spans: newSpans,
      loads: newLoads,
      supports: newSupports,
      settlements: newSettlements,
    });
  };

  const handleCantileverChange = (side, field, value) => {
    const newCantilever = { ...formData[side] };
    if (field === "length") {
      newCantilever.length = parseFloat(value) || 0;
    } else if (field === "load_type") {
      newCantilever.load = {
        ...newCantilever.load,
        load_type: value,
        position: value === "point" ? 0 : null,
      };
    } else if (field === "magnitude") {
      newCantilever.load = {
        ...newCantilever.load,
        magnitude: parseFloat(value) || 0,
      };
    } else if (field === "position") {
      newCantilever.load = {
        ...newCantilever.load,
        position: parseFloat(value) || 0,
      };
    }
    setFormData({ ...formData, [side]: newCantilever });
  };

  const handleMaterialChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: parseFloat(value) || (field === "E" ? 2e8 : 2e-4),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const data = {
        ...formData,
        left_cantilever:
          formData.left_cantilever.length > 0 ? formData.left_cantilever : null,
        right_cantilever:
          formData.right_cantilever.length > 0
            ? formData.right_cantilever
            : null,
      };
      const result = await calculateMomentDistribution(data);
      // Transform bm_data to use support moments for straight lines
      const supportMoments = result.moments.map((m, i) => ({
        x:
          result.beam_diagram.elements.find(
            (e) =>
              e.type === "support" && e.label === String.fromCharCode(65 + i)
          )?.x || 0,
        bm: m,
      }));
      result.bm_data = supportMoments; // Override with straight-line data
      setResults(result);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInputKeyPress = (e, nextFieldCallback) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextFieldCallback();
    } else if (
      e.key === "Backspace" &&
      e.target.value === "" &&
      e.target.previousSibling
    ) {
      e.preventDefault();
      e.target.previousSibling.focus();
    }
  };

  const focusNextInput = (currentIndex, formSection) => {
    const inputs = inputRefs.current.filter(
      (ref) => ref && ref.closest(`.${formSection}`)
    );
    const nextIndex = (currentIndex + 1) % inputs.length;
    if (inputs[nextIndex]) inputs[nextIndex].focus();
  };

  const renderForm = () => {
    switch (activeForm) {
      case "material":
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Material Properties</h3>
            <div>
              <label className="text-md">Young's Modulus E (kN/m²):</label>
              <input
                ref={(el) => (inputRefs.current[0] = el)}
                type="number"
                value={formData.E}
                onChange={(e) => handleMaterialChange("E", e.target.value)}
                onKeyPress={(e) =>
                  handleInputKeyPress(e, () => focusNextInput(0, "material"))
                }
                className="mt-1 p-2 border rounded w-full max-w-xs"
              />
            </div>
            <div>
              <label className="text-md">Moment of Inertia I (m⁴):</label>
              <input
                ref={(el) => (inputRefs.current[1] = el)}
                type="number"
                value={formData.I}
                onChange={(e) => handleMaterialChange("I", e.target.value)}
                onKeyPress={(e) =>
                  handleInputKeyPress(e, () => setActiveForm("left_cantilever"))
                }
                className="mt-1 p-2 border rounded w-full max-w-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setActiveForm("left_cantilever")}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Next: Left Cantilever
            </button>
          </div>
        );
      case "left_cantilever":
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Left Cantilever</h3>
            <div>
              <label className="text-md">Length (m):</label>
              <input
                ref={(el) => (inputRefs.current[2] = el)}
                type="number"
                value={formData.left_cantilever.length}
                onChange={(e) =>
                  handleCantileverChange(
                    "left_cantilever",
                    "length",
                    e.target.value
                  )
                }
                onKeyPress={(e) =>
                  handleInputKeyPress(e, () =>
                    focusNextInput(2, "left_cantilever")
                  )
                }
                className="mt-1 p-2 border rounded w-full max-w-xs"
              />
            </div>
            <div>
              <label className="text-md">Load Type:</label>
              <select
                ref={(el) => (inputRefs.current[3] = el)}
                value={formData.left_cantilever.load.load_type}
                onChange={(e) =>
                  handleCantileverChange(
                    "left_cantilever",
                    "load_type",
                    e.target.value
                  )
                }
                onKeyPress={(e) =>
                  handleInputKeyPress(e, () =>
                    focusNextInput(3, "left_cantilever")
                  )
                }
                className="mt-1 p-2 border rounded w-full max-w-xs"
              >
                <option value="none">None</option>
                <option value="udl">UDL</option>
                <option value="point">Point</option>
              </select>
            </div>
            <div>
              <label className="text-md">Magnitude (kN or kN/m):</label>
              <input
                ref={(el) => (inputRefs.current[4] = el)}
                type="number"
                value={formData.left_cantilever.load.magnitude}
                onChange={(e) =>
                  handleCantileverChange(
                    "left_cantilever",
                    "magnitude",
                    e.target.value
                  )
                }
                onKeyPress={(e) =>
                  handleInputKeyPress(e, () =>
                    focusNextInput(4, "left_cantilever")
                  )
                }
                className="mt-1 p-2 border rounded w-full max-w-xs"
              />
            </div>
            {formData.left_cantilever.load.load_type === "point" && (
              <div>
                <label className="text-md">Position (m):</label>
                <input
                  ref={(el) => (inputRefs.current[5] = el)}
                  type="number"
                  value={formData.left_cantilever.load.position}
                  onChange={(e) =>
                    handleCantileverChange(
                      "left_cantilever",
                      "position",
                      e.target.value
                    )
                  }
                  onKeyPress={(e) =>
                    handleInputKeyPress(e, () =>
                      setActiveForm("right_cantilever")
                    )
                  }
                  className="mt-1 p-2 border rounded w-full max-w-xs"
                />
              </div>
            )}
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setActiveForm("material")}
                className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setActiveForm("right_cantilever")}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Next: Right Cantilever
              </button>
            </div>
          </div>
        );
      case "right_cantilever":
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Right Cantilever</h3>
            <div>
              <label className="text-md">Length (m):</label>
              <input
                ref={(el) => (inputRefs.current[6] = el)}
                type="number"
                value={formData.right_cantilever.length}
                onChange={(e) =>
                  handleCantileverChange(
                    "right_cantilever",
                    "length",
                    e.target.value
                  )
                }
                onKeyPress={(e) =>
                  handleInputKeyPress(e, () =>
                    focusNextInput(6, "right_cantilever")
                  )
                }
                className="mt-1 p-2 border rounded w-full max-w-xs"
              />
            </div>
            <div>
              <label className="text-md">Load Type:</label>
              <select
                ref={(el) => (inputRefs.current[7] = el)}
                value={formData.right_cantilever.load.load_type}
                onChange={(e) =>
                  handleCantileverChange(
                    "right_cantilever",
                    "load_type",
                    e.target.value
                  )
                }
                onKeyPress={(e) =>
                  handleInputKeyPress(e, () =>
                    focusNextInput(7, "right_cantilever")
                  )
                }
                className="mt-1 p-2 border rounded w-full max-w-xs"
              >
                <option value="none">None</option>
                <option value="udl">UDL</option>
                <option value="point">Point</option>
              </select>
            </div>
            <div>
              <label className="text-md">Magnitude (kN or kN/m):</label>
              <input
                ref={(el) => (inputRefs.current[8] = el)}
                type="number"
                value={formData.right_cantilever.load.magnitude}
                onChange={(e) =>
                  handleCantileverChange(
                    "right_cantilever",
                    "magnitude",
                    e.target.value
                  )
                }
                onKeyPress={(e) =>
                  handleInputKeyPress(e, () =>
                    focusNextInput(8, "right_cantilever")
                  )
                }
                className="mt-1 p-2 border rounded w-full max-w-xs"
              />
            </div>
            {formData.right_cantilever.load.load_type === "point" && (
              <div>
                <label className="text-md">Position (m):</label>
                <input
                  ref={(el) => (inputRefs.current[9] = el)}
                  type="number"
                  value={formData.right_cantilever.load.position}
                  onChange={(e) =>
                    handleCantileverChange(
                      "right_cantilever",
                      "position",
                      e.target.value
                    )
                  }
                  onKeyPress={(e) =>
                    handleInputKeyPress(e, () => setActiveForm("main_spans"))
                  }
                  className="mt-1 p-2 border rounded w-full max-w-xs"
                />
              </div>
            )}
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setActiveForm("left_cantilever")}
                className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setActiveForm("main_spans")}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Next: Main Spans
              </button>
            </div>
          </div>
        );
      case "main_spans":
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Main Spans</h3>
            <div>
              <label className="text-md">Number of Spans:</label>
              <input
                ref={(el) => (inputRefs.current[10] = el)}
                type="number"
                min="1"
                value={formData.spans.length}
                onChange={(e) => handleSpanChange(0, "count", e.target.value)}
                onKeyPress={(e) =>
                  handleInputKeyPress(e, () => focusNextInput(10, "main_spans"))
                }
                className="mt-1 p-2 border rounded w-full max-w-xs"
              />
            </div>
            {formData.spans.map((span, index) => (
              <div key={index} className="mb-4 p-2 border rounded-lg">
                <h4 className="text-lg font-medium">Span {index + 1}</h4>
                <div className="flex flex-col space-y-2">
                  <div>
                    <label className="text-md">Length (m):</label>
                    <input
                      ref={(el) => (inputRefs.current[11 + index * 4] = el)}
                      type="number"
                      value={span}
                      onChange={(e) =>
                        handleSpanChange(index, "length", e.target.value)
                      }
                      onKeyPress={(e) =>
                        handleInputKeyPress(e, () =>
                          focusNextInput(11 + index * 4, "main_spans")
                        )
                      }
                      className="mt-1 p-2 border rounded w-full max-w-xs"
                    />
                  </div>
                  <div>
                    <label className="text-md">Load Type:</label>
                    <select
                      ref={(el) => (inputRefs.current[12 + index * 4] = el)}
                      value={formData.loads[index].load_type}
                      onChange={(e) =>
                        handleSpanChange(index, "load_type", e.target.value)
                      }
                      onKeyPress={(e) =>
                        handleInputKeyPress(e, () =>
                          focusNavigation(index, "main_spans")
                        )
                      }
                      className="mt-1 p-2 border rounded w-full max-w-xs"
                    >
                      <option value="none">None</option>
                      <option value="udl">UDL</option>
                      <option value="point">Point</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-md">Magnitude (kN or kN/m):</label>
                    <input
                      ref={(el) => (inputRefs.current[13 + index * 4] = el)}
                      type="number"
                      value={formData.loads[index].magnitude}
                      onChange={(e) =>
                        handleSpanChange(index, "magnitude", e.target.value)
                      }
                      onKeyPress={(e) =>
                        handleInputKeyPress(e, () =>
                          focusNextMagnitudeOrPosition(index, "main_spans")
                        )
                      }
                      className="mt-1 p-2 border rounded w-full max-w-xs"
                    />
                  </div>
                  {formData.loads[index].load_type === "point" && (
                    <div>
                      <label className="text-md">Position (m):</label>
                      <input
                        ref={(el) => (inputRefs.current[14 + index * 4] = el)}
                        type="number"
                        value={formData.loads[index].position}
                        onChange={(e) =>
                          handleSpanChange(index, "position", e.target.value)
                        }
                        onKeyPress={(e) =>
                          handleInputKeyPress(e, () =>
                            index < formData.spans.length - 1
                              ? focusNextInput(
                                  11 + (index + 1) * 4,
                                  "main_spans"
                                )
                              : setActiveForm("supports")
                          )
                        }
                        className="mt-1 p-2 border rounded w-full max-w-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setActiveForm("right_cantilever")}
                className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setActiveForm("supports")}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Next: Supports
              </button>
            </div>
          </div>
        );
      case "supports":
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Supports</h3>
            {formData.supports.map((support, index) => (
              <div key={index} className="mb-4 flex flex-col space-y-2">
                <label className="text-md">
                  Support {String.fromCharCode(65 + index)} Type:
                </label>
                <select
                  ref={(el) => (inputRefs.current[15 + index * 2] = el)}
                  value={support}
                  onChange={(e) =>
                    handleSpanChange(index, "support", e.target.value)
                  }
                  onKeyPress={(e) =>
                    handleInputKeyPress(e, () =>
                      focusNextInput(15 + index * 2, "supports")
                    )
                  }
                  className="p-2 border rounded w-full max-w-xs"
                >
                  {index === 0 || index === formData.spans.length ? (
                    <>
                      <option value="fixed">Fixed</option>
                      <option value="pinned">Pinned</option>
                      <option value="roller">Roller</option>
                    </>
                  ) : (
                    <>
                      <option value="pinned">Pinned</option>
                      <option value="roller">Roller</option>
                    </>
                  )}
                </select>
                <label className="text-md">Settlement (mm):</label>
                <input
                  ref={(el) => (inputRefs.current[16 + index * 2] = el)}
                  type="number"
                  value={formData.settlements[index]}
                  onChange={(e) =>
                    handleSpanChange(index, "settlement", e.target.value)
                  }
                  onKeyPress={(e) =>
                    handleInputKeyPress(e, () =>
                      index < formData.supports.length - 1
                        ? focusNextInput(15 + (index + 1) * 2, "supports")
                        : handleSubmit(e)
                    )
                  }
                  className="p-2 border rounded w-full max-w-xs"
                />
              </div>
            ))}
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setActiveForm("main_spans")}
                className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Back
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Calculate
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const focusNavigation = (index, formSection) => {
    const baseIndex = 12 + index * 4;
    focusNextInput(baseIndex, formSection);
  };

  const focusNextMagnitudeOrPosition = (index, formSection) => {
    const baseIndex = 13 + index * 4;
    if (
      formData.loads[index].load_type === "point" &&
      inputRefs.current[14 + index * 4]
    ) {
      inputRefs.current[14 + index * 4].focus();
    } else if (index < formData.spans.length - 1) {
      inputRefs.current[11 + (index + 1) * 4].focus();
    } else {
      setActiveForm("supports");
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Moment Distribution Calculator
      </h1>
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setActiveForm("material")}
          className={`px-4 py-2 rounded ${
            activeForm === "material" ? "bg-blue-700 text-white" : "bg-gray-300"
          }`}
        >
          Material
        </button>
        <button
          onClick={() => setActiveForm("left_cantilever")}
          className={`px-4 py-2 rounded ${
            activeForm === "left_cantilever"
              ? "bg-blue-700 text-white"
              : "bg-gray-300"
          }`}
        >
          Left Cantilever
        </button>
        <button
          onClick={() => setActiveForm("right_cantilever")}
          className={`px-4 py-2 rounded ${
            activeForm === "right_cantilever"
              ? "bg-blue-700 text-white"
              : "bg-gray-300"
          }`}
        >
          Right Cantilever
        </button>
        <button
          onClick={() => setActiveForm("main_spans")}
          className={`px-4 py-2 rounded ${
            activeForm === "main_spans"
              ? "bg-blue-700 text-white"
              : "bg-gray-300"
          }`}
        >
          Main Spans
        </button>
        <button
          onClick={() => setActiveForm("supports")}
          className={`px-4 py-2 rounded ${
            activeForm === "supports" ? "bg-blue-700 text-white" : "bg-gray-300"
          }`}
        >
          Supports
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {renderForm()}
      </form>
      {error && <p className="text-red-500 mt-4">{error}</p>}
      {results && (
        <div className="mt-6 space-y-6">
          <h2 className="text-2xl font-bold">Results</h2>
          <h3 className="text-xl font-medium">Moments at Supports (kNm)</h3>
          <ul className="list-disc pl-5">
            {results.moments.map((m, i) => (
              <li key={i}>
                Support {String.fromCharCode(65 + i)}: {m}
              </li>
            ))}
          </ul>
          <h3 className="text-xl font-medium">Moments at Midspan (kNm)</h3>
          <ul className="list-disc pl-5">
            {results.midspan_moments.map((m, i) => (
              <li key={i}>
                {m.support}: {m.bm}
              </li>
            ))}
          </ul>
          <h3 className="text-xl font-medium">Reactions (kN)</h3>
          <ul className="list-disc pl-5">
            {results.reactions.map((r, i) => (
              <li key={i}>
                Support {String.fromCharCode(65 + i)}: {r}
              </li>
            ))}
          </ul>
          <h3 className="text-xl font-medium">Beam Diagram</h3>
          <BeamDiagram diagram={results.beam_diagram} />
          <h3 className="text-xl font-medium">Shear Force Diagram</h3>
          <LineChart
            width={600}
            height={300}
            data={results.sf_data}
            className="mx-auto"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              label={{ value: "Length (m)", position: "bottom" }}
            />
            <YAxis
              label={{
                value: "Shear Force (kN)",
                angle: -90,
                position: "insideLeft",
              }}
              domain={["auto", "auto"]}
            />
            <Tooltip />
            <Legend verticalAlign="top" align="right" height={36} />
            <Line
              type="linear"
              dataKey="sf"
              stroke="blue"
              name="Shear Force"
              dot={false}
            />
          </LineChart>
          <h3 className="text-xl font-medium">Bending Moment Diagram</h3>
          <LineChart
            width={600}
            height={300}
            data={results.bm_data}
            className="mx-auto"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              label={{ value: "Length (m)", position: "bottom" }}
            />
            <YAxis
              label={{
                value: "Bending Moment (kNm)",
                angle: -90,
                position: "insideLeft",
              }}
              domain={["auto", (dataMax) => Math.ceil(dataMax * 1.2)]}
            />
            <Tooltip />
            <Legend verticalAlign="top" align="right" height={36} />
            <Line
              type="step"
              dataKey="bm"
              stroke="blue"
              name="Distributed Moment"
              dot={false}
            />{" "}
            {/* Straight lines, blue */}
            <Line
              type="linear"
              data={results.initial_bm_data}
              dataKey="bm"
              stroke="green"
              name="Initial Moment"
              dot={false}
            />
          </LineChart>
        </div>
      )}
    </div>
  );
};

export default App;
