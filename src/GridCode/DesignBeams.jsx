import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import paper from "paper";

const DesignBeams = () => {
  const [beamData, setBeamData] = useState({});
  const [selectedBeam, setSelectedBeam] = useState("");
  const [width, setWidth] = useState(7200);
  const [depth, setDepth] = useState(400);
  const [breadth, setBreadth] = useState(300);
  const [load, setLoad] = useState(0);
  const canvasRef = useRef(null);

  useEffect(() => {
    axios
      .get("http://localhost:8000/beam_design")
      .then((response) => setBeamData(response.data))
      .catch((error) => console.error("Error fetching beam data:", error));
  }, []);

  useEffect(() => {
    if (canvasRef.current && selectedBeam) {
      paper.setup(canvasRef.current);
      paper.project.clear();

      const dim = beamData[selectedBeam] || {
        width: 7200,
        depth: 400,
        breadth: 300,
      };
      const length = dim.width / 2000;
      const depthVal = dim.depth / 2000;
      const breadthVal = dim.breadth / 2000;

      const beam = new paper.Path.Line({
        from: [50, 150],
        to: [50 + length * 100, 150],
        strokeColor: "black",
        strokeWidth: 2,
      });

      new paper.Path.Circle({
        center: [50, 150],
        radius: 5,
        fillColor: "black",
      });
      new paper.Path.Circle({
        center: [50 + length * 100, 150],
        radius: 5,
        fillColor: "black",
      });

      new paper.PointText({
        point: [50 + length * 50, 130],
        content: `Load: ${load} kN`,
        fillColor: "black",
        fontSize: 12,
      });

      new paper.PointText({
        point: [50 + length * 50, 170],
        content: `L: ${dim.width}mm, D: ${dim.depth}mm, B: ${dim.breadth}mm`,
        fillColor: "black",
        fontSize: 12,
      });
    }
  }, [selectedBeam, load, beamData]);

  const handleSubmit = () => {
    const data = { id: selectedBeam, width, depth, breadth };
    axios
      .post("http://localhost:8000/beam_design", data)
      .then((response) => setLoad(response.data.load))
      .catch((error) => console.error("Error designing beam:", error));
  };

  return (
    <div className="design-page">
      <h3>Design Beams</h3>
      <select
        value={selectedBeam}
        onChange={(e) => {
          setSelectedBeam(e.target.value);
          const dim = beamData[e.target.value] || {
            width: 7200,
            depth: 400,
            breadth: 300,
          };
          setWidth(dim.width);
          setDepth(dim.depth);
          setBreadth(dim.breadth);
        }}
      >
        <option value="" disabled>
          Select Beam
        </option>
        {Object.keys(beamData).map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      <label>Width (mm):</label>
      <input
        type="number"
        value={width}
        onChange={(e) => setWidth(+e.target.value)}
      />
      <label>Depth (mm):</label>
      <input
        type="number"
        value={depth}
        onChange={(e) => setDepth(+e.target.value)}
      />
      <label>Breadth (mm):</label>
      <input
        type="number"
        value={breadth}
        onChange={(e) => setBreadth(+e.target.value)}
      />
      <button onClick={handleSubmit}>Calculate Load</button>
      <canvas
        ref={canvasRef}
        width="400"
        height="200"
        style={{ marginTop: "10px", border: "1px solid #ccc" }}
      />
      <p>Load: {load} kN</p>
    </div>
  );
};

export default DesignBeams;
