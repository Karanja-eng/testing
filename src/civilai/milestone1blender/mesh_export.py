# backend/mesh_export.py
import os
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon
import trimesh
from shapely.ops import orient


def polygons_to_glb(polygons, out_path, scale=0.01, wall_height=3.0):
    """
    polygons: list of Nx2 numpy arrays (pixel coordinates).
    scale: multiply pixel coords by scale to convert to meters/blender units.
    wall_height: extrusion height in same units.
    Writes a glb to out_path.
    """
    scene = trimesh.Scene()

    for i, poly_pts in enumerate(polygons):
        pts_scaled = [(float(x) * scale, float(y) * scale) for x, y in poly_pts]

        # close polygon if not closed
        if pts_scaled[0] != pts_scaled[-1]:
            pts_scaled.append(pts_scaled[0])

        poly = Polygon(pts_scaled)
        if not poly.is_valid or poly.area == 0:
            continue

        try:
            mesh = trimesh.creation.extrude_polygon(poly, height=wall_height)
        except Exception:
            # fallback triangulation
            try:
                tris = trimesh.triangulate_polygon(poly, engine="mapbox_earcut")
                mesh = trimesh.creation.extrude_polygon(tris, height=wall_height)
            except Exception as e:
                print("⚠ Skip polygon → triangulation failed:", e)
                continue

        mesh.visual.vertex_colors = [200, 200, 200, 255]
        scene.add_geometry(mesh, node_name=f"wall_{i}")

    # export unified scene as GLB
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    glb = scene.export(file_type="glb")
    with open(out_path, "wb") as f:
        f.write(glb)
    return str(out_path)
