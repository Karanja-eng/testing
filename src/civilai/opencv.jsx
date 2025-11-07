import React, { useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [fileURL, setFileURL] = useState(null);
  const [confidence, setConfidence] = useState(0.5);
  const [labels, setLabels] = useState("");
  const [outputImage, setOutputImage] = useState(null);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState("");

  const endpoints = [
    { name: "Walls", path: "/walls" },
    { name: "Rooms", path: "/rooms" },
    { name: "Slabs", path: "/slabs" },
    { name: "Columns", path: "/columns" },
    { name: "Beams", path: "/beams" },
    { name: "OCR", path: "/ocr" },
    { name: "YOLO Detect", path: "/detect" },
  ];

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    if (f) setFileURL(URL.createObjectURL(f));
  };

  const handleProcess = async (endpoint) => {
    if (!file) return alert("Please upload an image first.");

    setSelectedTask(endpoint.name);
    setLoading(true);
    setOutputImage(null);
    setCounts({});

    try {
      const formData = new FormData();
      formData.append("file", file);

      let res;
      if (endpoint.path === "/detect") {
        const labelsArray = labels
          ? labels
              .split(",")
              .map((l) => l.trim())
              .filter(Boolean)
          : [];
        res = await axios.post(`${API_BASE}${endpoint.path}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          params: { confidence, labels: labelsArray },
        });
        setCounts(res.data.counts || {});
        setOutputImage(`data:image/png;base64,${res.data.image}`);
      } else {
        res = await axios.post(`${API_BASE}${endpoint.path}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          responseType: "arraybuffer",
        });
        const blob = new Blob([res.data], { type: "image/png" });
        setOutputImage(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error(err);
      alert("Processing failed — check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">
        🏗️ AI Floorplan Processor
      </h1>

      <div className="bg-white shadow p-6 rounded-lg w-full max-w-xl mb-6">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="w-full mb-4"
        />

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm">Confidence: {confidence}</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              className="w-full"
            />
          </label>

          <label className="block">
            <span className="text-sm">Filter Labels (comma-separated)</span>
            <input
              type="text"
              placeholder="e.g. column, beam"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1"
            />
          </label>
        </div>

        {/* Task Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6">
          {endpoints.map((ep) => (
            <button
              key={ep.path}
              onClick={() => handleProcess(ep)}
              className={`p-2 rounded-md text-sm font-semibold ${
                selectedTask === ep.name
                  ? "bg-blue-700 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={loading}
            >
              {ep.name}
            </button>
          ))}
        </div>
      </div>

      {/* Object Counts */}
      {Object.keys(counts).length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow w-full max-w-md mb-4">
          <h2 className="font-semibold mb-2">Detected Objects:</h2>
          <ul className="text-sm text-gray-700 space-y-1">
            {Object.entries(counts).map(([label, count]) => (
              <li key={label}>
                <span className="font-medium">{label}</span>: {count}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-side image comparison */}
      {(fileURL || outputImage) && (
        <div className="flex flex-col sm:flex-row gap-6 mt-6 w-full max-w-5xl justify-center">
          {/* Original */}
          {fileURL && (
            <div className="flex flex-col items-center bg-white p-3 rounded-lg shadow-md">
              <h3 className="text-md font-semibold mb-2">Original Image</h3>
              <img
                src={fileURL}
                alt="Original"
                className="max-w-sm rounded border border-gray-300"
              />
            </div>
          )}

          {/* Processed */}
          {outputImage && (
            <div className="flex flex-col items-center bg-white p-3 rounded-lg shadow-md">
              <h3 className="text-md font-semibold mb-2">Processed Output</h3>
              <img
                src={outputImage}
                alt="Processed"
                className="max-w-sm rounded border border-gray-300"
              />
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="mt-4 text-gray-600 font-medium">Processing...</div>
      )}
    </div>
  );
}
