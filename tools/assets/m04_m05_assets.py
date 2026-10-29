"""Mission 4 and 5 upload assets: heavy transport, radar jammer, fuel tanker, attack helicopter
and the elite squadron livery of the Vanta v2.

    tools/assets/build-all.sh heavy-transport radar-jammer fuel-tanker attack-helicopter vanta-v2-elite

All are original designs (D-001): no copy of any specific real or game aircraft, ship or
helicopter, and no text, numbers, insignia, flags, logos or glyph-like marks. Markings are
plain straight-edged colour bands only.

* ``heavy-transport``: mission 4's three required targets. Four podded turbofans under a
  high, lightly swept wing with anhedral; a cruciform tail (tailplanes part-way up the fin);
  flat-sided fuselage with an upswept tail and a closed cargo ramp drawn as panel lines.
  Unarmed. 72 studs span, Vanta-family paint.
* ``radar-jammer``: mission 4's two optional jammers. Low-wing twin-turbofan airframe with a
  T-tail and a lens-shaped rotodome on a single swept pylon, wingtip pods and blade
  antennas. Unarmed. 59.3 studs span over the tip pods, Vanta-family paint.
* ``fuel-tanker``: mission 5's two ships at sea. Medium tanker with the deckhouse and funnel
  aft, a raised forecastle, longitudinal cargo pipes, a midships manifold, a raised catwalk,
  tank hatches and a hose crane. Bow at Roblox -Z; the hose crane and rescue boat are on
  starboard (Roblox +X). No hull number or name.
* ``attack-helicopter``: mission 5's three helicopters. Tandem-seat, narrow fuselage with a
  stepped two-pane canopy, one wide faired engine deck with side intakes, stub
  wings with empty pylons and tip pods, a four-blade main rotor (``MainRotor`` part) and a
  four-blade tail rotor (``TailRotor`` part), each with its hub as the part origin so the game
  can spin it. No gun, no sensor ball, no weapons.
* ``vanta-v2-elite``: mission 5's five-ship elite squadron. The Vanta v2 airframe with a
  blue-black paint and pale steel-blue fin and rudder and outer-wing bands
  (``aircraft_v2.vanta_paint("elite")``) and a plain rear (``plain_rear=True``: vaned nozzle
  plugs, no tail boom, mid-grey aft end) so the back view has no face reading. Built as its own
  folder by the shared ``aircraft_v2.vanta_v2_airframe``; the uploaded ``vanta-v2`` folders are
  not touched.

Face rule (review 1 of the mission 1 assets): nothing on these may read as a face head-on.
Noses and radomes are body colour with no seam ring or dark panel; windscreens are grids of
small panes tinted only slightly lighter than the paint; nothing protrudes in pairs from the
nose; the helicopter's engine fronts are closed body-colour fairings (side intakes) and there
is no chin turret; the tanker has no hawse pipes or anchors at the bow. From behind, the elite
Vanta shows no dark round nozzle openings, central opening or dark band (review 1 of PR #137).

Every builder runs ``Asset.finish()`` and then ``m01_assets.review_pack()`` (extra views,
close-ups, scale reference, contact sheet, budgets, ``exportVersion`` and a SHA-256 for every
file). Sides: authored front -Y, Z up, so the model's right (starboard) is Blender **-X**; the
export and import only rotate, so starboard is Roblox +X. These folders are deliberately
**not** in ``write_manifest.KEYS``: nothing in ``src/`` refers to them until an independent
reviewer approves them and the coordinator uploads them.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

from aircraft import fin_frame, naca, surface, wing_frame
from aircraft_v2 import CHECK_NOTES, VANTA_CLOSEUP, fan_face, pchip, soot_liner, vanta_paint, vanta_v2_airframe
from m01_assets import REVIEW_VIEWS, frustum, review_pack, roblox_model
from skyasset import Asset, Nodes, srgb, standard
import zones as Z
from world import hull_paint

BUILDERS: dict = {}
HERE = Path(__file__).resolve().parent
UPLOAD = HERE.parents[1] / "assets" / "roblox-upload"
PENDING = "Pending independent safety review; not uploaded; not referenced from src/."


def builder(name):
    def wrap(fn):
        BUILDERS[name] = fn
        return fn
    return wrap


def _lines(points):
    return pchip([p[0] for p in points], [p[1] for p in points])


def fuselage_rings(ys, top, bot, half, n=26, p=2.25):
    """Superellipse rings along pchip top, bottom and half-width lines."""
    rings = []
    for y in ys:
        t, b, w = top(y), bot(y), half(y)
        zc, hh = (t + b) / 2, (t - b) / 2
        ring = []
        for k in range(n):
            ang = k / n * math.tau
            c, s = math.cos(ang), math.sin(ang)
            ring.append((w * math.copysign(abs(c) ** (2 / p), c), y, zc + hh * math.copysign(abs(s) ** (2 / p), s)))
        rings.append(ring)
    return rings


# --------------------------------------------------------------------------
# Shared enemy airframe paint (Vanta family)

UPPER, LOWER = "#4a5159", "#6c757e"
CAMO = ("#373d44", "#59616a", "#2a2f35")
ACCENT = "#6e2a24"
PANE = "#57636c"


def _bands(n: Nodes, coord, values, width):
    m = 0.0
    for c in values:
        m = n.maxf(m, n.band(coord, c - width / 2, c + width / 2, width * 0.3))
    return m


def enemy_paint(*, screen, accent, frames, body_x, longerons, wing, soot, extra_lines=None, camo_scale=0.15,
                warp_scale=0.1, warp=(4.0, -3.0), nose_clear=-20.0, lw=0.07):
    """Vanta-family finish for large airframes: grey countershading, dark splinter camouflage
    on the upper surfaces aft of ``nose_clear`` only, light-tinted windscreen panes in
    body-colour frames, plain dark-red accent bands, panel lines, streaks, stains and soot.

    ``screen(n, x, y, z, ax)`` and ``accent(n, x, y, z, ax)`` return masks; ``wing`` =
    (z0, tan_dihedral, root, le0, tan_sweep, chord0, taper) for the main-wing panel lines;
    ``soot`` = [(engine |x|, exit y)]; ``extra_lines(n, x, y, z, ax, nx, ny, nz)`` adds doors
    and ramp outlines."""

    def pattern(n: Nodes, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        nx, ny, nz = n.xyz(n.normal())
        ax, anx, anz = n.absf(x), n.absf(nx), n.absf(nz)
        top = n.smooth(nz, -0.35, 0.15)
        col = n.vlerp(srgb(LOWER), srgb(UPPER), top)
        q = n.vmul(p, (1.0, 0.75, 1.0))
        wv = n.noise(q, warp_scale, 1.0, 0.5)
        q = n.vmath("ADD", q, n.vec(n.mul(wv, warp[0]), n.mul(wv, warp[1]), 0.0))
        cell = n.voronoi(q, camo_scale, "F1", "CHEBYCHEV", "Color", 1.0)
        cx, cy, cz = n.xyz(cell)
        tone = n.vlerp(srgb(CAMO[0]), srgb(CAMO[1]), n.smooth(cx, 0.36, 0.37))
        tone = n.vlerp(tone, srgb(CAMO[2]), n.smooth(cy, 0.7, 0.71))
        # No camouflage on the nose and cockpit: dark patches there could form features head-on.
        col = n.vlerp(col, tone, n.mul(n.mul(top, n.smooth(cz, 0.3, 0.31)), n.smooth(y, nose_clear - 0.5, nose_clear + 1.0)))
        # Windscreen: a grid of small panes in body-colour frames, only slightly lighter and bluer.
        scr = screen(n, x, y, z, ax)
        frames_s = n.maxf(n.lines(x, 0.7, 0.2), n.lines(y, 0.85, 0.2, 0.3))
        panes = n.mul(scr, n.sub(1.0, frames_s))
        col = n.vlerp(col, srgb(PANE), panes)
        col = n.vlerp(col, srgb(ACCENT), accent(n, x, y, z, ax))
        # Panel lines.
        body = n.smooth(ax, body_x + 0.2, body_x)
        frames_m = n.mul(n.mul(_bands(n, y, frames, lw), body), n.sub(1.0, scr))
        aft = n.smooth(y, nose_clear - 0.5, nose_clear + 0.5)
        long_m = n.mul(n.mul(n.mul(_bands(n, z, longerons, lw), n.smooth(anx, 0.45, 0.7)), body), aft)
        wz0, wtan, root, le0, sweep, c0, taper = wing
        on_wing = n.mul(n.sub(1.0, body), n.mul(n.smooth(anz, 0.5, 0.7),
                                                 n.smooth(n.absf(n.sub(z, n.add(wz0, n.mul(ax, wtan)))), 1.6, 1.2)))
        le = n.add(le0, n.mul(n.sub(ax, root), sweep))
        chord = n.sub(c0, n.mul(n.sub(ax, root), taper))
        u = n.math("DIVIDE", n.sub(y, le), chord)
        spars = n.mul(_bands(n, u, [0.14, 0.66], 0.008), on_wing)
        hinge = n.mul(_bands(n, u, [0.76], 0.008), on_wing)
        lines = n.maxf(n.maxf(frames_m, long_m), n.maxf(spars, hinge))
        if extra_lines is not None:
            lines = n.maxf(lines, extra_lines(n, x, y, z, ax, nx, ny, nz))
        col = n.vscale(col, n.sub(1.0, n.mul(lines, 0.4)))
        # Weathering: faded tops, rearward streaks, belly stains, exhaust soot.
        col = n.vlerp(col, srgb("#c9ccc8"), n.mul(n.smooth(nz, 0.6, 1.0), n.mul(n.noise(n.vmul(p, (1.0, 0.4, 1.0)), 0.25, 3.0, 0.6), 0.06)))
        streak = n.smooth(n.noise(n.vmul(p, (3.0, 0.1, 3.0)), 0.7, 3.0, 0.55), 0.52, 0.75)
        col = n.vscale(col, n.sub(1.0, n.mul(streak, 0.09)))
        stain = n.mul(n.smooth(nz, -0.3, -0.75), n.smooth(n.noise(n.vmul(p, (1.0, 0.25, 1.0)), 0.4, 4.0, 0.6), 0.55, 0.72))
        col = n.vlerp(col, srgb("#3d3b35"), n.mul(stain, 0.3))
        sm = 0.0
        for ex, y_exit in soot:
            sm = n.maxf(sm, n.mul(n.smooth(n.absf(n.sub(ax, ex)), 1.7, 0.6), n.smooth(y, y_exit - 2.5, y_exit + 1.0)))
        sm = n.mul(sm, n.add(0.5, n.mul(streak, 0.5)))
        col = n.vlerp(col, srgb("#26262a"), n.mul(sm, 0.55))
        return col, n.add(n.mul(lines, 0.12), n.mul(sm, 0.18)), n.sub(0.5, n.mul(lines, 0.6))

    return standard(UPPER, 0.55, 0.06, pattern=pattern, vary=0.035, vary_scale=0.06, grime=0.06, grime_scale=0.06,
                    ao=0.32, ao_dist=2.0)


def engine_zones(a: Asset, centers):
    """Lip, duct, one fan face per engine pair, liner, plug metal, rail and formation-light zones."""
    z = {
        "lip": a.zone("lip", standard("#9a9ea2", 0.32, 0.9, grime=0.05, ao=0.2, ao_dist=0.4)),
        "duct": a.zone("duct", standard("#7d8286", 0.55, 0.2, grime=0.2, ao=0.6, ao_dist=0.8)),
        "liner": a.zone("liner", soot_liner()),
        "metal": a.zone("metal", standard("#6a6a66", 0.4, 0.85, grime=0.2, ao=0.45, ao_dist=0.8)),
        "rail": a.zone("rail", standard("#5c6166", 0.55, 0.3, grime=0.15, ao=0.4, ao_dist=0.5)),
        "light": a.zone("light", standard("#8e9677", 0.4, 0.0, grime=0.05, ao=0.2, ao_dist=0.3)),
    }
    z["fans"] = [a.zone(f"fan{i}", fan_face(c)) for i, c in enumerate(centers)]
    return z


def turbofan(a: Asset, tag, paint, z, fan, x, zc, y0, length, r, wing_z, wing_y0, wing_y1, n=22, part="Body"):
    """Podded turbofan: cowl, bare-metal lip, duct, fan face and spinner, liner and plug, and a
    pylon up into the wing underside between ``wing_y0`` and ``wing_y1``. Returns the exhaust point."""
    y1 = y0 + length

    def ring(rr, y):
        return [(x + rr * math.cos(t), y, zc + rr * 0.97 * math.sin(t)) for t in (k * math.tau / n for k in range(n))]

    prof = [(0.0, 1.0), (0.06, 1.05), (0.22, 1.08), (0.5, 1.04), (0.75, 0.93), (0.92, 0.8), (1.0, 0.74)]
    a.loft(f"Nacelle {tag}", [ring(r * k, y0 + t * length) for t, k in prof], paint, part=part, cap_start=False, cap_end=False,
           smooth=50)
    a.loft(f"Lip {tag}", [ring(r * 0.995, y0 + 0.002), ring(r * 0.97, y0 - 0.06), ring(r * 0.9, y0 - 0.02), ring(r * 0.86, y0 + 0.2)],
           z["lip"], part=part, cap_start=False, cap_end=False, smooth=50)
    a.loft(f"Duct {tag}", [ring(r * 0.86, y0 + 0.2), ring(r * 0.82, y0 + 1.1)], z["duct"], part=part, cap_start=False,
           cap_end=False, smooth=50)
    a.cyl(f"Fan {tag}", r * 0.82, 0.06, (x, y0 + 1.1, zc), fan, part=part, segs=n, rot=(math.radians(90), 0, 0))
    a.cyl(f"Spinner {tag}", r * 0.3, 0.5, (x, y0 + 0.86, zc), fan, part=part, segs=12, r2=0.04, rot=(math.radians(90), 0, 0))
    a.loft(f"Liner {tag}", [ring(r * 0.74, y1), ring(r * 0.66, y1 - 0.15), ring(r * 0.6, y1 - 1.2)], z["liner"], part=part,
           cap_start=False, cap_end=True, smooth=50)
    a.loft(f"Plug {tag}", [ring(r * rr, y1 - 0.9 + t * 1.6) for t, rr in ((0.0, 0.42), (0.5, 0.36), (1.0, 0.18), (1.25, 0.04))],
           z["metal"], part=part, cap_start=False, smooth=50)
    outline = [(y0 + 1.4, zc + r * 0.9), (y0 + 2.8, wing_z + 0.4), (wing_y1, wing_z + 0.4), (y1 - 0.6, zc + r * 0.7),
               (y1 - 1.8, zc + r * 0.6)]
    if wing_y0 is not None:
        outline[1] = (max(y0 + 2.8, wing_y0), wing_z + 0.4)
    a.prism(f"Pylon {tag}", outline, x - 0.28, x + 0.28, paint, part=part, axis="x", smooth=None)
    return (x, y1 + 0.4, zc)


def lip_ring(n: Nodes, ax, y, z, ex, ez, y0, r):
    """Plain dark-red ring on an engine cowl just behind the lip."""
    rr = n.vmath("LENGTH", n.vec(n.sub(ax, ex), 0.0, n.sub(z, ez)))
    ring = n.mul(n.smooth(rr, r * 0.86, r * 0.91), n.smooth(rr, r * 1.24, r * 1.19))
    return n.mul(n.band(y, y0 + 0.25, y0 + 0.85, 0.03), ring)


def flap_track(a: Asset, name, paint, x, y, z, length, part="Body"):
    rings = []
    for t, rr in ((0.0, 0.02), (0.15, 0.32), (0.5, 0.38), (0.85, 0.3), (1.0, 0.04)):
        rings.append([(x + rr * 0.6 * math.cos(q), y + t * length, z - rr * (0.5 + 0.5 * math.sin(q)) * 1.4)
                      for q in (j * math.tau / 10 for j in range(10))])
    a.loft(name, rings, paint, part=part, smooth=55)


def blade_antenna(a: Asset, name, zone, y, z, h, flip=1):
    outline = [(0.0, 0.0), (1.1, 0.0), (0.75 + abs(h) * 0.5, h), (abs(h) * 0.5, h)]
    a.prism(name, [(y + u, z - flip * 0.05 + v) for u, v in outline], -0.04, 0.04, zone, part="Body", axis="x")


AIRCRAFT_VIEWS = {
    **REVIEW_VIEWS,
    "3q-low-front-right": ((-0.9, -1.2, -0.7), "persp"),
    "front-low": ((0.0, -1.0, -0.4), "persp"),
    "front-high": ((0.0, -1.0, 0.45), "persp"),
}


# --------------------------------------------------------------------------
# Heavy transport

T_NOSE = -33.0
T_TOP = _lines([(T_NOSE, -0.45), (-32.5, 0.9), (-31.4, 2.2), (-29.8, 3.3), (-27.8, 4.15), (-25.0, 4.65), (-21.0, 4.8),
                (19.0, 4.8), (24.0, 4.6), (28.0, 4.05), (31.0, 3.4), (33.6, 2.8)])
T_BOT = _lines([(T_NOSE, -1.05), (-32.5, -2.3), (-31.2, -3.3), (-29.2, -3.9), (-26.0, -4.2), (11.0, -4.2), (15.0, -3.7),
                (20.0, -2.0), (25.0, 0.0), (29.0, 1.5), (33.6, 2.25)])
T_HALF = _lines([(T_NOSE, 0.3), (-32.5, 1.5), (-31.2, 2.6), (-29.2, 3.55), (-26.0, 4.25), (-22.0, 4.6), (13.0, 4.6), (19.0, 4.25),
                 (24.0, 3.3), (28.0, 2.2), (31.0, 1.35), (33.6, 0.5)])
T_WING_Z = 4.95
T_DIH = math.tan(math.radians(-3.0))
T_ROOT, T_TIP = 4.6, 36.0
T_SWEEP = math.tan(math.radians(24))
T_ENGINES = (10.5, 19.5)
T_NAC = dict(len=8.6, r=1.3, drop=2.45, ahead=4.3)


def t_le(s):
    return -6.6 + s * T_SWEEP


def t_chord(s):
    return 13.2 - s * (9.0 / T_TIP)


def t_wing_z(s):
    return T_WING_Z + s * T_DIH


def transport_paint():
    def screen(n, x, y, z, ax):
        m = n.mul(n.band(y, -31.0, -26.8, 0.05), n.mul(n.smooth(z, 1.95, 2.15), n.smooth(z, 3.95, 3.75)))
        return n.mul(m, n.smooth(ax, 4.3, 4.1))

    def accent(n, x, y, z, ax):
        fin_tip = n.mul(n.smooth(z, 13.3, 13.4), n.smooth(ax, 0.8, 0.6))
        m = fin_tip
        for ex in T_ENGINES:
            m = n.maxf(m, lip_ring(n, ax, y, z, ex, t_wing_z(ex) - T_NAC["drop"], t_le(ex) - T_NAC["ahead"], T_NAC["r"]))
        return m

    def extra(n, x, y, z, ax, nx, ny, nz):
        w = 0.07
        belly = n.smooth(nz, -0.35, -0.6)
        # Cargo ramp and upper door on the upswept underside, closed.
        ramp = n.mul(n.band(y, 15.0, 29.0, 0.05), n.band(x, -2.6, 2.6, 0.05))
        ramp_in = n.mul(n.band(y, 15.0 + w, 29.0 - w, 0.05), n.band(x, -2.6 + w, 2.6 - w, 0.05))
        ramp_m = n.mul(n.maxf(n.sub(ramp, ramp_in), n.mul(ramp, _bands(n, y, [22.0], w))), belly)
        # Side doors (aft, both sides) and the crew door (forward, both sides): rectangles only.
        side = n.smooth(n.absf(nx), 0.6, 0.8)
        doors = 0.0
        for y0, y1, z0, z1 in ((10.0, 12.2, -3.2, 0.4), (-24.6, -22.9, -3.3, 0.0)):
            o = n.mul(n.band(y, y0, y1, 0.02), n.band(z, z0, z1, 0.02))
            i = n.mul(n.band(y, y0 + w, y1 - w, 0.02), n.band(z, z0 + w, z1 - w, 0.02))
            doors = n.maxf(doors, n.sub(o, i))
        # Flush main-gear bay doors along the lower sides (no sponsons).
        gear = n.mul(n.band(y, -6.0, 6.0, 0.02), n.band(z, -3.9, -2.4, 0.02))
        gear_in = n.mul(n.band(y, -6.0 + w, 6.0 - w, 0.02), n.band(z, -3.9 + w, -2.4 - w, 0.02))
        doors = n.maxf(doors, n.maxf(n.sub(gear, gear_in), n.mul(gear, _bands(n, y, [0.0], w))))
        return n.maxf(ramp_m, n.mul(n.mul(doors, side), n.smooth(ax, 4.9, 4.7)))

    soot = [(ex, t_le(ex) - T_NAC["ahead"] + T_NAC["len"]) for ex in T_ENGINES]
    return enemy_paint(screen=screen, accent=accent, frames=[-21.0, -15.0, -9.0, -3.0, 3.0, 9.0, 15.0, 21.0, 27.0],
                       body_x=4.75, longerons=[2.6, -1.0], wing=(T_WING_Z, T_DIH, 0.0, -6.6, T_SWEEP, 13.2, 9.0 / T_TIP),
                       soot=soot, extra_lines=extra, nose_clear=-17.0)


@builder("heavy-transport")
def heavy_transport():
    a = Asset("heavy-transport", "Heavy transport (mission 4 required targets)", texture=1024, kind="aircraft",
              tri_limit=15000, bump_distance=0.02, seed=401, weighted_normals=True, export_version="heavy-transport-1",
              usage="Mission 4: three transports flying a route under jamming (required targets, never fire). " + PENDING)
    paint = a.zone("paint", transport_paint())
    ez = [(e, t_wing_z(e) - T_NAC["drop"]) for e in T_ENGINES]
    z = engine_zones(a, ez)

    ys = [T_NOSE, -32.8, -32.5, -32.0, -31.4, -30.6, -29.8, -28.8, -27.8, -26.8, -25.8, -24.6, -23.0, -21.0, -18.0,
          -14.0, -10.0, -6.0, -2.0, 2.0, 6.0, 10.0, 13.0, 15.5, 18.0, 20.5, 23.0, 25.5, 28.0, 30.0, 31.8, 33.0, 33.6]
    a.loft("Fuselage", fuselage_rings(ys, T_TOP, T_BOT, T_HALF, n=28, p=2.6), paint, part="Body", smooth=60)
    # Wing-to-body fairing over the high wing (no gear sponsons: the gear stows flush in the fuselage).
    wf = []
    for yy, ww, hh in ((-9.0, 0.05, 0.02), (-7.0, 2.8, 0.75), (-3.0, 3.6, 1.05), (2.5, 3.7, 1.1), (7.0, 3.3, 0.85),
                       (11.0, 2.0, 0.4), (13.5, 0.05, 0.02)):
        wf.append([(ww * math.cos(t), yy, 4.55 + hh * math.sin(t)) for t in (k * math.tau / 18 for k in range(18))])
    a.loft("Wing fairing", wf, paint, part="Body", smooth=55)
    # Dorsal fairing aft of the wing, belly antenna and dorsal blades.
    df = []
    for yy, rr in ((12.0, 0.05), (13.5, 0.5), (16.0, 0.6), (18.5, 0.4), (19.5, 0.05)):
        df.append([(rr * 0.9 * math.cos(t), yy, 4.7 + rr * 0.5 * math.sin(t)) for t in (k * math.tau / 14 for k in range(14))])
    a.loft("Dorsal fairing", df, paint, part="Body", smooth=55)
    for i, (y, zz, h, flip) in enumerate(((-14.0, 4.75, 0.9, 1), (-19.0, 4.75, 0.6, 1), (-2.0, -4.15, -0.7, -1), (6.0, -4.15, -0.5, -1))):
        blade_antenna(a, f"Blade {i}", z["rail"], y, zz, h, flip)

    tc = lambda s: 0.14 - 0.045 * s / T_TIP
    exhausts, tips = [], {}
    for side, tag in ((-1, "L"), (1, "R")):
        f = wing_frame(T_WING_Z, side, math.atan(T_DIH))
        surface(a, f"Wing {tag}", paint, "Body", f, [0.0, T_ROOT, 7.0, 10.5, 14.0, 19.5, 24.0, 29.0, 33.0, T_TIP],
                t_le, t_chord, tc, samples=14)
        tip = Vector(f(T_TIP, t_le(T_TIP), 0))
        tc_tip = tc(T_TIP) * t_chord(T_TIP)
        a.sphere(f"Tip fairing {tag}", 1.0, (tip.x + side * 0.05, t_le(T_TIP) + t_chord(T_TIP) * 0.45, tip.z), paint,
                 part="Body", subdiv=2, scale=(0.3, t_chord(T_TIP) * 0.55, max(tc_tip * 0.55, 0.2)))
        a.box(f"Tip light {tag}", (0.08, 0.55, 0.1), (tip.x + side * 0.3, t_le(T_TIP) + 1.2, tip.z), z["light"], part="Body")
        tips[tag] = (tip.x + side * 0.3, t_le(T_TIP) + t_chord(T_TIP), tip.z)
        for k, s in enumerate((7.0, 14.5, 25.0, 30.5)):
            yy = t_le(s) + t_chord(s) * 0.62
            zz = t_wing_z(s) - naca(0.62, tc(s)) * t_chord(s)
            flap_track(a, f"Flap track {tag}{k}", paint, side * s, yy, zz, t_chord(s) * 0.44)
        for k, s in enumerate(T_ENGINES):
            zc = t_wing_z(s) - T_NAC["drop"]
            wz = t_wing_z(s) - naca(0.3, tc(s)) * t_chord(s) * 0.5
            exhausts.append(turbofan(a, f"{tag}{k}", paint, z, z["fans"][k], side * s, zc, t_le(s) - T_NAC["ahead"],
                                     T_NAC["len"], T_NAC["r"], wz, None, t_le(s) + t_chord(s) * 0.5))

    # Cruciform tail: swept fin with the tailplanes a third of the way up it.
    ff = fin_frame(0.0, 3.0, 0.0, 1)
    fle = lambda s: 19.0 + s * math.tan(math.radians(40))
    fch = lambda s: 11.0 - s * 0.45
    surface(a, "Fin", paint, "Body", ff, [0.0, 2.5, 5.0, 8.5, 11.7], fle, fch, 0.1, samples=12)
    a.box("Fin cap", (0.18, fch(11.7) * 0.85, 0.16), (0, fle(11.7) + fch(11.7) * 0.48, 3.0 + 11.72), z["rail"], part="Body")
    a.prism("Fin fillet", [(11.0, 4.5), (21.3, 6.0), (22.5, 4.5)], -0.36, 0.36, paint, part="Body", axis="x")
    hz = 3.0 + 4.6
    for side, tag in ((-1, "L"), (1, "R")):
        hf = wing_frame(hz, side, math.radians(3))
        hle = lambda s: fle(4.6) + 0.4 + s * math.tan(math.radians(32))
        hch = lambda s: 6.4 - s * 0.26
        surface(a, f"Tailplane {tag}", paint, "Body", hf, [0.0, 0.5, 4.0, 8.0, 12.0], hle, hch, 0.1, samples=10)
        a.box(f"Tailplane tip {tag}", (0.12, hch(12.0) * 0.8, 0.12),
              (side * 12.02, hle(12.0) + hch(12.0) * 0.45, hz + 12.0 * math.tan(math.radians(3))), z["rail"], part="Body")
    for s in (-1, 1):
        a.box(f"Fin light {s}", (0.03, 0.15, 1.2), (s * 0.2, fle(9.0) + 1.0, 3.0 + 9.0), z["light"], part="Body")

    exhaust_mid = sum((Vector(e) for e in exhausts), Vector()) / len(exhausts)
    a.finish(origin="center", attachments={"leftWingtip": tips["L"], "rightWingtip": tips["R"], "exhaust": tuple(exhaust_mid)},
             closeup=((0.6, -28.5, 2.6), (-1.0, -1.6, 0.7), 26.0), extra_notes={
        "noText": "No letters, numbers, call signs, serials, codes or glyph-like marks in mesh or texture; grey countershading, splinter camouflage, panel lines, door outlines and stains only.",
        "noRealMilitaryInsignia": "No roundels, flags, national or unit markings; the only markings are a plain dark-red fin-tip band and plain rings behind the engine lips. Original design, not a copy of any real or game aircraft (cruciform tail on a high-wing four-turbofan transport, flat-sided fuselage, no winglets).",
        "noFaces": "No faces or figures: no crew is modelled. Head-on, the nose is a blunt radome in the body colour with no seam ring, dark panel or camouflage; the windscreen is a grid of small panes in body-colour frames, tinted only slightly lighter than the paint; nothing protrudes from the nose, cheeks or lower corners (no probe, pitot, blisters or gear sponsons). The four engine fronts are spread along the wings in a row. Checked in preview-front, preview-closeup-front, preview-closeup-front-3q, preview-front-low, preview-front-high and preview-closeup-front-low.",
        "noGoreOrWeaponsGlorification": "Unarmed cargo aircraft: no guns, turret, missiles, pylon stores or bombs; cargo ramp and doors are closed panel lines. No damage or gore.",
    })
    review_pack(a, AIRCRAFT_VIEWS, {
        "closeup-front": ((0.0, -29.0, 1.5), (0.0, -1.0, 0.05), 34.0),
        "closeup-front-3q": ((0.0, -28.0, 1.5), (-0.65, -1.0, 0.2), 28.0),
        "closeup-front-low": ((0.0, -27.0, 0.0), (0.05, -1.0, -0.5), 34.0),
        "closeup-engines": ((-15.0, -4.0, 1.5), (-0.9, -1.0, -0.25), 24.0),
        "closeup-tail": ((0.0, 26.0, 7.0), (1.0, 0.75, 0.35), 24.0),
        "closeup-belly": ((0.0, 14.0, -3.0), (0.7, 0.3, -1.0), 26.0),
    }, 1024, {
        "engineExhausts": [roblox_model(a.shift(e)) for e in exhausts],
        "design": "Original four-turbofan heavy transport: high wing with 24-degree leading-edge sweep and 3-degree anhedral, four podded engines on pylons, cruciform tail (tailplanes a third of the way up a 40-degree swept fin), flat-sided fuselage with an upswept tail and closed cargo ramp, gear stowed flush. Unarmed.",
        "sizeRationale": "72 studs span x 68 long. The fighters are about 1.44 studs per real metre (26-stud Vanta for an ~18 m fighter); a ~50 m-span heavy transport gives 72 studs. That is 2.9x the Vanta v2 span (24.6) and 3.2x the Kestrel v2 (22.2), the same scale as the approved heavy bomber (72.7 span), so three of them read as large, slow targets beside the escorts.",
    }, scale_ref={"folder": UPLOAD / "vanta-v2", "location": (-50.0, -8.0, 0.0), "target": (-22.0, -2.0, 0.0),
                  "direction": (-0.6, -1.0, 0.75), "distance": 110.0})


# --------------------------------------------------------------------------
# Radar jammer

J_NOSE = -28.0
J_TOP = _lines([(J_NOSE, -0.3), (-27.4, 0.75), (-26.2, 1.6), (-24.6, 2.3), (-22.5, 2.72), (-19.0, 2.85), (18.0, 2.85),
                (22.0, 2.6), (25.0, 2.1), (27.0, 1.65), (28.6, 1.25)])
J_BOT = _lines([(J_NOSE, -0.9), (-27.4, -1.65), (-26.0, -2.2), (-23.5, -2.55), (-20.0, -2.65), (10.0, -2.65), (15.0, -2.3),
                (20.0, -1.4), (24.0, -0.3), (27.0, 0.55), (28.6, 0.9)])
J_HALF = _lines([(J_NOSE, 0.2), (-27.4, 1.0), (-26.0, 1.75), (-24.0, 2.3), (-21.0, 2.6), (-18.0, 2.7), (12.0, 2.7), (17.0, 2.45),
                 (21.0, 1.9), (25.0, 1.2), (28.6, 0.4)])
J_WING_Z = -1.55
J_DIH = math.tan(math.radians(5.0))
J_TIP = 29.0
J_SWEEP = math.tan(math.radians(30))
J_ENGINE = 9.0
J_NAC = dict(len=7.2, r=1.5, drop=1.95, ahead=4.6)
J_DOME = dict(y=6.5, z=6.4, r=7.2, h=1.55)


def j_le(s):
    return -5.2 + s * J_SWEEP


def j_chord(s):
    return 10.6 - s * (7.4 / J_TIP)


def j_wing_z(s):
    return J_WING_Z + s * J_DIH


def jammer_paint():
    def screen(n, x, y, z, ax):
        m = n.mul(n.band(y, -26.6, -23.4, 0.05), n.mul(n.smooth(z, 1.0, 1.2), n.smooth(z, 2.55, 2.4)))
        return n.mul(m, n.smooth(ax, 2.8, 2.6))

    def accent(n, x, y, z, ax):
        fin_top = n.mul(n.smooth(z, 10.6, 10.7), n.smooth(ax, 0.75, 0.55))
        return n.maxf(fin_top, lip_ring(n, ax, y, z, J_ENGINE, j_wing_z(J_ENGINE) - J_NAC["drop"], j_le(J_ENGINE) - J_NAC["ahead"],
                                        J_NAC["r"]))

    def extra(n, x, y, z, ax, nx, ny, nz):
        w = 0.06
        side = n.smooth(n.absf(nx), 0.6, 0.8)
        doors = 0.0
        for y0, y1, z0, z1 in ((-21.5, -20.0, -1.6, 1.4), (19.0, 20.3, -0.8, 1.6)):
            o = n.mul(n.band(y, y0, y1, 0.02), n.band(z, z0, z1, 0.02))
            i = n.mul(n.band(y, y0 + w, y1 - w, 0.02), n.band(z, z0 + w, z1 - w, 0.02))
            doors = n.maxf(doors, n.sub(o, i))
        # Rotodome: a radial rib pattern on its upper and lower faces (plain lines).
        dr = n.vmath("LENGTH", n.vec(x, n.sub(y, J_DOME["y"]), 0.0))
        on_dome = n.mul(n.smooth(n.absf(n.sub(z, J_DOME["z"])), 1.2, 0.9), n.smooth(dr, J_DOME["r"] + 0.3, J_DOME["r"]))
        rim = n.mul(_bands(n, dr, [J_DOME["r"] * 0.55, J_DOME["r"] * 0.9], w), on_dome)
        return n.maxf(n.mul(n.mul(doors, side), n.smooth(ax, 2.9, 2.7)), rim)

    soot = [(J_ENGINE, j_le(J_ENGINE) - J_NAC["ahead"] + J_NAC["len"])]
    return enemy_paint(screen=screen, accent=accent, frames=[-19.0, -13.0, -7.0, -1.0, 5.0, 11.0, 17.0, 22.0],
                       body_x=2.85, longerons=[1.4, -0.9], wing=(J_WING_Z, J_DIH, 0.0, -5.2, J_SWEEP, 10.6, 7.4 / J_TIP),
                       soot=soot, extra_lines=extra, nose_clear=-15.0, camo_scale=0.18)


@builder("radar-jammer")
def radar_jammer():
    a = Asset("radar-jammer", "Radar jammer aircraft (mission 4 optional targets)", texture=1024, kind="aircraft",
              tri_limit=15000, bump_distance=0.02, seed=402, weighted_normals=True, export_version="radar-jammer-1",
              usage="Mission 4: two airborne jammers near the transports; radar jamming clears as each is destroyed. " + PENDING)
    paint = a.zone("paint", jammer_paint())
    zc_e = j_wing_z(J_ENGINE) - J_NAC["drop"]
    z = engine_zones(a, [(J_ENGINE, zc_e)])
    ys = [J_NOSE, -27.8, -27.4, -26.9, -26.2, -25.4, -24.6, -23.6, -22.5, -21.0, -19.0, -16.0, -12.0, -8.0, -4.0, 0.0,
          4.0, 8.0, 12.0, 14.5, 17.0, 19.5, 22.0, 24.0, 26.0, 27.5, 28.6]
    a.loft("Fuselage", fuselage_rings(ys, J_TOP, J_BOT, J_HALF, n=26, p=2.2), paint, part="Body", smooth=60)
    a.cyl("Tail cone", 0.42, 1.6, (0, 29.3, 1.08), paint, part="Body", segs=12, r2=0.12, rot=(math.radians(-90), 0, 0))
    # Low-wing belly fairing.
    bf = []
    for yy, ww, hh in ((-8.0, 0.05, 0.02), (-6.0, 2.4, 0.5), (-2.0, 2.95, 0.75), (3.0, 2.95, 0.75), (7.0, 2.4, 0.5),
                       (10.0, 0.05, 0.02)):
        bf.append([(ww * math.cos(t), yy, -2.3 + hh * math.sin(t)) for t in (k * math.tau / 18 for k in range(18))])
    a.loft("Belly fairing", bf, paint, part="Body", smooth=55)
    for i, (y, zz, h, flip) in enumerate(((-15.0, 2.8, 0.8, 1), (-9.0, 2.8, 0.55, 1), (14.0, 2.75, 0.6, 1),
                                          (-12.0, -2.6, -0.7, -1), (-4.0, -2.95, -0.55, -1), (12.0, -2.55, -0.65, -1))):
        blade_antenna(a, f"Blade {i}", z["rail"], y, zz, h, flip)

    tc = lambda s: 0.13 - 0.04 * s / J_TIP
    tips, exhausts = {}, []
    for side, tag in ((-1, "L"), (1, "R")):
        f = wing_frame(J_WING_Z, side, math.atan(J_DIH))
        surface(a, f"Wing {tag}", paint, "Body", f, [0.0, 2.7, 5.0, 9.0, 13.0, 18.0, 23.0, 27.0, J_TIP], j_le, j_chord, tc,
                samples=14)
        # Wingtip jammer pods: pointed cylinders in the body colour.
        tip = Vector(f(J_TIP, j_le(J_TIP), 0))
        pod_y = j_le(J_TIP) + j_chord(J_TIP) * 0.45
        rings = []
        for yy, rr in ((-2.9, 0.02), (-2.5, 0.25), (-1.8, 0.42), (1.4, 0.42), (2.2, 0.3), (2.7, 0.06)):
            rings.append([(tip.x + side * 0.15 + rr * math.cos(t), pod_y + yy, tip.z + rr * math.sin(t))
                          for t in (k * math.tau / 12 for k in range(12))])
        a.loft(f"Tip pod {tag}", rings, paint, part="Body", smooth=55)
        a.box(f"Tip light {tag}", (0.08, 0.5, 0.1), (tip.x + side * 0.62, pod_y - 0.6, tip.z), z["light"], part="Body")
        tips[tag] = (tip.x + side * 0.6, pod_y + 2.7, tip.z)
        for k, s in enumerate((5.5, 14.0, 21.0)):
            yy = j_le(s) + j_chord(s) * 0.62
            zz = j_wing_z(s) - naca(0.62, tc(s)) * j_chord(s)
            flap_track(a, f"Flap track {tag}{k}", paint, side * s, yy, zz, j_chord(s) * 0.42)
        wz = j_wing_z(J_ENGINE) - naca(0.3, tc(J_ENGINE)) * j_chord(J_ENGINE) * 0.5
        exhausts.append(turbofan(a, tag, paint, z, z["fans"][0], side * J_ENGINE, zc_e, j_le(J_ENGINE) - J_NAC["ahead"],
                                 J_NAC["len"], J_NAC["r"], wz, None, j_le(J_ENGINE) + j_chord(J_ENGINE) * 0.45))

    # T-tail: swept fin, tailplanes on top.
    ff = fin_frame(0.0, 1.8, 0.0, 1)
    fle = lambda s: 17.0 + s * math.tan(math.radians(42))
    fch = lambda s: 9.2 - s * 0.42
    surface(a, "Fin", paint, "Body", ff, [0.0, 2.5, 5.5, 8.5, 9.6], fle, fch, 0.11, samples=12)
    a.prism("Fin fillet", [(9.0, 2.6), (18.9, 4.2), (19.6, 2.6)], -0.3, 0.3, paint, part="Body", axis="x")
    hz = 1.8 + 9.45
    for side, tag in ((-1, "L"), (1, "R")):
        hf = wing_frame(hz, side, math.radians(-2))
        hle = lambda s: fle(9.45) + 0.3 + s * math.tan(math.radians(30))
        hch = lambda s: 4.6 - s * 0.2
        surface(a, f"Tailplane {tag}", paint, "Body", hf, [0.0, 3.0, 6.5, 10.0], hle, hch, 0.09, samples=10)
    bullet = []
    for yy, rr in ((fle(9.45) - 0.6, 0.03), (fle(9.45), 0.3), (fle(9.45) + 2.5, 0.36), (fle(9.45) + 4.6, 0.2), (fle(9.45) + 5.4, 0.03)):
        bullet.append([(rr * math.cos(t), yy, hz + rr * math.sin(t)) for t in (k * math.tau / 12 for k in range(12))])
    a.loft("Tail bullet", bullet, paint, part="Body", smooth=55)

    # Rotodome: a lens on a single swept, faired pylon.
    d = J_DOME
    pylon = [(d["y"] - 2.8, 2.6), (d["y"] - 1.4, d["z"] - 0.5), (d["y"] + 2.6, d["z"] - 0.5), (d["y"] + 3.6, 2.6)]
    a.prism("Dome pylon", pylon, -0.38, 0.38, paint, part="Body", axis="x", smooth=None)
    lens = []
    for rr, dz in ((0.0, -d["h"] / 2), (0.35, -0.47 * d["h"]), (0.7, -0.38 * d["h"]), (0.92, -0.22 * d["h"]), (1.0, 0.0),
                   (0.92, 0.22 * d["h"]), (0.7, 0.38 * d["h"]), (0.35, 0.47 * d["h"]), (0.0, d["h"] / 2)):
        lens.append([(d["r"] * rr * math.cos(t), d["y"] + d["r"] * rr * math.sin(t), d["z"] + dz)
                     for t in (k * math.tau / 40 for k in range(40))])
    a.loft("Rotodome", lens, paint, part="Body", smooth=50)

    exhaust_mid = sum((Vector(e) for e in exhausts), Vector()) / len(exhausts)
    a.finish(origin="center", attachments={"leftWingtip": tips["L"], "rightWingtip": tips["R"], "exhaust": tuple(exhaust_mid)},
             closeup=((0.5, -24.5, 1.6), (-1.0, -1.6, 0.6), 20.0), extra_notes={
        "noText": "No letters, numbers, call signs, serials, codes or glyph-like marks in mesh or texture; grey countershading, splinter camouflage, panel lines, door outlines, plain rotodome rib circles and stains only.",
        "noRealMilitaryInsignia": "No roundels, flags, national or unit markings; the only markings are a plain dark-red fin-top band and plain rings behind the engine lips. Original design, not a copy of any real or game aircraft (low-wing twin with a T-tail, a lens rotodome on one swept pylon and wingtip pods).",
        "noFaces": "No faces or figures: no crew is modelled. Head-on, the nose is a radome in the body colour with no seam ring, dark panel or camouflage; the windscreen is a grid of small panes tinted only slightly lighter than the paint; the two engine fronts sit low and wide under the wings, below the windscreen, and the rotodome is a thin body-colour lens above. Nothing protrudes from the nose. Checked in preview-front, preview-closeup-front, preview-closeup-front-3q, preview-front-low, preview-front-high and preview-closeup-front-low.",
        "noGoreOrWeaponsGlorification": "Unarmed electronic aircraft: no guns, missiles or stores; wingtip pods are smooth antenna housings. No damage or gore.",
    })
    review_pack(a, AIRCRAFT_VIEWS, {
        "closeup-front": ((0.0, -25.0, 1.0), (0.0, -1.0, 0.05), 28.0),
        "closeup-front-3q": ((0.0, -24.0, 1.0), (-0.65, -1.0, 0.2), 22.0),
        "closeup-front-low": ((0.0, -23.0, -0.5), (0.05, -1.0, -0.5), 28.0),
        "closeup-rotodome": ((0.0, 6.5, 5.5), (-0.8, -0.9, 0.55), 26.0),
        "closeup-engines": ((-9.0, -6.0, -2.5), (-0.9, -1.0, -0.25), 18.0),
        "closeup-tail": ((0.0, 24.0, 7.0), (1.0, 0.75, 0.35), 20.0),
        "closeup-belly": ((0.0, -2.0, -2.8), (0.7, -0.4, -1.0), 22.0),
    }, 1024, {
        "engineExhausts": [roblox_model(a.shift(e)) for e in exhausts],
        "rotodome": {"centre": roblox_model(a.shift((0.0, J_DOME["y"], J_DOME["z"]))), "radiusStuds": J_DOME["r"],
                     "axis": "Roblox +Y (static; part of Body)"},
        "design": "Original twin-turbofan radar jammer: low wing with 30-degree sweep and 5-degree dihedral, two podded engines, T-tail, a 14.4-stud lens-shaped rotodome on a single swept pylon aft of the wing, wingtip antenna pods and blade antennas. Unarmed.",
        "sizeRationale": "59.3 studs span over the tip pods (58 at the wingtips) x 62.2 long. At the fighters' ~1.44 studs per metre a ~40 m twin-engine airframe gives about 58 studs: 2.4x the Vanta v2 span (24.6), clearly smaller than the 72-stud heavy transport it flies with, and still a large, slow target.",
    }, scale_ref={"folder": UPLOAD / "vanta-v2", "location": (-44.0, -6.0, 0.0), "target": (-18.0, -2.0, 0.0),
                  "direction": (-0.6, -1.0, 0.75), "distance": 95.0})


# --------------------------------------------------------------------------
# Fuel tanker (ship)

FT_L = 260.0
FT_B = 23.0      # half beam
FT_D = 26.0      # main deck above the keel
FT_WL = 16.0     # waterline above the keel
FT_STATIONS = 32
# Plan coordinates have x to STARBOARD (+x) and the bow at -y; the builder mirrors the
# finished ship in X (as the carrier does) so starboard is Blender -X.
FT_MIRROR = Matrix.Scale(-1.0, 4, (1.0, 0.0, 0.0))


def fp(p):
    """A plan point or direction (x to starboard) in Blender coordinates (starboard -X)."""
    return (-p[0],) + tuple(p[1:])


def ft_station(k):
    s = k / FT_STATIONS
    y = -FT_L / 2 + s * FT_L
    if s < 0.2:
        b = (s / 0.2) ** 0.5
    elif s > 0.74:
        b = 1 - 0.27 * ((s - 0.74) / 0.26) ** 2
    else:
        b = 1.0
    b = max(b, 0.025)
    keel = 7.0 * max(0.0, 1 - s / 0.05) ** 1.5 + (8.0 * ((s - 0.92) / 0.08) ** 1.5 if s > 0.92 else 0.0)
    flare = 0.3 * max(0.0, 1 - s / 0.18)
    rake = 9.0 * max(0.0, 1 - s / 0.04)
    return s, y, b, keel, flare, rake


def ft_ring(k):
    s, y, b, keel, flare, rake = ft_station(k)
    w = FT_B * b
    top_w = max(w * (1 + flare), FT_B * 0.12 if s < 0.05 else 0.0)
    half = [(0.0, keel), (0.72 * w, keel), (0.96 * w, keel + 1.4 * b + 0.2), (w, keel + 4.5 * b + 0.5),
            (w, max(FT_WL, keel + 5.0)), (top_w, FT_D)]
    ring = [(x, y - rake * (zz - keel) / FT_D, zz) for x, zz in half]
    ring += [(-x, yy, zz) for x, yy, zz in reversed(ring[1:])]
    return ring


def ft_half(y):
    """Deck half-width (plan) at ``y`` from the hull stations' top points."""
    tops = []
    for k in range(FT_STATIONS + 1):
        r = ft_ring(k)
        tops.append((r[5][1], r[5][0]))
    for (y0, w0), (y1, w1) in zip(tops, tops[1:]):
        if y0 <= y <= y1:
            return w0 + (w1 - w0) * (y - y0) / max(y1 - y0, 1e-6)
    return tops[0][1] if y < tops[0][0] else tops[-1][1]


