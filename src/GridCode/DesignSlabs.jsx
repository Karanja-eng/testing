import React, { useState, useEffect } from "react";
import axios from "axios";

const DesignSlabs = () => {
  const [slabData, setSlabData] = useState({});
  const [selectedSlab, setSelectedSlab] = useState("");
  const [width, setWidth] = useState(7200);
  const [height, setHeight] = useState(6000);
  const [load, setLoad] = useState(0);

  useEffect(() => {
    axios
      .get("http://localhost:8000/slab_design")
      .then((response) => setSlabData(response.data))
      .catch((error) => console.error("Error fetching slab data:", error));
  }, []);

  const handleSubmit = () => {
    const data = { id: selectedSlab.split("-")[0], width, height };
    axios
      .post("http://localhost:8000/slab_design", data)
      .then((response) => setLoad(response.data.load))
      .catch((error) => console.error("Error designing slab:", error));
  };

  return (
    <div className="design-page">
      <h3>Design Slabs</h3>
      <select
        value={selectedSlab}
        onChange={(e) => {
          setSelectedSlab(e.target.value);
          const dim = slabData[e.target.value.split("-")[0]] || {
            width: 7200,
            height: 6000,
          };
          setWidth(dim.width);
          setHeight(dim.height);
        }}
      >
        <option value="" disabled>
          Select Slab
        </option>
        {Object.keys(slabData).map((key) => {
          const slabKey = `${key}-${parseInt(key) + 1}${String.fromCharCode(
            key.charCodeAt(1) + 1
          )}`;
          return (
            <option key={slabKey} value={slabKey}>
              {slabKey}
            </option>
          );
        })}
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
      <button onClick={handleSubmit}>Calculate Load</button>
      <p>Load: {load} kN</p>
    </div>
  );
};

export default DesignSlabs;
