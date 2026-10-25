#!/usr/bin/env python3
"""Author the SKYBREAK mission ground targets and export their Roblox meshes.

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build-mission-assets.py

Blender coordinates are X right, Z up, and -Y forward. The mesh JSON swaps
Blender Y/Z into Roblox X/Y/Z and reverses triangle winding.
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
    obj["mission_asset"] = True


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
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
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
    obj["mission_asset"] = True
    obj.data.materials.append(material)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def gable_shell(
    name: str,
    width: float,
    length: float,
    eave: float,
    ridge: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    x = width / 2
    y = length / 2
    vertices = [
        (-x, -y, 0), (x, -y, 0), (x, -y, eave), (0, -y, ridge), (-x, -y, eave),
        (-x, y, 0), (x, y, 0), (x, y, eave), (0, y, ridge), (-x, y, eave),
    ]
    faces = [
        (0, 1, 2, 3, 4), (9, 8, 7, 6, 5), (0, 5, 6, 1),
        (1, 6, 7, 2), (2, 7, 8, 3), (3, 8, 9, 4), (4, 9, 5, 0),
    ]
    return mesh_object(name, vertices, faces, collection, material)


def corrugated_roof_panel(
    name: str,
    side: int,
    width: float,
    length: float,
    eave: float,
    ridge: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Make a shallow folded sheet from ridge to eave; ridges run down the slope."""
    slope_steps = 12
    length_steps = 24
    vertices: list[tuple[float, float, float]] = []
    for j in range(length_steps + 1):
        y = -length / 2 + length * j / length_steps
        ripple = 0.14 if j % 2 == 0 else -0.02
        for i in range(slope_steps + 1):
            t = i / slope_steps
            x = side * (0.25 + t * (width / 2 + 0.45))
            z = ridge + 0.16 - t * (ridge - eave) + ripple
            vertices.append((x, y, z))
    faces: list[tuple[int, ...]] = []
    row = slope_steps + 1
    for j in range(length_steps):
        for i in range(slope_steps):
            a = j * row + i
            faces.append((a, a + row, a + row + 1, a + 1))
    return mesh_object(name, vertices, faces, collection, material)


