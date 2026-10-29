"""Version 2 of the Kestrel (player) and Vanta (enemy) fighters for Roblox upload.

v1 (``aircraft.py``) lofted superellipse tubes; v2 builds each fuselage from
real-aircraft anatomy so the jets read as combat aircraft rather than toys:

* Blended wing-body fuselage from shaped half cross-sections (spine, shoulder,
  a sharp chine that grows into the leading-edge root extension, intake/nacelle
  sides, engine bottoms and the tunnel between them), interpolated along the
  length with monotone cubics, so the body is never a cylinder.
* Shaped intakes with lip thickness, splitter plates, diverter gaps, a lit
  duct and a compressor face with spinner and blades; 2D (Kestrel) or petal
  (Vanta) nozzles with liners, flame holders and heat-tinted metal.
* A bubble canopy (separate ``Canopy`` part the game renders see-through) over
  a cockpit: tub, ejection seat with headrest, instrument-panel shroud, HUD,
  consoles and stick. Frames, sills and the rear bow are separate geometry.
* Wing fences / dogtooth (Vanta), chines (Kestrel), pitot and vane probes,
  blade antennas, refuelling receptacle or probe, flush gear doors, formation
  light strips and wing pylons with twin launch rails and two missiles each.
* Weighted normals over smooth shading; 10k-15k triangles; 1024 PBR maps.

Control surfaces stay separate delivery meshes with their hinge as origin:

    Aileron_L/R   roll  (Kestrel: ailerons; Vanta: delta elevons)
    Elevator_L/R  pitch (Kestrel: all-moving stabilators; Vanta: canards)
    Rudder_L/R    yaw   (Kestrel twin fins)  /  Rudder (Vanta single fin)

Both are original designs (no copy of a specific real aircraft) and carry no
text, numbers, insignia or glyph-like marks: paint is countershading,
camouflage, panel lines, rivets, stains and heat tint.
"""

from __future__ import annotations

import math
import random

from mathutils import Matrix, Vector

from aircraft import fin_frame, hinge_point, surface, wing_frame
from skyasset import Asset, Nodes, srgb, standard

BUILDERS: dict = {}

# In-game lengths (studs) of the procedural aircraft the uploaded models replace.
KESTREL_LENGTH = 26.0
VANTA_LENGTH = 26.4
# Nominal canopy glass opacity (documentation only: previews render glass at alpha 0.60 in
# skyasset.glass_preview, the FBX material stays opaque and the game sets the Canopy part's
# Transparency to AssetSelection GLASS_TRANSPARENCY = 0.45).
GLASS_ALPHA = 0.55


def builder(name):
    def wrap(fn):
        BUILDERS[name] = fn
        return fn
    return wrap


# --------------------------------------------------------------------------
# Curves


def pchip(xs, ys):
    """Monotone cubic (Fritsch-Carlson) interpolant through (xs, ys); no overshoot."""
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        i = max(k for k in range(n - 1) if xs[k] <= x)
        t = (x - xs[i]) / h[i]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1]
                + (t3 - t2) * h[i] * m[i + 1])
    return f


