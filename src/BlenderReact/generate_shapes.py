import bpy
import sys
import argparse
import os
import math


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--length", type=float, default=5.0)
    parser.add_argument("--width", type=float, default=0.3)
    parser.add_argument("--height", type=float, default=0.5)
    args, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return args


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)


def create_material(name, color):
    mat = bpy.data.materials.new(name=name)
    mat.diffuse_color = (*color, 1)
    return mat


def create_concrete_beam(length, width, height):
    bpy.ops.mesh.primitive_cube_add(size=1)
    beam = bpy.context.active_object
    beam.name = "ConcreteBeam"
    beam.scale = (width / 2, length / 2, height / 2)
    beam.location = (0, 0, height / 2)
    beam.data.materials.append(create_material("Concrete", (0.6, 0.6, 0.6)))
    return beam


def create_rebar(radius, length, position, hook_len=0.15):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=length,
        location=position,
        rotation=(math.radians(90), 0, 0),
    )
    bar = bpy.context.active_object
    bar.data.materials.append(create_material("Steel", (0.7, 0.1, 0.1)))

    # Create hooked ends (small bends)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=hook_len,
        location=(position[0], position[1] + length / 2, position[2] + hook_len / 2),
        rotation=(0, math.radians(90), 0),
    )
    hook1 = bpy.context.active_object
    hook1.data.materials.append(create_material("Steel", (0.7, 0.1, 0.1)))

    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=hook_len,
        location=(position[0], position[1] - length / 2, position[2] + hook_len / 2),
        rotation=(0, math.radians(90), 0),
    )
    hook2 = bpy.context.active_object
    hook2.data.materials.append(create_material("Steel", (0.7, 0.1, 0.1)))

    return [bar, hook1, hook2]


def create_stirrups(length, width, height, dia=0.01, spacing=0.15):
    num_stirrups = int(length / spacing)
    stirrups = []
    for i in range(num_stirrups):
        y = -length / 2 + i * spacing
        bpy.ops.curve.primitive_bezier_circle_add(radius=1)
        curve = bpy.context.active_object
        curve.name = f"Stirrup_{i}"

        # Convert to mesh
        bpy.ops.object.convert(target="MESH")

        bpy.ops.object.editmode_toggle()
        bpy.ops.mesh.delete(type="ONLY_FACE")
        bpy.ops.object.editmode_toggle()

        # Scale to rectangular shape
        curve.scale = (width / 2 - 0.02, height / 2 - 0.02, 1)
        curve.location = (0, y, height / 2)
        curve.data.materials.append(create_material("Steel", (0.7, 0.1, 0.1)))
        stirrups.append(curve)
    return stirrups


def export_glb(filepath):
    abs_path = os.path.abspath(filepath)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=abs_path, export_format="GLB")
    print(f"🟢 Exported GLB: {abs_path}")


def main():
    args = parse_args()
    clear_scene()
    beam = create_concrete_beam(args.length, args.width, args.height)

    # Longitudinal rebars: 4 bars (2 top, 2 bottom)
    cover = 0.04
    bar_radius = 0.012
    z_bottom = bar_radius + cover
    z_top = args.height - cover - bar_radius
    y_positions = [-(args.length / 2) + 0.1, (args.length / 2) - 0.1]
    x_positions = [-(args.width / 2) + cover, (args.width / 2) - cover]

    for x in x_positions:
        for z in [z_bottom, z_top]:
            create_rebar(bar_radius, args.length - 0.2, (x, 0, z))

    # Stirrups
    create_stirrups(args.length - 0.1, args.width - 0.08, args.height - 0.08)

    export_glb(args.out)
    print("✅ Complex beam with reinforcement exported.")


if __name__ == "__main__":
    main()
