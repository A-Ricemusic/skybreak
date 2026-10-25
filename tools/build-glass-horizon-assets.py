#!/usr/bin/env python3
"""Author the GLASS HORIZON reusable scenery/target assets.

Three target archetypes are produced here. All of them follow the existing
mission-asset pipeline: Blender authored → consolidated per material role →
triangulated → coordinate swap to Roblox → mesh JSON on disk.

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-glass-horizon-assets.py

Blender coordinates are X right, Z up, and -Y forward. The exporter maps
Blender ``(x, y, z)`` to Roblox ``(x, z, y)`` and reverses triangle winding so
the +Y-up / -Z-forward Roblox engine renders faces correctly.

Each asset stays well under the 5,000 triangle mobile mission-asset budget and
uses only the shared seven material roles (Concrete/Steel/DarkMetal/Accent/
Roof/Glass/Warning). None of them require image textures or uploaded Roblox
asset IDs.
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import bpy
import bmesh
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "mission"
OUT.mkdir(parents=True, exist_ok=True)


# Role → (baseColorRGBA, roughness, metallic). Keep identical palette to the
# existing mission-asset generator so MissionAssets can reuse one material map.
MATERIALS = {
    "Concrete": ((0.29, 0.32, 0.31, 1.0), 0.86, 0.02),
    "Steel": ((0.31, 0.38, 0.40, 1.0), 0.50, 0.55),
    "DarkMetal": ((0.075, 0.095, 0.10, 1.0), 0.35, 0.72),
    "Accent": ((0.73, 0.19, 0.075, 1.0), 0.44, 0.34),
    "Roof": ((0.22, 0.27, 0.27, 1.0), 0.62, 0.50),
    "Glass": ((0.055, 0.22, 0.25, 0.86), 0.16, 0.12),
    "Warning": ((0.96, 0.57, 0.055, 1.0), 0.38, 0.20),
}


@dataclass(frozen=True)
class AssetSpec:
    slug: str
    title: str
    build: Callable[[bpy.types.Collection, dict[str, bpy.types.Material]], None]
    triangle_min: int
    dimension_ranges: tuple[tuple[float, float], tuple[float, float], tuple[float, float]]
    camera: tuple[float, float, float]


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.collections,
    ):
        for block in list(blocks):
            if isinstance(block, bpy.types.Collection) and block == bpy.context.scene.collection:
                continue
            blocks.remove(block)


def make_materials(slug: str) -> dict[str, bpy.types.Material]:
    result: dict[str, bpy.types.Material] = {}
    for role, (rgba, roughness, metallic) in MATERIALS.items():
        material = bpy.data.materials.new(f"{slug}_{role}")
        material.diffuse_color = rgba
        material.roughness = roughness
        material.metallic = metallic
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if role == "Glass":
            bsdf.inputs["Transmission Weight"].default_value = 0.28
            bsdf.inputs["Coat Weight"].default_value = 0.55
        result[role] = material
    return result


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for parent in list(obj.users_collection):
        parent.objects.unlink(obj)
    collection.objects.link(obj)
    obj["glass_horizon_asset"] = True


def finish(
    obj: bpy.types.Object,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    *,
    bevel: float = 0.0,
    smooth: bool = False,
) -> bpy.types.Object:
    move_to_collection(obj, collection)
    obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new("Edge_Soften", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(28)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.data.set_sharp_from_angle(angle=math.radians(48))
    return obj


def box(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    *,
    bevel: float = 0.0,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.scale = size
    return finish(obj, collection, material, bevel=bevel)


def cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    *,
    vertices: int = 16,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    return finish(obj, collection, material, smooth=True)


def cone(
    name: str,
    radius1: float,
    radius2: float,
    depth: float,
    location: tuple[float, float, float],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    *,
    vertices: int = 14,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    return finish(obj, collection, material, smooth=True)


def mesh_object(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    *,
    smooth: bool = False,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=True)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj["glass_horizon_asset"] = True
    obj.data.materials.append(material)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def parabolic_dish(
    name: str,
    radius: float,
    depth: float,
    thickness: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Create a double-skinned dish opening along local +Z with a closed rim."""
    rings = 6
    segments = 20
    vertices: list[tuple[float, float, float]] = []
    for skin_offset in (0.0, -thickness):
        vertices.append((0.0, 0.0, skin_offset))
        for ring in range(1, rings + 1):
            r = radius * ring / rings
            z = depth * (r / radius) ** 2 + skin_offset
            for segment in range(segments):
                angle = math.tau * segment / segments
                vertices.append((r * math.cos(angle), r * math.sin(angle), z))
    faces: list[tuple[int, ...]] = []
    skin_size = 1 + rings * segments
    for skin in range(2):
        offset = skin * skin_size
        reverse = skin == 1
        for segment in range(segments):
            nxt = (segment + 1) % segments
            triangle = (offset, offset + 1 + segment, offset + 1 + nxt)
            faces.append(tuple(reversed(triangle)) if reverse else triangle)
        for ring in range(1, rings):
            inner = offset + 1 + (ring - 1) * segments
            outer = offset + 1 + ring * segments
            for segment in range(segments):
                nxt = (segment + 1) % segments
                quad = (
                    inner + segment,
                    outer + segment,
                    outer + nxt,
                    inner + nxt,
                )
                faces.append(tuple(reversed(quad)) if reverse else quad)
    outer = 1 + (rings - 1) * segments
    back = skin_size + outer
    for segment in range(segments):
        nxt = (segment + 1) % segments
        faces.append((outer + segment, outer + nxt, back + nxt, back + segment))
    return mesh_object(name, vertices, faces, collection, material, smooth=True)


