// IndividualMembers.jsx
import React, { useState } from "react";
import axios from "axios";
import {
  Building,
  Layers,
  Home,
  Droplets,
  Square,
  TreePine,
  Waves,
} from "lucide-react";

const IndividualMembers = ({ onViewDiagram, onGoToBOQ, onGoToApproximate }) => {
  const [activeCalculator, setActiveCalculator] = useState(null);
  const [calculationResults, setCalculationResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // API configuration
  const API_BASE_URL = "http://localhost:8000/api"; // FastAPI backend

  // Individual member calculators
  const memberCalculators = [
    {
      id: "stairs",
      name: "Stairs",
      icon: Building,
      color: "blue",
      description: "Calculate stairs concrete, formwork & reinforcement",
      fields: [
        {
          name: "height",
          label: "Total Height (m)",
          type: "number",
          required: true,
        },
        {
          name: "length",
          label: "Total Length (m)",
          type: "number",
          required: true,
        },
        { name: "width", label: "Width (m)", type: "number", required: true },
        {
          name: "riser_height",
          label: "Riser Height (mm)",
          type: "number",
          required: true,
          defaultValue: 175,
        },
        {
          name: "tread_width",
          label: "Tread Width (mm)",
          type: "number",
          required: true,
          defaultValue: 250,
        },
        {
          name: "thickness",
          label: "Slab Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
      ],
    },
    {
      id: "foundation",
      name: "Foundation",
      icon: Layers,
      color: "gray",
      description: "Calculate foundation excavation, concrete & reinforcement",
      fields: [
        { name: "length", label: "Length (m)", type: "number", required: true },
        { name: "width", label: "Width (m)", type: "number", required: true },
        { name: "depth", label: "Depth (m)", type: "number", required: true },
        {
          name: "concrete_grade",
          label: "Concrete Grade",
          type: "select",
          required: true,
          options: ["C10/12", "C16/20", "C20/25", "C25/30"],
          defaultValue: "C20/25",
        },
        {
          name: "reinforcement_type",
          label: "Reinforcement",
          type: "select",
          required: true,
          options: ["Y12", "Y16", "Y20", "Y25"],
          defaultValue: "Y12",
        },
      ],
    },
    {
      id: "superstructure",
      name: "Superstructure",
      icon: Home,
      color: "green",
      description: "Calculate beams, columns, slabs",
      fields: [
        {
          name: "floor_area",
          label: "Floor Area (m²)",
          type: "number",
          required: true,
        },
        {
          name: "storey_height",
          label: "Storey Height (m)",
          type: "number",
          required: true,
          defaultValue: 3,
        },
        {
          name: "number_floors",
          label: "Number of Floors",
          type: "number",
          required: true,
          defaultValue: 1,
        },
        {
          name: "slab_thickness",
          label: "Slab Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
        {
          name: "beam_size",
          label: "Beam Size (mm)",
          type: "text",
          required: true,
          defaultValue: "230x450",
        },
        {
          name: "column_size",
          label: "Column Size (mm)",
          type: "text",
          required: true,
          defaultValue: "230x230",
        },
      ],
    },
    {
      id: "manholes",
      name: "Manholes",
      icon: Square,
      color: "yellow",
      description: "Calculate manhole excavation, concrete & covers",
      fields: [
        {
          name: "internal_diameter",
          label: "Internal Diameter (mm)",
          type: "number",
          required: true,
          defaultValue: 1050,
        },
        { name: "depth", label: "Depth (m)", type: "number", required: true },
        {
          name: "wall_thickness",
          label: "Wall Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
        {
          name: "base_thickness",
          label: "Base Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
        {
          name: "number_manholes",
          label: "Number of Manholes",
          type: "number",
          required: true,
          defaultValue: 1,
        },
      ],
    },
    {
      id: "pavements",
      name: "Pavements",
      icon: Square,
      color: "purple",
      description: "Calculate pavement layers & materials",
      fields: [
        {
          name: "area",
          label: "Pavement Area (m²)",
          type: "number",
          required: true,
        },
        {
          name: "subbase_thickness",
          label: "Sub-base Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
        {
          name: "base_thickness",
          label: "Base Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
        {
          name: "surface_thickness",
          label: "Surface Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 40,
        },
        {
          name: "pavement_type",
          label: "Pavement Type",
          type: "select",
          required: true,
          options: ["Flexible", "Rigid", "Interlocking"],
          defaultValue: "Flexible",
        },
      ],
    },
    {
      id: "retaining_walls",
      name: "Retaining Walls",
      icon: Building,
      color: "red",
      description: "Calculate retaining wall concrete & reinforcement",
      fields: [
        {
          name: "length",
          label: "Wall Length (m)",
          type: "number",
          required: true,
        },
        {
          name: "height",
          label: "Wall Height (m)",
          type: "number",
          required: true,
        },
        {
          name: "thickness",
          label: "Wall Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 200,
        },
        {
          name: "foundation_width",
          label: "Foundation Width (m)",
          type: "number",
          required: true,
        },
        {
          name: "foundation_thickness",
          label: "Foundation Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 300,
        },
      ],
    },
    {
      id: "septic_tanks",
      name: "Septic Tanks",
      icon: Droplets,
      color: "teal",
      description: "Calculate septic tank excavation & construction",
      fields: [
        {
          name: "capacity",
          label: "Capacity (m³)",
          type: "number",
          required: true,
        },
        { name: "length", label: "Length (m)", type: "number", required: true },
        { name: "width", label: "Width (m)", type: "number", required: true },
        { name: "depth", label: "Depth (m)", type: "number", required: true },
        {
          name: "wall_thickness",
          label: "Wall Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
      ],
    },
    {
      id: "swimming_pools",
      name: "Swimming Pools",
      icon: Waves,
      color: "cyan",
      description: "Calculate swimming pool excavation & construction",
      fields: [
        {
          name: "length",
          label: "Pool Length (m)",
          type: "number",
          required: true,
        },
        {
          name: "width",
          label: "Pool Width (m)",
          type: "number",
          required: true,
        },
        {
          name: "shallow_depth",
          label: "Shallow End Depth (m)",
          type: "number",
          required: true,
          defaultValue: 1.2,
        },
        {
          name: "deep_depth",
          label: "Deep End Depth (m)",
          type: "number",
          required: true,
          defaultValue: 2.5,
        },
        {
          name: "wall_thickness",
          label: "Wall Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 200,
        },
        {
          name: "floor_thickness",
          label: "Floor Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
      ],
    },
    {
      id: "basements",
      name: "Basements",
      icon: Building,
      color: "indigo",
      description: "Calculate basement excavation, walls & waterproofing",
      fields: [
        { name: "length", label: "Length (m)", type: "number", required: true },
        { name: "width", label: "Width (m)", type: "number", required: true },
        { name: "depth", label: "Depth (m)", type: "number", required: true },
        {
          name: "wall_thickness",
          label: "Wall Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 200,
        },
        {
          name: "floor_thickness",
          label: "Floor Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
        {
          name: "waterproofing",
          label: "Include Waterproofing",
          type: "checkbox",
          defaultValue: true,
        },
      ],
    },
    {
      id: "water_tanks",
      name: "Water Tanks",
      icon: Droplets,
      color: "blue",
      description: "Calculate water tank construction materials",
      fields: [
        {
          name: "capacity",
          label: "Capacity (m³)",
          type: "number",
          required: true,
        },
        {
          name: "tank_type",
          label: "Tank Type",
          type: "select",
          required: true,
          options: ["Circular", "Rectangular"],
          defaultValue: "Circular",
        },
        { name: "height", label: "Height (m)", type: "number", required: true },
        {
          name: "wall_thickness",
          label: "Wall Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
        {
          name: "base_thickness",
          label: "Base Thickness (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
      ],
    },
    {
      id: "landscaping",
      name: "Landscaping",
      icon: TreePine,
      color: "green",
      description: "Calculate landscaping materials & quantities",
      fields: [
        {
          name: "total_area",
          label: "Total Area (m²)",
          type: "number",
          required: true,
        },
        {
          name: "lawn_area",
          label: "Lawn Area (m²)",
          type: "number",
          required: true,
        },
        {
          name: "planting_area",
          label: "Planting Area (m²)",
          type: "number",
          required: true,
        },
        {
          name: "paving_area",
          label: "Paving Area (m²)",
          type: "number",
          required: true,
        },
        {
          name: "topsoil_depth",
          label: "Topsoil Depth (mm)",
          type: "number",
          required: true,
          defaultValue: 150,
        },
      ],
    },
  ];

  // Calculate quantities using FastAPI backend
  const calculateQuantities = async (calculatorId, formData) => {
    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/calculate/${calculatorId}`,
        formData
      );
      setCalculationResults((prev) => ({
        ...prev,
        [calculatorId]: response.data,
      }));
    } catch (error) {
      console.error("Calculation error:", error);
      // Fallback to mock calculations if backend is not available
      mockCalculate(calculatorId, formData);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock calculations for when backend is not available
  const mockCalculate = (calculatorId, formData) => {
    let results = {};

    switch (calculatorId) {
      case "stairs":
        const stepsCount = Math.ceil(
          (formData.height * 1000) / formData.riser_height
        );
        const concreteVolume =
          (formData.length * formData.width * formData.thickness) / 1000;
        results = {
          steps_count: stepsCount,
          concrete_volume: concreteVolume.toFixed(2),
          formwork_area: (
            (formData.length * 2 + formData.width * 2) *
            (formData.height + formData.thickness / 1000)
          ).toFixed(2),
          reinforcement_weight: (concreteVolume * 80).toFixed(2),
          items: [
            {
              description: `E100.1.2 - Excavation for stairs foundation`,
              quantity: (concreteVolume * 1.2).toFixed(2),
              unit: "m³",
            },
            {
              description: `F100 - Concrete grade C25/30 for stairs`,
              quantity: concreteVolume.toFixed(2),
              unit: "m³",
            },
            {
              description: `G100.1.1 - Formwork to stairs`,
              quantity: (
                (formData.length * 2 + formData.width * 2) *
                formData.height
              ).toFixed(2),
              unit: "m²",
            },
            {
              description: `G600.1.3 - Reinforcement bars Y12`,
              quantity: (concreteVolume * 80).toFixed(2),
              unit: "kg",
            },
          ],
        };
        break;

      case "foundation":
        const foundationVolume =
          formData.length * formData.width * formData.depth;
        const excavationVolume = foundationVolume * 1.2;
        results = {
          excavation_volume: excavationVolume.toFixed(2),
          concrete_volume: foundationVolume.toFixed(2),
          reinforcement_weight: (foundationVolume * 60).toFixed(2),
          items: [
            {
              description: `E200.1.3 - Excavation for foundations, depth ${formData.depth}m`,
              quantity: excavationVolume.toFixed(2),
              unit: "m³",
            },
            {
              description: `F100 - Foundation concrete ${formData.concrete_grade}`,
              quantity: foundationVolume.toFixed(2),
              unit: "m³",
            },
            {
              description: `G600 - Reinforcement bars ${formData.reinforcement_type}`,
              quantity: (foundationVolume * 60).toFixed(2),
              unit: "kg",
            },
          ],
        };
        break;

      case "superstructure":
        const totalFloorArea = formData.floor_area * formData.number_floors;
        const slabVolume = (totalFloorArea * formData.slab_thickness) / 1000;
        const beamVolume = totalFloorArea * 0.05;
        const columnVolume =
          formData.number_floors *
          formData.storey_height *
          0.02 *
          totalFloorArea;
        const totalConcrete = slabVolume + beamVolume + columnVolume;

        results = {
          slab_volume: slabVolume.toFixed(2),
          beam_volume: beamVolume.toFixed(2),
          column_volume: columnVolume.toFixed(2),
          total_concrete: totalConcrete.toFixed(2),
          formwork_area: (totalFloorArea * 1.5).toFixed(2),
          reinforcement_weight: (totalConcrete * 100).toFixed(2),
          items: [
            {
              description: `F200.1.2 - Slab concrete C25/30`,
              quantity: slabVolume.toFixed(2),
              unit: "m³",
            },
            {
              description: `F300.1.2 - Beam concrete C25/30`,
              quantity: beamVolume.toFixed(2),
              unit: "m³",
            },
            {
              description: `F400.1.2 - Column concrete C25/30`,
              quantity: columnVolume.toFixed(2),
              unit: "m³",
            },
            {
              description: `G100.2.2 - Formwork to superstructure`,
              quantity: (totalFloorArea * 1.5).toFixed(2),
              unit: "m²",
            },
            {
              description: `G600 - Reinforcement bars, mixed sizes`,
              quantity: (totalConcrete * 100).toFixed(2),
              unit: "kg",
            },
          ],
        };
        break;

      case "manholes":
        const diameter = formData.internal_diameter / 1000;
        const wallThickness = formData.wall_thickness / 1000;
        const baseThickness = formData.base_thickness / 1000;

        const excavationDiameter = diameter + wallThickness * 2 + 0.5;
        const excavationVol =
          Math.PI *
          Math.pow(excavationDiameter / 2, 2) *
          (formData.depth + baseThickness) *
          formData.number_manholes;

        const concreteVol =
          (Math.PI * Math.pow(diameter / 2 + wallThickness, 2) * baseThickness +
            Math.PI *
              wallThickness *
              (diameter + wallThickness) *
              formData.depth) *
          formData.number_manholes;

        results = {
          excavation_volume: excavationVol.toFixed(2),
          concrete_volume: concreteVol.toFixed(2),
          reinforcement_weight: (concreteVol * 70).toFixed(2),
          cover_area: (
            Math.PI *
            Math.pow(excavationDiameter / 2, 2) *
            formData.number_manholes
          ).toFixed(2),
          items: [
            {
              description: `E100.1.3 - Excavation for manholes`,
              quantity: excavationVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `F100 - Concrete C25/30 for manholes`,
              quantity: concreteVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `G600 - Reinforcement for manholes`,
              quantity: (concreteVol * 70).toFixed(2),
              unit: "kg",
            },
            {
              description: `J600 - Manhole covers ${formData.internal_diameter}mm`,
              quantity: formData.number_manholes,
              unit: "no",
            },
          ],
        };
        break;

      case "pavements":
        const subbaseVol = formData.area * (formData.subbase_thickness / 1000);
        const baseVol = formData.area * (formData.base_thickness / 1000);
        const surfaceVol = formData.area * (formData.surface_thickness / 1000);

        results = {
          pavement_area: formData.area.toFixed(2),
          subbase_volume: subbaseVol.toFixed(2),
          base_volume: baseVol.toFixed(2),
          surface_volume: surfaceVol.toFixed(2),
          items: [
            {
              description: `E100.1.1 - General excavation for pavement`,
              quantity: (subbaseVol * 1.1).toFixed(2),
              unit: "m³",
            },
            {
              description: `P100.1.2 - Granular sub-base material Type 1`,
              quantity: subbaseVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `P200.1.1 - Road base material`,
              quantity: baseVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `${formData.pavement_type} surface course`,
              quantity: surfaceVol.toFixed(2),
              unit: "m³",
            },
          ],
        };
        break;

      case "retaining_walls":
        const wallVol =
          formData.length * (formData.thickness / 1000) * formData.height;
        const foundVol =
          formData.length *
          formData.foundation_width *
          (formData.foundation_thickness / 1000);
        const totalVol = wallVol + foundVol;

        results = {
          wall_volume: wallVol.toFixed(2),
          foundation_volume: foundVol.toFixed(2),
          total_concrete: totalVol.toFixed(2),
          reinforcement_weight: (totalVol * 120).toFixed(2),
          items: [
            {
              description: `E200.1.1 - Excavation for retaining wall`,
              quantity: (foundVol * 1.2).toFixed(2),
              unit: "m³",
            },
            {
              description: `F100 - Foundation concrete C25/30`,
              quantity: foundVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `F300.1.2 - Wall concrete C30/37`,
              quantity: wallVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `G600 - Reinforcement for retaining wall`,
              quantity: (totalVol * 120).toFixed(2),
              unit: "kg",
            },
          ],
        };
        break;

      case "septic_tanks":
        const septicExcavVol =
          (formData.length + 0.5) *
          (formData.width + 0.5) *
          (formData.depth + 0.3);
        const baseConc = formData.length * formData.width * 0.15;
        const wallConc =
          2 *
            (formData.length *
              (formData.wall_thickness / 1000) *
              formData.depth) +
          2 *
            (formData.width *
              (formData.wall_thickness / 1000) *
              formData.depth);
        const coverConc = formData.length * formData.width * 0.1;
        const totalSepticConc = baseConc + wallConc + coverConc;

        results = {
          excavation_volume: septicExcavVol.toFixed(2),
          concrete_volume: totalSepticConc.toFixed(2),
          reinforcement_weight: (totalSepticConc * 80).toFixed(2),
          items: [
            {
              description: `E100.1.3 - Excavation for septic tank`,
              quantity: septicExcavVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `F100 - Concrete C20/25 for septic tank`,
              quantity: totalSepticConc.toFixed(2),
              unit: "m³",
            },
            {
              description: `G600 - Reinforcement for septic tank`,
              quantity: (totalSepticConc * 80).toFixed(2),
              unit: "kg",
            },
          ],
        };
        break;

      case "swimming_pools":
        const avgDepth = (formData.shallow_depth + formData.deep_depth) / 2;
        const poolExcavVol =
          (formData.length + 1) * (formData.width + 1) * (avgDepth + 0.5);
        const poolFloorConc =
          formData.length * formData.width * (formData.floor_thickness / 1000);
        const poolWallConc =
          2 * (formData.length * (formData.wall_thickness / 1000) * avgDepth) +
          2 * (formData.width * (formData.wall_thickness / 1000) * avgDepth);
        const totalPoolConc = poolFloorConc + poolWallConc;

        results = {
          excavation_volume: poolExcavVol.toFixed(2),
          concrete_volume: totalPoolConc.toFixed(2),
          reinforcement_weight: (totalPoolConc * 150).toFixed(2),
          items: [
            {
              description: `E100.1.4 - Excavation for swimming pool`,
              quantity: poolExcavVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `F200.2.1 - Pool concrete C30/37`,
              quantity: totalPoolConc.toFixed(2),
              unit: "m³",
            },
            {
              description: `G600 - Reinforcement for pool`,
              quantity: (totalPoolConc * 150).toFixed(2),
              unit: "kg",
            },
            {
              description: `Pool waterproofing system`,
              quantity: (
                formData.length * formData.width +
                2 * (formData.length + formData.width) * avgDepth
              ).toFixed(2),
              unit: "m²",
            },
          ],
        };
        break;

      case "basements":
        const basementExcavVol =
          (formData.length + 1) * (formData.width + 1) * (formData.depth + 0.3);
        const basementFloorConc =
          formData.length * formData.width * (formData.floor_thickness / 1000);
        const basementWallConc =
          2 *
            (formData.length *
              (formData.wall_thickness / 1000) *
              formData.depth) +
          2 *
            (formData.width *
              (formData.wall_thickness / 1000) *
              formData.depth);
        const totalBasementConc = basementFloorConc + basementWallConc;

        results = {
          excavation_volume: basementExcavVol.toFixed(2),
          concrete_volume: totalBasementConc.toFixed(2),
          reinforcement_weight: (totalBasementConc * 100).toFixed(2),
          waterproof_area: formData.waterproofing
            ? (
                formData.length * formData.width +
                2 * (formData.length + formData.width) * formData.depth
              ).toFixed(2)
            : 0,
          items: [
            {
              description: `E100.1.4 - Excavation for basement`,
              quantity: basementExcavVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `F200.2.2 - Basement concrete C25/30`,
              quantity: totalBasementConc.toFixed(2),
              unit: "m³",
            },
            {
              description: `G600 - Reinforcement for basement`,
              quantity: (totalBasementConc * 100).toFixed(2),
              unit: "kg",
            },
          ],
        };
        if (formData.waterproofing) {
          results.items.push({
            description: `Basement waterproofing membrane`,
            quantity: (
              formData.length * formData.width +
              2 * (formData.length + formData.width) * formData.depth
            ).toFixed(2),
            unit: "m²",
          });
        }
        break;

      case "water_tanks":
        let tankExcavVol, tankConc;
        if (formData.tank_type === "Circular") {
          const tankDiameter = Math.sqrt(
            (4 * formData.capacity) / (Math.PI * formData.height)
          );
          tankExcavVol =
            Math.PI *
            Math.pow((tankDiameter + 1) / 2, 2) *
            (formData.height + 0.5);
          tankConc =
            Math.PI *
              Math.pow(tankDiameter / 2 + formData.wall_thickness / 1000, 2) *
              (formData.base_thickness / 1000) +
            Math.PI *
              (formData.wall_thickness / 1000) *
              (tankDiameter + formData.wall_thickness / 1000) *
              formData.height;
        } else {
          const sideLength = Math.sqrt(formData.capacity / formData.height);
          tankExcavVol = Math.pow(sideLength + 1, 2) * (formData.height + 0.5);
          tankConc =
            Math.pow(sideLength + 2 * (formData.wall_thickness / 1000), 2) *
              (formData.base_thickness / 1000) +
            4 * sideLength * (formData.wall_thickness / 1000) * formData.height;
        }

        results = {
          excavation_volume: tankExcavVol.toFixed(2),
          concrete_volume: tankConc.toFixed(2),
          reinforcement_weight: (tankConc * 90).toFixed(2),
          items: [
            {
              description: `E100.1.2 - Excavation for water tank`,
              quantity: tankExcavVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `F100 - Water tank concrete C30/37`,
              quantity: tankConc.toFixed(2),
              unit: "m³",
            },
            {
              description: `G600 - Reinforcement for water tank`,
              quantity: (tankConc * 90).toFixed(2),
              unit: "kg",
            },
            {
              description: `Water tank waterproofing`,
              quantity: tankConc.toFixed(2),
              unit: "m²",
            },
          ],
        };
        break;

      case "landscaping":
        const topsoilVol =
          (formData.lawn_area + formData.planting_area) *
          (formData.topsoil_depth / 1000);
        const plantsNum = formData.planting_area * 2;

        results = {
          topsoil_volume: topsoilVol.toFixed(2),
          grass_area: formData.lawn_area.toFixed(2),
          planting_area: formData.planting_area.toFixed(2),
          paving_area: formData.paving_area.toFixed(2),
          items: [
            {
              description: `E100.1.1 - Site preparation`,
              quantity: (formData.total_area * 0.1).toFixed(2),
              unit: "m³",
            },
            {
              description: `E500.2.1 - Imported topsoil`,
              quantity: topsoilVol.toFixed(2),
              unit: "m³",
            },
            {
              description: `Grass seeding and lawn establishment`,
              quantity: formData.lawn_area.toFixed(2),
              unit: "m²",
            },
            {
              description: `Planting of shrubs and plants`,
              quantity: plantsNum.toFixed(0),
              unit: "no",
            },
            {
              description: `Paving stones and installation`,
              quantity: formData.paving_area.toFixed(2),
              unit: "m²",
            },
          ],
        };
        break;

      default:
        results = {
          message: `${calculatorId} calculation completed`,
          items: [
            {
              description: `${calculatorId} calculation`,
              quantity: "1.00",
              unit: "lump",
            },
          ],
        };
    }

    setCalculationResults((prev) => ({
      ...prev,
      [calculatorId]: results,
    }));
  };

  // Form component for individual calculators
  const CalculatorForm = ({ calculator }) => {
    const [formData, setFormData] = useState(
      calculator.fields.reduce(
        (acc, field) => ({
          ...acc,
          [field.name]: field.defaultValue || "",
        }),
        {}
      )
    );

    const handleInputChange = (fieldName, value) => {
      setFormData((prev) => ({
        ...prev,
        [fieldName]: value,
      }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      calculateQuantities(calculator.id, formData);
    };

    const results = calculationResults[calculator.id];

    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full bg-gray-100`}>
              {calculator.icon &&
                React.createElement(calculator.icon, {
                  className: "w-6 h-6 text-gray-700",
                })}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{calculator.name}</h3>
              <p className="text-sm text-gray-500">{calculator.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onViewDiagram && onViewDiagram(calculator.id)}
              className="px-3 py-1 bg-gray-100 rounded"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => onGoToBOQ && onGoToBOQ()}
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              BOQ
            </button>
            <button
              type="button"
              onClick={() => onGoToApproximate && onGoToApproximate()}
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              Approx
            </button>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"
        >
          {calculator.fields.map((field) => (
            <div key={field.name} className="flex flex-col">
              <label className="text-sm font-medium text-gray-700">
                {field.label}
              </label>
              {field.type === "select" ? (
                <select
                  value={formData[field.name]}
                  onChange={(e) =>
                    handleInputChange(field.name, e.target.value)
                  }
                  className="mt-1 p-2 border rounded"
                >
                  {field.options &&
                    field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                </select>
              ) : field.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={!!formData[field.name]}
                  onChange={(e) =>
                    handleInputChange(field.name, e.target.checked)
                  }
                />
              ) : (
                <input
                  type={field.type}
                  value={formData[field.name]}
                  onChange={(e) =>
                    handleInputChange(field.name, e.target.value)
                  }
                  className="mt-1 p-2 border rounded"
                />
              )}
            </div>
          ))}
          <div className="col-span-1 md:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Calculate
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData(
                  calculator.fields.reduce(
                    (acc, f) => ({ ...acc, [f.name]: f.defaultValue || "" }),
                    {}
                  )
                )
              }
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Reset
            </button>
          </div>
        </form>
        {isLoading && (
          <div className="text-sm text-gray-500">Calculating...</div>
        )}
        {results && (
          <div className="mt-4">
            <h4 className="font-semibold">Results</h4>
            <pre className="text-sm bg-gray-50 p-3 rounded mt-2 overflow-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const activeCalcObj = memberCalculators.find(
    (c) => c.id === activeCalculator
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {memberCalculators.map((calc) => (
          <button
            key={calc.id}
            onClick={() => setActiveCalculator(calc.id)}
            className="text-left p-4 bg-white rounded shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-gray-100">
                {calc.icon &&
                  React.createElement(calc.icon, {
                    className: "w-5 h-5 text-gray-700",
                  })}
              </div>
              <div>
                <h4 className="font-semibold">{calc.name}</h4>
                <p className="text-sm text-gray-500">{calc.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {activeCalcObj && (
        <div>
          <button
            onClick={() => setActiveCalculator(null)}
            className="mb-3 text-sm text-blue-600"
          >
            ← Back to calculators
          </button>
          <CalculatorForm calculator={activeCalcObj} />
        </div>
      )}
    </div>
  );
};

export default IndividualMembers;
