import React from "react";

const EditModals = ({
  showModal,
  setShowModal,
  activeElement,
  setActiveElement,
  grid,
  updateDimension,
  calculateLoad,
}) => {
  const handleClose = (type) => setShowModal({ ...showModal, [type]: false });

  return (
    <>
      {showModal.column && (
        <div className="modal">
          <div className="modal-content">
            <h3>Edit Column</h3>
            <select
              value={activeElement || ""}
              onChange={(e) => setActiveElement(e.target.value)}
            >
              <option value="" disabled>
                Select Column
              </option>
              {Object.keys(grid.columnDimensions).map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
            <label>Width (mm):</label>
            <input
              type="number"
              value={grid.columnDimensions[activeElement]?.width || 300}
              onChange={(e) =>
                updateDimension(activeElement, "column", {
                  width: +e.target.value,
                })
              }
            />
            <label>Height (mm):</label>
            <input
              type="number"
              value={grid.columnDimensions[activeElement]?.height || 300}
              onChange={(e) =>
                updateDimension(activeElement, "column", {
                  height: +e.target.value,
                })
              }
            />
            <label>Rotation (degrees):</label>
            <input
              type="number"
              value={grid.columnDimensions[activeElement]?.rotation || 0}
              onChange={(e) =>
                updateDimension(activeElement, "column", {
                  rotation: +e.target.value,
                })
              }
            />
            <p>
              Load:{" "}
              {calculateLoad(
                "column",
                grid.columnDimensions[activeElement] || {
                  width: 300,
                  height: 300,
                }
              )}{" "}
              kN
            </p>
            <button onClick={() => handleClose("column")}>Close</button>
          </div>
        </div>
      )}
      {showModal.beam && (
        <div className="modal">
          <div className="modal-content">
            <h3>Edit Beam</h3>
            <select
              value={activeElement || ""}
              onChange={(e) => setActiveElement(e.target.value)}
            >
              <option value="" disabled>
                Select Beam
              </option>
              {Object.keys(grid.beamDimensions).map((beam) => (
                <option key={beam} value={beam}>
                  {beam}
                </option>
              ))}
            </select>
            <label>Width (mm):</label>
            <input
              type="number"
              value={grid.beamDimensions[activeElement]?.width || 7200}
              onChange={(e) =>
                updateDimension(activeElement, "beam", {
                  width: +e.target.value,
                })
              }
            />
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
            <p>
              Load:{" "}
              {calculateLoad(
                "beam",
                grid.beamDimensions[activeElement] || {
                  width: 7200,
                  depth: 400,
                  breadth: 300,
                }
              )}{" "}
              kN
            </p>
            <button onClick={() => handleClose("beam")}>Close</button>
          </div>
        </div>
      )}
      {showModal.slab && (
        <div className="modal">
          <div className="modal-content">
            <h3>Edit Slab</h3>
            <select
              value={activeElement || ""}
              onChange={(e) => setActiveElement(e.target.value)}
            >
              <option value="" disabled>
                Select Slab
              </option>
              {Object.keys(grid.panelDimensions).map((slab) => (
                <option key={slab} value={slab}>
                  {slab}
                </option>
              ))}
            </select>
            <label>Width (mm):</label>
            <input
              type="number"
              value={grid.panelDimensions[activeElement]?.width || 7200}
              onChange={(e) =>
                updateDimension(activeElement, "panel", {
                  width: +e.target.value,
                })
              }
            />
            <label>Height (mm):</label>
            <input
              type="number"
              value={grid.panelDimensions[activeElement]?.height || 6000}
              onChange={(e) =>
                updateDimension(activeElement, "panel", {
                  height: +e.target.value,
                })
              }
            />
            <p>
              Load:{" "}
              {calculateLoad(
                "panel",
                grid.panelDimensions[activeElement] || {
                  width: 7200,
                  height: 6000,
                }
              )}{" "}
              kN
            </p>
            <button onClick={() => handleClose("slab")}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

export default EditModals;
