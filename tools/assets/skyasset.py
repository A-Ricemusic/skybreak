"""Shared Blender helpers for the SKYBREAK Roblox upload asset set.

Every generator under ``tools/assets/`` builds one asset from code, then calls
``Asset.finish()`` which:

1. joins the authored pieces into delivery objects (one mesh for world props;
   a body plus separately pivoted control surfaces for aircraft),
2. smart-UV-unwraps every delivery object into one shared atlas,
3. bakes procedural Cycles materials into a PBR texture set
   (``<name>-color.png``, ``-normal.png``, ``-roughness.png``, ``-metalness.png``),
4. swaps in a single image-textured material, renders four 1024x1024 Eevee
   previews on a neutral background, exports an FBX with embedded textures,
5. writes ``checklist.json`` with triangle counts, texture sizes, Roblox
   dimensions and the moderation pre-check booleans.

Coordinates: author in Blender with X right, Z up and **-Y forward**, one
Blender unit = one Roblox stud (1 stud ~ 0.28 m). The FBX export maps this to
Roblox +Y up / -Z forward and writes one FBX centimetre per stud, because Roblox's
importer reads FBX centimetres as studs (see ``FBX_METRES_PER_STUD``). Nothing here
draws glyphs: every texture is built from noise, grids and masks, which is what lets
``noText`` be asserted.
"""

from __future__ import annotations

import json
import math
import os
import random
import shutil
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
UPLOAD = ROOT / "assets" / "roblox-upload"
STUD_METRES = 0.28
# Roblox's Model import reads the FBX's centimetre values as studs, ignoring the file's
# unit scale: the pilot Kestrel upload written at 0.28 m per stud (28 FBX cm per stud)
# arrived 644 x 172 x 754.6 studs, 28x its 23 x 6.143 x 26.95 authored size. Exporting
# 0.01 m (one FBX centimetre) per stud makes an import arrive at the authored stud size.
# Folders exported before this change have no ``fbxMetresPerStud`` and arrive 28x too
# large; the game's loader rescales either way.
FBX_METRES_PER_STUD = 0.01


def m(metres: float) -> float:
    """Metres to studs."""
    return metres / STUD_METRES


def srgb(hex_or_tuple) -> tuple[float, float, float]:
    """sRGB hex (or 0-1 tuple) to linear RGB for shader math."""
    if isinstance(hex_or_tuple, str):
        h = hex_or_tuple.lstrip("#")
        rgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    else:
        rgb = list(hex_or_tuple)

    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(lin(c) for c in rgb)  # type: ignore[return-value]


def args() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


# --------------------------------------------------------------------------
# Shader-node DSL. Values may be sockets, floats or 3-tuples.


