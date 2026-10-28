"""World set generators: naval, harbour, airfield, city, farm, relay and nature props.

Sizes follow Roblox scale (1 stud ~ 0.28 m) via ``m()`` and are sized so the
in-game Kestrel (26 studs long) reads correctly against them. Every asset is
one delivery mesh with its pivot at the bottom centre; ``groundOffset`` in the
checklist is the height of the ground or waterline contact above that bottom.
"""

from __future__ import annotations

import math

from mathutils import Vector, noise

import zones as Z
from skyasset import Asset, m, srgb, standard

BUILDERS: dict = {}
# Mobile texture budget: props that are small on screen (trees, rocks, containers,
# farm buildings, mast, radar) bake 256² maps; large props keep 512², aircraft 1024².
SMALL_TEXTURE = 256


def builder(fn):
    BUILDERS[fn.__name__.replace("_", "-")] = fn
    return fn


def octagon(r: float, z: float, cx: float = 0.0, cy: float = 0.0, sides: int = 8, phase: float | None = None):
    phase = math.pi / sides if phase is None else phase
    return [(cx + r * math.cos(phase + i * math.tau / sides), cy + r * math.sin(phase + i * math.tau / sides), z) for i in range(sides)]


def rect_ring(x0, y0, x1, y1, z):
    return [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]


def frustum(a: Asset, name, zone, x0, y0, x1, y1, z0, z1, inset=0.0, inset_y=None, front_inset=None, **kw):
    """A box whose top is inset (sloped stealthy or battered walls)."""
    iy = inset if inset_y is None else inset_y
    fy = iy if front_inset is None else front_inset
    return a.loft(name, [rect_ring(x0, y0, x1, y1, z0), rect_ring(x0 + inset, y0 + fy, x1 - inset, y1 - iy, z1)], zone,
                  smooth=None, **kw)


# --------------------------------------------------------------------------
# Nature


def _rock(name: str, title: str, seed: int, blobs, flatten: float):
    a = Asset(name, title, texture=SMALL_TEXTURE, tri_limit=2500, bump_distance=0.12, seed=seed,
              usage="Scattered boulders and outcrops in canyon, coastal and farm missions (Scenery.Rocks).")
    stone = a.zone("rock", Z.rock("#83807a" if seed != 3 else "#8f7c66", color2="#5f5b55" if seed != 3 else "#6d5a48"))
    noise.seed_set(seed)
    for i, (loc, r, scale, sub) in enumerate(blobs):
        def displace(co, r=r, i=i):
            d = co.normalized()
            n1 = noise.fractal(d * 1.3 + Vector((seed * 3.1 + i, 0, 0)), 0.6, 2.0, 4)
            n2 = noise.ridged_multi_fractal(d * 2.4 + Vector((0, seed + i, 0)), 0.9, 2.1, 3, 0.5, 2.0)
            return co * (1.0 + 0.28 * n1 + 0.08 * n2)

        a.sphere(f"Rock{i}", r, loc, stone, subdiv=sub, scale=scale, displace=displace, smooth=45)
    obj = a.pieces[0][0]
    a.finish(origin="bottom", ground_offset=flatten)


@builder
def rock_a():
    _rock("rock-a", "Rounded granite boulder", 1, [((0, 0, 0), 7.5, (1.15, 0.95, 0.72), 4)], 1.2)


@builder
def rock_b():
    _rock("rock-b", "Split granite outcrop", 2,
          [((0, 0, 0), 9.0, (1.5, 0.8, 0.62), 3), ((7, 3, -1), 6.0, (1.0, 0.9, 0.9), 3), ((-8, -2, -2), 5.0, (1.1, 1.0, 0.7), 3)], 2.0)


@builder
def rock_c():
    _rock("rock-c", "Weathered sandstone stack", 3,
          [((0, 0, 4), 6.5, (0.95, 0.85, 1.6), 4), ((5, -3, -2), 4.0, (1.1, 1.0, 0.8), 3)], 2.5)


@builder
def pine():
    a = Asset("pine", "Pine tree", texture=SMALL_TEXTURE, tri_limit=800, bump_distance=0.25, seed=11,
              usage="Coniferous scatter for farm, relay and canyon rims (Scenery.Trees).")
    wood = a.zone("bark", Z.bark("#56402f"))
    needles = a.zone("needles", Z.foliage("#1f3a28", tip="#4a6638", clump=0.9, radial_tip=10))
    height = m(18)
    a.cyl("Trunk", 1.3, height * 0.95, (0, 0, height * 0.475), wood, segs=6, r2=0.2, smooth=60)
    tiers = 9
    segs = 12
    rng = a.rng
    for t in range(tiers):
        f = t / (tiers - 1)
        base = height * (0.13 + 0.76 * f)
        radius = (1 - f) ** 0.9 * 12.0 + 2.2
        h = radius * 0.95 + 4.0
        phase = rng.random() * math.tau
        under, rim, mid = [], [], []
        for i in range(segs):
            ang = phase + i * math.tau / segs
            tip = i % 2 == 0
            rr = radius * ((0.95 + 0.25 * rng.random()) if tip else (0.62 + 0.12 * rng.random()))
            droop = (1.8 + 1.2 * rng.random()) if tip else 0.4
            rim.append((rr * math.cos(ang), rr * math.sin(ang), base - droop))
            under.append((0.3 * radius * math.cos(ang), 0.3 * radius * math.sin(ang), base + h * 0.18))
            mr = radius * (0.5 if tip else 0.38)
            mid.append((mr * math.cos(ang), mr * math.sin(ang), base + h * 0.45))
        apex = [(0.3 * (rng.random() - 0.5), 0.3 * (rng.random() - 0.5), base + h)] * segs
        a.loft(f"Tier{t}", [under, rim, mid, apex], needles, smooth=80)
    a.finish(ground_offset=0.0)


@builder
def broadleaf():
    a = Asset("broadleaf", "Broadleaf tree", texture=SMALL_TEXTURE, tri_limit=800, bump_distance=0.25, seed=12,
              usage="Deciduous scatter for farm valleys, orchards and city parks (Scenery.Trees).")
    wood = a.zone("bark", Z.bark("#5a4838"))
    leaves = a.zone("leaves", Z.foliage("#2f4a22", tip="#5f7a38", clump=1.1, radial_tip=16))
    trunk_h = m(5.5)
    a.cyl("Trunk", 2.6, trunk_h + 4, (0, 0, (trunk_h + 4) / 2), wood, segs=7, r2=1.6, smooth=60)
    for i, (dx, dy, dz) in enumerate(((6, 2, 9), (-5, 4, 8), (1, -6, 9))):
        a.beam(f"Branch{i}", (0, 0, trunk_h - 2), (dx, dy, trunk_h + dz), 2.0, wood, segs=6)
    noise.seed_set(12)

    def lumpy(scale_seed):
        def displace(co):
            d = co.normalized()
            return co * (1.0 + 0.22 * noise.fractal(d * 1.6 + Vector((scale_seed, 0, 0)), 0.7, 2.0, 3))
        return displace

    crown_z = trunk_h + 12
    a.sphere("Crown", 13.5, (0, 0, crown_z), leaves, subdiv=3, scale=(1.05, 1.0, 0.82), displace=lumpy(1), smooth=80)
    for i, (dx, dy, dz, r) in enumerate(((10, 3, -3, 8), (-9, 5, -2, 8.5), (2, -10, -2, 8), (-2, 2, 8, 8))):
        a.sphere(f"Clump{i}", r, (dx, dy, crown_z + dz), leaves, subdiv=2, displace=lumpy(i + 3), smooth=80)
    a.finish(ground_offset=0.0)


# --------------------------------------------------------------------------
# Naval and harbour


