import bpy
import asyncio
import websockets
import json
import os


async def handle_client(websocket, path):
    async for message in websocket:
        try:
            data = json.loads(message)
            if data["type"] == "RENDER_REQUEST":
                script = data.get("script", "")
                output_path = r"C:\Users\HP\AppData\Local\Temp\render.png"
                script = script.replace(
                    "scene.render.engine = 'CYCLES'",
                    "scene.render.engine = 'BLENDER_EEVEE'",
                )
                script += f"\nscene.render.filepath = r'{output_path}'\nbpy.ops.render.render(write_still=True)"

                temp_script = r"C:\Users\HP\AppData\Local\Temp\temp_blender_render.py"
                with open(temp_script, "w") as f:
                    f.write(script)

                bpy.ops.wm.open_mainfile(filepath="")  # Clear scene
                exec(open(temp_script).read())

                await websocket.send(
                    json.dumps(
                        {
                            "status": "rendered",
                            "imageUrl": (
                                output_path if os.path.exists(output_path) else None
                            ),
                            "progress": 100,
                        }
                    )
                )

                os.remove(temp_script)
        except Exception as e:
            await websocket.send(json.dumps({"error": str(e)}))


async def start_server():
    print("Blender WebSocket server on ws://localhost:9999")
    server = await websockets.serve(handle_client, "localhost", 9999)
    await server.wait_closed()


asyncio.run(start_server())
