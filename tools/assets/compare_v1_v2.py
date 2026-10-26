"""Render v1 and v2 of both fighters from their exported FBX files with one camera.

    Blender --background --factory-startup --python tools/assets/compare_v1_v2.py

Writes ``assets/roblox-upload/v1-vs-v2.png``: rows Kestrel then Vanta, columns v1
then v2. Each model is fitted to its in-game length (Kestrel 26.0, Vanta 26.4
studs) and rendered with the same 3/4 camera, distance and lights, so the
images compare shape and finish at equal scale. Review evidence only; not uploaded.
"""

import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from skyasset import UPLOAD, look_at, reset  # noqa: E402

ROWS = [("kestrel", "kestrel-v2", 26.0), ("vanta", "vanta-v2", 26.4)]
TILE = 768
DIRECTION = Vector((-1.0, -1.25, 0.8)).normalized()
DISTANCE = 31.0


def load(folder: str, length: float):
    reset()
    bpy.ops.import_scene.fbx(filepath=str(UPLOAD / folder / f"{folder}.fbx"))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for o in meshes:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    k = length / max(hi - lo)
    center = (lo + hi) / 2
    root = bpy.data.objects.new("Fit", None)
    bpy.context.scene.collection.objects.link(root)
    for o in meshes:
        o.parent = root
        o.matrix_parent_inverse.identity()
    root.scale = (k, k, k)
    root.location = -center * k
    for o in meshes:
        if o.name.startswith("Canopy"):
            for slot in o.material_slots:
                mat = slot.material.copy()
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                bsdf.inputs["Alpha"].default_value = 0.55
                slot.material = mat


def render(path: Path) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = TILE
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("Compare")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.26, 0.27, 0.28, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    for name, energy, rot in (("Sun", 4.0, (50, 0, -35)), ("Fill", 1.2, (65, 0, 145))):
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.rotation_euler = tuple(math.radians(a) for a in rot)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50
    cam.location = DIRECTION * DISTANCE
    look_at(cam, Vector((0, 0, 0)))
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


tiles = []
tmp = Path(bpy.app.tempdir or "/tmp")
for row, (v1, v2, length) in enumerate(ROWS):
    for col, folder in enumerate((v1, v2)):
        load(folder, length)
        out = tmp / f"compare-{folder}.png"
        render(out)
        tiles.append(out)
sheet = np.ones((2 * TILE, 2 * TILE, 4), dtype=np.float32)
for i, path in enumerate(tiles):
    img = bpy.data.images.load(str(path))
    px = np.array(img.pixels[:], dtype=np.float32).reshape(TILE, TILE, 4)
    r, c = divmod(i, 2)
    # Blender pixel rows run bottom-up: the first row of tiles goes at the top.
    sheet[(1 - r) * TILE:(2 - r) * TILE, c * TILE:(c + 1) * TILE] = px
result = bpy.data.images.new("v1-vs-v2", 2 * TILE, 2 * TILE, alpha=False)
result.pixels[:] = sheet.ravel()
result.filepath_raw = str(UPLOAD / "v1-vs-v2.png")
result.file_format = "PNG"
result.save()
print("COMPARE_DONE", UPLOAD / "v1-vs-v2.png")
