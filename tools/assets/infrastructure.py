"""Infrastructure and terrain-dressing generators for the bigger mission worlds.

Modular pieces replace the last primitive Parts in the mission worlds: tileable
runway, apron, road and track segments, a river bridge, target hardstands, the
ocean store deck and its gangway, an equipment hut, the civic hall, cliff-face
panels for mesa walls, fence and power-line spans, and the distant mountain
ridges that ring the flyable area. One upload of each covers every map.

Segment conventions (WorldPlan tiles them): the long axis is Blender Y (Roblox
Z), the pivot is the bottom centre and the piece's front (-Y) is one end, so a
run of pieces laid end to end along a line joins seamlessly. Markings are
plain painted stripes computed from position: no numbers, letters, arrows or
symbols anywhere.
"""

from __future__ import annotations

import math

from mathutils import Vector, noise

import zones as Z
from skyasset import Asset, srgb, standard

BUILDERS: dict = {}
SMALL_TEXTURE = 256

STRIPE_NOTE = ("Markings are plain painted stripes only (dashed centreline, solid edge lines, threshold bars); "
               "no numbers, letters, arrows, symbols or codes in mesh or texture.")


def builder(fn):
    BUILDERS[fn.__name__.replace("_", "-")] = fn
    return fn


# --------------------------------------------------------------------------
# Mesh helpers


def slab(a: Asset, name: str, x0, x1, y0, y1, z0, z1, zone, nx=1, ny=1, part="Main", walls=(True, True, True, True)):
    """A flat slab whose top is split into nx * ny disconnected tiles.

    The tiles unwrap as separate UV islands, so a long thin strip still gets an even
    texel density from the atlas packer. The bake is position-based, so the tiles'
    patterns meet without seams. No bottom face: every slab sits on the ground.
    ``walls`` = (south -Y, north +Y, west -X, east +X).
    """
    verts, faces = [], []

    def quad(a_, b_, c_, d_):
        base = len(verts)
        verts.extend([a_, b_, c_, d_])
        faces.append((base, base + 1, base + 2, base + 3))

    for i in range(nx):
        xa, xb = x0 + (x1 - x0) * i / nx, x0 + (x1 - x0) * (i + 1) / nx
        for j in range(ny):
            ya, yb = y0 + (y1 - y0) * j / ny, y0 + (y1 - y0) * (j + 1) / ny
            quad((xa, ya, z1), (xb, ya, z1), (xb, yb, z1), (xa, yb, z1))
    south, north, west, east = walls
    if south:
        quad((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1))
    if north:
        quad((x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1))
    if west:
        quad((x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1))
    if east:
        quad((x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1))
    return a.mesh(name, verts, faces, zone, part, smooth=None)


def grid(a: Asset, name: str, xs, ys, height, zone, part="Main", close_x=True, smooth=55):
    """A height field z = height(i, j) over the xs * ys grid; ``close_x`` walls the two X ends down to z=0."""
    nx, ny = len(xs), len(ys)
    verts = [(xs[i], ys[j], height(i, j)) for i in range(nx) for j in range(ny)]
    faces = []
    for i in range(nx - 1):
        for j in range(ny - 1):
            v = i * ny + j
            faces.append((v, v + ny, v + ny + 1, v + 1))
    if close_x:
        for i, flip in ((0, True), (nx - 1, False)):
            base = len(verts)
            for j in range(ny):
                verts.append((xs[i], ys[j], 0.0))
            for j in range(ny - 1):
                top0, top1 = i * ny + j, i * ny + j + 1
                f = (top0, top1, base + j + 1, base + j)
                faces.append(tuple(reversed(f)) if flip else f)
    return a.mesh(name, verts, faces, zone, part, smooth=smooth)


def fbm(x: float, y: float = 0.0, seed: float = 0.0, octaves: int = 4) -> float:
    return noise.fractal(Vector((x, y, seed)), 0.7, 2.0, octaves)


# --------------------------------------------------------------------------
# Paint: asphalt and concrete surfaces with plain stripe markings


