import React, { useState } from "react";
import StructuralGrid from "./StructuralGRid";
import DesignSlabs from "./DesignSlabs";
import DesignColumns from "./DesignColumns";
import DesignBeams from "./DesignBeams";
import DesignFoundations from "./DesignFoundations";
import "./StructuralGrid.css"; // Assuming CSS is shared

const App = () => {
  const [activeTab, setActiveTab] = useState("grid"); // Default to grid view

  const navigateToDesign = () => {
    setActiveTab("slabs"); // Default to slabs as the initial design view; adjust as needed
  };

  return (
    <div className="app-container">
      <h1>Structural Design Application</h1>
      <div className="tabs">
        <button onClick={() => setActiveTab("grid")}>Grid View</button>
        <button onClick={() => setActiveTab("slabs")}>Design Slabs</button>
        <button onClick={() => setActiveTab("columns")}>Design Columns</button>
        <button onClick={() => setActiveTab("beams")}>Design Beams</button>
        <button onClick={() => setActiveTab("foundations")}>
          Design Foundations
        </button>
      </div>
      <div className="content">
        {activeTab === "grid" && (
          <StructuralGrid navigateToDesign={navigateToDesign} />
        )}
        {activeTab === "slabs" && <DesignSlabs />}
        {activeTab === "columns" && <DesignColumns />}
        {activeTab === "beams" && <DesignBeams />}
        {activeTab === "foundations" && <DesignFoundations />}
      </div>
    </div>
  );
};

export default App;