def ft_outline(y0, y1, inset=0.0, steps=10):
    ys = [y0 + (y1 - y0) * i / steps for i in range(steps + 1)]
    right = [(ft_half(y) - inset, y) for y in ys]
    return right + [(-x, y) for x, y in reversed(right)]


def tanker_deck_paint():
    """Dark green-grey deck paint for raised decks, catwalk and forecastle tops; hull sides charcoal."""
    return hull_paint(top="#3f4549", deck="#55605a", waterline=FT_WL)


@builder("fuel-tanker")
def fuel_tanker():
    a = Asset("fuel-tanker", "Fuel tanker ship (mission 5 naval targets)", texture=512, tri_limit=6000, bump_distance=0.15,
              seed=403, export_version="fuel-tanker-1",
              usage="Mission 5: two tankers at sea (one near the start route, one near the rig complex); naval targets. " + PENDING)
    hull = a.zone("hull", tanker_deck_paint())
    sup = a.zone("super", Z.windows("#cbc9c0", "#1e262c", bay=3.2, win=1.7, floor=4.5, win_h=1.6, z0=FT_D + 4.5,
                                      z1=FT_D + 18.0, rough=0.6, roof_color="#6a6e6c", frame="#cbc9c0", streak=0.3,
                                      base_dirt=0.0))
    bridge = a.zone("bridge", Z.windows("#cbc9c0", "#1e262c", bay=2.4, win=2.0, floor=4.5, win_h=2.0, z0=FT_D + 18.0,
                                         z1=FT_D + 22.5, rough=0.6, roof_color="#6a6e6c", frame="#cbc9c0", streak=0.25,
                                         base_dirt=0.0))
    plain = a.zone("plain", Z.painted_metal("#c4c2b9", rough=0.6, metal=0.2, rust=0.12, streak=0.35, panels=None))
    pipe = a.zone("pipe", Z.painted_metal("#8d938f", rough=0.5, metal=0.35, rust=0.25, panels=None))
    dark = a.zone("dark", Z.painted_metal("#3c4146", rough=0.6, metal=0.3, rust=0.1, panels=None))
    soot = a.zone("soot", standard("#2a2b2c", 0.8, 0.2, grime=0.3, streak=0.5))
    boat = a.zone("boat", standard("#c97a2e", 0.6, 0.0, grime=0.1))
    D = FT_D

    a.loft("Hull", [ft_ring(k) for k in range(FT_STATIONS + 1)], hull, smooth=40)
    # Bulbous bow below the waterline.
    a.sphere("Bulb", 1.0, (0.0, -FT_L / 2 + 6.0, 6.2), hull, subdiv=2, scale=(3.4, 12.0, 3.9))
    # Raised forecastle and poop deck following the hull's deck edge.
    a.prism("Forecastle", ft_outline(ft_ring(0)[5][1] + 0.3, -104.0, 0.0), D - 0.4, D + 3.6, hull)
    a.prism("Breakwater", [(-14.0, -100.0), (0.0, -108.0), (14.0, -100.0), (14.0, -99.0), (0.0, -107.0), (-14.0, -99.0)],
            D, D + 2.6, plain)
    a.prism("Poop deck", ft_outline(80.0, FT_L / 2 - 0.3, 0.0), D - 0.4, D + 4.5, hull)

    # Deckhouse aft: three accommodation tiers and the bridge, bridge wings, mast, funnel.
    frustum(a, "Tier 1", sup, -15.0, 86.0, 15.0, 110.0, D + 4.5, D + 9.0, inset=0.0)
    frustum(a, "Tier 2", sup, -14.0, 86.5, 14.0, 109.0, D + 9.0, D + 13.5, inset=0.0)
    frustum(a, "Tier 3", sup, -13.0, 87.0, 13.0, 108.0, D + 13.5, D + 18.0, inset=0.0)
    frustum(a, "Bridge", bridge, -13.0, 87.0, 13.0, 100.0, D + 18.0, D + 22.5, inset=0.3, front=0.9)
    a.box("Bridge roof", (27.6, 14.6, 0.6), (0.0, 93.4, D + 22.8), plain)
    for side in (-1, 1):
        a.box(f"Bridge wing {side}", (8.6, 4.0, 0.5), (side * 17.2, 88.6, D + 19.3), plain)
        a.box(f"Wing cab {side}", (2.6, 3.4, 2.8), (side * 20.6, 88.6, D + 21.0), plain)
        a.beam(f"Wing rail {side}", (side * 13.0, 86.8, D + 20.6), (side * 21.6, 86.8, D + 20.6), 0.25, dark)
    a.cyl("Radar mast", 0.6, 10.0, (0.0, 95.0, D + 28.0), dark, segs=6, smooth=None)
    a.beam("Mast yard", (-5.0, 95.0, D + 30.0), (5.0, 95.0, D + 30.0), 0.5, dark)
    # Both radar bars sit over the yard: from above, offset bars drew parallel strokes like a glyph.
    for i, (dy, dz, w) in enumerate(((0.0, 33.4, 6.0), (0.0, 25.2, 4.6))):
        a.box(f"Radar bar {i}", (w, 0.6, 0.4), (0.0, 95.0 + dy, D + dz), dark)
    frustum(a, "Funnel", plain, -5.5, 109.0, 5.5, 121.0, D + 18.0, D + 31.0, inset=0.6, front=2.5, bevel=0.3)
    frustum(a, "Engine casing", plain, -8.0, 108.0, 8.0, 123.0, D + 4.5, D + 18.0, inset=0.3)
    frustum(a, "Funnel cap", soot, -4.9, 111.5, 4.9, 120.4, D + 31.0, D + 32.0, inset=0.3)
    # Free-fall lifeboat on its stern ramp, rescue boat on its starboard davit.
    a.sphere("Lifeboat", 1.0, (0.0, 125.5, D + 7.6), boat, subdiv=2, scale=(2.2, 4.6, 1.8))
    a.box("Lifeboat ramp", (5.4, 9.0, 0.5), (0.0, 124.5, D + 5.4), dark, rot=(math.radians(-14), 0, 0))
    a.sphere("Rescue boat", 1.0, (16.2, 102.0, D + 10.4), boat, subdiv=2, scale=(1.4, 3.4, 1.0))
    a.beam("Davit", (15.0, 102.0, D + 9.0), (17.6, 102.0, D + 13.8), 0.45, dark)
    a.beam("Davit arm", (17.6, 102.0, D + 13.8), (16.2, 102.0, D + 13.2), 0.35, dark)

    # Cargo deck: longitudinal pipes on low supports, the midships manifold, a raised catwalk,
    # tank hatches, a hose crane on starboard, a foremast and mooring winches.
    y_fwd, y_aft = -102.0, 84.0
    pipe_x = (-4.5, -2.2, 0.1)
    for i, px in enumerate(pipe_x):
        a.beam(f"Pipe {i}", (px, y_fwd, D + 1.3), (px, y_aft, D + 1.3), 1.0 if i < 2 else 0.7, pipe, segs=6)
    for k, yy in enumerate(range(int(y_fwd) + 8, int(y_aft), 24)):
        a.box(f"Pipe rack {k}", (6.6, 0.8, 0.9), (-2.2, yy, D + 0.45), dark)
    for j, yy in enumerate((-6.0, -1.0)):
        a.beam(f"Manifold {j}", (-18.5, yy, D + 1.8), (18.5, yy, D + 1.8), 0.9, pipe, segs=6)
        for side in (-1, 1):
            a.box(f"Valve {j} {side}", (1.6, 1.6, 1.6), (side * 18.8, yy, D + 1.8), dark)
            a.beam(f"Riser {j} {side}", (side * 3.0, yy, D + 0.2), (side * 3.0, yy, D + 1.8), 0.7, pipe, segs=6)
    for side in (-1, 1):
        a.box(f"Drip tray {side}", (3.6, 9.0, 0.5), (side * 19.0, -3.5, D + 0.25), dark)
    for k, yy in enumerate(range(int(y_fwd) + 2, int(y_aft) + 1, 16)):
        a.beam(f"Catwalk post {k}", (6.0, yy, D), (6.0, yy, D + 3.8), 0.45, dark)
    a.box("Catwalk", (2.2, y_aft - y_fwd, 0.35), (6.0, (y_fwd + y_aft) / 2, D + 4.0), dark)
    for side in (-1, 1):
        for k, yy in enumerate(range(-92, 80, 22)):
            a.cyl(f"Hatch {side} {k}", 1.3, 1.0, (side * 12.5, yy, D + 0.5), pipe, segs=8, smooth=None)
    # Hose crane (starboard, at the manifold).
    a.cyl("Crane pedestal", 1.1, 6.0, (14.0, -12.0, D + 3.0), plain, segs=8, smooth=None)
    a.box("Crane house", (2.6, 2.6, 1.8), (14.0, -12.0, D + 6.9), plain)
    a.beam("Crane jib", (14.0, -11.5, D + 7.4), (16.0, 2.0, D + 13.5), 0.7, plain)
    a.beam("Crane hook line", (16.0, 2.0, D + 13.5), (16.0, 2.0, D + 7.5), 0.12, dark)
    # Foremast and mooring winches (aft and midships only: a symmetric pair on the forecastle
    # showed as two small marks above the stem head-on).
    a.cyl("Foremast", 0.6, 15.0, (0.0, -112.0, D + 3.6 + 7.5), dark, segs=6, smooth=None)
    a.box("Foremast platform", (3.0, 2.0, 0.3), (0.0, -111.6, D + 3.6 + 11.0), dark)
    for i, (x, y, zz) in enumerate(((-9.0, 118.0, D + 4.5), (9.0, 118.0, D + 4.5), (-12.0, 72.0, D), (12.0, 72.0, D))):
        a.box(f"Winch {i}", (2.4, 3.2, 1.6), (x, y, zz + 0.8), dark)
        a.cyl(f"Drum {i}", 0.9, 2.2, (x + (1.6 if x > 0 else -1.6), y, zz + 1.0), dark, segs=8, rot=(0, math.radians(90), 0))

    # Everything above is in plan coordinates (starboard +x): mirror so starboard is Blender -X.
    for obj, _ in a.pieces:
        obj.matrix_basis = FT_MIRROR @ obj.matrix_basis

    def arrow():
        """Review-only plain arrow from stern to bow on the centre line, above the deck (not in the FBX)."""
        zz = FT_D + 40.0
        pts = [(-3.0, 70.0), (3.0, 70.0), (3.0, -80.0), (-3.0, -80.0), (10.0, -80.0), (0.0, -112.0), (-10.0, -80.0)]
        me = bpy.data.meshes.new("OrientationArrow")
        me.from_pydata([tuple(a.shift(fp((x, y, zz)))) for x, y in pts], [], [(0, 1, 2, 3), (4, 5, 6)])
        mat = bpy.data.materials.new("OrientationArrow")
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        emit = nodes.new("ShaderNodeEmission")
        emit.inputs["Color"].default_value = (1.0, 0.32, 0.02, 1.0)
        emit.inputs["Strength"].default_value = 2.0
        mat.node_tree.links.new(emit.outputs[0], nodes["Material Output"].inputs["Surface"])
        me.materials.append(mat)
        obj = bpy.data.objects.new("OrientationArrow", me)
        bpy.context.scene.collection.objects.link(obj)
        return [obj]

    a.finish(ground_offset=FT_WL, extra_notes={
        "noText": "No letters, numbers or symbols anywhere: no hull number, name, port of registry, draught marks, funnel mark or company colours. Paint is plain charcoal topsides, a black boot-top, red antifouling, a green-grey deck and an off-white deckhouse with rows of plain windows.",
        "noLogosOrBrands": "No company, product or brand marks; the funnel is plain off-white with a soot-dark top.",
        "noRealMilitaryInsignia": "No flags, ensigns or markings; an original tanker layout (deckhouse aft, raised forecastle, three cargo lines, a two-pipe manifold, catwalk to starboard of the pipes), not a copy of any real or game ship.",
        "noFaces": "No faces, figures or crew. Head-on the bow is a plain raked stem with no hawse pipes, anchors or dark openings; the deckhouse front has rows of many small windows and a wide bridge band, which reads as a building. Checked in preview-front, preview-closeup-bow and preview-closeup-deckhouse.",
        "noGoreOrWeaponsGlorification": "A civilian-type cargo ship: no guns, launchers or weapons; nothing damaged or burning.",
    })
    review_pack(a, {
        **REVIEW_VIEWS,
        "3q-low-front-right": ((-0.9, -1.2, -0.25), "persp"),
    }, {
        # Targets and directions in plan coordinates (starboard +x), mirrored by fp().
        "closeup-bow": (fp((0.0, -110.0, FT_D)), fp((0.25, -1.0, 0.25)), 75.0),
        "closeup-deckhouse": (fp((0.0, 95.0, FT_D + 14.0)), fp((0.25, -1.0, 0.3)), 80.0),
        "closeup-manifold": (fp((6.0, -4.0, FT_D + 2.0)), fp((1.0, -0.6, 0.7)), 60.0),
        "closeup-stern": (fp((0.0, 120.0, FT_D + 8.0)), fp((-0.5, 1.0, 0.45)), 75.0),
    }, 512, {
        "orientation": "Bow at Roblox -Z; starboard = Roblox +X (right when facing the bow), which carries the hose crane at the manifold, the raised catwalk (just starboard of the pipes) and the rescue boat on the deckhouse. Authored front -Y, Z up, so starboard is Blender -X; the plan is mirrored to put those features there. The FBX export and the Roblox import only rotate (Blender (x, y, z) -> Roblox (-x, z, y)), so no import mirrors a side. preview-top-orientation.png shows a review-only arrow from stern to bow.",
        "waterline": "groundOffsetStuds = 16: the waterline is 16 studs above the keel (the model's lowest point). Place the pivot (bottom centre) 16 studs below the sea surface.",
        "deckHeightStuds": FT_D,
        "design": "Original medium tanker: raked stem with a bulbous bow, parallel midbody, transom stern, raised forecastle with a breakwater, deckhouse of three tiers plus bridge aft with bridge wings, a raked funnel, three longitudinal cargo pipes, a two-pipe manifold midships, a raised catwalk, tank hatches, a starboard hose crane, a free-fall lifeboat on a stern ramp, a rescue boat on a starboard davit, a foremast and mooring winches. No hull number or name.",
        "sizeRationale": "266.7 studs overall (260 at the waterline plus the raked stem and bulb) x 46 beam. At the fighters' ~1.44 studs per metre this is a ~185 m medium tanker (32 m beam): 10 Vanta lengths, about half the 560-stud carrier. The legacy frigate (430 studs) is authored at 0.28 m per stud and is oversized next to this ship; keep them apart or scale the frigate down.",
    }, scale_ref={"folder": UPLOAD / "kestrel-v2", "location": fp((-30.0, -40.0, FT_D + 18.0)),
                  "target": fp((-5.0, -40.0, FT_D + 6.0)), "direction": fp((-0.9, -0.8, 0.6)), "distance": 120.0},
       overlays={"top-orientation": (arrow, (0, 0, 1), "Review aid only (not in the FBX): orthographic from above, same framing as preview-top.png, with a plain orange arrow from stern to bow on the centre line. The hose crane and rescue boat are on the image's right, the starboard side.")})


