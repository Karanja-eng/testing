// frontend/src/App.js
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import paper from "paper";
// If needed, but tailwind is in index.css

function SurveyApp() {
  const [readings, setReadings] = useState([]);
  const [station, setStation] = useState("");
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [reading, setReading] = useState("");
  const [readingType, setReadingType] = useState("BS");
  const [benchmarkStation, setBenchmarkStation] = useState("");
  const [benchmarkRl, setBenchmarkRl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  const addReading = () => {
    if (!station || !x || !y || !reading) return;
    setReadings([
      ...readings,
      {
        station,
        x: parseFloat(x),
        y: parseFloat(y),
        reading: parseFloat(reading),
        reading_type: readingType,
      },
    ]);
    setStation("");
    setX("");
    setY("");
    setReading("");
  };

  const submitData = async () => {
    try {
      setError(null);
      const response = await axios.post("http://127.0.0.1:8000/api/calculate", {
        readings,
        benchmark_station: benchmarkStation,
        benchmark_rl: parseFloat(benchmarkRl),
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Error processing data");
    }
  };

  useEffect(() => {
    if (result && canvasRef.current) {
      const canvas = canvasRef.current;
      paper.setup(canvas);

      // Clear previous
      paper.project.clear();

      if (!result.points.length) return;

      // Find min/max for scaling
      const xs = result.points.map((p) => p.x);
      const ys = result.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const width = maxX - minX;
      const height = maxY - minY;
      const scaleFactor =
        Math.min(canvas.width / width, canvas.height / height) * 0.9;
      const offsetX = (canvas.width - width * scaleFactor) / 2;
      const offsetY = (canvas.height - height * scaleFactor) / 2;

      const scale = (val, min, max) => (val - min) * scaleFactor + offsetX;
      const scaleY = (val, min, max) =>
        canvas.height - ((val - min) * scaleFactor + offsetY); // Invert Y if needed

      // Draw contours
      result.contours.forEach((contour) => {
        const path = new paper.Path({
          strokeColor: "black",
          strokeWidth: 1,
        });
        contour.path.forEach(([px, py]) => {
          path.add(
            new paper.Point(scale(px, minX, maxX), scaleY(py, minY, maxY))
          );
        });

        // Label: take average point for simplicity
        if (contour.path.length > 1) {
          const midIndex = Math.floor(contour.path.length / 2);
          const [mx, my] = contour.path[midIndex];
          new paper.PointText({
            point: new paper.Point(
              scale(mx, minX, maxX),
              scaleY(my, minY, maxY)
            ),
            content: contour.level.toFixed(2),
            fillColor: "red",
            fontSize: 12,
          });
        }
      });

      // Draw points optional
      result.points.forEach((p) => {
        new paper.Path.Circle({
          center: new paper.Point(
            scale(p.x, minX, maxX),
            scaleY(p.y, minY, maxY)
          ),
          radius: 3,
          fillColor: "blue",
        });
      });

      paper.view.draw();
    }
  }, [result]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Survey Leveling Contour Map Generator
      </h1>

      <div className="mb-4">
        <label className="block">Benchmark Station:</label>
        <input
          type="text"
          value={benchmarkStation}
          onChange={(e) => setBenchmarkStation(e.target.value)}
          className="border p-1"
        />
        <label className="block">Benchmark RL:</label>
        <input
          type="number"
          value={benchmarkRl}
          onChange={(e) => setBenchmarkRl(e.target.value)}
          className="border p-1"
        />
      </div>

      <div className="mb-4">
        <h2 className="text-xl">Add Reading</h2>
        <input
          type="text"
          placeholder="Station"
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="border p-1 mr-2"
        />
        <input
          type="number"
          placeholder="X"
          value={x}
          onChange={(e) => setX(e.target.value)}
          className="border p-1 mr-2"
        />
        <input
          type="number"
          placeholder="Y"
          value={y}
          onChange={(e) => setY(e.target.value)}
          className="border p-1 mr-2"
        />
        <input
          type="number"
          placeholder="Reading"
          value={reading}
          onChange={(e) => setReading(e.target.value)}
          className="border p-1 mr-2"
        />
        <select
          value={readingType}
          onChange={(e) => setReadingType(e.target.value)}
          className="border p-1 mr-2"
        >
          <option>BS</option>
          <option>IS</option>
          <option>FS</option>
        </select>
        <button onClick={addReading} className="bg-blue-500 text-white p-1">
          Add
        </button>
      </div>

      <table className="w-full border mb-4">
        <thead>
          <tr>
            <th>Station</th>
            <th>X</th>
            <th>Y</th>
            <th>Reading</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((r, idx) => (
            <tr key={idx}>
              <td>{r.station}</td>
              <td>{r.x}</td>
              <td>{r.y}</td>
              <td>{r.reading}</td>
              <td>{r.reading_type}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={submitData} className="bg-green-500 text-white p-2 mb-4">
        Calculate and Draw Contours
      </button>

      {error && <p className="text-red-500">{error}</p>}

      <canvas ref={canvasRef} width={800} height={600} className="border" />
    </div>
  );
}

export default SurveyApp;