def hull_paint(top="#8b939a", deck="#4d5357", waterline=16.0, deck_edge=None, vls=None):
    """Haze-grey topsides, dark non-skid deck, black boot-top and red antifouling.

    ``deck_edge=(y0, y1, deck_z, edge)`` paints thin pale safety lines that only trace
    the flight deck's own boundary (port and starboard edges, stern edge and the
    hangar face) between y0 and y1, where ``edge(n, y)`` is the deck half-width. The
    deck inside stays plain: no circle, cross or other mark that could read as a glyph.
    """

    def pattern(n, col):
        x, y, z = n.xyz(n.pos())
        nx, ny, nz = n.xyz(n.normal())
        deckm = n.smooth(nz, 0.6, 0.85)
        col = n.vlerp(col, srgb(deck), deckm)
        boot = n.smooth(z, waterline + 1.6, waterline + 1.2)
        col = n.vlerp(col, srgb("#1d1f21"), boot)
        col = n.vlerp(col, srgb("#6a2b24"), n.smooth(z, waterline - 1.0, waterline - 1.4))
        # Rust weeping from scuppers and anchor hawse along the topsides.
        weep = n.mul(n.smooth(n.noise(n.vmul(n.pos(), (0.05, 0.6, 0.02)), 3.0, 2.0, 0.5), 0.62, 0.7), n.smooth(z, waterline + 10, waterline + 2))
        col = n.vlerp(col, srgb("#6d4a35"), n.mul(weep, 0.35))
        # Hull plating seams.
        seams = n.mul(n.maxf(n.lines(y, 14.0, 0.06), n.lines(z, 5.5, 0.06)), n.sub(1.0, deckm))
        col = n.vscale(col, n.sub(1.0, n.mul(seams, 0.15)))
        h = n.sub(0.5, n.mul(seams, 0.3))
        if deck_edge is not None:
            y0, y1, deck_z, edge = deck_edge
            on_deck = n.mul(n.mul(deckm, n.band(z, deck_z - 0.6, deck_z + 0.6, 0.1)), n.band(y, y0, y1, 0.1))
            inset = n.sub(edge(n, y), n.absf(x))
            sides = n.smooth(inset, 1.9, 1.5)
            ends = n.maxf(n.smooth(n.sub(y, y0), 1.9, 1.5), n.smooth(n.sub(y1, y), 1.9, 1.5))
            col = n.vlerp(col, srgb("#b4b2a8"), n.mul(n.mul(n.maxf(sides, ends), on_deck), 0.85))
        if vls is not None:
            y0, y1, w = vls
            cells = n.mul(n.mul(n.band(y, y0, y1, 0.1), n.band(x, -w, w, 0.1)), deckm)
            grid = n.maxf(n.lines(y, 3.4, 0.12), n.lines(x, 3.4, 0.12))
            col = n.vlerp(col, srgb("#3f4448"), n.mul(cells, 0.6))
            col = n.vscale(col, n.sub(1.0, n.mul(n.mul(cells, grid), 0.4)))
            h = n.sub(h, n.mul(n.mul(cells, grid), 0.4))
        return col, n.mul(deckm, 0.2), h

    return standard(top, 0.62, 0.15, pattern=pattern, streak=0.3, grime=0.12, ao=0.4, ao_dist=4.0)


@builder
def frigate():
    a = Asset("frigate", "Navy frigate", texture=512, tri_limit=6000, bump_distance=0.15, seed=21,
              usage="M23 frigate ring (three hulls, one protected) and harbour dressing in Act III; WorldAssets.Place(\"Frigate\", ...).")
    wl = 16.0
    D = 42.0  # main deck amidships: ~7 m freeboard over a 4.5 m draught

    def up(z):
        return z + (D - 32.0)

    L, B = 430.0, 27.0

    def deck_half_width(n, y):
        # The hull loft's deck edge (1.07 x half-beam) aft of the 0.42 station; see the rings below.
        t = n.math("DIVIDE", n.sub(n.math("DIVIDE", n.add(y, L / 2), L), 0.42), 0.58)
        return n.mul(n.sub(1.0, n.mul(n.mul(t, t), 0.1)), B * 1.07)

    hull = a.zone("hull", hull_paint(waterline=wl, deck_edge=(128.6, L / 2, D, deck_half_width), vls=(-128, -108, 9)))
    sup = a.zone("super", Z.windows("#8f979e", "#1b2329", bay=4.5, win=3.0, floor=9.0, win_h=2.6, z0=up(55), z1=up(63),
                                      rough=0.6, roof_color="#5a6065", frame="#8f979e", streak=0.3, base_dirt=0.0))
    dark = a.zone("dark", Z.painted_metal("#3c4146", rough=0.6, metal=0.3, rust=0.1, panels=None))
    soot = a.zone("soot", standard("#2a2b2c", 0.8, 0.2, grime=0.3, streak=0.5))
    boat = a.zone("boat", standard("#d9822b", 0.6, 0.0, grime=0.1))
    stations = 28
    rings = []
    for k in range(stations + 1):
        s = k / stations
        y = -L / 2 + s * L
        if s < 0.42:
            b = (s / 0.42) ** 0.55
        else:
            b = 1 - 0.1 * ((s - 0.42) / 0.58) ** 2
        b = max(b, 0.02)
        deck = D + 9 * max(0.0, 1 - s / 0.35) ** 2
        keel = 15.5 * max(0.0, 1 - s / 0.14) ** 1.6 + (7.0 * ((s - 0.84) / 0.16) ** 1.5 if s > 0.84 else 0.0)
        w = B * b
        half = [(0.0, keel), (0.5 * w, keel + 1.0), (0.86 * w, keel + 4.5 * b + 0.5), (w, max(wl, keel + 6)),
                (w * 1.05, 28.0), (w * 1.08, deck - 0.8), (w * 1.07, deck)]
        ring = [(x, y, z) for x, z in half] + [(-x, y, z) for x, z in reversed(half[1:])]
        rings.append(ring)
    a.loft("Hull", rings, hull, smooth=40)
    # Forward superstructure, bridge, integrated mast, funnel and hangar: sloped stealth faces.
    frustum(a, "Fore block", sup, -19, -70, 19, 8, D - 0.5, up(55), inset=2.5, bevel=0.5)
    frustum(a, "Bridge", sup, -16, -62, 16, -32, up(55), up(64), inset=1.0, front_inset=4.0, bevel=0.4)
    frustum(a, "Bridge wings", sup, -20, -58, 20, -50, up(58), up(62), inset=0.5)
    frustum(a, "Mast", sup, -10, -40, 10, -18, up(64), up(108), inset=6.0, inset_y=7.0, bevel=0.4)
    a.cyl("Mast pole", 0.9, 34, (0, -29, up(124)), dark, segs=6, smooth=None)
    a.beam("Yard", (-11, -29, up(116)), (11, -29, up(116)), 1.0, dark)
    a.beam("Yard high", (-6, -29, up(131)), (6, -29, up(131)), 0.7, dark)
    for i, dy in enumerate((-7.5, 7.5)):
        a.box(f"Radar panel {i}", (12.5, 0.8, 12.5), (0, -29 + dy * 0.8, up(92)), dark, rot=(math.radians(18 if dy < 0 else -18), 0, 0))
    for i, side in enumerate((-1, 1)):
        a.box(f"Radar panel side {i}", (0.8, 11, 11), (side * 6.6, -29, up(92)), dark, rot=(0, math.radians(side * -18), 0))
    a.sphere("Dome", 4.5, (0, -29, up(141)), dark, subdiv=3, scale=(1, 1, 0.9))
    frustum(a, "Mid block", sup, -18, 8, 18, 60, D - 0.5, up(50), inset=2.0, bevel=0.5)
    frustum(a, "Funnel", sup, -9, 18, 9, 46, up(50), up(74), inset=1.5, bevel=0.4)
    frustum(a, "Funnel cap", soot, -7.5, 19.5, 7.5, 44.5, up(74), up(76), inset=0.6)
    frustum(a, "Hangar", sup, -21, 60, 21, 128, D - 0.5, up(56), inset=2.2, front_inset=0.0, bevel=0.5)
    a.box("Hangar door", (30, 0.6, 20), (0, 128.2, up(43)), dark)
    a.cyl("Aft mast", 0.7, 22, (0, 100, up(67)), dark, segs=6, smooth=None)
    for i, (x, y, h) in enumerate(((5, -5, 14), (-5, -5, 10), (12, 70, 9), (-12, 70, 12))):
        a.cyl(f"Whip {i}", 0.3, h, (x, y, up(55) + h / 2), dark, segs=4, smooth=None)
    # Deck gun on a faceted shield, point-defence domes, launcher boxes.
    frustum(a, "Gun shield", sup, -6, -158, 6, -142, D + 3, D + 11, inset=1.8, front_inset=4.0)
    a.cyl("Gun barrel", 0.75, 24, (0, -166, D + 8.5), dark, segs=8, r2=0.55, rot=(math.radians(84), 0, 0), smooth=50)
    for i, (x, y, z) in enumerate(((0, -66, up(57)), (0, 126, up(58.5)))):
        a.cyl(f"CIWS base {i}", 3.0, 3.0, (x, y, z), sup, segs=10)
        a.sphere(f"CIWS dome {i}", 3.2, (x, y, z + 3.5), sup, subdiv=3, scale=(1, 1, 1.25))
    for side in (-1, 1):
        a.box(f"Launcher {side}", (8, 14, 5), (side * 6.5, 10, up(52.5)), dark, rot=(math.radians(-12), 0, 0))
    # Boats in recessed bays, life-raft canisters, breakwater, anchor hawse fairings.
    for side in (-1, 1):
        a.sphere(f"RHIB {side}", 1.0, (side * 23.5, 30, D + 6), boat, subdiv=3, scale=(3.6, 12, 2.2))
        a.box(f"Davit {side}", (1.2, 1.2, 9), (side * 25.5, 30, D + 8), dark)
        for k in range(3):
            a.cyl(f"Raft {side} {k}", 1.3, 4.5, (side * 22.5, -20 + k * 5.5, D + 2), boat, segs=8,
                  rot=(math.radians(90), 0, 0))
        a.box(f"Hawse {side}", (1.2, 6, 3), (side * 14.2, -170, D - 4), dark, rot=(0, 0, math.radians(side * -14)))
    a.prism("Breakwater", [(-14, -116), (0, -126), (14, -116), (14, -114), (0, -124), (-14, -114)], D + 1, D + 4.5, sup)
    a.finish(ground_offset=wl, extra_notes={
        "noGoreOrWeaponsGlorification": "A covered deck gun and point-defence domes as on any warship; nothing aimed, firing or damaged.",
        "noRealMilitaryInsignia": "No pennant numbers, ensigns, flags or class markings; hull form is an original stealth-frigate design.",
        "noText": "No letters, numbers or symbols: the helideck is plain non-skid with only thin pale lines along its own edges (port, starboard, stern, hangar face); no circle, cross or centre line.",
    })


