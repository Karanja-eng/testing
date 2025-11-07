import React, { useState, useEffect, useRef } from "react";
import descriptions from "./descriptions";

// Mock backend API (keeps calculateQuantity here). Descriptions come from descriptions.js
const mockApi = {
  async searchDescriptions(query) {
    // small debounce-like delay to mimic async search
    await new Promise((resolve) => setTimeout(resolve, 200));
    const lowercaseQuery = query.toLowerCase();

    for (const [key, descs] of Object.entries(descriptions)) {
      if (key.includes(lowercaseQuery) || lowercaseQuery.includes(key)) {
        return descs;
      }
    }

    // If no exact key match, try to find matches inside the description values
    const matches = [];
    for (const descList of Object.values(descriptions)) {
      for (const d of descList) {
        if (d.toLowerCase().includes(lowercaseQuery)) {
          matches.push(d);
          if (matches.length >= 10) break;
        }
      }
      if (matches.length >= 10) break;
    }
    if (matches.length) return matches.slice(0, 10);

    // Fallback suggestions
    return [
      `Standard ${query} work`,
      `${query} in accordance with specification`,
      `${query} as per drawing details`,
    ];
  },

  calculateQuantity(timesing, dimensions) {
    const product = dimensions.reduce(
      (acc, dim) => acc * (parseFloat(dim) || 1),
      1
    );
    return (parseFloat(timesing) || 1) * product;
  },
};

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
            className="w-16 p-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="0"
            step="0.01"
          />
          {index > 0 && (
            <button
              onClick={() => removeDimension(index)}
              className="text-red-500 hover:text-red-700 text-sm font-bold w-4 h-4 flex items-center justify-center"
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
  const descriptionRef = useRef(null);

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
          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
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

      <td className="p-2 border-r border-gray-200 relative">
        <div className="relative">
          <input
            ref={descriptionRef}
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
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="Enter description or heading..."
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
            className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs transition-colors"
            title="Clone row"
          >
            📋
          </button>
          <button
            onClick={() => onDelete(index)}
            className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs transition-colors"
            title="Delete row"
          >
            🗑️
          </button>
        </div>
      </td>
    </tr>
  );
};

// A3 Page Component
const TakeOffPage = ({
  rows,
  pageNumber,
  onRowUpdate,
  onRowDelete,
  onRowClone,
  activeRow,
  onActivateRow,
}) => {
  return (
    <div
      className="bg-white mx-auto mb-8 shadow-lg print:shadow-none print:mb-0"
      style={{
        width: "29.7cm",
        minHeight: "42cm",
        padding: "1.5cm",
      }}
    >
      {/* Page Header */}
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Quantity Take-Off Sheet
        </h1>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Page {pageNumber}</span>
          <span>Date: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Table */}
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
            <th className="border border-gray-300 p-3 text-left font-semibold">
              D (Description)
            </th>
            <th className="border border-gray-300 p-3 text-left font-semibold w-20 print:hidden">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TakeOffRow
              key={row.id}
              row={row}
              index={row.originalIndex}
              onUpdate={onRowUpdate}
              onDelete={onRowDelete}
              onClone={onRowClone}
              isActive={activeRow === row.originalIndex}
              onActivate={() => onActivateRow(row.originalIndex)}
            />
          ))}
        </tbody>
      </table>

      {/* Page Footer */}
      <div className="mt-8 flex justify-end">
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
          <div>Items on page: {rows.length}</div>
          <div className="font-semibold">
            Page total:{" "}
            {rows.reduce((sum, row) => sum + row.quantity, 0).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};

// Control Panel Component
const ControlPanel = ({
  totalRows,
  totalQuantity,
  totalPages,
  onAddRow,
  onPrint,
  onClearAll,
}) => {
  return (
    <div className="bg-white shadow-sm border-b px-6 py-4 sticky top-0 z-30 print:hidden">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Quantity Take-Off System
          </h1>
          <p className="text-sm text-gray-600">
            {totalRows} items • Total: {totalQuantity.toFixed(2)} • {totalPages}{" "}
            pages
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onAddRow}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Row
          </button>
          <button
            onClick={onPrint}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Print/Export
          </button>
          <button
            onClick={onClearAll}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
};

// Summary Panel Component
const SummaryPanel = ({ totalRows, totalQuantity, totalPages }) => {
  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 border print:hidden">
      <h3 className="font-semibold text-gray-800 mb-2">Summary</h3>
      <div className="text-sm text-gray-600 space-y-1">
        <div>Total Items: {totalRows}</div>
        <div>Total Quantity: {totalQuantity.toFixed(2)}</div>
        <div>Pages: {totalPages}</div>
      </div>
    </div>
  );
};

// Main App Component
const QuantityTakeOffApp = () => {
  const [rows, setRows] = useState([
    {
      id: 1,
      timesing: "1",
      dimensions: [""],
      quantity: 0,
      description: "",
    },
  ]);
  const [activeRow, setActiveRow] = useState(0);
  const [nextId, setNextId] = useState(2);

  const ROWS_PER_PAGE = 18;

  // Auto-save functionality
  useEffect(() => {
    const savedRows = JSON.parse(localStorage.getItem("takeoff-rows") || "[]");
    if (savedRows.length > 0) {
      setRows(savedRows);
      setNextId(Math.max(...savedRows.map((r) => r.id)) + 1);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("takeoff-rows", JSON.stringify(rows));
  }, [rows]);

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
        },
      ]);
      setNextId((prev) => prev + 1);
      setActiveRow(0);
      localStorage.removeItem("takeoff-rows");
    }
  };

  const printPages = () => {
    window.print();
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
    <div className="min-h-screen bg-gray-50">
      <style>
        {`
          @media print {
            body { margin: 0; background: white; }
            * { -webkit-print-color-adjust: exact; }
            @page { size: A3; margin: 0; }
          }
        `}
      </style>

      <ControlPanel
        totalRows={rows.length}
        totalQuantity={totalQuantity}
        totalPages={pages.length}
        onAddRow={addNewRow}
        onPrint={printPages}
        onClearAll={clearAll}
      />

      <div className="py-8">
        {pages.map((pageRows, pageIndex) => (
          <TakeOffPage
            key={pageIndex}
            rows={pageRows}
            pageNumber={pageIndex + 1}
            onRowUpdate={updateRow}
            onRowDelete={deleteRow}
            onRowClone={cloneRow}
            activeRow={activeRow}
            onActivateRow={setActiveRow}
          />
        ))}
      </div>

      <SummaryPanel
        totalRows={rows.length}
        totalQuantity={totalQuantity}
        totalPages={pages.length}
      />
    </div>
  );
};

export default QuantityTakeOffApp;
