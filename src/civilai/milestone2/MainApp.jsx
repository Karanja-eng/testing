import React, { useState, useEffect } from "react";
import { Upload, Settings, Loader, Zap, Trash2 } from "lucide-react";
import FloorplanViewer from "./FloorplanViewer.jsx";

export default function MainDApp() {
  const [fileId, setFileId] = useState("");
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Detect system theme
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check if parent window has dark mode
    const checkTheme = () => {
      if (window.matchMedia) {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: light)"
        ).matches;
        setIsDark(prefersDark);
      }
    };
    checkTheme();

    // Listen for theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
      const handler = (e) => setIsDark(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  const theme = {
    bg: isDark ? "#0f172a" : "#f8fafc",
    sidebar: isDark ? "#1e293b" : "#ffffff",
    border: isDark ? "#334155" : "#e2e8f0",
    text: isDark ? "#e2e8f0" : "#1e293b",
    textMuted: isDark ? "#94a3b8" : "#0a1c35ff",
    textDim: isDark ? "#64748b" : "#15345eff",
    button: isDark ? "#334155" : "#3a79b8ff",
    buttonHover: isDark ? "#475569" : "#1d4a86ff",
  };

  const [params, setParams] = useState({
    scale: 0.01,
    wall_height: 3.0,
    wall_threshold: 0.2,
    room_threshold: 0.3,
    yolo_conf: 0.3,
    use_yolo: true,
    min_wall_area: 200,
    max_walls: 25,
    extract_rooms: false,
    debug_vis: false,
  });

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setUrl("");
    setStats(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("http://localhost:8001/upload", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (res.ok) {
        setFileId(data.file_id);
        setFileName(data.filename);
        console.log("✓ File uploaded:", data);
      } else {
        setError(data.detail || "Upload failed");
      }
    } catch (err) {
      setError(`Upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    if (!fileId) {
      setError("Please upload a file first");
      return;
    }

    setProcessing(true);
    setError("");
    setUrl("");

    try {
      const form = new FormData();
      form.append("file_id", fileId);

      // Add all parameters
      Object.entries(params).forEach(([key, value]) => {
        form.append(key, value.toString());
      });

      const res = await fetch("http://localhost:8001/process", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (res.ok) {
        setUrl(`http://localhost:8001${data.glb_url}`);
        setStats({
          wallCount: data.wall_count,
          roomCount: data.room_count,
          parameters: data.parameters,
        });
      } else {
        setError(data.detail || "Processing failed");
      }
    } catch (err) {
      setError(`Processing error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  function updateParam(key, value) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  async function handleClear() {
    if (fileId) {
      try {
        await fetch(`http://localhost:8001/file/${fileId}`, {
          method: "DELETE",
        });
      } catch (e) {
        console.error("Failed to delete file:", e);
      }
    }
    setFileId("");
    setFileName("");
    setUrl("");
    setStats(null);
    setError("");
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: theme.bg,
        color: theme.text,
        fontFamily: "system-ui, -apple-system, sans-serif",
        transition: "background-color 0.3s, color 0.3s",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: "340px",
          background: theme.sidebar,
          borderRight: `1px solid ${theme.border}`,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          transition: "background-color 0.3s, border-color 0.3s",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px",
            borderBottom: `1px solid ${theme.border}`,
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
              color: theme.textMuted,
            }}
          >
            Upload → Adjust → Generate
          </p>
        </div>

        {/* Upload Section */}
        <div style={{ padding: "24px" }}>
          <label
            style={{
              display: "block",
              width: "100%",
              padding: "32px 16px",
              border: `2px dashed ${theme.border}`,
              borderRadius: "12px",
              textAlign: "center",
              cursor: uploading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              background: uploading ? theme.button : "transparent",
              opacity: uploading ? 0.6 : 1,
            }}
            onMouseEnter={(e) =>
              !uploading && (e.currentTarget.style.borderColor = "#667eea")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = theme.border)
            }
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              style={{ display: "none" }}
            />
            {uploading ? (
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
                color: theme.text,
              }}
            >
              {uploading
                ? "Uploading..."
                : fileName || "Click to upload floorplan"}
            </p>
          </label>

          {/* Generate Button */}
          {fileId && (
            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              <button
                onClick={handleGenerate}
                disabled={processing}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: processing
                    ? theme.button
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  borderRadius: "8px",
                  color: processing ? theme.text : "white",
                  cursor: processing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontSize: "15px",
                  fontWeight: "600",
                  opacity: processing ? 0.6 : 1,
                  transition: "all 0.2s",
                }}
              >
                {processing ? (
                  <>
                    <Loader
                      size={18}
                      style={{
                        animation: "spin 1s linear infinite",
                        color: "white",
                      }}
                    />

                    <p className="">Processing...</p>
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Generate 3D
                  </>
                )}
              </button>

              <button
                onClick={handleClear}
                disabled={processing}
                style={{
                  padding: "14px",
                  background: theme.button,
                  border: "none",
                  borderRadius: "8px",
                  color: theme.text,
                  cursor: processing ? "not-allowed" : "pointer",
                  opacity: processing ? 0.6 : 1,
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                background: "#dc2626",
                borderRadius: "8px",
                fontSize: "13px",
                lineHeight: "1.5",
                color: "white",
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
                color: "white",
              }}
            >
              ✓ {stats.wallCount} walls
              {stats.roomCount > 0 ? `, ${stats.roomCount} rooms` : ""}
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
              background: theme.button,
              border: "none",
              borderRadius: "8px",
              color: theme.text,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: "500",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = theme.buttonHover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = theme.button)
            }
          >
            <Settings size={16} />
            {showSettings ? "Hide" : "Show"} Parameters
          </button>
        </div>

        {/* Advanced Settings */}
        {showSettings && (
          <div
            style={{
              padding: "24px",
              borderTop: `1px solid ${theme.border}`,
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
                color: theme.textMuted,
              }}
            >
              Detection Settings
            </h3>

            {/* Wall Threshold */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: theme.text,
                }}
              >
                Wall Threshold: {params.wall_threshold.toFixed(2)}
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
                className="range-slider"
              />
              <p
                style={{
                  fontSize: "11px",
                  color: theme.textDim,
                  margin: "4px 0 0 0",
                }}
              >
                Lower = more walls detected (0.15-0.25 recommended)
              </p>
            </div>

            {/* Room Threshold */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: theme.text,
                }}
              >
                Room Threshold: {params.room_threshold.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
                value={params.room_threshold}
                onChange={(e) =>
                  updateParam("room_threshold", parseFloat(e.target.value))
                }
                style={{ width: "100%" }}
                className="range-slider"
              />
            </div>

            {/* Max Walls */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: theme.text,
                }}
              >
                Max Walls: {params.max_walls}
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={params.max_walls}
                onChange={(e) =>
                  updateParam("max_walls", parseInt(e.target.value))
                }
                style={{ width: "100%" }}
                className="range-slider"
              />
              <p
                style={{
                  fontSize: "11px",
                  color: theme.textDim,
                  margin: "4px 0 0 0",
                }}
              >
                Prevents over-segmentation (15-30 recommended)
              </p>
            </div>

            {/* YOLO Settings */}
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
                <span style={{ fontSize: "13px", color: theme.text }}>
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
                      color: theme.text,
                    }}
                  >
                    YOLO Confidence: {params.yolo_conf.toFixed(2)}
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
                    className="range-slider"
                  />
                  <p
                    style={{
                      fontSize: "11px",
                      color: theme.textDim,
                      margin: "4px 0 0 0",
                    }}
                  >
                    Lower = more detections (0.2-0.4 recommended)
                  </p>
                </>
              )}
            </div>

            {/* Extract Rooms */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="checkbox"
                  checked={params.extract_rooms}
                  onChange={(e) =>
                    updateParam("extract_rooms", e.target.checked)
                  }
                />
                <span style={{ fontSize: "13px", color: theme.text }}>
                  Extract Room Polygons
                </span>
              </label>
              <p
                style={{
                  fontSize: "11px",
                  color: theme.textDim,
                  margin: "4px 0 0 0",
                }}
              >
                Extract individual rooms in addition to walls
              </p>
            </div>

            {/* Min Wall Area */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: theme.text,
                }}
              >
                Min Area: {params.min_wall_area}
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
                className="range-slider"
              />
            </div>

            <h3
              style={{
                margin: "24px 0 16px 0",
                fontSize: "14px",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: theme.textMuted,
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
                  color: theme.text,
                }}
              >
                Scale: {params.scale.toFixed(3)}
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
                className="range-slider"
              />
            </div>

            {/* Wall Height */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: theme.text,
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
                className="range-slider"
              />
            </div>

            {/* Debug */}
            <div>
              <label
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="checkbox"
                  checked={params.debug_vis}
                  onChange={(e) => updateParam("debug_vis", e.target.checked)}
                />
                <span style={{ fontSize: "13px", color: theme.text }}>
                  Save Debug Images
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Tips */}
        <div
          style={{
            padding: "24px",
            marginTop: "auto",
            borderTop: `1px solid ${theme.border}`,
            fontSize: "12px",
            color: theme.textDim,
            lineHeight: "1.6",
          }}
        >
          <strong style={{ color: theme.textMuted }}>💡 Workflow:</strong>
          <ol style={{ margin: "8px 0", paddingLeft: "20px" }}>
            <li>Upload your floorplan image</li>
            <li>Adjust parameters if needed</li>
            <li>Click "Generate 3D"</li>
            <li>Tweak & regenerate anytime!</li>
          </ol>
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
          <div style={{ textAlign: "center", color: theme.textDim }}>
            <Upload size={64} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
            <p style={{ fontSize: "18px", margin: 0 }}>
              {fileId ? "Ready to generate!" : "No file uploaded"}
            </p>
            <p style={{ fontSize: "14px", margin: "8px 0 0 0" }}>
              {fileId
                ? 'Click "Generate 3D" to start'
                : "Upload a floorplan to begin"}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .range-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: ${theme.border};
          border-radius: 3px;
          outline: none;
        }
        .range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #667eea;
          border-radius: 50%;
          cursor: pointer;
        }
        .range-slider::-moz-range-thumb {
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