@builder
def oil_platform():
    a = Asset("oil-platform", "Offshore oil platform", texture=512, tri_limit=6000, bump_distance=0.15, seed=22,
              usage="M23/M24 'ocean platform' rig: protected centrepiece and ground-target deck; WorldAssets.Place(\"OilPlatform\", ...).")
    wl = 60.0
    steel = a.zone("steel", Z.painted_metal("#c9b23c", rough=0.55, metal=0.3, rust=0.45, streak=0.4, panels=None))
    grey = a.zone("grey", Z.painted_metal("#8a8f92", rough=0.6, metal=0.4, rust=0.35, panels=8.0))
    white = a.zone("white", Z.windows("#d6d6d0", "#1f2830", bay=5.0, win=2.6, floor=10.0, win_h=3.0, z0=156, z1=196,
                                        frame="#d6d6d0", rough=0.6, streak=0.35, base_dirt=0.0))
    deck = a.zone("deck", standard("#5d6266", 0.85, 0.2, grime=0.3, rust=0.2, bump=0.3, bump_scale=4))
    red = a.zone("red", Z.painted_metal("#b5452e", rough=0.6, metal=0.25, rust=0.3, panels=None))
    soot = a.zone("soot", standard("#2a2928", 0.85, 0.2, grime=0.3))
    orange = a.zone("orange", standard("#e07a22", 0.55, 0.0, grime=0.1))
    pad = a.zone("pad", Z.asphalt_deck("#3f5148"))
    # Battered jacket: four legs from the cut seabed line to the cellar deck.
    top, bot = 75.0, 92.0
    legs = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            p0 = (sx * bot, sy * bot * 0.8, 0)
            p1 = (sx * top, sy * top * 0.8, 120)
            legs.append((p0, p1))
            a.beam(f"Leg {sx}{sy}", p0, p1, 7.0, steel, segs=12)
            a.cyl(f"Leg can {sx}{sy}", 4.5, 8, (sx * top, sy * top * 0.8, 124), grey, segs=10)

    def leg_at(i, z):
        (x0, y0, z0), (x1, y1, z1) = legs[i]
        t = (z - z0) / (z1 - z0)
        return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z)

    faces = [(0, 1), (2, 3), (0, 2), (1, 3)]
    levels = [8, 40, 72, 104]
    for li, z in enumerate(levels):
        for fi, (i, j) in enumerate(faces):
            a.beam(f"Ring {li} {fi}", leg_at(i, z), leg_at(j, z), 2.6, steel, segs=6)
            if li + 1 < len(levels):
                z2 = levels[li + 1]
                a.beam(f"X {li} {fi} a", leg_at(i, z), leg_at(j, z2), 2.0, steel, segs=6)
                a.beam(f"X {li} {fi} b", leg_at(j, z), leg_at(i, z2), 2.0, steel, segs=6)
    # Decks with edge girders and a lattice between.
    a.box("Cellar deck", (200, 170, 4), (0, 0, 124), deck)
    a.box("Main deck", (220, 180, 4), (0, 0, 152), deck)
    for sx in (-1, 1):
        for sy in (-1, 1):
            a.box(f"Deck post {sx}{sy}", (4, 4, 28), (sx * 96, sy * 80, 138), grey)
        a.box(f"Girder x {sx}", (220, 2.5, 6), (0, sx * 89, 147), grey)
        a.box(f"Girder y {sx}", (2.5, 180, 6), (sx * 109, 0, 147), grey)
        for k in range(5):
            y0 = -80 + k * 40
            a.beam(f"Deck brace {sx} {k}", (sx * 96, y0, 126), (sx * 96, y0 + 40, 150), 1.4, grey)
    # Accommodation block, process modules, tanks.
    a.box("Quarters", (70, 50, 42), (-60, -50, 175), white, bevel=0.8)
    a.box("Quarters roof plant", (30, 20, 6), (-70, -50, 199), grey)
    for i, (x, y, w, d, h) in enumerate(((30, -55, 60, 45, 22), (55, 35, 70, 60, 26), (-40, 40, 50, 55, 18))):
        a.box(f"Module {i}", (w, d, h), (x, y, 154 + h / 2), grey, bevel=0.6)
    for i in range(3):
        a.cyl(f"Tank {i}", 7, 34, (-5, 25 + i * 16, 162), white, segs=12, rot=(0, math.radians(90), 0))
    for i in range(2):
        a.sphere(f"Lifeboat {i}", 1.0, (-98, -70 + i * 22, 140), orange, subdiv=2, scale=(4, 9, 3.5))
    # Helideck on a cantilever above the quarters.
    a.cyl("Helideck", 36, 2.5, (-70, -60, 206), pad, segs=8, smooth=None)
    a.cyl("Helideck rim", 37, 1.2, (-70, -60, 205), grey, segs=8, smooth=None)
    for k in range(4):
        ang = math.radians(45 + 90 * k)
        a.beam(f"Helideck strut {k}", (-70 + 30 * math.cos(ang), -60 + 30 * math.sin(ang), 205), (-70 + 10 * math.cos(ang), -60 + 10 * math.sin(ang), 196), 1.6, grey)
    # Derrick: tapered lattice with girts and X-bracing.
    dx, dy, z0, z1, b0, b1 = 45.0, 20.0, 180.0, 300.0, 15.0, 4.5
    a.box("Drill floor", (40, 40, 6), (dx, dy, 177), red)
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]

    def dpt(c, z):
        t = (z - z0) / (z1 - z0)
        r = b0 + (b1 - b0) * t
        return (dx + c[0] * r, dy + c[1] * r, z)

    for c in corners:
        a.beam(f"Derrick leg {c}", dpt(c, z0), dpt(c, z1), 1.6, red)
    girts = [z0 + (z1 - z0) * k / 6 for k in range(7)]
    for gi, z in enumerate(girts):
        for ci in range(4):
            a.beam(f"Girt {gi} {ci}", dpt(corners[ci], z), dpt(corners[(ci + 1) % 4], z), 0.9, red)
        if gi + 1 < len(girts):
            for ci in range(4):
                a.beam(f"Derrick X {gi} {ci}", dpt(corners[ci], z), dpt(corners[(ci + 1) % 4], girts[gi + 1]), 0.7, red)
    a.box("Crown block", (12, 12, 6), (dx, dy, z1 + 3), grey)
    # Flare boom: triangular lattice reaching out from the deck edge.
    root = Vector((105, 40, 152))
    tip = Vector((205, 75, 225))
    axis = (tip - root).normalized()
    side = axis.cross(Vector((0, 0, 1))).normalized()
    up = side.cross(axis).normalized()
    chords = [side * 4 - up * 2.5, -side * 4 - up * 2.5, up * 4.5]
    bays = 8
    for ci, off in enumerate(chords):
        a.beam(f"Boom chord {ci}", root + off, tip + off * 0.5, 1.2, steel)
    for k in range(bays + 1):
        t = k / bays
        pts = [root + (tip - root) * t + off * (1 - 0.5 * t) for off in chords]
        for ci in range(3):
            a.beam(f"Boom ring {k} {ci}", pts[ci], pts[(ci + 1) % 3], 0.6, steel)
        if k < bays:
            t2 = (k + 1) / bays
            nxt = [root + (tip - root) * t2 + off * (1 - 0.5 * t2) for off in chords]
            for ci in range(3):
                a.beam(f"Boom diag {k} {ci}", pts[ci], nxt[(ci + 1) % 3], 0.5, steel)
    a.cyl("Flare tip", 2.4, 10, tuple(tip + up * 4), soot, segs=10, smooth=40)
    # Pedestal crane.
    a.cyl("Crane pedestal", 4, 28, (85, -70, 168), steel, segs=10)
    a.box("Crane house", (12, 10, 9), (85, -70, 186), steel)
    boom0, boom1 = Vector((85, -64, 186)), Vector((85, 20, 228))
    for off in (Vector((-2, 0, 0)), Vector((2, 0, 0))):
        a.beam(f"Crane boom {off.x}", boom0 + off, boom1 + off * 0.3, 1.2, steel)
    for k in range(6):
        t = k / 5
        p = boom0 + (boom1 - boom0) * t
        a.beam(f"Crane rung {k}", p + Vector((-2 + 1.4 * t, 0, 0)), p + Vector((2 - 1.4 * t, 0, 0)), 0.5, steel)
    a.finish(ground_offset=wl)


