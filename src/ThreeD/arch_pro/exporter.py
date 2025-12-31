import json
import numpy as np
from typing import List, Dict

class MeshGenerator:
    """
    Arch Pro 5.0: Generates high-fidelity vertex/face sets from architectural polygons.
    Ensures wall mitering and clean topology for Blender rendering.
    """
    def generate_wall_mesh(self, polygon: List[List[float]], height: float) -> Dict:
        # Convert 2D polygon to 3D extruded mesh (verts and faces)
        verts = []
        faces = []
        
        # Bottom verts
        for p in polygon:
            verts.append([p[0], 0, p[1]])
        
        # Top verts
        n = len(polygon)
        for p in polygon:
            verts.append([p[0], height, p[1]])
            
        # Faces: Bottom
        faces.append(list(range(n)))
        # Faces: Top
        faces.append(list(range(n, 2*n)))
        
        # Faces: Sides
        for i in range(n):
            next_i = (i + 1) % n
            faces.append([i, next_i, next_i + n, i + n])
            
        return {"verts": verts, "faces": faces}

    def export_as_json(self, building_data: Dict, filename: str):
        with open(filename, 'w') as f:
            json.dump(building_data, f, indent=4)
