"""Mission 1 upload assets: the heavy bomber and the aircraft carrier.

    tools/assets/build-all.sh heavy-bomber carrier

Both are original designs (D-001): no copy of any specific real or game aircraft
or ship, and no text, numbers, insignia, flags, logos or glyph-like marks.

* ``heavy-bomber``: the six bombers of mission 1 (fly in formation, never fire).
  Long slender fuselage with an upswept tail, shoulder-mounted 33-degree swept
  wing with slight anhedral, four podded turbofans on pylons, a swept fin over
  low-set tailplanes, landing-gear sponsons and closed bomb-bay doors. No guns,
  turret or weapons. 72 studs span (2.9x the Vanta, 3.2x the Kestrel), one
  ``Body`` part, 1024 maps, aircraft budget (<= 15,000 triangles).
* ``carrier``: the mission 1 start reference (scripted fly-off from the bow) and
  intro dressing. Flat deck with a 9-degree angled landing area, a starboard
  island, two bow catapults with blast deflectors, deck-edge elevators, sponsons
  with covered point-defence domes and a waterline hull. 560 studs long so a
  26-stud fighter on deck has real-carrier proportions. Large-prop budget
  (<= 6,000 triangles, 512 maps). No parked aircraft (a Kestrel mesh would blow
  the triangle budget; the game can place Kestrel models on deck) and no crew.

After the standard ``Asset.finish()`` (bake, four previews, FBX, checklist) each
builder renders extra review views (back, port side, bottom, more 3/4 views and
close-ups), records SHA-256 hashes of the FBX and textures in the checklist,
writes ``contact-sheet.png`` in the folder and checks the same budgets as
``write_manifest.py``. These folders are deliberately **not** in
``write_manifest.KEYS``: nothing in ``src/`` refers to them until an independent
reviewer approves them and the coordinator uploads them.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import subprocess
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

from aircraft import naca, surface, wing_frame, fin_frame
from aircraft_v2 import fan_face, pchip, soot_liner
from skyasset import Asset, Nodes, look_at, roblox_vec, srgb, standard, world_bounds
import zones as Z

BUILDERS: dict = {}
HERE = Path(__file__).resolve().parent


def builder(name):
    def wrap(fn):
        BUILDERS[name] = fn
        return fn
    return wrap


# --------------------------------------------------------------------------
# Shared review pack


def _line(n: Nodes, x, y, p0, p1, width, soft=0.25, dash=None):
    """1 on a straight painted line from p0 to p1 (deck plan coordinates); dash=(period, filled)."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    rx, ry = n.sub(x, p0[0]), n.sub(y, p0[1])
    t = n.add(n.mul(rx, ux), n.mul(ry, uy))
    perp = n.absf(n.sub(n.mul(rx, uy), n.mul(ry, ux)))
    m = n.mul(n.band(t, 0.0, length, soft), n.smooth(perp, width / 2 + soft, width / 2 - soft))
    if dash is not None:
        m = n.mul(m, n.rect(t, dash[0], dash[1], 0.0, soft))
    return m


def _frame_distance(objects, center, direction, lens=50.0):
    half = math.atan(18 / lens)
    cam = bpy.data.objects.new("Probe", None)
    cam.location = center + direction
    look_at(cam, center)
    basis = cam.rotation_euler.to_matrix()
    bpy.data.objects.remove(cam, do_unlink=True)
    right, upv, back = basis.col[0], basis.col[1], basis.col[2]
    need = 0.0
    for obj in objects:
        mw = obj.matrix_basis
        for v in obj.data.vertices:
            c = mw @ v.co - center
            depth = c.dot(back)
            need = max(need, abs(c.dot(right)) / math.tan(half) + depth, abs(c.dot(upv)) / math.tan(half) + depth)
    return need * 1.08