@builder
def harbour_quay():
    a = Asset("harbour-quay", "Harbour quay segment", texture=512, tri_limit=2500, bump_distance=0.12, seed=23,
              usage="Open-piled quay segments for harbour missions (M19-M27); tile end to end along a coast. WorldAssets.Place(\"HarbourQuay\", ...).")
    wl = 40.0

    def quay_top(n, col):
        x, y, z = n.xyz(n.pos())
        nx, ny, nz = n.xyz(n.normal())
        topm = n.smooth(nz, 0.6, 0.85)
        edge = n.mul(n.band(y, -32.5, -30.5, 0.1), topm)
        col = n.vlerp(col, srgb("#c9a227"), n.mul(edge, 0.85))
        tidal = n.mul(n.smooth(z, wl + 4, wl - 1), n.sub(1.0, topm))
        col = n.vlerp(col, srgb("#3a3d33"), n.mul(tidal, 0.7))
        return col, None, None

    deck = a.zone("deck", Z.concrete("#8f8d87", joints=10.0, streak=0.35, pattern_extra=None) if False else
                  standard("#8f8d87", 0.88, 0.0, pattern=quay_top, streak=0.3, grime=0.3, bump=0.4, bump_scale=3, base_dirt=0.0))
    piles = a.zone("piles", Z.concrete("#77746d", joints=40.0, streak=0.45, dirt=0.0))
    fender = a.zone("fender", Z.rubber())
    iron = a.zone("iron", Z.painted_metal("#2f3336", rough=0.5, metal=0.6, rust=0.5, panels=None))
    L, D = 240.0, 70.0
    a.box("Deck", (L, D, 5), (0, 0, 49.5), deck, bevel=0.4)
    a.box("Front beam", (L, 3, 8), (0, -D / 2 + 1.5, 46), deck)
    for r, y in enumerate((-30, -5, 22)):
        a.box(f"Pile cap {r}", (L, 4, 4), (0, y, 45), piles)
        for k in range(8):
            x = -L / 2 + 15 + k * 30
            a.cyl(f"Pile {r} {k}", 1.8, 45, (x, y, 22.5), piles, segs=8)
    for k in range(7):
        x = -L / 2 + 20 + k * 33.3
        a.box(f"Fender {k}", (6, 2.2, 12), (x, -D / 2 - 1.2, 42), fender, bevel=0.4)
    for k in range(5):
        x = -L / 2 + 24 + k * 48
        a.cyl(f"Bollard {k}", 1.3, 3.2, (x, -D / 2 + 4, 53.6), iron, segs=10, r2=1.0)
        a.cyl(f"Bollard cap {k}", 1.8, 0.8, (x, -D / 2 + 4, 55.4), iron, segs=10)
    for k, x in enumerate((-60, 70)):
        for sx in (-1.3, 1.3):
            a.box(f"Ladder rail {k} {sx}", (0.35, 0.35, 16), (x + sx, -D / 2 - 0.4, 43), iron)
        for r in range(5):
            a.box(f"Ladder rung {k} {r}", (2.6, 0.3, 0.3), (x, -D / 2 - 0.4, 37 + r * 3), iron)
    a.box("Kerb", (L, 1.2, 1.2), (0, -D / 2 + 0.8, 52.6), deck)
    a.finish(ground_offset=wl)


def container_paint(color):
    def pattern(n, col):
        x, y, z = n.xyz(n.pos())
        nx, ny, nz = n.xyz(n.normal())
        side = n.smooth(n.absf(nx), 0.6, 0.85)
        endm = n.smooth(n.absf(ny), 0.6, 0.85)
        rib = n.math("SINE", n.mul(y, 6.2832 / 1.05))
        vrib = n.math("SINE", n.mul(x, 6.2832 / 1.4))
        tier = n.math("FRACT", n.math("DIVIDE", z, 9.25))
        rail = n.maxf(n.smooth(tier, 0.06, 0.03), n.smooth(tier, 0.94, 0.97))
        h = n.add(0.5, n.mul(n.add(n.mul(rib, side), n.mul(vrib, endm)), n.mul(n.sub(1.0, rail), 0.45)))
        bars = n.mul(endm, n.maxf(n.lines(x, 2.2, 0.12), n.band(n.math("FRACT", n.math("DIVIDE", x, 8.9)), 0.48, 0.52, 0.01)))
        col = n.vscale(col, n.sub(1.0, n.mul(rail, 0.25)))
        col = n.vscale(col, n.sub(1.0, n.mul(bars, 0.3)))
        return col, None, n.add(h, n.mul(bars, 0.3))

    return standard(color, 0.62, 0.35, pattern=pattern, rust=0.45, streak=0.35, grime=0.15, ao=0.45)


@builder
def container_stack():
    a = Asset("container-stack", "Shipping container stack", texture=SMALL_TEXTURE, tri_limit=2500, bump_distance=0.08, seed=24,
              usage="Port yard stacks beside quays and cranes (replaces Scenery.Containers boxes).")
    colors = ["#8c3a2b", "#2f5b7c", "#3f6b45", "#b9b6ab", "#c46a28", "#5b6064"]
    zones = [a.zone(f"c{i}", container_paint(c)) for i, c in enumerate(colors)]
    W, Lc, H = 8.7, 43.6, 9.25
    heights = [[3, 2], [2, 3], [3, 1], [1, 2]]
    k = 0
    for col, stack in enumerate(heights):
        for row, count in enumerate(stack):
            for tier in range(count):
                zone = zones[(col * 3 + row * 5 + tier * 2) % len(zones)]
                x = (col - 1.5) * (W + 0.4)
                y = (row - 0.5) * (Lc + 1.2)
                a.box(f"Container {k}", (W, Lc, H), (x, y, H / 2 + tier * H), zone, bevel=0.15)
                k += 1
    a.finish(ground_offset=0.0)


