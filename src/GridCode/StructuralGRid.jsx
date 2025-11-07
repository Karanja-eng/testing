import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import GridComponent from "./GridComponent";
import EditModals from "./EditModals";
import AddColumnModal from "./AddColumnModal";
import "./StructuralGrid.css";

const StructuralGrid = ({ navigateToDesign }) => {
  const canvasRef = useRef(null);
  const [grid, setGrid] = useState({
    rows: 3,
    cols: 3,
    panelDimensions: {},
    columnDimensions: {},
    beamDimensions: {},
  });
  const [selectedElement, setSelectedElement] = useState(null);
  const [showModal, setShowModal] = useState({
    column: false,
    beam: false,
    slab: false,
    addColumn: false,
  });
  const [activeElement, setActiveElement] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [scroll, setScroll] = useState({ x: 0, y: 0 });

  useEffect(() => {
    axios
      .get("http://localhost:8000/grid")
      .then((response) => setGrid(response.data))
      .catch((error) => console.error("Error fetching grid data:", error));
  }, []);

  const updateGridSize = (direction, increment) => {
    setGrid((prev) => {
      const newCount = prev[direction] + increment;
      const newGrid = { ...prev, [direction]: newCount };
      if (direction === "rows") {
        const newPanels = { ...prev.panelDimensions };
        const newColumns = { ...prev.columnDimensions };
        const newBeams = { ...prev.beamDimensions };
        for (let i = 1; i <= newCount; i++) {
          for (
            let j = "A".charCodeAt(0);
            j < "A".charCodeAt(0) + prev.cols;
            j++
          ) {
            const key = `${i}${String.fromCharCode(j)}`;
            if (!prev.panelDimensions[key] && i <= prev.rows)
              newPanels[key] = { width: 7200, height: 6000 };
            if (!prev.columnDimensions[key] && i <= prev.rows)
              newColumns[key] = { width: 300, height: 300, rotation: 0 };
          }
          const beamKey = `beam${i}A`;
          if (!prev.beamDimensions[beamKey] && i < prev.rows)
            newBeams[beamKey] = { width: 7200, depth: 400, breadth: 300 };
        }
        for (let i = newCount + 1; i <= prev.rows; i++) {
          for (
            let j = "A".charCodeAt(0);
            j < "A".charCodeAt(0) + prev.cols;
            j++
          ) {
            const key = `${i}${String.fromCharCode(j)}`;
            delete newPanels[key];
            delete newColumns[key];
          }
          const beamKey = `beam${i}A`;
          delete newBeams[beamKey];
        }
        newGrid.panelDimensions = newPanels;
        newGrid.columnDimensions = newColumns;
        newGrid.beamDimensions = newBeams;
      } else if (direction === "cols") {
        const newPanels = { ...prev.panelDimensions };
        const newColumns = { ...prev.columnDimensions };
        const newBeams = { ...prev.beamDimensions };
        for (let i = 1; i <= prev.rows; i++) {
          for (
            let j = "A".charCodeAt(0);
            j < "A".charCodeAt(0) + newCount;
            j++
          ) {
            const key = `${i}${String.fromCharCode(j)}`;
            if (!prev.panelDimensions[key] && j - "A".charCodeAt(0) < prev.cols)
              newPanels[key] = { width: 7200, height: 6000 };
            if (
              !prev.columnDimensions[key] &&
              j - "A".charCodeAt(0) < prev.cols
            )
              newColumns[key] = { width: 300, height: 300, rotation: 0 };
          }
        }
        for (let i = 1; i <= prev.rows; i++) {
          for (
            let j = "A".charCodeAt(0) + newCount;
            j < "A".charCodeAt(0) + prev.cols;
            j++
          ) {
            const key = `${i}${String.fromCharCode(j)}`;
            delete newPanels[key];
            delete newColumns[key];
          }
        }
        for (
          let i = "A".charCodeAt(0);
          i < "A".charCodeAt(0) + newCount - 1;
          i++
        ) {
          const beamKey = `beamA${String.fromCharCode(i)}`;
          if (
            !prev.beamDimensions[beamKey] &&
            i - "A".charCodeAt(0) < prev.cols - 1
          )
            newBeams[beamKey] = { width: 6000, depth: 400, breadth: 300 };
        }
        for (
          let i = "A".charCodeAt(0) + newCount - 1;
          i < "A".charCodeAt(0) + prev.cols - 1;
          i++
        ) {
          const beamKey = `beamA${String.fromCharCode(i)}`;
          delete newBeams[beamKey];
        }
        newGrid.panelDimensions = newPanels;
        newGrid.columnDimensions = newColumns;
        newGrid.beamDimensions = newBeams;
      }
      axios
        .post("http://localhost:8000/grid", newGrid)
        .catch((error) => console.error("Error updating grid:", error));
      return newGrid;
    });
  };

  const deleteGridSize = (direction, decrement) => {
    if (grid[direction] > 1) {
      setGrid((prev) => {
        const newCount = prev[direction] - decrement;
        const newGrid = { ...prev, [direction]: newCount };
        if (direction === "rows") {
          const newPanels = {};
          const newColumns = {};
          const newBeams = {};
          for (let i = 1; i <= newCount; i++) {
            for (
              let j = "A".charCodeAt(0);
              j < "A".charCodeAt(0) + prev.cols;
              j++
            ) {
              const key = `${i}${String.fromCharCode(j)}`;
              if (prev.panelDimensions[key])
                newPanels[key] = prev.panelDimensions[key];
              if (prev.columnDimensions[key])
                newColumns[key] = prev.columnDimensions[key];
            }
            const beamKey = `beam${i}A`;
            if (prev.beamDimensions[beamKey])
              newBeams[beamKey] = prev.beamDimensions[beamKey];
          }
          newGrid.panelDimensions = newPanels;
          newGrid.columnDimensions = newColumns;
          newGrid.beamDimensions = newBeams;
        } else if (direction === "cols") {
          const newPanels = {};
          const newColumns = {};
          const newBeams = {};
          for (let i = 1; i <= prev.rows; i++) {
            for (
              let j = "A".charCodeAt(0);
              j < "A".charCodeAt(0) + newCount;
              j++
            ) {
              const key = `${i}${String.fromCharCode(j)}`;
              if (prev.panelDimensions[key])
                newPanels[key] = prev.panelDimensions[key];
              if (prev.columnDimensions[key])
                newColumns[key] = prev.columnDimensions[key];
            }
          }
          for (
            let i = "A".charCodeAt(0);
            i < "A".charCodeAt(0) + newCount - 1;
            i++
          ) {
            const beamKey = `beamA${String.fromCharCode(i)}`;
            if (prev.beamDimensions[beamKey])
              newBeams[beamKey] = prev.beamDimensions[beamKey];
          }
          newGrid.panelDimensions = newPanels;
          newGrid.columnDimensions = newColumns;
          newGrid.beamDimensions = newBeams;
        }
        axios
          .post("http://localhost:8000/grid", newGrid)
          .catch((error) => console.error("Error updating grid:", error));
        return newGrid;
      });
    }
  };

  const updateDimension = (element, type, value) => {
    setGrid((prev) => {
      const newGrid = { ...prev };
      if (type === "panel") {
        newGrid.panelDimensions[element.split("-")[0]] = {
          ...newGrid.panelDimensions[element.split("-")[0]],
          ...value,
        };
      } else if (type === "column") {
        newGrid.columnDimensions[element] = {
          ...newGrid.columnDimensions[element],
          ...value,
        };
      } else if (type === "beam") {
        newGrid.beamDimensions[element] = {
          ...newGrid.beamDimensions[element],
          ...value,
        };
      }
      axios
        .post("http://localhost:8000/grid", newGrid)
        .catch((error) => console.error("Error updating dimension:", error));
      return newGrid;
    });
  };

  const addColumnToBeam = (beamId, distance) => {
    const [type, pos] = beamId.split(/(beam|A)/).filter(Boolean);
    const colIndex = Math.floor((distance / 100) % 26);
    const newColKey = `${parseInt(type) || 1}${String.fromCharCode(
      65 + colIndex
    )}`;
    if (!grid.columnDimensions[newColKey]) {
      setGrid((prev) => {
        const newGrid = {
          ...prev,
          columnDimensions: {
            ...prev.columnDimensions,
            [newColKey]: { width: 300, height: 300, rotation: 0 },
          },
        };
        axios
          .post("http://localhost:8000/grid", newGrid)
          .catch((error) => console.error("Error adding column:", error));
        return newGrid;
      });
    }
  };

  const calculateLoad = (elementType, dimensions) => {
    const { width, height, depth, breadth } = dimensions;
    const area = (((width || breadth) / 1000) * (height || depth)) / 1000;
    let totalLoad = 0;

    const concreteDensity = 25;
    const slabThickness = 150;
    const columnHeight = 3000;

    const deadLoadFactor = 1.4;
    const liveLoadFactor = 1.6;

    if (elementType === "panel") {
      const slabVolume = area * (slabThickness / 1000);
      const deadLoad = slabVolume * concreteDensity;
      const liveLoad = area * 2.5;
      totalLoad = deadLoad * deadLoadFactor + liveLoad * liveLoadFactor;
    } else if (elementType === "column") {
      const columnVolume =
        (width / 1000) * (height / 1000) * (columnHeight / 1000);
      const deadLoad = columnVolume * concreteDensity;
      const liveLoad = area * 5;
      totalLoad = deadLoad * deadLoadFactor + liveLoad * liveLoadFactor;
    } else if (elementType === "beam") {
      const beamVolume =
        (width / 1000) * (depth / 1000) * (columnHeight / 1000);
      const deadLoad = beamVolume * concreteDensity;
      const liveLoad = (width / 1000) * 2.5;
      totalLoad = deadLoad * deadLoadFactor + liveLoad * liveLoadFactor;
    }

    return totalLoad.toFixed(2);
  };

  const handleElementClick = (element, type, point) => {
    setActiveElement(element);
    setSelectedElement(element);
    setShowModal({ ...showModal, [type]: true });
  };

  const handleZoom = (inOut) => {
    setZoom((prev) =>
      inOut === "in" ? Math.min(prev * 1.2, 2) : Math.max(prev / 1.2, 0.5)
    );
  };

  const handleScroll = (e) => {
    setScroll((prev) => ({
      x: prev.x - e.deltaX / zoom,
      y: prev.y - e.deltaY / zoom,
    }));
  };

  return (
    <div className="grid-container">
      <h2 className="title">Structural Design Grid</h2>
      <div className="controls">
        <button onClick={() => updateGridSize("rows", 1)}>Add Row</button>
        <button onClick={() => deleteGridSize("rows", 1)}>Delete Row</button>
        <button onClick={() => updateGridSize("cols", 1)}>Add Column</button>
        <button onClick={() => deleteGridSize("cols", 1)}>Delete Column</button>
        <EditModals
          showModal={showModal}
          setShowModal={setShowModal}
          activeElement={activeElement}
          setActiveElement={setActiveElement}
          grid={grid}
          updateDimension={updateDimension}
          calculateLoad={calculateLoad}
        />
        <AddColumnModal
          showModal={showModal}
          setShowModal={setShowModal}
          activeElement={activeElement}
          setActiveElement={setActiveElement}
          grid={grid}
          addColumnToBeam={addColumnToBeam}
        />
        <button onClick={navigateToDesign}>Design Members</button>
        <button onClick={() => handleZoom("in")}>Zoom In</button>
        <button onClick={() => handleZoom("out")}>Zoom Out</button>
      </div>
      <div className="canvas-wrapper" onWheel={handleScroll}>
        <GridComponent
          grid={grid}
          onElementClick={handleElementClick}
          canvasRef={canvasRef}
          zoom={zoom}
          scroll={scroll}
        />
      </div>
      {selectedElement && (
        <p className="selected">Selected: {selectedElement}</p>
      )}
    </div>
  );
};

export default StructuralGrid;
