
import bpy
import bmesh
import json
import sys
import os
import math

def cleanup():
    """Clear all objects, meshes, materials"""
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)
    for block in bpy.data.textures:
        bpy.data.textures.remove(block)
    for block in bpy.data.images:
        bpy.data.images.remove(block)

def create_material(name, color):
    mat = bpy.data.materials.new(name=name)
    mat.diffuse_color = color
    return mat

def create_wall(wall_data, height=3.0):
    start = wall_data['start']
    end = wall_data['end']
    thickness = wall_data.get('thickness', 0.2)
    
    # Calculate vector and length
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    length = math.sqrt(dx*dx + dy*dy)
    angle = math.atan2(dy, dx)
    
    # Create Cube
    bpy.ops.mesh.primitive_cube_add(size=1, align='WORLD', location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = "Wall"
    
    # Scale and rotate
    # Default cube is 1x1x1 (from primitive_cube_add size=1)
    # Actually primitive_cube_add size=1 means dimensions 1x1x1. Vertices at +/- 0.5.
    
    # We want dimension X = length, Y = thickness, Z = height
    obj.scale[0] = length
    obj.scale[1] = thickness
    obj.scale[2] = height
    
    # Position: midpoint + z_offset
    mid_x = (x1 + x2) / 2
    mid_y = (y1 + y2) / 2
    
    obj.location[0] = mid_x
    obj.location[1] = mid_y
    obj.location[2] = height / 2.0
    
    obj.rotation_euler[2] = angle
    
    return obj

def create_cutter(opening, wall_height):
    # opening: {pos: [x,y], width: w, type: 'window'/'door' ...}
    x, y = opening['position']
    width = opening['width']
    atype = opening['type']
    
    # Rotation should match the wall it's on (passed or calculated?)
    # For simplicity, openings in JSON should have 'rotation'
    rotation = opening.get('rotation', 0)
    
    height = 2.1 if atype == 'door' else 1.2
    sill = 0.0 if atype == 'door' else (opening.get('sill', 0.9))
    
    bpy.ops.mesh.primitive_cube_add(size=1)
    cutter = bpy.context.active_object
    cutter.name = "Cutter"
    
    # Dimensions
    # Width + small epsilon to ensure cut
    cutter.scale[0] = width - 0.05 # Slightly smaller width to keep wall side frames if needed? No, user wants clean cuts.
    # Actually, usually boolean cuts need to be slightly LARGER/LONGER in the cutting direction (Y/Thickness) to avoid Z-fighting faces
    cutter.scale[0] = width
    cutter.scale[1] = 1.0 # Thickness large enough
    cutter.scale[2] = height
    
    cutter.location[0] = x
    cutter.location[1] = y
    cutter.location[2] = sill + (height / 2.0)
    
    cutter.rotation_euler[2] = rotation
    
    # Display as wire for debug
    cutter.display_type = 'WIRE'
    
    return cutter

def create_floor(room):
    points = room['polygon'] # [[x,y], [x,y]...]
    if len(points) < 3: return None
    
    # Create mesh
    mesh = bpy.data.meshes.new(name=f"Floor_{room.get('name', 'Room')}")
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.collection.objects.link(obj)
    
    bm = bmesh.new()
    
    # Add verts
    bm_verts = []
    for p in points:
        bm_verts.append(bm.verts.new((p[0], p[1], 0)))
        
    # Create face
    try:
        bm.faces.new(bm_verts)
    except:
        # Fallback for complex polygons or duplicates
        pass
        
    bm.to_mesh(mesh)
    bm.free()
    
    # Add material
    mat = create_material(f"Mat_{room.get('type', 'generic')}", (0.8, 0.8, 0.7, 1))
    if 'bathroom' in room.get('type',''):
        mat.diffuse_color = (0.7, 0.8, 0.9, 1) # Blueish
    elif 'kitchen' in room.get('type',''):
        mat.diffuse_color = (0.9, 0.9, 0.8, 1) # Yellowish
        
    obj.data.materials.append(mat)
    
    return obj


def main():
    argv = sys.argv
    try:
        idx = argv.index("--")
        args = argv[idx+1:]
    except ValueError:
        args = []
        
    if len(args) < 2:
        print("Usage: blender -b -P script.py -- <input_json> <output_glb>")
        return

    input_json = args[0]
    output_glb = args[1]
    
    if not os.path.exists(input_json):
        print(f"Error: JSON file not found: {input_json}")
        return

    try:
        with open(input_json, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        return
        
    cleanup()
    
    # 1. Create Floor Slabs
    for room in data.get('rooms', []):
        try:
            create_floor(room)
        except Exception as e:
            print(f"Failed to create floor for room: {e}")
        
    # 2. Create Walls
    walls = []
    for w in data.get('walls', []):
        try:
            wall_obj = create_wall(w, height=data.get('wallHeight', 3.0))
            walls.append(wall_obj)
        except Exception as e:
            print(f"Failed to create wall: {e}")
        
    # 3. Create Openings (Booleans)
    openings = data.get('doors', []) + data.get('windows', [])
    cutters = []
    
    for op in openings:
        try:
            c = create_cutter(op, data.get('wallHeight', 3.0))
            cutters.append(c)
        except Exception as e:
            print(f"Failed to create cutter: {e}")
        
    # Apply Booleans if we have both walls and cutters
    if walls and cutters:
        for wall in walls:
            for cutter in cutters:
                try:
                    # Simple distance check
                    wx, wy = wall.location[0], wall.location[1]
                    cx, cy = cutter.location[0], cutter.location[1]
                    dist = math.sqrt((wx-cx)**2 + (wy-cy)**2)
                    
                    # Heuristic: Apply boolean if close enough
                    if dist < 5.0:  # generous radius
                        bool_mod = wall.modifiers.new(type="BOOLEAN", name="hole")
                        bool_mod.object = cutter
                        bool_mod.operation = 'DIFFERENCE'
                except Exception as e:
                    print(f"Failed to apply boolean: {e}")

    # 4. Create Objects (Electrical / Furniture)
    for obj_data in data.get('objects', []):
        try:
            x, y = obj_data['position']
            otype = obj_data.get('type', 'object')
            
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(x, y, 1.5))
            marker = bpy.context.active_object
            marker.name = f"Obj_{otype}"
            
            mat = create_material("MarkerRed", (1.0, 0.0, 0.0, 1))
            marker.data.materials.append(mat)
        except Exception as e:
            print(f"Failed to create object marker: {e}")
            
    # If scene is empty, create a dummy object so GLB export doesn't fail
    if not bpy.data.objects:
        bpy.ops.mesh.primitive_cube_add(size=0.1, location=(0,0,0))
        print("Scene was empty, created dummy cube.")

    # 5. Export
    try:
        bpy.ops.export_scene.gltf(filepath=output_glb, export_format='GLB')
        print(f"Exported to {output_glb}")
    except Exception as e:
        print(f"Export failed: {e}")


if __name__ == "__main__":
    main()