@builder
def gantry_crane():
    a = Asset("gantry-crane", "Ship-to-shore gantry crane", texture=512, tri_limit=2500, bump_distance=0.12, seed=25,
              usage="Harbour skyline: line quays in M19-M27 (replaces Scenery.Crane); WorldAssets.Place(\"GantryCrane\", ...).")
    paint = a.zone("paint", Z.painted_metal("#b8452d", rough=0.55, metal=0.3, rust=0.35, panels=None))
    white = a.zone("white", Z.windows("#d4d4ce", "#22303a", bay=4.0, win=2.6, floor=12.0, win_h=3.0, z0=1e5, frame="#d4d4ce"))
    cab = a.zone("cab", Z.glass("#22303a", rough=0.15, metal=0.4))
    dark = a.zone("dark", Z.painted_metal("#2c2f31", rough=0.6, metal=0.5, rust=0.3, panels=None))
    gx, gy, top = 26.0, 18.0, 100.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            a.beam(f"Leg {sx}{sy}", (sx * gx, sy * gy, 4), (sx * gx, sy * gy, top), 4.0, paint)
            a.box(f"Bogie {sx}{sy}", (6, 12, 4), (sx * gx, sy * gy, 2), dark)
        a.beam(f"Sill {sx}", (sx * gx, -gy, 30), (sx * gx, gy, 30), 3.0, paint)
        a.beam(f"Leg brace {sx}", (sx * gx, -gy, 30), (sx * gx, gy, top - 4), 2.0, paint)
    for sy in (-1, 1):
        a.beam(f"Portal {sy}", (-gx, sy * gy, top), (gx, sy * gy, top), 4.5, paint)
        a.beam(f"Low tie {sy}", (-gx, sy * gy, 30), (gx, sy * gy, 30), 2.4, paint)
    # Boom girders reach out over the water (-Y) and back over the yard.
    for sx in (-1, 1):
        a.box(f"Boom {sx}", (3.5, 200, 6), (sx * 8, -40, top + 5), paint)
        a.beam(f"Forestay {sx}", (sx * 6, 0, top + 58), (sx * 8, -138, top + 8), 1.2, paint)
        a.beam(f"Backstay {sx}", (sx * 6, 0, top + 58), (sx * 8, 58, top + 8), 1.2, paint)
        a.beam(f"A-frame front {sx}", (sx * gx, -gy, top), (sx * 6, 0, top + 58), 3.0, paint)
        a.beam(f"A-frame back {sx}", (sx * gx, gy, top), (sx * 6, 0, top + 58), 3.0, paint)
    a.box("Apex", (14, 4, 4), (0, 0, top + 58), paint)
    for k in range(9):
        y = -130 + k * 22
        a.box(f"Boom tie {k}", (16, 1.6, 1.6), (0, y, top + 2.6), paint)
    a.box("Machinery house", (22, 26, 12), (0, 40, top + 14), white, bevel=0.4)
    a.box("Trolley", (18, 10, 4), (0, -70, top + 1), dark)
    a.box("Operator cab", (8, 9, 7), (0, -70, top - 5), cab, bevel=0.3)
    a.box("Spreader", (8, 40, 2), (0, -70, top - 40), dark)
    for sx in (-1, 1):
        a.beam(f"Hoist {sx}", (sx * 3, -70, top - 1), (sx * 3, -70, top - 39), 0.35, dark)
    a.finish(ground_offset=0.0)


# --------------------------------------------------------------------------
# Airfield


def arch_band(a: Asset, name, zone, w, h, y0, y1, thick, segs=18):
    """A thick elliptical arch (front face, outer and inner surfaces) between y0 and y1."""
    verts, faces = [], []
    for y in (y0, y1):
        for i in range(segs + 1):
            t = math.pi * i / segs
            verts.append(((w + thick) * math.cos(t), y, (h + thick) * math.sin(t)))
            verts.append((w * math.cos(t), y, h * math.sin(t)))
    row = (segs + 1) * 2
    for i in range(segs):
        o0, i0, o1, i1 = 2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3
        faces.append((o0, o1, i1, i0))  # front
        faces.append((row + o0, row + i0, row + i1, row + o1))  # back
        faces.append((o0, row + o0, row + o1, o1))  # outer
        faces.append((i0, i1, row + i1, row + i0))  # inner
    obj = a.mesh(name, verts, faces, zone, smooth=40)
    return obj


@builder
def hangar():
    a = Asset("hangar", "Hardened aircraft shelter", texture=512, tri_limit=2500, bump_distance=0.12, seed=31,
              usage="Airbase dressing at Varda (M1, M3, M4, M8): fits one Kestrel; WorldAssets.Place(\"Hangar\", ...).")
    conc = a.zone("concrete", Z.concrete("#a29f97", joints=8.0, streak=0.45, dirt=0.45))
    door = a.zone("door", Z.corrugated("#5d6559", period=2.4, axis="u", rough=0.6, metal=0.5, rust=0.3, depth=0.6))
    dark = a.zone("dark", Z.painted_metal("#2b2e30", rough=0.7, metal=0.4, rust=0.3, panels=None))
    w, h, d = 55.0, 36.0, 62.5
    segs = 18
    rings = []
    for y in (-d, d):
        ring = [(w * math.cos(math.pi * i / segs), y, h * math.sin(math.pi * i / segs)) for i in range(segs + 1)]
        rings.append(ring)
    a.loft("Shell", rings, conc, smooth=40)
    arch_band(a, "Headwall", conc, w - 0.5, h - 0.5, -d - 4, -d + 2, 4.0)
    for k, y in enumerate((-30.0, 0.0, 30.0)):
        arch_band(a, f"Rib {k}", conc, w, h, y - 1.2, y + 1.2, 1.4)
    arch_band(a, "Rear rib", conc, w, h, d - 2, d + 1.0, 2.0)
    for sx in (-1, 1):
        a.box(f"Buttress {sx}", (10, 14, 14), (sx * (w + 4), -d + 2, 7), conc, bevel=0.6)
        a.box(f"Door leaf {sx}", (40, 2, 27), (sx * 21.5, -d - 1.6, 13.5), door, bevel=0.2)
        a.box(f"Door rail {sx}", (48, 3, 1.2), (sx * 24, -d - 2.8, 0.6), dark)
    a.box("Door head", (84, 2.4, 2.2), (0, -d - 1.8, 28), dark)
    a.box("Exhaust vent", (22, 6, 10), (0, d + 3, 22), conc, bevel=0.5)
    a.box("Vent louvre", (18, 1, 6), (0, d + 6.1, 22), dark)
    a.finish(ground_offset=0.0)