# ---------------------------------------------------------------------------
# Asset 1: Desert relay dish
# ---------------------------------------------------------------------------


def build_relay(collection: bpy.types.Collection, mat: dict[str, bpy.types.Material]) -> None:
    """A compact tracking dish on an angled sand-mounted pedestal.

    Smaller silhouette than the training radar: ~34 x 34 studs footprint and
    ~24 stud overall height. Reused across desert relay and Mediterranean
    outpost missions.
    """

    # Terraced concrete pad: the base tier reads as a dug-in emplacement.
    box("Pad_Lower", (36.0, 36.0, 1.6), (0, 0, 0.8), collection, mat["Concrete"], bevel=0.28)
    box("Pad_Upper", (26.0, 26.0, 1.2), (0, 0, 2.2), collection, mat["Concrete"], bevel=0.22)

    # Operations shelter + sand-coloured sunshade on top.
    box("Shelter", (14.0, 10.5, 6.4), (-7.0, 7.0, 6.0), collection, mat["Steel"], bevel=0.26)
    box("Shelter_Roof", (14.6, 11.0, 0.6), (-7.0, 7.0, 9.52), collection, mat["Roof"], bevel=0.14)
    box("Shelter_Door", (2.4, 0.26, 3.6), (-10.6, 1.72, 4.9), collection, mat["Accent"], bevel=0.08)
    box("Shelter_Window", (6.5, 0.22, 1.6), (-4.5, 1.74, 6.5), collection, mat["Glass"], bevel=0.08)
    box("Shelter_Warning", (6.5, 0.26, 0.5), (-4.5, 1.78, 4.7), collection, mat["Warning"])

    # Pedestal + yoke that holds the dish.
    cylinder("Pedestal_Lower", 2.4, 5.8, (3.0, -3.0, 5.8), collection, mat["DarkMetal"], vertices=18)
    cylinder("Pedestal_Upper", 1.8, 3.0, (3.0, -3.0, 10.2), collection, mat["DarkMetal"], vertices=14)
    cylinder("Yoke_Base", 2.3, 1.1, (3.0, -3.0, 12.1), collection, mat["Accent"], vertices=16)
    for side in (-1, 1):
        yoke = cylinder(
            f"Yoke_Arm_{side}",
            0.35,
            5.6,
            (3.0 + side * 1.5, -3.0, 14.4),
            collection,
            mat["DarkMetal"],
            vertices=10,
            rotation=(math.radians(side * 24), 0, 0),
        )
        _ = yoke

    # Angled dish pointing up and slightly to the east.
    dish = parabolic_dish("Relay_Dish", 7.6, 2.4, 0.26, collection, mat["Steel"])
    dish.location = (3.0, -3.0, 16.6)
    dish.rotation_euler = (math.radians(22), 0, math.radians(-18))

    # Feed horn and warning cap mark the active direction.
    feed = cylinder("Feed_Horn", 0.72, 1.8, (3.0, -4.5, 19.3), collection, mat["Warning"], vertices=12, rotation=(math.radians(22), 0, math.radians(-18)))
    _ = feed

    # Backup rooftop array and perimeter bollards fill out the silhouette.
    cylinder("Backup_Mast", 0.42, 4.0, (-7.0, 7.0, 11.9), collection, mat["DarkMetal"], vertices=10)
    cylinder("Backup_Hub", 0.9, 0.4, (-7.0, 7.0, 14.0), collection, mat["Accent"], vertices=12)
    for angle in (0, 90, 180, 270):
        radians = math.radians(angle)
        box(
            f"Backup_Blade_{angle}",
            (2.6, 0.18, 0.16),
            (-7.0 + math.cos(radians) * 1.6, 7.0 + math.sin(radians) * 1.6, 14.1),
            collection,
            mat["Steel"],
            rotation=(0, 0, radians),
        )
    for x, y in ((-15, -15), (0, -15), (15, -15), (-15, 15), (0, 15), (15, 15), (-15, 0), (15, 0)):
        cylinder(f"Bollard_{x}_{y}", 0.45, 2.4, (x, y, 2.8), collection, mat["Accent"], vertices=10)

    # A low-vis status beacon on the dish rear keeps the asset readable at
    # mission range even in sandstorm lighting.
    cylinder("Status_Beacon", 0.55, 1.2, (3.0, -3.0, 20.4), collection, mat["Warning"], vertices=12)


