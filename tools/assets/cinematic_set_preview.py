"""Review aid: the four cutscene desk props, imported from their exact exported FBX files and
seated by their checklist anchors around a plain desk stand-in, rendered from the cutscene's
radio, recorder and wide-shot directions. Writes only to the output folder given (never into
assets/roblox-upload, so the hashed review packs are untouched).

    Blender --background --factory-startup --python tools/assets/cinematic_set_preview.py -- docs/qa/cutscenes/<date>
"""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
UPLOAD = ROOT / "assets" / "roblox-upload"
out = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
out.mkdir(parents=True, exist_ok=True)


def blender(v):
    """Roblox (x, y, z) to Blender (-x, z, y): the export and import only rotate."""
    return Vector((-v[0], v[2], v[1]))


# Desk-relative targets from CinematicStaging / CinematicSet (Roblox studs) and each prop's anchor.
PROPS = {
    "cinematic-radio-console": ((0, 7, 0), "Body", 0.0),
    "cinematic-field-recorder": ((-5.5, 5.5, 1.6), "Centre", -0.35),
    "cinematic-tape-tin": ((-5.2, 5.85, -2.6), "Centre", 0.0),
    "cinematic-status-board": ((12.5, 7.6, 2.5), "Board", 0.0),
}
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
for folder, (target, anchor_name, yaw) in PROPS.items():
    c = json.loads((UPLOAD / folder / "checklist.json").read_text())
    before = set(scene.objects)
    bpy.ops.import_scene.fbx(filepath=str(UPLOAD / folder / c["fbx"]["file"]))
    k = 1.0 / c.get("fbxMetresPerStud", 0.28)
    anchor = blender(c["anchors"][anchor_name])
    # Roblox yaw about +Y is a Blender rotation about +Z of the same sign after the x flip and y/z swap.
    place = Matrix.Translation(blender(target)) @ Matrix.Rotation(-yaw, 4, "Z") @ Matrix.Translation(-anchor)
    for o in set(scene.objects) - before:
        if o.parent is None:
            o.matrix_world = place @ Matrix.Scale(k, 4) @ o.matrix_world


def box(name, size, loc, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*color, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
    o.data.materials.append(m)


# Plain stand-ins (not part of any upload): the desk top at 5 studs and a ground plane.
box("Desk stand-in", (16, 9, 0.35), (0, 0, 4.825), (0.32, 0.22, 0.16))
for x in (-7.4, 7.4):
    for y in (-4, 4):
        box("Desk leg", (0.6, 0.6, 4.65), (x, y, 2.325), (0.25, 0.17, 0.12))
box("Ground stand-in", (80, 80, 0.1), (0, 0, -0.05), (0.18, 0.19, 0.2))

world = bpy.data.worlds.new("Preview")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.42, 0.47, 0.52, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
for name, energy, rot in (("Key", 3.5, (50, 0, -35)), ("Fill", 1.0, (65, 0, 145))):
    data = bpy.data.lights.new(name, "SUN")
    data.energy = energy
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.rotation_euler = tuple(math.radians(v) for v in rot)
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.view_settings.view_transform = "AgX"
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
# Eye/focus pairs from CinematicStaging.shotPose at alpha 0.5 (Roblox desk-relative studs).
SHOTS = {
    "desk-set-radio-shot": ((-8, 12, -19), (0, 7, 0), 55),
    "desk-set-recorder-shot": ((-9.65, 8.9, 8.05), (-5.3, 5.6, 1.4), 34),
    "desk-set-wide-shot": ((35.5, 19, 34.5), (-6, 7, -20), 55),
    "desk-set-board-front": ((6, 8, -14), (10, 6.5, 2), 50),
}
for name, (eye, focus, fov) in SHOTS.items():
    cam.location = blender(eye)
    cam.rotation_euler = (blender(focus) - blender(eye)).to_track_quat("-Z", "Y").to_euler()
    cam.data.sensor_fit = "VERTICAL"
    cam.data.angle = math.radians(fov)
    scene.render.filepath = str(out / f"{name}.png")
    bpy.ops.render.render(write_still=True)
print("SET_PREVIEW_DONE", out)
