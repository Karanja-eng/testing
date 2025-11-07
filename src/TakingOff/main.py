# backend/app.py
# FastAPI backend for construction quantity takeoff app

from fastapi import FastAPI
from pydantic import BaseModel
import math
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Common material calculations function
def calculate_materials(wet_volume: float):
    dry_volume = wet_volume * 1.54
    mix_ratio_sum = 1 + 1.5 + 3  # 5.5
    cement_vol = (1 / mix_ratio_sum) * dry_volume
    sand_vol = (1.5 / mix_ratio_sum) * dry_volume
    aggregate_vol = (3 / mix_ratio_sum) * dry_volume
    cement_bags = cement_vol / 0.035
    return dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags


# Stairs (existing)
class StaircaseInput(BaseModel):
    flight_height: float
    riser_height: float
    tread_width: float
    stair_width: float
    waist_thickness: float


class StaircaseOutput(BaseModel):
    num_risers: int
    num_treads: int
    horizontal_length: float
    inclined_length: float
    vol_waist: float
    vol_steps: float
    total_concrete: float
    form_soffit: float
    form_risers: float
    form_sides: float
    dry_volume: float
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/stairs", response_model=StaircaseOutput)
def calculate_stairs(input: StaircaseInput):
    num_risers = math.ceil(input.flight_height / input.riser_height)
    num_treads = num_risers - 1
    horizontal_length = num_treads * input.tread_width
    inclined_length = math.sqrt(horizontal_length**2 + input.flight_height**2)

    vol_waist = inclined_length * input.stair_width * input.waist_thickness
    vol_steps = (
        num_treads * (input.riser_height * input.tread_width / 2) * input.stair_width
    )
    total_concrete = vol_waist + vol_steps

    form_soffit = inclined_length * input.stair_width
    form_risers = num_risers * input.riser_height * input.stair_width
    form_sides = 2 * inclined_length * input.waist_thickness

    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        total_concrete
    )

    return StaircaseOutput(
        num_risers=num_risers,
        num_treads=num_treads,
        horizontal_length=horizontal_length,
        inclined_length=inclined_length,
        vol_waist=vol_waist,
        vol_steps=vol_steps,
        total_concrete=total_concrete,
        form_soffit=form_soffit,
        form_risers=form_risers,
        form_sides=form_sides,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# Foundation (example: strip foundation)
class FoundationInput(BaseModel):
    length: float
    width: float
    depth: float
    trench_width: float  # Wider for excavation


class FoundationOutput(BaseModel):
    vol_excavation: float
    vol_concrete: float
    form_sides: float
    dry_volume: float
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/foundation", response_model=FoundationOutput)
def calculate_foundation(input: FoundationInput):
    vol_excavation = input.length * input.trench_width * input.depth
    vol_concrete = input.length * input.width * input.depth
    form_sides = 2 * input.length * input.depth  # Assuming open ends or adjust

    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        vol_concrete
    )

    return FoundationOutput(
        vol_excavation=vol_excavation,
        vol_concrete=vol_concrete,
        form_sides=form_sides,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# Superstructure (example: simple slab)
class SuperstructureInput(BaseModel):
    length: float
    width: float
    thickness: float


class SuperstructureOutput(BaseModel):
    vol_concrete: float
    form_soffit: float
    form_sides: float
    dry_volume: float
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/superstructure", response_model=SuperstructureOutput)
def calculate_superstructure(input: SuperstructureInput):
    vol_concrete = input.length * input.width * input.thickness
    form_soffit = input.length * input.width
    form_sides = 2 * (input.length + input.width) * input.thickness

    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        vol_concrete
    )

    return SuperstructureOutput(
        vol_concrete=vol_concrete,
        form_soffit=form_soffit,
        form_sides=form_sides,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# Pavement (example: road pavement)
class PavementInput(BaseModel):
    length: float
    width: float
    thickness: float  # For base layer


class PavementOutput(BaseModel):
    area: float
    vol_material: float
    dry_volume: float  # If concrete pavement
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/pavement", response_model=PavementOutput)
def calculate_pavement(input: PavementInput):
    area = input.length * input.width
    vol_material = area * input.thickness

    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        vol_material
    )

    return PavementOutput(
        area=area,
        vol_material=vol_material,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# Manholes (example: simple manhole)
class ManholeInput(BaseModel):
    depth: float
    diameter: float


class ManholeOutput(BaseModel):
    vol_excavation: float
    vol_concrete: float  # For base/walls
    form_area: float
    dry_volume: float
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/manholes", response_model=ManholeOutput)
def calculate_manholes(input: ManholeInput):
    # Assume cylindrical
    vol_excavation = math.pi * (input.diameter / 2) ** 2 * input.depth
    vol_concrete = vol_excavation * 0.8  # Placeholder
    form_area = math.pi * input.diameter * input.depth

    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        vol_concrete
    )

    return ManholeOutput(
        vol_excavation=vol_excavation,
        vol_concrete=vol_concrete,
        form_area=form_area,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# Retaining Walls (example)
class RetainingWallInput(BaseModel):
    length: float
    height: float
    thickness: float


class RetainingWallOutput(BaseModel):
    vol_concrete: float
    form_sides: float
    dry_volume: float
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/retaining-walls", response_model=RetainingWallOutput)
def calculate_retaining_walls(input: RetainingWallInput):
    vol_concrete = input.length * input.height * input.thickness
    form_sides = 2 * input.length * input.height

    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        vol_concrete
    )

    return RetainingWallOutput(
        vol_concrete=vol_concrete,
        form_sides=form_sides,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# Swimming Pools (example)
class SwimmingPoolInput(BaseModel):
    length: float
    width: float
    depth: float


class SwimmingPoolOutput(BaseModel):
    vol_excavation: float
    vol_concrete: float
    form_area: float
    dry_volume: float
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/swimming-pools", response_model=SwimmingPoolOutput)
def calculate_swimming_pools(input: SwimmingPoolInput):
    vol_excavation = input.length * input.width * input.depth
    vol_concrete = vol_excavation * 0.1  # Placeholder for shell thickness
    form_area = (
        2 * (input.length * input.depth + input.width * input.depth)
        + input.length * input.width
    )

    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        vol_concrete
    )

    return SwimmingPoolOutput(
        vol_excavation=vol_excavation,
        vol_concrete=vol_concrete,
        form_area=form_area,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# Basement (example)
class BasementInput(BaseModel):
    length: float
    width: float
    depth: float


class BasementOutput(BaseModel):
    vol_excavation: float
    vol_concrete_walls: float
    vol_concrete_floor: float
    form_area: float
    dry_volume: float
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/basement", response_model=BasementOutput)
def calculate_basement(input: BasementInput):
    vol_excavation = input.length * input.width * input.depth
    wall_thickness = 0.3  # Assumption
    vol_concrete_walls = 2 * (input.length + input.width) * input.depth * wall_thickness
    vol_concrete_floor = input.length * input.width * 0.2  # Assumption
    form_area = 2 * (input.length + input.width) * input.depth * 2  # Inner/outer

    total_concrete = vol_concrete_walls + vol_concrete_floor
    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        total_concrete
    )

    return BasementOutput(
        vol_excavation=vol_excavation,
        vol_concrete_walls=vol_concrete_walls,
        vol_concrete_floor=vol_concrete_floor,
        form_area=form_area,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# Water Tanks (example)
class WaterTankInput(BaseModel):
    capacity: float  # m3
    height: float


class WaterTankOutput(BaseModel):
    vol_concrete: float
    form_area: float
    dry_volume: float
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/water-tanks", response_model=WaterTankOutput)
def calculate_water_tanks(input: WaterTankInput):
    # Assume square tank
    side = math.sqrt(input.capacity / input.height)
    wall_thickness = 0.2
    vol_concrete = (
        4 * side * input.height * wall_thickness + side**2 * wall_thickness * 2
    )  # Walls + base + top
    form_area = 4 * side * input.height * 2  # Inner/outer

    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        vol_concrete
    )

    return WaterTankOutput(
        vol_concrete=vol_concrete,
        form_area=form_area,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# Roofs (example: pitched roof)
class RoofInput(BaseModel):
    length: float
    width: float
    pitch: float  # degrees


class RoofOutput(BaseModel):
    area_covering: float
    rafter_length: float
    vol_timber: float  # Placeholder
    dry_volume: float  # If concrete roof
    cement_vol: float
    sand_vol: float
    aggregate_vol: float
    cement_bags: float


@app.post("/calculate/roofs", response_model=RoofOutput)
def calculate_roofs(input: RoofInput):
    inclined_length = input.width / 2 / math.cos(math.radians(input.pitch))
    area_covering = 2 * input.length * inclined_length
    rafter_length = inclined_length  # Per side
    vol_timber = 0  # Placeholder, as focus on concrete if applicable
    vol_concrete = 0  # Assume timber roof, adjust if needed

    dry_volume, cement_vol, sand_vol, aggregate_vol, cement_bags = calculate_materials(
        vol_concrete
    )

    return RoofOutput(
        area_covering=area_covering,
        rafter_length=rafter_length,
        vol_timber=vol_timber,
        dry_volume=dry_volume,
        cement_vol=cement_vol,
        sand_vol=sand_vol,
        aggregate_vol=aggregate_vol,
        cement_bags=cement_bags,
    )


# To run: uvicorn app:app --reload


# backend/app.py
# To run: uvicorn app:app --reload
# Install dependencies: pip install fastapi uvicorn pydantic numpy scipy matplotlib


from pydantic import BaseModel, Field
from typing import List, Optional
import numpy as np
from scipy.interpolate import griddata
import matplotlib.pyplot as plt


class Reading(BaseModel):
    station: str
    x: float
    y: float
    reading: float
    reading_type: str = Field(..., pattern="^(BS|IS|FS)$")


class InputData(BaseModel):
    readings: List[Reading]
    benchmark_station: str
    benchmark_rl: float


class ContourPath(BaseModel):
    level: float
    path: List[List[float]]  # List of [x, y]


class OutputData(BaseModel):
    points: List[dict]
    contours: List[ContourPath]


@app.post("/api/calculate", response_model=OutputData)
def calculate_leveling(data: InputData):
    try:
        # Compute RLs using Height of Collimation method
        rl_dict = {}
        points = {}  # station: {'x': x, 'y': y}
        current_hi = None

        i = 0
        while i < len(data.readings):
            reading = data.readings[i]
            station = reading.station

            if station not in points:
                points[station] = {"x": reading.x, "y": reading.y}

            if reading.reading_type == "BS":
                if current_hi is None:
                    # First BS
                    if station != data.benchmark_station:
                        raise ValueError("First BS must be to benchmark station")
                    rl_dict[station] = data.benchmark_rl
                    current_hi = data.benchmark_rl + reading.reading
                else:
                    # BS after FS (change point)
                    if station not in rl_dict:
                        raise ValueError("BS to change point without prior FS RL")
                    current_hi = rl_dict[station] + reading.reading
            elif reading.reading_type in ["IS", "FS"]:
                if current_hi is None:
                    raise ValueError("No HI set before IS/FS")
                rl_dict[station] = current_hi - reading.reading
            else:
                raise ValueError("Invalid reading type")

            if reading.reading_type == "FS":
                # Next should be BS to same station if change point
                pass  # Handled in next iteration

            i += 1

        # Assign RLs to points
        for station in points:
            if station not in rl_dict:
                raise ValueError(f"RL not computed for station {station}")
            points[station]["rl"] = rl_dict[station]

        # Prepare for contouring
        if len(points) < 3:
            raise ValueError("At least 3 points needed for contours")

        point_list = list(points.values())
        xs = [p["x"] for p in point_list]
        ys = [p["y"] for p in point_list]
        zs = [p["rl"] for p in point_list]

        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)

        if min_x == max_x or min_y == max_y:
            raise ValueError("Points must span an area")

        # Grid interpolation
        grid_x = np.linspace(min_x, max_x, 100)
        grid_y = np.linspace(min_y, max_y, 100)
        grid_x, grid_y = np.meshgrid(grid_x, grid_y)
        grid_z = griddata((xs, ys), zs, (grid_x, grid_y), method="linear")

        # Generate contours
        plt.switch_backend("agg")
        plt.figure()
        levels = np.linspace(
            np.nanmin(grid_z), np.nanmax(grid_z), 10
        )  # 10 contour levels
        cs = plt.contour(grid_x, grid_y, grid_z, levels=levels)

        contours = []
        for level, collection in zip(cs.levels, cs.collections):
            for kp in collection.get_paths():
                vertices = kp.vertices.tolist()  # List of [x, y]
                contours.append({"level": float(level), "path": vertices})

        return {"points": point_list, "contours": contours}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
