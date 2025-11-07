import bpy
import sys
import os
import math

argv = sys.argv
argv = argv[argv.index("--") + 1 :] if "--" in argv else []
output_path = argv[0] if argv else "beam.glb"

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Create concrete beam
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
beam = bpy.context.object
beam.scale = (2.5, 0.15, 0.25)
beam.name = "ConcreteBeam"

# Material
mat_concrete = bpy.data.materials.new("Concrete")
mat_concrete.diffuse_color = (0.7, 0.7, 0.7, 0.6)
beam.data.materials.append(mat_concrete)

# Longitudinal bars (with hooks)
bar_radius = 0.02
bar_length = 5.0
cover = 0.05
hook_angle = math.radians(135)
hook_length = 0.15

y_positions = [-0.15 + cover + bar_radius, 0.15 - cover - bar_radius]
x_positions = [-0.1, 0.1]

for y in y_positions:
    for x in x_positions:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=bar_radius, depth=bar_length, location=(x, y, 0)
        )
        bar = bpy.context.object
        bar.rotation_euler = (math.pi / 2, 0, 0)
        bar.name = f"Bar_{x}_{y}"

        # Add hook (bent segment)
        bpy.ops.mesh.primitive_cylinder_add(
            radius=bar_radius,
            depth=hook_length,
            location=(x, y, bar_length / 2 - hook_length / 2),
        )
        hook = bpy.context.object
        hook.rotation_euler = (0, hook_angle, 0)
        hook.name = f"Hook_{x}_{y}"

# Simple stirrups (wire rings)
spacing = 0.3
num_stirrups = int(bar_length / spacing)
for i in range(num_stirrups + 1):
    z = -bar_length / 2 + i * spacing
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z))
    stirrup = bpy.context.object
    stirrup.scale = (0.18, 0.08, 0.005)
    stirrup.name = f"Stirrup_{i}"

# Export to GLB
bpy.ops.export_scene.gltf(filepath=output_path, export_format="GLB")
print(f"✅ Beam exported to {output_path}")
