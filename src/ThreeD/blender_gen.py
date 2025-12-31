import bpy
import json
import argparse
import sys
import os
import math

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_material(name, color):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes["Principled BSDF"].inputs[0].default_value = color
    return mat

def create_wall(start, end, height, thickness, name="Wall"):
    # Calculate vector
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    dist = math.sqrt(dx**2 + dy**2)
    angle = math.atan2(dy, dx)
    
    bpy.ops.mesh.primitive_cube_add(size=1)
    wall = bpy.context.active_object
    wall.name = name
    
    # Scale and move
    wall.scale = (dist, thickness, height)
    wall.location = (start[0] + dx/2, start[1] + dy/2, height/2)
    wall.rotation_euler[2] = angle
    
    # Apply transformation (useful for booleans)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return wall

def create_opening_cutter(pos, width, height, sill, rot, thickness):
    bpy.ops.mesh.primitive_cube_add(size=1)
    cutter = bpy.context.active_object
    # Cutter needs to be thicker than the wall to ensure clean boolean
    cutter.scale = (width, thickness * 2.0, height)
    cutter.location = (pos[0], pos[1], sill + height/2)
    cutter.rotation_euler[2] = rot
    return cutter

def create_frame(pos, width, height, sill, rot, thickness, type_name):
    # Create a frame for window/door
    frame_thickness = 0.05
    frame_depth = thickness + 0.02
    
    # Simple frame using 4 cubes
    frame_color = (0.1, 0.1, 0.1, 1.0) # Dark bold frames
    if "window" in type_name:
        frame_color = (0.2, 0.3, 0.8, 1.0) # Sleek blue-ish frames
        
    mat = create_material(f"Mat_{type_name}", frame_color)
    
    # Outer container
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(pos[0], pos[1], sill))
    parent = bpy.context.active_object
    parent.rotation_euler[2] = rot
    
    # Helper to add segments
    def add_segment(loc, scale, name):
        bpy.ops.mesh.primitive_cube_add(size=1)
        seg = bpy.context.active_object
        seg.scale = scale
        seg.location = loc
        seg.parent = parent
        seg.active_material = mat
        
    # Left, Right, Top, Bottom
    add_segment((-width/2 + frame_thickness/2, 0, height/2), (frame_thickness, frame_depth, height), "Frame_L")
    add_segment((width/2 - frame_thickness/2, 0, height/2), (frame_thickness, frame_depth, height), "Frame_R")
    add_segment((0, 0, height - frame_thickness/2), (width, frame_depth, frame_thickness), "Frame_T")
    
    if "window" in type_name:
        add_segment((0, 0, frame_thickness/2), (width, frame_depth, frame_thickness), "Frame_B")
        # Sill (Exterior protrusion)
        add_segment((0, thickness/2 + 0.05, 0), (width + 0.1, thickness + 0.1, 0.05), "Sill")
        
    return parent

def create_furniture(pos, size, rot, type_name):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = f"Furn_{type_name}"
    obj.scale = (size[0], size[1], size[2])
    obj.location = (pos[0], pos[1], size[2]/2)
    obj.rotation_euler[2] = rot
    
    # Color based on type
    color = (0.8, 0.8, 0.8, 1.0)
    if "sink" in type_name: color = (1, 1, 1, 1)
    elif "cabinet" in type_name: color = (0.6, 0.4, 0.2, 1.0)
    
    obj.active_material = create_material(f"Mat_{type_name}", color)
    return obj

def run_gen(input_json, output_glb):
    clear_scene()
    
    with open(input_json, 'r') as f:
        data = json.load(f)
    
    wall_height = data.get("wallHeight", 3.0)
    floor = data["floors"][0]
    
    # 1. Create Walls
    all_walls = []
    for i, w_data in enumerate(floor["walls"]):
        w = create_wall(w_data["start"], w_data["end"], wall_height, w_data["thickness"], name=f"Wall_{i}")
        all_walls.append(w)
    
    # 2. Add Openings (Cutters + Frames)
    all_openings = floor["doors"] + floor["windows"]
    for op in all_openings:
        sill = op.get("sillHeight", 0.0) if op["type"] == "window" else 0.0
        
        # Create cutter
        cutter = create_opening_cutter(op["position"], op["width"], op["height"], sill, op["rotation"], 0.5)
        
        # Boolean cut all walls (simple approach: cut any wall the cutter touches)
        for w in all_walls:
            # Check if cutter intersects wall (simplified: always apply, Blender handles empty cuts)
            bool_mod = w.modifiers.new(name="Cut", type='BOOLEAN')
            bool_mod.operation = 'DIFFERENCE'
            bool_mod.object = cutter
            
        # Hide cutter from render & viewport
        cutter.hide_viewport = True
        cutter.hide_render = True
        
        # Create Frame
        create_frame(op["position"], op["width"], op["height"], sill, op["rotation"], floor["walls"][0]["thickness"], op["type"])

    # 3. Create Rooms (Heatmaps)
    for room in floor["rooms"]:
        if room["polygon"]:
            # Create floor mesh from polygon
            # For simplicity in baseline, we use the bounding box or a plane
            pts = room["polygon"]
            # Create mesh
            mesh = bpy.data.meshes.new(f"Floor_{room['id']}")
            obj = bpy.data.objects.new(f"Floor_{room['id']}", mesh)
            bpy.context.collection.objects.link(obj)
            
            verts = [(p[0], p[1], 0.01) for p in pts]
            faces = [range(len(pts))]
            mesh.from_pydata(verts, [], faces)
            
            # Material
            rtype = room["type"].lower()
            color = (0.8, 0.8, 0.8, 1.0)
            if "bedroom" in rtype: color = (0.39, 0.58, 0.93, 1.0)
            elif "kitchen" in rtype: color = (1.0, 0.65, 0.0, 1.0)
            elif "living" in rtype: color = (1.0, 0.84, 0.0, 1.0)
            
            obj.active_material = create_material(f"Mat_{room['type']}", color)

    # 4. Create Furniture
    for furn in floor["furniture"]:
        create_furniture(furn["position"], furn["size"], furn["rotation"], furn["type"])

    # 5. Export
    bpy.ops.export_scene.gltf(filepath=output_glb, export_format='GLB')

if __name__ == "__main__":
    # Get arguments after "--"
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1:]
        parser = argparse.ArgumentParser()
        parser.add_argument("--input", required=True)
        parser.add_argument("--output", required=True)
        parsed = parser.parse_args(args)
        run_gen(parsed.input, parsed.output)