def parabolic_dish(
    name: str,
    radius: float,
    depth: float,
    thickness: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Create a double-skinned dish opening along local +Z with a closed rim."""
    rings = 7
    segments = 28
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


def build_warehouse(collection: bpy.types.Collection, mat: dict[str, bpy.types.Material]) -> None:
    width, length, eave, ridge = 64.0, 94.0, 31.0, 39.0
    box("Foundation", (65.0, 95.0, 1.2), (0, 0, 0.6), collection, mat["Concrete"], bevel=0.22)
    gable_shell("Warehouse_Shell", width, length, eave, ridge, collection, mat["Steel"])

    # Raised structural ribs make the side cladding visibly corrugated at gameplay distance.
    for y in range(-42, 43, 6):
        for side in (-1, 1):
            box(f"Side_Rib_{side}_{y}", (0.34, 0.42, eave - 1.2), (side * 32.18, y, 16.2), collection, mat["DarkMetal"])
    for x in range(-27, 28, 6):
        box(f"End_Rib_F_{x}", (0.38, 0.34, eave - 1.5), (x, -47.18, 16.0), collection, mat["DarkMetal"])
        box(f"End_Rib_B_{x}", (0.38, 0.34, eave - 1.5), (x, 47.18, 16.0), collection, mat["DarkMetal"])

    corrugated_roof_panel("Roof_Left", -1, width, length, eave, ridge, collection, mat["Roof"])
    corrugated_roof_panel("Roof_Right", 1, width, length, eave, ridge, collection, mat["Roof"])
    box("Ridge_Cap", (1.0, 95.0, 0.65), (0, 0, ridge + 0.22), collection, mat["Accent"], bevel=0.14)

    # Layered panel doors with frames and warning bands on both gable ends.
    for end in (-1, 1):
        y = end * 47.30
        box(f"Door_{end}", (28.0, 0.42, 22.0), (0, y, 11.6), collection, mat["DarkMetal"], bevel=0.18)
        for x in (-14.4, 0, 14.4):
            box(f"Door_Frame_V_{end}_{x}", (0.62, 0.58, 23.2), (x, y - end * 0.05, 11.6), collection, mat["Accent"])
        box(f"Door_Frame_T_{end}", (29.4, 0.58, 0.62), (0, y - end * 0.05, 23.2), collection, mat["Accent"])
        for x in (-9.3, -3.1, 3.1, 9.3):
            box(f"Door_Seam_{end}_{x}", (0.18, 0.51, 20.5), (x, y - end * 0.08, 11.5), collection, mat["Steel"])
        box(f"Warning_Band_{end}", (25.8, 0.64, 0.72), (0, y - end * 0.10, 4.0), collection, mat["Warning"])

    # Clerestory panes and compact roof vents add readable facility detail.
    for side in (-1, 1):
        for y in (-30, -10, 10, 30):
            box(f"Window_{side}_{y}", (0.44, 7.2, 3.0), (side * 32.34, y, 24.2), collection, mat["Glass"], bevel=0.08)
    for y in (-27, -9, 9, 27):
        cylinder(f"Roof_Vent_{y}", 2.25, 2.6, (0, y, 39.1), collection, mat["DarkMetal"], vertices=12)
        cylinder(f"Roof_Vent_Cap_{y}", 3.05, 0.55, (0, y, 40.45), collection, mat["Accent"], vertices=12)


def build_radar(collection: bpy.types.Collection, mat: dict[str, bpy.types.Material]) -> None:
    box("Radar_Pad", (65.0, 65.0, 1.2), (0, 0, 0.6), collection, mat["Concrete"], bevel=0.35)
    box("Operations_Building", (42.0, 32.0, 13.5), (0, 2.0, 7.8), collection, mat["Steel"], bevel=0.65)
    box("Operations_Roof", (44.0, 34.0, 1.25), (0, 2.0, 15.15), collection, mat["Roof"], bevel=0.35)
    # Building corner armor, panel seams, door and blue observation glazing.
    for x in (-20.6, 20.6):
        for y in (-13.4, 17.4):
            box(f"Corner_{x}_{y}", (1.1, 1.1, 14.0), (x, y, 7.8), collection, mat["DarkMetal"])
    for x in (-14, -7, 0, 7, 14):
        box(f"Front_Seam_{x}", (0.22, 0.40, 11.7), (x, -14.15, 7.4), collection, mat["DarkMetal"])
    box("Access_Door", (7.0, 0.52, 9.5), (-12.0, -14.28, 5.4), collection, mat["Accent"], bevel=0.16)
    box("Observation_Window", (15.0, 0.54, 4.0), (7.0, -14.30, 9.3), collection, mat["Glass"], bevel=0.18)
    box("Warning_Sill", (17.0, 0.64, 0.65), (7.0, -14.38, 6.95), collection, mat["Warning"])

    # Four diagonal support struts and a substantial turntable make the dish silhouette clear.
    cylinder("Turntable", 8.2, 2.2, (0, 2.0, 17.0), collection, mat["DarkMetal"], vertices=20)
    cylinder("Mast", 2.1, 18.0, (0, 2.0, 27.0), collection, mat["Accent"], vertices=16)
    for angle in (45, 135, 225, 315):
        radians = math.radians(angle)
        x = math.cos(radians) * 5.6
        y = 2.0 + math.sin(radians) * 5.6
        strut = cylinder(f"Strut_{angle}", 0.52, 17.0, (x / 2, (y + 2.0) / 2, 25.0), collection, mat["DarkMetal"], vertices=10)
        direction = Vector((x, y - 2.0, 11.5))
        strut.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()

    dish = parabolic_dish("Radar_Dish", 15.2, 4.8, 0.42, collection, mat["Steel"])
    dish.location = (0, 2.0, 35.0)
    dish.rotation_euler[0] = math.radians(15)
    # Feed horn projects through the dish opening and remains a separate authored accent.
    feed = cylinder("Feed_Arm", 0.55, 8.5, (0, 0.9, 40.0), collection, mat["DarkMetal"], vertices=12)
    feed.rotation_euler[0] = math.radians(15)
    cylinder("Feed_Horn", 1.35, 2.3, (0, -0.1, 43.7), collection, mat["Warning"], vertices=14, rotation=(math.radians(15), 0, 0))
    cylinder("Beacon", 0.75, 1.4, (18.0, 14.0, 16.5), collection, mat["Warning"], vertices=12)

    # Perimeter bollards establish the full target footprint without a dense fence.
    for x, y in ((-29, -29), (0, -29), (29, -29), (-29, 29), (0, 29), (29, 29), (-29, 0), (29, 0)):
        cylinder(f"Bollard_{x}_{y}", 0.65, 4.5, (x, y, 2.8), collection, mat["Accent"], vertices=10)


def apply_and_consolidate(collection: bpy.types.Collection, slug: str) -> list[bpy.types.Object]:
    objects = [obj for obj in collection.objects if obj.type == "MESH"]
    for obj in objects:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        # Bevel widths are authored in studs. Apply primitive scale first so a
        # large building does not turn the bevel into near-zero sliver faces.
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
        AssetSpec("Warehouse", "SKYBREAK Military Warehouse", build_warehouse, 700, ((64.5, 65.5), (39.0, 42.0), (94.5, 95.5)), (115, -135, 100)),
        AssetSpec("Radar", "SKYBREAK Radar Training Installation", build_radar, 850, ((64.5, 65.5), (44.0, 47.0), (64.5, 65.5)), (90, -105, 78)),
    )
    stats = [build_asset(spec) for spec in specs]
    print("MISSION_ASSETS_BUILD_COMPLETE")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"MISSION_ASSETS_BUILD_FAILED: {exc}", file=sys.stderr)
        raise