# --------------------------------------------------------------------------
# Attack helicopter

H_NOSE = -10.6
H_TOP = _lines([(H_NOSE, -0.15), (-10.2, 0.25), (-9.5, 0.5), (-8.7, 0.62), (-6.0, 0.95), (-3.6, 1.3), (-2.6, 1.55), (1.6, 1.55),
                (2.8, 1.15), (4.2, 0.95), (6.5, 0.85), (8.4, 0.8), (9.6, 0.78)])
H_BOT = _lines([(H_NOSE, -0.5), (-10.2, -0.82), (-9.3, -1.12), (-8.0, -1.32), (-4.0, -1.45), (0.6, -1.42), (2.2, -1.05), (3.4, -0.45),
                (5.0, -0.05), (7.0, 0.18), (9.6, 0.32)])
H_HALF = _lines([(H_NOSE, 0.08), (-10.2, 0.36), (-9.3, 0.53), (-8.0, 0.67), (-6.0, 0.74), (-3.5, 0.84), (0.6, 0.88), (2.2, 0.74),
                 (3.4, 0.55), (5.0, 0.4), (7.0, 0.32), (9.6, 0.26)])
H_MAST = (0.0, -0.6)        # (x, y) of the main rotor mast
H_HUB_Z = 3.05
H_ROTOR_R = 10.0
H_TAIL_HUB = (0.62, 8.85, 2.7)
H_TAIL_R = 1.65
H_CANOPY = [(-9.0, 0.10, 0.48, 0.52), (-8.6, 0.5, 0.6, 0.92), (-7.6, 0.68, 0.72, 1.42), (-6.65, 0.73, 0.84, 1.58),
            (-6.4, 0.75, 0.9, 1.95), (-6.0, 0.77, 0.95, 2.12), (-4.6, 0.77, 1.1, 2.18), (-3.8, 0.7, 1.25, 1.95),
            (-3.15, 0.5, 1.42, 1.58)]
