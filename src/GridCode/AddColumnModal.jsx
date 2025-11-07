import React from "react";

const AddColumnModal = ({
  showModal,
  setShowModal,
  activeElement,
  setActiveElement,
  grid,
  addColumnToBeam,
}) => {
  const handleClose = () => setShowModal({ ...showModal, addColumn: false });

  return (
    showModal.addColumn && (
      <div className="modal">
        <div className="modal-content">
          <h3>Add Column to Beam</h3>
          <select
            onChange={(e) => setActiveElement(e.target.value)}
            defaultValue=""
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
          <input
            type="number"
            placeholder="Distance from start (mm)"
            onChange={(e) => {
              if (activeElement)
                addColumnToBeam(activeElement, +e.target.value);
            }}
          />
          <button onClick={handleClose}>Close</button>
        </div>
      </div>
    )
  );
};

export default AddColumnModal;