# ---------------------------------------------------------------------------
# Asset 2: Mobile SAM launcher
# ---------------------------------------------------------------------------


def build_sam(collection: bpy.types.Collection, mat: dict[str, bpy.types.Material]) -> None:
    """A four-tube mobile anti-air emplacement.

    Approximate footprint 24 x 32 studs with the launcher raised about 9
    studs. Compact enough that the SAM-sweep missions can scatter several per
    island without visual noise.
    """

    # Pad + tracked chassis.
    box("Pad", (28.0, 36.0, 1.0), (0, 0, 0.5), collection, mat["Concrete"], bevel=0.22)
    box("Chassis", (16.5, 24.0, 4.4), (0, 0, 3.4), collection, mat["Steel"], bevel=0.4)
    box("Chassis_Cab", (14.0, 7.5, 3.0), (0, -7.5, 7.2), collection, mat["Steel"], bevel=0.3)
    box("Chassis_Window", (10.5, 0.3, 1.7), (0, -11.1, 7.3), collection, mat["Glass"], bevel=0.08)

    # Tracks on both sides, built from a repeating box + wheel array.
    for side in (-1, 1):
        box(f"Track_{side}", (3.0, 24.0, 2.2), (side * 9.7, 0, 2.3), collection, mat["DarkMetal"], bevel=0.18)
        for wheel_y in (-10.0, -6.0, -2.0, 2.0, 6.0, 10.0):
            cylinder(
                f"Wheel_{side}_{wheel_y}",
                1.1,
                1.8,
                (side * 9.7, wheel_y, 1.8),
                collection,
                mat["DarkMetal"],
                vertices=12,
                rotation=(0, math.radians(90), 0),
            )

    # Elevating turret and launch frame.
    cylinder("Turret_Hub", 3.2, 1.4, (0, 2.5, 6.3), collection, mat["DarkMetal"], vertices=18)
    box("Turret_Shoulder", (6.0, 5.0, 1.2), (0, 2.5, 7.6), collection, mat["Steel"], bevel=0.14)

    # Four launch tubes raked up and forward.
    tube_rotation = (math.radians(-32), 0, 0)
    for index, (offset_x, offset_y) in enumerate(((-2.3, 1.2), (-0.75, 1.2), (0.75, 1.2), (2.3, 1.2))):
        cylinder(
            f"Launch_Tube_{index}",
            0.72,
            8.6,
            (offset_x, offset_y + 2.5, 10.4),
            collection,
            mat["DarkMetal"],
            vertices=14,
            rotation=tube_rotation,
        )
        cylinder(
            f"Launch_Cap_{index}",
            0.78,
            0.4,
            (offset_x, offset_y + 2.5 + 3.2 * math.sin(math.radians(-32)), 10.4 + 3.2 * math.cos(math.radians(-32))),
            collection,
            mat["Accent"],
            vertices=14,
            rotation=tube_rotation,
        )

    # Radar fin on the back of the turret identifies this as a SAM system.
    box("Guidance_Fin_Mast", (0.4, 0.4, 4.8), (0, 5.6, 9.0), collection, mat["DarkMetal"])
    box("Guidance_Fin", (3.4, 0.4, 2.4), (0, 5.6, 12.4), collection, mat["Steel"], bevel=0.1)
    box("Guidance_Fin_Edge", (3.4, 0.42, 0.3), (0, 5.6, 13.5), collection, mat["Warning"])

    # Warning bands run around the pad so pilots can read the hazard from above.
    for y in (-16.6, 16.6):
        box(f"Band_{y}", (28.4, 0.6, 0.7), (0, y, 1.3), collection, mat["Warning"])

    # Two support crates / reload containers on either flank.
    for side in (-1, 1):
        box(f"Reload_Crate_{side}", (3.6, 7.0, 2.6), (side * 11.5, -3.5, 2.3), collection, mat["Accent"], bevel=0.08)


