import React, { useState } from "react";
import {
  Calculator,
  FileText,
  Download,
  Building2,
  Wrench,
  PaintBucket,
  Droplets,
} from "lucide-react";
import axios from "axios";
const ConstructionCalculator = () => {
  const [selectedWork, setSelectedWork] = useState("");
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);

  // Add axios to your project

  const API_BASE_URL = "http://localhost:8000";

  // Example API call
const calculateUnitRate = async (workType, inputs, region) => {
  try {
    // Normalize work type key to match backend exactly
    const formattedWorkType = workType.trim();

    const response = await axios.post(`${API_BASE_URL}/calculate`, {
      workType: formattedWorkType,
      inputs: inputs,
      region: region,
    });

    return response.data;
  } catch (error) {
    console.error("Calculation error:", error.response?.data || error);
    throw error;
  }
};

  const workCategories = {
    earthworks: {
      name: "Earthworks",
      icon: <Building2 className="w-5 h-5" />,
      items: [
        "Site Clearance",
        "Bulk Excavation",
        "Trench Excavation",
        "Backfilling",
        "Hardcore Filling",
        "Compaction",
      ],
    },
    concrete: {
      name: "Concrete Works",
      icon: <Wrench className="w-5 h-5" />,
      items: [
        "Mass Concrete Foundation",
        "Reinforced Concrete Slab",
        "Concrete Columns",
        "Concrete Beams",
        "Retaining Walls",
      ],
    },
    masonry: {
      name: "Masonry Works",
      icon: <Building2 className="w-5 h-5" />,
      items: ["Block Walling", "Brick Walling", "Stone Walling"],
    },
    finishes: {
      name: "Finishes",
      icon: <PaintBucket className="w-5 h-5" />,
      items: [
        "Wall Tiling",
        "Floor Tiling",
        "Bathroom Tiling",
        "Kitchen Tiling",
        "Painting - Emulsion",
        "Painting - Gloss",
        "Plastering",
        "Screeding",
      ],
    },
    plumbing: {
      name: "Plumbing Works",
      icon: <Droplets className="w-5 h-5" />,
      items: [
        "Sewer Pipe Laying",
        "Water Pipe Installation",
        "Manhole Construction",
        "Septic Tank Construction",
        "Water Tank Installation",
      ],
    },
    roofing: {
      name: "Roofing Works",
      icon: <Building2 className="w-5 h-5" />,
      items: [
        "Timber Roof Trusses",
        "Iron Sheet Roofing",
        "Tile Roofing",
        "Fascia Boards",
        "Gutters & Downpipes",
      ],
    },
    electrical: {
      name: "Electrical Works",
      icon: <Wrench className="w-5 h-5" />,
      items: [
        "Conduit Installation",
        "Wiring Installation",
        "Socket Installation",
        "Lighting Points",
        "Distribution Board",
      ],
    },
  };

  const workInputs = {
    "Site Clearance": [
      { name: "area", label: "Area (m²)", type: "number", required: true },
      {
        name: "vegetation_density",
        label: "Vegetation Density",
        type: "select",
        options: ["Light", "Medium", "Heavy"],
        required: true,
      },
      {
        name: "disposal_distance",
        label: "Disposal Distance (km)",
        type: "number",
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
      {
        name: "terrain",
        label: "Terrain Type",
        type: "select",
        options: ["Flat", "Sloped", "Very Sloped"],
        required: true,
      },
      {
        name: "access_difficulty",
        label: "Site Access",
        type: "select",
        options: ["Easy", "Moderate", "Difficult"],
        required: true,
      },
      {
        name: "building_nearby",
        label: "Buildings Nearby",
        type: "select",
        options: ["Yes", "No"],
        required: true,
      },
    ],
    "Bulk Excavation": [
      { name: "volume", label: "Volume (m³)", type: "number", required: true },
      {
        name: "depth",
        label: "Average Depth (m)",
        type: "number",
        required: true,
      },
      {
        name: "soil_type",
        label: "Soil Type",
        type: "select",
        options: ["Soft", "Medium", "Hard", "Rock"],
        required: true,
      },
      {
        name: "excavation_method",
        label: "Method",
        type: "select",
        options: ["Manual", "Machine"],
        required: true,
      },
      {
        name: "water_table",
        label: "Water Table Issue",
        type: "select",
        options: ["Dry", "Seasonal", "High"],
        required: true,
      },
      {
        name: "disposal_distance",
        label: "Disposal Distance (km)",
        type: "number",
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Wall Tiling": [
      { name: "area", label: "Wall Area (m²)", type: "number", required: true },
      {
        name: "tile_size",
        label: "Tile Size (cm)",
        type: "select",
        options: ["20x20", "30x30", "40x40", "60x60"],
        required: true,
      },
      {
        name: "tile_quality",
        label: "Tile Quality",
        type: "select",
        options: ["Standard", "Premium", "Luxury"],
        required: true,
      },
      {
        name: "wall_condition",
        label: "Wall Condition",
        type: "select",
        options: ["Good", "Fair", "Poor"],
        required: true,
      },
      {
        name: "pattern",
        label: "Laying Pattern",
        type: "select",
        options: ["Straight", "Diagonal", "Herringbone"],
        required: true,
      },
      {
        name: "wastage",
        label: "Expected Wastage (%)",
        type: "number",
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Floor Tiling": [
      {
        name: "area",
        label: "Floor Area (m²)",
        type: "number",
        required: true,
      },
      {
        name: "tile_size",
        label: "Tile Size (cm)",
        type: "select",
        options: ["20x20", "30x30", "40x40", "60x60", "80x80"],
        required: true,
      },
      {
        name: "tile_quality",
        label: "Tile Quality",
        type: "select",
        options: ["Standard", "Premium", "Luxury"],
        required: true,
      },
      {
        name: "floor_condition",
        label: "Floor Condition",
        type: "select",
        options: ["Good", "Fair", "Poor"],
        required: true,
      },
      {
        name: "pattern",
        label: "Laying Pattern",
        type: "select",
        options: ["Straight", "Diagonal", "Herringbone"],
        required: true,
      },
      {
        name: "wastage",
        label: "Expected Wastage (%)",
        type: "number",
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Bathroom Tiling": [
      {
        name: "floor_area",
        label: "Floor Area (m²)",
        type: "number",
        required: true,
      },
      {
        name: "wall_area",
        label: "Wall Area (m²)",
        type: "number",
        required: true,
      },
      {
        name: "tile_quality",
        label: "Tile Quality",
        type: "select",
        options: ["Standard", "Premium", "Luxury"],
        required: true,
      },
      {
        name: "waterproofing",
        label: "Waterproofing Required",
        type: "select",
        options: ["Yes", "No"],
        required: true,
      },
      {
        name: "special_cuts",
        label: "Special Cuts/Features",
        type: "select",
        options: ["None", "Few", "Many"],
        required: true,
      },
      {
        name: "wastage",
        label: "Expected Wastage (%)",
        type: "number",
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Painting - Emulsion": [
      {
        name: "area",
        label: "Surface Area (m²)",
        type: "number",
        required: true,
      },
      {
        name: "coats",
        label: "Number of Coats",
        type: "number",
        required: true,
      },
      {
        name: "paint_quality",
        label: "Paint Quality",
        type: "select",
        options: ["Economy", "Standard", "Premium"],
        required: true,
      },
      {
        name: "surface_condition",
        label: "Surface Condition",
        type: "select",
        options: ["New", "Repaint-Good", "Repaint-Poor"],
        required: true,
      },
      {
        name: "color",
        label: "Color Type",
        type: "select",
        options: ["White", "Light Colors", "Dark Colors"],
        required: true,
      },
      {
        name: "height",
        label: "Working Height",
        type: "select",
        options: ["Standard", "High", "Very High"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Sewer Pipe Laying": [
      { name: "length", label: "Length (m)", type: "number", required: true },
      {
        name: "pipe_diameter",
        label: "Pipe Diameter (mm)",
        type: "select",
        options: ["100", "150", "200", "250", "300"],
        required: true,
      },
      {
        name: "pipe_material",
        label: "Pipe Material",
        type: "select",
        options: ["PVC", "HDPE", "Concrete"],
        required: true,
      },
      {
        name: "trench_depth",
        label: "Average Trench Depth (m)",
        type: "number",
        required: true,
      },
      {
        name: "soil_type",
        label: "Soil Type",
        type: "select",
        options: ["Soft", "Medium", "Hard"],
        required: true,
      },
      {
        name: "bedding_required",
        label: "Bedding Required",
        type: "select",
        options: ["Yes", "No"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Manhole Construction": [
      {
        name: "depth",
        label: "Manhole Depth (m)",
        type: "number",
        required: true,
      },
      {
        name: "manhole_type",
        label: "Manhole Type",
        type: "select",
        options: ["Standard", "Deep", "Junction"],
        required: true,
      },
      {
        name: "diameter",
        label: "Internal Diameter (mm)",
        type: "select",
        options: ["900", "1050", "1200"],
        required: true,
      },
      {
        name: "cover_type",
        label: "Cover Type",
        type: "select",
        options: ["Light", "Medium", "Heavy Duty"],
        required: true,
      },
      {
        name: "excavation_condition",
        label: "Excavation Condition",
        type: "select",
        options: ["Dry", "Wet", "Rocky"],
        required: true,
      },
      {
        name: "benching_required",
        label: "Benching Required",
        type: "select",
        options: ["Yes", "No"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Mass Concrete Foundation": [
      {
        name: "volume",
        label: "Concrete Volume (m³)",
        type: "number",
        required: true,
      },
      {
        name: "concrete_grade",
        label: "Concrete Grade",
        type: "select",
        options: ["C15", "C20", "C25", "C30"],
        required: true,
      },
      {
        name: "foundation_depth",
        label: "Foundation Depth (m)",
        type: "number",
        required: true,
      },
      {
        name: "pour_method",
        label: "Pouring Method",
        type: "select",
        options: ["Manual", "Ready Mix", "Concrete Pump"],
        required: true,
      },
      {
        name: "access_difficulty",
        label: "Site Access",
        type: "select",
        options: ["Easy", "Moderate", "Difficult"],
        required: true,
      },
      {
        name: "curing_method",
        label: "Curing Method",
        type: "select",
        options: ["Water", "Membrane", "Both"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Reinforced Concrete Slab": [
      { name: "area", label: "Slab Area (m²)", type: "number", required: true },
      {
        name: "thickness",
        label: "Slab Thickness (mm)",
        type: "number",
        required: true,
      },
      {
        name: "concrete_grade",
        label: "Concrete Grade",
        type: "select",
        options: ["C20", "C25", "C30", "C35"],
        required: true,
      },
      {
        name: "reinforcement_ratio",
        label: "Reinforcement",
        type: "select",
        options: ["Light", "Medium", "Heavy"],
        required: true,
      },
      {
        name: "formwork_type",
        label: "Formwork Type",
        type: "select",
        options: ["Timber", "Steel", "Plastic"],
        required: true,
      },
      {
        name: "slab_level",
        label: "Slab Level",
        type: "select",
        options: ["Ground Floor", "First Floor", "Upper Floors"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Block Walling": [
      { name: "area", label: "Wall Area (m²)", type: "number", required: true },
      {
        name: "block_size",
        label: "Block Size",
        type: "select",
        options: ["4 inch", "6 inch", "8 inch", "9 inch"],
        required: true,
      },
      {
        name: "wall_height",
        label: "Wall Height (m)",
        type: "number",
        required: true,
      },
      {
        name: "mortar_ratio",
        label: "Mortar Ratio",
        type: "select",
        options: ["1:4", "1:5", "1:6"],
        required: true,
      },
      {
        name: "reinforcement",
        label: "Reinforcement",
        type: "select",
        options: ["None", "Horizontal", "Vertical", "Both"],
        required: true,
      },
      {
        name: "finish",
        label: "Wall Finish",
        type: "select",
        options: ["Fair Face", "To be Plastered"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    Plastering: [
      {
        name: "area",
        label: "Surface Area (m²)",
        type: "number",
        required: true,
      },
      {
        name: "thickness",
        label: "Plaster Thickness (mm)",
        type: "number",
        required: true,
      },
      {
        name: "mortar_ratio",
        label: "Mortar Ratio",
        type: "select",
        options: ["1:3", "1:4", "1:5"],
        required: true,
      },
      {
        name: "surface_type",
        label: "Surface Type",
        type: "select",
        options: ["Wall", "Ceiling", "Column"],
        required: true,
      },
      {
        name: "finish_quality",
        label: "Finish Quality",
        type: "select",
        options: ["Rough", "Smooth", "Fine"],
        required: true,
      },
      {
        name: "wall_condition",
        label: "Wall Condition",
        type: "select",
        options: ["New", "Old", "Damaged"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    Screeding: [
      {
        name: "area",
        label: "Floor Area (m²)",
        type: "number",
        required: true,
      },
      {
        name: "thickness",
        label: "Screed Thickness (mm)",
        type: "number",
        required: true,
      },
      {
        name: "mix_ratio",
        label: "Mix Ratio",
        type: "select",
        options: ["1:3", "1:4"],
        required: true,
      },
      {
        name: "finish",
        label: "Finish Type",
        type: "select",
        options: ["Rough", "Smooth", "Power Floated"],
        required: true,
      },
      {
        name: "base_condition",
        label: "Base Condition",
        type: "select",
        options: ["Good", "Fair", "Poor"],
        required: true,
      },
      {
        name: "falls_required",
        label: "Falls Required",
        type: "select",
        options: ["Yes", "No"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Trench Excavation": [
      {
        name: "length",
        label: "Trench Length (m)",
        type: "number",
        required: true,
      },
      {
        name: "width",
        label: "Trench Width (m)",
        type: "number",
        required: true,
      },
      {
        name: "depth",
        label: "Trench Depth (m)",
        type: "number",
        required: true,
      },
      {
        name: "soil_type",
        label: "Soil Type",
        type: "select",
        options: ["Soft", "Medium", "Hard", "Rock"],
        required: true,
      },
      {
        name: "shoring_required",
        label: "Shoring Required",
        type: "select",
        options: ["Yes", "No"],
        required: true,
      },
      {
        name: "dewatering",
        label: "Dewatering Required",
        type: "select",
        options: ["Yes", "No"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
    "Iron Sheet Roofing": [
      { name: "area", label: "Roof Area (m²)", type: "number", required: true },
      {
        name: "sheet_gauge",
        label: "Sheet Gauge",
        type: "select",
        options: ["28", "30", "32"],
        required: true,
      },
      {
        name: "sheet_type",
        label: "Sheet Type",
        type: "select",
        options: ["Box Profile", "Corrugated", "Tile Profile"],
        required: true,
      },
      {
        name: "coating",
        label: "Coating",
        type: "select",
        options: ["Plain", "Colored", "Stone Coated"],
        required: true,
      },
      {
        name: "roof_pitch",
        label: "Roof Pitch",
        type: "select",
        options: ["Low", "Medium", "Steep"],
        required: true,
      },
      {
        name: "complexity",
        label: "Roof Complexity",
        type: "select",
        options: ["Simple", "Moderate", "Complex"],
        required: true,
      },
      {
        name: "region",
        label: "Region",
        type: "select",
        options: ["Nairobi", "Coast", "Western"],
        required: true,
      },
    ],
  };

  const handleInputChange = (name, value) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleCalculate = async () => {
    try {
      const resultData = await calculateUnitRate(
        selectedWork,
        inputs,region
      );
      setResult(resultData);
    } catch (error) {
    console.error("Calculation failed:", error);
      alert("Calculation failed. Check API server or input values.");
    }
  };

  const generateReport = () => {
    if (!result) return;

    const reportContent = `
CONSTRUCTION UNIT RATE REPORT
=====================================

Project: ${selectedWork}
Date: ${new Date().toLocaleDateString()}
Region: ${inputs.region || "N/A"}

QUANTITY & UNIT RATE
-------------------------------------
Quantity: ${result.quantity} ${result.unit.split("/")[1]}
Unit Rate: ${result.unitRate} ${result.unit}
Total Cost: KES ${result.totalCost}

COST BREAKDOWN
-------------------------------------

MATERIALS:
${Object.entries(result.breakdown.materials)
  .map(
    ([key, value]) =>
      `  ${key.replace(/_/g, " ").toUpperCase()}: KES ${value.toFixed(2)}`
  )
  .join("\n")}

LABOUR:
${Object.entries(result.breakdown.labour)
  .map(
    ([key, value]) =>
      `  ${key.replace(/_/g, " ").toUpperCase()}: KES ${value.toFixed(2)}`
  )
  .join("\n")}

EQUIPMENT:
${Object.entries(result.breakdown.equipment)
  .map(
    ([key, value]) =>
      `  ${key.replace(/_/g, " ").toUpperCase()}: KES ${value.toFixed(2)}`
  )
  .join("\n")}

OTHER COSTS:
  OVERHEAD (10-12%): KES ${result.breakdown.overhead.toFixed(2)}
  CONTINGENCY (8-10%): KES ${result.breakdown.contingency.toFixed(2)}
  PROFIT (12-15%): KES ${result.breakdown.profit.toFixed(2)}

=====================================
Generated by Construction Calculator
`;

    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedWork.replace(
      / /g,
      "_"
    )}_UnitRate_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentInputs = selectedWork ? workInputs[selectedWork] || [] : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="w-10 h-10 text-gray-700 dark:text-gray-300" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Kenya Construction Unit Rate Calculator
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                CSMM & SMM Compliant
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Select Work Category
              </h3>
              <div className="space-y-2">
                {Object.entries(workCategories).map(([key, category]) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                      {category.icon}
                      <span>{category.name}</span>
                    </div>
                    <div className="ml-4 space-y-1">
                      {category.items.map((item) => (
                        <button
                          key={item}
                          onClick={() => {
                            setSelectedWork(item);
                            setInputs({});
                            setResult(result);
                          }}
                          className={`w-full text-left px-4 py-2 rounded transition-colors ${
                            selectedWork === item
                              ? "bg-gray-700 dark:bg-gray-600 text-white"
                              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                          } border border-gray-300 dark:border-gray-600`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              {selectedWork ? (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 text-xl">
                    {selectedWork} - Input Parameters
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {currentInputs.map((input) => (
                      <div key={input.name}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {input.label}
                          {input.required && (
                            <span className="text-red-500">*</span>
                          )}
                        </label>
                        {input.type === "select" ? (
                          <select
                            value={inputs[input.name] || ""}
                            onChange={(e) =>
                              handleInputChange(input.name, e.target.value)
                            }
                            className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gray-500"
                          >
                            <option value="">Select...</option>
                            {input.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={input.type}
                            value={inputs[input.name] || ""}
                            onChange={(e) =>
                              handleInputChange(input.name, e.target.value)
                            }
                            className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gray-500"
                            step="0.01"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleCalculate}
                    className="w-full bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-5 h-5" />
                    Calculate Unit Rate
                  </button>

                  {result && (
                    <div className="mt-6 p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg border-2 border-gray-300 dark:border-gray-600">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          Calculation Results
                        </h4>
                        <button
                          onClick={generateReport}
                          className="bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Export Report
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Unit Rate
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {result.unitRate}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {result.unit}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Quantity
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {result.quantity}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {result.unit.split("/")[1]}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Total Cost
                          </p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            KES {result.totalCost}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            All inclusive
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Materials Cost Breakdown
                          </h5>
                          <div className="space-y-2">
                            {Object.entries(result.breakdown.materials).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex justify-between text-sm"
                                >
                                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                                    {key.replace(/_/g, " ")}
                                  </span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    KES {value.toFixed(2)}
                                  </span>
                                </div>
                              )
                            )}
                            <div className="border-t border-gray-300 dark:border-gray-700 pt-2 mt-2">
                              <div className="flex justify-between font-semibold">
                                <span className="text-gray-900 dark:text-gray-100">
                                  Materials Total
                                </span>
                                <span className="text-gray-900 dark:text-gray-100">
                                  KES{" "}
                                  {Object.values(result.breakdown.materials)
                                    .reduce((a, b) => a + b, 0)
                                    .toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            Labour Cost Breakdown
                          </h5>
                          <div className="space-y-2">
                            {Object.entries(result.breakdown.labour).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex justify-between text-sm"
                                >
                                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                                    {key.replace(/_/g, " ")}
                                  </span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    KES {value.toFixed(2)}
                                  </span>
                                </div>
                              )
                            )}
                            <div className="border-t border-gray-300 dark:border-gray-700 pt-2 mt-2">
                              <div className="flex justify-between font-semibold">
                                <span className="text-gray-900 dark:text-gray-100">
                                  Labour Total
                                </span>
                                <span className="text-gray-900 dark:text-gray-100">
                                  KES{" "}
                                  {Object.values(result.breakdown.labour)
                                    .reduce((a, b) => a + b, 0)
                                    .toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            Equipment & Tools
                          </h5>
                          <div className="space-y-2">
                            {Object.entries(result.breakdown.equipment).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex justify-between text-sm"
                                >
                                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                                    {key.replace(/_/g, " ")}
                                  </span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    KES {value.toFixed(2)}
                                  </span>
                                </div>
                              )
                            )}
                            <div className="border-t border-gray-300 dark:border-gray-700 pt-2 mt-2">
                              <div className="flex justify-between font-semibold">
                                <span className="text-gray-900 dark:text-gray-100">
                                  Equipment Total
                                </span>
                                <span className="text-gray-900 dark:text-gray-100">
                                  KES{" "}
                                  {Object.values(result.breakdown.equipment)
                                    .reduce((a, b) => a + b, 0)
                                    .toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                          <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Additional Costs
                          </h5>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                Overhead (10-12%)
                              </span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                KES {result.breakdown.overhead.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                Contingency (8-10%)
                              </span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                KES {result.breakdown.contingency.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                Profit (12-15%)
                              </span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                KES {result.breakdown.profit.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">
                      Select a work item from the left to begin
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            About This Calculator
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Standards Compliance
              </h4>
              <p>
                Calculations based on CSMM (Civil Standard Method of
                Measurement) and SMM (Standard Method of Measurement) for Kenya
                construction industry.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Regional Pricing
              </h4>
              <p>
                Accounts for regional variations in material and labour costs
                across Nairobi, Coast, and Western regions with realistic market
                prices.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Field-Ready
              </h4>
              <p>
                Incorporates practical factors like wastage, site conditions,
                access difficulty, and method of work for accurate field
                estimates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConstructionCalculator;
