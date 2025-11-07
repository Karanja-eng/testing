import React, { useState, useEffect } from "react";
import axios from "axios";

const DesignFoundations = () => {
  const [foundationData, setFoundationData] = useState({});
  const [selectedColumn, setSelectedColumn] = useState("");
  const [selectedFoundation, setSelectedFoundation] = useState("");
  const [width, setWidth] = useState(300);
  const [height, setHeight] = useState(300);
  const [load, setLoad] = useState(0);

  useEffect(() => {
    axios
      .get("http://localhost:8000/foundation_design")
      .then((response) => setFoundationData(response.data))
      .catch((error) =>
        console.error("Error fetching foundation data:", error)
      );
  }, []);

  useEffect(() => {
    if (selectedColumn) {
      const foundationKey = selectedColumn;
      setSelectedFoundation(foundationKey);
      const dim = foundationData[foundationKey] || { width: 300, height: 300 };
      setWidth(dim.width);
      setHeight(dim.height);
    }
  }, [selectedColumn, foundationData]);

  const handleSubmit = () => {
    const data = {
      id: selectedFoundation,
      width,
      height,
      column_id: selectedColumn,
    };
    axios
      .post("http://localhost:8000/foundation_design", data)
      .then((response) => setLoad(response.data.load))
      .catch((error) => console.error("Error designing foundation:", error));
  };

  return (
    <div className="design-page">
      <h3>Design Foundations</h3>
      <select
        value={selectedColumn}
        onChange={(e) => setSelectedColumn(e.target.value)}
      >
        <option value="" disabled>
          Select Column
        </option>
        {Object.keys(foundationData).map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      <p>Foundation: {selectedFoundation}</p>
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
      <button onClick={handleSubmit}>Calculate Load</button>
      <p>Load: {load} kN</p>
    </div>
  );
};

export default DesignFoundations;