H_BOWS = (-7.9, -6.55, -5.2, -4.2)


def heli_paint():
    """Vanta-family finish at helicopter scale: countershading, splinter camouflage aft of the
    cockpit only, panel lines, side intake grilles in plain mid-grey, exhaust soot, a dark-red
    fin-tip band. No markings."""

    def pattern(n: Nodes, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        nx, ny, nz = n.xyz(n.normal())
        ax, anx = n.absf(x), n.absf(nx)
        top = n.smooth(nz, -0.35, 0.15)
        col = n.vlerp(srgb(LOWER), srgb(UPPER), top)
        q = n.vmul(p, (1.0, 0.75, 1.0))
        wv = n.noise(q, 0.3, 1.0, 0.5)
        q = n.vmath("ADD", q, n.vec(n.mul(wv, 1.4), n.mul(wv, -1.0), 0.0))
        cell = n.voronoi(q, 0.5, "F1", "CHEBYCHEV", "Color", 1.0)
        cx, cy, cz = n.xyz(cell)
        tone = n.vlerp(srgb(CAMO[0]), srgb(CAMO[1]), n.smooth(cx, 0.36, 0.37))
        tone = n.vlerp(tone, srgb(CAMO[2]), n.smooth(cy, 0.7, 0.71))
        col = n.vlerp(col, tone, n.mul(n.mul(top, n.smooth(cz, 0.3, 0.31)), n.smooth(y, -3.2, -2.6)))
        # Side intake grilles on the engine deck: plain mid-grey slats.
        grille = n.mul(n.mul(n.band(y, -1.6, 0.0, 0.03), n.band(z, 1.3, 1.9, 0.03)),
                       n.mul(n.smooth(ax, 1.3, 1.45), n.smooth(anx, 0.55, 0.8)))
        slats = n.lines(z, 0.15, 0.35)
        col = n.vlerp(col, n.vscale(srgb("#5e656b"), n.sub(1.0, n.mul(slats, 0.3))), grille)
        # Fin-top accent band.
        col = n.vlerp(col, srgb(ACCENT), n.mul(n.smooth(z, 3.1, 3.17), n.smooth(y, 7.0, 7.4)))
        # Panel lines: frames, a longeron, access panels on the engine deck and flush gear doors.
        w = 0.035
        frames = n.mul(_bands(n, y, [-8.8, -3.2, -1.0, 1.8, 3.6, 6.0], w), n.smooth(ax, 1.6, 1.45))
        long_m = n.mul(n.mul(_bands(n, z, [-0.5], w), n.smooth(anx, 0.5, 0.75)), n.smooth(y, -9.0, -8.5))
        acc = 0.0
        for y0, y1, z0, z1 in ((0.3, 1.3, 1.25, 1.9), (-9.4, -8.9, -1.0, -0.2), (-1.4, 0.4, -1.55, -1.0)):
            o = n.mul(n.band(y, y0, y1, 0.01), n.band(z, z0, z1, 0.01))
            i = n.mul(n.band(y, y0 + w, y1 - w, 0.01), n.band(z, z0 + w, z1 - w, 0.01))
            acc = n.maxf(acc, n.sub(o, i))
        lines = n.maxf(n.maxf(frames, long_m), n.mul(acc, n.smooth(anx, 0.5, 0.75)))
        col = n.vscale(col, n.sub(1.0, n.mul(lines, 0.4)))
        col = n.vlerp(col, srgb("#c9ccc8"), n.mul(n.smooth(nz, 0.6, 1.0), n.mul(n.noise(n.vmul(p, (1.0, 0.4, 1.0)), 0.6, 3.0, 0.6), 0.06)))
        streak = n.smooth(n.noise(n.vmul(p, (6.0, 0.22, 6.0)), 1.4, 3.0, 0.55), 0.52, 0.75)
        col = n.vscale(col, n.sub(1.0, n.mul(streak, 0.09)))
        # Exhaust soot on the tail boom behind the exhausts.
        sm = n.mul(n.mul(n.smooth(y, 2.4, 3.4), n.smooth(y, 7.5, 5.0)), n.smooth(nz, -0.2, 0.3))
        sm = n.mul(n.mul(sm, n.add(0.5, n.mul(streak, 0.5))), n.smooth(ax, 1.4, 0.6))
        col = n.vlerp(col, srgb("#26262a"), n.mul(sm, 0.5))
        return col, n.add(n.mul(lines, 0.12), n.mul(sm, 0.18)), n.sub(0.5, n.mul(lines, 0.6))

    return standard(UPPER, 0.55, 0.06, pattern=pattern, vary=0.035, vary_scale=0.15, grime=0.06, grime_scale=0.15,
                    ao=0.32, ao_dist=0.8)


def heli_glass():
    """Opaque canopy panes tinted only slightly lighter and bluer than the paint, with
    body-colour frames at each bow and along the sills (no dark glazing). No roof centre line:
    crossing the bows it drew plus-shaped marks on the roof."""

    def pattern(n: Nodes, col):
        x, y, z = n.xyz(n.pos())
        nx, ny, nz = n.xyz(n.normal())
        bows = _bands(n, y, list(H_BOWS), 0.09)
        # Frame band along the sills (low on the canopy sides).
        sill = n.smooth(n.absf(nz), 0.35, 0.15)
        sill = n.mul(sill, n.smooth(z, 1.0, 0.8))
        frame = n.maxf(bows, sill)
        sheen = n.smooth(n.noise(n.vmul(n.pos(), (0.4, 1.0, 2.0)), 1.2, 2.0, 0.5), 0.4, 0.75)
        col = n.vlerp(col, srgb("#66727b"), n.mul(sheen, 0.2))
        col = n.vlerp(col, srgb(UPPER), frame)
        return col, n.mul(frame, 0.2), n.sub(0.5, n.mul(bows, 0.4))

    return standard(PANE, 0.35, 0.1, pattern=pattern, vary=0.02, grime=0.02, ao=0.15, ao_dist=0.4)


def rotor_blade(a: Asset, name, zone, part, hub, angle, r0, r1, chord, thick, axis="z", droop=0.0):
    """A flat tapered blade from radius r0 to r1 at ``angle`` about the hub (``axis`` z: main
    rotor in the XY plane; x: tail rotor in the YZ plane)."""
    hx, hy, hz = hub
    c, s = math.cos(angle), math.sin(angle)
    rings = []
    for k, (r, ch) in enumerate(((r0, chord), (r1 * 0.96, chord * 0.85), (r1, chord * 0.55))):
        ring = []
        for side, t in ((-1, -thick / 2), (1, -thick / 2), (1, thick / 2), (-1, thick / 2)):
            # Radial direction (c, s); chord direction (-s, c).
            u = r * c - side * ch / 2 * s
            v = r * s + side * ch / 2 * c
            d = -droop * (r / r1) ** 2
            if axis == "z":
                ring.append((hx + u, hy + v, hz + t + d))
            else:
                ring.append((hx + t, hy + u, hz + v))
        rings.append(ring)
    a.loft(name, rings, zone, part=part, smooth=None)


@builder("attack-helicopter")
def attack_helicopter():
    a = Asset("attack-helicopter", "Attack helicopter (mission 5 rig defenders)", texture=1024, kind="aircraft",
              tri_limit=15000, bump_distance=0.01, seed=404, weighted_normals=True, export_version="attack-helicopter-1",
              usage="Mission 5: three helicopters defending the oil-rig complex (air targets). " + PENDING)
    paint = a.zone("paint", heli_paint())
    glass = a.zone("glass", heli_glass())
    rotor = a.zone("rotor", standard("#34383c", 0.6, 0.2, grime=0.1, ao=0.25, ao_dist=0.4))
    hubz = a.zone("hub", standard("#5c6166", 0.5, 0.5, grime=0.2, ao=0.45, ao_dist=0.4))
    liner = a.zone("liner", soot_liner())
    rail = a.zone("rail", standard("#5c6166", 0.55, 0.3, grime=0.15, ao=0.4, ao_dist=0.5))
    light = a.zone("light", standard("#8e9677", 0.4, 0.0, grime=0.05, ao=0.2, ao_dist=0.3))
    a.metadata["pivots"] = {}

    ys = [H_NOSE, -10.45, -10.2, -9.9, -9.5, -9.0, -8.4, -7.6, -6.8, -6.0, -5.0, -4.0, -3.2, -2.4, -1.4, -0.4, 0.6, 1.6,
          2.4, 3.0, 3.6, 4.4, 5.4, 6.5, 7.5, 8.5, 9.6]
    a.loft("Fuselage", fuselage_rings(ys, H_TOP, H_BOT, H_HALF, n=24, p=2.6), paint, part="Body", smooth=50)

    # Stepped tandem canopy: faceted panes (flat roof, sloped sides) over the gunner (front, low)
    # and the pilot (rear, high).
    rings = []
    for y, w, zb, zt in H_CANOPY:
        rings.append([(w, y, zb), (0.6 * w, y, zt), (-0.6 * w, y, zt), (-w, y, zb), (-0.9 * w, y, zb - 0.35), (0.9 * w, y, zb - 0.35)])
    a.loft("Canopy", rings, glass, part="Body", smooth=None)

    # One wide faired engine deck behind the pilot's canopy (both engines under one cowling).
    # Head-on it is a single broad hump: separate round nacelle fronts beside the mast read as
    # two round shapes above the canopy in the draft. Intakes are side grilles (paint); the
    # exhausts leave the rear corners turned outward, out of the head-on view.
    deck = []
    for yy, ww, zt in ((-3.7, 0.55, 1.5), (-3.2, 1.0, 1.85), (-2.6, 1.38, 2.08), (-1.8, 1.52, 2.18), (1.2, 1.52, 2.18),
                       (2.1, 1.4, 2.05), (2.8, 1.05, 1.75)):
        zb = 0.9
        zc, hh = (zt + zb) / 2, (zt - zb) / 2
        ring = []
        for k in range(24):
            ang = k / 24 * math.tau
            c, sn = math.cos(ang), math.sin(ang)
            ring.append((ww * math.copysign(abs(c) ** (2 / 3.2), c), yy, zc + hh * math.copysign(abs(sn) ** (2 / 3.2), sn)))
        deck.append(ring)
    a.loft("Engine deck", deck, paint, part="Body", smooth=55)
    for side, tag in ((-1, "L"), (1, "R")):
        # Exhausts point straight sideways and a little up: neither the front nor the back view
        # looks into them, so there are no two dark round openings above the boom.
        ex = Vector((side * 1.0, 0.0, 0.25)).normalized()
        start = Vector((side * 1.1, 1.75, 1.55))
        right = Vector((1.0, 0.0, 0.0)).cross(ex).normalized()
        up = ex.cross(right).normalized()
        rings = []
        for t, rr in ((0.0, 0.34), (0.35, 0.34), (0.7, 0.31)):
            c = start + ex * t
            rings.append([tuple(c + (right * math.cos(q) + up * math.sin(q)) * rr) for q in (k * math.tau / 14 for k in range(14))])
        a.loft(f"Exhaust {tag}", rings, paint, part="Body", cap_start=False, cap_end=False, smooth=55)
        inner = [[tuple(Vector(q) + (start + ex * 0.7 - Vector(q)) * 0.12) for q in rings[-1]],
                 [tuple(Vector(q) + (start + ex * 0.25 - Vector(q)) * 0.12) for q in rings[-1]]]
        a.loft(f"Exhaust liner {tag}", inner, liner, part="Body", cap_start=False, cap_end=True, smooth=55)

    # Mast fairing, mast and the main-rotor head (static parts of Body below the hub).
    mx, my = H_MAST
    fair = []
    for zz, ww, ll in ((2.05, 0.8, 2.6), (2.35, 0.62, 2.0), (2.6, 0.34, 1.1), (2.7, 0.2, 0.6)):
        fair.append([(mx + ww * math.cos(t), my + ll / 2 * math.sin(t), zz) for t in (k * math.tau / 14 for k in range(14))])
    a.loft("Mast fairing", fair, paint, part="Body", smooth=55)
    a.cyl("Mast", 0.18, 0.5, (mx, my, 2.85), hubz, part="Body", segs=10)

    # Stub wings with plain empty pylons and tip pods (countermeasure housings).
    for side, tag in ((-1, "L"), (1, "R")):
        f = wing_frame(-0.25, side, math.radians(-7))
        sle = lambda s: -1.7 + (s - 0.8) * 0.12
        sch = lambda s: 2.0 - (s - 0.8) * 0.22
        surface(a, f"Stub wing {tag}", paint, "Body", f, [0.8, 1.6, 2.6, 3.6], sle, sch, 0.12, samples=8)
        tip = Vector(f(3.65, 0.0, 0.0))
        pod = []
        for yy, rr in ((-1.75, 0.02), (-1.45, 0.17), (-1.0, 0.24), (0.3, 0.24), (0.6, 0.15), (0.75, 0.03)):
            pod.append([(tip.x + rr * math.cos(t), yy, tip.z - 0.02 + rr * math.sin(t)) for t in (k * math.tau / 10 for k in range(10))])
        a.loft(f"Tip pod {tag}", pod, paint, part="Body", smooth=55)
        a.box(f"Tip light {tag}", (0.05, 0.3, 0.06), (tip.x + side * 0.22, -1.2, tip.z), light, part="Body")
        for k, s in enumerate((1.7, 2.8)):
            wz = f(s, 0.0, 0.0)[2] - 0.12
            a.prism(f"Pylon {tag}{k}", [(-1.4, wz + 0.05), (-0.9, wz - 0.42), (0.1, wz - 0.42), (0.25, wz + 0.05)],
                    side * s - 0.07, side * s + 0.07, rail, part="Body", axis="x")
    # Tail: swept fin, horizontal stabiliser, tail skid, antennas.
    ff = fin_frame(0.0, 0.55, math.radians(-4), 1)
    fle = lambda s: 7.2 + s * 0.55
    fch = lambda s: 2.3 - s * 0.32
    surface(a, "Fin", paint, "Body", ff, [0.0, 1.0, 2.0, 3.05], fle, fch, 0.13, samples=8)
    for side, tag in ((-1, "L"), (1, "R")):
        hf = wing_frame(0.6, side, math.radians(4))
        surface(a, f"Stabiliser {tag}", paint, "Body", hf, [0.0, 0.3, 1.2, 2.0], lambda s: 7.6 + s * 0.2, lambda s: 1.15 - s * 0.15,
                0.12, samples=6)
    a.cyl("Tail rotor gearbox", 0.22, 0.45, (H_TAIL_HUB[0] - 0.25, H_TAIL_HUB[1], H_TAIL_HUB[2]), hubz, part="Body", segs=10,
          rot=(0, math.radians(90), 0))
    a.beam("Tail skid", (0.0, 8.6, 0.35), (0.0, 9.4, -0.25), 0.08, rail, part="Body", segs=6)
    for i, (y, zz, h, flip) in enumerate(((-4.6, -1.65, -0.35, -1), (0.0, -1.6, -0.3, -1), (5.0, 0.85, 0.3, 1))):
        a.prism(f"Blade {i}", [(y + u, zz - flip * 0.03 + v) for u, v in ((0.0, 0.0), (0.55, 0.0), (0.4 + abs(h) * 0.4, h), (abs(h) * 0.4, h))],
                -0.025, 0.025, rail, part="Body", axis="x")

    # Main rotor (separate part, origin at the hub): hub, four blades at 45 degrees to the body axis.
    hub = (mx, my, H_HUB_Z)
    a.cyl("Rotor hub", 0.55, 0.32, hub, hubz, part="MainRotor", segs=14)
    a.cyl("Rotor cap", 0.32, 0.25, (mx, my, H_HUB_Z + 0.28), hubz, part="MainRotor", segs=12, r2=0.12)
    for k in range(4):
        ang = math.radians(45 + 90 * k)
        rotor_blade(a, f"Main blade {k}", rotor, "MainRotor", hub, ang, 0.45, H_ROTOR_R, 0.55, 0.08, droop=0.25)
        c, s = math.cos(ang), math.sin(ang)
        a.beam(f"Blade grip {k}", (mx + 0.3 * c, my + 0.3 * s, H_HUB_Z), (mx + 1.1 * c, my + 1.1 * s, H_HUB_Z), 0.26, hubz,
               part="MainRotor", h=0.16)
    a.metadata["pivots"]["MainRotor"] = hub
    # Tail rotor (separate part, origin at its hub) on the left (port, +X) side of the fin.
    a.cyl("Tail hub", 0.2, 0.22, H_TAIL_HUB, hubz, part="TailRotor", segs=10, rot=(0, math.radians(90), 0))
    for k in range(4):
        rotor_blade(a, f"Tail blade {k}", rotor, "TailRotor", (H_TAIL_HUB[0] + 0.05, H_TAIL_HUB[1], H_TAIL_HUB[2]),
                    math.radians(20 + 90 * k), 0.15, H_TAIL_R, 0.26, 0.05, axis="x")
    a.metadata["pivots"]["TailRotor"] = H_TAIL_HUB

    exhaust = (0.0, 3.0, 1.75)
    a.finish(origin="center", attachments={"leftWingtip": (-3.9, -0.5, -0.7), "rightWingtip": (3.9, -0.5, -0.7),
                                           "exhaust": exhaust},
             closeup=((0.0, -6.6, 1.3), (-1.0, -1.4, 0.55), 10.0), extra_notes={
        "noText": "No letters, numbers, call signs, serials, codes or glyph-like marks in mesh or texture; countershading, splinter camouflage, panel lines, plain grey intake slats and stains only.",
        "noRealMilitaryInsignia": "No roundels, flags, national or unit markings; the only marking is a plain dark-red fin-top band. Original design, not a copy of any real or game helicopter (narrow faceted tandem fuselage, one wide faired engine deck with side intakes, stub wings with tip pods, swept fin with a port tail rotor).",
        "noFaces": "No faces or figures: no crew is modelled and the canopy panes are opaque, tinted only slightly lighter and bluer than the paint, with body-colour frames. Head-on, both engines sit under one wide body-colour engine deck behind the pilot's canopy (no separate round nacelle fronts and no dark intake openings; the intakes face sideways), there is no chin turret, gun or sensor ball, and the nose is a plain pointed fairing. Checked in preview-front, preview-closeup-front, preview-closeup-front-3q, preview-front-low, preview-front-high and preview-closeup-canopy.",
        "noGoreOrWeaponsGlorification": "No gun, rockets or missiles: the stub wings carry two small empty pylons each and smooth tip pods. No damage or gore.",
    })
    review_pack(a, AIRCRAFT_VIEWS, {
        "closeup-front": ((0.0, -7.0, 0.9), (0.0, -1.0, 0.04), 12.0),
        "closeup-front-3q": ((0.0, -6.5, 1.0), (-0.65, -1.0, 0.2), 9.0),
        "closeup-front-low": ((0.0, -6.0, 0.4), (0.05, -1.0, -0.45), 11.0),
        "closeup-canopy": ((0.0, -6.2, 1.5), (-1.0, -0.25, 0.45), 6.5),
        "closeup-rotor-head": ((0.0, -0.6, 2.6), (-0.8, -1.0, 0.5), 6.5),
        "closeup-tail": ((0.4, 8.4, 1.8), (1.0, 0.6, 0.3), 7.0),
        "closeup-stub-wing": ((-2.2, -1.0, -0.3), (-0.8, -1.0, -0.35), 6.0),
    }, 1024, {
        "rotors": {
            "MainRotor": {"hub": roblox_model(a.shift(hub)), "axis": "Roblox +Y", "radiusStuds": H_ROTOR_R, "blades": 4,
                          "note": "Part origin is the hub; spin about the part's Y axis."},
            "TailRotor": {"hub": roblox_model(a.shift(H_TAIL_HUB)), "axis": "Roblox X", "radiusStuds": H_TAIL_R, "blades": 4,
                          "note": "Part origin is the hub; spin about the part's X axis. On the helicopter's left (port) side, Roblox -X."},
        },
        "orientation": "Nose at Roblox -Z. The tail rotor is on the left (port) side: Blender +X, Roblox -X.",
        "design": "Original tandem-seat attack helicopter: narrow faceted fuselage, stepped two-pane canopy (gunner front and low, pilot behind and high), one wide faired engine deck behind the pilot's canopy with side intake grilles, exhausts pointing sideways at its rear corners, stub wings with two empty pylons and a tip pod each, swept fin, low stabiliser, four-blade main rotor (MainRotor part) and four-blade tail rotor (TailRotor part). No gun, sensor ball or weapons.",
        "sizeRationale": "Fuselage 20.2 studs nose to tail, main rotor 20 studs across. At the fighters' ~1.44 studs per metre a 14 m attack-helicopter fuselage with a 14 m rotor gives these sizes: 0.77x the Vanta v2's 26.4-stud length and 0.81x its 24.6 span, so it reads as smaller than a fighter but large enough to hit.",
    }, scale_ref={"folder": UPLOAD / "vanta-v2", "location": (-28.0, -2.0, 1.5), "target": (-13.0, 0.0, 1.0),
                  "direction": (-0.55, -1.0, 0.6), "distance": 60.0})


# --------------------------------------------------------------------------
# Elite squadron livery (Vanta v2 mesh)


@builder("vanta-v2-elite")
def vanta_v2_elite():
    a, attachments = vanta_v2_airframe(
        name="vanta-v2-elite", title="Vanta elite squadron livery (v2)", paint=vanta_paint("elite"),
        export_version="vanta-v2-elite-2", plain_rear=True,
        usage="Mission 5: the five-ship elite squadron that arrives as phase 1 ends. " + PENDING)
    a.finish(origin="center", hinges=a.metadata["hinges"], attachments=attachments, closeup=VANTA_CLOSEUP, extra_notes={
        **CHECK_NOTES,
        "noRealMilitaryInsignia": "No roundels, flags, national, squadron or unit markings, emblems or insignia; the livery is blue-black countershading with darker splinter camouflage, the fin and rudder in plain pale steel blue and one straight chordwise band across each outer wing. Airframe is the original Vanta v2 design.",
        "noLogosOrBrands": "No company, product, brand or squadron emblems; plain straight-edged colour fields only.",
        "noFaces": CHECK_NOTES["noFaces"] + " Rear (revision 2): the nozzles end in shallow lit metal plugs crossed by ten short radial vanes, with no dark liner, flame holder or centre cone; the dark-ended tail boom between them is removed and the flat aft end and lower aft skin are plain mid-grey metal, so the back view shows no dark round openings, central opening or dark band.",
    })
    review_pack(a, {
        **REVIEW_VIEWS,
        "3q-low-front-right": ((-0.9, -1.2, -0.7), "persp"),
        "front-low": ((0.0, -1.0, -0.4), "persp"),
        "back-low": ((0.0, 1.0, -0.35), "persp"),
        "back-high": ((0.0, 1.0, 0.5), "persp"),
    }, {
        "closeup-front": ((0.0, -8.0, 0.2), (0.0, -1.0, 0.06), 11.0),
        "closeup-wing-band": ((-9.8, 4.0, 0.0), (-0.4, -0.3, 1.0), 9.0),
        "closeup-fin": ((0.0, 7.5, 3.6), (1.0, 0.5, 0.3), 8.0),
        "closeup-rear": ((0.0, 11.4, -0.3), (0.0, 1.0, 0.05), 9.0),
        "closeup-rear-3q": ((0.0, 11.4, -0.3), (0.6, 1.0, 0.2), 9.0),
    }, 1024, {
        "variantOf": "vanta-v2",
        "design": "The uploaded Vanta v2 airframe (same parts, hinges and attachments; built by the shared aircraft_v2.vanta_v2_airframe) with a plain rear (plain_rear=True: shallow vaned nozzle plugs instead of dark liners with flame holder and cone, no tail boom, bare mid-grey aft end, no exhaust soot) and its own livery. Upper #1d222b and lower #2b313b blue-black countershading, splinter camouflage #151920/#262c36, radome #14171c, pale steel-blue #7f97a8 fin and rudder and outer-wing bands. Distinct from Vulture (dark grey with bone feather band) and Rusk (oxblood with gold pinstripe).",
        "sizeRationale": "Same airframe size as vanta-v2 (24.58 x 7.30 x 26.4 studs).",
    }, scale_ref={"folder": UPLOAD / "vanta-v2", "location": (30.0, 0.0, 0.0), "target": (15.0, 0.0, 0.0),
                  "direction": (0.15, -1.0, 0.6), "distance": 62.0})