def pavement(base: str, markings=None, *, paint="#dcdad0", grooves: float | None = None, rough=0.86, crack=0.08,
             joints: tuple | None = None, stains=0.16, bump=0.2):
    """Asphalt or concrete top with optional painted stripes (``markings(n, x, y)`` is a 0..1 mask)."""

    def pattern(n, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        nx, ny, nz = n.xyz(n.normal())
        top = n.smooth(nz, 0.6, 0.9)
        h = 0.5
        if grooves:
            g = n.mul(n.lines(y, grooves, 0.16), top)
            h = n.sub(h, n.mul(g, 0.1))
        if joints:
            jx, jy = joints
            j = n.mul(n.maxf(n.lines(x, jx, 0.12), n.lines(y, jy, 0.12)), top)
            col = n.vscale(col, n.sub(1.0, n.mul(j, 0.28)))
            h = n.sub(h, n.mul(j, 0.35))
        patch = n.smooth(n.noise(n.vmul(p, (0.03, 0.012, 0.03)), 1.0, 3.0, 0.55), 0.56, 0.7)
        col = n.vscale(col, n.sub(1.0, n.mul(patch, stains)))
        if crack > 0:
            c = n.smooth(n.voronoi(p, crack, "DISTANCE_TO_EDGE"), 0.05, 0.0)
            c = n.mul(c, n.smooth(n.noise(p, 0.2, 2.0, 0.5), 0.55, 0.65))
            col = n.vscale(col, n.sub(1.0, n.mul(c, 0.35)))
            h = n.sub(h, n.mul(c, 0.3))
        rough_delta = None
        if markings is not None:
            m = n.mul(markings(n, x, y), top)
            wear = n.smooth(n.noise(n.vscale(p, 1.1), 2.0, 4.0, 0.6), 0.6, 0.74)
            m = n.mul(m, n.sub(1.0, n.mul(wear, 0.55)))
            col = n.vlerp(col, srgb(paint), m)
            h = n.add(h, n.mul(m, 0.06))
            rough_delta = n.mul(m, -0.2)
        return col, rough_delta, h

    return standard(base, rough, 0.0, pattern=pattern, grime=0.18, vary=0.07, ao=0.15, ao_dist=1.0, bump=bump,
                    bump_scale=6.0)


def runway_middle_marks(n, x, y):
    # Dashes 45 long every 90 (centred on y = 0, +-90) so pieces 270 long continue the pattern.
    dash = n.mul(n.band(x, -1.5, 1.5, 0.15), n.rect(y, 90.0, 45.0, 0.5, 0.2))
    edge = n.band(n.absf(x), 46.5, 48.5, 0.15)
    return n.maxf(dash, edge)


def runway_end_marks(n, x, y):
    # The runway end is at y = -115: an end bar, a field of equal threshold stripes, then the centreline.
    ax = n.absf(x)
    edge = n.mul(n.band(ax, 46.5, 48.5, 0.15), n.smooth(y, -113.5, -112.5))
    bar = n.mul(n.band(y, -113.0, -109.0, 0.15), n.smooth(ax, 48.6, 48.4))
    keys = n.mul(n.mul(n.band(y, -104.0, -56.0, 0.15), n.rect(x, 7.0, 3.5, 0.5, 0.15)), n.band(ax, 4.5, 45.0, 0.15))
    dash = n.mul(n.band(x, -1.5, 1.5, 0.15), n.maxf(n.band(y, 47.5, 92.5, 0.2), n.band(y, -42.5, 2.5, 0.2)))
    return n.maxf(n.maxf(edge, bar), n.maxf(keys, dash))


def road_marks(n, x, y):
    # Dashes 12 long every 40 (5 per 200-stud piece) and two solid edge lines.
    dash = n.mul(n.band(x, -0.3, 0.3, 0.06), n.rect(y, 40.0, 12.0, 0.5, 0.1))
    edge = n.band(n.absf(x), 9.8, 10.3, 0.06)
    return n.maxf(dash, edge)


def apron_marks(n, x, y):
    return n.band(x, -0.6, 0.6, 0.08)


def light_housings(a: Asset, zone, xs, ys, z):
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            a.cyl(f"Light {i}{j}", 0.7, 0.5, (x, y, z + 0.25), zone, segs=6, smooth=None)


# --------------------------------------------------------------------------
# Airfield


def _runway(name: str, title: str, length: float, marks, usage: str, closeup):
    a = Asset(name, title, texture=512, tri_limit=2500, bump_distance=0.05, seed=101,
              usage=usage)
    asphalt = a.zone("asphalt", pavement("#383b3e", marks, grooves=1.6))
    shoulder = a.zone("shoulder", pavement("#8d8b84", None, joints=(15.0, 15.0), crack=0.05, rough=0.9))
    fixture = a.zone("fixture", Z.painted_metal("#c9b23c", rough=0.5, metal=0.3, rust=0.2, panels=None))
    half = length / 2
    tiles = max(1, round(length / 30))
    slab(a, "Runway", -50, 50, -half, half, 0, 2.0, asphalt, nx=2, ny=tiles)
    for side in (-1, 1):
        x0, x1 = (50, 65) if side > 0 else (-65, -50)
        slab(a, f"Shoulder {side}", x0, x1, -half, half, 0, 1.6, shoulder, nx=1, ny=max(1, tiles // 2),
             walls=(True, True, side < 0, side > 0))
    light_housings(a, fixture, (-56, 56), (-length / 4, length / 4), 1.6)
    a.finish(ground_offset=1.0, closeup=closeup, extra_notes={"noText": STRIPE_NOTE})


@builder
def runway_segment():
    _runway("runway-segment", "Runway segment (tileable)", 270.0, runway_middle_marks,
            "Tileable 270-stud runway piece (centreline dashes, edge lines): Varda airfields in M3, M4, M8, M18 and M1.",
            ((0, -100, 2), (0.45, -1.0, 0.7), 70))


@builder
def runway_threshold():
    _runway("runway-threshold", "Runway threshold end (tileable)", 230.0, runway_end_marks,
            "Runway end piece with plain threshold stripes; one at each end of every runway (M1, M3, M4, M8, M18).",
            ((0, -80, 2), (0.35, -1.0, 0.9), 95))


@builder
def apron_slab():
    a = Asset("apron-slab", "Concrete apron slab (tileable)", texture=512, tri_limit=2500, bump_distance=0.05, seed=102,
              usage="Tileable 64 x 240 parking apron and taxiway piece with one plain taxi line (airfields, M1 taxiways).")
    conc = a.zone("concrete", pavement("#9a9890", apron_marks, paint="#d2a434", joints=(16.0, 20.0), crack=0.05,
                                       rough=0.9, stains=0.22))
    slab(a, "Apron", -32, 32, -120, 120, 0, 2.0, conc, nx=2, ny=8)
    a.finish(ground_offset=1.0, closeup=((0, -60, 2), (0.6, -1.0, 0.8), 45), extra_notes={"noText": STRIPE_NOTE})


# --------------------------------------------------------------------------
# Roads


@builder
def road_segment():
    a = Asset("road-segment", "Asphalt road segment (tileable)", texture=512, tri_limit=2500, bump_distance=0.04,
              seed=103, usage="Tileable two-lane road piece, 25 x 200 (dashed centreline, edge lines): every road and city street.")
    asphalt = a.zone("asphalt", pavement("#3c3f42", road_marks, grooves=None, crack=0.12, stains=0.2))
    verge = a.zone("verge", standard("#6d6656", 0.95, 0.0, vary=0.15, vary_scale=0.4, grime=0.3, bump=0.6, bump_scale=3.0))
    slab(a, "Road", -11, 11, -100, 100, 0, 1.0, asphalt, nx=1, ny=8, walls=(True, True, False, False))
    for side in (-1, 1):
        verts, faces = [], []
        for j in range(4):
            y0, y1 = -100 + 50 * j, -100 + 50 * (j + 1)
            inner, outer = 11 * side, 12.5 * side
            base = len(verts)
            verts.extend([(inner, y0, 1.0), (outer, y0, 0.2), (outer, y1, 0.2), (inner, y1, 1.0)])
            faces.append((base, base + 1, base + 2, base + 3) if side > 0 else (base + 3, base + 2, base + 1, base))
        a.mesh(f"Verge {side}", verts, faces, verge, smooth=None)
    a.finish(ground_offset=0.3, closeup=((0, -60, 1), (0.5, -1.0, 0.55), 30), extra_notes={"noText": STRIPE_NOTE})


@builder
def dirt_track():
    a = Asset("dirt-track", "Gravel farm track (tileable)", texture=512, tri_limit=2500, bump_distance=0.12, seed=104,
              usage="Tileable 20 x 200 unmarked gravel track: canyon roads, convoy tracks and farm lanes.")

    def pattern(n, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        ax = n.absf(x)
        rut = n.band(ax, 2.6, 5.4, 0.6)
        middle = n.smooth(ax, 2.0, 0.8)
        edge = n.smooth(ax, 8.0, 9.8)
        grass = n.mul(n.maxf(middle, edge), n.smooth(n.noise(p, 0.6, 4.0, 0.6), 0.42, 0.58))
        col = n.vscale(col, n.sub(1.0, n.mul(rut, 0.18)))
        col = n.vlerp(col, srgb("#6f7444"), n.mul(grass, 0.8))
        speck = n.noise(p, 4.0, 2.0, 0.5)
        col = n.vscale(col, n.add(0.85, n.mul(speck, 0.3)))
        h = n.add(n.mul(n.noise(p, 2.4, 4.0, 0.6), 0.7), n.mul(rut, -0.3))
        return col, n.mul(rut, -0.1), h

    dirt = a.zone("dirt", standard("#8a7457", 0.95, 0.0, pattern=pattern, vary=0.12, vary_scale=0.05, grime=0.1, ao=0.1))
    xs = [-10, -8.5, -6, -5, -4, -3, -2, 0, 2, 3, 4, 5, 6, 8.5, 10]

    def profile(x):
        ax = abs(x)
        if ax >= 9.9:
            return 0.15
        rut = 0.22 * math.exp(-((ax - 4.0) / 1.0) ** 2)
        return 0.8 - rut - 0.6 * max(0.0, (ax - 8.0) / 2.0) ** 1.5

    for k in range(4):
        y0 = -100 + 50 * k
        ys = [y0 + 12.5 * j for j in range(5)]
        grid(a, f"Track {k}", xs, ys, lambda i, j: profile(xs[i]) + 0.04 * math.sin(ys[j] * 0.37 + xs[i]), dirt,
             close_x=False, smooth=40)
    a.finish(ground_offset=0.3, closeup=((0, -60, 0.8), (0.5, -1.0, 0.6), 26))


@builder
def road_bridge():
    a = Asset("road-bridge", "Concrete river bridge", texture=512, tri_limit=2500, bump_distance=0.06, seed=105,
              usage="River crossings (M3, M7, M11, M13, M16): the track bridge and every road over the river; piers stand in the river bed.")
    conc = a.zone("concrete", Z.concrete("#a19e95", joints=6.0, streak=0.45, dirt=0.35))
    asphalt = a.zone("asphalt", pavement("#3c3f42", road_marks, crack=0.1))
    rail = a.zone("rail", Z.painted_metal("#5b6166", rough=0.5, metal=0.6, rust=0.2, panels=None))
    # z = 0 is the river bed, z = 12 the bank (the ground contact), z = 16 the deck.
    half, deck = 150.0, 16.0
    for s in (-1, 1):
        # Approach ramps from road level up to the deck, on an earth-coloured embankment.
        outline = [(115 * s, deck), (half * s, 13.0), (half * s, 11.0), (115 * s, 11.0)]
        a.prism(f"Ramp {s}", outline, -18, 18, conc, axis="x")
        a.box(f"Abutment {s}", (40, 30, 6), (0, 100 * s, 11.0), conc, bevel=0.4)
    a.box("Deck", (36, 230, 2.5), (0, 0, deck - 1.25), conc, bevel=0.3)
    slab(a, "Carriageway", -13, 13, -115, 115, deck, deck + 0.2, asphalt, nx=1, ny=8)
    for s in (-1, 1):
        a.box(f"Sidewalk {s}", (4.5, 230, 0.6), (s * 15.25, 0, deck + 0.3), conc)
        a.box(f"Parapet {s}", (1.0, 300, 3.0), (s * 17.5, 0, deck + 1.5), conc, bevel=0.15)
        a.box(f"Rail {s}", (0.5, 300, 0.5), (s * 17.5, 0, deck + 3.6), rail)
        for y in (-60, 60):
            a.cyl(f"Lamp post {s}{y}", 0.35, 10, (s * 17.5, y, deck + 8.0), rail, segs=6, smooth=None)
            a.box(f"Lamp head {s}{y}", (3.0, 1.2, 0.6), (s * 16.0, y, deck + 13.0), rail)
    for x in (-10, 0, 10):
        a.box(f"Girder {x}", (2.0, 230, 2.5), (x, 0, 12.25), conc)
    for y in (-40, 40):
        for x in (-9, 9):
            a.cyl(f"Column {x}{y}", 2.4, 9.5, (x, y, 4.75), conc, segs=10, smooth=45)
        a.box(f"Pier cap {y}", (30, 5, 2.0), (0, y, 10.25), conc, bevel=0.3)
    a.finish(ground_offset=12.0, closeup=((15, -110, 14), (0.9, -0.6, 0.25), 70))


# --------------------------------------------------------------------------
# Target sites and the ocean platforms


@builder
def target_pad():
    a = Asset("target-pad", "Concrete hardstand", texture=512, tri_limit=2500, bump_distance=0.05, seed=106,
              usage="Every ground target's level hardstand (150 x 150, scaled down where a boat channel passes); replaces the apron Part.")
    conc = a.zone("concrete", pavement("#8f9294", None, joints=(25.0, 25.0), crack=0.06, rough=0.9, stains=0.25, bump=0.3))
    slab(a, "Pad", -75, 75, -75, 75, 0, 8.0, conc, nx=6, ny=6)
    a.finish(ground_offset=4.0, closeup=((30, -40, 8), (0.6, -1.0, 0.7), 80))


@builder
def store_deck():
    a = Asset("store-deck", "Offshore store deck", texture=512, tri_limit=2500, bump_distance=0.08, seed=107,
              usage="M23/M24 ocean target decks: a steel jacket from the seabed to a 150 x 150 deck at 84 studs; the target stands on the deck.")
    steel = a.zone("steel", Z.painted_metal("#c9b23c", rough=0.5, metal=0.45, rust=0.35, streak=0.3, panels=None))

    def deck_pattern(n, col):
        x, y, z = n.xyz(n.pos())
        grate = n.mul(n.rect(x, 30.0, 26.0, 0.5, 0.2), n.rect(y, 30.0, 26.0, 0.5, 0.2))
        bars = n.lines(x, 1.2, 0.12)
        col = n.vscale(col, n.sub(1.0, n.mul(n.mul(grate, bars), 0.35)))
        h = n.sub(0.5, n.mul(n.mul(grate, bars), 0.4))
        return col, n.mul(grate, 0.05), h

    deck = a.zone("deck", standard("#5d6266", 0.6, 0.5, pattern=deck_pattern, rust=0.15, grime=0.2, streak=0.2))
    dark = a.zone("dark", Z.painted_metal("#3e4246", rough=0.6, metal=0.5, rust=0.3, panels=None))
    # z = 0 is the seabed, z = 20 the waterline, z = 84 the deck top (the highest point: the target stands there).
    legs = [(-60, -60), (60, -60), (60, 60), (-60, 60)]
    for i, (x, y) in enumerate(legs):
        a.cyl(f"Leg {i}", 3.2, 80, (x, y, 40), steel, segs=10, smooth=45)
    for i in range(4):
        (x0, y0), (x1, y1) = legs[i], legs[(i + 1) % 4]
        for z in (8.0, 24.0, 50.0):
            a.beam(f"Brace {i} {z}", (x0, y0, z), (x1, y1, z), 1.6, steel)
        a.beam(f"Diagonal {i}a", (x0, y0, 24.0), (x1, y1, 50.0), 1.3, steel)
        a.beam(f"Diagonal {i}b", (x1, y1, 24.0), (x0, y0, 50.0), 1.3, steel)
        a.beam(f"Upper {i}", (x0, y0, 50.0), (x1, y1, 76.0), 1.3, steel)
    for y in (-60, -20, 20, 60):
        a.box(f"Girder {y}", (150, 2.0, 4.0), (0, y, 78.0), dark)
    for x in (-60, 60):
        a.box(f"Cross girder {x}", (2.0, 150, 4.0), (x, 0, 78.0), dark)
    slab(a, "Deck", -75, 75, -75, 75, 80.0, 84.0, deck, nx=5, ny=5)
    a.box("Boat landing", (16, 6, 1.0), (-60, -67, 21.0), dark)
    for x in (-61.2, -58.8):
        a.beam(f"Ladder {x}", (x, -64.2, 21.0), (x, -64.2, 80.0), 0.4, dark)
    a.finish(ground_offset=20.0, closeup=((-60, -60, 30), (-0.8, -1.0, 0.4), 90))


@builder
def gangway():
    a = Asset("gangway", "Steel truss gangway (tileable)", texture=SMALL_TEXTURE, tri_limit=2500, bump_distance=0.05,
              seed=108, usage="Tileable 10 x 60 walkway from each M23/M24 store deck to the oil platform; the deck top is the contact.")
    steel = a.zone("steel", Z.painted_metal("#c9b23c", rough=0.5, metal=0.45, rust=0.3, panels=None))

    def grating(n, col):
        x, y, z = n.xyz(n.pos())
        bars = n.lines(y, 0.9, 0.1)
        return n.vscale(col, n.sub(1.0, n.mul(bars, 0.35))), None, n.sub(0.5, n.mul(bars, 0.4))

    floor = a.zone("floor", standard("#5d6266", 0.6, 0.5, pattern=grating, rust=0.15, grime=0.2))
    slab(a, "Walkway", -5, 5, -30, 30, 5.4, 6.0, floor, nx=1, ny=2)
    for s in (-1, 1):
        x = 4.5 * s
        a.beam(f"Bottom chord {s}", (x, -30, 0.4), (x, 30, 0.4), 0.7, steel)
        a.beam(f"Top chord {s}", (x, -30, 5.0), (x, 30, 5.0), 0.7, steel)
        a.beam(f"Hand rail {s}", (4.8 * s, -30, 10.0), (4.8 * s, 30, 10.0), 0.35, steel)
        a.beam(f"Knee rail {s}", (4.8 * s, -30, 8.0), (4.8 * s, 30, 8.0), 0.3, steel)
        for k in range(7):
            y = -30 + 10 * k
            a.beam(f"Vertical {s}{k}", (x, y, 0.4), (x, y, 5.0), 0.5, steel)
            a.beam(f"Post {s}{k}", (4.8 * s, y, 6.0), (4.8 * s, y, 10.0), 0.35, steel)
            if k < 6:
                a.beam(f"Diagonal {s}{k}", (x, y, 0.4 if k % 2 == 0 else 5.0), (x, y + 10, 5.0 if k % 2 == 0 else 0.4), 0.45, steel)
    a.finish(ground_offset=6.0, closeup=((0, -20, 6), (0.8, -1.0, 0.5), 30))


@builder
def equipment_hut():
    a = Asset("equipment-hut", "Prefab equipment shelter", texture=SMALL_TEXTURE, tri_limit=2500, bump_distance=0.05,
              seed=109, usage="Relay sites (M4, M9, M10, M14, M15, M17): the shelter beside each radar dish.")
    body = a.zone("body", Z.painted_metal("#b9bcb4", rough=0.6, metal=0.3, rust=0.15, panels=3.0, streak=0.3))
    dark = a.zone("dark", Z.painted_metal("#4b5055", rough=0.6, metal=0.5, rust=0.25, panels=None))

    def louvre(n, col):
        x, y, z = n.xyz(n.pos())
        slats = n.lines(z, 0.5, 0.12)
        return n.vscale(col, n.sub(1.0, n.mul(slats, 0.45))), None, n.sub(0.5, n.mul(slats, 0.5))

    grille = a.zone("grille", standard("#8c9092", 0.55, 0.4, pattern=louvre, rust=0.2))
    conc = a.zone("concrete", Z.concrete("#9b988f", joints=10.0, dirt=0.4))
    a.box("Plinth", (20, 14, 0.8), (0, 0, 0.4), conc, bevel=0.1)
    a.box("Shelter", (18, 12, 8.2), (0, 0, 4.9), body, bevel=0.15)
    a.box("Roof", (19, 13, 0.6), (0, 0, 9.3), dark, bevel=0.1)
    # One door, off-centre, on the front; no windows (a pair of openings would read as a face).
    a.box("Door", (3.6, 0.3, 6.5), (4.5, -6.1, 4.05), dark, bevel=0.05)
    a.box("Cooling unit", (2.0, 5.0, 3.6), (10.0, 1.5, 2.6), grille, bevel=0.1)
    a.box("Cable tray", (1.2, 1.2, 7.0), (-6.0, 6.6, 4.5), dark)
    a.box("Cable run", (1.2, 4.0, 0.6), (-6.0, 8.6, 0.6), dark)
    a.finish(ground_offset=0.0, closeup=((4, -6, 4), (0.6, -1.0, 0.4), 22))


@builder
def civic_hall():
    a = Asset("civic-hall", "Civic hall with portico", texture=512, tri_limit=2500, bump_distance=0.08, seed=110,
              usage="The parliament on the M21, M26 and M27 civic plazas (front faces the plaza); replaces the Parliament Parts.")
    walls = a.zone("walls", Z.windows("#d6cfbd", "#2a3138", bay=12.0, win=5.0, floor=15.0, win_h=8.0, z0=6, z1=58,
                                      frame="#e2dccb", roof_color="#6a6c6e", rough=0.75))
    stone = a.zone("stone", Z.concrete("#ddd6c4", joints=3.0, streak=0.3, dirt=0.25, joint_depth=0.15))
    column = a.zone("column", standard("#e4ddca", 0.6, 0.0, vary=0.04, grime=0.12, streak=0.25, ao=0.3))
    dome = a.zone("dome", Z.painted_metal("#5e8a78", rough=0.55, metal=0.5, rust=0.0, streak=0.35, panels=4.0))
    a.box("Hall", (230, 100, 60), (0, 30, 30), walls)
    a.box("Cornice", (234, 104, 3), (0, 30, 61.5), stone)
    a.box("Attic", (226, 96, 3), (0, 30, 64.5), stone)
    a.box("Stylobate", (210, 32, 4), (0, -36, 2), stone)
    for k, height in enumerate((3, 2, 1)):
        a.box(f"Step {k}", (200, 6, height), (0, -55 - 6 * k, height / 2), stone)
    for i in range(9):
        x = -96 + 24 * i
        a.box(f"Base {i}", (10, 10, 1.5), (x, -44, 4.75), stone)
        a.cyl(f"Column {i}", 4.2, 46.5, (x, -44, 28.75), column, segs=12, r2=3.7, smooth=50)
        a.box(f"Capital {i}", (10, 10, 2), (x, -44, 53.0), stone)
    a.box("Entablature", (214, 32, 6), (0, -36, 57.0), stone)
    a.prism("Pediment", [(-108, 60), (108, 60), (0, 79)], -52, -20, stone, axis="y")
    a.cyl("Drum", 22, 6, (0, 36, 69), stone, segs=16, smooth=50)
    a.sphere("Dome", 22, (0, 36, 72), dome, subdiv=2, scale=(1, 1, 0.7))
    a.cyl("Lantern", 3.0, 5.0, (0, 36, 89.5), stone, segs=8, smooth=50)
    a.finish(ground_offset=0.0, closeup=((0, -50, 30), (0.3, -1.0, 0.25), 120))


# --------------------------------------------------------------------------
# Rock faces and the distant ridges


def sandstone(base="#b8774f", band_a="#cf9466", band_b="#8f5236", cream="#d9b48a", varnish="#4a3426"):
    def pattern(n, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        nx, ny, nz = n.xyz(n.normal())
        strata = n.noise(n.vmul(p, (0.02, 0.02, 0.35)), 1.0, 3.0, 0.5)
        col = n.vlerp(col, srgb(band_a), n.smooth(strata, 0.45, 0.6))
        col = n.vlerp(col, srgb(band_b), n.smooth(strata, 0.62, 0.72))
        col = n.vlerp(col, srgb(cream), n.mul(n.smooth(strata, 0.35, 0.28), 0.8))
        streak = n.smooth(n.noise(n.vmul(p, (0.25, 0.25, 0.012)), 1.0, 3.0, 0.5), 0.55, 0.72)
        col = n.vlerp(col, srgb(varnish), n.mul(n.mul(streak, n.smooth(nz, 0.4, 0.1)), 0.55))
        speck = n.noise(p, 3.0, 2.0, 0.5)
        col = n.vscale(col, n.add(0.88, n.mul(speck, 0.24)))
        crack = n.smooth(n.voronoi(n.vmul(p, (1.0, 1.0, 0.4)), 0.05, "DISTANCE_TO_EDGE"), 0.03, 0.0)
        crack = n.mul(crack, n.smooth(n.noise(p, 0.05, 2.0, 0.5), 0.5, 0.62))
        col = n.vscale(col, n.sub(1.0, n.mul(crack, 0.22)))
        h = n.add(n.mul(n.noise(p, 0.8, 5.0, 0.6), 0.8), n.mul(crack, -0.6))
        return col, None, h

    return standard(base, 0.9, 0.0, pattern=pattern, vary=0.08, grime=0.1, ao=0.5, ao_dist=8.0)


def _cliff(name: str, title: str, zone_builder, seed: int, ledges: float, usage: str):
    a = Asset(name, title, texture=512, tri_limit=2500, bump_distance=0.25, seed=seed, usage=usage)
    rock = a.zone("rock", zone_builder)
    W, H, D = 240.0, 160.0, 50.0
    nx, nz = 42, 26
    xs = [-W / 2 + W * i / nx for i in range(nx + 1)]
    zs = [H * k / nz for k in range(nz + 1)]
    noise.seed_set(seed)

    def front(x, z):
        # 1 in the middle of the face, 0 at the sides and the rim, where the panel tucks back into the wall.
        e = min((W / 2 - abs(x)) / 14.0, (H - z) / 12.0, 1.0)
        e = max(0.0, e) ** 0.3
        band = math.floor(z / 18.0)
        t = z / 18.0 - band
        # Jointed columns: each block between two vertical joints stands proud by its own amount.
        u = (x + 9.0 * fbm(z * 0.01, band, seed + 2.0)) / 24.0
        cell, f = math.floor(u), u - math.floor(u)
        # Joints are eased over a fifth of a block, so neighbouring blocks never leave sharp V notches.
        w = min(1.0, max(0.0, (f - 0.8) / 0.2))
        w = w * w * (3 - 2 * w)
        a0 = noise.noise(Vector((cell * 1.7, band * 0.9, seed + 11.0)))
        a1 = noise.noise(Vector(((cell + 1) * 1.7, band * 0.9, seed + 11.0)))
        block = 6.0 * (a0 + (a1 - a0) * w)
        ledge = ledges * (t ** 3) * (0.7 + 0.3 * fbm(x * 0.01, band, seed)) * min(1.0, (1.0 - t) * 8.0)
        erosion = 3.0 * fbm(x * 0.02, z * 0.02, seed + 3.0, 4)
        y = -D / 2 - ledge - erosion - block
        return D / 2 + (y - D / 2) * e

    verts, faces = [], []
    for i in range(nx + 1):
        for k in range(nz + 1):
            verts.append((xs[i], front(xs[i], zs[k]), zs[k]))
    for i in range(nx):
        for k in range(nz):
            v = i * (nz + 1) + k
            faces.append((v, v + 1, v + nz + 2, v + nz + 1))
    base = len(verts)
    verts.extend([(-W / 2, D / 2, 0), (W / 2, D / 2, 0), (W / 2, D / 2, H), (-W / 2, D / 2, H)])
    faces.append((base + 3, base + 2, base + 1, base))
    a.mesh("Face", verts, faces, rock, smooth=60)
    a.finish(ground_offset=2.0, closeup=((0, -25, 60), (0.4, -1.0, 0.1), 120))


@builder
def cliff_sandstone():
    _cliff("cliff-sandstone", "Sandstone cliff face panel", sandstone(), 111, 6.0,
           "Rock-face panels set into canyon mesa walls (M3, M4, M7, M8, M9): strata ledges and desert varnish.")


@builder
def cliff_granite():
    _cliff("cliff-granite", "Granite cliff face panel", Z.rock("#8a8780", color2="#5f5c57", lichen="#6f7552"), 112, 3.0,
           "Rock-face panels set into plateau mesa walls (M10, M14, M17, M18): jointed granite with lichen.")


def alpine(n, col):
    p = n.pos()
    x, y, z = n.xyz(p)
    nx, ny, nz = n.xyz(n.normal())
    steep = n.smooth(nz, 0.8, 0.6)
    meadow = n.smooth(z, 900.0, 650.0)
    forest = n.mul(n.smooth(z, 620.0, 420.0), n.smooth(n.noise(p, 0.004, 3.0, 0.6), 0.3, 0.45))
    snow = n.mul(n.smooth(z, 1120.0, 1260.0), n.smooth(nz, 0.5, 0.72))
    col = n.vlerp(srgb("#5f5b55"), col, meadow)
    col = n.vlerp(col, srgb("#5a5751"), n.mul(steep, 0.7))
    col = n.vlerp(col, srgb("#2b4229"), n.mul(forest, n.sub(1.0, n.mul(steep, 0.5))))
    col = n.vlerp(col, srgb("#dfe4e8"), snow)
    gully = n.smooth(n.noise(n.vmul(p, (0.01, 0.01, 0.002)), 1.0, 4.0, 0.55), 0.6, 0.72)
    col = n.vscale(col, n.sub(1.0, n.mul(gully, 0.2)))
    h = n.mul(n.noise(p, 0.02, 5.0, 0.6), 0.9)
    return col, n.mul(snow, -0.3), h


def desert(n, col):
    p = n.pos()
    x, y, z = n.xyz(p)
    nx, ny, nz = n.xyz(n.normal())
    strata = n.noise(n.vmul(p, (0.0008, 0.0008, 0.012)), 1.0, 3.0, 0.5)
    col = n.vlerp(col, srgb("#c58a5e"), n.smooth(strata, 0.45, 0.6))
    col = n.vlerp(col, srgb("#8a4f35"), n.smooth(strata, 0.62, 0.74))
    flat = n.smooth(nz, 0.7, 0.9)
    col = n.vlerp(col, srgb("#d6b083"), n.mul(flat, 0.6))
    varnish = n.mul(n.smooth(nz, 0.5, 0.2), n.smooth(n.noise(n.vmul(p, (0.01, 0.01, 0.001)), 1.0, 3.0, 0.5), 0.5, 0.7))
    col = n.vlerp(col, srgb("#4e3628"), n.mul(varnish, 0.45))
    h = n.mul(n.noise(p, 0.02, 5.0, 0.6), 0.9)
    return col, None, h


def _ridge(name: str, title: str, paint, base: str, seed: int, usage: str):
    a = Asset(name, title, texture=512, tri_limit=2500, bump_distance=2.0, seed=seed, usage=usage)
    zone = a.zone("ridge", standard(base, 0.92, 0.0, pattern=paint, vary=0.06, vary_scale=0.002, grime=0.0, ao=0.3,
                                    ao_dist=60.0))
    W, D = 2000.0, 2000.0
    nx, ny = 48, 24
    xs = [-W / 2 + W * i / nx for i in range(nx + 1)]
    ys = [-D / 2 + D * j / ny for j in range(ny + 1)]
    noise.seed_set(seed)
    rng = a.rng
    peaks = [(rng.uniform(-850, 850), rng.uniform(140, 260), rng.uniform(140, 260)) for _ in range(3)]
    # The crest runs along a grid line (so the measured crest is the authored one) and every column's
    # crest clears 1170 studs: from anywhere under the 1050-stud altitude ceiling nothing beyond shows.
    jc = ny // 2

    def crest(x):
        c = 1265.0 + 190.0 * fbm(x * 0.0012, 0.0, seed, 3)
        for px, height, width in peaks:
            c += height * math.exp(-((x - px) / width) ** 2)
        return min(1490.0, max(1170.0, c))

    crests = [crest(x) for x in xs]

    def height(i, j):
        c = crests[i]
        if j == 0 or j == ny:
            return 0.0
        d = abs(j - jc) / jc
        h = c * (1 - d) ** (1.6 if j < jc else 1.35)
        shoulder = 4.0 * d * (1.0 - d)
        gully = abs(noise.noise(Vector((xs[i] * 0.0025, ys[j] * 0.0015, seed + 5.0))))
        spur = fbm(xs[i] * 0.002, ys[j] * 0.002, seed + 9.0, 3)
        return max(0.0, h * (1.0 - 0.26 * shoulder * gully) + 60.0 * shoulder * spur)

    obj = grid(a, "Ridge", xs, ys, height, zone, close_x=True, smooth=70)
    crest_min = min(max(height(i, j) for j in range(ny + 1)) for i in range(nx + 1))
    a.extra["crestMinStuds"] = round(crest_min, 2)
    a.finish(ground_offset=30.0, preview_ground=False, closeup=((0, -700, 450), (0.2, -1.0, 0.2), 2300))


@builder
def ridge_alpine():
    _ridge("ridge-alpine", "Distant mountain ridge (alpine)", alpine, "#7f8a5c", 113,
           "Backdrop ring past the flyable edge on farm, plateau, coast and M1/M2 maps (crest above the altitude ceiling); also far islands.")


@builder
def ridge_desert():
    _ridge("ridge-desert", "Distant mountain ridge (desert)", desert, "#b07a52", 114,
           "Backdrop ring past the flyable edge on canyon maps (M3, M4, M7, M8, M9): banded sandstone.")


# --------------------------------------------------------------------------
# Fences and power lines


@builder
def fence_span():
    a = Asset("fence-span", "Timber post-and-rail fence (tileable)", texture=SMALL_TEXTURE, tri_limit=2500,
              bump_distance=0.05, seed=115, usage="Tileable 60-stud farm fence along fields and farmsteads (farm and plateau maps).")
    wood = a.zone("wood", Z.boards("#8b7a63", width=0.5, axis="z", rough=0.9))
    rng = a.rng
    for k in range(7):
        y = -30 + 10 * k
        lean = math.radians(rng.uniform(-2.0, 2.0))
        a.box(f"Post {k}", (0.8, 0.8, 5.5), (0, y, 2.75), wood, rot=(lean, rng.uniform(-0.03, 0.03), 0))
    for z in (2.2, 4.2):
        a.box(f"Rail {z}", (0.35, 60, 0.6), (0.55, 0, z), wood)
    a.finish(ground_offset=0.5, closeup=((0, -20, 3), (1.0, -0.6, 0.3), 16))


@builder
def power_line_span():
    a = Asset("power-line-span", "Lattice pylon with line span (tileable)", texture=512, tri_limit=2500,
              bump_distance=0.05, seed=116,
              usage="Tileable 300-stud power line: one lattice pylon (front end) and its conductors back to the previous pylon; outer roads.")
    steel = a.zone("steel", Z.painted_metal("#8f9496", rough=0.45, metal=0.7, rust=0.15, panels=None))
    insul = a.zone("insulator", standard("#6f7f88", 0.25, 0.1, grime=0.05))
    wire = a.zone("wire", standard("#3a3c3e", 0.5, 0.6, grime=0.0, ao=0.0))
    conc = a.zone("concrete", Z.concrete("#9b988f", joints=10.0, dirt=0.4))
    Y = -150.0
    levels = [0.0, 14.0, 28.0, 42.0, 56.0, 66.0]

    def half(z):
        return 6.0 - 4.4 * min(z, 56.0) / 56.0 - (0.4 * (z - 56.0) / 10.0 if z > 56.0 else 0.0)

    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for k in range(len(levels) - 1):
        z0, z1 = levels[k], levels[k + 1]
        h0, h1 = half(z0), half(z1)
        for c, (sx, sy) in enumerate(corners):
            a.beam(f"Leg {k}{c}", (sx * h0, Y + sy * h0, z0), (sx * h1, Y + sy * h1, z1), 0.55, steel)
            nx_, ny_ = corners[(c + 1) % 4]
            a.beam(f"Ring {k}{c}", (sx * h1, Y + sy * h1, z1), (nx_ * h1, Y + ny_ * h1, z1), 0.4, steel)
            a.beam(f"Brace {k}{c}", (sx * h0, Y + sy * h0, z0), (nx_ * h1, Y + ny_ * h1, z1), 0.32, steel)
    for c, (sx, sy) in enumerate(corners):
        a.box(f"Footing {c}", (2.2, 2.2, 1.0), (sx * 6.0, Y + sy * 6.0, 0.5), conc)
    arms = [(52.0, 13.0), (62.0, 8.0)]
    for z, reach in arms:
        a.beam(f"Arm {z}", (-reach, Y, z), (reach, Y, z), 0.7, steel)
        for s in (-1, 1):
            a.beam(f"Arm tie {z}{s}", (s * half(z - 6), Y, z - 6), (s * reach, Y, z), 0.35, steel)
    a.beam("Peak", (0, Y, 66.0), (0, Y, 70.0), 0.5, steel)
    points = []
    for z, reach in arms:
        for s in (-1, 1):
            a.cyl(f"Insulator {z}{s}", 0.5, 4.0, (s * reach, Y, z - 2.0), insul, segs=6, smooth=None)
            points.append((s * reach, z - 4.0))
    points.append((0.0, 70.0))
    for w, (x, z) in enumerate(points):
        sag = 7.0 if z < 69 else 5.0
        prev = None
        for k in range(11):
            t = k / 10
            p = (x, Y + 300.0 * t, z - sag * 4 * t * (1 - t))
            if prev is not None:
                a.beam(f"Wire {w}{k}", prev, p, 0.3 if z < 69 else 0.22, wire, part="Wires")
            prev = p
    a.finish(ground_offset=0.5, closeup=((0, -150, 50), (1.0, -0.8, 0.2), 60))
