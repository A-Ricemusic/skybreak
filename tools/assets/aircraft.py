"""Kestrel (player) and Vanta (enemy) fighters for Roblox upload.

Both are original designs at the existing in-game size (Kestrel 26 x 22.8
studs, Vanta 26.4 x 24.4). Control surfaces are separate delivery meshes whose
object origin sits on the hinge line, so the game can rotate them:

    Aileron_L/R   roll  (Vanta: delta elevons)
    Elevator_L/R  pitch (Kestrel: all-moving stabilators; Vanta: canards)
    Rudder_L/R    yaw   (Kestrel twin fins)  /  Rudder (Vanta single fin)

Hinge end points, wingtip and exhaust attachments are written to the
checklist in Roblox model space (bounds-centred, +Y up, -Z forward).
"""

from __future__ import annotations

import math

from mathutils import Vector

from skyasset import Asset, Nodes, srgb, standard

BUILDERS: dict = {}


def builder(name):
    def wrap(fn):
        BUILDERS[name] = fn
        return fn
    return wrap


# --------------------------------------------------------------------------
# Geometry helpers


def section(w, zt, zb, zc, pt=2.0, pb=2.0, n=32):
    """Superellipse cross-section (x, z). Exponent < 2 gives a chine at the sides."""
    pts = []
    for i in range(n):
        a = (i + 0.5) / n * math.tau
        c, s = math.cos(a), math.sin(a)
        p = pt if s >= 0 else pb
        h = zt if s >= 0 else zb
        x = w * math.copysign(abs(c) ** (2 / p), c)
        z = zc + h * math.copysign(abs(s) ** (2 / p), s)
        pts.append((x, z))
    return pts


def interp_stations(stations, y):
    """Linear interpolation of station tuples (y, w, zt, zb, zc, pt, pb)."""
    for a, b in zip(stations, stations[1:]):
        if a[0] <= y <= b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            return tuple(av + (bv - av) * t for av, bv in zip(a, b))
    return stations[0] if y < stations[0][0] else stations[-1]


def fuselage(a: Asset, name, zone, stations, n=40, part="Body"):
    rings = []
    for y, w, zt, zb, zc, pt, pb in stations:
        rings.append([(x, y, z) for x, z in section(w, zt, zb, zc, pt, pb, n)])
    return a.loft(name, rings, zone, part=part, smooth=42)


def naca(c, tc):
    return 5 * tc * (0.2969 * math.sqrt(max(c, 0)) - 0.1260 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1036 * c ** 4)


def surface(a: Asset, name, zone, part, frame, spans, le, chord, tc, c0=0.0, c1=1.0, samples=8, min_thick=0.03):
    """Loft a lifting-surface panel.

    frame(span, chord_pos, thick) -> world point; le(span)/chord(span) give the
    leading edge position and chord length along the local chord axis; tc is
    the thickness ratio (number or function of span). The panel covers chord
    fractions c0..c1 between the given span stations.
    """
    rings = []
    cs = [c0 + (c1 - c0) * (1 - math.cos(math.pi * i / samples)) / 2 for i in range(samples + 1)]
    for s in spans:
        ch = chord(s)
        ratio = tc(s) if callable(tc) else tc
        top = [(c, max(naca(c, ratio) * ch, min_thick / 2 if c < 0.999 else 0.004)) for c in cs]
        ring = [frame(s, le(s) + c * ch, t) for c, t in top]
        ring += [frame(s, le(s) + c * ch, -t) for c, t in reversed(top[1:-1])]
        rings.append(ring)
    return a.loft(name, rings, zone, part=part, smooth=32)


def wing_frame(z0, side, dihedral=0.0):
    def f(span, y, t):
        return (side * span, y, z0 + t + span * math.tan(dihedral))
    return f


def fin_frame(x0, z0, cant, side):
    d = Vector((side * math.sin(cant), 0, math.cos(cant)))
    nrm = Vector((side * math.cos(cant), 0, -math.sin(cant)))

    def f(span, y, t):
        p = Vector((x0, y, z0)) + d * span + nrm * t
        return (p.x, p.y, p.z)
    return f


def hinge_point(frame, le, chord, span, cfrac):
    return Vector(frame(span, le(span) + cfrac * chord(span), 0.0))


def raked_ring(cx, cz, hw, hh, y, rake, p=4.0, n=16, scale=1.0):
    pts = []
    for i in range(n):
        ang = (i + 0.5) / n * math.tau
        c, s = math.cos(ang), math.sin(ang)
        x = cx + hw * scale * math.copysign(abs(c) ** (2 / p), c)
        z = cz + hh * scale * math.copysign(abs(s) ** (2 / p), s)
        pts.append((x, y + (z - cz) * rake, z))
    return pts


def nozzle(a: Asset, name, metal, dark, x, z, y0, y1, r, n=20):
    petal = [(x + r * (0.9 if i % 2 else 0.86) * math.cos(t), y1, z + r * (0.9 if i % 2 else 0.86) * math.sin(t))
             for i, t in enumerate(k * math.tau / n for k in range(n))]

    def ring(rr, y):
        return [(x + rr * math.cos(t), y, z + rr * math.sin(t)) for t in (k * math.tau / n for k in range(n))]

    obj = a.loft(name, [ring(r * 1.02, y0), ring(r, y0 + (y1 - y0) * 0.45), petal, ring(r * 0.72, y1 - 0.12),
                        ring(r * 0.62, y1 - 0.9)], metal, part="Body", cap_start=False, smooth=50)
    polys = len(obj.data.polygons)
    a.assign(obj, range(polys - 2 * n, polys), dark)
    return obj