# ---------------------------------------------------------------------------
# Asset 3: Command fleet carrier
# ---------------------------------------------------------------------------


def build_carrier(collection: bpy.types.Collection, mat: dict[str, bpy.types.Material]) -> None:
    """A compact Mediterranean command carrier for the floating-fleet acts.

    Length ~210 studs, beam ~44 studs, overall height ~34 studs. Deliberately
    smaller than a real-world carrier so three or four can share the sea tile
    at mobile-friendly draw cost. Shaped so missile strikes from above read
    well against the authored flight deck.
    """

    length = 210.0
    beam = 44.0

    # Hull: concrete-grey underwater block + darker waterline.
    box("Hull_Lower", (beam, length, 8.0), (0, 0, -3.0), collection, mat["DarkMetal"], bevel=0.5)
    box("Hull_Upper", (beam + 2.0, length - 4.0, 6.0), (0, 0, 4.0), collection, mat["Steel"], bevel=0.4)
    box("Waterline_Band", (beam + 2.2, length - 4.0, 0.4), (0, 0, 1.0), collection, mat["Warning"])

    # Flight deck: sloped bow + straight landing strip + angled waist.
    deck_top = 8.2
    box("Deck_Main", (beam + 4.0, length - 10.0, 1.0), (0, 0, deck_top), collection, mat["Concrete"], bevel=0.3)
    box("Deck_Angled", (18.0, 110.0, 1.0), (-11.0, 10.0, deck_top + 0.02), collection, mat["Concrete"], bevel=0.3, rotation=(0, 0, math.radians(-9)))
    for stripe_offset in (-70, -36, -4, 28, 60):
        box(f"Deck_Stripe_{stripe_offset}", (3.4, 10.0, 0.14), (0, stripe_offset, deck_top + 0.6), collection, mat["Accent"])
    # Bow landing marker and foul-line.
    box("Bow_Pad", (26.0, 8.0, 0.14), (0, -length / 2 + 10.0, deck_top + 0.6), collection, mat["Warning"])
    for side in (-1, 1):
        box(f"Deck_Edge_{side}", (0.6, length - 10.0, 0.4), (side * (beam / 2 + 1.8), 0, deck_top + 0.7), collection, mat["Warning"])

    # Island superstructure on the starboard side.
    box("Island_Lower", (10.0, 32.0, 5.5), (beam / 2 - 2.5, 24.0, deck_top + 3.5), collection, mat["Steel"], bevel=0.35)
    box("Island_Mid", (9.5, 20.0, 4.5), (beam / 2 - 2.5, 24.0, deck_top + 8.4), collection, mat["Steel"], bevel=0.3)
    box("Island_Bridge", (8.5, 12.0, 3.6), (beam / 2 - 2.5, 24.0, deck_top + 12.4), collection, mat["Steel"], bevel=0.3)
    box("Island_Bridge_Glass", (8.6, 12.2, 1.6), (beam / 2 - 2.5, 24.0, deck_top + 13.3), collection, mat["Glass"], bevel=0.1)
    box("Island_Roof", (9.0, 12.4, 0.5), (beam / 2 - 2.5, 24.0, deck_top + 14.6), collection, mat["Roof"])
    box("Island_Access_Door", (0.3, 2.6, 3.4), (beam / 2 - 7.4, 36.0, deck_top + 5.0), collection, mat["Accent"])

    # Radar mast + comms. Two gentle warnings on the mast make it legible from above.
    cylinder("Island_Mast", 0.5, 12.0, (beam / 2 - 2.5, 24.0, deck_top + 20.6), collection, mat["DarkMetal"], vertices=12)
    cylinder("Island_Mast_Cap", 0.9, 0.6, (beam / 2 - 2.5, 24.0, deck_top + 26.6), collection, mat["Warning"], vertices=12)
    for z_offset, radius in ((18.6, 2.4), (22.6, 1.8)):
        for angle in (0, 90, 180, 270):
            radians = math.radians(angle)
            box(
                f"Mast_Blade_{z_offset}_{angle}",
                (radius * 2.0, 0.3, 0.2),
                (beam / 2 - 2.5 + math.cos(radians) * radius / 2, 24.0 + math.sin(radians) * radius / 2, deck_top + z_offset),
                collection,
                mat["Steel"],
                rotation=(0, 0, radians),
            )

    # Sponsons / AA gun stations port-side so the ship reads as a command vessel.
    for y_offset in (-70, -30, 10, 50):
        box(f"Sponson_{y_offset}", (6.0, 10.0, 2.6), (-beam / 2 - 1.0, y_offset, deck_top - 0.4), collection, mat["Steel"], bevel=0.2)
        cylinder(f"Sponson_Gun_{y_offset}", 0.9, 3.0, (-beam / 2 - 2.8, y_offset, deck_top + 1.6), collection, mat["DarkMetal"], vertices=12, rotation=(math.radians(90), 0, 0))

    # Angled stern ramp and tail flag plate.
    box("Stern_Ramp", (beam, 8.0, 1.0), (0, length / 2 - 1.0, deck_top - 0.3), collection, mat["Concrete"], bevel=0.3, rotation=(math.radians(-9), 0, 0))
    box("Stern_Nameplate", (6.0, 0.5, 2.4), (0, length / 2 + 0.6, 3.5), collection, mat["Accent"])


