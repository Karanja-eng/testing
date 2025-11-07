// QuantityTakeoff.jsx
import React, { useState, useEffect, useRef } from "react";
import { Eye, Calculator, FileText } from "lucide-react";
import descriptionsDatabase from "./descriptions.js";

const QuantityTakeoff = ({
  onDataUpdate,
  onViewDiagram,
  onGoToApproximate,
  onGoToBOQ,
}) => {
  const [rows, setRows] = useState([
    {
      id: 1,
      timesing: "1",
      dimensions: [""],
      quantity: 0,
      description: "",
      unit: "m³",
    },
  ]);
  const [activeRow, setActiveRow] = useState(0);
  const [nextId, setNextId] = useState(2);

  const ROWS_PER_PAGE = 18;

  // Mock API for descriptions
  const mockApi = {
    async searchDescriptions(query) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const lowercaseQuery = query.toLowerCase();

      for (const [key, descriptions] of Object.entries(descriptionsDatabase)) {
        if (key.includes(lowercaseQuery) || lowercaseQuery.includes(key)) {
          return descriptions;
        }
      }

      return [`Standard ${query} work`, `${query} as per specification`];
    },

    calculateQuantity(timesing, dimensions) {
      const product = dimensions.reduce(
        (acc, dim) => acc * (parseFloat(dim) || 1),
        1
      );
      return (parseFloat(timesing) || 1) * product;
    },
  };

  // Auto-save and update parent
  useEffect(() => {
    const savedRows = JSON.parse(localStorage.getItem("takeoff-rows") || "[]");
    if (savedRows.length > 0) {
      setRows(savedRows);
      setNextId(Math.max(...savedRows.map((r) => r.id)) + 1);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("takeoff-rows", JSON.stringify(rows));
    onDataUpdate && onDataUpdate(rows);
  }, [rows, onDataUpdate]);

  // Description Dropdown Component
  const DescriptionDropdown = ({ descriptions, onSelect, loading }) => {
    if (!descriptions.length && !loading) return null;

    return (
      <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
        {loading && (
          <div className="p-3 text-gray-500 text-sm">
            Searching descriptions...
          </div>
        )}
        {!loading &&
          descriptions.map((desc, i) => (
            <div
              key={i}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm"
              onMouseDown={() => onSelect(desc)}
            >
              {desc}
            </div>
          ))}
      </div>
    );
  };

  // Dimensions Input Component
  const DimensionsInput = ({ dimensions, onChange, onFocus }) => {
    const handleDimensionChange = (index, value) => {
      const newDimensions = [...dimensions];
      newDimensions[index] = value;
      onChange(newDimensions);
    };

    const addDimension = () => {
      onChange([...dimensions, ""]);
    };

    const removeDimension = (index) => {
      if (dimensions.length > 1) {
        const newDimensions = dimensions.filter((_, i) => i !== index);
        onChange(newDimensions);
      }
    };

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {dimensions.map((dim, index) => (
          <div key={index} className="flex items-center gap-1">
            <input
              type="number"
              value={dim}
              onChange={(e) => handleDimensionChange(index, e.target.value)}
              onFocus={onFocus}
              className="w-16 p-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="0"
              step="0.01"
            />
            {index > 0 && (
              <button
                onClick={() => removeDimension(index)}
                className="text-red-500 hover:text-red-700 text-sm font-bold w-4 h-4"
                type="button"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addDimension}
          className="text-blue-500 hover:text-blue-700 text-sm font-bold px-2 py-1 rounded hover:bg-blue-50"
          type="button"
        >
          +
        </button>
      </div>
    );
  };

  // Take-Off Row Component
  const TakeOffRow = ({
    row,
    index,
    onUpdate,
    onDelete,
    onClone,
    isActive,
    onActivate,
  }) => {
    const [localRow, setLocalRow] = useState(row);
    const [showDescriptions, setShowDescriptions] = useState(false);
    const [availableDescriptions, setAvailableDescriptions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      setLocalRow(row);
    }, [row]);

    const handleFieldChange = (field, value) => {
      const updated = { ...localRow, [field]: value };

      if (field === "timesing" || field === "dimensions") {
        updated.quantity = mockApi.calculateQuantity(
          updated.timesing,
          updated.dimensions
        );
      }

      setLocalRow(updated);
      onUpdate(index, updated);
    };

    const searchDescriptions = async (query) => {
      if (query.length < 3) {
        setShowDescriptions(false);
        return;
      }

      setLoading(true);
      try {
        const descriptions = await mockApi.searchDescriptions(query);
        setAvailableDescriptions(descriptions);
        setShowDescriptions(true);
      } catch (error) {
        console.error("Error fetching descriptions:", error);
      } finally {
        setLoading(false);
      }
    };

    const selectDescription = (description) => {
      handleFieldChange("description", description);
      setShowDescriptions(false);
    };

    return (
      <tr
        className={`${
          isActive ? "bg-blue-50" : ""
        } hover:bg-gray-50 transition-colors`}
      >
        <td className="p-2 border-r border-gray-200">
          <input
            type="number"
            value={localRow.timesing}
            onChange={(e) => handleFieldChange("timesing", e.target.value)}
            onFocus={onActivate}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-center"
            placeholder="1"
            step="0.01"
          />
        </td>

        <td className="p-2 border-r border-gray-200">
          <DimensionsInput
            dimensions={localRow.dimensions}
            onChange={(dims) => handleFieldChange("dimensions", dims)}
            onFocus={onActivate}
          />
        </td>

        <td className="p-2 border-r border-gray-200">
          <div className="p-2 bg-gray-100 rounded text-center font-semibold text-sm">
            {localRow.quantity.toFixed(2)}
          </div>
        </td>

        <td className="p-2 border-r border-gray-200">
          <select
            value={localRow.unit}
            onChange={(e) => handleFieldChange("unit", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="m">m</option>
            <option value="m²">m²</option>
            <option value="m³">m³</option>
            <option value="kg">kg</option>
            <option value="t">t</option>
            <option value="no">no</option>
          </select>
        </td>

        <td className="p-2 border-r border-gray-200 relative">
          <div className="relative">
            <input
              type="text"
              value={localRow.description}
              onChange={(e) => {
                handleFieldChange("description", e.target.value);
                searchDescriptions(e.target.value);
              }}
              onFocus={() => {
                onActivate();
                if (localRow.description.length >= 3) {
                  searchDescriptions(localRow.description);
                }
              }}
              onBlur={() => setTimeout(() => setShowDescriptions(false), 200)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Enter description..."
            />
            {showDescriptions && (
              <DescriptionDropdown
                descriptions={availableDescriptions}
                onSelect={selectDescription}
                loading={loading}
              />
            )}
          </div>
        </td>

        <td className="p-2 print:hidden">
          <div className="flex gap-1">
            <button
              onClick={() => onClone(index)}
              className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
              title="Clone row"
            >
              📋
            </button>
            <button
              onClick={() => onDelete(index)}
              className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
              title="Delete row"
            >
              🗑️
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // Row management functions
  const updateRow = (index, updatedRow) => {
    setRows((prev) => prev.map((row, i) => (i === index ? updatedRow : row)));
  };

  const deleteRow = (index) => {
    if (rows.length > 1) {
      setRows((prev) => prev.filter((_, i) => i !== index));
      if (activeRow >= rows.length - 1) {
        setActiveRow(Math.max(0, activeRow - 1));
      }
    }
  };

  const cloneRow = (index) => {
    const rowToClone = rows[index];
    const newRow = {
      ...rowToClone,
      id: nextId,
      description: "",
    };
    setNextId((prev) => prev + 1);
    setRows((prev) => [
      ...prev.slice(0, index + 1),
      newRow,
      ...prev.slice(index + 1),
    ]);
  };

  const addNewRow = () => {
    const newRow = {
      id: nextId,
      timesing: "1",
      dimensions: [""],
      quantity: 0,
      description: "",
      unit: "m³",
    };
    setNextId((prev) => prev + 1);
    setRows((prev) => [...prev, newRow]);
    setActiveRow(rows.length);
  };

  const clearAll = () => {
    if (window.confirm("Are you sure you want to clear all data?")) {
      setRows([
        {
          id: nextId,
          timesing: "1",
          dimensions: [""],
          quantity: 0,
          description: "",
          unit: "m³",
        },
      ]);
      setNextId((prev) => prev + 1);
      setActiveRow(0);
      localStorage.removeItem("takeoff-rows");
    }
  };

  // Calculate pages
  const pages = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    const pageRows = rows.slice(i, i + ROWS_PER_PAGE).map((row, index) => ({
      ...row,
      originalIndex: i + index,
    }));
    pages.push(pageRows);
  }

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Quantity Take-Off
            </h2>
            <p className="text-sm text-gray-600">
              {rows.length} items • Total: {totalQuantity.toFixed(2)} •{" "}
              {pages.length} pages
            </p>
          </div>

          {/* Enhanced Button Group */}
          <div className="flex flex-wrap gap-2">
            {/* Original buttons */}
            <button
              onClick={addNewRow}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Add Row
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              Print
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              Clear All
            </button>

            {/* Navigation buttons */}
            <div className="flex gap-2 border-l pl-2">
              <button
                onClick={onViewDiagram}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-1"
              >
                <Eye className="h-4 w-4" />
                View Plans
              </button>
              <button
                onClick={onGoToApproximate}
                className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium flex items-center gap-1"
              >
                <Calculator className="h-4 w-4" />
                Approximate
              </button>
              <button
                onClick={onGoToBOQ}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                BOQ
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-3 text-left font-semibold w-20">
                  T
                </th>
                <th className="border border-gray-300 p-3 text-left font-semibold w-48">
                  B (Dimensions)
                </th>
                <th className="border border-gray-300 p-3 text-left font-semibold w-24">
                  S (Quantity)
                </th>
                <th className="border border-gray-300 p-3 text-left font-semibold w-20">
                  Unit
                </th>
                <th className="border border-gray-300 p-3 text-left font-semibold">
                  D (Description)
                </th>
                <th className="border border-gray-300 p-3 text-left font-semibold w-20 print:hidden">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <TakeOffRow
                  key={row.id}
                  row={row}
                  index={index}
                  onUpdate={updateRow}
                  onDelete={deleteRow}
                  onClone={cloneRow}
                  isActive={activeRow === index}
                  onActivate={() => setActiveRow(index)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuantityTakeoff;
