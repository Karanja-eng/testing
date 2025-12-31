import numpy as np
from typing import List, Dict
from models import Furniture, TechnicalPoint, Conduit, Wall

class EngineeringEngine:
    def __init__(self, wall_height: float = 3.0):
        self.wall_height = wall_height

    def auto_place_electrical(self, furniture: List[Furniture], walls: List[Wall]) -> List[TechnicalPoint]:
        points = []
        for i, item in enumerate(furniture):
            # Rule: Place socket behind beds
            if "bed" in item.type:
                # Place two sockets on either side of the headboard (assuming head is at rotation 0)
                # Offset from center
                offset = item.size[0] / 2 + 0.2
                p1 = [item.position[0] - offset, item.position[1]]
                p2 = [item.position[0] + offset, item.position[1]]
                
                points.append(TechnicalPoint(id=f"socket_bed_{i}_L", position=p1, type="power_socket", category="electrical", height=0.45))
                points.append(TechnicalPoint(id=f"socket_bed_{i}_R", position=p2, type="power_socket", category="electrical", height=0.45))
            
            # Rule: Socket near desk/chair
            elif "chair" in item.type or "table" in item.type:
                p = [item.position[0], item.position[1]]
                points.append(TechnicalPoint(id=f"socket_desk_{i}", position=p, type="power_socket", category="electrical", height=0.45))
                
        return points

    def generate_conduits(self, points: List[TechnicalPoint], db_point: List[float]) -> List[Conduit]:
        conduits = []
        # Simple "Home Run" routing (each point goes to DB)
        # In a real app, we'd route along walls. For now, we simulate the path.
        for i, pt in enumerate(points):
            # Path: Socket -> Up Wall -> Ceiling -> DB
            path = [
                [pt.position[0], pt.position[1], pt.height],
                [pt.position[0], pt.position[1], self.wall_height - 0.1],
                [db_point[0], db_point[1], self.wall_height - 0.1],
                [db_point[0], db_point[1], 1.5] # Entry into DB
            ]
            conduits.append(Conduit(id=f"conduit_{i}", path=path, type=pt.category))
            
        return conduits

    def generate_plumbing_pipes(self, furniture: List[Furniture]) -> List[Conduit]:
        conduits = []
        # Rule: Connect all plumbing fixtures to a logical "main drain"
        for i, item in enumerate(furniture):
            if item.category == "plumbing":
                # Path: Fixture -> Floor -> Waste line
                path = [
                    [item.position[0], item.position[1], 0.5],
                    [item.position[0], item.position[1], -0.2],
                    [item.position[0] + 2, item.position[1], -0.2] # To main waste
                ]
                conduits.append(Conduit(id=f"pipe_{i}", path=path, type="water", diameter=0.04))
        return conduits