class Nodes:
    def __init__(self, material: bpy.types.Material):
        self.tree = material.node_tree
        self.nodes = self.tree.nodes
        self.links = self.tree.links
        self._geo = None
        self._map = None

    def new(self, kind: str, **props):
        node = self.nodes.new(kind)
        for key, value in props.items():
            setattr(node, key, value)
        return node

    def feed(self, socket, value) -> None:
        if value is None:
            return
        if isinstance(value, bpy.types.NodeSocket):
            self.links.new(value, socket)
        elif isinstance(value, (tuple, list)):
            current = socket.default_value
            if len(current) == 4 and len(value) == 3:
                value = (*value, 1.0)
            socket.default_value = value
        else:
            socket.default_value = value

    @staticmethod
    def sock(sockets, name: str, kind: str | None = None):
        for s in sockets:
            if s.name == name and (kind is None or s.type == kind) and s.enabled:
                return s
        for s in sockets:
            if s.name == name and (kind is None or s.type == kind):
                return s
        raise KeyError(name)

    # Geometry --------------------------------------------------------------
    def geo(self, output: str):
        if self._geo is None:
            self._geo = self.new("ShaderNodeNewGeometry")
        return self._geo.outputs[output]

    def pos(self):
        """Shading position. It passes through one Mapping node that ``Asset`` can set after
        delivery so patterns keep using authored coordinates once a model is recentred or
        rescaled (identity unless ``Asset.target_length`` is used)."""
        if self._map is None:
            self._map = self.new("ShaderNodeMapping", vector_type="POINT")
            self.feed(self._map.inputs["Vector"], self.geo("Position"))
        return self._map.outputs["Vector"]

    def normal(self):
        return self.geo("True Normal")

    def xyz(self, vec):
        node = self.new("ShaderNodeSeparateXYZ")
        self.feed(node.inputs[0], vec)
        return node.outputs["X"], node.outputs["Y"], node.outputs["Z"]

    def vec(self, x, y, z):
        node = self.new("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)):
            self.feed(node.inputs[i], v)
        return node.outputs[0]

    # Math ------------------------------------------------------------------
    def math(self, op: str, a, b=0.0, c=0.0, clamp: bool = False):
        node = self.new("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.feed(node.inputs[0], a)
        self.feed(node.inputs[1], b)
        self.feed(node.inputs[2], c)
        return node.outputs[0]

    def add(self, a, b):
        return self.math("ADD", a, b)

    def sub(self, a, b):
        return self.math("SUBTRACT", a, b)

    def mul(self, a, b):
        return self.math("MULTIPLY", a, b)

    def absf(self, a):
        return self.math("ABSOLUTE", a)

    def maxf(self, a, b):
        return self.math("MAXIMUM", a, b)

    def minf(self, a, b):
        return self.math("MINIMUM", a, b)

    def clamp01(self, a):
        return self.math("ADD", a, 0.0, clamp=True)

    def smooth(self, x, e0: float, e1: float, lo=0.0, hi=1.0):
        """Smoothstep from e0..e1 to lo..hi (e0 may exceed e1 to invert)."""
        node = self.new("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP", clamp=True)
        self.feed(node.inputs[0], x)
        self.feed(node.inputs[1], e0)
        self.feed(node.inputs[2], e1)
        self.feed(node.inputs[3], lo)
        self.feed(node.inputs[4], hi)
        return node.outputs[0]

    def lerp(self, a, b, t):
        node = self.new("ShaderNodeMix", data_type="FLOAT", clamp_factor=True)
        self.feed(self.sock(node.inputs, "Factor", "VALUE"), t)
        self.feed(self.sock(node.inputs, "A", "VALUE"), a)
        self.feed(self.sock(node.inputs, "B", "VALUE"), b)
        return self.sock(node.outputs, "Result", "VALUE")

    def vlerp(self, a, b, t):
        node = self.new("ShaderNodeMix", data_type="VECTOR", clamp_factor=True)
        self.feed(self.sock(node.inputs, "Factor", "VALUE"), t)
        self.feed(self.sock(node.inputs, "A", "VECTOR"), a)
        self.feed(self.sock(node.inputs, "B", "VECTOR"), b)
        return self.sock(node.outputs, "Result", "VECTOR")

    def vmath(self, op: str, a, b=(0, 0, 0), scale=None):
        node = self.new("ShaderNodeVectorMath", operation=op)
        self.feed(node.inputs[0], a)
        self.feed(node.inputs[1], b)
        if scale is not None:
            self.feed(self.sock(node.inputs, "Scale"), scale)
        out = node.outputs["Vector"] if op not in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else node.outputs["Value"]
        return out

    def vscale(self, a, s):
        return self.vmath("SCALE", a, scale=s)

    def vmul(self, a, b):
        return self.vmath("MULTIPLY", a, b)

    # Textures --------------------------------------------------------------
    def noise(self, vec, scale: float, detail: float = 3.0, rough: float = 0.55):
        node = self.new("ShaderNodeTexNoise", noise_dimensions="3D")
        self.feed(node.inputs["Vector"], vec)
        self.feed(node.inputs["Scale"], scale)
        self.feed(node.inputs["Detail"], detail)
        self.feed(node.inputs["Roughness"], rough)
        return node.outputs["Fac"]

    def voronoi(self, vec, scale: float, feature="F1", metric="EUCLIDEAN", output="Distance", randomness=1.0):
        node = self.new("ShaderNodeTexVoronoi", voronoi_dimensions="3D", feature=feature, distance=metric)
        self.feed(node.inputs["Vector"], vec)
        self.feed(node.inputs["Scale"], scale)
        self.feed(node.inputs["Randomness"], randomness)
        return node.outputs[output]

    def ao(self, distance: float, samples: int = 16):
        node = self.new("ShaderNodeAmbientOcclusion", samples=samples)
        self.feed(node.inputs["Distance"], distance)
        return node.outputs["AO"]

    def lines(self, coord, spacing: float, width: float, offset: float = 0.0):
        """1 on thin lines every ``spacing`` along a scalar coordinate."""
        t = self.math("FRACT", self.add(self.math("DIVIDE", coord, spacing), offset + 0.5))
        d = self.mul(self.absf(self.sub(t, 0.5)), spacing)
        return self.smooth(d, width, width * 0.35)

    def band(self, coord, lo: float, hi: float, soft: float = 0.02):
        """1 between lo and hi along a scalar coordinate."""
        return self.mul(self.smooth(coord, lo - soft, lo + soft), self.smooth(coord, hi + soft, hi - soft))

    def rect(self, coord, spacing: float, filled: float, offset: float = 0.0, soft: float = 0.03):
        """Periodic box pulse: 1 inside a ``filled`` wide window every ``spacing``."""
        t = self.math("FRACT", self.add(self.math("DIVIDE", coord, spacing), offset))
        d = self.mul(self.absf(self.sub(t, 0.5)), spacing)
        return self.smooth(d, filled * 0.5 + soft, filled * 0.5 - soft)


# --------------------------------------------------------------------------
# Materials: each zone material computes (color, roughness, metalness, height).


class Zone:
    """A procedural source material. ``build(n)`` returns channel sockets."""

    def __init__(self, name: str, build):
        self.name = name
        self.build = build
        self.material: bpy.types.Material | None = None
        self.channels: dict = {}
        self.emit = None
        self.out = None
        self.bsdf = None
        self.target = None


def standard(
    color,
    rough: float = 0.6,
    metal: float = 0.0,
    *,
    vary: float = 0.06,
    vary_scale: float = 0.08,
    ao: float = 0.35,
    ao_dist: float = 2.0,
    grime: float = 0.15,
    grime_scale: float = 0.05,
    streak: float = 0.0,
    streak_axis: str = "z",
    base_dirt: float = 0.0,
    base_dirt_height: float = 6.0,
    bump: float = 0.0,
    bump_scale: float = 2.0,
    rust: float = 0.0,
    pattern=None,
    height_extra=None,
):
    """Factory for the common weathered surface.

    ``pattern(n, color_socket) -> (color, rough_delta, height)`` lets a zone
    add camo, windows, corrugation and the like on top of the base.
    """

    def build(n: Nodes):
        p = n.pos()
        x, y, z = n.xyz(p)
        col = color if isinstance(color, bpy.types.NodeSocket) else srgb(color)
        rough_s = rough
        height = 0.5
        if pattern is not None:
            col, rough_delta, h = pattern(n, col)
            if rough_delta is not None:
                rough_s = n.add(rough_s, rough_delta)
            if h is not None:
                height = h
        # Large-scale paint/material variation.
        v = n.noise(p, vary_scale, 4.0, 0.6)
        col = n.vscale(col, n.add(1.0 - vary, n.mul(v, vary * 2)))
        rough_s = n.add(rough_s, n.mul(n.sub(v, 0.5), 0.12))
        # Grime blotches.
        if grime > 0:
            g = n.smooth(n.noise(p, grime_scale * 3.1, 5.0, 0.62), 0.48, 0.72)
            col = n.vscale(col, n.sub(1.0, n.mul(g, grime)))
            rough_s = n.add(rough_s, n.mul(g, 0.1))
        if streak > 0:
            sx = {"x": (0.35, 6.0, 6.0), "y": (6.0, 0.35, 6.0), "z": (5.0, 5.0, 0.18)}[streak_axis]
            s = n.smooth(n.noise(n.vmul(p, sx), 1.2, 3.0, 0.5), 0.5, 0.75)
            col = n.vscale(col, n.sub(1.0, n.mul(s, streak)))
        if rust > 0:
            r = n.smooth(n.noise(p, 0.35, 6.0, 0.7), 0.58, 0.74)
            col = n.vlerp(col, srgb("#6b3b22"), n.mul(r, rust))
            rough_s = n.add(rough_s, n.mul(r, 0.25 * rust))
        if base_dirt > 0:
            d = n.smooth(z, base_dirt_height, 0.0)
            col = n.vlerp(col, srgb("#4a4338"), n.mul(d, base_dirt))
        if ao > 0:
            col = n.vscale(col, n.lerp(1.0 - ao, 1.0, n.ao(ao_dist)))
        if bump > 0:
            height = n.add(height, n.mul(n.noise(p, bump_scale, 4.0, 0.6), bump))
        if height_extra is not None:
            height = n.add(height, height_extra(n))
        return {"color": col, "rough": n.clamp01(rough_s), "metal": metal, "height": height}

    return build


def setup_zone(zone: Zone, bump_distance: float) -> None:
    mat = bpy.data.materials.new(f"SRC_{zone.name}")
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    n = Nodes(mat)
    zone.channels = zone.build(n)
    zone.out = n.new("ShaderNodeOutputMaterial", target="CYCLES")
    zone.emit = n.new("ShaderNodeEmission")
    zone.bsdf = n.new("ShaderNodeBsdfPrincipled")
    bump = n.new("ShaderNodeBump")
    n.feed(bump.inputs["Strength"], 1.0)
    n.feed(bump.inputs["Distance"], bump_distance)
    n.feed(bump.inputs["Height"], zone.channels["height"])
    n.feed(zone.bsdf.inputs["Normal"], bump.outputs["Normal"])
    n.feed(zone.bsdf.inputs["Base Color"], zone.channels["color"])
    zone.target = n.new("ShaderNodeTexImage")
    zone.target.name = "BakeTarget"
    nt.nodes.active = zone.target
    zone.material = mat
    zone.nodes = n


def route(zone: Zone, channel: str, image: bpy.types.Image) -> None:
    n = zone.nodes
    for link in list(zone.out.inputs["Surface"].links):
        n.links.remove(link)
    for link in list(zone.emit.inputs["Color"].links):
        n.links.remove(link)
    zone.target.image = image
    n.tree.nodes.active = zone.target
    if channel == "normal":
        n.links.new(zone.bsdf.outputs[0], zone.out.inputs["Surface"])
        return
    value = zone.channels[channel]
    if isinstance(value, bpy.types.NodeSocket):
        n.links.new(value, zone.emit.inputs["Color"])
    else:
        zone.emit.inputs["Color"].default_value = (value, value, value, 1.0) if not isinstance(value, tuple) else (*value, 1.0)
    zone.emit.inputs["Strength"].default_value = 1.0
    n.links.new(zone.emit.outputs[0], zone.out.inputs["Surface"])


# --------------------------------------------------------------------------
# Geometry helpers


def _object(name: str, bm: bmesh.types.BMesh) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


class Asset:
    def __init__(self, name: str, title: str, *, texture: int = 512, kind: str = "world", tri_limit: int = 2500,
                 bump_distance: float = 0.05, usage: str = "", seed: int = 1, target_length: float | None = None,
                 weighted_normals: bool = False, glass_parts: tuple = ()):
        self.name = name
        self.title = title
        self.texture = texture
        self.kind = kind
        self.tri_limit = tri_limit
        self.bump_distance = bump_distance
        self.usage = usage
        self.rng = random.Random(seed)
        self.zones: dict[str, Zone] = {}
        self.pieces: list[tuple[bpy.types.Object, str]] = []
        self.metadata: dict = {}
        self.notes: dict[str, str] = {}
        self.out = UPLOAD / name
        self.out.mkdir(parents=True, exist_ok=True)
        # target_length: uniformly scale the delivered model so its longest side is exactly
        # this many studs (patterns, hinges and attachments stay in authored coordinates).
        self.target_length = target_length
        self.scale_k = 1.0
        self.weighted_normals = weighted_normals
        # Delivery parts rendered see-through in previews (the game sets their Transparency).
        self.glass_parts = tuple(glass_parts)
        # Extra checklist fields (e.g. a backdrop ridge's measured crest height), merged into checklist.json.
        self.extra: dict = {}
        reset()

    # Materials -------------------------------------------------------------
    def zone(self, name: str, build) -> str:
        self.zones[name] = Zone(name, build)
        return name

    def _mat_index(self, obj: bpy.types.Object, zone: str) -> int:
        z = self.zones[zone]
        if z.material is None:
            setup_zone(z, self.bump_distance)
        mats = obj.data.materials
        for i, mat in enumerate(mats):
            if mat == z.material:
                return i
        mats.append(z.material)
        return len(mats) - 1

    def add(self, obj: bpy.types.Object, zone: str, part: str = "Main", smooth: float | None = None,
            bevel: float = 0.0, bevel_segments: int = 1) -> bpy.types.Object:
        idx = self._mat_index(obj, zone)
        for poly in obj.data.polygons:
            poly.material_index = idx
        if smooth is not None:
            for poly in obj.data.polygons:
                poly.use_smooth = True
            obj.data.set_sharp_from_angle(angle=math.radians(smooth))
        if bevel > 0:
            mod = obj.modifiers.new("Bevel", "BEVEL")
            mod.width = bevel
            mod.segments = bevel_segments
            mod.limit_method = "ANGLE"
            mod.angle_limit = math.radians(40)
            mod.harden_normals = False
        self.pieces.append((obj, part))
        return obj

    def assign(self, obj: bpy.types.Object, faces, zone: str) -> None:
        """Re-zone specific polygon indices of an already-added object."""
        idx = self._mat_index(obj, zone)
        for i in faces:
            obj.data.polygons[i].material_index = idx

    # Primitives ------------------------------------------------------------
    def mesh(self, name: str, verts, faces, zone: str, part: str = "Main", **kw) -> bpy.types.Object:
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
        me.validate()
        me.update()
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        return self.add(obj, zone, part, **kw)

    def box(self, name: str, size, loc, zone: str, part: str = "Main", rot=(0, 0, 0), **kw):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
        obj = _object(name, bm)
        obj.location = loc
        obj.rotation_euler = rot
        return self.add(obj, zone, part, **kw)

    def cyl(self, name: str, r: float, depth: float, loc, zone: str, part: str = "Main", segs: int = 16,
            r2: float | None = None, rot=(0, 0, 0), caps: bool = True, smooth: float | None = 50, **kw):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r,
                              radius2=r if r2 is None else r2, depth=depth)
        obj = _object(name, bm)
        obj.location = loc
        obj.rotation_euler = rot
        return self.add(obj, zone, part, smooth=smooth, **kw)

    def sphere(self, name: str, r: float, loc, zone: str, part: str = "Main", subdiv: int = 2, scale=(1, 1, 1),
               displace=None, smooth: float | None = 70, **kw):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
        if displace is not None:
            for v in bm.verts:
                v.co = displace(v.co.copy())
        for v in bm.verts:
            v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        obj = _object(name, bm)
        obj.location = loc
        return self.add(obj, zone, part, smooth=smooth, **kw)

    def beam(self, name: str, p0, p1, w: float, zone: str, part: str = "Main", h: float | None = None,
             segs: int = 4, roll: float = 0.0, **kw):
        """A square (segs=4) or round member between two points, for lattices."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        length = d.length
        bm = bmesh.new()
        if segs == 4:
            bmesh.ops.create_cube(bm, size=1.0)
            bmesh.ops.scale(bm, vec=Vector((w, h if h is not None else w, length)), verts=bm.verts)
        else:
            bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=w / 2, radius2=w / 2, depth=length)
        obj = _object(name, bm)
        quat = d.to_track_quat("Z", "Y")
        obj.matrix_basis = Matrix.Translation((p0 + p1) / 2) @ quat.to_matrix().to_4x4() @ Matrix.Rotation(roll, 4, "Z")
        return self.add(obj, zone, part, smooth=None if segs == 4 else 50, **kw)

    def loft(self, name: str, rings, zone: str, part: str = "Main", cap_start: bool = True, cap_end: bool = True,
             closed: bool = True, smooth: float | None = 35, **kw):
        """Bridge a list of equally sized point rings. Caps are fans to a center vertex."""
        verts, faces = [], []
        count = len(rings[0])
        for ring in rings:
            verts.extend(tuple(p) for p in ring)
        span = count if closed else count - 1
        def point_ring(ring):
            return max((Vector(p) - Vector(ring[0])).length for p in ring) < 1e-6

        for r in range(len(rings) - 1):
            a, b = r * count, (r + 1) * count
            for i in range(span):
                j = (i + 1) % count
                if point_ring(rings[r + 1]):
                    faces.append((a + i, a + j, b + i))
                elif point_ring(rings[r]):
                    faces.append((a + i, b + j, b + i))
                else:
                    faces.append((a + i, a + j, b + j, b + i))
        for cap, ring_index, flip in ((cap_start, 0, True), (cap_end, len(rings) - 1, False)):
            if not cap or not closed:
                continue
            ring = rings[ring_index]
            c = Vector((0, 0, 0))
            for p in ring:
                c += Vector(p)
            c /= count
            if max((Vector(p) - c).length for p in ring) < 1e-5:
                continue
            ci = len(verts)
            verts.append(tuple(c))
            base = ring_index * count
            for i in range(count):
                j = (i + 1) % count
                tri = (base + i, base + j, ci)
                faces.append(tuple(reversed(tri)) if flip else tri)
        obj = self.mesh(name, verts, faces, zone, part, smooth=smooth, **kw)
        # Lofts can come out inside-out depending on ring order; normalise outward.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    def prism(self, name: str, outline, z0: float, z1: float, zone: str, part: str = "Main", axis: str = "z", **kw):
        """Extrude a 2D outline between two planes. axis z: outline is XY; x: outline YZ; y: outline XZ."""
        def place(u, v, w):
            return {"z": (u, v, w), "x": (w, u, v), "y": (u, w, v)}[axis]

        c = len(outline)
        verts = [place(u, v, z0) for u, v in outline] + [place(u, v, z1) for u, v in outline]
        faces = [tuple(reversed(range(c))), tuple(c + i for i in range(c))]
        for i in range(c):
            j = (i + 1) % c
            faces.append((i, j, c + j, c + i))
        obj = self.mesh(name, verts, faces, zone, part, **kw)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
        return obj

    def mirror_x(self, obj: bpy.types.Object, name: str, part: str | None = None) -> bpy.types.Object:
        """Duplicate an added piece mirrored across X=0 (applies transforms first)."""
        src_part = next(p for o, p in self.pieces if o == obj)
        copy = obj.copy()
        copy.data = obj.data.copy()
        copy.name = name
        bpy.context.scene.collection.objects.link(copy)
        copy.matrix_basis = Matrix.Scale(-1, 4, (1, 0, 0)) @ obj.matrix_basis
        apply_transform(copy)
        self.pieces.append((copy, part or src_part))
        return copy

    # Finishing -------------------------------------------------------------
    def finish(self, *, origin: str = "bottom", ground_offset: float = 0.0, liveries=None,
               hinges: dict | None = None, attachments: dict | None = None, extra_notes: dict | None = None,
               preview_ground: bool = True, closeup: tuple | None = None) -> dict:
        """``closeup`` = (authored target point, view direction, distance) adds preview-closeup.png."""
        objects = self._deliver(origin)
        self.closeup = None
        if closeup is not None:
            target, direction, distance = closeup
            self.closeup = (self.shift(target), Vector(direction).normalized(), distance * self.scale_k)
        if os.environ.get("SKYASSET_DRAFT"):
            return self._draft(objects)
        for zone in self.zones.values():
            self._authored_space(zone)
        tris = triangles(objects)
        if tris > self.tri_limit:
            raise RuntimeError(f"{self.name}: {tris} triangles exceeds {self.tri_limit}")
        unwrap(objects)
        textures = self._bake(objects, self.name, self.out)
        self._textures = textures
        final = self._final_material(textures)
        for obj in objects:
            obj.data.materials.clear()
            obj.data.materials.append(final)
        bounds = world_bounds(objects)
        size = bounds[1] - bounds[0]
        render_previews(objects, self.out, ground=preview_ground and origin == "bottom", glass=self.glass_parts,
                        closeup=self.closeup)
        fbx = self.out / f"{self.name}.fbx"
        export_fbx(objects, fbx)
        hinge_records = {}
        if hinges:
            for key, (a, b) in hinges.items():
                hinge_records[key] = {"from": roblox_vec(self.shift(a)), "to": roblox_vec(self.shift(b))}
        checklist = self._checklist(objects, tris, textures, size, ground_offset, hinge_records, attachments,
                                    extra_notes or {}, fbx)
        variants = []
        for livery in liveries or []:
            variants.append(self._livery(objects, livery, final, tris, size, ground_offset, hinge_records,
                                         attachments, extra_notes or {}))
        checklist["variants"] = variants
        (self.out / "checklist.json").write_text(json.dumps(checklist, indent=2) + "\n")
        print(f"ASSET_DONE {self.name} tris={tris} size={[round(v, 2) for v in roblox_vec(size, absolute=True)]}")
        return checklist

    def _deliver(self, origin: str) -> list[bpy.types.Object]:
        groups: dict[str, list[bpy.types.Object]] = {}
        for obj, part in self.pieces:
            groups.setdefault(part, []).append(obj)
        delivered = []
        for part, objs in groups.items():
            for obj in objs:
                apply_modifiers(obj)
                apply_transform(obj)
                triangulate(obj)
            joined = join(objs, self.name if part == "Main" else part)
            if self.weighted_normals:
                weighted_normals(joined)
            delivered.append(joined)
        bmin, bmax = world_bounds(delivered)
        center = (bmin + bmax) / 2
        if origin == "bottom":
            center.z = bmin.z
        if self.target_length:
            self.scale_k = self.target_length / max(bmax - bmin)
        for obj in delivered:
            obj.data.transform(Matrix.Scale(self.scale_k, 4) @ Matrix.Translation(-center))
            obj.data.update()
        self.offset = center
        # Control surfaces keep their hinge as object origin so FBX pivots are useful.
        for obj in delivered:
            pivot = self.metadata.get("pivots", {}).get(obj.name)
            if pivot is not None:
                p = self.shift(pivot)
                obj.data.transform(Matrix.Translation(-p))
                obj.location = p
        return delivered

    def _draft(self, objects) -> dict:
        """Geometry-only check (SKYASSET_DRAFT=1): triangle count and Workbench renders in
        build/draft/<name>/, no bake, no export, nothing written to assets/."""
        tris = triangles(objects)
        folder = ROOT / "build" / "draft" / self.name
        folder.mkdir(parents=True, exist_ok=True)
        scene = bpy.context.scene
        for obj in objects:
            obj.data.materials.clear()
        render_previews(objects, folder, ground=False, engine="BLENDER_WORKBENCH", closeup=self.closeup)
        # Extra draft-only views: SKYASSET_VIEWS="name:tx,ty,tz:dx,dy,dz:dist;..." in authored coordinates.
        for spec in filter(None, os.environ.get("SKYASSET_VIEWS", "").split(";")):
            view, t, d, dist = spec.split(":")
            target = self.shift(tuple(float(v) for v in t.split(",")))
            direction = Vector(tuple(float(v) for v in d.split(","))).normalized()
            render_previews(objects, folder, ground=False, engine="BLENDER_WORKBENCH",
                            closeup=(target, direction, float(dist) * self.scale_k), only_closeup=view)
        print(f"ASSET_DRAFT {self.name} tris={tris} parts={[(o.name, triangles([o])) for o in objects]}")
        return {}

    def shift(self, point) -> Vector:
        """A point authored before finish() expressed in the delivered frame."""
        return (Vector(point) - self.offset) * self.scale_k

    def _authored_space(self, zone: Zone) -> None:
        """Map delivered shading positions back to authored coordinates for this zone's patterns."""
        mapping = getattr(zone, "nodes", None) and zone.nodes._map
        if mapping is None or (self.scale_k == 1.0 and self.offset.length == 0):
            return
        mapping.inputs["Location"].default_value = self.offset
        mapping.inputs["Scale"].default_value = (1 / self.scale_k,) * 3

    def _bake(self, objects, stem: str, folder: Path, channels=("color", "normal", "rough", "metal"),
              reuse: dict | None = None) -> dict:
        scene = bpy.context.scene
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 6
        scene.cycles.use_denoising = False
        scene.cycles.seed = 7
        scene.render.bake.margin = 6
        scene.render.bake.use_clear = True
        scene.render.bake.target = "IMAGE_TEXTURES"
        select(objects)
        textures = dict(reuse or {})
        suffix = {"color": "color", "normal": "normal", "rough": "roughness", "metal": "metalness"}
        for channel in channels:
            img = bpy.data.images.new(f"{stem}-{suffix[channel]}", self.texture, self.texture, alpha=False)
            img.colorspace_settings.name = "sRGB" if channel == "color" else "Non-Color"
            for zone in self.zones.values():
                if zone.material is not None:
                    route(zone, channel, img)
            if channel == "normal":
                bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", margin=6)
            else:
                bpy.ops.object.bake(type="EMIT", margin=6)
            path = folder / f"{stem}-{suffix[channel]}.png"
            img.filepath_raw = str(path)
            img.file_format = "PNG"
            img.save()
            textures[channel] = {"file": path.name, "width": self.texture, "height": self.texture, "image": img,
                                 "path": path}
        return textures

    def _final_material(self, textures: dict, name: str | None = None) -> bpy.types.Material:
        mat = bpy.data.materials.new(name or f"SKYBREAK_{self.name}")
        try:
            mat.use_nodes = True
        except Exception:
            pass
        n = Nodes(mat)
        bsdf = n.nodes.get("Principled BSDF")

        def tex(channel):
            node = n.new("ShaderNodeTexImage")
            node.image = textures[channel]["image"]
            return node

        n.feed(bsdf.inputs["Base Color"], tex("color").outputs["Color"])
        n.feed(bsdf.inputs["Roughness"], tex("rough").outputs["Color"])
        n.feed(bsdf.inputs["Metallic"], tex("metal").outputs["Color"])
        nm = n.new("ShaderNodeNormalMap")
        n.feed(nm.inputs["Color"], tex("normal").outputs["Color"])
        n.feed(bsdf.inputs["Normal"], nm.outputs["Normal"])
        return mat

    def _livery(self, objects, livery, base_final, tris, size, ground_offset, hinges, attachments, extra_notes):
        """Rebake colour and roughness with new zone builders; mesh, UVs and normals are shared."""
        name = f"{self.name}-{livery['name']}"
        folder = UPLOAD / name
        folder.mkdir(parents=True, exist_ok=True)
        # Put the source zones back on, rebuilt with the livery's builders.
        for obj in objects:
            obj.data.materials.clear()
        for key, build in livery["zones"].items():
            self.zones[key].build = build
            old = self.zones[key].material
            self.zones[key].material = None
            if old is not None:
                bpy.data.materials.remove(old)
            setup_zone(self.zones[key], self.bump_distance)
            self._authored_space(self.zones[key])
        for obj in objects:
            for zone_name in obj.get("zones", []):
                obj.data.materials.append(self.zones[zone_name].material)
            for poly, zone_name in zip(obj.data.polygons, obj["face_zones"]):
                poly.material_index = list(obj.get("zones", [])).index(zone_name)
        base_textures = {k: v for k, v in self._textures.items() if k in ("normal", "metal")}
        textures = self._bake(objects, name, folder, channels=("color", "rough"), reuse={})
        # Copy shared maps into the variant folder so it uploads standalone.
        for channel in ("normal", "metal"):
            src_path = Path(base_textures[channel]["path"])
            dst_path = folder / f"{name}-{'normal' if channel == 'normal' else 'metalness'}.png"
            shutil.copyfile(src_path, dst_path)
            copy = bpy.data.images.load(str(dst_path))
            copy.colorspace_settings.name = "Non-Color"
            textures[channel] = {"file": dst_path.name, "width": self.texture, "height": self.texture, "image": copy,
                                 "path": dst_path}
        final = self._final_material(textures, f"SKYBREAK_{name}")
        for obj in objects:
            obj.data.materials.clear()
            obj.data.materials.append(final)
        render_previews(objects, folder, ground=False, glass=self.glass_parts, closeup=getattr(self, "closeup", None))
        fbx = folder / f"{name}.fbx"
        export_fbx(objects, fbx)
        checklist = self._checklist(objects, tris, textures, size, ground_offset, hinges, attachments,
                                    extra_notes, fbx, name=name, title=livery["title"], usage=livery["usage"],
                                    variant_of=self.name)
        (folder / "checklist.json").write_text(json.dumps(checklist, indent=2) + "\n")
        print(f"ASSET_DONE {name} tris={tris}")
        return name

    def _checklist(self, objects, tris, textures, size, ground_offset, hinges, attachments, extra_notes, fbx,
                   name=None, title=None, usage=None, variant_of=None) -> dict:
        name = name or self.name
        notes = {
            "noText": "Textures are baked from noise, grids and masks only; no letters, numbers, words, call signs or codes in mesh or texture.",
            "noLogosOrBrands": "No company, product or brand marks; colour fields and wear only.",
            "noRealMilitaryInsignia": "No roundels, flags, national or unit markings; shape is an original design, not a copy of any real vehicle or building.",
            "noFaces": "No faces, figures or face-like arrangements.",
            "noSuggestiveShapes": "Ordinary hard-surface or natural forms reviewed in all four previews.",
            "noGoreOrWeaponsGlorification": "No gore, blood or damage imagery; at most empty pylons or a covered deck mount.",
            "originalDesign": "Authored procedurally in tools/assets from original dimensions; no third-party meshes or scans.",
        }
        notes.update(extra_notes)
        checks = {key: {"value": True, "note": note} for key, note in notes.items()}
        record = {
            "name": name,
            "title": title or self.title,
            "variantOf": variant_of,
            "robloxAssetType": "Model",
            "usage": usage or self.usage,
            "generator": "tools/assets/" + Path(sys.argv[sys.argv.index("--python") + 1]).name if "--python" in sys.argv else "tools/assets",
            "fbx": {"file": fbx.name, "bytes": fbx.stat().st_size},
            "triangleCount": tris,
            "triangleLimit": self.tri_limit,
            "objects": [{"name": o.name, "triangles": triangles([o])} for o in objects],
            "textures": [
                {"role": role, "file": t["file"], "width": t["width"], "height": t["height"],
                 "bytes": Path(t["path"]).stat().st_size}
                for role, t in sorted(textures.items(), key=lambda kv: ("color", "normal", "rough", "metal").index(kv[0]))
            ],
            "robloxSizeStuds": [round(v, 3) for v in roblox_vec(size, absolute=True)],
            "studMetres": STUD_METRES,
            "fbxMetresPerStud": FBX_METRES_PER_STUD,
            "pivot": "bounds-center" if self.kind == "aircraft" else "bottom-center",
            "groundOffsetStuds": round(ground_offset, 3),
            "previews": ["preview-front.png", "preview-side.png", "preview-top.png", "preview-3q.png"]
            + (["preview-closeup.png"] if getattr(self, "closeup", None) else []),
            "checks": checks,
            "allChecksTrue": all(c["value"] for c in checks.values()),
        }
        record.update(self.extra)
        if hinges:
            record["controlSurfaces"] = hinges
        if attachments:
            record["attachments"] = {k: roblox_vec(self.shift(v)) for k, v in attachments.items()}
        return record


# --------------------------------------------------------------------------
# Scene utilities


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "NONE"
    scene.unit_settings.scale_length = 1.0
    # No dither noise and maximum PNG compression keep committed previews small and stable.
    scene.render.dither_intensity = 0.0
    scene.render.image_settings.compression = 100


def select(objects) -> None:
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def apply_modifiers(obj) -> None:
    if not obj.modifiers:
        return
    select([obj])
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def apply_transform(obj) -> None:
    # matrix_basis is current even before a depsgraph update (no parents are used).
    basis = obj.matrix_basis.copy()
    obj.data.transform(basis)
    if basis.determinant() < 0:
        obj.data.flip_normals()
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()


def join(objs, name: str):
    # Remember each face's zone so liveries can rebuild materials later.
    for obj in objs:
        obj["face_zones"] = [obj.data.materials[p.material_index].name.removeprefix("SRC_") for p in obj.data.polygons]
    if len(objs) > 1:
        select(objs)
        face_zones = []
        for obj in [objs[0]] + objs[1:]:
            face_zones.extend(obj["face_zones"])
        # bpy join keeps the active object's faces first, then the others in order.
        bpy.ops.object.join()
        target = objs[0]
        target["face_zones"] = face_zones
    target = objs[0]
    target.name = name
    target.data.name = f"{name}_Mesh"
    target["zones"] = sorted(set(target["face_zones"]))
    # Recompute face zones from actual material slots (robust to join ordering).
    target["face_zones"] = [target.data.materials[p.material_index].name.removeprefix("SRC_") for p in target.data.polygons]
    return target


def weighted_normals(obj) -> None:
    """Face-area weighted custom normals (keeps sharp edges): broad panels stay flat-shaded
    while their rounded edges carry the curvature, so silhouettes read as curved."""
    mod = obj.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
    mod.mode = "FACE_AREA"
    mod.weight = 50
    mod.keep_sharp = True
    mod.thresh = 0.01
    apply_modifiers(obj)


def triangulate(obj) -> None:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method="BEAUTY", ngon_method="EAR_CLIP")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def triangles(objects) -> int:
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def world_bounds(objects):
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for obj in objects:
        mw = obj.matrix_basis
        for v in obj.data.vertices:
            p = mw @ v.co
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    return lo, hi