@builder
def control_tower():
    a = Asset("control-tower", "Airfield control tower", texture=512, tri_limit=2500, bump_distance=0.1, seed=32,
              usage="Varda airbase tower (M1, M3, M4, M8), offset from the runway; replaces Scenery.ControlTower.")
    block = a.zone("block", Z.windows("#bdb8ad", "#24313a", bay=7.0, win=4.6, floor=12.0, win_h=5.0, z0=2, z1=24,
                                        roof_color="#5c5f61"))
    shaft = a.zone("shaft", Z.concrete("#b4b0a6", joints=6.0, streak=0.4, dirt=0.3))
    glass = a.zone("glass", Z.glass("#2a3c46", rough=0.06, metal=0.55))
    metal = a.zone("metal", Z.painted_metal("#3a3e42", rough=0.5, metal=0.6, rust=0.15, panels=None))
    beacon = a.zone("beacon", standard("#c8452d", 0.5, 0.1, grime=0.05))
    a.box("Operations block", (64, 40, 24), (0, 6, 12), block, bevel=0.4)
    a.box("Block parapet", (65, 41, 1.5), (0, 6, 24.75), shaft)
    a.box("Shaft", (16, 16, 66), (0, 0, 57), shaft, bevel=0.5)
    a.box("Stair core", (8, 8, 60), (0, 11, 54), shaft)
    a.cyl("Cab floor", 18.5, 4, (0, 0, 88), shaft, segs=8, smooth=None)
    a.cyl("Catwalk", 21, 0.6, (0, 0, 86.3), metal, segs=8, smooth=None)
    a.loft("Cab glass", [octagon(15.5, 90), octagon(18.2, 101)], glass, smooth=None)
    for i, (x0, y0, z0) in enumerate(octagon(15.5, 90)):
        x1, y1, z1 = octagon(18.2, 101)[i]
        a.beam(f"Mullion {i}", (x0, y0, z0), (x1, y1, z1), 0.6, metal)
    a.cyl("Cab roof", 21, 2.5, (0, 0, 102.6), metal, segs=8, smooth=None)
    a.box("Roof plant", (8, 6, 3), (0, 3, 105.3), metal)
    a.cyl("Antenna", 0.35, 22, (6, -6, 114), metal, segs=4, smooth=None)
    a.cyl("Antenna 2", 0.35, 16, (-7, -4, 111), metal, segs=4, smooth=None)
    a.cyl("Radar mast", 0.6, 8, (-4, 6, 107.5), metal, segs=6, smooth=None)
    a.box("Radar bar", (9, 1.2, 1.5), (-4, 6, 112.2), metal)
    a.sphere("Beacon", 1.1, (6, -6, 125.5), beacon, subdiv=2)
    a.finish(ground_offset=0.0)


# --------------------------------------------------------------------------
# City


def chamfer_ring(w, d, c, z):
    hw, hd = w / 2, d / 2
    return [(-hw + c, -hd, z), (hw - c, -hd, z), (hw, -hd + c, z), (hw, hd - c, z), (hw - c, hd, z), (-hw + c, hd, z),
            (-hw, hd - c, z), (-hw, -hd + c, z)]


