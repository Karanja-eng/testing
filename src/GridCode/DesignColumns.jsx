import React, { useState, useEffect } from "react";
import axios from "axios";

const DesignColumns = () => {
  const [columnData, setColumnData] = useState({});
  const [selectedColumn, setSelectedColumn] = useState("");
  const [width, setWidth] = useState(300);
  const [height, setHeight] = useState(300);
  const [rotation, setRotation] = useState(0);
  const [load, setLoad] = useState(0);

  useEffect(() => {
    axios
      .get("http://localhost:8000/column_design")
      .then((response) => setColumnData(response.data))
      .catch((error) => console.error("Error fetching column data:", error));
  }, []);

  const handleSubmit = () => {
    const data = { id: selectedColumn, width, height, rotation };
    axios
      .post("http://localhost:8000/column_design", data)
      .then((response) => setLoad(response.data.load))
      .catch((error) => console.error("Error designing column:", error));
  };

  return (
    <div className="design-page">
      <h3>Design Columns</h3>
      <select
        value={selectedColumn}
        onChange={(e) => {
          setSelectedColumn(e.target.value);
          const dim = columnData[e.target.value] || {
            width: 300,
            height: 300,
            rotation: 0,
          };
          setWidth(dim.width);
          setHeight(dim.height);
          setRotation(dim.rotation);
        }}
      >
        <option value="" disabled>
          Select Column
        </option>
        {Object.keys(columnData).map((key) => (
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
      <label>Height (mm):</label>
      <input
        type="number"
        value={height}
        onChange={(e) => setHeight(+e.target.value)}
      />
      <label>Rotation (degrees):</label>
      <input
        type="number"
        value={rotation}
        onChange={(e) => setRotation(+e.target.value)}
      />
      <button onClick={handleSubmit}>Calculate Load</button>
      <p>Load: {load} kN</p>
    </div>
  );
};

export default DesignColumns;
