// frontend/src/components/PavementCalculator.js
import React, { useState } from "react";
import axios from "axios";

function PavementCalculator() {
  const [inputs, setInputs] = useState({
    length: "",
    width: "",
    thickness: "",
  });

  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "http://localhost:8000/calculate/pavement",
        {
          ...inputs,
          length: parseFloat(inputs.length),
          width: parseFloat(inputs.width),
          thickness: parseFloat(inputs.thickness),
        }
      );
      setResults(response.data);
      setError(null);
    } catch (err) {
      setError("Error calculating quantities. Please check inputs.");
      setResults(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Pavement Quantity Takeoff</h2>
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-md w-full max-w-md"
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Length (m)
          </label>
          <input
            type="number"
            name="length"
            value={inputs.length}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            required
            step="0.01"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Width (m)
          </label>
          <input
            type="number"
            name="width"
            value={inputs.width}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            required
            step="0.01"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Thickness (m)
          </label>
          <input
            type="number"
            name="thickness"
            value={inputs.thickness}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            required
            step="0.01"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
        >
          Calculate
        </button>
      </form>

      {error && <p className="mt-4 text-red-500">{error}</p>}

      {results && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md w-full max-w-2xl">
          <h3 className="text-xl font-bold mb-4">Takeoff Results</h3>
          <table className="w-full border-collapse border border-gray-300 mb-6">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 p-2 text-left">
                  Description
                </th>
                <th className="border border-gray-300 p-2 text-left">
                  Timesing
                </th>
                <th className="border border-gray-300 p-2 text-left">
                  Dimensions
                </th>
                <th className="border border-gray-300 p-2 text-left">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2">Pavement area</td>
                <td className="border border-gray-300 p-2">1</td>
                <td className="border border-gray-300 p-2">
                  {inputs.length} x {inputs.width}
                </td>
                <td className="border border-gray-300 p-2">
                  {results.area.toFixed(2)} m²
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2">
                  Concrete in pavement
                </td>
                <td className="border border-gray-300 p-2">1</td>
                <td className="border border-gray-300 p-2">
                  {inputs.length} x {inputs.width} x {inputs.thickness}
                </td>
                <td className="border border-gray-300 p-2">
                  {results.vol_material.toFixed(2)} m³
                </td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-xl font-bold mb-2">
            Material Quantities (1:1.5:3 mix, dry volume = wet x 1.54)
          </h3>
          <ul className="list-disc pl-6">
            <li>Dry volume: {results.dry_volume.toFixed(2)} m³</li>
            <li>
              Cement: {results.cement_vol.toFixed(2)} m³ (
              {results.cement_bags.toFixed(2)} bags)
            </li>
            <li>Sand: {results.sand_vol.toFixed(2)} m³</li>
            <li>Aggregate: {results.aggregate_vol.toFixed(2)} m³</li>
          </ul>

          <p className="mt-4 text-sm text-gray-600">
            Note: Follows SMM principles (e.g., NRM2). Adjust for additional
            features as needed.
          </p>
        </div>
      )}
    </div>
  );
}

export default PavementCalculator;
