import subprocess
from pathlib import Path
from FloorplanToBlenderLib import IO, config, const, floorplan, execution


def convert_floorplan_to_glb(image_path: str, output_glb: str):
    BLENDER_PATH = (
        r"C:\blender-3.6.10-windows-x64\blender-3.6.10-windows-x64\blender.exe"
    )
    blender_exe = BLENDER_PATH
    program_dir = Path(__file__).parent
    blender_script = const.BLENDER_SCRIPT_PATH

    # Create temp FP config and execution data
    fp = floorplan.new_floorplan(default_conf := "./Configs/default.ini")
    fp.image_path = image_path
    data_path = execution.simple_single(fp)

    cmd = [
        blender_exe,
        "--background",
        "--python",
        blender_script,
        program_dir.as_posix(),
        output_glb,
        data_path,
    ]

    print("⏳ Running Blender Headless...")
    subprocess.check_call(cmd)
    print("✅ Done:", output_glb)

    return output_glb
