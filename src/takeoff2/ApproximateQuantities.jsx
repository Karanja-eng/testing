// ApproximateQuantities.jsx
import React, { useState, useEffect } from 'react';
import { Calculator, Eye, FileText } from 'lucide-react';

const ApproximateQuantities = ({ 
  takeoffData, 
  onDataUpdate, 
  onViewDiagram, 
  onGoToTakeoff, 
  onGoToBOQ 
}) => {
  const [priceInputs, setPriceInputs] = useState({});
  const [calculatedCosts, setCalculatedCosts] = useState([]);

  // Enhanced material prices for Kenyan market
  const materialPrices = {
    'concrete': {
      'cement': { label: 'Cement (per 50kg bag)', unit: 'bag', defaultPrice: 850, ratio: 7 },
      'sand': { label: 'Sand (per tonne)', unit: 't', defaultPrice: 2500, ratio: 0.5 },
      'aggregates': { label: 'Aggregates (per tonne)', unit: 't', defaultPrice: 3200, ratio: 0.8 },
      'water': { label: 'Water (per m³)', unit: 'm³', defaultPrice: 150, ratio: 0.2 },
      'labour': { label: 'Labour (per m³)', unit: 'm³', defaultPrice: 1200, ratio: 1 }
    },
    'formwork': {
      'timber': { label: 'Timber (per m³)', unit: 'm³', defaultPrice: 45000, ratio: 0.03 },
      'plywood': { label: 'Plywood 18mm (per sheet)', unit: 'sheet', defaultPrice: 2800, ratio: 2 },
      'nails': { label: 'Nails (per kg)', unit: 'kg', defaultPrice: 180, ratio: 3 },
      'release_agent': { label: 'Release agent (per litre)', unit: 'l', defaultPrice: 450, ratio: 0.1 },
      'labour': { label: 'Labour (per m²)', unit: 'm²', defaultPrice: 800, ratio: 1 }
    },
    'reinforcement': {
      'steel_bars': { label: 'Steel bars (per tonne)', unit: 't', defaultPrice: 85000, ratio: 1 },
      'binding_wire': { label: 'Binding wire (per kg)', unit: 'kg', defaultPrice: 150, ratio: 15 },
      'spacers': { label: 'Spacers (per m²)', unit: 'm²', defaultPrice: 50, ratio: 1 },
      'labour': { label: 'Labour (per tonne)', unit: 't', defaultPrice: 15000, ratio: 1 }
    },
    'excavation': {
      'fuel': { label: 'Fuel (per litre)', unit: 'l', defaultPrice: 165, ratio: 2 },
      'machinery': { label: 'Machinery hire (per hour)', unit: 'hr', defaultPrice: 15000, ratio: 0.1 },
      'operator': { label: 'Operator (per day)', unit: 'day', defaultPrice: 2500, ratio: 0.1 },
      'transport': { label: 'Transport (per m³)', unit: 'm³', defaultPrice: 300, ratio: 1 }
    },
    'piling': {
      'concrete': { label: 'Concrete C25/30 (per m³)', unit: 'm³', defaultPrice: 12000, ratio: 1 },
      'steel_casing': { label: 'Steel casing (per m)', unit: 'm', defaultPrice: 2500, ratio: 1 },
      'drilling': { label: 'Drilling (per m)', unit: 'm', defaultPrice: 3500, ratio: 1 },
      'reinforcement': { label: 'Reinforcement (per m)', unit: 'm', defaultPrice: 850, ratio: 1 }
    },
    'pipes': {
      'pipe_material': { label: 'Pipe material (per m)', unit: 'm', defaultPrice: 1200, ratio: 1 },
      'fittings': { label: 'Fittings (per joint)', unit: 'joint', defaultPrice: 450, ratio: 0.1 },
      'bedding': { label: 'Bedding material (per m)', unit: 'm', defaultPrice: 300, ratio: 1 },
      'labour': { label: 'Labour (per m)', unit: 'm', defaultPrice: 650, ratio: 1 }
    },
    'roads': {
      'aggregate': { label: 'Aggregate material (per m³)', unit: 'm³', defaultPrice: 3200, ratio: 1 },
      'cement': { label: 'Cement (per bag)', unit: 'bag', defaultPrice: 850, ratio: 0.5 },
      'compaction': { label: 'Compaction (per m²)', unit: 'm²', defaultPrice: 120, ratio: 1 },
      'transport': { label: 'Transport (per m³)', unit: 'm³', defaultPrice: 800, ratio: 1 }
    },
    'general': {
      'materials': { label: 'General materials', unit: 'lump', defaultPrice: 5000, ratio: 1 },
      'labour': { label: 'General labour', unit: 'day', defaultPrice: 1500, ratio: 1 },
      'equipment': { label: 'Equipment hire', unit: 'day', defaultPrice: 8000, ratio: 0.5 }
    }
  };

  const detectItemType = (description) => {
    const desc = description.toLowerCase();
    if (desc.includes('concrete') || desc.includes('grade') || desc.includes('f100') || desc.includes('f200')) return 'concrete';
    if (desc.includes('formwork') || desc.includes('timber') || desc.includes('g100') || desc.includes('g300')) return 'formwork';
    if (desc.includes('reinforcement') || desc.includes('steel') || desc.includes('g600') || desc.includes('g700')) return 'reinforcement';
    if (desc.includes('excavation') || desc.includes('trench') || desc.includes('e100') || desc.includes('e200') || desc.includes('e300')) return 'excavation';
    if (desc.includes('pile') || desc.includes('piling') || desc.includes('o100') || desc.includes('o400')) return 'piling';
    if (desc.includes('pipe') || desc.includes('sewer') || desc.includes('i100') || desc.includes('i200')) return 'pipes';
    if (desc.includes('road') || desc.includes('pavement') || desc.includes('p100') || desc.includes('p200')) return 'roads';
    return 'general';
  };

  const calculateMaterialQuantity = (baseQuantity, material, itemType) => {
    const materialData = materialPrices[itemType]?.[material];
    if (!materialData) return 0;
    return baseQuantity * materialData.ratio;
  };

  useEffect(() => {
    if (takeoffData && takeoffData.length > 0) {
      const initialPrices = {};
      takeoffData.forEach(item => {
        const itemType = detectItemType(item.description);
        if (materialPrices[itemType]) {
          Object.keys(materialPrices[itemType]).forEach(material => {
            const key = `${item.id}_${material}`;
            if (!initialPrices[key]) {
              initialPrices[key] = materialPrices[itemType][material].defaultPrice;
            }
          });
        }
      });
      setPriceInputs(initialPrices);
    }
  }, [takeoffData]);

  const handlePriceChange = (key, value) => {
    setPriceInputs(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const calculateApproximateCosts = () => {
    const costs = takeoffData.map(item => {
      const itemType = detectItemType(item.description);
      let totalCost = 0;
      const materialCosts = {};

      if (materialPrices[itemType]) {
        Object.keys(materialPrices[itemType]).forEach(material => {
          const key = `${item.id}_${material}`;
          const price = priceInputs[key] || 0;
          const materialQuantity = calculateMaterialQuantity(item.quantity, material, itemType);
          const cost = price * materialQuantity;
          materialCosts[material] = {
            quantity: materialQuantity,
            rate: price,
            cost: cost
          };
          totalCost += cost;
        });
      }

      return {
        ...item,
        itemType,
        materialCosts,
        totalCost
      };
    });

    setCalculatedCosts(costs);
    onDataUpdate && onDataUpdate(costs);
  };

  useEffect(() => {
    if (takeoffData && takeoffData.length > 0 && Object.keys(priceInputs).length > 0) {
      calculateApproximateCosts();
    }
  }, [priceInputs, takeoffData]);

  if (!takeoffData || takeoffData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="text-center py-12">
          <Calculator className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Take-off Data</h3>
          <p className="text-gray-600 mb-6">Please complete the quantity take-off first.</p>
          
          {/* Navigation buttons */}
          <div className="flex justify-center gap-3">
            <button
              onClick={onGoToTakeoff}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Go to Take-off
            </button>
            <button
              onClick={onViewDiagram}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalProjectCost = calculatedCosts.reduce((sum, item) => sum + item.totalCost, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-800">Approximate Quantities & Costing</h2>
          
          {/* Navigation buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onViewDiagram}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-1"
            >
              <Eye className="h-4 w-4" />
              View Plans
            </button>
            <button
              onClick={onGoToTakeoff}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-1"
            >
              <Calculator className="h-4 w-4" />
              Take-off
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
        
        {takeoffData.map(item => {
          const itemType = detectItemType(item.description);
          const materials = materialPrices[itemType] || {};
          
          return (
            <div key={item.id} className="mb-8 p-4 border rounded-lg bg-gray-50">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-800">{item.description}</h3>
                <p className="text-sm text-gray-600">
                  Quantity: {item.quantity.toFixed(2)} {item.unit} | Type: {itemType}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(materials).map(([materialKey, material]) => {
                  const inputKey = `${item.id}_${materialKey}`;
                  const materialQuantity = calculateMaterialQuantity(item.quantity, materialKey, itemType);
                  const cost = (priceInputs[inputKey] || 0) * materialQuantity;
                  
                  return (
                    <div key={materialKey} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {material.label}
                      </label>
                      <div className="flex flex-col space-y-1">
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            value={priceInputs[inputKey] || material.defaultPrice}
                            onChange={(e) => handlePriceChange(inputKey, e.target.value)}