# ---------------------------------------------------------------------------
# Shared pipeline (consolidate → export → validate) copied from
# build-mission-assets.py so Blender can regenerate both target families with
# the same conventions. Keep them identical.
# ---------------------------------------------------------------------------


def apply_and_consolidate(collection: bpy.types.Collection, slug: str) -> list[bpy.types.Object]:
    objects = [obj for obj in collection.objects if obj.type == "MESH"]
    for obj in objects:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)

    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in objects:
        role = obj.data.materials[0].name.removeprefix(f"{slug}_")
        groups.setdefault(role, []).append(obj)
    result: list[bpy.types.Object] = []
    for role in MATERIALS:
        group = groups.get(role, [])
        if not group:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in group:
            obj.select_set(True)
        active = group[0]
        bpy.context.view_layer.objects.active = active
        if len(group) > 1:
            bpy.ops.object.join()
        active.name = f"{slug}_{role}"
        active.data.name = f"{slug}_{role}_Mesh"
        for polygon in active.data.polygons:
            polygon.material_index = 0
        result.append(active)
    bpy.ops.object.select_all(action="DESELECT")

    low, high = world_bounds(result)
    center = (low + high) * 0.5
    for obj in result:
        for vertex in obj.data.vertices:
            vertex.co -= center
        obj.data.update()
    return result


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    low = Vector((math.inf, math.inf, math.inf))
    high = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                low[axis] = min(low[axis], point[axis])
                high[axis] = max(high[axis], point[axis])
    return low, high


