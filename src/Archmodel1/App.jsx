// frontend/src/App.js
import React, { useState } from "react";
import axios from "axios";

function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [counts, setCounts] = useState({});
  const [confidence, setConfidence] = useState(0.5);
  const [selectedLabels, setSelectedLabels] = useState([]);

  const availableLabels = [
    "Column",
    "Curtain Wall",
    "Dimension",
    "Door",
    "Railing",
    "Sliding Door",
    "Stair Case",
    "Wall",
    "Window",
  ];

  const handleUpload = (e) => {
    const file = e.target.files[0];
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const toggleLabel = (label) => {
    if (selectedLabels.includes(label)) {
      setSelectedLabels(selectedLabels.filter((l) => l !== label));
    } else {
      setSelectedLabels([...selectedLabels, label]);
    }
  };

  const handleDetect = async () => {
    if (!image) return;

    const formData = new FormData();
    formData.append("file", image);
    formData.append("confidence", confidence);
    formData.append("labels", JSON.stringify(selectedLabels));

    const res = await axios.post("http://127.0.0.1:8000/detect", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    setCounts(res.data.counts);
    setResultImage(`data:image/png;base64,${res.data.image}`);
  };

  const downloadCSV = () => {
    let csv = "Object,Count\n";
    Object.entries(counts).forEach(([label, count]) => {
      csv += `${label},${count}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "detected_objects.csv";
    link.click();
  };

  return (
    <div className="flex flex-row items-center ">
      <div className="bg-gray-100 flex flex-col pr-10 mr-20 ml-10 border-2 rounded-md shadow-md">
        <h1 className="font-bold mb-10">Floor Plan Object Detection</h1>

        <div>
          <input type="file" accept="image/*" onChange={handleUpload} />
        </div>

        <div>
          <label>Confidence: {confidence}</label>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
          />
        </div>

        <div style={{ marginTop: "20px" }}>
          <h3>Select Labels</h3>
          {availableLabels.map((label) => (
            <label key={label} style={{ marginRight: "10px" }}>
              <input
                type="checkbox"
                checked={selectedLabels.includes(label)}
                onChange={() => toggleLabel(label)}
              />
              {label}
            </label>
          ))}
        </div>

        <button
          onClick={handleDetect}
          className="bg-blue-400 rounded-md"
          style={{ marginTop: "20px" }}
        >
          Detect Objects
        </button>
      </div>
      <div className="pl-10">
        <div className="flex flex-col items-center  border-2 rounded-md shadow-md p-10">
          {preview && (
            <div style={{ marginTop: "10px" }}>
              <h3 className="mb-5 p-2 font-bold ">Uploaded Image</h3>
              <img src={preview} alt="preview" width="300" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center  border-2 rounded-md shadow-md p-10">
          {resultImage && (
            <div style={{ marginTop: "20px" }}>
              <h2 className="mb-10 p-2 font-bold ">Detected Image</h2>
              <img src={resultImage} alt="result" width="500" />
            </div>
          )}
        </div>

        {Object.keys(counts).length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <h2>Detected Objects</h2>
            <ul>
              {Object.entries(counts).map(([label, count]) => (
                <li key={label}>
                  {label}: {count}
                </li>
              ))}
            </ul>
            <button onClick={downloadCSV}>Download CSV</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