def roblox_vec(v, absolute: bool = False) -> list[float]:
    v = Vector(v)
    out = [v.x, v.z, v.y]
    if absolute:
        out = [abs(c) for c in out]
    return [round(c, 4) for c in out]


def unwrap(objects) -> None:
    select(objects)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(58), island_margin=0.006, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.006)
    bpy.ops.object.mode_set(mode="OBJECT")


def export_fbx(objects, path: Path) -> None:
    select(objects)
    bpy.ops.export_scene.fbx(
        filepath=str(path),
        use_selection=True,
        object_types={"MESH"},
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_tspace=True,
        add_leaf_bones=False,
        bake_anim=False,
        axis_forward="-Z",
        axis_up="Y",
        # One Blender unit is one stud; write one FBX centimetre per stud (Roblox reads cm as studs).
        global_scale=FBX_METRES_PER_STUD,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_NONE",
        bake_space_transform=True,
        path_mode="COPY",
        embed_textures=True,
    )


def look_at(obj, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def glass_preview(objects, names) -> list:
    """Swap a see-through copy of the final material onto glass parts; returns restore info.
    The FBX keeps the opaque material: the game sets those parts' Transparency itself."""
    restore = []
    for obj in objects:
        if obj.name not in names or not obj.data.materials:
            continue
        base = obj.data.materials[0]
        clear = base.copy()
        clear.name = f"{base.name}_previewglass"
        bsdf = clear.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Alpha"].default_value = 0.6
        try:
            clear.surface_render_method = "BLENDED"
        except Exception:
            pass
        obj.data.materials[0] = clear
        restore.append((obj, base, clear))
    return restore


def render_previews(objects, folder: Path, ground: bool = True, glass=(), closeup=None, engine="BLENDER_EEVEE",
                    only_closeup: str | None = None) -> None:
    scene = bpy.context.scene
    scene.render.engine = engine
    if engine == "BLENDER_WORKBENCH":
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "SINGLE"
        scene.display.shading.show_cavity = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    try:
        scene.eevee.taa_render_samples = 48
    except Exception:
        pass
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    world = scene.world or bpy.data.worlds.new("Preview")
    scene.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get("Background") or world.node_tree.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.26, 0.27, 0.28, 1)
    bg.inputs["Strength"].default_value = 0.8
    out = world.node_tree.nodes.get("World Output") or world.node_tree.nodes.new("ShaderNodeOutputWorld")
    world.node_tree.links.new(bg.outputs[0], out.inputs[0])

    lo, hi = world_bounds(objects)
    center = (lo + hi) / 2
    extent = hi - lo
    radius = extent.length / 2
    helpers = []
    restore = glass_preview(objects, glass)
    if ground:
        bpy.ops.mesh.primitive_plane_add(size=max(extent.x, extent.y) * 6, location=(center.x, center.y, lo.z - 0.02))
        plane = bpy.context.object
        pm = bpy.data.materials.new("PreviewGround")
        pm.diffuse_color = (0.3, 0.31, 0.32, 1)
        try:
            pm.use_nodes = True
        except Exception:
            pass
        pb = pm.node_tree.nodes.get("Principled BSDF")
        pb.inputs["Base Color"].default_value = (0.3, 0.31, 0.32, 1)
        pb.inputs["Roughness"].default_value = 0.9
        plane.data.materials.append(pm)
        helpers.append(plane)
    sun_data = bpy.data.lights.new("PreviewSun", "SUN")
    sun_data.energy = 4.0
    sun_data.angle = math.radians(3)
    sun = bpy.data.objects.new("PreviewSun", sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    helpers.append(sun)
    if closeup is not None:
        # Assets with a close-up also get a soft fill from the opposite side so shaded
        # flanks (intakes, cockpit sills) stay readable.
        fill_data = bpy.data.lights.new("PreviewFill", "SUN")
        fill_data.energy = 1.2
        fill_data.angle = math.radians(20)
        fill = bpy.data.objects.new("PreviewFill", fill_data)
        scene.collection.objects.link(fill)
        fill.rotation_euler = (math.radians(65), 0, math.radians(145))
        helpers.append(fill)
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    helpers.append(cam)
    cam_data.clip_end = radius * 40
    cam_data.clip_start = max(radius / 500, 0.01)

    views = {
        "front": (Vector((0, -1, 0)), max(extent.x, extent.z)),
        "side": (Vector((1, 0, 0)), max(extent.y, extent.z)),
        "top": (Vector((0, 0, 1)), max(extent.x, extent.y)),
    }
    if only_closeup:
        views = {}
    for view, (direction, span) in views.items():
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = span * 1.15
        cam.location = center + direction * radius * 4
        if view == "top":
            cam.rotation_euler = (0, 0, math.pi)
        else:
            look_at(cam, center)
        scene.render.filepath = str(folder / f"preview-{view}.png")
        bpy.ops.render.render(write_still=True)
    cam_data.type = "PERSP"
    cam_data.lens = 50
    cam_data.sensor_width = 36
    half = math.atan(18 / 50)
    direction = Vector((-1.0, -1.25, 0.8)).normalized()
    cam.location = center + direction
    look_at(cam, center)
    basis = cam.rotation_euler.to_matrix()
    right, upv, back = basis.col[0], basis.col[1], basis.col[2]
    need = 0.0
    for obj in objects:
        mw = obj.matrix_basis
        for v in obj.data.vertices:
            c = mw @ v.co - center
            depth = c.dot(back)
            need = max(need, abs(c.dot(right)) / math.tan(half) + depth, abs(c.dot(upv)) / math.tan(half) + depth)
    cam.location = center + direction * need * 1.08
    scene.render.filepath = str(folder / "preview-3q.png")
    if not only_closeup:
        bpy.ops.render.render(write_still=True)
    if closeup is not None:
        target, view, distance = closeup
        cam_data.lens = 50
        cam.location = target + view * distance
        look_at(cam, target)
        scene.render.filepath = str(folder / f"preview-{only_closeup or 'closeup'}.png")
        bpy.ops.render.render(write_still=True)
    for h in helpers:
        bpy.data.objects.remove(h, do_unlink=True)
    for obj, base, clear in restore:
        obj.data.materials[0] = base
        bpy.data.materials.remove(clear)
