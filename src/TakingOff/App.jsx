// frontend/src/App.js
import React, { useState } from "react";
import StairsCalculator from "./Stairscalculator";
import FoundationCalculator from "./FoundationCalculator";
import SuperstructureCalculator from "./SuperstructureCalculator";
import PavementCalculator from "./PavementCalculator";
import ManholesCalculator from "./ManholesCalculator";
import RetainingWallsCalculator from "./RetainingWallsCalculator";
import SwimmingPoolsCalculator from "./SwimmingPoolsCalculator";
import BasementCalculator from "./BasementCalculator";
import WaterTanksCalculator from "./WaterTanksCalculator";
import RoofsCalculator from "./RoofsCalculator";
import QuantityTakeOffApp from "./Takoff";
import SurveyApp from "./survey";

function App() {
  const [activeTab, setActiveTab] = useState(null); // null for initial state

  const tabs = [
    { id: "Sheet", label: "Sheet", component: <QuantityTakeOffApp /> },
    { id: "Survey", label: "Survey", component: <SurveyApp /> },

    { id: "stairs", label: "Stairs", component: <StairsCalculator /> },
    {
      id: "foundation",
      label: "Foundation",
      component: <FoundationCalculator />,
    },
    {
      id: "superstructure",
      label: "Superstructure",
      component: <SuperstructureCalculator />,
    },
    { id: "pavement", label: "Pavement", component: <PavementCalculator /> },
    { id: "manholes", label: "Manholes", component: <ManholesCalculator /> },
    {
      id: "retaining-walls",
      label: "Retaining Walls",
      component: <RetainingWallsCalculator />,
    },
    {
      id: "swimming-pools",
      label: "Swimming Pools",
      component: <SwimmingPoolsCalculator />,
    },
    { id: "basement", label: "Basement", component: <BasementCalculator /> },
    {
      id: "water-tanks",
      label: "Water Tanks",
      component: <WaterTanksCalculator />,
    },
    { id: "roofs", label: "Roofs", component: <RoofsCalculator /> },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md p-4">
        <h1 className="text-2xl font-bold mb-6">Quantity Takeoff</h1>
        <ul className="space-y-2">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`block w-full text-left py-2 px-4 hover:bg-blue-100 ${
                  activeTab === tab.id ? "bg-blue-200" : ""
                }`}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {activeTab ? (
          tabs.find((tab) => tab.id === activeTab)?.component
        ) : (
          <h2 className="text-2xl">Select a category from the sidebar</h2>
        )}
      </div>
    </div>
  );
}

export default App;
