#!/usr/bin/env python3
"""Build the original SKYBREAK Kestrel aircraft and its delivery assets.

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-aircraft.py

The model is authored in Blender coordinates (X right, Z up, -Y forward).
The custom JSON exporter converts every evaluated vertex to Roblox coordinates:
    (x, y, z)_roblox = (x, z, y)_blender
This yields Roblox +Y up and -Z forward while preserving dimensions in studs.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "aircraft"
OUT.mkdir(parents=True, exist_ok=True)

BLEND_PATH = OUT / "kestrel.blend"
FBX_PATH = OUT / "kestrel.fbx"
GLB_PATH = OUT / "kestrel.glb"
JSON_PATH = OUT / "kestrel.mesh.json"
STATS_PATH = OUT / "kestrel.stats.json"
THREE_QUARTER_PATH = OUT / "kestrel-three-quarter.png"
TOP_PATH = OUT / "kestrel-top.png"

ASSET_COLLECTION = "Kestrel_Asset"
DISPLAY_COLLECTION = "Render_Set"


PALETTE = {
    "White": ((0.74, 0.82, 0.86, 1.0), 0.33, 0.62),
    "Navy": ((0.025, 0.060, 0.105, 1.0), 0.28, 0.72),
    "Cyan": ((0.00, 0.72, 0.88, 1.0), 0.25, 0.56),
    "Canopy": ((0.018, 0.20, 0.30, 1.0), 0.16, 0.48),
    "Gunmetal": ((0.055, 0.075, 0.095, 1.0), 0.22, 0.78),
    "Exhaust": ((0.18, 0.20, 0.22, 1.0), 0.20, 0.90),
    "Glow": ((0.00, 0.88, 1.00, 1.0), 0.20, 0.40),
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
        material = bpy.data.materials.new(name=f"Kestrel_{name}")
        material.diffuse_color = rgba
        material.roughness = roughness
        material.metallic = metallic
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if name == "Canopy":
            bsdf.inputs["Transmission Weight"].default_value = 0.32
            bsdf.inputs["Coat Weight"].default_value = 0.7
            bsdf.inputs["Coat Roughness"].default_value = 0.11
            material.diffuse_color = (*rgba[:3], 0.82)
        elif name == "Glow":
            bsdf.inputs["Emission Color"].default_value = rgba
            bsdf.inputs["Emission Strength"].default_value = 3.2
        result[name] = material
    return result


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> bpy.types.Object:
    for parent in list(obj.users_collection):
        parent.objects.unlink(obj)
    collection.objects.link(obj)
    obj["kestrel_asset"] = True
    return obj


def finish_object(
    obj: bpy.types.Object,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    bevel: float = 0.0,
    smooth: bool = False,
) -> bpy.types.Object:
    move_to_collection(obj, collection)
    obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new(name="Edge_Soften", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(24)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.data.set_sharp_from_angle(angle=math.radians(48))
    return obj


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
    obj["kestrel_asset"] = True
    obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new(name="Edge_Soften", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(24)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
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
        if rx <= 0.001 or rz <= 0.001:
            vertices.extend([(0.0, y, cz)] * sides)
            continue
        for i in range(sides):
            angle = (i / sides) * math.tau + phase
            sin_a = math.sin(angle)
            z_scale = squash_bottom if sin_a < 0 else 1.0
            vertices.append((math.cos(angle) * rx, y, cz + sin_a * rz * z_scale))
    faces: list[tuple[int, ...]] = []
    for ring in range(len(sections) - 1):
        current = ring * sides
        following = (ring + 1) * sides
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((current + i, current + j, following + j, following + i))
    faces.append(tuple(reversed(tuple(range(sides)))))
    end = (len(sections) - 1) * sides
    faces.append(tuple(end + i for i in range(sides)))
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
    """Extrude an XY outline between two Z planes."""
    count = len(outline_xy)
    vertices = [(x, y, z_bottom) for x, y in outline_xy] + [(x, y, z_top) for x, y in outline_xy]
    faces: list[tuple[int, ...]] = [tuple(reversed(range(count))), tuple(count + i for i in range(count))]
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, j, count + j, count + i))
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
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, j, count + j, count + i))
    return mesh_object(name, vertices, faces, collection, material, bevel=bevel)


def cylinder_between_y(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    vertices: int = 16,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=(math.pi / 2, 0, 0))
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
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=16,
        minor_segments=5,
        location=location,
        rotation=(math.pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    return finish_object(obj, collection, material, smooth=True)


def consolidate_by_material(asset_objects: list[bpy.types.Object]) -> list[bpy.types.Object]:
    """Join disconnected geometry into one delivery mesh per material."""
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in asset_objects:
        material = obj.data.materials[0]
        key = material.name.removeprefix("Kestrel_")
        groups.setdefault(key, []).append(obj)

    consolidated: list[bpy.types.Object] = []
    for key in sorted(groups):
        bpy.ops.object.select_all(action="DESELECT")
        group = groups[key]
        material = group[0].data.materials[0]
        for obj in group:
            obj.select_set(True)
        active = group[0]
        bpy.context.view_layer.objects.active = active
        if len(group) > 1:
            bpy.ops.object.join()
        active.name = f"Kestrel_{key}"
        active.data.name = f"Kestrel_{key}_Mesh"
        for polygon in active.data.polygons:
            polygon.material_index = 0
        active.data.materials.clear()
        active.data.materials.append(material)
        active["kestrel_asset"] = True
        consolidated.append(active)
    bpy.ops.object.select_all(action="DESELECT")
    return consolidated


def center_asset(asset_objects: list[bpy.types.Object]) -> None:
    """Place the combined world-space bounding-box center exactly at the origin."""
    bounds_min = Vector((math.inf, math.inf, math.inf))
    bounds_max = Vector((-math.inf, -math.inf, -math.inf))
    for obj in asset_objects:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                bounds_min[axis] = min(bounds_min[axis], point[axis])
                bounds_max[axis] = max(bounds_max[axis], point[axis])
    center = (bounds_min + bounds_max) * 0.5
    for obj in asset_objects:
        for vertex in obj.data.vertices:
            vertex.co -= center
        obj.data.update()


def build_aircraft(collection: bpy.types.Collection, mat: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
    # A smoothly tapered, faceted central body with a clear nose-to-tail read.
    loft(
        "Fuselage_White",
        [
            (-13.0, 0.03, 0.03, 0.05),
            (-12.4, 0.34, 0.27, 0.04),
            (-11.1, 0.82, 0.60, 0.03),
            (-9.2, 1.30, 0.88, 0.02),
            (-6.8, 1.72, 1.12, 0.03),
            (-3.4, 1.88, 1.26, 0.02),
            (0.2, 1.85, 1.24, 0.02),
            (3.8, 1.70, 1.13, 0.04),
            (7.6, 1.45, 0.96, 0.10),
            (10.6, 1.08, 0.70, 0.13),
            (12.5, 0.52, 0.40, 0.15),
            (13.0, 0.18, 0.18, 0.15),
        ],
        16,
        collection,
        mat["White"],
        squash_bottom=0.82,
        phase=math.pi / 16,
    )

    # Navy chine/underside is a distinct, very shallow arrow-shaped shell.
    prism(
        "Ventral_Navy",
        [(-0.82, -10.3), (-1.62, -4.7), (-1.55, 6.8), (-0.76, 11.4), (0.76, 11.4), (1.55, 6.8), (1.62, -4.7), (0.82, -10.3)],
        -1.02,
        -0.90,
        collection,
        mat["Navy"],
        bevel=0.05,
    )

    # Canopy uses its own low-poly loft, raised from the fuselage and pinched at both ends.
    canopy = loft(
        "Canopy_Tinted",
        [
            (-7.35, 0.08, 0.06, 0.78),
            (-6.65, 0.66, 0.42, 1.02),
            (-5.35, 0.94, 0.67, 1.12),
            (-3.20, 1.00, 0.76, 1.06),
            (-1.65, 0.70, 0.46, 0.92),
            (-0.85, 0.07, 0.05, 0.78),
        ],
        12,
        collection,
        mat["Canopy"],
        squash_bottom=0.22,
        phase=math.pi / 12,
    )
    canopy.data.materials.append(mat["Navy"])

    # A slim cyan canopy rail makes the silhouette readable at mobile camera distance.
    for side in (-1, 1):
        rail = prism(
            f"Canopy_Rail_{'L' if side < 0 else 'R'}",
            [(side * 0.74, -6.65), (side * 1.00, -5.20), (side * 0.80, -1.75), (side * 0.58, -2.00)],
            0.79,
            0.88,
            collection,
            mat["Cyan"],
            bevel=0.03,
        )
        rail.rotation_euler[1] = side * math.radians(2)

    # Broad clipped-delta wings, 22.8 studs tip-to-tip, with forward swept leading edges.
    left_wing = [(-1.28, -3.5), (-4.55, -2.2), (-11.40, 2.1), (-11.05, 3.65), (-4.10, 3.15), (-1.25, 5.2)]
    right_wing = [(-x, y) for x, y in left_wing]
    prism("Wing_L_White", left_wing, -0.22, 0.22, collection, mat["White"], bevel=0.10)
    prism("Wing_R_White", right_wing, -0.22, 0.22, collection, mat["White"], bevel=0.10)

    # Navy tips and cyan insets are separate, restrained graphics rather than decals.
    for side in (-1, 1):
        s = float(side)
        prism(
            f"Wingtip_{'L' if side < 0 else 'R'}_Navy",
            [(s * 11.39, 2.08), (s * 9.55, 3.24), (s * 9.30, 3.52), (s * 11.06, 3.64)],
            0.225,
            0.285,
            collection,
            mat["Navy"],
            bevel=0.025,
        )
        prism(
            f"Wing_Stripe_{'L' if side < 0 else 'R'}_Cyan",
            [(s * 4.25, -1.98), (s * 5.25, -1.35), (s * 8.15, 2.95), (s * 7.05, 2.89)],
            0.225,
            0.29,
            collection,
            mat["Cyan"],
            bevel=0.02,
        )

    # Shoulder fairings visually lock the wings and engines into the main body.
    for side in (-1, 1):
        s = float(side)
        lofted = loft(
            f"Shoulder_{'L' if side < 0 else 'R'}_Navy",
            [(-2.6, 0.35, 0.34, -0.16), (0.0, 0.72, 0.58, -0.08), (5.7, 0.80, 0.66, 0.0), (8.8, 0.56, 0.52, 0.02)],
            10,
            collection,
            mat["Navy"],
            squash_bottom=0.88,
        )
        lofted.location.x = s * 1.73

    # Twin engine nacelles, intake lips, exhaust rings, and recessed cyan cores.
    for side in (-1, 1):
        s = float(side)
        x = s * 2.15
        nacelle = loft(
            f"Engine_{'L' if side < 0 else 'R'}_Navy",
            [(1.6, 0.63, 0.61, -0.30), (2.1, 0.82, 0.78, -0.28), (7.8, 0.78, 0.74, -0.24), (10.8, 0.69, 0.67, -0.22), (11.5, 0.58, 0.57, -0.22)],
            14,
            collection,
            mat["Navy"],
            squash_bottom=0.92,
        )
        nacelle.location.x = x
        torus_y(f"Intake_Lip_{side}_Gunmetal", 0.69, 0.11, (x, 1.95, -0.28), collection, mat["Gunmetal"])
        cylinder_between_y(f"Intake_Dark_{side}", 0.55, 0.12, (x, 2.01, -0.28), collection, mat["Gunmetal"], vertices=16)
        torus_y(f"Exhaust_Ring_{side}", 0.58, 0.13, (x, 11.50, -0.22), collection, mat["Exhaust"])
        cylinder_between_y(f"Exhaust_Core_{side}", 0.43, 0.18, (x, 11.61, -0.22), collection, mat["Glow"], vertices=16)

    # Tailplanes are dark for strong separation from the white fuselage.
    left_tail = [(-0.75, 7.35), (-2.20, 7.2), (-5.25, 9.25), (-5.0, 10.15), (-1.10, 9.55)]
    right_tail = [(-x, y) for x, y in left_tail]
    prism("Tailplane_L_Navy", left_tail, 0.22, 0.51, collection, mat["Navy"], bevel=0.07)
    prism("Tailplane_R_Navy", right_tail, 0.22, 0.51, collection, mat["Navy"], bevel=0.07)

    # Twin outward-canted fins. The mesh is authored in YZ and tilted about Y.
    for side in (-1, 1):
        fin = vertical_prism(
            f"Fin_{'L' if side < 0 else 'R'}_White",
            [(6.15, 0.48), (7.0, 3.95), (9.15, 4.62), (10.25, 0.55)],
            -0.14,
            0.14,
            collection,
            mat["White"],
            bevel=0.07,
        )
        fin.location.x = side * 1.48
        fin.rotation_euler[1] = side * math.radians(14)
        stripe = vertical_prism(
            f"Fin_Stripe_{'L' if side < 0 else 'R'}_Cyan",
            [(8.35, 3.72), (9.12, 4.05), (9.52, 2.38), (8.83, 2.16)],
            -0.155,
            0.155,
            collection,
            mat["Cyan"],
            bevel=0.02,
        )
        stripe.location.x = side * 1.48
        stripe.rotation_euler[1] = side * math.radians(14)

    # Small dorsal sensor spine and nose sensor cap add polish without clutter.
    prism("Dorsal_Spine_Navy", [(-0.30, 0.4), (-0.40, 4.8), (0.40, 4.8), (0.30, 0.4)], 1.03, 1.26, collection, mat["Navy"], bevel=0.08)
    cylinder_between_y("Nose_Sensor_Cyan", 0.17, 0.22, (0.0, -12.82, 0.05), collection, mat["Cyan"], vertices=12)

    # Apply all modifiers/transforms so every delivered format and saved blend agree.
    asset_objects = [obj for obj in collection.objects if obj.type == "MESH"]
    bpy.context.view_layer.objects.active = None
    for obj in asset_objects:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)
    asset_objects = consolidate_by_material(asset_objects)
    center_asset(asset_objects)
    return asset_objects


def setup_render_scene(display: bpy.types.Collection) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"
    scene.world.color = (0.005, 0.012, 0.025)
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.004, 0.012, 0.027, 1.0)
    bg.inputs["Strength"].default_value = 0.22

    # A beveled presentation slab keeps the asset visually grounded without entering exports.
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=17.0, depth=0.45, location=(0, 1.2, -4.15))
    slab = bpy.context.object
    slab.name = "Presentation_Slab"
    for parent in list(slab.users_collection):
        parent.objects.unlink(slab)
    display.objects.link(slab)
    slab_mat = bpy.data.materials.new("Render_Slab")
    slab_mat.diffuse_color = (0.015, 0.032, 0.055, 1.0)
    slab_mat.metallic = 0.7
    slab_mat.roughness = 0.26
    slab.data.materials.append(slab_mat)
    bevel = slab.modifiers.new("Slab_Bevel", "BEVEL")
    bevel.width = 0.25
    bevel.segments = 3

    # Large soft key, cyan rim, and neutral fill.
    light_specs = [
        ("Key", (7.5, -12.0, 15.5), 1850.0, 7.0, (0.72, 0.86, 1.0)),
        ("Rim", (-10.0, 7.0, 8.0), 1500.0, 6.0, (0.08, 0.72, 1.0)),
        ("Fill", (8.0, 9.0, 5.0), 1050.0, 5.0, (1.0, 0.48, 0.22)),
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

    camera_data = bpy.data.cameras.new("Kestrel_Camera")
    camera = bpy.data.objects.new("Kestrel_Camera", camera_data)
    display.objects.link(camera)
    camera_data.lens = 53
    camera_data.sensor_width = 36
    scene.camera = camera


def track_to(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_views() -> None:
    scene = bpy.context.scene
    camera = scene.camera
    camera.location = (32.0, -37.0, 24.0)
    camera.data.lens = 56
    track_to(camera, Vector((0.0, 0.7, 0.15)))
    scene.render.filepath = str(THREE_QUARTER_PATH)
    bpy.ops.render.render(write_still=True)

    camera.location = (0.0, 0.0, 50.0)
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


def export_mesh_json(asset_objects: list[bpy.types.Object], materials: dict[str, bpy.types.Material]) -> dict:
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
            p = world @ vertex.co
            roblox = Vector((p.x, p.z, p.y))
            vertices.append([round(roblox.x, 6), round(roblox.y, 6), round(roblox.z, 6)])
            bounds_min.x = min(bounds_min.x, roblox.x)
            bounds_min.y = min(bounds_min.y, roblox.y)
            bounds_min.z = min(bounds_min.z, roblox.z)
            bounds_max.x = max(bounds_max.x, roblox.x)
            bounds_max.y = max(bounds_max.y, roblox.y)
            bounds_max.z = max(bounds_max.z, roblox.z)
        for polygon in mesh.polygons:
            material = obj.material_slots[polygon.material_index].material if obj.material_slots else None
            material_name = material.name.removeprefix("Kestrel_") if material else "White"
            # Swapping Blender Y/Z changes handedness, so reverse winding for Roblox.
            indices = [vertex_start + i for i in reversed(polygon.vertices)]
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

    material_records = []
    for name, material in materials.items():
        material_records.append(
            {
                "name": name,
                "baseColorRGBA": [round(value, 5) for value in material.diffuse_color],
                "metallic": round(float(material.metallic), 5),
                "roughness": round(float(material.roughness), 5),
            }
        )
    dimensions = bounds_max - bounds_min
    payload = {
        "schema": "skybreak.triangulated-mesh.v1",
        "asset": "SKYBREAK Kestrel",
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
            "dimensions": [round(value, 6) for value in dimensions],
        },
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

    # FBX applies the Blender-to-Roblox axis convention directly.
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


def validate_and_write_stats(payload: dict, asset_objects: list[bpy.types.Object]) -> dict:
    triangles = len(payload["faces"])
    dimensions = payload["bounds"]["dimensions"]
    bounds_min = payload["bounds"]["min"]
    bounds_max = payload["bounds"]["max"]
    bounds_center = [(low + high) * 0.5 for low, high in zip(bounds_min, bounds_max)]
    if not 1500 <= triangles <= 5000:
        raise RuntimeError(f"Triangle budget failed: {triangles} is outside 1500-5000")
    if not (25.5 <= dimensions[2] <= 26.5 and 22.5 <= dimensions[0] <= 23.5):
        raise RuntimeError(f"Dimension target failed: Roblox XYZ dimensions are {dimensions}")
    if any(abs(value) > 0.00001 for value in bounds_center):
        raise RuntimeError(f"Origin target failed: bounds center is {bounds_center}")
    stats = {
        "asset": "SKYBREAK Kestrel",
        "triangleCount": triangles,
        "vertexCount": len(payload["vertices"]),
        "meshPartCount": len(asset_objects),
        "materialCount": len(payload["materials"]),
        "robloxDimensionsXYZStuds": dimensions,
        "robloxBoundsCenterXYZStuds": bounds_center,
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
    asset_objects = build_aircraft(asset_collection, materials)
    setup_render_scene(display_collection)
    payload = export_mesh_json(asset_objects, materials)
    export_interchange(asset_objects)
    render_views()
    stats = validate_and_write_stats(payload, asset_objects)

    scene["kestrel_coordinate_transform"] = "Roblox(x,y,z)=Blender(x,z,y); +Y up, -Z forward"
    scene["kestrel_triangle_count"] = stats["triangleCount"]
    scene["kestrel_dimensions_xyz_studs"] = json.dumps(stats["robloxDimensionsXYZStuds"])
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)
    print("KESTREL_BUILD_COMPLETE")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"KESTREL_BUILD_FAILED: {exc}", file=sys.stderr)
        raise