def hermite_chain(points, counts, sharp, mirror_ends=True):
    """Sample a smooth 2D chain through ``points`` (x, z) with ``counts[i]`` samples per segment.

    Tangents are chord-weighted central differences; a ``sharp`` index gets one-sided
    tangents (a crease). Mirror ends: the first and last points lie on the symmetry plane
    and get horizontal-mirror tangents so the full section is smooth across x = 0.
    """
    P = [Vector(p) for p in points]
    n = len(P)

    def tangent(i, incoming):
        if i == 0 and mirror_ends:
            prev = Vector((-P[1].x, P[1].y))
            nxt = P[1]
        elif i == n - 1 and mirror_ends:
            prev, nxt = P[n - 2], Vector((-P[n - 2].x, P[n - 2].y))
        elif i in sharp:
            other = P[i - 1] if incoming else P[i + 1]
            d = (P[i] - other) if incoming else (other - P[i])
            return d
        else:
            prev, nxt = P[i - 1], P[i + 1]
        a, b = (P[i] - prev).length, (nxt - P[i]).length
        if a + b < 1e-9:
            return Vector((0, 0))
        seg = a if incoming else b
        return (nxt - prev) * (seg / (a + b))

    out = []
    for i in range(n - 1):
        p0, p1 = P[i], P[i + 1]
        m0, m1 = tangent(i, False), tangent(i + 1, True)
        c = counts[i]
        for j in range(c):
            t = j / c
            t2, t3 = t * t, t * t * t
            p = (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1
            out.append((p.x, p.y))
    out.append((P[-1].x, P[-1].y))
    return out


class Body:
    """Fuselage from key half cross-sections.

    ``keys`` = [(y, [(x, z) * K]), ...] from nose to tail; every key has the same K
    control points running from the top centre line, round the right side, to the keel.
    ``sharp`` lists control-point indices that stay creased (the chine).
    """

    def __init__(self, keys, sharp, counts):
        self.keys = keys
        self.sharp = set(sharp)
        self.counts = counts
        ys = [k[0] for k in keys]
        K = len(keys[0][1])
        self.fx = [pchip(ys, [k[1][i][0] for k in keys]) for i in range(K)]
        self.fz = [pchip(ys, [k[1][i][1] for k in keys]) for i in range(K)]
        self.y0, self.y1 = ys[0], ys[-1]

    def controls(self, y):
        return [(fx(y), fz(y)) for fx, fz in zip(self.fx, self.fz)]

    def half(self, y):
        return hermite_chain(self.controls(y), self.counts, self.sharp)

    def ring(self, y):
        h = self.half(y)
        right = [(x, y, z) for x, z in h]
        left = [(-x, y, z) for x, z in reversed(h[1:-1])]
        return right + left

    def chine_index(self):
        return sum(self.counts[: min(self.sharp)])

    def _cross(self, pts, x):
        hits = []
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            if (x0 - x) * (x1 - x) <= 0 and abs(x1 - x0) > 1e-9:
                hits.append(z0 + (z1 - z0) * (x - x0) / (x1 - x0))
        return hits

    def z_upper(self, y, x):
        h = self.half(y)
        hits = self._cross(h[: self.chine_index() + 1], abs(x))
        return max(hits) if hits else None

    def z_lower(self, y, x):
        h = self.half(y)
        hits = self._cross(h[self.chine_index():], abs(x))
        return min(hits) if hits else None

    def x_side(self, y, z):
        h = self.half(y)
        best = None
        for (x0, z0), (x1, z1) in zip(h, h[1:]):
            if (z0 - z) * (z1 - z) <= 0 and abs(z1 - z0) > 1e-9:
                xx = x0 + (x1 - x0) * (z - z0) / (z1 - z0)
                best = xx if best is None else max(best, xx)
        return best


def stations(y0, y1, dense):
    """Sample positions along the body: ``dense`` = [(y_until, step), ...]."""
    ys, y = [y0], y0
    for until, step in dense:
        while y + step < until - 1e-6:
            y += step
            ys.append(y)
        if until < y1 and until > y:
            y = until
            ys.append(y)
    if ys[-1] < y1 - 1e-6:
        ys.append(y1)
    return ys


def build_body(a: Asset, name, body: Body, zone, ys):
    rings = []
    for y in ys:
        r = body.ring(y)
        span = max(abs(p[0]) for p in r) + max(p[2] for p in r) - min(p[2] for p in r)
        if span < 1e-4:
            r = [r[0]] * len(r)
        rings.append(r)
    return a.loft(name, rings, zone, part="Body", smooth=60, cap_start=False)


def conform_patch(a: Asset, name, zone, surf, y0, y1, u0, u1, lift=0.025, depth=0.03, nu=4, nv=5, part="Body"):
    """A thin panel (door, strip, receptacle) following a body surface.

    ``surf(y, u) -> (point, outward normal)``; the panel spans y0..y1 and u0..u1, stands
    ``lift`` proud of the skin and sinks ``depth`` below it so the step reads as a seam.
    """
    rings = []
    for i in range(nv + 1):
        y = y0 + (y1 - y0) * i / nv
        outer, inner = [], []
        for j in range(nu + 1):
            u = u0 + (u1 - u0) * j / nu
            p, nrm = surf(y, u)
            outer.append(tuple(p + nrm * lift))
            inner.append(tuple(p - nrm * depth))
        rings.append(outer + list(reversed(inner)))
    return a.loft(name, rings, zone, part=part, smooth=None)


def lower_surface(body: Body, side):
    def f(y, x):
        z = body.z_lower(y, x)
        z2 = body.z_lower(y, x + 0.05)
        t = Vector((0.05, 0, z2 - z)).normalized()
        nrm = Vector((-t.z, 0, t.x))
        if nrm.z > 0:
            nrm = -nrm
        return Vector((side * x, y, z)), Vector((side * nrm.x, 0, nrm.z))
    return f


def upper_surface(body: Body, side):
    def f(y, x):
        z = body.z_upper(y, x)
        z2 = body.z_upper(y, x + 0.05)
        t = Vector((0.05, 0, z2 - z)).normalized()
        nrm = Vector((-t.z, 0, t.x))
        if nrm.z < 0:
            nrm = -nrm
        return Vector((side * x, y, z)), Vector((side * nrm.x, 0, nrm.z))
    return f


def side_surface(body: Body, side):
    def f(y, z):
        x = body.x_side(y, z)
        x2 = body.x_side(y, z + 0.05)
        t = Vector((x2 - x, 0, 0.05)).normalized()
        nrm = Vector((t.z, 0, -t.x))
        if nrm.x < 0:
            nrm = -nrm
        return Vector((side * x, y, z)), Vector((side * nrm.x, 0, nrm.z))
    return f


# --------------------------------------------------------------------------
# Components


def rounded_rect(cx, cz, hw, hh, n=24, p=5.0):
    pts = []
    for i in range(n):
        ang = (i + 0.5) / n * math.tau
        c, s = math.cos(ang), math.sin(ang)
        pts.append((cx + hw * math.copysign(abs(c) ** (2 / p), c), cz + hh * math.copysign(abs(s) ** (2 / p), s)))
    return pts


def trapezoid(cx, cz, w_top, w_bot, hh, skew=0.0, n=24, p=7.0):
    """Rounded trapezoid (intake mouth): top width, bottom width, half height; skew shifts the bottom."""
    pts = []
    for x, z in rounded_rect(0, 0, 1, 1, n, p):
        t = (z + 1) / 2
        w = w_bot + (w_top - w_bot) * t
        pts.append((cx + x * w / 2 + skew * (1 - t), cz + z * hh))
    return pts


def intake(a: Asset, name, zones, mouth, y_lip, rake, *, side=1, cowl_len=3.4, lip=0.07, depth=1.7, duct_shift=(0.0, 0.0),
           spinner=True, n=24):
    """Intake: buried cowl, raked lip with thickness, duct that narrows and turns, compressor face.

    ``mouth(scale)`` gives the (x, z) outline at a scale about its centre; ``rake(x, z)`` is the
    lip's y offset (sweeps the mouth); ``duct_shift`` moves the deep duct (x, z) toward the engine.
    """
    paint, duct, fan, metal = zones
    cx = sum(p[0] for p in mouth(1.0)) / n
    cz = sum(p[1] for p in mouth(1.0)) / n

    def ring(scale, dy, shift=(0.0, 0.0), raked=True, extra=0.0):
        return [(side * (x + shift[0]), y_lip + dy + (rake(x, z) if raked else 0.0) + extra, z + shift[1])
                for x, z in mouth(scale)]

    rings = [
        ring(1.0, cowl_len, raked=False),
        ring(1.0, 0.35),
        ring(1.0, 0.0),
        ring(1.0 - lip, 0.06),
        ring(0.9, 0.7, (duct_shift[0] * 0.4, duct_shift[1] * 0.4)),
        ring(0.82, depth, duct_shift, raked=False),
    ]
    obj = a.loft(name, rings, paint, part="Body", cap_start=False, smooth=55)
    a.assign(obj, range(3 * n, 5 * n), duct)
    a.assign(obj, range(5 * n, 6 * n), fan)
    if spinner:
        r = 0.22 * min(max(p[0] for p in mouth(1.0)) - cx, max(p[1] for p in mouth(1.0)) - cz)
        a.cyl(f"{name} spinner", r, r * 2.2, (side * (cx + duct_shift[0]), y_lip + depth - r * 1.1, cz + duct_shift[1]), metal,
              part="Body", segs=10, r2=0.0, rot=(math.radians(90), 0, 0))
    return obj, (side * cx, y_lip, cz)


def round_nozzle(a: Asset, name, zones, x, z, y0, y1, r, n=24, shallow=False):
    """Convergent-divergent petal nozzle: overlapping petals, liner, flame holder and cone.

    ``shallow=True`` closes the liner with a plug just inside the lip, crossed by ten short radial
    vanes (not 8, 12 or 24, which match wheel and sun symbols), and leaves out the flame holder and cone: from behind the opening is a lit, spoked
    metal disc rather than a dark hole. ``dark`` then zones the vanes."""
    metal, inner, dark = zones

    def ring(rr, y, petal=0.0):
        pts = []
        for k in range(n):
            t = k * math.tau / n
            even = k % 2 == 0
            rk = rr * (1.0 if even else 0.965) if petal else rr
            yk = y + (petal if even else 0.0)
            pts.append((x + rk * math.cos(t), yk, z + rk * math.sin(t)))
        return pts

    L = y1 - y0
    rings = [ring(r * 1.04, y0), ring(r * 1.0, y0 + L * 0.35), ring(r * 0.9, y1 - 0.05, petal=0.12),
             ring(r * 0.82, y1, petal=0.12)]
    if shallow:
        obj = a.loft(name, rings + [ring(r * 0.76, y1 - 0.18)], metal, part="Body", cap_start=False, smooth=50)
        a.assign(obj, range(3 * n, 5 * n), inner)
        for k in range(10):
            t = (k + 0.5) * math.tau / 10
            rm = r * 0.5
            a.box(f"{name} vane {k}", (0.04, 0.14, r * 0.52), (x + rm * math.sin(t), y1 - 0.13, z + rm * math.cos(t)), dark,
                  part="Body", rot=(0, t, 0))
        return obj
    rings += [ring(r * 0.74, y1 - 0.35), ring(r * 0.66, y1 - L * 0.8)]
    obj = a.loft(name, rings, metal, part="Body", cap_start=False, smooth=50)
    a.assign(obj, range(3 * n, 6 * n), inner)
    a.assign(obj, range(5 * n, 6 * n), dark)
    # Flame holder ring and exhaust cone deep in the liner.
    fh = [[(x + rr * math.cos(t), y1 - L * 0.62 + dy, z + rr * math.sin(t)) for t in (k * math.tau / 16 for k in range(16))]
          for rr, dy in ((r * 0.62, 0), (r * 0.5, 0), (r * 0.5, 0.06), (r * 0.62, 0.06))]
    a.loft(f"{name} flameholder", fh, dark, part="Body", cap_start=False, cap_end=False, smooth=40)
    a.cyl(f"{name} cone", r * 0.26, L * 0.4, (x, y1 - L * 0.62, z), dark, part="Body", segs=10, r2=0.04,
          rot=(math.radians(-90), 0, 0))
    return obj


def flat_nozzle(a: Asset, name, zones, x, z, y0, y1, hw, hh, n=28):
    """Two-dimensional nozzle: rounded-rectangle duct, serrated upper and lower flaps, sidewalls."""
    metal, inner, dark = zones

    def ring(sw, sh, y, serrate=0.0):
        pts = []
        for px, pz in rounded_rect(x, z, hw * sw, hh * sh, n, 6.0):
            tooth = 0.0
            if serrate and abs(pz - z) > hh * sh * 0.6:
                u = (px - x) / (hw * sw)
                tooth = serrate * (1 - abs(((u * 2.0 + 0.5) % 1.0) * 2 - 1))
            pts.append((px, y - tooth, pz))
        return pts

    L = y1 - y0
    rings = [ring(1.0, 1.0, y0), ring(1.0, 1.0, y0 + L * 0.45), ring(0.97, 0.84, y1, 0.16),
             ring(0.9, 0.75, y1 + 0.015, 0.16), ring(0.82, 0.7, y1 - 0.5), ring(0.74, 0.62, y1 - L * 0.8)]
    obj = a.loft(name, rings, metal, part="Body", cap_start=False, smooth=50)
    a.assign(obj, range(3 * n, 6 * n), inner)
    a.assign(obj, range(5 * n, 6 * n), dark)
    fh = [[(px, y1 - L * 0.6 + dy, pz) for px, pz in rounded_rect(x, z, hw * s, hh * s * 0.85, 16, 5.0)]
          for s, dy in ((0.62, 0), (0.5, 0), (0.5, 0.06), (0.62, 0.06))]
    a.loft(f"{name} flameholder", fh, dark, part="Body", cap_start=False, cap_end=False, smooth=40)
    return obj


def missile(a: Asset, name, zones, x, z, y_nose, length=4.3, r=0.12, n=10):
    """Air-to-air missile: ogive seeker, body, mid strakes and tail fins in an X."""
    body_z, seeker, fin_z = zones
    prof = [(0.0, 0.0), (0.025, 0.42), (0.06, 0.74), (0.11, 0.93), (0.16, 1.0), (0.93, 1.0), (0.985, 0.9), (1.0, 0.82)]
    rings = []
    for t, k in prof:
        y = y_nose + t * length
        if k == 0:
            rings.append([(x, y, z)] * n)
        else:
            rings.append([(x + r * k * math.cos(u), y, z + r * k * math.sin(u)) for u in (i * math.tau / n for i in range(n))])
    obj = a.loft(name, rings, body_z, part="Body", smooth=40)
    a.assign(obj, range(0, 3 * n), seeker)
    for k in range(4):
        roll = math.radians(45 + 90 * k)
        tail = [(0.0, 0.0), (length * 0.13, 0.0), (length * 0.13, r * 2.0), (length * 0.04, r * 2.1)]
        fin = a.prism(f"{name} fin {k}", tail, -0.012, 0.012, fin_z, part="Body", axis="x")
        fin.location = (x, y_nose + length * 0.84, z)
        fin.rotation_euler = (0, roll, 0)
        fin.data.transform(Matrix.Translation((0, 0, r * 0.6)))
        mid = [(0.0, 0.0), (length * 0.2, 0.0), (length * 0.2, r * 0.8), (length * 0.06, r * 0.9)]
        strake = a.prism(f"{name} strake {k}", mid, -0.01, 0.01, fin_z, part="Body", axis="x")
        strake.location = (x, y_nose + length * 0.3, z)
        strake.rotation_euler = (0, roll, 0)
        strake.data.transform(Matrix.Translation((0, 0, r * 0.6)))
    return obj


def pylon_with_missiles(a: Asset, tag, zones, x, y_lead, z_wing, side, length=3.0, drop=0.42, missile_len=4.3):
    """Wing pylon with a twin-rail launcher adapter carrying two missiles."""
    paint, rail, mbody, seeker, mfin = zones
    outline = [(0.0, 0.1), (length * 0.18, -drop * 0.75), (length * 0.85, -drop), (length, -drop * 0.6), (length, 0.1)]
    p = a.prism(f"Pylon {tag}", [(y_lead + u, z_wing + v) for u, v in outline], x - 0.07, x + 0.07, paint,
                part="Body", axis="x")
    zb = z_wing - drop
    a.box(f"Launcher {tag}", (0.86, length * 0.82, 0.09), (x, y_lead + length * 0.55, zb - 0.03), rail, part="Body")
    for k, dx in enumerate((-0.32, 0.32)):
        a.box(f"Rail {tag} {k}", (0.07, length * 0.78, 0.07), (x + dx, y_lead + length * 0.55, zb - 0.1), rail, part="Body")
        missile(a, f"Missile {tag} {k}", (mbody, seeker, mfin), x + dx, zb - 0.27, y_lead + length * 0.55 - missile_len * 0.52,
                length=missile_len)
    return p


def blade(a: Asset, name, zone, x, y, z, height, chord, sweep=0.5, tilt=0.0, part="Body"):
    outline = [(0.0, -0.05), (chord, -0.05), (chord * 0.55 + height * sweep, height), (height * sweep, height)]
    obj = a.prism(name, [(y + u, z + v) for u, v in outline], x - 0.025, x + 0.025, zone, part=part, axis="x")
    if tilt:
        obj.rotation_euler = (0, tilt, 0)
    return obj


# --------------------------------------------------------------------------
# Paint


def skin(spec: dict):
    """Military finish from a spec dict: countershading, camouflage, explicit panel lines,
    access panels, rivet rows, intake grime, exhaust soot, streaks and stains."""
    S = dict(spec)

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
        col = n.vlerp(srgb(S["lower"]), srgb(S["upper"]), top)
        camo = S.get("camo")
        if camo:
            if S.get("camo_kind") == "splinter":
                q = n.vmul(p, (1.0, 0.75, 1.0))
                warp = n.noise(q, 0.25, 1.0, 0.5)
                q = n.vmath("ADD", q, n.vec(n.mul(warp, 1.6), n.mul(warp, -1.2), 0.0))
                cell = n.voronoi(q, S.get("camo_scale", 0.35), "F1", "CHEBYCHEV", "Color", 1.0)
                cx, cy, cz = n.xyz(cell)
                tone = n.vlerp(srgb(camo[0]), srgb(camo[1]), n.smooth(cx, 0.36, 0.37))
                if len(camo) > 2:
                    tone = n.vlerp(tone, srgb(camo[2]), n.smooth(cy, 0.7, 0.71))
                col = n.vlerp(col, tone, n.mul(top, n.smooth(cz, 0.3, 0.31)))
            else:
                blot = n.smooth(n.noise(n.vmul(p, (1.0, 0.55, 1.0)), S.get("camo_scale", 0.16), 2.0, 0.45), 0.5, 0.535)
                col = n.vlerp(col, srgb(camo[0]), n.mul(blot, n.smooth(nz, -0.15, 0.25)))
        if S.get("extra"):
            col = S["extra"](n, col, x, y, z, nx, ny, nz)
        ry = S["radome_y"]
        radome = n.smooth(y, ry + 0.03, ry - 0.03)
        col = n.vlerp(col, srgb(S["radome"]), radome)
        ag0, ag1 = S["antiglare"]
        ag = n.mul(n.band(y, ag0, ag1, 0.03), n.mul(n.smooth(nz, 0.35, 0.55), n.smooth(ax, S["antiglare_w"] + 0.03, S["antiglare_w"] - 0.03)))
        col = n.vlerp(col, srgb("#3a3e43"), ag)
        if S.get("accent"):
            m = 0.0
            for fn in S.get("accent_masks", ()):
                m = n.maxf(m, fn(n, x, y, z, nx, ny, nz))
            col = n.vlerp(col, srgb(S["accent"]), m)

        pit = 0.0
        if S.get("cockpit"):
            c0, c1, cw = S["cockpit"]
            pit = n.mul(n.mul(n.band(y, c0, c1, 0.03), n.smooth(ax, cw, cw - 0.06)), n.smooth(z, 0.2, 0.35))
            col = n.vlerp(col, srgb("#2b2e32"), pit)

        # Panel lines -------------------------------------------------------
        w = S.get("line_w", 0.028)
        bx = S["body_x"]
        body = n.smooth(ax, bx + 0.15, bx - 0.15)
        wing = n.sub(1.0, body)
        noradome = n.smooth(y, ry - 0.06, ry + 0.06)
        side = n.smooth(anx, 0.45, 0.7)
        flat = n.smooth(anz, 0.45, 0.7)
        frames = n.mul(bands(n, y, S["frames"], w), body)
        long_side = n.mul(n.mul(bands(n, z, S["longerons_z"], w), side), body)
        long_top = n.mul(n.mul(bands(n, ax, S["longerons_x"], w), flat), body)
        tan_le = S["wing_tan"]
        u = n.sub(y, n.mul(n.sub(ax, S["wing_root"]), tan_le))
        ribs = n.mul(n.mul(bands(n, ax, S["ribs"], w), wing), flat)
        spars = n.mul(n.mul(bands(n, u, S["spars"], w), wing), flat)
        # Access panels: explicit rectangles (kind, y0, y1, c0, c1).
        acc = 0.0
        tone = 0.0
        for kind, y0, y1, c0, c1 in S["panels"]:
            if kind == "side":
                coord, face = z, side
            elif kind == "top":
                coord, face = ax, n.smooth(nz, 0.3, 0.5)
            else:
                coord, face = ax, n.smooth(nz, -0.3, -0.5)
            outer = n.mul(n.band(y, y0, y1, 0.008), n.band(coord, c0, c1, 0.008))
            inner = n.mul(n.band(y, y0 + w, y1 - w, 0.008), n.band(coord, c0 + w, c1 - w, 0.008))
            acc = n.maxf(acc, n.mul(n.sub(outer, inner), face))
            tone = n.maxf(tone, n.mul(inner, face))
        noradome = n.mul(noradome, n.sub(1.0, pit))
        lines = n.mul(n.maxf(n.maxf(n.maxf(frames, long_side), n.maxf(long_top, ribs)), n.maxf(spars, acc)), noradome)
        # Rivet rows beside frames, longerons and ribs.
        rw, off = 0.016, 0.07
        near_frames = n.mul(n.maxf(bands(n, n.add(y, off), S["frames"], rw), bands(n, n.sub(y, off), S["frames"], rw)), body)
        dots_v = n.maxf(n.mul(n.rect(z, 0.12, 0.035), side), n.mul(n.rect(ax, 0.12, 0.035), flat))
        riv = n.mul(near_frames, dots_v)
        near_long = n.mul(n.maxf(bands(n, n.add(z, off), S["longerons_z"], rw), bands(n, n.sub(z, off), S["longerons_z"], rw)),
                          n.mul(side, body))
        riv = n.maxf(riv, n.mul(near_long, n.rect(y, 0.12, 0.035)))
        near_ribs = n.mul(n.maxf(bands(n, n.add(ax, off), S["ribs"], rw), bands(n, n.sub(ax, off), S["ribs"], rw)), n.mul(wing, flat))
        riv = n.maxf(riv, n.mul(near_ribs, n.rect(y, 0.12, 0.035)))
        near_spars = n.mul(n.maxf(bands(n, n.add(u, off), S["spars"], rw), bands(n, n.sub(u, off), S["spars"], rw)), n.mul(wing, flat))
        riv = n.mul(n.maxf(riv, n.mul(near_spars, n.rect(ax, 0.12, 0.035))), noradome)
        col = n.vscale(col, n.sub(1.0, n.add(n.mul(lines, 0.38), n.mul(riv, 0.1))))
        # Repainted / replaced panels: slight tonal shift.
        col = n.vscale(col, n.sub(1.0, n.mul(tone, 0.045)))
        # Fade on the upper surfaces, streaks, belly stains.
        col = n.vlerp(col, srgb("#c9ccc8"), n.mul(n.smooth(nz, 0.6, 1.0), n.mul(n.noise(n.vmul(p, (1.0, 0.4, 1.0)), 0.6, 3.0, 0.6), 0.06)))
        streak = n.smooth(n.noise(n.vmul(p, (6.0, 0.22, 6.0)), 1.4, 3.0, 0.55), 0.52, 0.75)
        col = n.vscale(col, n.sub(1.0, n.mul(streak, 0.09)))
        belly = n.mul(n.smooth(nz, -0.3, -0.75), n.smooth(n.noise(n.vmul(p, (2.0, 0.45, 2.0)), 0.9, 4.0, 0.6), 0.55, 0.72))
        col = n.vlerp(col, srgb("#3d3b35"), n.mul(belly, 0.3))
        # Intake grime: darker, rougher skin around the mouths.
        grime = 0.0
        for gx, gy, gz in S["intakes"]:
            d = n.vmath("LENGTH", n.vmath("SUBTRACT", n.vec(ax, y, z), (gx, gy, gz)))
            grime = n.maxf(grime, n.smooth(d, S.get("intake_r", 1.7), 0.2))
        gnoise = n.smooth(n.noise(p, 2.2, 4.0, 0.6), 0.35, 0.65)
        grime = n.mul(grime, n.add(0.4, n.mul(gnoise, 0.6)))
        col = n.vlerp(col, srgb("#2e2d2a"), n.mul(grime, 0.45))
        # Exhaust soot on the aft body, streaked rearward.
        sy, sx = S["soot"]
        soot = n.mul(n.smooth(y, sy, sy + 2.2), n.smooth(ax, sx + 0.7, sx - 0.5))
        soot = n.mul(soot, n.add(0.5, n.mul(streak, 0.5)))
        col = n.vlerp(col, srgb("#26262a"), n.mul(soot, 0.65))
        rough_delta = n.add(n.add(n.mul(lines, 0.12), n.mul(soot, 0.18)), n.add(n.mul(grime, 0.15), n.mul(streak, 0.04)))
        height = n.sub(0.5, n.add(n.mul(lines, 0.6), n.mul(riv, 0.25)))
        return col, rough_delta, height

    return standard(S["upper"], S.get("rough", 0.52), S.get("metal", 0.06), pattern=pattern, vary=0.035,
                    vary_scale=0.15, grime=0.06, grime_scale=0.15, ao=0.32, ao_dist=1.0)


def glass(tint="#3f4d5a"):
    def pattern(n: Nodes, col):
        sheen = n.smooth(n.noise(n.vmul(n.pos(), (0.4, 1.0, 2.0)), 1.2, 2.0, 0.5), 0.4, 0.75)
        return n.vlerp(col, srgb("#6b6040"), n.mul(sheen, 0.22)), None, None

    return standard(tint, 0.06, 0.35, pattern=pattern, vary=0.02, grime=0.0, ao=0.0)


def heat_metal(base, nozzles, y_exit, length):
    """Bare nozzle metal: straw, bronze and blue heat tint toward the exit, petal seams."""

    def pattern(n: Nodes, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        t = n.smooth(y, y_exit - length, y_exit)
        wob = n.noise(n.vmul(p, (3.0, 0.8, 3.0)), 2.0, 3.0, 0.5)
        t = n.clamp01(n.add(t, n.mul(n.sub(wob, 0.5), 0.35)))
        col = n.vlerp(col, srgb("#7d7660"), n.mul(n.smooth(t, 0.15, 0.4), 0.4))
        col = n.vlerp(col, srgb("#5f5048"), n.mul(n.smooth(t, 0.4, 0.65), 0.4))
        col = n.vlerp(col, srgb("#474e66"), n.mul(n.smooth(t, 0.65, 0.95), 0.45))
        nxx, nzz = nozzles
        ang = n.math("ARCTAN2", n.sub(n.absf(x), nxx), n.sub(z, nzz))
        seams = n.lines(ang, math.tau / 12, 0.025)
        col = n.vscale(col, n.sub(1.0, n.mul(seams, 0.35)))
        return col, n.mul(t, -0.1), n.sub(0.5, n.mul(seams, 0.5))

    return standard(base, 0.4, 0.85, pattern=pattern, vary=0.05, grime=0.15, ao=0.45, ao_dist=0.8)


def soot_liner(base="#2a2827"):
    def pattern(n: Nodes, col):
        x, y, z = n.xyz(n.pos())
        rings = n.lines(y, 0.18, 0.03)
        return n.vscale(col, n.sub(1.0, n.mul(rings, 0.35))), None, n.sub(0.5, n.mul(rings, 0.4))

    return standard(base, 0.75, 0.5, pattern=pattern, vary=0.08, grime=0.3, ao=0.6, ao_dist=0.6)


def duct_paint(y_lip, depth):
    """Intake duct: light grey at the lip, darkening into the duct."""

    def pattern(n: Nodes, col):
        x, y, z = n.xyz(n.pos())
        deep = n.smooth(y, y_lip + 0.1, y_lip + depth)
        return n.vlerp(col, srgb("#2b2d30"), deep), None, None

    return standard("#a6abae", 0.55, 0.1, pattern=pattern, vary=0.05, grime=0.2, ao=0.5, ao_dist=0.8)


def fan_face(centers):
    """Compressor face: dark metal with radial blades about each duct centre."""

    def pattern(n: Nodes, col):
        x, y, z = n.xyz(n.pos())
        cx, cz = centers
        ang = n.math("ARCTAN2", n.sub(n.absf(x), cx), n.sub(z, cz))
        blades = n.lines(ang, math.tau / 22, 0.05)
        return n.vscale(col, n.sub(1.0, n.mul(blades, 0.55))), None, n.sub(0.5, n.mul(blades, 0.6))

    return standard("#4a4d50", 0.45, 0.8, pattern=pattern, vary=0.05, grime=0.2, ao=0.6, ao_dist=0.6)


def zones_common(a: Asset, paint_builder, frame_color, nozzle_center, y_exit, nozzle_len, intake_y, intake_depth, duct_center):
    z = {}
    z["paint"] = a.zone("paint", paint_builder)
    z["glass"] = a.zone("glass", glass())
    z["frame"] = a.zone("frame", standard(frame_color, 0.55, 0.15, grime=0.1, ao=0.4, ao_dist=0.5))
    z["cockpit"] = a.zone("cockpit", standard("#2c2f33", 0.8, 0.05, grime=0.15, ao=0.6, ao_dist=0.5))
    z["seat"] = a.zone("seat", standard("#3a3b33", 0.85, 0.0, grime=0.2, ao=0.5, ao_dist=0.4))
    z["panel"] = a.zone("panel", standard("#17191b", 0.7, 0.05, grime=0.05, ao=0.4, ao_dist=0.4))
    z["metal"] = a.zone("metal", heat_metal("#6a6a66", nozzle_center, y_exit, nozzle_len))
    z["ceramic"] = z["metal"]
    z["liner"] = a.zone("liner", soot_liner())
    z["dark"] = a.zone("dark", standard("#141516", 0.85, 0.2, grime=0.0, ao=0.5, ao_dist=0.6))
    z["duct"] = a.zone("duct", duct_paint(intake_y, intake_depth))
    z["fan"] = a.zone("fan", fan_face(duct_center))
    z["probe"] = a.zone("probe", standard("#8e9295", 0.35, 0.85, grime=0.1, ao=0.3, ao_dist=0.4))
    z["rail"] = a.zone("rail", standard("#5c6166", 0.55, 0.3, grime=0.15, ao=0.4, ao_dist=0.5))
    z["missile"] = a.zone("missile", standard("#b9bdbd", 0.5, 0.08, grime=0.1, ao=0.35, ao_dist=0.5))
    z["seeker"] = a.zone("seeker", standard("#3a3d3f", 0.2, 0.4, grime=0.0, ao=0.2, ao_dist=0.3))
    # Formation light strips: unlit electroluminescent panels, pale olive and low contrast.
    z["light"] = a.zone("light", standard("#8e9677", 0.4, 0.0, grime=0.05, ao=0.2, ao_dist=0.3))
    return z


CHECK_NOTES = {
    "noText": "No letters, numbers, call signs, serials, squadron codes or glyph-like marks in mesh or texture; countershading, camouflage, panel lines, rivets and stains only.",
    "noRealMilitaryInsignia": "No roundels, flags, national or unit markings or insignia; airframe is an original design, not a copy of any real aircraft.",
    "noGoreOrWeaponsGlorification": "Plain unmarked air-to-air missile shapes on wing pylons as the standard combat loadout of a flight game; no kill marks, damage, blood or gore.",
    "noFaces": "No faces, figures or face-like arrangements: the cockpit holds an empty seat and panel only; intake mouths are plain dark rectangles with no central spinner, so the front view does not read as eyes.",
}


def cockpit(a: Asset, z, y_front, y_seat, floor, sill, sill_w, y_back):
    """Empty cockpit in the fuselage tub under the canopy: consoles, shroud, HUD, seat, stick."""
    for s in (-1, 1):
        a.box(f"Console {s}", (0.16, y_back - y_front - 1.4, 0.1), (s * (sill_w - 0.2), (y_front + y_back) / 2 + 0.3, sill - 0.12),
              z["panel"], part="Body", bevel=0.02)
    # Instrument panel shroud: a rounded hood ahead of the pilot.
    hood = []
    for dy, sc in ((0.0, 0.85), (0.3, 1.0), (0.6, 0.97)):
        ring = [(math.cos(math.pi * i / 10) * (sill_w - 0.08) * sc, y_front + dy, sill - 0.12 + math.sin(math.pi * i / 10) * 0.3 * sc)
                for i in range(11)]
        hood.append(ring)
    a.loft("Panel shroud", hood, z["panel"], part="Body", closed=False, smooth=50)
    a.box("Panel face", ((sill_w - 0.1) * 2, 0.05, sill - floor), (0, y_front + 0.62, (sill + floor) / 2 - 0.05), z["panel"],
          part="Body", rot=(math.radians(-12), 0, 0))
    a.box("HUD frame", (0.3, 0.03, 0.22), (0, y_front + 0.12, sill + 0.28), z["frame"], part="Body", rot=(math.radians(-35), 0, 0))
    # Ejection seat: pan, back, headrest box and side rails, leaning back 16 degrees.
    lean = math.radians(16)
    a.box("Seat pan", (0.46, 0.5, 0.14), (0, y_seat - 0.25, floor + 0.12), z["seat"], part="Body", bevel=0.03)
    back_c = Vector((0, y_seat + 0.04 + math.sin(lean) * 0.36, floor + 0.12 + math.cos(lean) * 0.36))
    a.box("Seat back", (0.46, 0.13, 0.66), tuple(back_c), z["seat"], part="Body", rot=(lean, 0, 0), bevel=0.03)
    head_c = Vector((0, y_seat + 0.1 + math.sin(lean) * 0.8, floor + 0.12 + math.cos(lean) * 0.8))
    a.box("Headrest", (0.4, 0.2, 0.28), tuple(head_c), z["panel"], part="Body", rot=(lean, 0, 0), bevel=0.04)
    for s in (-1, 1):
        a.box(f"Seat rail {s}", (0.06, 0.1, 0.95), (s * 0.27, y_seat + 0.16 + math.sin(lean) * 0.46, floor + 0.12 + math.cos(lean) * 0.46),
              z["rail"], part="Body", rot=(lean, 0, 0))
    a.cyl("Stick", 0.03, 0.34, (0, y_seat - 0.75, floor + 0.25), z["panel"], part="Body", segs=6, rot=(math.radians(-10), 0, 0))
    # Bulkhead behind the seat.
    a.box("Bulkhead", (sill_w * 2 - 0.2, 0.08, sill - floor + 0.1), (0, y_back, (sill + floor) / 2), z["cockpit"], part="Body")


def canopy(a: Asset, z, profile, base_z, y_bows, n=22, rear_frame=True):
    """Bubble canopy (separate ``Canopy`` part) with windscreen bow, rear bow and sill rails.

    ``profile`` = [(y, half width, height), ...] from windscreen base to the rear point.
    """
    ys = [p[0] for p in profile]
    fw = pchip(ys, [p[1] for p in profile])
    fh = pchip(ys, [p[2] for p in profile])

    def ring(y, grow=1.0, m=n):
        w, h = fw(y) * grow, fh(y) * grow
        pts = []
        for i in range(m):
            ang = math.pi * i / (m - 1)
            c, s = math.cos(ang), math.sin(ang)
            pts.append((w * math.copysign(abs(c) ** (2 / 2.3), c), y, base_z(y) + h * abs(s) ** (2 / 2.3)))
        return pts

    def closed(y, grow, m):
        pts = ring(y, grow, m)
        w = fw(y) * grow
        return pts + [(-w * 0.9, y, base_z(y) - 0.1), (w * 0.9, y, base_z(y) - 0.1)]

    y0, y1 = ys[0], ys[-1]
    samples = [y0 + (y1 - y0) * (1 - math.cos(math.pi * i / 16)) / 2 for i in range(17)]
    rings = [ring(y) for y in samples]
    # Open shell (no floor across the cockpit), faces turned away from the canopy axis.
    glass_obj = a.loft("Canopy glass", rings, z["glass"], part="Canopy", closed=False, smooth=70)
    me = glass_obj.data
    for poly in me.polygons:
        c = poly.center
        if poly.normal.dot(Vector((c.x, 0, c.z - base_z(c.y)))) < 0:
            poly.flip()
    me.update()
    for k, y in enumerate(y_bows):
        a.loft(f"Canopy bow {k}", [closed(y - 0.07, 1.035, 14), closed(y + 0.07, 1.035, 14)], z["frame"], part="Body", smooth=40)
    for s in (-1, 1):
        rail = []
        for y in samples[1:-1]:
            cx, cz = s * fw(y) * 1.0, base_z(y) + 0.015
            rail.append([(cx + 0.055 * math.cos(t), y, cz + 0.045 * math.sin(t)) for t in (k * math.tau / 6 for k in range(6))])
        a.loft(f"Canopy sill {s}", rail, z["frame"], part="Body", smooth=70)
    return fw, fh


def light_strip(a: Asset, name, z, surf, y0, y1, u0, u1):
    return conform_patch(a, name, z["light"], surf, y0, y1, u0, u1, lift=0.012, depth=0.02, nu=1, nv=2)


# --------------------------------------------------------------------------
# Kestrel v2: twin-engine air-superiority fighter


KESTREL_KEYS = [
    # y, [top, shoulder, upper-chine, chine, lower side, bottom, keel]
    (-12.4, [(0, -0.12)] * 7),
    (-12.0, [(0, 0.12), (0.12, 0.1), (0.21, 0.02), (0.26, -0.1), (0.22, -0.22), (0.11, -0.3), (0, -0.33)]),
    (-11.0, [(0, 0.46), (0.3, 0.41), (0.54, 0.18), (0.68, -0.1), (0.57, -0.4), (0.3, -0.6), (0, -0.64)]),
    (-9.6, [(0, 0.76), (0.44, 0.68), (0.84, 0.3), (1.04, -0.06), (0.86, -0.46), (0.5, -0.82), (0, -0.88)]),
    (-8.6, [(0, 0.86), (0.54, 0.84), (0.98, 0.42), (1.24, -0.04), (0.98, -0.5), (0.6, -0.9), (0, -0.96)]),
    (-7.7, [(0, 0.6), (0.64, 0.88), (1.08, 0.46), (1.4, -0.01), (1.0, -0.46), (0.66, -0.93), (0, -0.99)]),
    (-5.6, [(0, 0.5), (0.66, 0.9), (1.3, 0.5), (1.95, 0.04), (0.98, -0.2), (0.86, -0.94), (0, -1.02)]),
    (-4.2, [(0, 0.56), (0.66, 0.92), (1.5, 0.47), (2.35, 0.07), (0.98, -0.2), (0.86, -0.97), (0, -1.05)]),
    (-3.5, [(0, 0.95), (0.66, 0.96), (1.6, 0.45), (2.55, 0.08), (0.98, -0.2), (0.86, -0.98), (0, -1.06)]),
    (-2.2, [(0, 1.16), (0.68, 1.06), (1.85, 0.42), (2.85, 0.1), (2.28, -0.3), (2.02, -1.26), (0, -1.12)]),
    (-0.6, [(0, 1.16), (0.7, 1.05), (1.95, 0.42), (3.0, 0.1), (2.36, -0.34), (2.05, -1.28), (0, -1.1)]),
    (2.5, [(0, 1.06), (0.7, 0.98), (1.95, 0.4), (3.0, 0.08), (2.3, -0.38), (1.85, -1.18), (0, -0.98)]),
    (5.5, [(0, 0.94), (0.65, 0.88), (1.85, 0.38), (2.75, 0.06), (2.08, -0.38), (1.15, -1.02), (0, -0.74)]),
    (8.2, [(0, 0.78), (0.55, 0.74), (1.6, 0.36), (2.15, 0.04), (1.95, -0.38), (1.0, -0.86), (0, -0.56)]),
    (10.3, [(0, 0.5), (0.45, 0.5), (1.45, 0.42), (1.78, 0.04), (1.76, -0.4), (0.98, -0.66), (0, -0.42)]),
    (11.3, [(0, 0.38), (0.45, 0.38), (1.42, 0.37), (1.7, 0.02), (1.69, -0.36), (0.98, -0.52), (0, -0.34)]),
]
# Deeper belly: the lower half of every section is 12% deeper than authored above.
KESTREL_KEYS = [(y, [(x, z * 1.12 if z < 0 else z) for x, z in pts]) for y, pts in KESTREL_KEYS]
KESTREL_COUNTS = [5, 4, 4, 4, 4, 4]
KESTREL_INTAKE = dict(y=-5.2, cx=1.72, cz=-0.62, depth=1.75)


def kestrel_paint(kind="base"):
    s = KESTREL_INTAKE
    return skin(dict(
        upper="#858e97", lower="#a6aeb5", camo=("#5b646d",), camo_kind="soft", camo_scale=0.15,
        radome="#646a70", radome_y=-9.7, antiglare=(-9.7, -8.55), antiglare_w=0.62,
        body_x=2.7, wing_root=3.0, wing_tan=0.84,
        frames=[-9.7, -8.55, -3.5, -2.0, -0.4, 1.4, 3.3, 5.1, 6.9, 8.4, 9.6],
        longerons_z=[0.42, -0.25, -0.75],
        longerons_x=[0.55, 1.35, 2.05],
        ribs=[4.4, 6.35, 8.4, 10.3],
        spars=[0.15, 2.0, 4.6],
        panels=[("side", -7.6, -6.6, -0.55, -0.1), ("side", 0.2, 1.2, -0.95, -0.5), ("side", 3.6, 4.8, -0.85, -0.45),
                ("side", 6.2, 7.6, -0.7, -0.2), ("top", -1.5, -0.6, 0.0, 0.5), ("top", 1.8, 2.9, 0.75, 1.5),
                ("top", 6.0, 6.9, 0.0, 0.42), ("top", 0.5, 2.6, 4.0, 5.4), ("top", 2.2, 3.3, 6.6, 7.6),
                ("bottom", -6.6, -5.6, 0.0, 0.55), ("bottom", 4.2, 5.6, 1.2, 1.7), ("bottom", 0.8, 2.6, 4.2, 5.8)],
        intakes=[(s["cx"], s["y"], s["cz"])], intake_r=1.9, cockpit=(-8.2, -3.95, 0.66),
        soot=(8.6, 1.0), rough=0.5, metal=0.05,
    ))


@builder("kestrel-v2")
def kestrel_v2():
    a = Asset("kestrel-v2", "Kestrel player fighter (v2)", texture=1024, kind="aircraft", tri_limit=15000,
              bump_distance=0.01, seed=201, target_length=KESTREL_LENGTH, weighted_normals=True, glass_parts=("Canopy",),
              usage="Player aircraft (JetFactory.Create, menu display jet, parked jets); preferred over v1 when uploaded.")
    ik = KESTREL_INTAKE
    z = zones_common(a, kestrel_paint(), "#4b5157", (0.98, -0.1), 12.45, 2.6, ik["y"], ik["depth"], (ik["cx"] - 0.2, ik["cz"] + 0.05))
    paint = z["paint"]
    a.metadata["pivots"], a.metadata["hinges"] = {}, {}
    body = Body(KESTREL_KEYS, sharp=[3], counts=KESTREL_COUNTS)
    ys = stations(-12.4, 11.3, [(-11.6, 0.2), (-9.0, 0.4), (-2.0, 0.45), (11.3, 0.55)])
    build_body(a, "Fuselage", body, paint, ys)

    # Probes: nose pitot with a mast, two angle-of-attack vanes, total-temperature probe.
    a.cyl("Pitot", 0.035, 1.0, (0, -12.85, -0.12), z["probe"], part="Body", segs=6, rot=(math.radians(90), 0, 0))
    a.cyl("Pitot base", 0.07, 0.3, (0, -12.35, -0.12), z["probe"], part="Body", segs=8, r2=0.035, rot=(math.radians(90), 0, 0))
    for s in (-1, 1):
        a.box(f"AoA vane {s}", (0.02, 0.22, 0.08), (s * 0.82, -10.2, 0.05), z["probe"], part="Body", rot=(0, 0, s * 0.15))
    a.cyl("Temp probe", 0.025, 0.18, (0.35, -10.6, -0.62), z["probe"], part="Body", segs=6, rot=(math.radians(20), 0, 0))

    # Cockpit and bubble canopy.
    sill = 0.9
    cockpit(a, z, -8.2, -5.0, 0.52, sill, 0.62, -3.95)
    canopy(a, z, [(-8.75, 0.08, 0.04), (-8.25, 0.5, 0.45), (-7.4, 0.66, 0.82), (-6.3, 0.7, 1.0), (-5.2, 0.68, 0.96),
                  (-4.2, 0.6, 0.78), (-3.3, 0.42, 0.48), (-2.55, 0.12, 0.14)],
           lambda y: sill if y < -4.0 else sill + (y + 4.0) * 0.16, (-7.65, -3.85))

    # Spine: refuelling receptacle door, antennas, formation lights.
    conform_patch(a, "Refuel door", paint, upper_surface(body, 1), -1.7, -0.7, 0.0, 0.3, lift=0.018, depth=0.03, nu=2, nv=2)
    conform_patch(a, "Refuel door L", paint, upper_surface(body, -1), -1.7, -0.7, 0.0, 0.3, lift=0.018, depth=0.03, nu=2, nv=2)
    blade(a, "Spine blade", z["rail"], 0.0, 2.6, body.z_upper(2.6, 0.0) - 0.04, 0.42, 0.55, 0.5)
    blade(a, "Spine blade aft", z["rail"], 0.0, 6.6, body.z_upper(6.6, 0.0) - 0.04, 0.26, 0.4, 0.4)
    blade(a, "Belly blade", z["rail"], 0.0, -1.2, body.z_lower(-1.2, 0.0) + 0.04, -0.34, 0.45, -0.5)
    blade(a, "Nose blade", z["rail"], 0.0, -7.9, body.z_lower(-7.9, 0.0) + 0.04, -0.22, 0.3, -0.4)

    # Intakes: caret mouths under the chines, splitter plates, diverter gap and ducts.
    def mouth(scale):
        return trapezoid(ik["cx"], ik["cz"], 0.98 * scale, 0.82 * scale, 0.58 * scale, skew=0.1 * scale)

    for side, tag in ((1, "R"), (-1, "L")):
        obj, centre = intake(a, f"Intake {tag}", (paint, z["duct"], z["fan"], z["probe"]), mouth, ik["y"],
                             lambda x, zz: 0.42 * (x - 1.25) - 0.25 * (zz + 0.62), side=side, cowl_len=3.6,
                             depth=ik["depth"], duct_shift=(-0.2, 0.05), spinner=False)
        # Splitter plate standing off the forebody, ahead of the mouth.
        plate = [(ik["y"] - 0.45, -0.18), (ik["y"] + 1.3, -0.12), (ik["y"] + 1.3, -1.2), (ik["y"] + 0.2, -1.22), (ik["y"] - 0.45, -0.95)]
        a.prism(f"Splitter {tag}", plate, side * 1.1 - 0.025, side * 1.1 + 0.025, paint, part="Body", axis="x")
        for k, yy in enumerate((ik["y"] + 0.5, ik["y"] + 1.1)):
            a.box(f"Diverter strut {tag} {k}", (0.18, 0.06, 0.06), (side * 1.02, yy, -0.4 - 0.4 * k), paint, part="Body")

    # Wings: 40 degree trapezoid, ailerons outboard, wingtip launch rails, pylons with two missiles each.
    root_x, tip_x = 2.4, 10.9

    def le(s):
        return -1.5 + (s - 3.0) * 0.84

    def te(s):
        return 6.4 + (s - 3.0) * 0.05

    def chord(s):
        return te(s) - le(s)

    tc = lambda s: 0.055 - 0.025 * (s - root_x) / (tip_x - root_x)
    for side, tag in ((-1, "L"), (1, "R")):
        f = wing_frame(0.06, side, math.radians(-2.5))
        surface(a, f"Wing in {tag}", paint, "Body", f, [root_x, 3.4, 4.8, 6.4], le, chord, tc, samples=11)
        # The fixed panel and the aileron share the hinge fraction: no see-through slot.
        surface(a, f"Wing mid {tag}", paint, "Body", f, [6.4, 8.4, 10.3], le, chord, tc, 0.0, 0.78, samples=10)
        surface(a, f"Wing tip {tag}", paint, "Body", f, [10.3, tip_x], le, chord, tc, samples=10)
        surface(a, f"Aileron {tag}", paint, f"Aileron_{tag}", f, [6.45, 8.4, 10.25], le, chord, tc, 0.78, 1.0, samples=5)
        h0, h1 = hinge_point(f, le, chord, 6.45, 0.78), hinge_point(f, le, chord, 10.25, 0.78)
        a.metadata["pivots"][f"Aileron_{tag}"] = tuple((h0 + h1) / 2)
        a.metadata["hinges"][f"Aileron_{tag}"] = (tuple(h0), tuple(h1))
        tip = Vector(f(tip_x + 0.1, le(tip_x), 0))
        a.box(f"Tip rail {tag}", (0.14, 2.8, 0.18), (tip.x, le(tip_x) + 1.1, tip.z), z["rail"], part="Body", bevel=0.03)
        a.box(f"Tip light {tag}", (0.05, 0.6, 0.06), (tip.x + side * 0.08, le(tip_x) + 1.0, tip.z + 0.1), z["light"], part="Body")
        a.metadata.setdefault("wingtips", {})[tag] = (tip.x, le(tip_x) + 2.4, tip.z)
        px = 5.6
        pylon_with_missiles(a, tag, (paint, z["rail"], z["missile"], z["seeker"], z["dark"]), side * px, le(px) + 0.7,
                            f(px, 0, 0)[2] - 0.03, side)

        # Twin canted fins, rudders on the lower trailing edge.
        ff = fin_frame(side * 1.5, 0.36, math.radians(22), side)
        fle = lambda s: 5.7 + s * 0.98
        fch = lambda s: 4.6 - s * 0.82
        surface(a, f"Fin low {tag}", paint, "Body", ff, [-0.3, 0.25], fle, fch, 0.055, samples=10)
        surface(a, f"Fin mid {tag}", paint, "Body", ff, [0.25, 1.4, 2.6], fle, fch, 0.055, 0.0, 0.7, samples=10)
        surface(a, f"Fin top {tag}", paint, "Body", ff, [2.6, 3.6], fle, fch, 0.055, samples=10)
        surface(a, f"Rudder {tag}", paint, f"Rudder_{tag}", ff, [0.27, 1.4, 2.58], fle, fch, 0.055, 0.72, 1.0, samples=5)
        r0, r1 = hinge_point(ff, fle, fch, 0.27, 0.72), hinge_point(ff, fle, fch, 2.58, 0.72)
        a.metadata["pivots"][f"Rudder_{tag}"] = tuple((r0 + r1) / 2)
        a.metadata["hinges"][f"Rudder_{tag}"] = (tuple(r0), tuple(r1))
        cap = Vector(ff(3.62, fle(3.6) + fch(3.6) * 0.5, 0))
        a.box(f"Fin cap {tag}", (0.09, fch(3.6) * 0.9, 0.08), tuple(cap), z["rail"], part="Body", rot=(0, side * math.radians(22), 0))
        lp = Vector(ff(2.0, fle(2.0) + 0.35, 0.0))
        a.box(f"Fin light {tag}", (0.03, 0.12, 0.9), tuple(lp + Vector((side * 0.03, 0, 0))), z["light"], part="Body",
              rot=(0, side * math.radians(22), 0))

        # All-moving stabilator on a spanwise spindle.
        sf = wing_frame(-0.02, side, math.radians(-3))
        sle = lambda s: 8.2 + (s - 1.95) * 0.78
        sch = lambda s: 3.5 - (s - 1.95) * 0.52
        surface(a, f"Stabilator {tag}", paint, f"Elevator_{tag}", sf, [1.95, 3.0, 4.4, 5.6], sle, sch, 0.045, samples=10)
        spindle = Vector(sf(2.0, 9.6, 0))
        a.metadata["pivots"][f"Elevator_{tag}"] = tuple(spindle)
        a.metadata["hinges"][f"Elevator_{tag}"] = (tuple(spindle), tuple(Vector(sf(3.0, 9.6, 0))))

        # Ventral fin and the 2D nozzle.
        vf = fin_frame(side * 1.55, -0.85, math.radians(160), side)
        surface(a, f"Ventral {tag}", paint, "Body", vf, [0.0, 0.75], lambda s: 6.6 + s * 0.9, lambda s: 2.4 - s * 1.0, 0.05, samples=6)
        flat_nozzle(a, f"Nozzle {tag}", (z["metal"], z["liner"], z["dark"]), side * 0.98, -0.1, 9.6, 12.45, 0.62, 0.43)

    # Flush gear doors: nose (pair) and mains under the ducts, standing proud of the skin.
    for s in (-1, 1):
        conform_patch(a, f"Nose door {s}", paint, lower_surface(body, s), -8.6, -6.4, 0.03, 0.34, lift=0.016)
        conform_patch(a, f"Main door {s}", paint, lower_surface(body, s), 0.4, 3.1, 1.05, 1.85, lift=0.016)
        conform_patch(a, f"Main door aft {s}", paint, lower_surface(body, s), 3.25, 4.2, 1.15, 1.75, lift=0.016)
        # Formation light strips: forward fuselage sides, under the cockpit.
        light_strip(a, f"Nose strip {s}", z, side_surface(body, s), -9.1, -8.3, -0.24, -0.18)
        light_strip(a, f"Aft strip {s}", z, side_surface(body, s), 7.6, 8.7, -0.16, -0.1)

    tips = a.metadata["wingtips"]
    attachments = {"leftWingtip": tips["L"], "rightWingtip": tips["R"], "exhaust": (0.0, 12.45, -0.1)}
    a.finish(origin="center", hinges=a.metadata["hinges"], attachments=attachments, extra_notes=CHECK_NOTES,
             closeup=((1.0, -5.8, 0.0), (1.0, -1.25, 0.55), 8.0))


# --------------------------------------------------------------------------
# Vanta v2: canard cranked-delta interceptor with widely spaced nacelles


VANTA_KEYS = [
    (-12.6, [(0, -0.06)] * 7),
    (-12.0, [(0, 0.16), (0.13, 0.14), (0.22, 0.05), (0.27, -0.07), (0.24, -0.2), (0.13, -0.29), (0, -0.32)]),
    (-10.8, [(0, 0.5), (0.32, 0.45), (0.56, 0.22), (0.66, -0.05), (0.6, -0.36), (0.34, -0.6), (0, -0.65)]),
    (-9.4, [(0, 0.82), (0.46, 0.76), (0.84, 0.38), (0.98, -0.02), (0.88, -0.45), (0.52, -0.82), (0, -0.88)]),
    (-8.3, [(0, 0.62), (0.6, 0.92), (1.02, 0.5), (1.26, 0.03), (1.04, -0.5), (0.64, -0.92), (0, -0.98)]),
    (-6.6, [(0, 0.5), (0.64, 0.94), (1.2, 0.56), (1.72, 0.1), (1.1, -0.42), (0.74, -0.95), (0, -1.02)]),
    (-4.6, [(0, 0.56), (0.66, 0.95), (1.45, 0.58), (2.3, 0.12), (1.2, -0.36), (0.78, -0.74), (0, -0.98)]),
    (-3.4, [(0, 0.98), (0.66, 0.98), (1.6, 0.58), (2.75, 0.12), (1.25, -0.38), (0.8, -0.74), (0, -0.98)]),
    (-1.5, [(0, 1.1), (0.68, 1.05), (1.75, 0.56), (3.1, 0.1), (1.25, -0.38), (0.8, -0.74), (0, -0.98)]),
    (-0.3, [(0, 1.12), (0.7, 1.06), (1.85, 0.55), (3.25, 0.08), (2.42, -0.72), (1.78, -1.66), (0, -1.02)]),
    (1.6, [(0, 1.06), (0.68, 1.02), (1.85, 0.52), (3.2, 0.06), (2.42, -0.72), (1.76, -1.64), (0, -1.0)]),
    (5.0, [(0, 0.94), (0.62, 0.92), (1.9, 0.46), (3.0, 0.04), (2.36, -0.62), (1.66, -1.45), (0, -0.8)]),
    (8.2, [(0, 0.78), (0.55, 0.76), (1.8, 0.38), (2.55, 0.02), (2.26, -0.5), (1.6, -1.2), (0, -0.55)]),
    (10.0, [(0, 0.55), (0.45, 0.52), (1.6, 0.3), (2.2, 0.0), (2.12, -0.4), (1.56, -1.02), (0, -0.4)]),
    (11.0, [(0, 0.35), (0.4, 0.33), (1.45, 0.2), (2.06, -0.02), (2.06, -0.42), (1.55, -0.98), (0, -0.32)]),
]
VANTA_INTAKE = dict(y=-3.4, cx=1.52, cz=-1.0, depth=1.8)
VANTA_TE = 8.9


def vanta_paint(livery="base"):
    s = VANTA_INTAKE

    def fin_tip(n, x, y, z, nx, ny, nz):
        return n.mul(n.smooth(z, 4.75, 4.85), n.smooth(n.absf(x), 0.4, 0.15))

    def canard_tip(n, x, y, z, nx, ny, nz):
        return n.mul(n.mul(n.smooth(n.absf(x), 3.85, 4.0), n.band(y, -6.0, -2.4, 0.05)), n.smooth(z, 0.25, 0.35))

    common = dict(
        camo_kind="splinter", camo_scale=0.4, radome_y=-9.9, antiglare=(-9.9, -9.15), antiglare_w=0.6,
        body_x=2.9, wing_root=3.2, wing_tan=1.0,
        frames=[-9.9, -9.15, -3.5, -1.8, 0.0, 1.9, 3.7, 5.5, 7.2, 8.8, 10.2],
        longerons_z=[0.4, -0.3, -0.95],
        longerons_x=[0.6, 1.4, 2.2],
        ribs=[4.6, 5.8, 7.6, 9.6, 11.2],
        spars=[0.6, 2.6, 4.6],
        panels=[("side", -8.0, -6.9, -0.6, -0.15), ("side", 1.0, 2.3, -1.3, -0.85), ("side", 4.0, 5.2, -1.2, -0.75),
                ("side", 6.6, 7.8, -0.9, -0.45), ("top", -1.1, -0.1, 0.0, 0.5), ("top", 2.0, 3.1, 0.8, 1.55),
                ("top", 6.2, 7.0, 0.0, 0.45), ("top", 1.0, 3.2, 4.4, 5.8), ("top", 3.2, 4.4, 8.0, 9.2),
                ("bottom", -7.4, -6.4, 0.0, 0.55), ("bottom", 3.4, 5.0, 1.3, 1.9), ("bottom", 1.6, 3.4, 4.6, 6.2)],
        intakes=[(s["cx"], s["y"], s["cz"])], intake_r=2.0, cockpit=(-8.9, -4.2, 0.64),
        soot=(9.0, 1.55), metal=0.06,
    )
    if livery == "base":
        return skin(dict(common, upper="#4a5159", lower="#6c757e", camo=("#373d44", "#59616a", "#2a2f35"),
                         radome="#2a2e33", accent="#6e2a24", accent_masks=(fin_tip, canard_tip), rough=0.55))
    if livery == "vulture":
        def feathers(n, col, x, y, z, nx, ny, nz):
            # Muted bone trailing-edge band on the outer wings with a soft, gently waving
            # forward boundary (feather tips). A smooth sine, not cusps or arches, so it reads
            # as a camouflage edge rather than a row of shapes.
            ax = n.absf(x)
            wave = n.math("COSINE", n.mul(ax, math.tau / 0.9))
            edge = n.sub(VANTA_TE - 0.75, n.mul(n.add(wave, 1.0), 0.16))
            mask = n.mul(n.mul(n.smooth(y, n.sub(edge, 0.12), n.add(edge, 0.12)), n.smooth(ax, 4.0, 4.6)), n.smooth(nz, 0.2, 0.45))
            return n.vlerp(col, srgb("#625e54"), n.mul(mask, 0.75))

        return skin(dict(common, upper="#25272b", lower="#3a3d42", camo=("#1b1c1f", "#2f3236"), radome="#18191b",
                         accent="#8d8574", accent_masks=(fin_tip,), extra=feathers, rough=0.6))
    if livery == "rusk":
        def pinstripe(n, col, x, y, z, nx, ny, nz):
            side = n.smooth(n.absf(nx), 0.55, 0.75)
            stripe = n.mul(n.mul(n.band(z, 0.16, 0.22, 0.01), side), n.band(y, -9.6, 9.6, 0.1))
            return n.vlerp(col, srgb("#a08440"), stripe)

        return skin(dict(common, upper="#3f1f1f", lower="#33363a", camo=("#2d1617", "#4a2321"), radome="#25100f",
                         accent="#a08440", accent_masks=(fin_tip,), extra=pinstripe, rough=0.42, metal=0.12))
    if livery == "elite":
        # Mission 5 elite squadron (vanta-v2-elite, built by m04_m05_assets.py): blue-black with the
        # whole fin and rudder in pale steel blue and one straight chordwise band across each outer
        # wing. Plain colour fields only: no emblem, chevron, numeral-like mark or text. (A pale
        # fin-tip block over the dark fin met the light rudder-hinge gap in a shape like a "7".)
        def fin_field(n, x, y, z, nx, ny, nz):
            return n.mul(n.smooth(z, 1.15, 1.3), n.mul(n.smooth(n.absf(x), 0.45, 0.3), n.smooth(y, 3.6, 4.0)))

        def wing_band(n, x, y, z, nx, ny, nz):
            return n.mul(n.band(n.absf(x), 9.3, 10.3, 0.03), n.smooth(n.absf(nz), 0.3, 0.5))

        def aft_metal(n, col, x, y, z, nx, ny, nz):
            # Bare mid-grey metal on the flat aft end and the lower aft skin around the nozzles,
            # close to the nozzle metal, so from behind there is no dark band behind the nozzles and
            # no separate pale curve under them (no soot either).
            end = n.mul(n.smooth(ny, 0.5, 0.8), n.smooth(y, 10.7, 10.9))
            lower = n.mul(n.mul(n.smooth(y, 9.9, 10.3), n.smooth(nz, 0.1, -0.2)), n.smooth(n.absf(x), 2.3, 2.0))
            return n.vlerp(col, srgb("#6b6e70"), n.maxf(end, lower))

        return skin(dict(common, upper="#1d222b", lower="#2b313b", camo=("#151920", "#262c36"), radome="#14171c",
                         accent="#7f97a8", accent_masks=(fin_field, wing_band), extra=aft_metal, soot=(60.0, 1.55),
                         rough=0.5, metal=0.08))
    raise ValueError(livery)


def vanta_v2_airframe(name="vanta-v2", title="Vanta enemy interceptor (v2)", paint=None, export_version=None,
                      usage="Enemy bandits and raiders (JetFactory.Create enemy=true); preferred over v1 when uploaded.",
                      plain_rear=False):
    """The Vanta v2 mesh with its zones, ready for ``finish()``; returns (asset, attachments).

    ``vanta-v2`` passes the defaults. A livery built as its own folder (``vanta-v2-elite``)
    passes its name, paint and export version: the geometry, seed and scale are the same, so
    the mesh is the Vanta v2 mesh and only the paint zone differs.

    ``plain_rear=True`` is elite-only: a shared rectangular thrust-vectoring exhaust,
    flat aft belly and no ventral strakes or tail boom. Defaults preserve the uploaded mesh.
    """
    a = Asset(name, title, texture=1024, kind="aircraft", tri_limit=15000,
              bump_distance=0.01, seed=202, target_length=VANTA_LENGTH, weighted_normals=True, glass_parts=("Canopy",),
              usage=usage, export_version=export_version)
    ik = VANTA_INTAKE
    z = zones_common(a, paint or vanta_paint("base"), "#2f3338", (1.55, -0.4), 12.5, 2.6, ik["y"], ik["depth"], (ik["cx"], ik["cz"] + 0.15))
    paint = z["paint"]
    if plain_rear:
        z["nozzle_inner"] = a.zone("nozzle_inner", standard("#8e8b84", 0.55, 0.3, grime=0.1, ao=0.2, ao_dist=0.4))
    a.metadata["pivots"], a.metadata["hinges"] = {}, {}
    # Lower the centre to the nacelle keel: no rising bridge in the aft silhouette.
    keys = [(y, [(x, min(zz, pts[-2][1])) if i == 6 and y >= 5.0 else (x, zz)
                  for i, (x, zz) in enumerate(pts)]) for y, pts in VANTA_KEYS] if plain_rear else VANTA_KEYS
    body = Body(keys, sharp=[3], counts=KESTREL_COUNTS)
    ys = stations(-12.6, 11.0, [(-11.8, 0.2), (-9.2, 0.4), (-1.0, 0.45), (11.0, 0.55)])
    build_body(a, "Fuselage", body, paint, ys)

    # Probes: long nose boom, AoA vanes, infrared sensor ball ahead of the windscreen, refuelling probe.
    a.cyl("Pitot", 0.04, 1.2, (0, -13.0, -0.06), z["probe"], part="Body", segs=6, rot=(math.radians(90), 0, 0))
    a.cyl("Pitot base", 0.08, 0.35, (0, -12.5, -0.06), z["probe"], part="Body", segs=8, r2=0.04, rot=(math.radians(90), 0, 0))
    for s in (-1, 1):
        a.box(f"AoA vane {s}", (0.02, 0.22, 0.08), (s * 0.8, -10.4, 0.0), z["probe"], part="Body", rot=(0, 0, s * 0.15))
    a.sphere("Sensor ball", 0.16, (0.3, -9.55, body.z_upper(-9.55, 0.3) + 0.04), z["seeker"], part="Body", subdiv=2)
    a.cyl("Sensor base", 0.17, 0.12, (0.3, -9.55, body.z_upper(-9.55, 0.3) - 0.02), z["frame"], part="Body", segs=12)
    probe = [(-0.78, -7.6, 0.66), (-0.74, -8.8, 0.74), (-0.6, -10.3, 0.86)]
    a.beam("Refuel probe fairing", (-0.8, -7.4, 0.62), (-0.76, -8.6, 0.7), 0.16, paint, part="Body", segs=8)
    for i in range(len(probe) - 1):
        a.beam(f"Refuel probe {i}", probe[i], probe[i + 1], 0.07, z["probe"], part="Body", segs=8)
    a.cyl("Refuel nozzle", 0.06, 0.18, (-0.6, -10.38, 0.86), z["dark"], part="Body", segs=8, r2=0.03, rot=(math.radians(90), 0, 0))

    # Cockpit and canopy (heavier frame: windscreen bow plus a mid bow).
    sill = 0.94
    cockpit(a, z, -8.9, -5.7, 0.52, sill, 0.62, -4.25)
    canopy(a, z, [(-9.35, 0.08, 0.04), (-8.85, 0.5, 0.42), (-8.0, 0.64, 0.78), (-6.9, 0.68, 0.94), (-5.8, 0.66, 0.92),
                  (-4.8, 0.58, 0.74), (-3.9, 0.4, 0.44), (-3.15, 0.1, 0.12)],
           lambda y: sill if y < -4.6 else sill + (y + 4.6) * 0.1, (-8.3, -6.0, -4.3))

    # Spine and belly antennas.
    blade(a, "Spine blade", z["rail"], 0.0, 1.8, body.z_upper(1.8, 0.0) - 0.04, 0.45, 0.6, 0.5)
    blade(a, "Spine blade aft", z["rail"], 0.0, 3.6, body.z_upper(3.6, 0.0) - 0.04, 0.24, 0.4, 0.4)
    blade(a, "Belly blade", z["rail"], 0.0, 0.6, body.z_lower(0.6, 0.0) + 0.04, -0.32, 0.45, -0.5)
    blade(a, "Nose blade", z["rail"], 0.0, -8.4, body.z_lower(-8.4, 0.0) + 0.04, -0.22, 0.3, -0.4)

    # Ventral intakes under the extensions: raked mouths, horizontal splitter plates, ducts.
    def mouth(scale):
        return rounded_rect(ik["cx"], ik["cz"], 0.56 * scale, 0.44 * scale, 24, 6.0)

    for side, tag in ((1, "R"), (-1, "L")):
        intake(a, f"Intake {tag}", (paint, z["duct"], z["fan"], z["probe"]), mouth, ik["y"],
               lambda x, zz: -0.45 * (zz + 1.0) + 0.1 * (x - 1.52), side=side, cowl_len=3.4, depth=ik["depth"],
               duct_shift=(0.0, 0.18), spinner=False)
        plate = [(1.0, ik["y"] - 0.5), (2.04, ik["y"] - 0.5), (2.04, ik["y"] + 1.0), (1.0, ik["y"] + 1.0)]
        a.prism(f"Splitter {tag}", [(side * u, v) for u, v in plate], -0.52, -0.48, paint, part="Body")
        for k, xx in enumerate((1.2, 1.85)):
            a.box(f"Diverter strut {tag} {k}", (0.05, 0.5, 0.12), (side * xx, ik["y"] + 0.4, -0.42), paint, part="Body")

    # Cranked delta: inner panel 49 deg, dogtooth at the crank, outer panel 42 deg, elevons outboard.
    root_x, crank_x, tip_x = 2.6, 5.8, 12.0

    def le_in(s):
        return -0.6 + (s - 3.2) * 1.15

    def le_out(s):
        return le_in(crank_x) - 0.28 + (s - crank_x) * 0.9

    def chord_in(s):
        return VANTA_TE - le_in(s)

    def chord_out(s):
        return VANTA_TE - le_out(s)

    tc = lambda s: 0.045 - 0.018 * (s - root_x) / (tip_x - root_x)
    for side, tag in ((-1, "L"), (1, "R")):
        f = wing_frame(-0.02, side, math.radians(-2.5))
        surface(a, f"Wing in {tag}", paint, "Body", f, [root_x, 3.6, 4.7, crank_x], le_in, chord_in, tc, samples=11)
        surface(a, f"Wing out {tag}", paint, "Body", f, [crank_x, 7.4, 9.4, 11.4], le_out, chord_out, tc, 0.0, 0.82, samples=10)
        surface(a, f"Wing tip {tag}", paint, "Body", f, [11.4, tip_x], le_out, chord_out, tc, samples=10)
        surface(a, f"Elevon {tag}", paint, f"Aileron_{tag}", f, [crank_x + 0.05, 7.4, 9.4, 11.35], le_out, chord_out, tc, 0.82, 1.0, samples=5)
        h0, h1 = hinge_point(f, le_out, chord_out, crank_x + 0.05, 0.82), hinge_point(f, le_out, chord_out, 11.35, 0.82)
        a.metadata["pivots"][f"Aileron_{tag}"] = tuple((h0 + h1) / 2)
        a.metadata["hinges"][f"Aileron_{tag}"] = (tuple(h0), tuple(h1))
        tip = Vector(f(tip_x + 0.1, le_out(tip_x), 0))
        a.box(f"Tip rail {tag}", (0.14, 2.2, 0.18), (tip.x, le_out(tip_x) + 0.7, tip.z), z["rail"], part="Body", bevel=0.03)
        a.box(f"Tip light {tag}", (0.05, 0.5, 0.06), (tip.x + side * 0.08, le_out(tip_x) + 0.6, tip.z + 0.1), z["light"], part="Body")
        a.metadata.setdefault("wingtips", {})[tag] = (tip.x, le_out(tip_x) + 1.6, tip.z)
        # Wing fence just outboard of the dogtooth.
        fx = crank_x + 0.25
        fz = f(fx, 0, 0)[2]
        fence = [(le_out(fx) + 0.1, fz + 0.03), (le_out(fx) + 0.7, fz + 0.2), (le_out(fx) + chord_out(fx) * 0.7, fz + 0.16),
                 (le_out(fx) + chord_out(fx) * 0.75, fz), (le_out(fx) - 0.05, fz - 0.04)]
        a.prism(f"Fence {tag}", fence, side * fx - 0.02, side * fx + 0.02, paint, part="Body", axis="x")
        for k, px in enumerate((4.7, 8.1)):
            le_p = le_in(px) if px < crank_x else le_out(px)
            pylon_with_missiles(a, f"{tag}{k}", (paint, z["rail"], z["missile"], z["seeker"], z["dark"]), side * px,
                                le_p + 0.6, f(px, 0, 0)[2] - 0.02, side)

        # Canard foreplanes (pitch) on the extensions.
        cf = wing_frame(0.5, side, math.radians(3))
        cle = lambda s: -6.8 + (s - 1.25) * 1.0
        cch = lambda s: 2.4 - (s - 1.25) * 0.45
        surface(a, f"Canard {tag}", paint, f"Elevator_{tag}", cf, [1.25, 2.4, 3.4, 4.3], cle, cch, 0.05, samples=10)
        sp = Vector(cf(1.3, -5.85, 0))
        a.metadata["pivots"][f"Elevator_{tag}"] = tuple(sp)
        a.metadata["hinges"][f"Elevator_{tag}"] = (tuple(sp), tuple(Vector(cf(2.3, -5.85, 0))))

        # The uploaded default keeps its ventral strakes and round nozzles.
        if not plain_rear:
            vf = fin_frame(side * 1.75, -1.2, math.radians(158), side)
            surface(a, f"Strake {tag}", paint, "Body", vf, [0.0, 0.8], lambda s: 6.0 + s * 0.9, lambda s: 2.6 - s * 1.0, 0.05, samples=6)
            round_nozzle(a, f"Nozzle {tag}", (z["metal"], z["liner"], z["dark"]), side * 1.55, -0.4, 9.9, 12.5, 0.52)

    if plain_rear:
        # One continuous wide, shallow exit, with no dividing bar, circles or vanes.
        # Solid grey backplate closes the exit; short straight lips suggest vectoring paddles.
        a.box("Shared exhaust fairing", (4.24, 1.6, 0.72), (0, 11.6, -0.56), z["metal"], part="Body")
        a.box("Plain continuous exhaust exit", (4.04, 0.08, 0.44), (0, 12.42, -0.56), z["nozzle_inner"], part="Body")
        for zz in (-0.87, -0.25):
            a.box("Vectoring lip", (4.24, 0.3, 0.1), (0, 12.35, zz), z["metal"], part="Body")

    # Single swept fin with rudder, dielectric cap.
    ff = fin_frame(0.0, 0.8, 0.0, 1)
    fle = lambda s: 4.6 + s * 1.05
    fch = lambda s: 6.0 - s * 0.95
    surface(a, "Fin low", paint, "Body", ff, [-0.3, 0.55], fle, fch, 0.05, samples=10)
    surface(a, "Fin mid", paint, "Body", ff, [0.55, 2.0, 3.65], fle, fch, 0.05, 0.0, 0.7, samples=10)
    surface(a, "Fin top", paint, "Body", ff, [3.65, 4.4], fle, fch, 0.05, samples=10)
    surface(a, "Rudder", paint, "Rudder", ff, [0.57, 2.0, 3.63], fle, fch, 0.05, 0.72, 1.0, samples=5)
    r0, r1 = hinge_point(ff, fle, fch, 0.57, 0.72), hinge_point(ff, fle, fch, 3.63, 0.72)
    a.metadata["pivots"]["Rudder"] = tuple((r0 + r1) / 2)
    a.metadata["hinges"]["Rudder"] = (tuple(r0), tuple(r1))
    a.box("Fin cap", (0.1, fch(4.4) * 0.9, 0.1), (0, fle(4.4) + fch(4.4) * 0.5, 0.8 + 4.44), z["rail"], part="Body")
    a.box("Fin light", (0.03, 0.12, 0.9), (0.04, fle(2.4) + 0.4, 0.8 + 2.4), z["light"], part="Body")
    a.box("Fin light L", (0.03, 0.12, 0.9), (-0.04, fle(2.4) + 0.4, 0.8 + 2.4), z["light"], part="Body")

    # Tail boom between the nacelles (none on the plain rear: the aft face stays clear).
    if not plain_rear:
        boom = []
        for y, r, zc in ((10.2, 0.34, 0.0), (11.0, 0.3, 0.0), (11.9, 0.22, 0.02), (12.35, 0.14, 0.04)):
            boom.append([(r * math.cos(t), y, zc + r * 0.9 * math.sin(t)) for t in (k * math.tau / 12 for k in range(12))])
        obj = a.loft("Tail boom", boom, paint, part="Body", cap_start=False, smooth=50)
        a.assign(obj, range(len(obj.data.polygons) - 12, len(obj.data.polygons)), z["dark"])

    # Flush gear doors, formation light strips.
    for s in (-1, 1):
        conform_patch(a, f"Nose door {s}", paint, lower_surface(body, s), -8.9, -6.8, 0.03, 0.34, lift=0.016)
        conform_patch(a, f"Main door {s}", paint, lower_surface(body, s), 0.6, 3.4, 1.25, 2.05, lift=0.016)
        light_strip(a, f"Nose strip {s}", z, side_surface(body, s), -9.6, -8.8, -0.26, -0.2)
        light_strip(a, f"Aft strip {s}", z, side_surface(body, s), 7.8, 8.9, -0.2, -0.14)

    tips = a.metadata["wingtips"]
    attachments = {"leftWingtip": tips["L"], "rightWingtip": tips["R"], "exhaust": (0.0, 12.5, -0.4)}
    return a, attachments


VANTA_CLOSEUP = ((1.0, -5.2, -0.2), (1.0, -1.3, 0.45), 8.5)


@builder("vanta-v2")
def vanta_v2():
    a, attachments = vanta_v2_airframe()
    liveries = [
        {"name": "vulture", "title": "Vanta ace livery: Vulture flight (v2)", "zones": {"paint": vanta_paint("vulture")},
         "usage": "Vulture Lead and Vulture Two aces (M11 and M15 ace phases); preferred over v1 when uploaded."},
        {"name": "rusk", "title": "Vanta ace livery: Air Marshal Rusk (v2)", "zones": {"paint": vanta_paint("rusk")},
         "usage": "Air Marshal Rusk final ace (M27 ace phase); preferred over v1 when uploaded."},
    ]
    a.finish(origin="center", hinges=a.metadata["hinges"], attachments=attachments, liveries=liveries,
             extra_notes=CHECK_NOTES, closeup=VANTA_CLOSEUP)
