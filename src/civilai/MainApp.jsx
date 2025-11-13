import React, { useState } from "react";
import { Upload, Settings, Loader } from "lucide-react";
import FloorplanViewer from "./FloorplanViewer.jsx";

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Parameters with sensible defaults
  const [params, setParams] = useState({
    scale: 0.01,
    wall_height: 3.0,
    wall_threshold: 0.15,
    yolo_conf: 0.25,
    use_yolo: true,
    min_wall_area: 100,
  });

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setUrl("");
    setStats(null);

    try {
      const form = new FormData();
      form.append("file", file);

      // Add all parameters
      Object.entries(params).forEach(([key, value]) => {
        form.append(key, value.toString());
      });

      const res = await fetch("http://localhost:8001/convert", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (res.ok) {
        setUrl(`http://localhost:8001${data.glb_url}`);
        setStats({
          polygonCount: data.polygon_count,
          parameters: data.parameters,
        });
      } else {
        setError(data.detail || "Unknown error occurred");
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function updateParam(key, value) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: "320px",
          background: "#1e293b",
          borderRight: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid #334155",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: "bold",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Floorplan to 3D
          </h1>
          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: "14px",
              color: "#94a3b8",
            }}
          >
            Upload a floorplan image to generate a 3D model
          </p>
        </div>

        {/* Upload Section */}
        <div style={{ padding: "24px" }}>
          <label
            style={{
              display: "block",
              width: "100%",
              padding: "32px 16px",
              border: "2px dashed #475569",
              borderRadius: "12px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s",
              background: loading ? "#1e293b" : "#0f172a",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "#667eea")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "#475569")
            }
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              disabled={loading}
              style={{ display: "none" }}
            />
            {loading ? (
              <Loader
                style={{
                  margin: "0 auto",
                  animation: "spin 1s linear infinite",
                }}
              />
            ) : (
              <Upload
                style={{ margin: "0 auto", color: "#667eea" }}
                size={32}
              />
            )}
            <p
              style={{
                margin: "12px 0 0 0",
                fontSize: "14px",
                color: "#cbd5e1",
              }}
            >
              {loading ? "Processing..." : "Click to upload floorplan"}
            </p>
          </label>

          {error && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                background: "#dc2626",
                borderRadius: "8px",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              {error}
            </div>
          )}

          {stats && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                background: "#059669",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              ✓ Successfully extracted {stats.polygonCount} walls
            </div>
          )}
        </div>

        {/* Settings Toggle */}
        <div style={{ padding: "0 24px" }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              width: "100%",
              padding: "12px",
              background: "#334155",
              border: "none",
              borderRadius: "8px",
              color: "#e2e8f0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            <Settings size={16} />
            {showSettings ? "Hide" : "Show"} Advanced Settings
          </button>
        </div>

        {/* Advanced Settings */}
        {showSettings && (
          <div
            style={{
              padding: "24px",
              borderTop: "1px solid #334155",
              marginTop: "16px",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "14px",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#94a3b8",
              }}
            >
              Detection Parameters
            </h3>

            {/* Wall Threshold */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: "#cbd5e1",
                }}
              >
                Wall Threshold: {params.wall_threshold}
              </label>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={params.wall_threshold}
                onChange={(e) =>
                  updateParam("wall_threshold", parseFloat(e.target.value))
                }
                style={{ width: "100%" }}
              />
              <p
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  margin: "4px 0 0 0",
                }}
              >
                Lower = detect more walls (try 0.10-0.20)
              </p>
            </div>

            {/* YOLO Confidence */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={params.use_yolo}
                  onChange={(e) => updateParam("use_yolo", e.target.checked)}
                />
                <span style={{ fontSize: "13px", color: "#cbd5e1" }}>
                  Enable YOLO Boost
                </span>
              </label>
              {params.use_yolo && (
                <>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      marginBottom: "8px",
                      color: "#cbd5e1",
                    }}
                  >
                    YOLO Confidence: {params.yolo_conf}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={params.yolo_conf}
                    onChange={(e) =>
                      updateParam("yolo_conf", parseFloat(e.target.value))
                    }
                    style={{ width: "100%" }}
                  />
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      margin: "4px 0 0 0",
                    }}
                  >
                    Lower = detect more objects (try 0.20-0.30)
                  </p>
                </>
              )}
            </div>

            {/* Min Wall Area */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: "#cbd5e1",
                }}
              >
                Min Wall Area: {params.min_wall_area}
              </label>
              <input
                type="range"
                min="50"
                max="500"
                step="50"
                value={params.min_wall_area}
                onChange={(e) =>
                  updateParam("min_wall_area", parseFloat(e.target.value))
                }
                style={{ width: "100%" }}
              />
              <p
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  margin: "4px 0 0 0",
                }}
              >
                Filter out small artifacts
              </p>
            </div>

            <h3
              style={{
                margin: "24px 0 16px 0",
                fontSize: "14px",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#94a3b8",
              }}
            >
              3D Model Settings
            </h3>

            {/* Scale */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: "#cbd5e1",
                }}
              >
                Scale: {params.scale}
              </label>
              <input
                type="range"
                min="0.001"
                max="0.1"
                step="0.001"
                value={params.scale}
                onChange={(e) =>
                  updateParam("scale", parseFloat(e.target.value))
                }
                style={{ width: "100%" }}
              />
            </div>

            {/* Wall Height */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: "#cbd5e1",
                }}
              >
                Wall Height: {params.wall_height}m
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={params.wall_height}
                onChange={(e) =>
                  updateParam("wall_height", parseFloat(e.target.value))
                }
                style={{ width: "100%" }}
              />
            </div>
          </div>
        )}

        {/* Tips */}
        <div
          style={{
            padding: "24px",
            marginTop: "auto",
            borderTop: "1px solid #334155",
            fontSize: "12px",
            color: "#64748b",
            lineHeight: "1.6",
          }}
        >
          <strong style={{ color: "#94a3b8" }}>💡 Tips:</strong>
          <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
            <li>Lower wall_threshold if walls are missing</li>
            <li>Lower YOLO confidence to detect more features</li>
            <li>Higher min_wall_area removes noise</li>
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          padding: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {url ? (
          <FloorplanViewer url={url} />
        ) : (
          <div style={{ textAlign: "center", color: "#64748b" }}>
            <Upload size={64} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
            <p style={{ fontSize: "18px", margin: 0 }}>No model yet</p>
            <p style={{ fontSize: "14px", margin: "8px 0 0 0" }}>
              Upload a floorplan to get started
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: #334155;
          border-radius: 3px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #667eea;
          border-radius: 50%;
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #667eea;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
