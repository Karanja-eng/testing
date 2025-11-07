import React, { useState, useEffect, useRef } from "react";
import paper from "paper";

const DesignMembers = ({
  showModal,
  setShowModal,
  grid,
  updateDimension,
  calculateLoad,
}) => {
  const [activeType, setActiveType] = useState(null);
  const [activeElement, setActiveElement] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (
      showModal &&
      activeType === "beam" &&
      canvasRef.current &&
      activeElement
    ) {
      paper.setup(canvasRef.current);
      paper.project.clear();

      const dim = grid.beamDimensions[activeElement];
      const isHorizontal = activeElement.includes("beam");
      const length = dim.width / 2000;
      const depth = dim.depth / 2000;
      const breadth = dim.breadth / 2000;

      // Draw beam line diagram
      const beam = new paper.Path.Line({
        from: [50, 150],
        to: [50 + length * 100, 150],
        strokeColor: "black",
        strokeWidth: 2,
      });

      // Supports
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

      // Loads (simplified as points)
      new paper.PointText({
        point: [50 + length * 50, 130],
        content: `Load: ${calculateLoad("beam", dim)} kN`,
        fillColor: "black",
        fontSize: 12,
      });

      // Dimensions
      new paper.PointText({
        point: [50 + length * 50, 170],
        content: `L: ${dim.width}mm, D: ${dim.depth}mm, B: ${dim.breadth}mm`,
        fillColor: "black",
        fontSize: 12,
      });
    }
  }, [showModal, activeType, activeElement, grid]);

  const handleClose = () => setShowModal(false);

  if (!showModal) return null;

  return (
    <div className="modal">
      <div className="modal-content" style={{ width: "400px" }}>
        <h3>Design Members</h3>
        <div>
          <button onClick={() => setActiveType("slab")}>Design Slabs</button>
          <button onClick={() => setActiveType("column")}>
            Design Columns
          </button>
          <button onClick={() => setActiveType("beam")}>Design Beams</button>
          <button onClick={() => setActiveType("foundation")}>
            Design Foundations
          </button>
        </div>
        {activeType && (
          <>
            <select
              value={activeElement || ""}
              onChange={(e) => setActiveElement(e.target.value)}
            >
              <option value="" disabled>
                Select {activeType}
              </option>
              {Object.keys(
                grid[
                  activeType === "slab"
                    ? "panelDimensions"
                    : activeType === "column"
                    ? "columnDimensions"
                    : "beamDimensions"
                ]
              ).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {activeType === "beam" && activeElement && (
              <canvas
                ref={canvasRef}
                width="400"
                height="200"
                style={{ marginTop: "10px", border: "1px solid #ccc" }}
              />
            )}
            {activeElement && (
              <>
                <label>
                  {activeType === "slab"
                    ? "Width"
                    : activeType === "column"
                    ? "Width"
                    : "Length"}{" "}
                  (mm):
                </label>
                <input
                  type="number"
                  value={
                    grid[
                      activeType === "slab"
                        ? "panelDimensions"
                        : activeType === "column"
                        ? "columnDimensions"
                        : "beamDimensions"
                    ][activeElement]?.width || 7200
                  }
                  onChange={(e) =>
                    updateDimension(
                      activeElement,
                      activeType === "slab" ? "panel" : activeType,
                      { width: +e.target.value }
                    )
                  }
                />
                {activeType === "column" && (
                  <>
                    <label>Height (mm):</label>
                    <input
                      type="number"
                      value={
                        grid.columnDimensions[activeElement]?.height || 300
                      }
                      onChange={(e) =>
                        updateDimension(activeElement, "column", {
                          height: +e.target.value,
                        })
                      }
                    />
                    <label>Rotation (degrees):</label>
                    <input
                      type="number"
                      value={
                        grid.columnDimensions[activeElement]?.rotation || 0
                      }
                      onChange={(e) =>
                        updateDimension(activeElement, "column", {
                          rotation: +e.target.value,
                        })
                      }
                    />
                  </>
                )}
                {activeType === "beam" && (
                  <>
                    <label>Depth (mm):</label>
                    <input
                      type="number"
                      value={grid.beamDimensions[activeElement]?.depth || 400}
                      onChange={(e) =>
                        updateDimension(activeElement, "beam", {
                          depth: +e.target.value,
                        })
                      }
                    />
                    <label>Breadth (mm):</label>
                    <input
                      type="number"
                      value={grid.beamDimensions[activeElement]?.breadth || 300}
                      onChange={(e) =>
                        updateDimension(activeElement, "beam", {
                          breadth: +e.target.value,
                        })
                      }
                    />
                  </>
                )}
                {activeType === "slab" && (
                  <>
                    <label>Height (mm):</label>
                    <input
                      type="number"
                      value={
                        grid.panelDimensions[activeElement]?.height || 6000
                      }
                      onChange={(e) =>
                        updateDimension(activeElement, "panel", {
                          height: +e.target.value,
                        })
                      }
                    />
                  </>
                )}
                <p>
                  Load:{" "}
                  {calculateLoad(
                    activeType,
                    grid[
                      activeType === "slab"
                        ? "panelDimensions"
                        : activeType === "column"
                        ? "columnDimensions"
                        : "beamDimensions"
                    ][activeElement] || {
                      width: 7200,
                      height: 6000,
                      depth: 400,
                      breadth: 300,
                    }
                  )}{" "}
                  kN
                </p>
              </>
            )}
          </>
        )}
        <button onClick={handleClose}>Close</button>
      </div>
    </div>
  );
};

export default DesignMembers;
