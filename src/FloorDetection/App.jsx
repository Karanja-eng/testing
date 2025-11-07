import React, { useState } from "react";
import axios from "axios";
const API = "http://127.0.0.1:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [msg, setMsg] = useState("");
  const [original, setOriginal] = useState(null); // 👈 store original image

  async function callEndpoint(endpoint) {
    if (!file) {
      setMsg("Choose an image first");
      return;
    }
    setBusy(true);
    setMsg("Processing " + endpoint + "...");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/${endpoint}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      setImgSrc(url);
      setMsg("Displayed: " + endpoint);
    } catch (err) {
      console.error(err);
      setMsg("Error: " + (err.response?.data || err.message));
    } finally {
      setBusy(false);
    }
  }

  function previewOriginal() {
    if (!file) {
      setMsg("Choose an image first");
      return;
    }
    const url = URL.createObjectURL(file);
    setOriginal(url);
    setMsg("Displayed: Original Image");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-blue-700">
          Floorplan Visualizer
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Upload and press a button to display the exact view produced by your
          code.
        </p>

        <div className="bg-white p-4 rounded shadow mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setFile(e.target.files[0]);
                setOriginal(null); // reset original on new upload
              }}
            />
            <button
              onClick={() => callEndpoint("contours")}
              disabled={busy}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              Contours
            </button>
            <button
              onClick={() => callEndpoint("rooms")}
              disabled={busy}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              Rooms
            </button>
            <button
              onClick={() => callEndpoint("walls")}
              disabled={busy}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              Walls
            </button>
            <button
              onClick={() => callEndpoint("slabs")}
              disabled={busy}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              Slabs
            </button>
            <button
              onClick={() => callEndpoint("beams")}
              disabled={busy}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              Beams
            </button>
            <button
              onClick={() => callEndpoint("ocr")}
              disabled={busy}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              OCR
            </button>
            <button
              onClick={() => callEndpoint("columns")}
              disabled={busy}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              Columns (YOLO)
            </button>
            {/* 👇 New button for previewing original */}
            <button
              onClick={previewOriginal}
              disabled={!file}
              className="px-3 py-2 bg-gray-600 text-white rounded"
            >
              Preview Original
            </button>
          </div>
          <div className="mt-3 text-sm text-gray-600">{msg}</div>
        </div>

        <div className="mt-6 bg-white p-4 rounded shadow min-h-[520px] flex gap-6 justify-center">
          {original && (
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 mb-2">Original</p>
              <img
                src={original}
                alt="original"
                style={{ maxWidth: "100%", maxHeight: "80vh" }}
              />
            </div>
          )}
          {imgSrc && (
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 mb-2">Processed</p>
              <img
                src={imgSrc}
                alt="result"
                style={{ maxWidth: "100%", maxHeight: "80vh" }}
              />
            </div>
          )}
          {!original && !imgSrc && (
            <div className="text-gray-400">No image yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