@builder
def office_midrise():
    a = Asset("office-midrise", "Mid-rise office building", texture=512, tri_limit=2500, bump_distance=0.1, seed=41,
              usage="City and harbour districts (M21, M22, M26, M27): replaces Scenery.Buildings boxes.")
    upper = a.zone("upper", Z.windows("#b9b4a8", "#28343c", bay=5.0, win=4.0, floor=13.0, win_h=7.0, z0=16, z1=118,
                                        frame="#5a5f63", roof_color="#626568", lit=0.25))
    lobby = a.zone("lobby", Z.windows("#3b4045", "#2c3a42", bay=8.0, win=7.2, floor=16.0, win_h=12.0, z0=0, z1=16,
                                        curtain=False, frame="#3b4045", rough=0.4))
    conc = a.zone("concrete", Z.concrete("#a8a398", joints=6.0, streak=0.35, dirt=0.2))
    metal = a.zone("metal", Z.painted_metal("#7d8285", rough=0.5, metal=0.6, rust=0.15, panels=4.0))
    W, D, H = 110.0, 70.0, 120.0
    a.box("Lobby", (W - 6, D - 6, 16), (0, 0, 8), lobby)
    a.box("Upper floors", (W, D, H - 16), (0, 0, 16 + (H - 16) / 2), upper)
    for i in range(6):
        x = -W / 2 + 10 + i * 18
        for sy in (-1, 1):
            a.box(f"Fin {i} {sy}", (1.2, 2.4, H - 16), (x, sy * (D / 2 + 1.2), 16 + (H - 16) / 2), conc)
    for sx in (-1, 1):
        for j in range(3):
            a.box(f"Side fin {sx} {j}", (2.4, 1.2, H - 16), (sx * (W / 2 + 1.2), -D / 2 + 15 + j * 20, 16 + (H - 16) / 2), conc)
    for k, (sz, loc) in enumerate((((W + 1, 1.6, 3.5), (0, -D / 2, H + 1.75)), ((W + 1, 1.6, 3.5), (0, D / 2, H + 1.75)),
                                   ((1.6, D + 1, 3.5), (-W / 2, 0, H + 1.75)), ((1.6, D + 1, 3.5), (W / 2, 0, H + 1.75)))):
        a.box(f"Parapet {k}", sz, loc, conc)
    a.box("Penthouse", (34, 22, 12), (-15, 6, H + 6), conc, bevel=0.3)
    for i in range(5):
        a.box(f"HVAC {i}", (7, 9, 4), (14 + (i % 3) * 10, -14 + (i // 3) * 14, H + 2), metal)
    a.cyl("Water tank", 4.5, 8, (-38, -18, H + 4), metal, segs=12)
    a.box("Canopy", (30, 9, 1.2), (0, -D / 2 - 3.5, 15.5), metal)
    a.finish(ground_offset=0.0)


@builder
def apartment_block():
    a = Asset("apartment-block", "Apartment block", texture=512, tri_limit=2500, bump_distance=0.1, seed=42,
              usage="Residential city edges and harbour town (M19-M27): replaces Scenery.Buildings boxes.")
    body = a.zone("body", Z.windows("#d2c7b2", "#2c353b", bay=9.0, win=4.6, floor=10.7, win_h=5.5, z0=12, z1=119,
                                      frame="#e8e4da", roof_color="#5d5f5f", lit=0.3))
    shops = a.zone("shops", Z.windows("#6b5f55", "#2d3a40", bay=12.0, win=10.0, floor=12.0, win_h=8.5, z0=0, z1=12,
                                       frame="#3a3530", rough=0.4))
    slab = a.zone("slab", Z.concrete("#bdb6a8", joints=14.0, streak=0.4, dirt=0.0))
    rail = a.zone("rail", Z.painted_metal("#4f5658", rough=0.4, metal=0.5, rust=0.2, panels=1.4))
    W, D = 180.0, 50.0
    a.box("Shopfront", (W - 4, D - 4, 12), (0, 0, 6), shops)
    a.box("Body", (W, D, 107), (0, 0, 12 + 53.5), body)
    for f in range(1, 10):
        z = 12 + f * 10.7
        for b in range(6):
            x = -W / 2 + 15 + b * 30
            a.box(f"Balcony {f} {b}", (16, 5, 0.9), (x, -D / 2 - 2.5, z), slab)
            a.box(f"Balustrade {f} {b}", (16, 0.4, 3.4), (x, -D / 2 - 4.8, z + 2.1), rail)
    a.box("Roof edge", (W + 1, D + 1, 1.6), (0, 0, 119.8), slab)
    for sx in (-1, 1):
        a.box(f"Stair core {sx}", (12, 10, 9), (sx * 45, 6, 124.5), slab)
    a.box("Shop awning", (W - 20, 4, 0.8), (0, -D / 2 - 2, 11), rail)
    a.finish(ground_offset=0.0)


@builder
def city_tower():
    a = Asset("city-tower", "City office tower", texture=512, tri_limit=2500, bump_distance=0.1, seed=43,
              usage="Coastal city skyline and Air Marshal's capital (M21, M26, M27): landmark high-rise.")
    curtain = a.zone("curtain", Z.windows("#3f4f58", "#2b3f4d", bay=5.0, floor=13.0, win_h=10.5, z0=24, z1=362,
                                            curtain=True, mullion=0.22, frame="#8b9399", rough=0.25, roof_color="#55595c",
                                            lit=0.2, streak=0.1, base_dirt=0.0))
    stone = a.zone("stone", Z.windows("#a59e91", "#26323a", bay=10.0, win=8.5, floor=24.0, win_h=18.0, z0=0, z1=24,
                                        frame="#3e4246", rough=0.6))
    metal = a.zone("metal", Z.painted_metal("#7f878c", rough=0.35, metal=0.7, rust=0.05, panels=None))
    beacon = a.zone("beacon", standard("#c8452d", 0.5, 0.1, grime=0.05))
    a.loft("Podium", [chamfer_ring(130, 130, 18, 0), chamfer_ring(130, 130, 18, 24)], stone, smooth=None)
    tiers = [(100, 14, 24, 228), (82, 12, 228, 312), (62, 9, 312, 362)]
    for i, (w, c, z0, z1) in enumerate(tiers):
        a.loft(f"Shaft {i}", [chamfer_ring(w, w, c, z0), chamfer_ring(w, w, c, z1)], curtain, smooth=None)
        a.loft(f"Ledge {i}", [chamfer_ring(w + 2.5, w + 2.5, c + 1, z1), chamfer_ring(w + 2.5, w + 2.5, c + 1, z1 + 2.2)], metal, smooth=None)
    for i, (x, y) in enumerate(((-26, 0), (26, 0), (0, -26), (0, 26))):
        a.box(f"Crown fin {i}", (2 if x else 26, 26 if x else 2, 26), (x, y, 377), metal)
    a.box("Plant", (30, 30, 10), (0, 0, 369), metal)
    a.cyl("Spire", 1.6, 60, (0, 0, 404), metal, segs=8, r2=0.4)
    a.sphere("Beacon", 1.3, (0, 0, 434.5), beacon, subdiv=2)
    a.box("Entrance canopy", (40, 10, 1.4), (0, -70, 20), metal)
    a.finish(ground_offset=0.0)


# --------------------------------------------------------------------------
# Farm


@builder
def farmhouse():
    a = Asset("farmhouse", "Farmhouse", texture=SMALL_TEXTURE, tri_limit=2500, bump_distance=0.06, seed=51,
              usage="Teklan farm valleys (M5, M6, M13, M16): homesteads near silos and fields.")
    walls = a.zone("walls", Z.windows("#e3ded2", "#28323a", bay=11.0, win=4.0, floor=11.0, win_h=6.5, z0=2.5, z1=22,
                                        frame="#f2efe8", roof_color="#4a4b4e", siding=0.7, rough=0.75, base_dirt=0.45,
                                        base_dirt_height=4.0, lit=0.15))
    roof = a.zone("roof", Z.roof_tiles("#47494d"))
    stone = a.zone("stone", Z.concrete("#8a8378", joints=1.6, streak=0.2, dirt=0.4, joint_depth=0.45))
    wood = a.zone("wood", Z.boards("#7b6550", width=0.9, axis="z", rough=0.8))
    door = a.zone("door", Z.boards("#3e4a3c", width=0.7, axis="u", rough=0.7))
    W, D, H = 44.0, 30.0, 22.0
    a.box("Foundation", (W + 1, D + 1, 2.5), (0, 0, 1.25), stone)
    a.box("Walls", (W, D, H - 2.5), (0, 0, 2.5 + (H - 2.5) / 2), walls)
    a.prism("Gables", [(-D / 2, H), (D / 2, H), (0, H + 12)], -W / 2, W / 2, walls, axis="x")
    pitch = math.atan2(12, D / 2)
    slope = math.hypot(12, D / 2)
    for sy in (-1, 1):
        a.box(f"Roof {sy}", (W + 3, slope + 2.4, 1.0), (0, sy * (D / 4 + 0.3), H + 6 + 0.55), roof,
              rot=(sy * -pitch, 0, 0))
    a.box("Ridge", (W + 3, 1.4, 1.0), (0, 0, H + 12.4), roof)
    a.box("Chimney", (3.4, 3.4, 18), (13, 5, H + 6), stone)
    a.box("Porch deck", (30, 9, 1.4), (0, -D / 2 - 4.5, 2.2), wood)
    for i in range(4):
        a.box(f"Porch post {i}", (0.8, 0.8, 9.5), (-13.5 + i * 9, -D / 2 - 8.4, 7.6), wood)
    a.box("Porch roof", (32, 10, 0.8), (0, -D / 2 - 4.8, 12.6), roof, rot=(math.radians(10), 0, 0))
    a.box("Front door", (4, 0.5, 8), (0, -D / 2 - 0.2, 6.9), door)
    a.box("Steps", (8, 3, 1.4), (0, -D / 2 - 10.4, 0.7), stone)
    a.box("Back wing", (18, 12, 12), (-9, D / 2 + 6, 6), walls)
    a.box("Back wing roof", (19.5, 13.5, 0.8), (-9, D / 2 + 6.5, 12.8), roof, rot=(math.radians(-12), 0, 0))
    a.finish(ground_offset=0.0)


@builder
def barn():
    a = Asset("barn", "Gambrel barn", texture=SMALL_TEXTURE, tri_limit=2500, bump_distance=0.07, seed=52,
              usage="Teklan farm valleys (M5, M6, M13, M16) beside the farmhouse and grain silos.")
    walls = a.zone("walls", Z.boards("#8a3b2c", width=1.1, axis="u", rough=0.85, base_dirt=0.5))
    # Plain vertical plank doors a shade darker than the walls: no braces, frames or
    # contrasting trim, so nothing on the gable ends forms a cross or other shape.
    door = a.zone("door", Z.boards("#6f3226", width=1.5, axis="u", rough=0.85, base_dirt=0.5))
    track = a.zone("track", Z.painted_metal("#4b4e50", rough=0.6, metal=0.5, rust=0.4, panels=None))
    roof = a.zone("roof", Z.corrugated("#6f7376", period=2.2, axis="y", rough=0.55, metal=0.5, rust=0.45, depth=0.4))
    stone = a.zone("stone", Z.concrete("#85807a", joints=1.4, dirt=0.4, joint_depth=0.45))
    W, L = 44.0, 72.0
    profile = [(-22, 0), (22, 0), (22, 22), (15, 33), (0, 40), (-15, 33), (-22, 22)]
    a.box("Plinth", (W + 1, L + 1, 2), (0, 0, 1), stone)
    a.prism("Body", profile, -L / 2, L / 2, walls, axis="y")
    # Roof shell: four planes along the gambrel with a slight overhang.
    planes = [((-23.5, 21.2), (-15.6, 33.9)), ((-15.6, 33.9), (0, 41.3)), ((0, 41.3), (15.6, 33.9)), ((15.6, 33.9), (23.5, 21.2))]
    for i, ((x0, z0), (x1, z1)) in enumerate(planes):
        length = math.hypot(x1 - x0, z1 - z0)
        ang = math.atan2(z1 - z0, x1 - x0)
        a.box(f"Roof {i}", (length + 0.6, L + 4, 0.9), ((x0 + x1) / 2, 0, (z0 + z1) / 2 + 0.3), roof, rot=(0, -ang, 0))
    for sy in (-1, 1):
        y = sy * (L / 2 + 0.4)
        a.box(f"Door {sy}", (18, 0.6, 18), (0, y, 9.5), door)
        # Sliding-door track: one dark horizontal rail above the doorway.
        a.box(f"Door track {sy}", (24, 0.8, 0.8), (0, y + sy * 0.4, 19.1), track)
        a.box(f"Loft door {sy}", (8, 0.6, 7), (0, y, 29), door)
    a.box("Cupola", (5, 5, 5), (0, 0, 43.5), walls)
    a.prism("Cupola roof", [(-3.6, 46), (3.6, 46), (0, 49)], -3.6, 3.6, roof, axis="y")
    a.box("Lean-to", (14, 40, 14), (W / 2 + 7, 6, 7), walls)
    a.box("Lean-to roof", (16, 42, 0.8), (W / 2 + 7.6, 6, 14.6), roof, rot=(0, math.radians(-14), 0))
    a.finish(ground_offset=0.0, extra_notes={
        "noText": "No letters, numbers or symbols: gable doors are plain vertical planks a shade darker than the walls, with one dark track rail above; no X braces, frames or contrasting trim.",
    })


@builder
def grain_silo():
    a = Asset("grain-silo", "Grain silo pair", texture=SMALL_TEXTURE, tri_limit=2500, bump_distance=0.08, seed=53,
              usage="Farm cooperative dressing (M5, M6, M13); scenery companion to the GrainSilo mission target.")
    tin = a.zone("tin", Z.corrugated("#b4b6b3", period=1.6, axis="z", rough=0.45, metal=0.65, rust=0.35, depth=0.5))
    roof = a.zone("roof", Z.painted_metal("#9a9d9b", rough=0.45, metal=0.6, rust=0.3, panels=None))
    conc = a.zone("concrete", Z.concrete("#9d9a92", joints=12.0, dirt=0.4))
    steel = a.zone("steel", Z.painted_metal("#5b5f5d", rough=0.55, metal=0.5, rust=0.4, panels=None))
    for i, (x, r, h) in enumerate(((-12, 18, 60), (26, 12, 44))):
        a.cyl(f"Pad {i}", r + 2, 2, (x, 0, 1), conc, segs=20)
        a.cyl(f"Bin {i}", r, h, (x, 0, 2 + h / 2), tin, segs=28, smooth=50)
        a.cyl(f"Roof {i}", r + 0.8, r * 0.55, (x, 0, 2 + h + r * 0.275), roof, segs=28, r2=2.2, smooth=50)
        a.cyl(f"Vent {i}", 2.4, 2.4, (x, 0, 2 + h + r * 0.55 + 1.2), roof, segs=10)
        for k in range(14):
            a.box(f"Ladder rung {i} {k}", (2.4, 0.3, 0.3), (x, -r - 0.9, 6 + k * (h - 6) / 14), steel)
        for sx in (-1, 1):
            a.box(f"Ladder rail {i} {sx}", (0.3, 0.3, h - 2), (x + sx * 1.2, -r - 0.9, 2 + h / 2), steel)
    # Bucket elevator leg with spouts into each bin.
    a.box("Leg", (4, 4, 86), (7, -6, 43), steel)
    a.box("Head house", (7, 7, 6), (7, -6, 89), roof)
    a.beam("Spout 0", (6, -6, 86), (-12, 0, 74), 1.2, steel, segs=6)
    a.beam("Spout 1", (8, -6, 86), (26, 0, 56), 1.2, steel, segs=6)
    a.box("Pit house", (12, 10, 8), (7, -20, 4), tin)
    a.finish(ground_offset=0.0)


# --------------------------------------------------------------------------
# Relay network


@builder
def radar_dish():
    a = Asset("radar-dish", "Ground radar dish", texture=SMALL_TEXTURE, tri_limit=2500, bump_distance=0.08, seed=61,
              usage="Relay and air-defence sites (M3, M10, M11, M14): scenery companion to the Radar target.")
    dish = a.zone("dish", Z.painted_metal("#d9dad5", rough=0.45, metal=0.15, rust=0.12, streak=0.35, panels=None))
    steel = a.zone("steel", Z.painted_metal("#7c8285", rough=0.5, metal=0.6, rust=0.3, panels=None))
    conc = a.zone("concrete", Z.concrete("#9b988f", joints=10.0, dirt=0.4))
    shelter = a.zone("shelter", Z.painted_metal("#c9c5b7", rough=0.6, metal=0.3, rust=0.2, panels=4.0))
    # No paired features anywhere (they read as eyes): the dish is fed by one central
    # cone in the dish's own colour (no strut quadripod and its curved shadows), it sits
    # on a single elevation housing hidden behind it (no twin yoke arms), and the
    # equipment shelter is windowless with one door on its side.
    R, f = 21.0, 15.0
    pivot = Vector((0, 0, 34))
    rot = Matrix_rotation_x(math.radians(50))

    def place(p):
        return tuple(pivot + rot @ Vector(p))

    segs, nr = 24, 7
    rings = []
    for i in range(nr + 1):
        r = R * i / nr
        rings.append([place((r * math.cos(t), r * math.sin(t), r * r / (4 * f))) for t in (k * math.tau / segs for k in range(segs))])
    back = []
    for i in range(nr, -1, -1):
        r = R * i / nr * (1.0 if i == nr else 0.96)
        back.append([place((r * math.cos(t), r * math.sin(t), r * r / (4 * f) - 1.2 - (0 if i == nr else 1.5))) for t in (k * math.tau / segs for k in range(segs))])
    a.loft("Dish", rings + back, dish, smooth=60)
    # A short, wide Cassegrain-style feed cone: its silhouette and shadow are a soft
    # wedge, not a thin line that could read as a clock hand or a letter.
    a.cyl("Feed cone", 3.0, 6.5, place((0, 0, 3.0)), dish, segs=14, r2=1.3, rot=(math.radians(50), 0, 0), smooth=50)
    a.beam("Back hub", place((0, 0, -2.0)), place((0, 0, -8.5)), 3.6, steel, segs=12)
    a.box("Plinth", (34, 34, 4), (0, 0, 2), conc, bevel=0.4)
    a.cyl("Pedestal", 4.2, 18, (0, 0, 13), steel, segs=14)
    a.cyl("Turntable", 7.0, 3, (0, 2, 23.5), steel, segs=16)
    a.box("Elevation housing", (11, 9, 8), (0, 7, 29), steel, bevel=0.4)
    a.box("Equipment shelter", (20, 12, 10), (28, 16, 5), shelter, bevel=0.3)
    a.box("Shelter door", (0.4, 4.5, 7.5), (38.2, 14, 4.25), steel)
    a.finish(ground_offset=0.0, extra_notes={
        "noFaces": "Nothing in pairs that could read as eyes: one short central feed cone in the dish colour (no strut quadripod, boom or strut shadows), one elevation housing hidden behind the dish (no twin yoke arms), and a windowless shelter with one side door; checked front, side, top and 3/4.",
    })


def Matrix_rotation_x(angle):
    from mathutils import Matrix
    return Matrix.Rotation(angle, 3, "X")


@builder
def relay_mast():
    a = Asset("relay-mast", "Comms relay mast", texture=SMALL_TEXTURE, tri_limit=2500, bump_distance=0.08, seed=62,
              usage="Generic communications station scenery.")
    paint = a.zone("paint", Z.stripes("#c24a2f", "#dcdad2", period=20.0))
    steel = a.zone("steel", Z.painted_metal("#8a8f92", rough=0.45, metal=0.6, rust=0.25, panels=None))
    drum = a.zone("drum", standard("#d8d7d0", 0.5, 0.1, grime=0.15, streak=0.3))
    shelter = a.zone("shelter", Z.painted_metal("#b8bcb3", rough=0.6, metal=0.3, rust=0.2, panels=3.0))
    conc = a.zone("concrete", Z.concrete("#9b988f", joints=8.0, dirt=0.4))
    H, r0, r1 = 140.0, 7.0, 2.6
    angles = [math.radians(90 + 120 * k) for k in range(3)]

    def leg(k, z):
        r = r0 + (r1 - r0) * z / H
        return (r * math.cos(angles[k]), r * math.sin(angles[k]), z)

    for k in range(3):
        a.beam(f"Leg {k}", leg(k, 0), leg(k, H), 1.0, paint)
    levels = [H * i / 14 for i in range(15)]
    for li, z in enumerate(levels):
        for k in range(3):
            a.beam(f"Girt {li} {k}", leg(k, z), leg((k + 1) % 3, z), 0.45, paint)
            if li + 1 < len(levels):
                a.beam(f"Diag {li} {k}", leg(k, z), leg((k + 1) % 3, levels[li + 1]), 0.35, paint)
    for i, (z, ang) in enumerate(((96, 0.3), (104, 2.4), (112, 4.5), (78, 1.2))):
        r = r0 + (r1 - r0) * z / H + 2.2
        a.cyl(f"Microwave drum {i}", 3.0, 1.6, (r * math.cos(ang), r * math.sin(ang), z), drum, segs=16,
              rot=(math.radians(90), 0, ang + math.pi / 2))
    for k in range(3):
        p = leg(k, 132)
        a.box(f"Panel antenna {k}", (1.2, 1.2, 8), (p[0] * 1.4, p[1] * 1.4, 132), drum)
    a.cyl("Lightning rod", 0.3, 12, (0, 0, H + 6), steel, segs=4, smooth=None)
    a.box("Pad", (16, 16, 1.5), (0, 0, 0.75), conc)
    a.box("Shelter", (20, 12, 10), (22, -6, 5), shelter, bevel=0.3)
    a.beam("Cable bridge", (12, -4, 8), (3, -1, 12), 1.0, steel)
    a.finish(ground_offset=0.0)
