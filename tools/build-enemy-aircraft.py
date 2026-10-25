#!/usr/bin/env python3
"""Build the original SKYBREAK VANTA enemy interceptor and delivery assets.

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-enemy-aircraft.py

The aircraft is authored in Blender coordinates (+X right, +Z up, -Y forward).
The JSON exporter converts to Roblox coordinates with (x, z, y), yielding +Y up
and -Z forward. The handedness change is paired with reversed triangle winding.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "aircraft"
OUT.mkdir(parents=True, exist_ok=True)

BLEND_PATH = OUT / "vanta.blend"
FBX_PATH = OUT / "vanta.fbx"
GLB_PATH = OUT / "vanta.glb"
JSON_PATH = OUT / "vanta.mesh.json"
STATS_PATH = OUT / "vanta.stats.json"
THREE_QUARTER_PATH = OUT / "vanta-three-quarter.png"
TOP_PATH = OUT / "vanta-top.png"

ASSET_COLLECTION = "Vanta_Asset"
DISPLAY_COLLECTION = "Vanta_Render_Set"
MATERIAL_KEYS = ("White", "Navy", "Cyan", "Canopy", "Gunmetal", "Exhaust", "Glow")

# Material keys intentionally match the existing runtime contract. The colors are
# VANTA-specific: "Cyan" is the interceptor's restrained red-orange recognition mark.
PALETTE = {
    "White": ((0.20, 0.17, 0.25, 1.0), 0.35, 0.70),
    "Navy": ((0.022, 0.018, 0.034, 1.0), 0.27, 0.76),
    "Cyan": ((0.88, 0.105, 0.025, 1.0), 0.26, 0.52),
    "Canopy": ((0.82, 0.31, 0.035, 1.0), 0.13, 0.42),
    "Gunmetal": ((0.075, 0.065, 0.085, 1.0), 0.20, 0.86),
    "Exhaust": ((0.24, 0.20, 0.25, 1.0), 0.24, 0.90),
    "Glow": ((1.0, 0.18, 0.025, 1.0), 0.17, 0.36),
}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            datablocks.remove(block)


def make_materials() -> dict[str, bpy.types.Material]:
    result: dict[str, bpy.types.Material] = {}
    for name, (rgba, roughness, metallic) in PALETTE.items():
        material = bpy.data.materials.new(name=f"Vanta_{name}")
        material.diffuse_color = rgba
        material.roughness = roughness
        material.metallic = metallic
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if name == "Canopy":
            bsdf.inputs["Transmission Weight"].default_value = 0.18
            bsdf.inputs["Coat Weight"].default_value = 0.82
            bsdf.inputs["Coat Roughness"].default_value = 0.08
            material.diffuse_color = (*rgba[:3], 0.90)
        elif name == "Glow":
            bsdf.inputs["Emission Color"].default_value = rgba
            bsdf.inputs["Emission Strength"].default_value = 4.5
        result[name] = material
    return result


def mesh_object(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    bevel: float = 0.0,
    smooth: bool = False,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=True)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj["vanta_asset"] = True
    obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new(name="Edge_Soften", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(22)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def finish_object(
    obj: bpy.types.Object,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    bevel: float = 0.0,
    smooth: bool = False,
) -> bpy.types.Object:
    for parent in list(obj.users_collection):
        parent.objects.unlink(obj)
    collection.objects.link(obj)
    obj["vanta_asset"] = True
    obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new(name="Edge_Soften", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(22)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.data.set_sharp_from_angle(angle=math.radians(46))
    return obj


def loft(
    name: str,
    sections: list[tuple[float, float, float, float]],
    sides: int,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    squash_bottom: float = 1.0,
    phase: float = 0.0,
) -> bpy.types.Object:
    """Create an elliptical ring loft. Sections are (Y, radius X, radius Z, center Z)."""
    vertices: list[tuple[float, float, float]] = []
    for y, rx, rz, cz in sections:
        for index in range(sides):
            angle = index / sides * math.tau + phase
            sin_angle = math.sin(angle)
            z_scale = squash_bottom if sin_angle < 0 else 1.0
            vertices.append((math.cos(angle) * rx, y, cz + sin_angle * rz * z_scale))
    faces: list[tuple[int, ...]] = []
    for ring in range(len(sections) - 1):
        current = ring * sides
        following = (ring + 1) * sides
        for index in range(sides):
            next_index = (index + 1) % sides
            faces.append((current + index, current + next_index, following + next_index, following + index))
    faces.append(tuple(reversed(range(sides))))
    end = (len(sections) - 1) * sides
    faces.append(tuple(end + index for index in range(sides)))
    return mesh_object(name, vertices, faces, collection, material, smooth=True)


def prism(
    name: str,
    outline_xy: list[tuple[float, float]],
    z_bottom: float,
    z_top: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    bevel: float = 0.0,
) -> bpy.types.Object:
    count = len(outline_xy)
    vertices = [(x, y, z_bottom) for x, y in outline_xy] + [(x, y, z_top) for x, y in outline_xy]
    faces: list[tuple[int, ...]] = [tuple(reversed(range(count))), tuple(count + i for i in range(count))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    return mesh_object(name, vertices, faces, collection, material, bevel=bevel)


def vertical_prism(
    name: str,
    outline_yz: list[tuple[float, float]],
    x_bottom: float,
    x_top: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    bevel: float = 0.0,
) -> bpy.types.Object:
    count = len(outline_yz)
    vertices = [(x_bottom, y, z) for y, z in outline_yz] + [(x_top, y, z) for y, z in outline_yz]
    faces: list[tuple[int, ...]] = [tuple(reversed(range(count))), tuple(count + i for i in range(count))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    return mesh_object(name, vertices, faces, collection, material, bevel=bevel)


def cylinder_y(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    vertices: int = 18,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=(math.pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    return finish_object(obj, collection, material, bevel=bevel, smooth=True)


def torus_y(
    name: str,
    major_radius: float,
    minor_radius: float,
    location: tuple[float, float, float],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    major_segments: int = 20,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=6,
        location=location,
        rotation=(math.pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    return finish_object(obj, collection, material, smooth=True)


def apply_and_consolidate(collection: bpy.types.Collection) -> list[bpy.types.Object]:
    source = [obj for obj in collection.objects if obj.type == "MESH"]
    for obj in source:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)

    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in source:
        key = obj.data.materials[0].name.removeprefix("Vanta_")
        groups.setdefault(key, []).append(obj)

    consolidated: list[bpy.types.Object] = []
    for key in MATERIAL_KEYS:
        group = groups[key]
        bpy.ops.object.select_all(action="DESELECT")
        for obj in group:
            obj.select_set(True)
        active = group[0]
        bpy.context.view_layer.objects.active = active
        if len(group) > 1:
            bpy.ops.object.join()
        active.name = f"Vanta_{key}"
        active.data.name = f"Vanta_{key}_Mesh"
        material = active.data.materials[0]
        active.data.materials.clear()
        active.data.materials.append(material)
        for polygon in active.data.polygons:
            polygon.material_index = 0
        active["vanta_asset"] = True
        consolidated.append(active)
    bpy.ops.object.select_all(action="DESELECT")
    return consolidated


def center_asset(asset_objects: list[bpy.types.Object]) -> Vector:
    bounds_min, bounds_max = world_bounds(asset_objects)
    center = (bounds_min + bounds_max) * 0.5
    for obj in asset_objects:
        for vertex in obj.data.vertices:
            vertex.co -= center
        obj.data.update()
    return center


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    bounds_min = Vector((math.inf, math.inf, math.inf))
    bounds_max = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                bounds_min[axis] = min(bounds_min[axis], point[axis])
                bounds_max[axis] = max(bounds_max[axis], point[axis])
    return bounds_min, bounds_max


def build_aircraft(
    collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]
) -> tuple[list[bpy.types.Object], dict[str, list[float]]]:
    # Low, predatory central wedge. Its clipped facets read very differently from
    # Kestrel's pale tubular body, while the small radii avoid degenerate tips.
    loft(
        "Vanta_Core",
        [
            (-13.25, 0.05, 0.04, -0.08),
            (-12.35, 0.52, 0.26, -0.07),
            (-10.6, 1.18, 0.53, -0.03),
            (-7.7, 1.67, 0.73, 0.00),
            (-4.2, 2.04, 0.83, 0.03),
            (-0.4, 2.24, 0.88, 0.05),
            (3.8, 2.05, 0.84, 0.06),
            (7.6, 1.73, 0.76, 0.03),
            (10.5, 1.44, 0.67, 0.00),
            (12.45, 1.10, 0.54, -0.03),
            (13.15, 0.72, 0.38, -0.04),
        ],
        18,
        collection,
        materials["Navy"],
        squash_bottom=0.70,
        phase=math.pi / 18,
    )

    # A raised angular dorsal carapace gives a purple armored spine.
    prism(
        "Dorsal_Carapace",
        [(-1.14, -8.7), (-1.72, -4.2), (-1.58, 5.9), (-0.92, 9.3), (0.92, 9.3), (1.58, 5.9), (1.72, -4.2), (1.14, -8.7)],
        0.55,
        0.90,
        collection,
        materials["White"],
        bevel=0.09,
    )

    # Amber faceted canopy, compact and forward-set like an interceptor.
    loft(
        "Amber_Canopy",
        [
            (-9.15, 0.08, 0.05, 0.56),
            (-8.45, 0.61, 0.34, 0.73),
            (-7.05, 0.91, 0.55, 0.82),
            (-5.25, 0.90, 0.58, 0.80),
            (-3.85, 0.58, 0.32, 0.67),
            (-3.25, 0.08, 0.05, 0.56),
        ],
        14,
        collection,
        materials["Canopy"],
        squash_bottom=0.30,
        phase=math.pi / 14,
    )
    prism(
        "Canopy_Collar",
        [(-1.03, -8.85), (-1.16, -3.55), (-0.72, -2.92), (0.72, -2.92), (1.16, -3.55), (1.03, -8.85)],
        0.48,
        0.59,
        collection,
        materials["Gunmetal"],
        bevel=0.04,
    )

    # Broad cranked-delta wings create the VANTA's primary recognition silhouette.
    left_wing = [
        (-1.22, -5.15),
        (-4.55, -4.05),
        (-8.05, -1.45),
        (-12.20, 2.35),
        (-12.02, 3.85),
        (-7.05, 4.95),
        (-2.15, 8.25),
        (-1.28, 7.45),
    ]
    right_wing = [(-x, y) for x, y in left_wing]
    prism("Cranked_Delta_L", left_wing, -0.20, 0.23, collection, materials["Navy"], bevel=0.10)
    prism("Cranked_Delta_R", right_wing, -0.20, 0.23, collection, materials["Navy"], bevel=0.10)

    # Purple armor panels emphasize the inner crank; orange chevrons remain restrained.
    for side in (-1, 1):
        s = float(side)
        prism(
            f"Wing_Armor_{side}",
            [(s * 1.75, -3.95), (s * 4.45, -3.05), (s * 8.45, 0.45), (s * 6.20, 3.85), (s * 2.15, 5.95)],
            0.235,
            0.40,
            collection,
            materials["White"],
            bevel=0.07,
        )
        prism(
            f"Wing_Chevron_{side}",
            [(s * 7.85, 0.22), (s * 9.65, 1.72), (s * 11.55, 2.70), (s * 11.47, 3.16), (s * 9.05, 2.52)],
            0.405,
            0.49,
            collection,
            materials["Cyan"],
            bevel=0.025,
        )
        prism(
            f"Wingtip_Cap_{side}",
            [(s * 11.50, 2.05), (s * 12.19, 2.35), (s * 12.01, 3.84), (s * 11.34, 3.69)],
            -0.21,
            0.28,
            collection,
            materials["Gunmetal"],
            bevel=0.035,
        )

    # Short forward canards sharpen pitch-axis readability without becoming tailplanes.
    left_canard = [(-0.90, -8.85), (-2.05, -8.58), (-5.35, -6.65), (-5.05, -5.82), (-1.05, -6.75)]
    right_canard = [(-x, y) for x, y in left_canard]
    prism("Canard_L", left_canard, 0.18, 0.43, collection, materials["White"], bevel=0.07)
    prism("Canard_R", right_canard, 0.18, 0.43, collection, materials["White"], bevel=0.07)

    # Deep ventral intake and one centerline engine/nozzle: never mistaken for Kestrel's twins.
    prism(
        "Ventral_Intake_Housing",
        [(-1.30, -1.8), (-1.66, 0.0), (-1.72, 5.5), (-1.22, 7.8), (1.22, 7.8), (1.72, 5.5), (1.66, 0.0), (1.30, -1.8)],
        -0.98,
        -0.48,
        collection,
        materials["Gunmetal"],
        bevel=0.09,
    )
    torus_y("Single_Engine_Shroud", 1.15, 0.18, (0.0, 11.95, -0.08), collection, materials["Exhaust"], 22)
    cylinder_y("Single_Engine_Recess", 0.93, 0.24, (0.0, 12.06, -0.08), collection, materials["Gunmetal"], 22)
    cylinder_y("Single_Engine_Glow", 0.73, 0.28, (0.0, 12.22, -0.08), collection, materials["Glow"], 22, bevel=0.035)
    # Four short petals add mechanical detail to the oversized single nozzle.
    for side in (-1, 1):
        s = float(side)
        prism(
            f"Nozzle_Petal_X_{side}",
            [(s * 0.22, 11.82), (s * 0.79, 11.91), (s * 0.70, 12.42), (s * 0.18, 12.49)],
            -0.75,
            -0.62,
            collection,
            materials["Exhaust"],
            bevel=0.025,
        )

    # One swept center fin, canted eight degrees starboard. Its single-fin read is
    # deliberately incompatible with the Kestrel's paired vertical tails.
    fin = vertical_prism(
        "Single_Canted_Fin",
        [(5.55, 0.55), (7.05, 3.78), (9.55, 5.20), (11.05, 0.52)],
        -0.16,
        0.16,
        collection,
        materials["White"],
        bevel=0.075,
    )
    fin.rotation_euler[1] = math.radians(8)
    fin_stripe = vertical_prism(
        "Fin_Orange_Identifier",
        [(8.20, 3.64), (9.50, 4.44), (10.18, 2.08), (9.02, 1.72)],
        -0.175,
        0.175,
        collection,
        materials["Cyan"],
        bevel=0.025,
    )
    fin_stripe.rotation_euler[1] = math.radians(8)

    # Small orange nose blade and spine lights reinforce faction color at game distance.
    prism(
        "Nose_Identifier",
        [(-0.14, -13.19), (-0.32, -11.15), (-0.18, -9.85), (0.18, -9.85), (0.32, -11.15), (0.14, -13.19)],
        0.18,
        0.31,
        collection,
        materials["Cyan"],
        bevel=0.025,
    )
    for y in (1.2, 3.0, 4.8):
        prism(
            f"Dorsal_Glow_{y}",
            [(-0.12, y - 0.34), (-0.16, y + 0.34), (0.16, y + 0.34), (0.12, y - 0.34)],
            0.91,
            0.99,
            collection,
            materials["Glow"],
            bevel=0.018,
        )

    asset_objects = apply_and_consolidate(collection)
    center = center_asset(asset_objects)

    def attachment(author_x: float, author_y: float, author_z: float) -> list[float]:
        # Blender centered point -> Roblox (x, z, y).
        centered = Vector((author_x, author_y, author_z)) - center
        return [round(centered.x, 6), round(centered.z, 6), round(centered.y, 6)]

    attachments = {
        "leftWingtip": attachment(-12.16, 3.10, 0.04),
        "rightWingtip": attachment(12.16, 3.10, 0.04),
        "exhaust": attachment(0.0, 12.50, -0.08),
    }
    return asset_objects, attachments


def track_to(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_render_scene(display: bpy.types.Collection) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.world.color = (0.006, 0.004, 0.012)
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.006, 0.003, 0.014, 1.0)
    background.inputs["Strength"].default_value = 0.18

    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=17.2, depth=0.45, location=(0, 1.0, -4.15))
    slab = bpy.context.object
    slab.name = "Vanta_Presentation_Slab"
    for parent in list(slab.users_collection):
        parent.objects.unlink(slab)
    display.objects.link(slab)
    slab_material = bpy.data.materials.new("Vanta_Render_Slab")
    slab_material.diffuse_color = (0.018, 0.010, 0.030, 1.0)
    slab_material.metallic = 0.72
    slab_material.roughness = 0.25
    slab.data.materials.append(slab_material)
    bevel = slab.modifiers.new("Slab_Bevel", "BEVEL")
    bevel.width = 0.25
    bevel.segments = 3

    light_specs = [
        ("Vanta_Key", (8.0, -12.0, 15.5), 2050.0, 7.0, (0.76, 0.70, 1.0)),
        ("Vanta_Rim", (-11.0, 7.5, 8.0), 1750.0, 6.0, (0.58, 0.12, 1.0)),
        ("Vanta_Fill", (9.0, 10.0, 5.0), 1250.0, 5.0, (1.0, 0.18, 0.055)),
    ]
    for name, location, energy, size, color in light_specs:
        data = bpy.data.lights.new(name=name, type="AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        display.objects.link(light)
        light.location = location
        track_to(light, Vector((0, 0, 0)))

    camera_data = bpy.data.cameras.new("Vanta_Camera")
    camera = bpy.data.objects.new("Vanta_Camera", camera_data)
    display.objects.link(camera)
    scene.camera = camera


def render_views() -> None:
    scene = bpy.context.scene
    camera = scene.camera
    camera.location = (32.5, -39.0, 25.0)
    camera.data.lens = 57
    track_to(camera, Vector((0.0, 0.4, 0.10)))
    scene.render.filepath = str(THREE_QUARTER_PATH)
    bpy.ops.render.render(write_still=True)

    camera.location = (0.0, 0.0, 49.0)
    camera.data.lens = 46
    track_to(camera, Vector((0.0, 0.0, 0.0)))
    scene.render.filepath = str(TOP_PATH)
    bpy.ops.render.render(write_still=True)


def evaluated_triangles(asset_objects: list[bpy.types.Object]):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in asset_objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        yield obj, evaluated, mesh
        evaluated.to_mesh_clear()


def export_mesh_json(
    asset_objects: list[bpy.types.Object], materials: dict[str, bpy.types.Material], attachments: dict[str, list[float]]
) -> dict:
    vertices: list[list[float]] = []
    faces: list[dict] = []
    parts: list[dict] = []
    bounds_min = Vector((math.inf, math.inf, math.inf))
    bounds_max = Vector((-math.inf, -math.inf, -math.inf))

    for obj, evaluated, mesh in evaluated_triangles(asset_objects):
        vertex_start = len(vertices)
        face_start = len(faces)
        world = evaluated.matrix_world
        normal_matrix = world.to_3x3().inverted().transposed()
        for vertex in mesh.vertices:
            point = world @ vertex.co
            roblox = Vector((point.x, point.z, point.y))
            vertices.append([round(roblox.x, 6), round(roblox.y, 6), round(roblox.z, 6)])
            for axis in range(3):
                bounds_min[axis] = min(bounds_min[axis], roblox[axis])
                bounds_max[axis] = max(bounds_max[axis], roblox[axis])
        for polygon in mesh.polygons:
            material = obj.material_slots[polygon.material_index].material if obj.material_slots else None
            material_name = material.name.removeprefix("Vanta_") if material else "White"
            indices = [vertex_start + index for index in reversed(polygon.vertices)]
            normals = []
            for loop_index in reversed(polygon.loop_indices):
                source_normal = normal_matrix @ mesh.corner_normals[loop_index].vector
                roblox_normal = Vector((source_normal.x, source_normal.z, source_normal.y)).normalized()
                normals.append([round(roblox_normal.x, 6), round(roblox_normal.y, 6), round(roblox_normal.z, 6)])
            faces.append({"indices": indices, "normals": normals, "material": material_name, "part": obj.name})
        parts.append(
            {
                "name": obj.name,
                "vertexStart": vertex_start,
                "vertexCount": len(mesh.vertices),
                "faceStart": face_start,
                "faceCount": len(mesh.polygons),
            }
        )

    material_records = [
        {
            "name": name,
            "baseColorRGBA": [round(value, 5) for value in materials[name].diffuse_color],
            "metallic": round(float(materials[name].metallic), 5),
            "roughness": round(float(materials[name].roughness), 5),
        }
        for name in MATERIAL_KEYS
    ]
    payload = {
        "schema": "skybreak.triangulated-mesh.v1",
        "asset": "SKYBREAK Vanta",
        "familyLabels": ["VANTA01", "VANTA02", "VANTA03"],
        "units": "studs",
        "coordinateSystem": {
            "source": "Blender right-handed: +X right, +Z up, -Y forward",
            "target": "Roblox: +X right, +Y up, -Z forward",
            "vertexTransform": "roblox(x,y,z) = blender(x,z,y)",
            "normalTransform": "roblox(nx,ny,nz) = normalize(blender(nx,nz,ny))",
            "matrixRowMajor": [[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]],
            "winding": "triangle winding reversed after handedness conversion",
        },
        "bounds": {
            "min": [round(value, 6) for value in bounds_min],
            "max": [round(value, 6) for value in bounds_max],
            "dimensions": [round(value, 6) for value in bounds_max - bounds_min],
        },
        "attachments": attachments,
        "materials": material_records,
        "parts": parts,
        "vertices": vertices,
        "faces": faces,
    }
    JSON_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def export_interchange(asset_objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in asset_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = asset_objects[0]
    bpy.ops.export_scene.fbx(
        filepath=str(FBX_PATH),
        use_selection=True,
        object_types={"MESH"},
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        add_leaf_bones=False,
        bake_anim=False,
        axis_forward="-Z",
        axis_up="Y",
        apply_unit_scale=True,
        use_space_transform=True,
        bake_space_transform=True,
    )
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    bpy.ops.object.select_all(action="DESELECT")


def import_roundtrip(filepath: Path, format_name: str) -> dict:
    before = set(bpy.data.objects)
    bpy.ops.object.select_all(action="DESELECT")
    if format_name == "FBX":
        if hasattr(bpy.ops.import_scene, "fbx"):
            bpy.ops.import_scene.fbx(filepath=str(filepath))
        else:
            bpy.ops.wm.fbx_import(filepath=str(filepath))
    elif format_name == "GLB":
        bpy.ops.import_scene.gltf(filepath=str(filepath))
    else:
        raise ValueError(format_name)
    imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if not imported:
        raise RuntimeError(f"{format_name} round trip imported no mesh objects")
    bounds_min, bounds_max = world_bounds(imported)
    dimensions = bounds_max - bounds_min
    record = {
        "meshObjectCount": len(imported),
        "dimensionsXYZ": [round(value, 6) for value in dimensions],
    }
    bpy.data.batch_remove(imported)
    return record


def validate_payload(payload: dict) -> dict:
    triangles = len(payload["faces"])
    vertices = payload["vertices"]
    dimensions = payload["bounds"]["dimensions"]
    bounds_min = payload["bounds"]["min"]
    bounds_max = payload["bounds"]["max"]
    bounds_center = [(low + high) * 0.5 for low, high in zip(bounds_min, bounds_max)]
    if not 2500 <= triangles <= 4500:
        raise RuntimeError(f"Triangle budget failed: {triangles} is outside 2500-4500")
    if not (22.0 <= dimensions[0] <= 26.0 and 24.0 <= dimensions[2] <= 28.0):
        raise RuntimeError(f"Dimension target failed: Roblox XYZ dimensions are {dimensions}")
    if any(abs(value) > 0.00001 for value in bounds_center):
        raise RuntimeError(f"Origin target failed: bounds center is {bounds_center}")
    if [item["name"] for item in payload["materials"]] != list(MATERIAL_KEYS):
        raise RuntimeError("Material contract failed")
    if set(payload["attachments"]) != {"leftWingtip", "rightWingtip", "exhaust"}:
        raise RuntimeError("Attachment contract failed")

    # Verify every triangle's transformed winding agrees with its exported normals.
    minimum_alignment = 1.0
    for face in payload["faces"]:
        a, b, c = (Vector(vertices[index]) for index in face["indices"])
        geometric = (b - a).cross(c - a)
        if geometric.length < 1e-9:
            raise RuntimeError(f"Degenerate exported triangle in {face['part']}")
        geometric.normalize()
        average_normal = Vector((0.0, 0.0, 0.0))
        for normal in face["normals"]:
            average_normal += Vector(normal)
        if average_normal.length < 1e-9:
            raise RuntimeError(f"Zero exported normal in {face['part']}")
        average_normal.normalize()
        alignment = geometric.dot(average_normal)
        minimum_alignment = min(minimum_alignment, alignment)
        if alignment <= 0.02:
            raise RuntimeError(f"Winding/normal mismatch ({alignment:.4f}) in {face['part']}")

    return {
        "triangleCount": triangles,
        "vertexCount": len(vertices),
        "boundsCenter": bounds_center,
        "minimumWindingNormalDot": round(minimum_alignment, 6),
    }


def validate_roundtrips(source_dimensions: list[float]) -> dict:
    records = {
        "fbx": import_roundtrip(FBX_PATH, "FBX"),
        "glb": import_roundtrip(GLB_PATH, "GLB"),
    }
    # Importers restore Blender axes. Sorted dimensions avoid axis-order assumptions
    # while still proving geometry scale and extents survive each interchange format.
    expected = sorted(source_dimensions)
    for name, record in records.items():
        actual = sorted(record["dimensionsXYZ"])
        if any(abs(a - b) > 0.03 for a, b in zip(expected, actual)):
            raise RuntimeError(f"{name.upper()} round-trip bounds mismatch: {actual} vs {expected}")
        record["boundsMatchWithinStuds"] = 0.03
    return records


def write_stats(payload: dict, asset_objects: list[bpy.types.Object], validation: dict, roundtrips: dict) -> dict:
    stats = {
        "asset": "SKYBREAK Vanta",
        "familyLabels": ["VANTA01", "VANTA02", "VANTA03"],
        "triangleCount": validation["triangleCount"],
        "vertexCount": validation["vertexCount"],
        "meshPartCount": len(asset_objects),
        "materialCount": len(payload["materials"]),
        "robloxDimensionsXYZStuds": payload["bounds"]["dimensions"],
        "robloxBoundsCenterXYZStuds": validation["boundsCenter"],
        "attachmentsRobloxXYZStuds": payload["attachments"],
        "minimumWindingNormalDot": validation["minimumWindingNormalDot"],
        "roundTripValidation": roundtrips,
        "forward": "Roblox -Z",
        "up": "Roblox +Y",
        "exports": {
            "blend": BLEND_PATH.relative_to(ROOT).as_posix(),
            "fbx": FBX_PATH.relative_to(ROOT).as_posix(),
            "glb": GLB_PATH.relative_to(ROOT).as_posix(),
            "meshJson": JSON_PATH.relative_to(ROOT).as_posix(),
            "threeQuarterRender": THREE_QUARTER_PATH.relative_to(ROOT).as_posix(),
            "topRender": TOP_PATH.relative_to(ROOT).as_posix(),
        },
    }
    STATS_PATH.write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")
    return stats


def main() -> None:
    backup_path = Path(f"{BLEND_PATH}1")
    if backup_path.exists():
        backup_path.unlink()
    reset_scene()
    scene = bpy.context.scene
    scene.unit_settings.system = "NONE"
    scene.unit_settings.scale_length = 1.0

    asset_collection = bpy.data.collections.new(ASSET_COLLECTION)
    display_collection = bpy.data.collections.new(DISPLAY_COLLECTION)
    scene.collection.children.link(asset_collection)
    scene.collection.children.link(display_collection)
    materials = make_materials()
    asset_objects, attachments = build_aircraft(asset_collection, materials)
    setup_render_scene(display_collection)
    payload = export_mesh_json(asset_objects, materials, attachments)
    validation = validate_payload(payload)
    export_interchange(asset_objects)
    roundtrips = validate_roundtrips(payload["bounds"]["dimensions"])
    render_views()
    stats = write_stats(payload, asset_objects, validation, roundtrips)

    scene["vanta_coordinate_transform"] = "Roblox(x,y,z)=Blender(x,z,y); +Y up, -Z forward"
    scene["vanta_triangle_count"] = stats["triangleCount"]
    scene["vanta_dimensions_xyz_studs"] = json.dumps(stats["robloxDimensionsXYZStuds"])
    scene["vanta_attachments_xyz_studs"] = json.dumps(stats["attachmentsRobloxXYZStuds"])
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)
    print("VANTA_BUILD_COMPLETE")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"VANTA_BUILD_FAILED: {exc}", file=sys.stderr)
        raise
