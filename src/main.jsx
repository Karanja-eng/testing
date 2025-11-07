// frontend/src/App.js
// React frontend for construction quantity takeoff app

import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import StairsCalculator from "./components/StairsCalculator";
import FoundationCalculator from "./components/FoundationCalculator";
import SuperstructureCalculator from "./components/SuperstructureCalculator";
import PavementCalculator from "./components/PavementCalculator";
import ManholesCalculator from "./components/ManholesCalculator";
import RetainingWallsCalculator from "./components/RetainingWallsCalculator";
import SwimmingPoolsCalculator from "./components/SwimmingPoolsCalculator";
import BasementCalculator from "./components/BasementCalculator";
import WaterTanksCalculator from "./components/WaterTanksCalculator";
import RoofsCalculator from "./components/RoofsCalculator";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-md p-4">
          <h1 className="text-2xl font-bold mb-6">Quantity Takeoff</h1>
          <ul className="space-y-2">
            <li>
              <Link to="/stairs" className="block py-2 px-4 hover:bg-blue-100">
                Stairs
              </Link>
            </li>
            <li>
              <Link
                to="/foundation"
                className="block py-2 px-4 hover:bg-blue-100"
              >
                Foundation
              </Link>
            </li>
            <li>
              <Link
                to="/superstructure"
                className="block py-2 px-4 hover:bg-blue-100"
              >
                Superstructure
              </Link>
            </li>
            <li>
              <Link
                to="/pavement"
                className="block py-2 px-4 hover:bg-blue-100"
              >
                Pavement
              </Link>
            </li>
            <li>
              <Link
                to="/manholes"
                className="block py-2 px-4 hover:bg-blue-100"
              >
                Manholes
              </Link>
            </li>
            <li>
              <Link
                to="/retaining-walls"
                className="block py-2 px-4 hover:bg-blue-100"
              >
                Retaining Walls
              </Link>
            </li>
            <li>
              <Link
                to="/swimming-pools"
                className="block py-2 px-4 hover:bg-blue-100"
              >
                Swimming Pools
              </Link>
            </li>
            <li>
              <Link
                to="/basement"
                className="block py-2 px-4 hover:bg-blue-100"
              >
                Basement
              </Link>
            </li>
            <li>
              <Link
                to="/water-tanks"
                className="block py-2 px-4 hover:bg-blue-100"
              >
                Water Tanks
              </Link>
            </li>
            <li>
              <Link to="/roofs" className="block py-2 px-4 hover:bg-blue-100">
                Roofs
              </Link>
            </li>
          </ul>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <Routes>
            <Route path="/stairs" element={<StairsCalculator />} />
            <Route path="/foundation" element={<FoundationCalculator />} />
            <Route
              path="/superstructure"
              element={<SuperstructureCalculator />}
            />
            <Route path="/pavement" element={<PavementCalculator />} />
            <Route path="/manholes" element={<ManholesCalculator />} />
            <Route
              path="/retaining-walls"
              element={<RetainingWallsCalculator />}
            />
            <Route
              path="/swimming-pools"
              element={<SwimmingPoolsCalculator />}
            />
            <Route path="/basement" element={<BasementCalculator />} />
            <Route path="/water-tanks" element={<WaterTanksCalculator />} />
            <Route path="/roofs" element={<RoofsCalculator />} />
            <Route
              path="/"
              element={
                <h2 className="text-2xl">Select a category from the sidebar</h2>
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