def evaluated_triangles(objects: list[bpy.types.Object]):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        yield obj, evaluated, mesh
        evaluated.to_mesh_clear()


def export_json(spec: AssetSpec, objects: list[bpy.types.Object], materials: dict[str, bpy.types.Material]) -> dict:
    vertices: list[list[float]] = []
    faces: list[dict] = []
    parts: list[dict] = []
    low = Vector((math.inf, math.inf, math.inf))
    high = Vector((-math.inf, -math.inf, -math.inf))
    for obj, evaluated, mesh in evaluated_triangles(objects):
        vertex_start = len(vertices)
        face_start = len(faces)
        world = evaluated.matrix_world
        normal_matrix = world.to_3x3().inverted().transposed()
        for vertex in mesh.vertices:
            point = world @ vertex.co
            roblox = Vector((point.x, point.z, point.y))
            vertices.append([round(value, 6) for value in roblox])
            for axis in range(3):
                low[axis] = min(low[axis], roblox[axis])
                high[axis] = max(high[axis], roblox[axis])
        material_name = obj.data.materials[0].name.removeprefix(f"{spec.slug}_")
        for polygon in mesh.polygons:
            indices = [vertex_start + index for index in reversed(polygon.vertices)]
            normals = []
            for loop_index in reversed(polygon.loop_indices):
                source = normal_matrix @ mesh.corner_normals[loop_index].vector
                normal = Vector((source.x, source.z, source.y)).normalized()
                normals.append([round(value, 6) for value in normal])
            faces.append({"indices": indices, "normals": normals, "material": material_name, "part": obj.name})
        parts.append({
            "name": obj.name,
            "vertexStart": vertex_start,
            "vertexCount": len(mesh.vertices),
            "faceStart": face_start,
            "faceCount": len(mesh.polygons),
        })
    dimensions = high - low
    used = {face["material"] for face in faces}
    material_records = []
    for role in MATERIALS:
        if role not in used:
            continue
        material = materials[role]
        material_records.append({
            "name": role,
            "baseColorRGBA": [round(float(value), 5) for value in material.diffuse_color],
            "metallic": round(float(material.metallic), 5),
            "roughness": round(float(material.roughness), 5),
        })
    payload = {
        "schema": "skybreak.triangulated-mesh.v1",
        "asset": spec.title,
        "units": "studs",
        "coordinateSystem": {
            "source": "Blender right-handed: +X right, +Z up, -Y forward",
            "target": "Roblox: +X right, +Y up, -Z forward",
            "vertexTransform": "roblox(x,y,z) = blender(x,z,y)",
            "normalTransform": "roblox(nx,ny,nz) = normalize(blender(nx,nz,ny))",
            "winding": "triangle winding reversed after handedness conversion",
        },
        "bounds": {
            "min": [round(value, 6) for value in low],
            "max": [round(value, 6) for value in high],
            "dimensions": [round(value, 6) for value in dimensions],
        },
        "materials": material_records,
        "parts": parts,
        "vertices": vertices,
        "faces": faces,
    }
    (OUT / f"{spec.slug.lower()}.mesh.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def export_glb(spec: AssetSpec, objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / f"{spec.slug.lower()}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    bpy.ops.object.select_all(action="DESELECT")


def track_to(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_asset(spec: AssetSpec) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.012, 0.018, 0.022)
    scene.view_settings.look = "AgX - Medium High Contrast"
    for name, location, energy, size, color in (
        ("Key", (70, -85, 110), 2300, 18, (0.86, 0.93, 1.0)),
        ("Fill", (-70, -10, 55), 1600, 15, (0.40, 0.65, 1.0)),
        ("Rim", (25, 80, 75), 1900, 14, (1.0, 0.48, 0.20)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = location
        track_to(light, Vector((0, 0, 3)))
    camera_data = bpy.data.cameras.new(f"{spec.slug}_Camera")
    camera = bpy.data.objects.new(f"{spec.slug}_Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = spec.camera
    camera_data.lens = 53
    scene.camera = camera
    track_to(camera, Vector((0, 0, 1)))
    scene.render.filepath = str(OUT / f"{spec.slug.lower()}-preview.png")
    bpy.ops.render.render(write_still=True)


def validate(spec: AssetSpec, payload: dict) -> dict:
    triangles = len(payload["faces"])
    dimensions = payload["bounds"]["dimensions"]
    center = [
        (low + high) * 0.5
        for low, high in zip(payload["bounds"]["min"], payload["bounds"]["max"])
    ]
    if not spec.triangle_min <= triangles <= 5000:
        raise RuntimeError(f"{spec.slug}: triangle count {triangles} outside {spec.triangle_min}-5000")
    for dimension, (minimum, maximum) in zip(dimensions, spec.dimension_ranges):
        if not minimum <= dimension <= maximum:
            raise RuntimeError(f"{spec.slug}: dimensions {dimensions} outside target ranges")
    if any(abs(value) > 0.00001 for value in center):
        raise RuntimeError(f"{spec.slug}: bounds center is {center}, expected origin")
    if not 1 <= len(payload["materials"]) <= 7:
        raise RuntimeError(f"{spec.slug}: invalid material count")
    for face in payload["faces"]:
        a, b, c = (Vector(payload["vertices"][index]) for index in face["indices"])
        if (b - a).cross(c - a).length_squared < 0.00000001:
            raise RuntimeError(f"{spec.slug}: degenerate exported triangle")
    return {
        "asset": spec.title,
        "triangleCount": triangles,
        "vertexCount": len(payload["vertices"]),
        "materialCount": len(payload["materials"]),
        "robloxBounds": payload["bounds"],
        "groundPlacementCenterY": -payload["bounds"]["min"][1],
    }


def build_asset(spec: AssetSpec) -> dict:
    reset_scene()
    scene = bpy.context.scene
    scene.unit_settings.system = "NONE"
    scene.unit_settings.scale_length = 1.0
    asset_collection = bpy.data.collections.new(f"{spec.slug}_Asset")
    scene.collection.children.link(asset_collection)
    materials = make_materials(spec.slug)
    spec.build(asset_collection, materials)
    objects = apply_and_consolidate(asset_collection, spec.slug)
    payload = export_json(spec, objects, materials)
    stats = validate(spec, payload)
    export_glb(spec, objects)
    render_asset(spec)
    scene[f"{spec.slug.lower()}_coordinate_transform"] = "Roblox(x,y,z)=Blender(x,z,y); +Y up, -Z forward"
    scene[f"{spec.slug.lower()}_triangle_count"] = stats["triangleCount"]
    scene[f"{spec.slug.lower()}_bounds"] = json.dumps(payload["bounds"])
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f"{spec.slug.lower()}.blend"), compress=True)
    return stats


def main() -> None:
    specs = (
        AssetSpec(
            "Relay",
            "GLASS HORIZON Desert Relay Dish",
            build_relay,
            300,
            ((34.0, 42.0), (18.0, 26.0), (34.0, 42.0)),
            (62, -78, 68),
        ),
        AssetSpec(
            "SAM",
            "GLASS HORIZON Mobile SAM Launcher",
            build_sam,
            400,
            ((24.0, 32.0), (12.0, 20.0), (34.0, 42.0)),
            (56, -74, 48),
        ),
        AssetSpec(
            "Carrier",
            "GLASS HORIZON Command Carrier",
            build_carrier,
            600,
            ((48.0, 58.0), (28.0, 46.0), (205.0, 220.0)),
            (260, -340, 170),
        ),
    )
    stats = [build_asset(spec) for spec in specs]
    print("GLASS_HORIZON_ASSETS_BUILD_COMPLETE")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"GLASS_HORIZON_ASSETS_BUILD_FAILED: {exc}", file=sys.stderr)
        raise