def review_previews(objects, folder: Path, views: dict, closeups: dict) -> list[str]:
    """Extra 1024x1024 Eevee views with the final baked material.

    ``views``: name -> (direction from centre, "ortho" | "persp"); ``closeups``: name ->
    (target, direction, distance) in the delivered frame. No ground plane, so the
    underside is visible; a key sun as in ``skyasset.render_previews`` plus a fill and
    an under-light so shaded and lower surfaces stay readable.
    """
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    try:
        scene.eevee.taa_render_samples = 48
    except Exception:
        pass
    scene.view_settings.view_transform = "AgX"
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

    helpers = []
    for name, energy, angle, rot in (("Key", 4.0, 3, (50, 0, -35)), ("Fill", 1.2, 20, (65, 0, 145)),
                                     ("Under", 1.6, 25, (150, 0, 30))):
        data = bpy.data.lights.new(f"Review{name}", "SUN")
        data.energy = energy
        data.angle = math.radians(angle)
        light = bpy.data.objects.new(f"Review{name}", data)
        scene.collection.objects.link(light)
        light.rotation_euler = tuple(math.radians(v) for v in rot)
        helpers.append(light)
    cam_data = bpy.data.cameras.new("ReviewCam")
    cam = bpy.data.objects.new("ReviewCam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    helpers.append(cam)
    lo, hi = world_bounds(objects)
    center = (lo + hi) / 2
    extent = hi - lo
    radius = extent.length / 2
    cam_data.clip_end = radius * 40
    cam_data.clip_start = max(radius / 500, 0.01)
    written = []
    for view, (direction, mode) in views.items():
        d = Vector(direction).normalized()
        if mode == "ortho":
            cam_data.type = "ORTHO"
            spans = {0: (extent.y, extent.z), 1: (extent.x, extent.z), 2: (extent.x, extent.y)}
            axis = max(range(3), key=lambda i: abs(d[i]))
            cam_data.ortho_scale = max(spans[axis]) * 1.15
            cam.location = center + d * radius * 4
            if axis == 2:
                cam.rotation_euler = (0, 0, math.pi) if d.z > 0 else (math.pi, 0, 0)
            else:
                look_at(cam, center)
        else:
            cam_data.type = "PERSP"
            cam_data.lens = 50
            cam_data.sensor_width = 36
            cam.location = center + d * _frame_distance(objects, center, d)
            look_at(cam, center)
        scene.render.filepath = str(folder / f"preview-{view}.png")
        bpy.ops.render.render(write_still=True)
        written.append(f"preview-{view}.png")
    cam_data.type = "PERSP"
    cam_data.lens = 50
    for view, (target, direction, distance) in closeups.items():
        cam.location = Vector(target) + Vector(direction).normalized() * distance
        look_at(cam, Vector(target))
        scene.render.filepath = str(folder / f"preview-{view}.png")
        bpy.ops.render.render(write_still=True)
        written.append(f"preview-{view}.png")
    for h in helpers:
        bpy.data.objects.remove(h, do_unlink=True)
    return written


def scale_reference(folder: Path, ref: dict) -> str:
    """Review-only render with an already approved upload (Kestrel or Vanta v2) placed at in-game
    size beside the new asset. The reference is imported after this asset's FBX was written and
    is never part of it."""
    before = set(bpy.context.scene.objects)
    c = json.loads((ref["folder"] / "checklist.json").read_text())
    bpy.ops.import_scene.fbx(filepath=str(ref["folder"] / c["fbx"]["file"]))
    imported = [o for o in bpy.context.scene.objects if o not in before]
    k = 1.0 / c.get("fbxMetresPerStud", 0.28)
    for o in imported:
        o.matrix_world = Matrix.Translation(ref["location"]) @ Matrix.Scale(k, 4) @ o.matrix_world
    view = {"scale-reference": (ref["target"], ref["direction"], ref["distance"])}
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH" and o not in imported]
    for o in imported:
        if o.type == "MESH":
            o.data.transform(o.matrix_basis)
            o.matrix_basis = Matrix.Identity(4)
    review_previews(objects + [o for o in imported if o.type == "MESH"], folder, {}, view)
    for o in imported:
        bpy.data.objects.remove(o, do_unlink=True)
    return "preview-scale-reference.png"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# Same rules as write_manifest.py (which does not list these folders yet).
REQUIRED_CHECKS = ("noText", "noLogosOrBrands", "noRealMilitaryInsignia", "noFaces", "noSuggestiveShapes",
                   "noGoreOrWeaponsGlorification", "originalDesign")


def review_pack(a: Asset, views: dict, closeups: dict, texture_limit: int, extra: dict, scale_ref: dict | None = None) -> None:
    """Extra previews, contact sheet, hashes and budget checks after ``Asset.finish()``."""
    if os.environ.get("SKYASSET_DRAFT"):
        return
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    folder = a.out
    shifted = {k: (a.shift(t), d, dist) for k, (t, d, dist) in closeups.items()}
    extra_previews = review_previews(objects, folder, views, shifted)
    if scale_ref is not None:
        ref = dict(scale_ref, location=a.shift(scale_ref["location"]), target=a.shift(scale_ref["target"]))
        scale_image = scale_reference(folder, ref)
    path = folder / "checklist.json"
    c = json.loads(path.read_text())
    c["previews"] = c["previews"] + extra_previews
    c["previewNotes"] = {
        "preview-front.png": "Orthographic from ahead (-Z in Roblox).",
        "preview-side.png": "Orthographic from starboard (+X).",
        "preview-top.png": "Orthographic from above, front at the top.",
        "preview-3q.png": "Perspective, front-left from above.",
        **{p: "Extra review view: see the file name (orthographic for back, side-port and bottom; perspective otherwise)."
           for p in extra_previews},
    }
    c.update(extra)
    c["reviewStatus"] = "pending independent safety review (AGENTS.md); not uploaded; not referenced from src/"
    files = [c["fbx"]["file"]] + [t["file"] for t in c["textures"]]
    c["sha256"] = {f: sha256(folder / f) for f in files}
    problems = []
    for check in REQUIRED_CHECKS:
        if c["checks"].get(check, {}).get("value") is not True:
            problems.append(f"{check} is not true")
    if c["triangleCount"] > c["triangleLimit"]:
        problems.append(f"{c['triangleCount']} triangles over {c['triangleLimit']}")
    for t in c["textures"]:
        if t["width"] > texture_limit or t["height"] > texture_limit:
            problems.append(f"texture {t['file']} exceeds {texture_limit}")
    for p in c["previews"]:
        if not (folder / p).exists():
            problems.append(f"missing {p}")
    if problems:
        raise RuntimeError(f"{a.name}: " + "; ".join(problems))
    path.write_text(json.dumps(c, indent=2) + "\n")
    if scale_ref is not None:
        c["scaleReference"] = {"file": scale_image, "reference": scale_ref["folder"].name,
                               "note": "Review aid only: an approved, already uploaded asset placed at in-game size for scale. Not part of this asset or its FBX."}
        path.write_text(json.dumps(c, indent=2) + "\n")
    sheet = [str(folder / p) for p in c["previews"]] + ([str(folder / scale_image)] if scale_ref is not None else [])
    subprocess.run([bpy.app.binary_path, "--background", "--factory-startup", "--python", str(HERE / "contact_sheet.py"),
                    "--", str(folder / "contact-sheet.png"), "4", *sheet], check=True, capture_output=True)
    print(f"REVIEW_PACK {a.name} previews={len(c['previews'])} fbx_sha256={c['sha256'][c['fbx']['file']]}")


# --------------------------------------------------------------------------
# Heavy bomber

BOMBER_SPAN_HALF = 36.0
B_WING_Z = 2.3
B_ROOT, B_TIP = 2.4, 36.0
B_SWEEP = math.tan(math.radians(33))
B_ANHEDRAL = math.radians(-4.0)
B_ENGINES = (10.0, 21.0)
B_NACELLE = dict(len=9.6, r=1.45, drop=2.45, ahead=4.8)


def b_le(s):
    return -6.0 + (s - B_ROOT) * B_SWEEP


def b_chord(s):
    return 14.0 - (s - B_ROOT) * (10.0 / (B_TIP - B_ROOT))


def b_wing_z(s):
    return B_WING_Z + s * math.tan(B_ANHEDRAL)


# Fuselage lines (y, value) nose to tail: straight top line, upswept underside.
B_TOP = [(-31.0, -0.3), (-29.5, 0.7), (-28.0, 1.45), (-26.0, 2.25), (-23.5, 3.25), (-21.0, 3.55), (-18.0, 3.4),
         (-14.0, 3.05), (-8.0, 3.0), (22.0, 3.0), (26.0, 2.85), (29.0, 2.45), (31.0, 2.1)]
B_BOT = [(-31.0, -0.5), (-29.5, -1.3), (-28.0, -1.9), (-25.0, -2.55), (-21.0, -2.9), (8.0, -2.9), (14.0, -2.65),
         (19.0, -1.9), (24.0, -0.6), (28.0, 0.55), (31.0, 1.2)]
B_HALF_W = [(-31.0, 0.03), (-29.5, 0.95), (-28.0, 1.5), (-25.0, 2.15), (-21.0, 2.6), (-17.0, 2.75), (12.0, 2.75),
            (18.0, 2.45), (23.0, 1.85), (27.0, 1.25), (31.0, 0.62)]


def _lines(points):
    return pchip([p[0] for p in points], [p[1] for p in points])


b_top, b_bot, b_half = _lines(B_TOP), _lines(B_BOT), _lines(B_HALF_W)


def bomber_paint():
    """Vanta-family enemy finish scaled for a 72-stud airframe: grey countershading with a
    dark splinter pattern on top, a slightly darker radome, dark windscreen panels, panel lines, bomb-bay
    outline, exhaust soot and two plain dark-red accents (fin-tip band, nacelle lip bands)."""
    upper, lower = "#4a5159", "#6c757e"
    camo = ("#373d44", "#59616a", "#2a2f35")
    w = 0.07

    def bands(n: Nodes, coord, values, width):
        m = 0.0
        for c in values:
            m = n.maxf(m, n.band(coord, c - width / 2, c + width / 2, width * 0.3))
        return m

    def pattern(n: Nodes, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        nx, ny, nz = n.xyz(n.normal())
        ax, anx, anz = n.absf(x), n.absf(nx), n.absf(nz)
        top = n.smooth(nz, -0.35, 0.15)
        col = n.vlerp(srgb(lower), srgb(upper), top)
        # Splinter camouflage on the upper surfaces (same construction as the Vanta, larger cells).
        q = n.vmul(p, (1.0, 0.75, 1.0))
        warp = n.noise(q, 0.1, 1.0, 0.5)
        q = n.vmath("ADD", q, n.vec(n.mul(warp, 4.0), n.mul(warp, -3.0), 0.0))
        cell = n.voronoi(q, 0.15, "F1", "CHEBYCHEV", "Color", 1.0)
        cx, cy, cz = n.xyz(cell)
        tone = n.vlerp(srgb(camo[0]), srgb(camo[1]), n.smooth(cx, 0.36, 0.37))
        tone = n.vlerp(tone, srgb(camo[2]), n.smooth(cy, 0.7, 0.71))
        col = n.vlerp(col, tone, n.mul(top, n.smooth(cz, 0.3, 0.31)))
        # Radome only a shade darker than the body (a dark nose under the dark windscreen band
        # would make the front view read like a face); anti-glare panel ahead of the windscreen.
        col = n.vlerp(col, srgb("#5b626a"), n.smooth(y, -28.1, -28.3))
        ag = n.mul(n.mul(n.band(y, -28.1, -25.8, 0.05), n.smooth(nz, 0.3, 0.5)), n.smooth(ax, 1.2, 1.0))
        col = n.vlerp(col, srgb("#3a3e43"), ag)
        # Windscreen: dark glass panels on the cockpit hump, framed; one continuous band.
        screen = n.mul(n.mul(n.band(y, -25.6, -21.6, 0.05), n.smooth(z, 1.75, 1.95)), n.smooth(ax, 2.3, 2.1))
        screen = n.mul(screen, n.smooth(z, 3.5, 3.3))
        frames = n.maxf(n.lines(x, 0.95, 0.07), n.lines(y, 2.0, 0.07, 0.3))
        glass = n.vlerp(srgb("#1e2932"), srgb("#3a4148"), frames)
        col = n.vlerp(col, glass, screen)
        # Accents: dark red fin-tip band and nacelle lip bands (plain geometric bands).
        accent = n.mul(n.smooth(z, 11.5, 11.6), n.smooth(ax, 0.6, 0.4))
        for ex in B_ENGINES:
            y0 = b_le(ex) - B_NACELLE["ahead"]
            ez = b_wing_z(ex) - B_NACELLE["drop"]
            r = n.vmath("LENGTH", n.vec(n.sub(ax, ex), 0.0, n.sub(z, ez)))
            ring = n.mul(n.smooth(r, 1.25, 1.32), n.smooth(r, 1.8, 1.72))
            accent = n.maxf(accent, n.mul(n.band(y, y0 + 0.25, y0 + 0.85, 0.03), ring))
        col = n.vlerp(col, srgb("#6e2a24"), accent)

        # Panel lines: fuselage frames and longerons, wing spars, ribs and control-surface hinges.
        body = n.smooth(ax, 3.0, 2.85)
        on_wing = n.mul(n.sub(1.0, body), n.mul(n.smooth(anz, 0.5, 0.7), n.smooth(n.absf(n.sub(z, B_WING_Z)), 1.6, 1.2)))
        frames_m = n.mul(bands(n, y, [-28.2, -25.8, -21.0, -16.0, -11.5, -6.0, 0.0, 6.0, 11.0, 16.0, 21.0, 26.0], w), body)
        frames_m = n.mul(frames_m, n.sub(1.0, screen))
        long_m = n.mul(n.mul(bands(n, z, [1.6, -0.4, -1.9], w), n.smooth(anx, 0.45, 0.7)), body)
        spine = n.mul(n.mul(bands(n, ax, [0.9], w), n.smooth(nz, 0.5, 0.7)), body)
        le = n.add(-6.0, n.mul(n.sub(ax, B_ROOT), B_SWEEP))
        chord = n.sub(14.0, n.mul(n.sub(ax, B_ROOT), 10.0 / (B_TIP - B_ROOT)))
        u = n.math("DIVIDE", n.sub(y, le), chord)
        spars = n.mul(bands(n, u, [0.13, 0.66], 0.008), on_wing)
        hinge = n.mul(n.mul(bands(n, u, [0.76], 0.008), on_wing), n.smooth(ax, 4.0, 4.3))
        ribs = n.mul(bands(n, ax, [6.0, 13.5, 16.5, 24.0, 28.0, 33.0], w), n.mul(on_wing, n.smooth(u, 0.78, 0.74)))
        # Flap / aileron split.
        split = n.mul(n.mul(bands(n, ax, [24.0], w), on_wing), n.smooth(u, 0.74, 0.78))
        bay = n.mul(n.band(y, -12.0, 6.0, 0.05), n.band(x, -1.45, 1.45, 0.05))
        bay_in = n.mul(n.band(y, -12.0 + w, 6.0 - w, 0.05), n.band(x, -1.45 + w, 1.45 - w, 0.05))
        belly = n.smooth(nz, -0.5, -0.7)
        bay_lines = n.mul(n.maxf(n.sub(bay, bay_in), n.mul(bay, bands(n, x, [0.0], w))), belly)
        lines = n.maxf(n.maxf(n.maxf(frames_m, long_m), n.maxf(spars, hinge)), n.maxf(n.maxf(ribs, split), n.maxf(bay_lines, spine)))
        col = n.vscale(col, n.sub(1.0, n.mul(lines, 0.4)))
        col = n.vscale(col, n.sub(1.0, n.mul(n.mul(bay_in, belly), 0.05)))
        # Weathering: faded tops, rearward streaks, belly stains, exhaust soot behind each engine.
        col = n.vlerp(col, srgb("#c9ccc8"), n.mul(n.smooth(nz, 0.6, 1.0), n.mul(n.noise(n.vmul(p, (1.0, 0.4, 1.0)), 0.25, 3.0, 0.6), 0.06)))
        streak = n.smooth(n.noise(n.vmul(p, (3.0, 0.1, 3.0)), 0.7, 3.0, 0.55), 0.52, 0.75)
        col = n.vscale(col, n.sub(1.0, n.mul(streak, 0.09)))
        stain = n.mul(n.smooth(nz, -0.3, -0.75), n.smooth(n.noise(n.vmul(p, (1.0, 0.25, 1.0)), 0.4, 4.0, 0.6), 0.55, 0.72))
        col = n.vlerp(col, srgb("#3d3b35"), n.mul(stain, 0.3))
        soot = 0.0
        for ex in B_ENGINES:
            y_exit = b_le(ex) - B_NACELLE["ahead"] + B_NACELLE["len"]
            soot = n.maxf(soot, n.mul(n.smooth(n.absf(n.sub(ax, ex)), 1.7, 0.6), n.smooth(y, y_exit - 2.5, y_exit + 1.0)))
        soot = n.mul(soot, n.add(0.5, n.mul(streak, 0.5)))
        col = n.vlerp(col, srgb("#26262a"), n.mul(soot, 0.55))
        rough_delta = n.add(n.mul(lines, 0.12), n.mul(soot, 0.18))
        height = n.sub(0.5, n.mul(lines, 0.6))
        return col, rough_delta, height

    return standard(upper, 0.55, 0.06, pattern=pattern, vary=0.035, vary_scale=0.06, grime=0.06, grime_scale=0.06,
                    ao=0.32, ao_dist=2.0)


def nacelle(a: Asset, tag, zones, side, s):
    paint, lip, duct, fan, liner, metal = zones
    N = B_NACELLE
    x = side * s
    zc = b_wing_z(s) - N["drop"]
    y0 = b_le(s) - N["ahead"]
    y1 = y0 + N["len"]
    r = N["r"]
    n = 22

    def ring(rr, y, dz=0.0):
        return [(x + rr * math.cos(t), y, zc + dz + rr * 0.97 * math.sin(t)) for t in (k * math.tau / n for k in range(n))]

    prof = [(0.0, 1.0), (0.06, 1.05), (0.22, 1.08), (0.5, 1.04), (0.75, 0.93), (0.92, 0.8), (1.0, 0.74)]
    a.loft(f"Nacelle {tag}", [ring(r * k, y0 + t * N["len"]) for t, k in prof], paint, part="Body", cap_start=False,
           cap_end=False, smooth=50)
    # Intake lip (bare metal) turning into the duct, ending on the fan face.
    a.loft(f"Lip {tag}", [ring(r * 0.995, y0 + 0.002), ring(r * 0.97, y0 - 0.06), ring(r * 0.9, y0 - 0.02), ring(r * 0.86, y0 + 0.2)],
           lip, part="Body", cap_start=False, cap_end=False, smooth=50)
    a.loft(f"Duct {tag}", [ring(r * 0.86, y0 + 0.2), ring(r * 0.82, y0 + 1.1)], duct, part="Body", cap_start=False,
           cap_end=False, smooth=50)
    a.cyl(f"Fan {tag}", r * 0.82, 0.06, (x, y0 + 1.1, zc), fan, part="Body", segs=n, rot=(math.radians(90), 0, 0))
    a.cyl(f"Spinner {tag}", r * 0.3, 0.5, (x, y0 + 0.86, zc), fan, part="Body", segs=12, r2=0.04,
          rot=(math.radians(90), 0, 0))
    # Exhaust: liner, centre plug.
    a.loft(f"Liner {tag}", [ring(r * 0.74, y1), ring(r * 0.66, y1 - 0.15), ring(r * 0.6, y1 - 1.2)], liner, part="Body",
           cap_start=False, cap_end=True, smooth=50)
    plug = []
    for t, rr in ((0.0, 0.42), (0.5, 0.36), (1.0, 0.18), (1.25, 0.04)):
        plug.append(ring(r * rr, y1 - 0.9 + t * 1.6))
    a.loft(f"Plug {tag}", plug, metal, part="Body", cap_start=False, smooth=50)
    # Pylon from the nacelle top into the wing underside.
    wz = b_wing_z(s) - naca(0.3, 0.11) * b_chord(s) * 0.5
    outline = [(y0 + 1.6, zc + r * 0.9), (y0 + 3.2, wz + 0.4), (b_le(s) + b_chord(s) * 0.55, wz + 0.4),
               (y1 - 0.6, zc + r * 0.7), (y1 - 1.8, zc + r * 0.6)]
    a.prism(f"Pylon {tag}", outline, x - 0.28, x + 0.28, paint, part="Body", axis="x", smooth=None)
    return (x, y1 + 0.4, zc)


@builder("heavy-bomber")
def heavy_bomber():
    a = Asset("heavy-bomber", "Heavy bomber (mission 1 raid)", texture=1024, kind="aircraft", tri_limit=15000,
              bump_distance=0.02, seed=301, weighted_normals=True,
              usage="Mission 1: six bombers in formation (required targets, never fire). Pending review; not referenced from src/.")
    paint = a.zone("paint", bomber_paint())
    lip = a.zone("lip", standard("#9a9ea2", 0.32, 0.9, grime=0.05, ao=0.2, ao_dist=0.4))
    duct = a.zone("duct", standard("#7d8286", 0.55, 0.2, grime=0.2, ao=0.6, ao_dist=0.8))
    fan_in = a.zone("fan_in", fan_face((B_ENGINES[0], b_wing_z(B_ENGINES[0]) - B_NACELLE["drop"])))
    fan_out = a.zone("fan_out", fan_face((B_ENGINES[1], b_wing_z(B_ENGINES[1]) - B_NACELLE["drop"])))
    liner = a.zone("liner", soot_liner())
    metal = a.zone("metal", standard("#6a6a66", 0.4, 0.85, grime=0.2, ao=0.45, ao_dist=0.8))
    dark = a.zone("dark", standard("#1a1b1d", 0.8, 0.2, grime=0.0, ao=0.4, ao_dist=0.6))
    rail = a.zone("rail", standard("#5c6166", 0.55, 0.3, grime=0.15, ao=0.4, ao_dist=0.5))
    light = a.zone("light", standard("#8e9677", 0.4, 0.0, grime=0.05, ao=0.2, ao_dist=0.3))
    probe_z = a.zone("probe", standard("#8e9295", 0.35, 0.85, grime=0.1, ao=0.3, ao_dist=0.4))

    # Fuselage: 26-point superellipse rings along the pchip lines.
    n = 26
    ys = [-31.0, -30.6, -30.1, -29.5, -28.8, -28.0, -27.0, -26.0, -25.0, -24.0, -23.0, -22.0, -21.0, -19.5, -18.0, -16.0,
          -14.0, -11.0, -8.0, -5.0, -2.0, 1.0, 4.0, 7.0, 10.0, 12.5, 15.0, 17.0, 19.0, 21.0, 23.0, 25.0, 27.0, 29.0, 30.2,
          31.0]
    rings = []
    for y in ys:
        t, bt, w = b_top(y), b_bot(y), b_half(y)
        zc, hh = (t + bt) / 2, (t - bt) / 2
        ring = []
        for k in range(n):
            ang = k / n * math.tau
            c, s = math.cos(ang), math.sin(ang)
            p = 2.25
            ring.append((w * math.copysign(abs(c) ** (2 / p), c), y, zc + hh * math.copysign(abs(s) ** (2 / p), s)))
        rings.append(ring)
    a.loft("Fuselage", rings, paint, part="Body", cap_start=True, cap_end=True, smooth=60)
    # Tail cone sting (tail-warning radar fairing; no guns).
    zt = (b_top(31.0) + b_bot(31.0)) / 2
    a.cyl("Tail sting", 0.55, 2.2, (0, 32.0, zt), paint, part="Body", segs=14, r2=0.16, rot=(math.radians(-90), 0, 0))
    # Refuelling probe offset to starboard of the windscreen (breaks the front-view symmetry).
    a.beam("Probe fairing", (0.9, -21.5, 3.35), (0.75, -25.0, 2.95), 0.32, paint, part="Body", segs=8)
    a.beam("Probe", (0.75, -24.6, 3.0), (0.62, -31.4, 2.1), 0.15, probe_z, part="Body", segs=8)
    a.cyl("Probe tip", 0.11, 0.3, (0.62, -31.55, 2.08), dark, part="Body", segs=8, r2=0.04, rot=(math.radians(90), 0, 0))
    a.cyl("Pitot", 0.05, 1.2, (-1.2, -28.6, -0.3), probe_z, part="Body", segs=6, rot=(math.radians(90), 0, 0))
    # Landing-gear sponsons along the lower fuselage under the wing.
    for side in (-1, 1):
        sp = []
        for yy, rr, hh in ((-7.0, 0.05, 0.05), (-5.2, 0.85, 0.7), (-2.5, 1.35, 1.1), (4.0, 1.45, 1.2), (9.5, 1.3, 1.05),
                           (13.5, 0.7, 0.55), (15.5, 0.05, 0.05)):
            sp.append([(side * (2.35 + rr * 0.62 * math.cos(t)), yy, -1.95 + hh * math.sin(t))
                       for t in (k * math.tau / 14 for k in range(14))])
        a.loft(f"Sponson {side}", sp, paint, part="Body", smooth=55)
    # Ventral radar blister and dorsal satcom fairing.
    bl = []
    for yy, rr in ((-20.0, 0.05), (-18.6, 0.8), (-16.0, 1.15), (-13.0, 1.1), (-11.0, 0.6), (-10.0, 0.05)):
        bl.append([(rr * 1.2 * math.cos(t), yy, b_bot(yy) + 0.05 + rr * 0.55 * math.sin(t)) for t in (k * math.tau / 16 for k in range(16))])
    a.loft("Radar blister", bl, paint, part="Body", smooth=55)
    df = []
    for yy, rr in ((-2.0, 0.05), (-1.2, 0.5), (0.5, 0.75), (2.5, 0.7), (4.2, 0.35), (5.0, 0.05)):
        df.append([(rr * 0.9 * math.cos(t), yy, 2.95 + rr * 0.5 * math.sin(t)) for t in (k * math.tau / 14 for k in range(14))])
    a.loft("Dorsal fairing", df, paint, part="Body", smooth=55)
    # Wing-box fairing where the shoulder wing passes over the fuselage.
    wf = []
    for yy, ww, hh in ((-9.5, 0.05, 0.02), (-7.5, 1.6, 0.95), (-4.0, 2.25, 1.25), (1.0, 2.35, 1.3), (6.0, 2.2, 1.1),
                       (10.0, 1.6, 0.7), (13.0, 0.05, 0.02)):
        wf.append([(ww * math.cos(t), yy, 2.2 + hh * math.sin(t)) for t in (k * math.tau / 18 for k in range(18))])
    a.loft("Wing fairing", wf, paint, part="Body", smooth=55)
    for i, (y, z, h, flip) in enumerate(((-10.0, 3.0, 0.9, 1), (9.0, 3.0, 0.7, 1), (16.0, -2.85, -0.7, -1), (-6.5, -2.9, -0.6, -1))):
        outline = [(0.0, 0.0), (1.1, 0.0), (0.75 + abs(h) * 0.5, h), (abs(h) * 0.5, h)]
        a.prism(f"Blade {i}", [(y + u, z - flip * 0.05 + v) for u, v in outline], -0.04, 0.04, rail, part="Body", axis="x")

    # Wing: shoulder-mounted, 33 deg leading-edge sweep, slight anhedral.
    tc = lambda s: 0.13 - 0.04 * (s - B_ROOT) / (B_TIP - B_ROOT)
    exhausts = []
    tips = {}
    for side, tag in ((-1, "L"), (1, "R")):
        f = wing_frame(B_WING_Z, side, B_ANHEDRAL)
        surface(a, f"Wing {tag}", paint, "Body", f, [0.0, B_ROOT, 4.5, 8.0, 12.0, 16.5, 21.0, 26.0, 31.0, 34.5, B_TIP], b_le, b_chord, tc,
                samples=14)
        # Wingtip fairing with a formation light.
        tip = Vector(f(B_TIP, b_le(B_TIP), 0))
        tc_tip = tc(B_TIP) * b_chord(B_TIP)
        a.sphere(f"Tip pod {tag}", 1.0, (tip.x + side * 0.05, b_le(B_TIP) + b_chord(B_TIP) * 0.45, tip.z), paint, part="Body",
                 subdiv=2, scale=(0.32, b_chord(B_TIP) * 0.56, max(tc_tip * 0.6, 0.22)))
        a.box(f"Tip light {tag}", (0.08, 0.6, 0.1), (tip.x + side * 0.33, b_le(B_TIP) + 1.4, tip.z), light, part="Body")
        tips[tag] = (tip.x + side * 0.3, b_le(B_TIP) + b_chord(B_TIP), tip.z)
        # Wing fence and flap-track fairings.
        fx = 16.5
        fz = f(fx, 0, 0)[2]
        fence = [(b_le(fx) - 0.05, fz - 0.05), (b_le(fx) + 1.2, fz + 0.75), (b_le(fx) + b_chord(fx) * 0.72, fz + 0.55),
                 (b_le(fx) + b_chord(fx) * 0.8, fz + 0.05)]
        a.prism(f"Fence {tag}", fence, side * fx - 0.05, side * fx + 0.05, paint, part="Body", axis="x")
        for k, s in enumerate((6.5, 15.0, 27.5, 31.5)):
            yy = b_le(s) + b_chord(s) * 0.62
            zz = f(s, 0, 0)[2] - naca(0.62, tc(s)) * b_chord(s)
            ft = []
            L = b_chord(s) * 0.44
            for t, rr in ((0.0, 0.02), (0.15, 0.32), (0.5, 0.38), (0.85, 0.3), (1.0, 0.04)):
                ft.append([(side * s + rr * 0.6 * math.cos(q), yy + t * L, zz - rr * (0.5 + 0.5 * math.sin(q)) * 1.4)
                           for q in (j * math.tau / 10 for j in range(10))])
            a.loft(f"Flap track {tag}{k}", ft, paint, part="Body", smooth=55)
        for k, s in enumerate(B_ENGINES):
            exhausts.append(nacelle(a, f"{tag}{k}", (paint, lip, duct, fan_in if k == 0 else fan_out, liner, metal), side, s))

    # Low-set swept tailplanes with dihedral.
    for side, tag in ((-1, "L"), (1, "R")):
        hz = (b_top(24.0) + b_bot(24.0)) / 2 + 0.2
        hf = wing_frame(hz, side, math.radians(7))
        hle = lambda s: 20.6 + (s - 0.8) * math.tan(math.radians(38))
        hch = lambda s: 7.6 - (s - 0.8) * 0.36
        surface(a, f"Tailplane {tag}", paint, "Body", hf, [0.8, 3.0, 7.0, 12.0], hle, hch, 0.1, samples=10)
        a.box(f"Tailplane tip {tag}", (0.12, hch(12.0) * 0.8, 0.12), (side * 12.02, hle(12.0) + hch(12.0) * 0.45, hz + 12.0 * math.tan(math.radians(7))),
              rail, part="Body")
    # Swept fin with a dorsal fillet and dielectric cap.
    ff = fin_frame(0.0, 2.6, 0.0, 1)
    fle = lambda s: 17.2 + s * math.tan(math.radians(42))
    fch = lambda s: 11.0 - s * 0.62
    surface(a, "Fin", paint, "Body", ff, [0.0, 2.0, 5.0, 8.0, 10.4], fle, fch, 0.1, samples=12)
    fillet = [(8.0, 2.9), (18.6, 4.3), (20.0, 2.9)]
    a.prism("Fin fillet", fillet, -0.32, 0.32, paint, part="Body", axis="x")
    a.box("Fin cap", (0.18, fch(10.4) * 0.85, 0.16), (0, fle(10.4) + fch(10.4) * 0.48, 2.6 + 10.42), rail, part="Body")
    for s in (-1, 1):
        a.box(f"Fin light {s}", (0.03, 0.15, 1.2), (s * 0.18, fle(5.0) + 1.0, 2.6 + 5.0), light, part="Body")
        a.box(f"Nose light {s}", (0.03, 0.8, 0.1), (s * 2.62, -18.0, 0.6), light, part="Body")

    exhaust_mid = sum((Vector(e) for e in exhausts), Vector()) / len(exhausts)
    attachments = {"leftWingtip": tips["L"], "rightWingtip": tips["R"], "exhaust": tuple(exhaust_mid)}
    a.finish(origin="center", attachments=attachments, closeup=((0.6, -25.0, 2.0), (-1.0, -1.6, 0.7), 11.0), extra_notes={
        "noText": "No letters, numbers, call signs, serials, squadron codes or glyph-like marks in mesh or texture; grey countershading, splinter camouflage, panel lines and stains only.",
        "noRealMilitaryInsignia": "No roundels, flags, national or unit markings; the only markings are a plain dark-red fin-tip band and plain rings on the engine lips. Airframe is an original design, not a copy of any real or game aircraft (podded turbofans, shoulder wing, low tailplanes).",
        "noFaces": "No faces or figures: no crew is modelled; the windscreen is one continuous framed band and the refuelling probe is offset to starboard; engine fronts are four small dark fan discs in a row.",
        "noGoreOrWeaponsGlorification": "Unarmed airframe: no guns, turret, missiles or visible bombs; bomb-bay doors are closed panel lines. No kill marks, damage or gore.",
    })
    ex_records = [roblox_vec(a.shift(e)) for e in exhausts]
    review_pack(a, {
        "back": ((0, 1, 0), "ortho"),
        "side-port": ((-1, 0, 0), "ortho"),
        "bottom": ((0, 0, -1), "ortho"),
        "3q-front-right": ((1.0, -1.25, 0.8), "persp"),
        "3q-rear-left": ((-1.0, 1.25, 0.8), "persp"),
        "3q-rear-right": ((1.0, 1.3, 0.6), "persp"),
        "3q-low-front": ((-0.9, -1.2, -0.7), "persp"),
    }, {
        "closeup-engines": ((-15.0, -2.0, -0.6), (-0.9, -1.0, -0.25), 22.0),
        "closeup-tail": ((0.0, 25.0, 6.0), (1.0, 0.75, 0.35), 20.0),
        "closeup-belly": ((0.0, -2.0, -2.6), (0.7, -0.4, -1.0), 22.0),
    }, 1024, {
        "engineExhausts": ex_records,
        "design": "Original four-turbofan heavy bomber: shoulder-mounted 33-degree swept wing, slight anhedral, podded engines on pylons, swept fin, low tailplanes, gear sponsons. 72 studs span = 2.9x Vanta v2 (24.6) and 3.2x Kestrel v2 (22.2).",
    }, scale_ref={"folder": HERE.parents[1] / "assets" / "roblox-upload" / "vanta-v2", "location": (-48.0, 6.0, 0.0),
                  "target": (-22.0, 0.0, 0.0), "direction": (-0.6, -1.0, 0.75), "distance": 105.0})


# --------------------------------------------------------------------------
# Aircraft carrier

CV_L = 560.0
CV_WL = 20.0
CV_D = 54.0          # flight deck top
CV_SLAB = 3.0        # flight deck thickness
CV_GALLERY = 44.0    # top of the hull loft / bottom of the gallery deck
# Flight deck plan (x starboard, -y forward): bow, starboard with island sponson,
# stern, then the port angled-deck extension.
CV_DECK = [(-26, -280), (26, -280), (44, -236), (54, -170), (60, -100), (62, -20), (63, 110), (60, 210), (52, 262),
           (46, 280), (-44, 280), (-56, 262), (-62, 200), (-72, 120), (-78, 40), (-77, -8), (-60, -42), (-52, -80),
           (-50, -150), (-42, -230)]
# Landing area: 9 degrees to port of the ship's axis.
CV_ANGLE = math.radians(9)
CV_LAND_AFT = (-12.0, 278.0)
CV_LAND_LEN = 270.0
CV_LAND_HALF = 19.0
# Bow catapults: track start (aft) and end (bow), deck plan coordinates.
CV_CATS = (((-8.0, -122.0), (-15.0, -276.0)), ((14.0, -122.0), (19.0, -276.0)))
# Deck-edge elevators: (x0, x1, y0, y1); platforms sit just below deck level.
CV_ELEVATORS = ((54.0, 80.0, -150.0, -116.0), (59.0, 85.0, 128.0, 162.0), (-82.0, -55.0, -78.0, -44.0))
CV_ISLAND = (44.0, 61.0, 18.0, 92.0)


def _land_dir():
    return (-math.sin(CV_ANGLE), -math.cos(CV_ANGLE))


def _land_point(t, offset=0.0):
    """Point ``t`` studs forward along the landing-area centre line, ``offset`` to starboard."""
    dx, dy = _land_dir()
    x0, y0 = CV_LAND_AFT
    return (x0 + dx * t - dy * offset, y0 + dy * t + dx * offset)


def edge_x(pts, y, side):
    """Outermost x of a plan outline at ``y`` on one side (+1 starboard, -1 port)."""
    hits = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        if (y0 - y) * (y1 - y) <= 0 and abs(y1 - y0) > 1e-9:
            hits.append(x0 + (x1 - x0) * (y - y0) / (y1 - y0))
    return max(hits) if side > 0 else min(hits)


def inside(pts, x, y):
    c = False
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (x1 - x0) * (y - y0) / (y1 - y0):
            c = not c
    return c


def carrier_paint():
    """Haze-grey hull, black boot-top, red antifouling; dark non-skid flight deck with
    original line-only markings (landing-area edges and dashed centre line, three
    arresting-wire lines, catapult tracks, elevator and parking lines). No numbers."""
    deck_col, hull_col = "#3d4144", "#7d858c"

    def pattern(n: Nodes, col):
        x, y, z = n.xyz(n.pos())
        nx, ny, nz = n.xyz(n.normal())
        up = n.smooth(nz, 0.6, 0.85)
        on_deck = n.mul(up, n.smooth(z, CV_D - 1.0, CV_D - 0.6))
        # Hull: boot-top and antifouling below the waterline, weeping rust, plating seams.
        col = n.vlerp(col, srgb("#1d1f21"), n.smooth(z, CV_WL + 1.8, CV_WL + 1.4))
        col = n.vlerp(col, srgb("#6a2b24"), n.smooth(z, CV_WL - 1.0, CV_WL - 1.4))
        weep = n.mul(n.smooth(n.noise(n.vmul(n.pos(), (0.04, 0.5, 0.015)), 3.0, 2.0, 0.5), 0.62, 0.7), n.smooth(z, CV_WL + 14, CV_WL + 3))
        col = n.vlerp(col, srgb("#6d4a35"), n.mul(weep, 0.3))
        seams = n.mul(n.maxf(n.lines(y, 16.0, 0.08), n.lines(z, 6.0, 0.08)), n.sub(1.0, up))
        col = n.vscale(col, n.sub(1.0, n.mul(seams, 0.12)))
        # Flight deck: dark non-skid with tyre-mark smudges along the landing area.
        deck = srgb(deck_col)
        col = n.vlerp(col, deck, on_deck)
        dx, dy = _land_dir()
        lx, ly = n.sub(x, CV_LAND_AFT[0]), n.sub(y, CV_LAND_AFT[1])
        along = n.add(n.mul(lx, dx), n.mul(ly, dy))
        across = n.sub(n.mul(lx, -dy), n.mul(ly, -dx))
        in_land = n.mul(n.band(along, 0.0, CV_LAND_LEN, 2.0), n.band(across, -CV_LAND_HALF, CV_LAND_HALF, 2.0))
        tyre = n.mul(n.smooth(n.noise(n.vec(n.mul(across, 0.4), n.mul(along, 0.02), 0.0), 2.0, 3.0, 0.6), 0.5, 0.7), in_land)
        col = n.vscale(col, n.sub(1.0, n.mul(n.mul(tyre, on_deck), 0.35)))
        pale, yellow = srgb("#c9c6b8"), srgb("#b59a3c")
        marks = 0.0
        a0, a1 = _land_point(0.0, -CV_LAND_HALF), _land_point(CV_LAND_LEN, -CV_LAND_HALF)
        b0, b1 = _land_point(0.0, CV_LAND_HALF), _land_point(CV_LAND_LEN, CV_LAND_HALF)
        marks = n.maxf(marks, _line(n, x, y, a0, a1, 1.6))
        marks = n.maxf(marks, _line(n, x, y, b0, b1, 1.6))
        # The dashed centre line starts ahead of the wires so no two lines cross.
        marks = n.maxf(marks, _line(n, x, y, _land_point(100.0), _land_point(CV_LAND_LEN), 1.2, dash=(14.0, 7.0)))
        for t in (54.0, 68.0, 82.0):
            marks = n.maxf(marks, _line(n, x, y, _land_point(t, -CV_LAND_HALF + 3), _land_point(t, CV_LAND_HALF - 3), 0.9))
        # Catapult tracks: dark slot between two pale lines, a dashed pale run-out line.
        slot = 0.0
        for p0, p1 in CV_CATS:
            ux, uy = p1[0] - p0[0], p1[1] - p0[1]
            ln = math.hypot(ux, uy)
            px, py = -uy / ln, ux / ln
            slot = n.maxf(slot, _line(n, x, y, p0, p1, 0.8))
            for side in (-1, 1):
                q0 = (p0[0] + px * side * 1.6, p0[1] + py * side * 1.6)
                q1 = (p1[0] + px * side * 1.6, p1[1] + py * side * 1.6)
                marks = n.maxf(marks, _line(n, x, y, q0, q1, 0.7))
        # Starboard parking line and the foul line ahead of the landing area.
        marks = n.maxf(marks, _line(n, x, y, (40.0, -210.0), (42.0, 250.0), 1.2))
        fl = _land_point(CV_LAND_LEN + 4.0)
        ylines = _line(n, x, y, (fl[0] - 26.0, fl[1] + 4.0), (fl[0] + 26.0, fl[1] - 4.0), 1.2, dash=(6.0, 3.5))
        for x0, x1, y0, y1 in CV_ELEVATORS:
            box = n.mul(n.band(x, x0, x1, 0.2), n.band(y, y0, y1, 0.2))
            inner = n.mul(n.band(x, x0 + 1.2, x1 - 1.2, 0.2), n.band(y, y0 + 1.2, y1 - 1.2, 0.2))
            ylines = n.maxf(ylines, n.sub(box, inner))
        col = n.vlerp(col, pale, n.mul(marks, on_deck))
        col = n.vlerp(col, yellow, n.mul(ylines, on_deck))
        col = n.vlerp(col, srgb("#161718"), n.mul(slot, on_deck))
        rough = n.add(n.mul(on_deck, 0.22), n.mul(n.mul(n.maxf(marks, ylines), on_deck), -0.15))
        height = n.sub(n.sub(0.5, n.mul(seams, 0.3)), n.mul(n.mul(slot, on_deck), 0.5))
        return col, rough, height

    return standard(hull_col, 0.62, 0.15, pattern=pattern, streak=0.3, grime=0.12, grime_scale=0.02, ao=0.4, ao_dist=5.0,
                    vary_scale=0.02)


def _drop_faces(obj, test):
    """Remove faces hidden inside the model (saves atlas area for the visible deck)."""
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    dead = [f for f in bm.faces if test(f)]
    bmesh.ops.delete(bm, geom=dead, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def frustum(a: Asset, name, zone, x0, y0, x1, y1, z0, z1, inset=0.0, front=None, **kw):
    fi = inset if front is None else front
    ring0 = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)]
    ring1 = [(x0 + inset, y0 + fi, z1), (x1 - inset, y0 + fi, z1), (x1 - inset, y1 - inset, z1), (x0 + inset, y1 - inset, z1)]
    return a.loft(name, [ring0, ring1], zone, smooth=None, **kw)


@builder("carrier")
def carrier():
    a = Asset("carrier", "Aircraft carrier (mission 1 start)", texture=512, tri_limit=6000, bump_distance=0.15, seed=302,
              usage="Mission 1 start reference (scripted fly-off from the bow catapults) and intro dressing. Pending review; not referenced from src/.")
    hull = a.zone("hull", carrier_paint())
    sup = a.zone("super", Z.windows("#858d94", "#1b2329", bay=4.0, win=2.6, floor=8.0, win_h=2.4, z0=CV_D + 41.0,
                                      z1=CV_D + 45.0, rough=0.6, roof_color="#5a6065", frame="#858d94", streak=0.3,
                                      base_dirt=0.0))
    dark = a.zone("dark", Z.painted_metal("#3c4146", rough=0.6, metal=0.3, rust=0.1, panels=None))
    jbd = a.zone("jbd", Z.painted_metal("#4a4f53", rough=0.7, metal=0.4, rust=0.05, panels=2.5))
    soot = a.zone("soot", standard("#2a2b2c", 0.8, 0.2, grime=0.3, streak=0.5))
    boat = a.zone("boat", standard("#c97a2e", 0.6, 0.0, grime=0.1))

    # Hull: flared sections from the keel to the gallery deck; raked, flared bow; transom stern.
    stations = 30
    rings = []
    B = 37.0
    for k in range(stations + 1):
        s = k / stations
        y = -268.0 + s * 540.0
        if s < 0.3:
            b = (s / 0.3) ** 0.6
        elif s > 0.75:
            b = 1 - 0.12 * ((s - 0.75) / 0.25) ** 2
        else:
            b = 1.0
        b = max(b, 0.02)
        keel = 15.0 * max(0.0, 1 - s / 0.12) ** 1.5 + (11.0 * ((s - 0.86) / 0.14) ** 1.6 if s > 0.86 else 0.0)
        w = B * b
        flare = 1.0 + 0.35 * max(0.0, 1 - s / 0.25)
        half = [(0.0, keel), (0.55 * w, keel + 0.8), (0.9 * w, keel + 4.0 * b + 0.6), (w, max(CV_WL, keel + 5)),
                (w * 1.08 * flare, CV_WL + 12.0), (w * 1.16 * flare + 4 * (1 - b), CV_GALLERY)]
        rake = 6.0 * max(0.0, 1 - s / 0.08)
        ring = [(x, y - rake * (zz - keel) / CV_GALLERY, zz) for x, zz in half]
        ring += [(-x, yy, zz) for x, yy, zz in reversed(ring[1:])]
        rings.append(ring)
    h = a.loft("Hull", rings, hull, smooth=40)
    _drop_faces(h, lambda f: f.normal.z > 0.95 and f.calc_center_median().z > CV_GALLERY - 0.5)

    # Gallery deck (hangar sides under the overhang), inset from the flight deck edge.
    def inset(pts, d):
        out = []
        cx = sum(p[0] for p in pts) / len(pts)
        for x, y in pts:
            sx = 1.0 if x > cx else -1.0
            out.append((x - sx * d, y * (1 - d / 300.0)))
        return out

    gal = inset(CV_DECK, 6.0)
    # The hull's top strip was dropped above, so the gallery must cover every hull top vertex.
    for v in h.data.vertices:
        if v.co.z > CV_GALLERY - 0.5 and not inside(gal, v.co.x, v.co.y):
            raise RuntimeError(f"carrier: hull top vertex {tuple(round(c, 1) for c in v.co)} outside the gallery")
    g = a.prism("Gallery", gal, CV_GALLERY - 0.5, CV_D - CV_SLAB + 0.05, hull)
    _drop_faces(g, lambda f: f.normal.z > 0.95)
    a.prism("Flight deck", CV_DECK, CV_D - CV_SLAB, CV_D, hull)
    # Hangar-bay doors on the gallery sides, under the overhang.
    for i, (side, y0, y1) in enumerate(((1, -60.0, -20.0), (1, 140.0, 180.0), (-1, -20.0, 30.0), (-1, 160.0, 200.0))):
        e0, e1 = edge_x(gal, y0, side), edge_x(gal, y1, side)
        outline = [(e0 - side * 0.6, y0), (e0 + side * 0.4, y0), (e1 + side * 0.4, y1), (e1 - side * 0.6, y1)]
        a.prism(f"Bay door {i}", outline, CV_GALLERY + 0.5, CV_D - CV_SLAB - 1.0, dark, smooth=None)
    # Elevators at deck level (0.3 below the deck top so they read as separate platforms).
    for i, (x0, x1, y0, y1) in enumerate(CV_ELEVATORS):
        a.box(f"Elevator {i}", (x1 - x0, y1 - y0, 2.0), ((x0 + x1) / 2, (y0 + y1) / 2, CV_D - 1.3), hull)
        xs = 1 if x0 > 0 else -1
        a.box(f"Elevator well {i}", (6.0, y1 - y0 + 4, 12.0), (xs * (min(abs(x0), abs(x1)) - 2.0), (y0 + y1) / 2, CV_D - 9.0), dark)
    # Catapult shuttles and flush jet-blast deflectors behind each catapult start.
    for i, (p0, p1) in enumerate(CV_CATS):
        ang = math.atan2(p1[0] - p0[0], -(p1[1] - p0[1]))
        a.box(f"Shuttle {i}", (1.2, 3.0, 0.5), (p0[0] - 0.2, p0[1] - 8.0, CV_D + 0.2), dark, rot=(0, 0, -ang))
        a.box(f"Deflector {i}", (26.0, 9.0, 0.5), (p0[0] + 0.5, p0[1] + 10.0, CV_D + 0.2), jbd, rot=(0, 0, -ang))
    # Catwalks just below both deck edges with life-raft canisters; lowered deck-edge masts.
    for side, runs in ((1, ((-200.0, -150.0), (170.0, 240.0))), (-1, ((-200.0, -110.0), (60.0, 150.0), (205.0, 255.0)))):
        for k, (y0, y1) in enumerate(runs):
            e0, e1 = edge_x(CV_DECK, y0, side), edge_x(CV_DECK, y1, side)
            outline = [(e0 - side * 1.0, y0), (e0 + side * 4.0, y0), (e1 + side * 4.0, y1), (e1 - side * 1.0, y1)]
            a.prism(f"Catwalk {side} {k}", outline, CV_D - 5.0, CV_D - 4.2, dark, smooth=None)
            for j in range(int((y1 - y0) // 14)):
                yy = y0 + 7.0 + j * 14.0
                a.cyl(f"Raft {side} {k} {j}", 1.4, 4.5, (edge_x(CV_DECK, yy, side) + side * 1.8, yy, CV_D - 2.6), boat,
                      segs=8, rot=(math.radians(90), 0, 0))
    for i, (side, y) in enumerate(((1, -60.0), (1, 200.0), (-1, 80.0), (-1, 230.0))):
        e = edge_x(CV_DECK, y, side)
        tilt = math.radians(18)
        a.beam(f"Edge mast {i}", (e - side * 1.0, y, CV_D - 3.0), (e + side * 22.0 * math.cos(tilt), y, CV_D - 3.0 + 22.0 * math.sin(tilt)),
               0.9, dark, segs=5)
    # Sponsons with covered point-defence domes (bow quarters and stern quarters).
    for i, (side, y) in enumerate(((1, -214.0), (-1, -200.0), (-1, 262.0), (1, 262.0))):
        g_e, d_e = edge_x(gal, y, side), edge_x(CV_DECK, y, side)
        x0s, x1s = g_e - side * 2.0, d_e + side * 9.0
        a.box(f"Sponson {i}", (abs(x1s - x0s), 14.0, 4.0), ((x0s + x1s) / 2, y, CV_D - 7.0), hull)
        dx = d_e + side * 5.0
        a.cyl(f"Mount {i}", 2.6, 2.6, (dx, y, CV_D - 3.7), hull, segs=10)
        a.sphere(f"Dome {i}", 2.8, (dx, y, CV_D - 0.6), hull, subdiv=2, scale=(1, 1, 1.25))

    # Island: stepped sloped blocks, enclosed mast with flat-panel faces, radomes, exhaust.
    x0, x1, y0, y1 = CV_ISLAND
    frustum(a, "Island base", sup, x0, y0, x1, y1, CV_D - 0.5, CV_D + 18.0, inset=0.8, bevel=0.4)
    frustum(a, "Island mid", sup, x0 + 1.0, y0 + 6.0, x1 - 1.0, y1 - 10.0, CV_D + 18.0, CV_D + 34.0, inset=1.0, bevel=0.4)
    frustum(a, "Bridge", sup, x0 + 1.5, y0 + 4.0, x1 - 1.0, y0 + 40.0, CV_D + 34.0, CV_D + 46.0, inset=0.6, front=3.5, bevel=0.3)
    frustum(a, "Mast", sup, x0 + 3.5, y0 + 18.0, x1 - 3.0, y0 + 34.0, CV_D + 46.0, CV_D + 74.0, inset=2.6, bevel=0.3)
    mx, my = (x0 + x1) / 2 + 0.2, y0 + 26.0
    for i, (dx, dy, rz) in enumerate(((0, -6.6, 0), (0, 6.6, math.pi), (-5.2, 0, -math.pi / 2), (5.2, 0, math.pi / 2))):
        a.box(f"Panel {i}", (8.0, 0.6, 8.0), (mx + dx, my + dy, CV_D + 56.0), dark,
              rot=(math.radians(-14) if dy < 0 else math.radians(14) if dy > 0 else 0, math.radians(14) * (1 if dx > 0 else -1) if dx else 0, 0))
    a.cyl("Mast pole", 0.7, 22.0, (mx, my, CV_D + 85.0), dark, segs=6, smooth=None)
    a.beam("Yard", (mx - 9.0, my, CV_D + 80.0), (mx + 9.0, my, CV_D + 80.0), 0.8, dark)
    a.sphere("Radome high", 3.0, (mx, my, CV_D + 97.0), sup, subdiv=2, scale=(1, 1, 0.92))
    a.sphere("Radome aft", 3.4, (mx, y0 + 50.0, CV_D + 37.5), sup, subdiv=2, scale=(1, 1, 0.9))
    frustum(a, "Exhaust", sup, x0 + 2.0, y0 + 54.0, x1 - 2.0, y1 - 12.0, CV_D + 34.0, CV_D + 44.0, inset=1.2, bevel=0.3)
    frustum(a, "Exhaust cap", soot, x0 + 3.5, y0 + 55.5, x1 - 3.5, y1 - 13.5, CV_D + 44.0, CV_D + 45.5, inset=0.4)
    for i, (x, y, hh) in enumerate(((x0 + 3, y0 + 8, 10.0), (x1 - 3, y0 + 46, 8.0), (x1 - 2, y1 - 4, 12.0))):
        a.cyl(f"Whip {i}", 0.3, hh, (x, y, CV_D + 34.0 + hh / 2 if i else CV_D + 46.0 + hh / 2), dark, segs=4, smooth=None)
    # Stern: transom overhang knee braces and a fantail gallery.
    for i, x in enumerate((-24.0, 0.0, 24.0)):
        a.beam(f"Knee {i}", (x, 268.0, CV_GALLERY - 6.0), (x, 279.0, CV_D - CV_SLAB), 2.2, hull)

    a.finish(ground_offset=CV_WL, extra_notes={
        "noText": "No letters, numbers or symbols anywhere: no hull number, name or pennant. Deck markings are plain straight lines only (landing-area edges, a dashed centre line, three wire lines, catapult track lines, elevator outlines, a parking line, a dashed foul line); no circles, crosses or glyph-like shapes.",
        "noRealMilitaryInsignia": "No flags, ensigns, hull numbers or class markings; hull, island and deck plan are an original layout, not a copy of any real or game ship.",
        "noFaces": "No faces, figures or crew; no parked aircraft.",
        "noGoreOrWeaponsGlorification": "Four covered point-defence domes on sponsons, as on any warship; no guns, missiles or aircraft weapons shown; nothing aimed, firing or damaged.",
    })
    cats = [{"from": roblox_vec(a.shift((p0[0], p0[1], CV_D))), "to": roblox_vec(a.shift((p1[0], p1[1], CV_D)))}
            for p0, p1 in CV_CATS]
    review_pack(a, {
        "back": ((0, 1, 0), "ortho"),
        "side-port": ((-1, 0, 0), "ortho"),
        "bottom": ((0, 0, -1), "ortho"),
        "3q-front-right": ((1.0, -1.25, 0.8), "persp"),
        "3q-rear-left": ((-1.0, 1.25, 0.8), "persp"),
        "3q-rear-right": ((1.0, 1.3, 0.6), "persp"),
        "3q-low-front": ((-0.9, -1.2, -0.25), "persp"),
    }, {
        "closeup-island": ((52.0, 50.0, CV_D + 30.0), (1.0, -0.9, 0.5), 150.0),
        "closeup-bow": ((0.0, -210.0, CV_D), (0.35, -0.8, 0.6), 150.0),
        "closeup-deck": ((-30.0, 180.0, CV_D), (-0.3, 0.8, 0.9), 190.0),
        "closeup-hull": ((40.0, -120.0, CV_WL + 14.0), (1.0, -0.35, 0.05), 150.0),
    }, 512, {
        "catapults": cats,
        "deckHeightStuds": round(CV_D, 3),
        "launchHeading": "-Z (bow)",
        "design": "Original flat-deck carrier: 9-degree angled landing area, starboard island aft of midships, two bow catapults with flush blast deflectors, three deck-edge elevators, four sponsons with covered domes. 560 studs long = 21.5 Kestrel lengths; deck 141 studs wide = 6.3 Kestrel spans.",
    }, scale_ref={"folder": HERE.parents[1] / "assets" / "roblox-upload" / "kestrel-v2", "location": (-9.0, -134.0, CV_D + 2.7),
                  "target": (-6.0, -150.0, CV_D + 4.0), "direction": (0.55, -1.0, 0.65), "distance": 110.0})
