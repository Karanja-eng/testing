from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Optional, List
from datetime import datetime
import math

app = FastAPI(title="Kenya Construction Unit Rate Calculator API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Regional factors and base rates (updated for 2025)
REGION_FACTORS = {
    "Nairobi": 1.15,
    "Coast": 1.10,
    "Western": 1.0,
    "Central": 1.08,
    "Rift Valley": 1.05,
}

LABOUR_RATES = {
    "Nairobi": {"skilled": 1500, "semiskilled": 1000, "unskilled": 700},
    "Coast": {"skilled": 1400, "semiskilled": 900, "unskilled": 650},
    "Western": {"skilled": 1200, "semiskilled": 800, "unskilled": 600},
    "Central": {"skilled": 1350, "semiskilled": 900, "unskilled": 680},
    "Rift Valley": {"skilled": 1300, "semiskilled": 850, "unskilled": 620},
}

MATERIAL_PRICES = {
    "cement_50kg": 750,
    "sand_per_tonne": 1800,
    "ballast_per_tonne": 2200,
    "blocks_4inch": 45,
    "blocks_6inch": 55,
    "blocks_8inch": 70,
    "blocks_9inch": 85,
    "reinforcement_y12_per_kg": 95,
    "reinforcement_y10_per_kg": 92,
    "tiles_standard_per_sqm": 1200,
    "tiles_premium_per_sqm": 2800,
    "tiles_luxury_per_sqm": 5500,
    "paint_economy_per_4l": 1200,
    "paint_standard_per_4l": 1800,
    "paint_premium_per_4l": 2800,
    "pvc_pipe_100mm_per_m": 580,
    "pvc_pipe_150mm_per_m": 920,
    "pvc_pipe_200mm_per_m": 1450,
    "pvc_pipe_250mm_per_m": 2100,
    "pvc_pipe_300mm_per_m": 2800,
    "iron_sheet_28g_per_sqm": 850,
    "iron_sheet_30g_per_sqm": 720,
    "iron_sheet_32g_per_sqm": 650,
    "timber_4x2_per_m": 180,
    "timber_2x4_per_m": 220,
    "hardcore_per_tonne": 1500,
    "waterproofing_per_sqm": 350,
    "tile_adhesive_per_kg": 18,
    "tile_grout_per_kg": 12,
}


class CalculationRequest(BaseModel):
    work_type: str
    inputs: Dict
    region: str = "Nairobi"


class BreakdownItem(BaseModel):
    description: str
    quantity: float
    unit: str
    rate: float
    amount: float


class CostBreakdown(BaseModel):
    materials: List[BreakdownItem]
    labour: List[BreakdownItem]
    equipment: List[BreakdownItem]
    overhead: float
    contingency: float
    profit: float


class CalculationResult(BaseModel):
    work_type: str
    unit_rate: float
    unit: str
    quantity: float
    total_cost: float
    breakdown: CostBreakdown
    region: str
    calculation_date: str
    assumptions: List[str]


class EarthworksCalculator:
    """Comprehensive earthworks calculations"""

    @staticmethod
    def site_clearance(inputs: Dict, region: str) -> CalculationResult:
        area = float(inputs["area"])
        vegetation = inputs["vegetation_density"]
        disposal_dist = float(inputs["disposal_distance"])
        terrain = inputs["terrain"]
        access = inputs["access_difficulty"]
        buildings_nearby = inputs.get("building_nearby", "No")

        # Calculate factors
        veg_factor = {"Light": 0.8, "Medium": 1.0, "Heavy": 1.5}[vegetation]
        terrain_factor = {"Flat": 1.0, "Sloped": 1.2, "Very Sloped": 1.4}[terrain]
        access_factor = {"Easy": 1.0, "Moderate": 1.15, "Difficult": 1.3}[access]

        # Labour calculations (man-hours per sqm)
        unskilled_hours = 0.15 * veg_factor * terrain_factor
        skilled_hours = 0.05 * veg_factor

        labour_rate = LABOUR_RATES[region]

        materials = []
        labour = [
            BreakdownItem(
                description="Unskilled labour - clearing",
                quantity=area * unskilled_hours,
                unit="hrs",
                rate=labour_rate["unskilled"] / 8,
                amount=area * unskilled_hours * (labour_rate["unskilled"] / 8),
            ),
            BreakdownItem(
                description="Skilled labour - supervision",
                quantity=area * skilled_hours,
                unit="hrs",
                rate=labour_rate["skilled"] / 8,
                amount=area * skilled_hours * (labour_rate["skilled"] / 8),
            ),
        ]

        if buildings_nearby == "Yes":
            labour.append(
                BreakdownItem(
                    description="Extra care around structures",
                    quantity=area * 0.02,
                    unit="hrs",
                    rate=labour_rate["skilled"] / 8,
                    amount=area * 0.02 * (labour_rate["skilled"] / 8),
                )
            )

        equipment = [
            BreakdownItem(
                description="Hand tools and wheelbarrows",
                quantity=area,
                unit="sqm",
                rate=15 * veg_factor,
                amount=area * 15 * veg_factor,
            ),
            BreakdownItem(
                description="Disposal cost",
                quantity=area * disposal_dist,
                unit="sqm·km",
                rate=50 * veg_factor,
                amount=area * disposal_dist * 50 * veg_factor,
            ),
        ]

        # Calculate totals
        mat_total = sum(item.amount for item in materials)
        lab_total = sum(item.amount for item in labour)
        equip_total = sum(item.amount for item in equipment)

        subtotal = mat_total + lab_total + equip_total
        overhead = subtotal * 0.10
        contingency = subtotal * 0.08
        profit = subtotal * 0.12

        total = (
            (subtotal + overhead + contingency + profit)
            * REGION_FACTORS[region]
            * access_factor
        )

        return CalculationResult(
            work_type="Site Clearance",
            unit_rate=total / area,
            unit="KES/m²",
            quantity=area,
            total_cost=total,
            breakdown=CostBreakdown(
                materials=materials,
                labour=labour,
                equipment=equipment,
                overhead=overhead,
                contingency=contingency,
                profit=profit,
            ),
            region=region,
            calculation_date=datetime.now().isoformat(),
            assumptions=[
                f"Vegetation density: {vegetation}",
                f"Terrain type: {terrain}",
                f"Disposal distance: {disposal_dist} km",
                f"Site access: {access}",
                "Rates include regional factor adjustment",
                "Assumes normal working conditions",
            ],
        )

    @staticmethod
    def bulk_excavation(inputs: Dict, region: str) -> CalculationResult:
        volume = float(inputs["volume"])
        depth = float(inputs["depth"])
        soil_type = inputs["soil_type"]
        method = inputs["excavation_method"]
        water_table = inputs["water_table"]
        disposal_dist = float(inputs["disposal_distance"])

        # Soil factors affecting productivity
        soil_factor = {"Soft": 1.0, "Medium": 1.3, "Hard": 1.7, "Rock": 2.5}[soil_type]
        water_factor = {"Dry": 1.0, "Seasonal": 1.2, "High": 1.5}[water_table]

        labour_rate = LABOUR_RATES[region]
        materials = []
        equipment = []

        if method == "Manual":
            # Manual excavation - productivity: 2-4 m³/day per person
            productivity = 3.0 / soil_factor
            man_days = volume / productivity

            labour = [
                BreakdownItem(
                    description="Excavator (semiskilled)",
                    quantity=man_days,
                    unit="days",
                    rate=labour_rate["semiskilled"],
                    amount=man_days * labour_rate["semiskilled"],
                ),
                BreakdownItem(
                    description="Helpers (unskilled)",
                    quantity=man_days * 1.5,
                    unit="days",
                    rate=labour_rate["unskilled"],
                    amount=man_days * 1.5 * labour_rate["unskilled"],
                ),
            ]

            equipment = [
                BreakdownItem(
                    description="Hand tools (picks, shovels, wheelbarrows)",
                    quantity=volume,
                    unit="m³",
                    rate=120 * soil_factor,
                    amount=volume * 120 * soil_factor,
                )
            ]
        else:  # Machine excavation
            # Machine productivity: 50-150 m³/day depending on soil
            machine_hours = volume / (15 / soil_factor)

            labour = [
                BreakdownItem(
                    description="Machine operator",
                    quantity=machine_hours,
                    unit="hrs",
                    rate=labour_rate["skilled"] * 1.5 / 8,
                    amount=machine_hours * (labour_rate["skilled"] * 1.5 / 8),
                ),
                BreakdownItem(
                    description="Ground workers",
                    quantity=machine_hours * 2,
                    unit="hrs",
                    rate=labour_rate["unskilled"] / 8,
                    amount=machine_hours * 2 * (labour_rate["unskilled"] / 8),
                ),
            ]

            equipment = [
                BreakdownItem(
                    description="Excavator hire",
                    quantity=machine_hours,
                    unit="hrs",
                    rate=4500,
                    amount=machine_hours * 4500,
                ),
                BreakdownItem(
                    description="Fuel and maintenance",
                    quantity=machine_hours,
                    unit="hrs",
                    rate=800,
                    amount=machine_hours * 800,
                ),
            ]

        # Dewatering if needed
        if water_table in ["Seasonal", "High"]:
            equipment.append(
                BreakdownItem(
                    description="Dewatering pump and fuel",
                    quantity=volume * water_factor,
                    unit="m³",
                    rate=180,
                    amount=volume * water_factor * 180,
                )
            )

        # Disposal costs
        disposal_trips = volume / 5  # Assume 5m³ per trip
        equipment.append(
            BreakdownItem(
                description="Spoil disposal",
                quantity=disposal_trips * disposal_dist,
                unit="trip·km",
                rate=350,
                amount=disposal_trips * disposal_dist * 350,
            )
        )

        # Calculate totals
        mat_total = sum(item.amount for item in materials)
        lab_total = sum(item.amount for item in labour)
        equip_total = sum(item.amount for item in equipment)

        subtotal = mat_total + lab_total + equip_total
        overhead = subtotal * 0.12
        contingency = subtotal * 0.10
        profit = subtotal * 0.15

        total = (
            (subtotal + overhead + contingency + profit)
            * REGION_FACTORS[region]
            * water_factor
        )

        return CalculationResult(
            work_type="Bulk Excavation",
            unit_rate=total / volume,
            unit="KES/m³",
            quantity=volume,
            total_cost=total,
            breakdown=CostBreakdown(
                materials=materials,
                labour=labour,
                equipment=equipment,
                overhead=overhead,
                contingency=contingency,
                profit=profit,
            ),
            region=region,
            calculation_date=datetime.now().isoformat(),
            assumptions=[
                f"Excavation method: {method}",
                f"Soil type: {soil_type}",
                f"Average depth: {depth}m",
                f"Water table condition: {water_table}",
                f"Disposal distance: {disposal_dist}km",
                "Bulking factor of 1.25 applied for volume",
                "Rates include site establishment",
            ],
        )


class FinishesCalculator:
    """Comprehensive finishes calculations"""

    @staticmethod
    def wall_tiling(inputs: Dict, region: str) -> CalculationResult:
        area = float(inputs["area"])
        tile_size = inputs["tile_size"]
        tile_quality = inputs["tile_quality"]
        wall_condition = inputs["wall_condition"]
        pattern = inputs["pattern"]
        wastage_pct = float(inputs.get("wastage", 10)) / 100

        # Tile coverage per m² (tiles needed)
        coverage_map = {"20x20": 25, "30x30": 11.11, "40x40": 6.25, "60x60": 2.78}
        tiles_per_sqm = coverage_map[tile_size]

        # Pattern factor
        pattern_factor = {"Straight": 1.0, "Diagonal": 1.15, "Herringbone": 1.25}[
            pattern
        ]

        # Wall condition factor
        condition_factor = {"Good": 1.0, "Fair": 1.15, "Poor": 1.35}[wall_condition]

        # Calculate material quantities
        tiles_needed = area * tiles_per_sqm * (1 + wastage_pct) * pattern_factor
        cement_bags = area * 0.03 * condition_factor
        adhesive_kg = area * 5 * condition_factor
        grout_kg = area * 0.8
        sand_tonnes = area * 0.02 / 1000

        # Tile price
        tile_price_map = {
            "Standard": MATERIAL_PRICES["tiles_standard_per_sqm"],
            "Premium": MATERIAL_PRICES["tiles_premium_per_sqm"],
            "Luxury": MATERIAL_PRICES["tiles_luxury_per_sqm"],
        }

        materials = [
            BreakdownItem(
                description=f"{tile_quality} tiles ({tile_size})",
                quantity=tiles_needed,
                unit="pcs",
                rate=tile_price_map[tile_quality] / tiles_per_sqm,
                amount=tiles_needed * (tile_price_map[tile_quality] / tiles_per_sqm),
            ),
            BreakdownItem(
                description="Cement (50kg bags)",
                quantity=cement_bags,
                unit="bags",
                rate=MATERIAL_PRICES["cement_50kg"],
                amount=cement_bags * MATERIAL_PRICES["cement_50kg"],
            ),
            BreakdownItem(
                description="Tile adhesive",
                quantity=adhesive_kg,
                unit="kg",
                rate=MATERIAL_PRICES["tile_adhesive_per_kg"],
                amount=adhesive_kg * MATERIAL_PRICES["tile_adhesive_per_kg"],
            ),
            BreakdownItem(
                description="Tile grout",
                quantity=grout_kg,
                unit="kg",
                rate=MATERIAL_PRICES["tile_grout_per_kg"],
                amount=grout_kg * MATERIAL_PRICES["tile_grout_per_kg"],
            ),
            BreakdownItem(
                description="Sand",
                quantity=sand_tonnes,
                unit="tonnes",
                rate=MATERIAL_PRICES["sand_per_tonne"],
                amount=sand_tonnes * MATERIAL_PRICES["sand_per_tonne"],
            ),
        ]

        # Labour - productivity: 6-10 m²/day for straight pattern
        labour_rate = LABOUR_RATES[region]
        tiler_days = (area / 8) * pattern_factor

        labour = [
            BreakdownItem(
                description="Tiler (skilled)",
                quantity=tiler_days,
                unit="days",
                rate=labour_rate["skilled"],
                amount=tiler_days * labour_rate["skilled"],
            ),
            BreakdownItem(
                description="Helper (unskilled)",
                quantity=tiler_days * 0.75,
                unit="days",
                rate=labour_rate["unskilled"],
                amount=tiler_days * 0.75 * labour_rate["unskilled"],
            ),
        ]

        equipment = [
            BreakdownItem(
                description="Tile cutter and tools",
                quantity=area,
                unit="m²",
                rate=25,
                amount=area * 25,
            ),
            BreakdownItem(
                description="Mixing tools and buckets",
                quantity=area,
                unit="m²",
                rate=15,
                amount=area * 15,
            ),
            BreakdownItem(
                description="Levels, spacers, trowels",
                quantity=area,
                unit="m²",
                rate=18,
                amount=area * 18,
            ),
        ]

        # Calculate totals
        mat_total = sum(item.amount for item in materials)
        lab_total = sum(item.amount for item in labour)
        equip_total = sum(item.amount for item in equipment)

        subtotal = mat_total + lab_total + equip_total
        overhead = subtotal * 0.10
        contingency = subtotal * 0.08
        profit = subtotal * 0.15

        total = (
            (subtotal + overhead + contingency + profit)
            * REGION_FACTORS[region]
            * condition_factor
        )

        return CalculationResult(
            work_type="Wall Tiling",
            unit_rate=total / area,
            unit="KES/m²",
            quantity=area,
            total_cost=total,
            breakdown=CostBreakdown(
                materials=materials,
                labour=labour,
                equipment=equipment,
                overhead=overhead,
                contingency=contingency,
                profit=profit,
            ),
            region=region,
            calculation_date=datetime.now().isoformat(),
            assumptions=[
                f"Tile size: {tile_size}cm",
                f"Tile quality: {tile_quality}",
                f"Wall condition: {wall_condition}",
                f"Laying pattern: {pattern}",
                f"Wastage allowance: {wastage_pct * 100}%",
                "Includes wall preparation and cleaning",
                "Standard cement mortar for bedding",
            ],
        )

    @staticmethod
    def painting_emulsion(inputs: Dict, region: str) -> CalculationResult:
        area = float(inputs["area"])
        coats = int(inputs["coats"])
        paint_quality = inputs["paint_quality"]
        surface_condition = inputs["surface_condition"]
        color_type = inputs["color"]
        height = inputs["height"]

        # Paint coverage (m²/litre)
        base_coverage = 12

        # Condition factor
        condition_map = {"New": 1.0, "Repaint-Good": 1.15, "Repaint-Poor": 1.4}
        condition_factor = condition_map[surface_condition]

        # Color factor
        color_factor = {"White": 1.0, "Light Colors": 1.05, "Dark Colors": 1.15}[
            color_type
        ]

        # Height factor for labour
        height_factor = {"Standard": 1.0, "High": 1.25, "Very High": 1.5}[height]

        # Calculate paint litres needed
        paint_litres = (area * coats / base_coverage) * condition_factor * color_factor

        # Primer needed for new or poor surfaces
        primer_needed = surface_condition in ["New", "Repaint-Poor"]
        primer_litres = (area / 14) if primer_needed else 0

        # Putty for surface preparation
        putty_kg = area * (0.5 if surface_condition == "Repaint-Poor" else 0.2)

        # Paint price map
        paint_price_map = {
            "Economy": MATERIAL_PRICES["paint_economy_per_4l"],
            "Standard": MATERIAL_PRICES["paint_standard_per_4l"],
            "Premium": MATERIAL_PRICES["paint_premium_per_4l"],
        }
        price_per_litre = paint_price_map[paint_quality] / 4

        materials = [
            BreakdownItem(
                description=f"{paint_quality} emulsion paint",
                quantity=paint_litres,
                unit="litres",
                rate=price_per_litre,
                amount=paint_litres * price_per_litre,
            ),
            BreakdownItem(
                description="Wall putty/filler",
                quantity=putty_kg,
                unit="kg",
                rate=18,
                amount=putty_kg * 18,
            ),
            BreakdownItem(
                description="Sandpaper and sundries",
                quantity=area,
                unit="m²",
                rate=12,
                amount=area * 12,
            ),
        ]

        if primer_needed:
            materials.append(
                BreakdownItem(
                    description="Primer/sealer",
                    quantity=primer_litres,
                    unit="litres",
                    rate=45,
                    amount=primer_litres * 45,
                )
            )

        # Labour - productivity: 30-50 m²/day depending on coats
        labour_rate = LABOUR_RATES[region]
        painter_days = (area / 40) * coats * height_factor

        labour = [
            BreakdownItem(
                description="Painter (skilled)",
                quantity=painter_days,
                unit="days",
                rate=labour_rate["skilled"],
                amount=painter_days * labour_rate["skilled"],
            ),
            BreakdownItem(
                description="Helper (unskilled)",
                quantity=painter_days * 0.5,
                unit="days",
                rate=labour_rate["unskilled"],
                amount=painter_days * 0.5 * labour_rate["unskilled"],
            ),
        ]

        equipment = [
            BreakdownItem(
                description="Brushes, rollers, trays",
                quantity=1,
                unit="set",
                rate=350,
                amount=350,
            ),
            BreakdownItem(
                description="Masking tape and drop sheets",
                quantity=area,
                unit="m²",
                rate=18,
                amount=area * 18,
            ),
        ]

        if height_factor > 1.0:
            equipment.append(
                BreakdownItem(
                    description="Ladders and scaffolding",
                    quantity=area,
                    unit="m²",
                    rate=40 * height_factor,
                    amount=area * 40 * height_factor,
                )
            )

        # Calculate totals
        mat_total = sum(item.amount for item in materials)
        lab_total = sum(item.amount for item in labour)
        equip_total = sum(item.amount for item in equipment)

        subtotal = mat_total + lab_total + equip_total
        overhead = subtotal * 0.10
        contingency = subtotal * 0.08
        profit = subtotal * 0.15

        total = (subtotal + overhead + contingency + profit) * REGION_FACTORS[region]

        return CalculationResult(
            work_type="Painting - Emulsion",
            unit_rate=total / area,
            unit="KES/m²",
            quantity=area,
            total_cost=total,
            breakdown=CostBreakdown(
                materials=materials,
                labour=labour,
                equipment=equipment,
                overhead=overhead,
                contingency=contingency,
                profit=profit,
            ),
            region=region,
            calculation_date=datetime.now().isoformat(),
            assumptions=[
                f"Number of coats: {coats}",
                f"Paint quality: {paint_quality}",
                f"Surface condition: {surface_condition}",
                f"Working height: {height}",
                f"Coverage rate: {base_coverage}m²/litre",
                "Includes surface preparation",
                "Weather conditions assumed favorable",
            ],
        )


class PlumbingCalculator:
    """Comprehensive plumbing calculations"""

    @staticmethod
    def sewer_pipe_laying(inputs: Dict, region: str) -> CalculationResult:
        length = float(inputs["length"])
        pipe_diameter = inputs["pipe_diameter"]
        pipe_material = inputs["pipe_material"]
        trench_depth = float(inputs["trench_depth"])
        soil_type = inputs["soil_type"]
        bedding_required = inputs["bedding_required"] == "Yes"

        # Pipe pricing
        pipe_price_map = {
            "100": MATERIAL_PRICES["pvc_pipe_100mm_per_m"],
            "150": MATERIAL_PRICES["pvc_pipe_150mm_per_m"],
            "200": MATERIAL_PRICES["pvc_pipe_200mm_per_m"],
            "250": MATERIAL_PRICES["pvc_pipe_250mm_per_m"],
            "300": MATERIAL_PRICES["pvc_pipe_300mm_per_m"],
        }

        pipe_rate = (
            pipe_price_map.get(pipe_diameter, 800)
            if pipe_material == "PVC"
            else pipe_price_map.get(pipe_diameter, 800) * 1.4
        )

        # Soil factor
        soil_factor = {"Soft": 1.0, "Medium": 1.2, "Hard": 1.4}[soil_type]

        # Trench dimensions (width based on pipe diameter + working space)
        trench_width = 0.6  # meters
        trench_volume = length * trench_width * trench_depth

        # Bedding calculations
        bedding_volume = length * trench_width * 0.15 if bedding_required else 0
        bedding_cement = bedding_volume * 6 if bedding_required else 0

        materials = [
            BreakdownItem(
                description=f"{pipe_material} pipe {pipe_diameter}mm",
                quantity=length,
                unit="m",
                rate=pipe_rate,
                amount=length * pipe_rate,
            ),
            BreakdownItem(
                description="Pipe joints and fittings",
                quantity=length / 6,
                unit="nr",
                rate=510,
                amount=(length / 6) * 510,
            ),
            BreakdownItem(
                description="Testing materials (water/air)",
                quantity=1,
                unit="ls",
                rate=450,
                amount=450,
            ),
        ]

        if bedding_required:
            materials.extend(
                [
                    BreakdownItem(
                        description="Bedding material (ballast)",
                        quantity=bedding_volume,
                        unit="m³",
                        rate=MATERIAL_PRICES["ballast_per_tonne"],
                        amount=bedding_volume * MATERIAL_PRICES["ballast_per_tonne"],
                    ),
                    BreakdownItem(
                        description="Cement for bedding",
                        quantity=bedding_cement,
                        unit="bags",
                        rate=MATERIAL_PRICES["cement_50kg"],
                        amount=bedding_cement * MATERIAL_PRICES["cement_50kg"],
                    ),
                ]
            )

        # Backfill select material (30% of trench)
        materials.append(
            BreakdownItem(
                description="Select backfill material",
                quantity=trench_volume * 0.3,
                unit="m³",
                rate=1200,
                amount=trench_volume * 0.3 * 1200,
            )
        )

        # Labour
        labour_rate = LABOUR_RATES[region]
        pipe_laying_days = (length / 15) * soil_factor

        labour = [
            BreakdownItem(
                description="Pipe layer (skilled)",
                quantity=pipe_laying_days,
                unit="days",
                rate=labour_rate["skilled"],
                amount=pipe_laying_days * labour_rate["skilled"],
            ),
            BreakdownItem(
                description="Excavator (semiskilled)",
                quantity=pipe_laying_days * 1.2,
                unit="days",
                rate=labour_rate["semiskilled"],
                amount=pipe_laying_days * 1.2 * labour_rate["semiskilled"],
            ),
            BreakdownItem(
                description="Helpers (unskilled)",
                quantity=pipe_laying_days * 1.5,
                unit="days",
                rate=labour_rate["unskilled"],
                amount=pipe_laying_days * 1.5 * labour_rate["unskilled"],
            ),
        ]

        equipment = [
            BreakdownItem(
                description="Excavation tools",
                quantity=length,
                unit="m",
                rate=35 * soil_factor,
                amount=length * 35 * soil_factor,
            ),
            BreakdownItem(
                description="Laser level for gradient",
                quantity=length,
                unit="m",
                rate=50,
                amount=length * 50,
            ),
            BreakdownItem(
                description="Compaction equipment",
                quantity=length,
                unit="m",
                rate=45,
                amount=length * 45,
            ),
            BreakdownItem(
                description="Testing equipment",
                quantity=1,
                unit="ls",
                rate=380,
                amount=380,
            ),
        ]

        # Calculate totals
        mat_total = sum(item.amount for item in materials)
        lab_total = sum(item.amount for item in labour)
        equip_total = sum(item.amount for item in equipment)

        subtotal = mat_total + lab_total + equip_total
        overhead = subtotal * 0.12
        contingency = subtotal * 0.10
        profit = subtotal * 0.15

        total = (subtotal + overhead + contingency + profit) * REGION_FACTORS[region]

        return CalculationResult(
            work_type="Sewer Pipe Laying",
            unit_rate=total / length,
            unit="KES/m",
            quantity=length,
            total_cost=total,
            breakdown=CostBreakdown(
                materials=materials,
                labour=labour,
                equipment=equipment,
                overhead=overhead,
                contingency=contingency,
                profit=profit,
            ),
            region=region,
            calculation_date=datetime.now().isoformat(),
            assumptions=[
                f"Pipe diameter: {pipe_diameter}mm",
                f"Pipe material: {pipe_material}",
                f"Trench depth: {trench_depth}m",
                f"Soil type: {soil_type}",
                f"Bedding: {'Required' if bedding_required else 'Not required'}",
                "Gradient 1:100 minimum assumed",
                "Includes excavation and backfilling",
                "Testing to KEBS standards included",
            ],
        )

    @staticmethod
    def manhole_construction(inputs: Dict, region: str) -> CalculationResult:
        depth = float(inputs["depth"])
        manhole_type = inputs["manhole_type"]
        diameter = float(inputs["diameter"]) / 1000  # Convert mm to m
        cover_type = inputs["cover_type"]
        excavation_condition = inputs["excavation_condition"]
        benching_required = inputs["benching_required"] == "Yes"

        # Depth factor
        depth_factor = 1.3 if depth > 3 else (1.15 if depth > 2 else 1.0)

        # Excavation condition factor
        exc_condition_factor = {"Dry": 1.0, "Wet": 1.3, "Rocky": 1.5}[
            excavation_condition
        ]

        # Calculate volumes
        wall_thickness = 0.15
        wall_volume = math.pi * diameter * wall_thickness * depth
        base_volume = math.pi * (diameter / 2) ** 2 * 0.15

        # Brickwork for walls (estimate)
        brick_count = math.pi * diameter * depth * 70

        # Cover price
        cover_price = {"Light": 3500, "Medium": 5500, "Heavy Duty": 8500}[cover_type]

        # Step irons
        step_irons_count = math.ceil(depth / 0.3)

        materials = [
            BreakdownItem(
                description="Cement (50kg bags)",
                quantity=(wall_volume + base_volume) * 8,
                unit="bags",
                rate=MATERIAL_PRICES["cement_50kg"],
                amount=(wall_volume + base_volume) * 8 * MATERIAL_PRICES["cement_50kg"],
            ),
            BreakdownItem(
                description="Sand",
                quantity=(wall_volume + base_volume) * 0.6,
                unit="m³",
                rate=MATERIAL_PRICES["sand_per_tonne"],
                amount=(wall_volume + base_volume)
                * 0.6
                * MATERIAL_PRICES["sand_per_tonne"],
            ),
            BreakdownItem(
                description="Ballast for base",
                quantity=base_volume * 1.2,
                unit="m³",
                rate=MATERIAL_PRICES["ballast_per_tonne"],
                amount=base_volume * 1.2 * MATERIAL_PRICES["ballast_per_tonne"],
            ),
            BreakdownItem(
                description="Bricks for walls",
                quantity=brick_count,
                unit="nr",
                rate=15,
                amount=brick_count * 15,
            ),
            BreakdownItem(
                description=f"Manhole cover - {cover_type}",
                quantity=1,
                unit="nr",
                rate=cover_price,
                amount=cover_price,
            ),
            BreakdownItem(
                description="Step irons",
                quantity=step_irons_count,
                unit="nr",
                rate=850,
                amount=step_irons_count * 850,
            ),
            BreakdownItem(
                description="Waterproofing compound",
                quantity=depth * diameter * math.pi,
                unit="m²",
                rate=MATERIAL_PRICES["waterproofing_per_sqm"],
                amount=depth
                * diameter
                * math.pi
                * MATERIAL_PRICES["waterproofing_per_sqm"],
            ),
        ]

        if benching_required:
            materials.append(
                BreakdownItem(
                    description="Benching materials",
                    quantity=diameter * 1.5,
                    unit="m²",
                    rate=MATERIAL_PRICES["cement_50kg"] * 0.5,
                    amount=diameter * 1.5 * MATERIAL_PRICES["cement_50kg"] * 0.5,
                )
            )

        # Labour
        labour_rate = LABOUR_RATES[region]

        labour = [
            BreakdownItem(
                description="Mason (skilled)",
                quantity=depth * 2 * depth_factor,
                unit="days",
                rate=labour_rate["skilled"],
                amount=depth * 2 * depth_factor * labour_rate["skilled"],
            ),
            BreakdownItem(
                description="Excavator (semiskilled)",
                quantity=depth * 1.5 * exc_condition_factor,
                unit="days",
                rate=labour_rate["semiskilled"],
                amount=depth * 1.5 * exc_condition_factor * labour_rate["semiskilled"],
            ),
            BreakdownItem(
                description="Helpers (unskilled)",
                quantity=depth * 2,
                unit="days",
                rate=labour_rate["unskilled"],
                amount=depth * 2 * labour_rate["unskilled"],
            ),
            BreakdownItem(
                description="Concrete work",
                quantity=1,
                unit="ls",
                rate=labour_rate["skilled"] * 0.8,
                amount=labour_rate["skilled"] * 0.8,
            ),
        ]

        equipment = [
            BreakdownItem(
                description="Excavation equipment",
                quantity=1,
                unit="ls",
                rate=650 * exc_condition_factor,
                amount=650 * exc_condition_factor,
            ),
            BreakdownItem(
                description="Concrete mixer",
                quantity=1,
                unit="ls",
                rate=550,
                amount=550,
            ),
            BreakdownItem(
                description="Lifting equipment",
                quantity=1,
                unit="ls",
                rate=450,
                amount=450,
            ),
        ]

        if excavation_condition == "Wet":
            equipment.append(
                BreakdownItem(
                    description="Dewatering pump",
                    quantity=depth,
                    unit="days",
                    rate=1200,
                    amount=depth * 1200,
                )
            )

        # Calculate totals
        mat_total = sum(item.amount for item in materials)
        lab_total = sum(item.amount for item in labour)
        equip_total = sum(item.amount for item in equipment)

        subtotal = mat_total + lab_total + equip_total
        overhead = subtotal * 0.12
        contingency = subtotal * 0.10
        profit = subtotal * 0.15

        total = (subtotal + overhead + contingency + profit) * REGION_FACTORS[region]

        return CalculationResult(
            work_type="Manhole Construction",
            unit_rate=total,
            unit="KES/Nr",
            quantity=1,
            total_cost=total,
            breakdown=CostBreakdown(
                materials=materials,
                labour=labour,
                equipment=equipment,
                overhead=overhead,
                contingency=contingency,
                profit=profit,
            ),
            region=region,
            calculation_date=datetime.now().isoformat(),
            assumptions=[
                f"Manhole depth: {depth}m",
                f"Internal diameter: {diameter * 1000}mm",
                f"Cover type: {cover_type}",
                f"Excavation condition: {excavation_condition}",
                f"Benching: {'Required' if benching_required else 'Not required'}",
                "Includes all fittings and finishes",
                "Testing to KEBS standards",
            ],
        )


class ConcreteCalculator:
    """Comprehensive concrete works calculations"""

    @staticmethod
    def mass_concrete_foundation(inputs: Dict, region: str) -> CalculationResult:
        volume = float(inputs["volume"])
        grade = inputs["concrete_grade"]
        foundation_depth = float(inputs["foundation_depth"])
        pour_method = inputs["pour_method"]
        access_difficulty = inputs["access_difficulty"]

        # Cement ratios per m³ for different grades
        cement_ratio_map = {"C15": 5.5, "C20": 6.5, "C25": 7.5, "C30": 8.5}

        cement_bags = volume * cement_ratio_map[grade]

        # Ready mix premium
        ready_mix_factor = {"Manual": 1.0, "Ready Mix": 1.25, "Concrete Pump": 1.4}[
            pour_method
        ]

        # Access difficulty factor
        access_factor = {"Easy": 1.0, "Moderate": 1.18, "Difficult": 1.35}[
            access_difficulty
        ]

        materials = [
            BreakdownItem(
                description="Cement (50kg bags)",
                quantity=cement_bags,
                unit="bags",
                rate=MATERIAL_PRICES["cement_50kg"] * ready_mix_factor,
                amount=cement_bags * MATERIAL_PRICES["cement_50kg"] * ready_mix_factor,
            ),
            BreakdownItem(
                description="Sand",
                quantity=volume * 0.45,
                unit="m³",
                rate=MATERIAL_PRICES["sand_per_tonne"],
                amount=volume * 0.45 * MATERIAL_PRICES["sand_per_tonne"],
            ),
            BreakdownItem(
                description="Ballast/Aggregate",
                quantity=volume * 0.9,
                unit="m³",
                rate=MATERIAL_PRICES["ballast_per_tonne"],
                amount=volume * 0.9 * MATERIAL_PRICES["ballast_per_tonne"],
            ),
            BreakdownItem(
                description="Water",
                quantity=volume * 200,
                unit="litres",
                rate=0.25,
                amount=volume * 200 * 0.25,
            ),
            BreakdownItem(
                description="Curing membrane/compound",
                quantity=volume * 2.5,
                unit="m²",
                rate=180,
                amount=volume * 2.5 * 180,
            ),
        ]

        # Labour
        labour_rate = LABOUR_RATES[region]

        labour = [
            BreakdownItem(
                description="Skilled labour (mixing, placing)",
                quantity=volume * 0.8,
                unit="man-days",
                rate=labour_rate["skilled"],
                amount=volume * 0.8 * labour_rate["skilled"],
            ),
            BreakdownItem(
                description="Semiskilled labour",
                quantity=volume * 1.2,
                unit="man-days",
                rate=labour_rate["semiskilled"],
                amount=volume * 1.2 * labour_rate["semiskilled"],
            ),
            BreakdownItem(
                description="Unskilled labour",
                quantity=volume * 1.5,
                unit="man-days",
                rate=labour_rate["unskilled"],
                amount=volume * 1.5 * labour_rate["unskilled"],
            ),
        ]

        equipment = [
            BreakdownItem(
                description="Concrete vibrator",
                quantity=volume,
                unit="m³",
                rate=550 / 10,
                amount=volume * (550 / 10),
            ),
            BreakdownItem(
                description="Hand tools",
                quantity=volume,
                unit="m³",
                rate=45,
                amount=volume * 45,
            ),
        ]

        if pour_method == "Manual":
            equipment.append(
                BreakdownItem(
                    description="Concrete mixer hire",
                    quantity=volume,
                    unit="m³",
                    rate=65,
                    amount=volume * 65,
                )
            )
        elif pour_method == "Concrete Pump":
            equipment.append(
                BreakdownItem(
                    description="Concrete pump hire",
                    quantity=1,
                    unit="ls",
                    rate=12000,
                    amount=12000,
                )
            )

        # Calculate totals
        mat_total = sum(item.amount for item in materials)
        lab_total = sum(item.amount for item in labour)
        equip_total = sum(item.amount for item in equipment)

        subtotal = mat_total + lab_total + equip_total
        overhead = subtotal * 0.12
        contingency = subtotal * 0.10
        profit = subtotal * 0.15

        total = (
            (subtotal + overhead + contingency + profit)
            * REGION_FACTORS[region]
            * access_factor
        )

        return CalculationResult(
            work_type="Mass Concrete Foundation",
            unit_rate=total / volume,
            unit="KES/m³",
            quantity=volume,
            total_cost=total,
            breakdown=CostBreakdown(
                materials=materials,
                labour=labour,
                equipment=equipment,
                overhead=overhead,
                contingency=contingency,
                profit=profit,
            ),
            region=region,
            calculation_date=datetime.now().isoformat(),
            assumptions=[
                f"Concrete grade: {grade}",
                f"Pouring method: {pour_method}",
                f"Foundation depth: {foundation_depth}m",
                f"Site access: {access_difficulty}",
                f"Mix ratio appropriate for {grade}",
                "7-day curing period included",
                "Testing to BS/KEBS standards",
            ],
        )


# Calculator routing
CALCULATORS = {
    "Site Clearance": EarthworksCalculator.site_clearance,
    "Bulk Excavation": EarthworksCalculator.bulk_excavation,
    "Wall Tiling": FinishesCalculator.wall_tiling,
    "Painting - Emulsion": FinishesCalculator.painting_emulsion,
    "Sewer Pipe Laying": PlumbingCalculator.sewer_pipe_laying,
    "Manhole Construction": PlumbingCalculator.manhole_construction,
    "Mass Concrete Foundation": ConcreteCalculator.mass_concrete_foundation,
}


@app.post("/calculate", response_model=CalculationResult)
async def calculate_unit_rate(request: CalculationRequest):
    """Calculate unit rate for construction work"""

    normalized = (
        request.work_type.strip().title()
    )  # "site clearance" → "Site Clearance"

    if normalized not in CALCULATORS:
        raise HTTPException(
            status_code=400,
            detail=f"Work type '{request.work_type}' not supported. Available types: {list(CALCULATORS.keys())}",
        )

    calculator = CALCULATORS[normalized]

    try:
        result = calculator(request.inputs, request.region)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@app.get("/work-types")
async def get_work_types():
    """Get list of available work types"""
    return {"work_types": list(CALCULATORS.keys())}


@app.get("/regions")
async def get_regions():
    """Get list of supported regions"""
    return {"regions": list(REGION_FACTORS.keys())}


@app.get("/material-prices")
async def get_material_prices():
    """Get current material prices"""
    return {"prices": MATERIAL_PRICES, "currency": "KES", "last_updated": "2025-10"}


@app.get("/labour-rates")
async def get_labour_rates():
    """Get current labour rates by region"""
    return {
        "rates": LABOUR_RATES,
        "currency": "KES",
        "period": "per day",
        "last_updated": "2025-10",
    }


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "Kenya Construction Unit Rate Calculator API",
        "version": "1.0.0",
        "description": "CSMM & SMM compliant unit rate calculations for Kenyan construction industry",
        "endpoints": {
            "calculate": "/calculate",
            "work_types": "/work-types",
            "regions": "/regions",
            "material_prices": "/material-prices",
            "labour_rates": "/labour-rates",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("unit_rates:app", host="0.0.0.0", port=8000, reload=True)
