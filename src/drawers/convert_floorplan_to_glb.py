import bpy
import sys
import os

argv = sys.argv
argv = argv[argv.index("--") + 1 :] if "--" in argv else []

if len(argv) < 2:
    print(
        "❌ Usage: blender -b -P convert_floorplan_to_glb.py -- <input.png> <output.glb>"
    )
    sys.exit(1)

input_path = os.path.abspath(argv[0])
output_path = os.path.abspath(argv[1])

print(f"🔹 Input image: {input_path}")
print(f"🔹 Output model: {output_path}")

# Cleanup default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Ensure GLB export plugins enabled
bpy.ops.preferences.addon_enable(module="io_scene_gltf2")

# Import the image as a plane (placeholder for now)
try:
    bpy.ops.import_image.to_plane(
        files=[{"name": os.path.basename(input_path)}],
        directory=os.path.dirname(input_path),
        relative=False,
    )
except Exception as e:
    print("❌ Failed to import image as plane:", e)
    sys.exit(2)

# Rename and center object
obj = bpy.context.active_object
obj.name = "FloorplanPlane"
obj.location = (0, 0, 0)

# Export to GLB
try:
    bpy.ops.export_scene.gltf(
        filepath=output_path, export_format="GLB", use_selection=False
    )
    print("✅ Export Successful:", output_path)
except Exception as e:
    print("❌ GLB export failed:", e)
    sys.exit(3)

bpy.ops.wm.quit_blender()