# --------------------------------------------------------------------------
# Paint


def jet_paint(upper, lower, *, camo=None, camo_scale=0.18, splinter=False, radome=None, radome_y=-9.6,
              antiglare=(-9.6, -7.9), accent=None, accent_masks=(), rough=0.55, metal=0.12, panel_w=0.035,
              extra=None, soot_y=10.4, soot_x=2.4):
    """Military paint: countershading, optional camouflage, panel lines and wear.

    ``accent_masks`` are callables (n, x, y, z, nx, ny, nz) -> mask socket.
    ``extra`` is (n, col, x, y, z, nx, ny, nz) -> col for livery patterns.
    """

    def pattern(n: Nodes, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        nx, ny, nz = n.xyz(n.normal())
        top = n.smooth(nz, -0.4, 0.05)
        col = n.vlerp(srgb(lower), srgb(upper), top)
        if camo:
            if splinter:
                cell = n.voronoi(n.vmul(p, (1.0, 0.7, 1.0)), camo_scale, "F1", "CHEBYCHEV", "Color", 1.0)
                cx, cy, cz = n.xyz(cell)
                tone = n.vlerp(srgb(camo[0]), srgb(camo[1]), n.smooth(cx, 0.32, 0.34))
                if len(camo) > 2:
                    tone = n.vlerp(tone, srgb(camo[2]), n.smooth(cy, 0.7, 0.72))
                col = n.vlerp(col, tone, n.mul(top, n.smooth(cz, 0.25, 0.27)))
            else:
                blot = n.smooth(n.noise(n.vmul(p, (1.0, 0.6, 1.0)), camo_scale, 2.0, 0.4), 0.52, 0.56)
                col = n.vlerp(col, srgb(camo[0]), n.mul(blot, top))
        if extra is not None:
            col = extra(n, col, x, y, z, nx, ny, nz)
        if radome is not None:
            col = n.vlerp(col, srgb(radome), n.smooth(y, radome_y + 0.04, radome_y - 0.04))
        if antiglare is not None:
            ag = n.mul(n.band(y, antiglare[0], antiglare[1], 0.03), n.mul(n.smooth(nz, 0.45, 0.6), n.band(x, -0.75, 0.75, 0.04)))
            col = n.vlerp(col, srgb("#3a3e42"), ag)
        rough_delta = 0.0
        if accent is not None:
            mask = 0.0
            for fn in accent_masks:
                mask = n.maxf(mask, fn(n, x, y, z, nx, ny, nz))
            col = n.vlerp(col, srgb(accent), mask)
        # Panel lines: plane grids plus sparse rectangular access panels, none on the radome.
        noradome = n.smooth(y, radome_y - 0.05, radome_y + 0.05)
        ly = n.maxf(n.lines(y, 1.85, panel_w, 0.17), n.mul(n.lines(y, 3.1, panel_w, 0.61), n.smooth(n.noise(p, 0.4, 1.0, 0.5), 0.45, 0.5)))
        lx = n.mul(n.lines(x, 2.35, panel_w, 0.3), n.smooth(n.absf(nx), 0.85, 0.6))
        lz = n.mul(n.lines(z, 0.9, panel_w, 0.4), n.smooth(n.absf(nz), 0.6, 0.35))
        # Access panels: an inset rectangle outline in roughly a third of the grid cells.
        v = n.add(n.mul(x, n.absf(nz)), n.mul(z, n.sub(1.0, n.absf(nz))))
        cu, cv = 1.85, 1.15
        fu = n.mul(n.absf(n.sub(n.math("FRACT", n.math("DIVIDE", n.sub(y, 0.17 * cu), cu)), 0.5)), cu)
        fv = n.mul(n.absf(n.sub(n.math("FRACT", n.math("DIVIDE", v, cv)), 0.5)), cv)
        inside = n.mul(n.smooth(fu, cu * 0.3 + panel_w, cu * 0.3), n.smooth(fv, cv * 0.28 + panel_w, cv * 0.28))
        edge_u = n.mul(n.band(fu, cu * 0.3 - panel_w * 0.5, cu * 0.3 + panel_w * 0.5, panel_w * 0.3), n.smooth(fv, cv * 0.28 + panel_w, cv * 0.28))
        edge_v = n.mul(n.band(fv, cv * 0.28 - panel_w * 0.5, cv * 0.28 + panel_w * 0.5, panel_w * 0.3), n.smooth(fu, cu * 0.3 + panel_w, cu * 0.3))
        cell = n.vec(n.math("FLOOR", n.math("DIVIDE", n.sub(y, 0.17 * cu), cu)), n.math("FLOOR", n.math("DIVIDE", v, cv)), n.math("SIGN", x))
        pick = n.smooth(n.noise(n.vscale(cell, 0.913), 1.0, 0.0, 0.5), 0.56, 0.58)
        acc = n.mul(n.maxf(edge_u, edge_v), pick)
        inside = n.mul(inside, pick)
        lines = n.mul(n.maxf(n.maxf(ly, lx), n.maxf(lz, acc)), noradome)
        # Fasteners: short dotted rows just beside the station lines.
        dots = n.mul(n.mul(n.lines(n.add(y, 0.09), 1.85, 0.03, 0.17), n.rect(n.add(x, z), 0.22, 0.06)), noradome)
        col = n.vscale(col, n.sub(1.0, n.add(n.mul(lines, 0.32), n.mul(dots, 0.12))))
        # Tonal panel-to-panel variation (repainted panels).
        col = n.vscale(col, n.sub(1.0, n.mul(inside, 0.035)))
        # Flow streaks, belly fluid stains and engine soot.
        streak = n.smooth(n.noise(n.vmul(p, (5.0, 0.25, 5.0)), 1.3, 3.0, 0.55), 0.52, 0.72)
        col = n.vscale(col, n.sub(1.0, n.mul(streak, 0.1)))
        belly = n.mul(n.smooth(nz, -0.3, -0.7), n.smooth(n.noise(n.vmul(p, (2.0, 0.5, 2.0)), 0.9, 4.0, 0.6), 0.55, 0.7))
        col = n.vlerp(col, srgb("#3b3a36"), n.mul(belly, 0.35))
        soot = n.mul(n.smooth(y, soot_y, soot_y + 2.4), n.smooth(n.absf(x), soot_x + 0.6, soot_x - 0.4))
        col = n.vlerp(col, srgb("#2b2b2a"), n.mul(soot, 0.6))
        rough_delta = n.add(n.mul(lines, 0.12), n.add(n.mul(soot, 0.15), n.mul(streak, 0.05)))
        height = n.sub(0.5, n.add(n.mul(lines, 0.55), n.mul(dots, 0.2)))
        return col, rough_delta, height

    return standard(upper, rough, metal, pattern=pattern, vary=0.04, vary_scale=0.12, grime=0.08, grime_scale=0.12,
                    ao=0.3, ao_dist=1.2)


def canopy_glass(tint="#2f3a40"):
    def pattern(n: Nodes, col):
        x, y, z = n.xyz(n.pos())
        sheen = n.smooth(n.noise(n.vmul(n.pos(), (0.4, 1.0, 2.0)), 1.4, 2.0, 0.5), 0.4, 0.7)
        return n.vlerp(col, srgb("#5a5038"), n.mul(sheen, 0.25)), None, None

    return standard(tint, 0.05, 0.6, pattern=pattern, vary=0.02, grime=0.0, ao=0.1)


def nozzle_metal(base="#62625f"):
    def pattern(n: Nodes, col):
        x, y, z = n.xyz(n.pos())
        heat = n.noise(n.vmul(n.pos(), (2.0, 0.6, 2.0)), 2.2, 3.0, 0.5)
        col = n.vlerp(col, srgb("#5a5048"), n.mul(n.smooth(heat, 0.4, 0.7), 0.35))
        col = n.vlerp(col, srgb("#434a58"), n.mul(n.smooth(heat, 0.65, 0.8), 0.35))
        ribs = n.lines(n.math("ARCTAN2", x, z), 0.39, 0.03)
        return n.vscale(col, n.sub(1.0, n.mul(ribs, 0.3))), None, n.sub(0.5, n.mul(ribs, 0.4))

    return standard(base, 0.42, 0.85, pattern=pattern, grime=0.2, ao=0.4, ao_dist=0.8)


def dark_metal(color="#1d1f22", rough=0.7, metal=0.3):
    return standard(color, rough, metal, grime=0.05, ao=0.6, ao_dist=1.0)


CHECK_NOTES = {
    "noRealMilitaryInsignia": "No roundels, flags, national or unit markings, serials or squadron codes; airframe is an original design, not a copy of any real aircraft.",
    "noGoreOrWeaponsGlorification": "Empty pylons and launch rails only; no missiles, bombs, kill marks, damage or gore.",
    "noText": "No letters, numbers, call signs, serials or squadron codes in mesh or texture; panel lines and camouflage only.",
}


# --------------------------------------------------------------------------
# Kestrel


def kestrel_zones(a: Asset):
    def fin_tips(n, x, y, z, nx, ny, nz):
        return n.mul(n.smooth(z, 4.1, 4.2), n.smooth(n.absf(x), 1.0, 1.4))

    def lerx_line(n, x, y, z, nx, ny, nz):
        # A thin accent along the intake lips: restrained colour, not a marking.
        return n.mul(n.band(y, -4.75, -4.45, 0.02), n.smooth(n.absf(x), 2.0, 2.3))

    paint = a.zone("paint", jet_paint("#7d858d", "#a9b0b6", camo=("#68717a",), camo_scale=0.16, radome="#6c7379",
                                       accent="#1f9fb3", accent_masks=(fin_tips, lerx_line)))
    glass = a.zone("glass", canopy_glass())
    frame = a.zone("frame", standard("#4a5056", 0.6, 0.3, grime=0.1, ao=0.4, ao_dist=0.6))
    metal = a.zone("metal", nozzle_metal())
    dark = a.zone("dark", dark_metal())
    rail = a.zone("rail", standard("#8d949a", 0.5, 0.3, grime=0.15, ao=0.4, ao_dist=0.6))
    return paint, glass, frame, metal, dark, rail


KESTREL_STATIONS = [
    # y, half-width, top, bottom, centre z, top exponent, bottom exponent
    (-13.0, 0.05, 0.061, 0.057, -0.1, 2.0, 2.0),
    (-12.6, 0.3, 0.317, 0.274, -0.02, 1.8, 1.7),
    (-11.6, 0.7, 0.683, 0.57, 0.01, 1.75, 1.65),
    (-10.2, 1.05, 1.0, 0.798, 0.04, 1.75, 1.65),
    (-8.8, 1.3, 1.196, 0.958, 0.07, 1.8, 1.75),
    (-7.2, 1.48, 1.318, 1.072, 0.08, 1.9, 1.9),
    (-5.6, 1.62, 1.366, 1.14, 0.08, 2.0, 2.2),
    (-4.0, 1.78, 1.366, 1.186, 0.08, 2.1, 2.5),
    (-2.2, 2.15, 1.342, 1.208, 0.08, 2.3, 2.9),
    (0.0, 2.55, 1.293, 1.208, 0.08, 2.5, 3.2),
    (2.5, 2.7, 1.244, 1.163, 0.08, 2.6, 3.2),
    (5.0, 2.65, 1.196, 1.117, 0.08, 2.6, 3.2),
    (7.5, 2.45, 1.122, 1.049, 0.08, 2.6, 3.0),
    (9.5, 2.2, 1.025, 0.98, 0.08, 2.6, 2.8),
    (11.0, 1.95, 0.927, 0.889, 0.08, 2.6, 2.6),
    (11.6, 1.85, 0.878, 0.844, 0.08, 2.6, 2.6),
]


@builder("kestrel")
def kestrel():
    a = Asset("kestrel", "Kestrel player fighter", texture=1024, kind="aircraft", tri_limit=10000, bump_distance=0.012,
              seed=101, usage="Player aircraft (JetFactory.Create, menu display jet, parked jets).")
    paint, glass, frame, metal, dark, rail = kestrel_zones(a)
    a.metadata["pivots"] = {}
    fuselage(a, "Fuselage", paint, KESTREL_STATIONS)
    a.cyl("Pitot", 0.045, 1.0, (0, -13.45, -0.1), rail, segs=6, rot=(math.radians(90), 0, 0), part="Body")

    # Canopy: one-piece bubble on a raised sill, windscreen bow, rear bow and sills.
    cs = [(-8.6, 0.10, 0.05), (-8.0, 0.60, 0.46), (-7.0, 0.82, 0.82), (-5.9, 0.86, 0.92), (-4.8, 0.80, 0.84),
          (-3.7, 0.62, 0.60), (-2.8, 0.34, 0.30), (-2.1, 0.08, 0.05)]

    def canopy_ring(y, w, h, grow=1.0, n=16):
        st = interp_stations(KESTREL_STATIONS, y)
        base = st[4] + st[2] * 0.9
        pts = []
        for i in range(n):
            ang = math.pi * i / (n - 1)
            pts.append((w * grow * math.cos(ang), y, base + h * grow * math.sin(ang)))
        return pts + [(-w * grow * 0.9, y, base - 0.25), (w * grow * 0.9, y, base - 0.25)]

    a.loft("Canopy", [canopy_ring(*c) for c in cs], glass, part="Body", smooth=50)
    for k, y in enumerate((-7.55, -4.25)):
        w = [c for c in cs if c[0] <= y][-1]
        nxt = [c for c in cs if c[0] > y][0]
        t = (y - w[0]) / (nxt[0] - w[0])
        cw, ch = w[1] + (nxt[1] - w[1]) * t, w[2] + (nxt[2] - w[2]) * t
        a.loft(f"Canopy bow {k}", [canopy_ring(y - 0.09, cw, ch, 1.05, 12), canopy_ring(y + 0.09, cw, ch, 1.05, 12)],
               frame, part="Body", smooth=40)
    for side in (-1, 1):
        sill = []
        for y in (-8.2, -6.0, -3.6, -2.4):
            st = interp_stations(KESTREL_STATIONS, y)
            sill.append((side * (0.62 if -7.0 < y < -3.0 else 0.35), y, st[4] + st[2] * 0.9 - 0.05))
        for i in range(len(sill) - 1):
            a.beam(f"Sill {side} {i}", sill[i], sill[i + 1], 0.12, frame, part="Body")
    a.loft("Spine", [[(x * w, y, zc + z * h) for x, z in section(1, 1, 1, 0, 2.2, 2.2, 12)]
                     for y, w, h, zc in ((-2.6, 0.2, 0.15, 1.3), (-1.0, 0.55, 0.32, 1.36), (4.0, 0.6, 0.34, 1.3),
                                         (8.5, 0.42, 0.24, 1.14), (10.2, 0.1, 0.05, 1.04))], paint, part="Body", smooth=50)
    a.box("Blade antenna", (0.06, 0.8, 0.45), (0, 2.2, 1.85), rail, part="Body", rot=(math.radians(-12), 0, 0))

    # Side intakes with raked mouths, painted lips and dark ducts.
    for side in (-1, 1):
        cx = side * 2.2
        rings = [raked_ring(cx * 0.8, -0.2, 0.45, 0.6, 3.5, 0.0), raked_ring(cx, -0.25, 0.62, 0.74, 0.0, 0.0),
                 raked_ring(cx, -0.25, 0.64, 0.76, -4.4, -0.45), raked_ring(cx, -0.25, 0.62, 0.74, -4.15, -0.45, scale=0.8)]
        obj = a.loft(f"Intake {side}", rings, paint, part="Body", cap_start=False, smooth=40)
        polys = len(obj.data.polygons)
        a.assign(obj, range(polys - 16, polys), dark)
        # LERX: thin blended strake from the cockpit chine to the wing root.
        lerx = [(side * 1.45, -8.0), (side * 2.45, -4.6), (side * 3.2, -1.6), (side * 3.2, 1.4), (side * 1.8, 1.4), (side * 1.4, -5.0)]
        a.prism(f"LERX {side}", lerx, 0.0, 0.16, paint, part="Body")

    # Wing: 38 deg leading edge, aileron on the outer trailing edge, tip rail and one pylon.
    root_x, tip_x = 2.4, 11.3

    def le(s):
        return -1.6 + (s - 2.9) * 0.78

    def te(s):
        return 6.2 + (s - 2.9) * (6.65 - 6.2) / (tip_x - 2.9)

    def chord(s):
        return te(s) - le(s)

    tc = lambda s: 0.05 - 0.02 * (s - root_x) / (tip_x - root_x)
    for side, tag in ((-1, "L"), (1, "R")):
        f = wing_frame(0.05, side, math.radians(-2))
        surface(a, f"Wing in {tag}", paint, "Body", f, [root_x, 4.5, 6.6], le, chord, tc)
        surface(a, f"Wing mid {tag}", paint, "Body", f, [6.6, 8.6, 10.6], le, chord, tc, 0.0, 0.74)
        surface(a, f"Wing tip {tag}", paint, "Body", f, [10.6, tip_x], le, chord, tc)
        surface(a, f"Aileron {tag}", paint, f"Aileron_{tag}", f, [6.65, 8.6, 10.55], le, chord, tc, 0.76, 1.0)
        h0, h1 = hinge_point(f, le, chord, 6.65, 0.76), hinge_point(f, le, chord, 10.55, 0.76)
        a.metadata["pivots"][f"Aileron_{tag}"] = tuple((h0 + h1) / 2)
        a.metadata.setdefault("hinges", {})[f"Aileron_{tag}"] = (tuple(h0), tuple(h1))
        tip = Vector(f(tip_x + 0.12, le(tip_x), 0))
        a.box(f"Tip rail {tag}", (0.16, 3.0, 0.2), (tip.x, le(tip_x) + 1.3, tip.z), rail, part="Body")
        a.box(f"Pylon {tag}", (0.12, 2.2, 0.38), (side * 6.0, le(6.0) + 1.9, f(6.0, 0, 0)[2] - 0.28), rail, part="Body")
        a.metadata.setdefault("wingtips", {})[tag] = (tip.x, le(tip_x) + 2.8, tip.z)

        # Twin outward-canted fins with rudders on the upper trailing edge.
        ff = fin_frame(side * 1.55, 0.95, math.radians(20), side)
        fle = lambda s: 6.5 + s * 0.92
        fch = lambda s: 4.7 - s * 0.85
        surface(a, f"Fin low {tag}", paint, "Body", ff, [-0.3, 0.6], fle, fch, 0.06)
        surface(a, f"Fin mid {tag}", paint, "Body", ff, [0.6, 2.0, 3.2], fle, fch, 0.06, 0.0, 0.68)
        surface(a, f"Fin top {tag}", paint, "Body", ff, [3.2, 3.7], fle, fch, 0.06)
        surface(a, f"Rudder {tag}", paint, f"Rudder_{tag}", ff, [0.62, 2.0, 3.18], fle, fch, 0.06, 0.70, 1.0)
        r0, r1 = hinge_point(ff, fle, fch, 0.62, 0.70), hinge_point(ff, fle, fch, 3.18, 0.70)
        a.metadata["pivots"][f"Rudder_{tag}"] = tuple((r0 + r1) / 2)
        a.metadata["hinges"][f"Rudder_{tag}"] = (tuple(r0), tuple(r1))

        # All-moving stabilator rotating about a spanwise spindle.
        sf = wing_frame(-0.05, side, math.radians(-4))
        sle = lambda s: 8.6 + (s - 1.9) * 0.85
        sch = lambda s: 3.5 - (s - 1.9) * 0.66
        surface(a, f"Stabilator {tag}", paint, f"Elevator_{tag}", sf, [1.9, 3.6, 5.5], sle, sch, 0.045)
        spindle = Vector(sf(2.0, 10.0, 0))
        a.metadata["pivots"][f"Elevator_{tag}"] = tuple(spindle)
        a.metadata["hinges"][f"Elevator_{tag}"] = (tuple(spindle), tuple(Vector(sf(2.9, 10.0, 0))))

        # Ventral fin and engine nozzle.
        a.prism(f"Ventral {tag}", [(7.2, 0.0), (9.8, 0.0), (9.9, -0.9), (8.9, -0.95)], -0.05, 0.05, paint, part="Body",
                axis="x").location = (side * 1.7, 0, -0.75)
        nozzle(a, f"Nozzle {tag}", metal, dark, side * 1.0, -0.02, 11.0, 13.0, 0.74)

    # Landing-gear-up doors: nose bay and two main bays, proud of the belly with a gap.
    def belly(y):
        st = interp_stations(KESTREL_STATIONS, y)
        return st[4] - st[3]

    for side in (-1, 1):
        a.box(f"Nose door {side}", (0.42, 2.4, 0.04), (side * 0.23, -6.6, belly(-6.6) - 0.01), paint, part="Body")
        a.box(f"Main door {side}", (1.0, 3.0, 0.04), (side * 1.25, 2.6, belly(2.6) - 0.01), paint, part="Body")
        a.box(f"Main door fwd {side}", (0.55, 1.2, 0.04), (side * 0.55, 0.6, belly(0.6) - 0.01), paint, part="Body")

    hinges = a.metadata["hinges"]
    tips = a.metadata["wingtips"]
    attachments = {"leftWingtip": tips["L"], "rightWingtip": tips["R"], "exhaust": (0.0, 13.0, -0.02)}
    a.finish(origin="center", hinges=hinges, attachments=attachments, extra_notes=CHECK_NOTES)


# --------------------------------------------------------------------------
# Vanta


VANTA_STATIONS = [
    (-13.2, 0.05, 0.056, 0.054, 0.1, 2.0, 2.0),
    (-12.6, 0.28, 0.246, 0.238, 0.08, 1.7, 1.7),
    (-11.2, 0.62, 0.538, 0.518, 0.06, 1.55, 1.55),
    (-9.6, 0.92, 0.806, 0.756, 0.05, 1.5, 1.6),
    (-8.0, 1.12, 1.03, 0.929, 0.05, 1.6, 1.8),
    (-6.4, 1.28, 1.165, 1.037, 0.05, 1.8, 2.0),
    (-4.6, 1.4, 1.232, 1.102, 0.05, 2.0, 2.2),
    (-2.6, 1.55, 1.254, 1.145, 0.05, 2.1, 2.4),
    (0.0, 1.8, 1.254, 1.188, 0.05, 2.2, 2.6),
    (3.0, 1.95, 1.232, 1.188, 0.05, 2.3, 2.6),
    (6.0, 1.95, 1.165, 1.123, 0.05, 2.3, 2.6),
    (9.0, 1.8, 1.053, 1.015, 0.05, 2.3, 2.5),
    (11.2, 1.62, 0.941, 0.907, 0.05, 2.3, 2.4),
    (11.8, 1.55, 0.896, 0.864, 0.05, 2.3, 2.3),
]


def vanta_scheme(livery: str):
    def fin_tip(n, x, y, z, nx, ny, nz):
        return n.mul(n.smooth(z, 5.4, 5.5), n.smooth(n.absf(x), 0.5, 0.1))

    def canard_tip(n, x, y, z, nx, ny, nz):
        return n.mul(n.smooth(n.absf(x), 4.55, 4.75), n.band(y, -7.2, -3.6, 0.05))

    def nose_band(n, x, y, z, nx, ny, nz):
        return n.band(y, -9.55, -9.2, 0.02)

    if livery == "base":
        return jet_paint("#4a5059", "#76808a", camo=("#353a41", "#5e6670", "#2a2e33"), camo_scale=0.42, splinter=True,
                         radome="#2c3035", radome_y=-9.6, accent="#7e2a22",
                         accent_masks=(fin_tip, canard_tip, nose_band), rough=0.6, soot_x=2.0)
    if livery == "vulture":
        def feathers(n, col, x, y, z, nx, ny, nz):
            on_wing = n.mul(n.smooth(n.absf(x), 2.6, 3.0), n.smooth(nz, 0.3, 0.6))
            chevron = n.rect(n.add(n.mul(n.absf(x), 0.62), n.mul(y, -0.55)), 1.9, 0.5, 0.2, 0.03)
            outer = n.smooth(n.absf(x), 5.0, 5.4)
            return n.vlerp(col, srgb("#c6bea9"), n.mul(n.mul(on_wing, chevron), outer))

        return jet_paint("#24262a", "#3c3f44", camo=("#1b1c1f", "#2f3236"), camo_scale=0.42, splinter=True,
                         radome="#1a1b1d", radome_y=-9.6, accent="#c6bea9", accent_masks=(fin_tip, canard_tip),
                         extra=feathers, rough=0.62, soot_x=2.0)
    if livery == "rusk":
        def pinstripe(n, col, x, y, z, nx, ny, nz):
            side = n.smooth(n.absf(nz), 0.6, 0.35)
            stripe = n.mul(n.mul(n.band(z, 0.2, 0.32, 0.015), side), n.band(y, -11.0, 10.5, 0.1))
            ring = n.band(y, -9.55, -9.35, 0.02)
            fin_edge = n.mul(n.smooth(z, 1.4, 1.5), n.mul(n.smooth(n.absf(x), 0.5, 0.1),
                                                          n.band(n.sub(y, n.mul(n.sub(z, 1.0), 1.05)), 4.5, 4.9, 0.03)))
            return n.vlerp(col, srgb("#a8873e"), n.maxf(n.maxf(stripe, ring), fin_edge))

        return jet_paint("#3b1c1e", "#303337", camo=("#2c1517", "#47201f"), camo_scale=0.42, splinter=True,
                         radome="#2a1012", radome_y=-9.6, accent="#a8873e", accent_masks=(fin_tip,),
                         extra=pinstripe, rough=0.42, metal=0.2, soot_x=2.0)
    raise ValueError(livery)


@builder("vanta")
def vanta():
    a = Asset("vanta", "Vanta enemy interceptor", texture=1024, kind="aircraft", tri_limit=10000, bump_distance=0.012,
              seed=102, usage="Enemy bandits and raiders (JetFactory.Create enemy=true).")
    paint = a.zone("paint", vanta_scheme("base"))
    glass = a.zone("glass", canopy_glass("#2a2f34"))
    frame = a.zone("frame", standard("#2e3237", 0.6, 0.3, grime=0.1, ao=0.4, ao_dist=0.6))
    metal = a.zone("metal", nozzle_metal("#55524e"))
    dark = a.zone("dark", dark_metal())
    rail = a.zone("rail", standard("#5d636a", 0.5, 0.3, grime=0.15, ao=0.4, ao_dist=0.6))
    a.metadata["pivots"] = {}
    a.metadata["hinges"] = {}
    fuselage(a, "Fuselage", paint, VANTA_STATIONS)
    a.cyl("Probe", 0.05, 1.4, (0, -13.85, 0.1), rail, segs=6, rot=(math.radians(90), 0, 0), part="Body")

    # Framed two-piece canopy (heavier frame reads hostile at a distance).
    cs = [(-9.0, 0.08, 0.05), (-8.4, 0.48, 0.36), (-7.4, 0.66, 0.62), (-6.2, 0.70, 0.70), (-5.0, 0.64, 0.62),
          (-4.0, 0.46, 0.42), (-3.0, 0.22, 0.18), (-2.4, 0.06, 0.04)]

    def canopy_ring(y, w, h, grow=1.0, n=16):
        st = interp_stations(VANTA_STATIONS, y)
        base = st[4] + st[2] * 0.9
        pts = [(w * grow * math.cos(math.pi * i / (n - 1)), y, base + h * grow * math.sin(math.pi * i / (n - 1))) for i in range(n)]
        return pts + [(-w * grow * 0.9, y, base - 0.25), (w * grow * 0.9, y, base - 0.25)]

    a.loft("Canopy", [canopy_ring(*c) for c in cs], glass, part="Body", smooth=50)
    for k, y in enumerate((-8.0, -6.2, -4.4)):
        prev = [c for c in cs if c[0] <= y][-1]
        nxt = [c for c in cs if c[0] > y][0]
        t = (y - prev[0]) / (nxt[0] - prev[0])
        cw, ch = prev[1] + (nxt[1] - prev[1]) * t, prev[2] + (nxt[2] - prev[2]) * t
        a.loft(f"Canopy bow {k}", [canopy_ring(y - 0.12, cw, ch, 1.05, 12), canopy_ring(y + 0.12, cw, ch, 1.05, 12)],
               frame, part="Body", smooth=40)
    a.loft("Spine", [[(x * w, y, zc + z * h) for x, z in section(1, 1, 1, 0, 2.0, 2.0, 12)]
                     for y, w, h, zc in ((-3.0, 0.2, 0.12, 1.12), (-1.0, 0.75, 0.45, 1.18), (5.0, 0.8, 0.5, 1.14),
                                         (9.8, 0.5, 0.3, 1.02), (11.6, 0.1, 0.05, 0.94))], paint, part="Body", smooth=50)

    # Chin intake: one wide raked mouth under the cockpit.
    rings = [raked_ring(0, -0.9, 1.0, 0.45, 3.5, 0.0), raked_ring(0, -1.25, 1.35, 0.62, -1.0, 0.0),
             raked_ring(0, -1.3, 1.38, 0.64, -5.4, 0.6), raked_ring(0, -1.3, 1.38, 0.64, -5.15, 0.6, scale=0.8)]
    obj = a.loft("Chin intake", rings, paint, part="Body", cap_start=False, smooth=40)
    polys = len(obj.data.polygons)
    a.assign(obj, range(polys - 16, polys), dark)

    # Cranked delta wing with full-span elevons.
    root_x, crank_x, tip_x = 1.6, 5.5, 12.2

    def le(s):
        return -2.6 + (s - 1.6) * 1.33 if s < crank_x else -2.6 + (crank_x - 1.6) * 1.33 + (s - crank_x) * 0.98

    def chord(s):
        return 10.6 - le(s)

    tc = lambda s: 0.042 - 0.016 * (s - root_x) / (tip_x - root_x)
    for side, tag in ((-1, "L"), (1, "R")):
        f = wing_frame(-0.15, side, math.radians(-3))
        surface(a, f"Wing root {tag}", paint, "Body", f, [root_x, 3.0, 4.2], le, chord, tc)
        surface(a, f"Wing main {tag}", paint, "Body", f, [4.2, crank_x, 8.0, 11.0], le, chord, tc, 0.0, 0.82)
        surface(a, f"Wing tip {tag}", paint, "Body", f, [11.0, tip_x], le, chord, tc)
        surface(a, f"Elevon {tag}", paint, f"Aileron_{tag}", f, [4.25, crank_x, 8.0, 10.95], le, chord, tc, 0.84, 1.0)
        h0, h1 = hinge_point(f, le, chord, 4.25, 0.84), hinge_point(f, le, chord, 10.95, 0.84)
        a.metadata["pivots"][f"Aileron_{tag}"] = tuple((h0 + h1) / 2)
        a.metadata["hinges"][f"Aileron_{tag}"] = (tuple(h0), tuple(h1))
        tip = Vector(f(tip_x + 0.1, le(tip_x), 0))
        a.box(f"Tip rail {tag}", (0.16, 1.8, 0.2), (tip.x, le(tip_x) + 0.6, tip.z), rail, part="Body")
        for k, px in enumerate((4.6, 7.6)):
            a.box(f"Pylon {tag} {k}", (0.12, 2.0, 0.4), (side * px, le(px) + 2.2, f(px, 0, 0)[2] - 0.3), rail, part="Body")
        a.metadata.setdefault("wingtips", {})[tag] = (tip.x, le(tip_x) + 1.5, tip.z)

        # Canard foreplanes (pitch).
        cf = wing_frame(0.45, side, math.radians(4))
        cle = lambda s: -7.3 + (s - 1.2) * 0.9
        cch = lambda s: 3.0 - (s - 1.2) * 0.6
        surface(a, f"Canard {tag}", paint, f"Elevator_{tag}", cf, [1.2, 3.0, 4.7], cle, cch, 0.05)
        sp = Vector(cf(1.3, -5.9, 0))
        a.metadata["pivots"][f"Elevator_{tag}"] = tuple(sp)
        a.metadata["hinges"][f"Elevator_{tag}"] = (tuple(sp), tuple(Vector(cf(2.2, -5.9, 0))))

        # Ventral strakes and engine nozzles.
        vf = fin_frame(side * 1.2, -0.7, math.radians(155), side)
        surface(a, f"Strake {tag}", paint, "Body", vf, [0.0, 1.2], lambda s: 6.8 + s * 0.8, lambda s: 3.4 - s * 1.4, 0.05)
        nozzle(a, f"Nozzle {tag}", metal, dark, side * 0.86, 0.05, 11.2, 13.2, 0.78)

    # Single large swept fin with rudder.
    ff = fin_frame(0.0, 0.95, 0.0, 1)
    fle = lambda s: 4.6 + s * 1.15
    fch = lambda s: 6.4 - s * 0.95
    surface(a, "Fin low", paint, "Body", ff, [-0.2, 0.8], fle, fch, 0.055)
    surface(a, "Fin mid", paint, "Body", ff, [0.8, 2.6, 4.2], fle, fch, 0.055, 0.0, 0.7)
    surface(a, "Fin top", paint, "Body", ff, [4.2, 4.9], fle, fch, 0.055)
    surface(a, "Rudder", paint, "Rudder", ff, [0.82, 2.6, 4.18], fle, fch, 0.055, 0.72, 1.0)
    r0, r1 = hinge_point(ff, fle, fch, 0.82, 0.72), hinge_point(ff, fle, fch, 4.18, 0.72)
    a.metadata["pivots"]["Rudder"] = tuple((r0 + r1) / 2)
    a.metadata["hinges"]["Rudder"] = (tuple(r0), tuple(r1))
    a.box("Fin cap", (0.14, 1.6, 0.3), (0, fle(4.9) + 0.9, 0.95 + 4.95), rail, part="Body")

    def belly(y):
        st = interp_stations(VANTA_STATIONS, y)
        return st[4] - st[3]

    for side in (-1, 1):
        a.box(f"Main door {side}", (0.9, 3.2, 0.04), (side * 1.25, 3.6, belly(3.6) - 0.01), paint, part="Body")
    a.box("Nose door", (0.7, 2.2, 0.04), (0, -1.6, -1.95), paint, part="Body")

    tips = a.metadata["wingtips"]
    attachments = {"leftWingtip": tips["L"], "rightWingtip": tips["R"], "exhaust": (0.0, 13.2, 0.05)}
    liveries = [
        {"name": "vulture", "title": "Vanta ace livery: Vulture flight", "zones": {"paint": vanta_scheme("vulture")},
         "usage": "Vulture Lead and Vulture Two aces (M11 and M15 ace phases)."},
        {"name": "rusk", "title": "Vanta ace livery: Air Marshal Rusk", "zones": {"paint": vanta_scheme("rusk")},
         "usage": "Air Marshal Rusk final ace (M27 ace phase)."},
    ]
    a.finish(origin="center", hinges=a.metadata["hinges"], attachments=attachments, liveries=liveries,
             extra_notes=CHECK_NOTES)
