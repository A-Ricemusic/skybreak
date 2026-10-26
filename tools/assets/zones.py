"""Procedural surface recipes shared by the world and aircraft generators.

Each function returns a zone builder for ``Asset.zone``. Patterns use world
positions and true normals, so separate pieces of one asset line up and the
bake is independent of the UV layout. No pattern draws glyphs.
"""

from __future__ import annotations

from skyasset import Nodes, srgb, standard


def facade(n: Nodes):
    """Horizontal facade coordinate u, height z and a vertical-wall mask."""
    x, y, z = n.xyz(n.pos())
    nx, ny, nz = n.xyz(n.normal())
    u = n.add(n.mul(x, n.absf(ny)), n.mul(y, n.absf(nx)))
    wall = n.smooth(n.absf(nz), 0.35, 0.15)
    roof = n.smooth(nz, 0.55, 0.8)
    return x, y, z, u, wall, roof


def concrete(color="#9c9a94", *, joints=4.0, streak=0.3, dirt=0.35, rough=0.88, joint_depth=0.25, **kw):
    def pattern(n: Nodes, col):
        x, y, z, u, wall, roof = facade(n)
        j = n.maxf(n.mul(n.lines(u, joints * 2, 0.08), wall), n.mul(n.lines(z, joints, 0.08), wall))
        j = n.maxf(j, n.mul(n.maxf(n.lines(x, joints * 3, 0.1), n.lines(y, joints * 3, 0.1)), roof))
        col = n.vscale(col, n.sub(1.0, n.mul(j, 0.25)))
        return col, None, n.sub(0.5, n.mul(j, joint_depth))

    kw.setdefault("bump", 0.35)
    kw.setdefault("bump_scale", 2.5)
    return standard(color, rough, 0.0, streak=streak, base_dirt=dirt, grime=0.2, pattern=pattern, **kw)


def painted_metal(color, *, rough=0.55, metal=0.25, rust=0.2, streak=0.25, panels: float | None = 6.0, **kw):
    def pattern(n: Nodes, col):
        if panels is None:
            return col, None, None
        x, y, z, u, wall, roof = facade(n)
        line = n.maxf(n.lines(u, panels, 0.05), n.lines(z, panels * 0.7, 0.05))
        col = n.vscale(col, n.sub(1.0, n.mul(line, 0.2)))
        return col, n.mul(line, 0.1), n.sub(0.5, n.mul(line, 0.3))

    return standard(color, rough, metal, rust=rust, streak=streak, pattern=pattern, **kw)


def windows(wall_color, glass_color="#26333d", *, bay=6.0, win=4.0, floor=13.0, win_h=7.0, z0=2.0, z1=1e6,
            frame="#c8c9c4", rough=0.8, roof_color="#55575a", curtain: bool = False, mullion=0.25,
            lit: float = 0.0, siding: float | None = None, **kw):
    """Punched windows or a curtain wall on vertical faces, a flat roof colour on top."""

    def pattern(n: Nodes, col):
        x, y, z, u, wall, roof = facade(n)
        fz = n.sub(z, z0)
        within = n.mul(n.band(z, z0, z1, 0.05), wall)
        siding_h = 0.0
        if siding is not None:
            board = n.mul(n.lines(z, siding, 0.06), wall)
            col = n.vscale(col, n.sub(1.0, n.mul(board, 0.3)))
            siding_h = n.mul(board, 0.5)
        if curtain:
            # Glass everywhere with mullions every bay and a spandrel band at each slab.
            mull = n.maxf(n.lines(u, bay, mullion), n.lines(fz, floor, mullion * 0.8))
            spandrel = n.sub(1.0, n.rect(fz, floor, win_h, 0.5, 0.05))
            pane = n.mul(n.sub(1.0, n.maxf(mull, n.mul(spandrel, 0.85))), within)
            frame_mask = n.mul(mull, within)
        else:
            pane = n.mul(n.mul(n.rect(u, bay, win, 0.5), n.rect(fz, floor, win_h, 0.5)), within)
            outer = n.mul(n.mul(n.rect(u, bay, win + 0.6, 0.5), n.rect(fz, floor, win_h + 0.6, 0.5)), within)
            frame_mask = n.sub(outer, pane)
        # Per-window variation: blinds, reflections and the odd lit room.
        cell = n.vec(n.math("FLOOR", n.math("DIVIDE", u, bay)), n.math("FLOOR", n.math("DIVIDE", fz, floor)), 0.0)
        var = n.noise(n.vscale(cell, 1.37), 1.0, 1.0, 0.5)
        glass = n.vscale(srgb(glass_color), n.add(0.65, n.mul(var, 0.8)))
        if lit > 0:
            glass = n.vlerp(glass, srgb("#d9b878"), n.mul(n.smooth(var, 0.68, 0.72), lit))
        out = n.vlerp(col, srgb(frame), frame_mask)
        out = n.vlerp(out, glass, pane)
        out = n.vlerp(out, srgb(roof_color), roof)
        rough_delta = n.sub(n.mul(roof, 0.05), n.mul(pane, rough - 0.12))
        height = n.sub(n.sub(0.5, n.mul(pane, 0.6)), siding_h)
        return out, rough_delta, height

    kw.setdefault("streak", 0.18)
    kw.setdefault("base_dirt", 0.25)
    kw.setdefault("grime", 0.12)
    return standard(wall_color, rough, 0.0, pattern=pattern, **kw)


def corrugated(color, *, period=0.9, axis="u", rough=0.5, metal=0.45, rust=0.25, depth=0.5, **kw):
    """Corrugated sheet: sine ribs along u (vertical ribs) or z (horizontal ribs)."""

    def pattern(n: Nodes, col):
        x, y, z, u, wall, roof = facade(n)
        c = u if axis == "u" else z
        if axis == "y":
            c = y
        rib = n.math("SINE", n.mul(c, 6.2832 / period))
        h = n.add(0.5, n.mul(rib, depth * 0.5))
        col = n.vscale(col, n.add(0.94, n.mul(rib, 0.05)))
        return col, None, h

    return standard(color, rough, metal, rust=rust, streak=0.3, pattern=pattern, **kw)


def boards(color, *, width=1.1, axis="u", rough=0.85, trim=None, **kw):
    """Timber cladding: grooves every board width; vertical (u) or horizontal (z) boards."""

    def pattern(n: Nodes, col):
        x, y, z, u, wall, roof = facade(n)
        c = u if axis == "u" else z
        g = n.lines(c, width, 0.06)
        grain = n.noise(n.vmul(n.pos(), (6.0, 6.0, 0.4) if axis == "u" else (0.4, 0.4, 6.0)), 2.0, 3.0, 0.6)
        col = n.vscale(col, n.add(0.88, n.mul(grain, 0.2)))
        col = n.vscale(col, n.sub(1.0, n.mul(g, 0.35)))
        return col, None, n.sub(n.add(0.5, n.mul(grain, 0.1)), n.mul(g, 0.5))

    kw.setdefault("streak", 0.25)
    kw.setdefault("base_dirt", 0.4)
    kw.setdefault("base_dirt_height", 4.0)
    return standard(color, rough, 0.0, pattern=pattern, **kw)


def roof_tiles(color="#4a4b4e", *, course=0.9, rough=0.82, **kw):
    def pattern(n: Nodes, col):
        x, y, z, u, wall, roof = facade(n)
        g = n.lines(z, course * 0.5, 0.05)
        tile = n.noise(n.vscale(n.pos(), 1.5), 3.0, 1.0, 0.5)
        col = n.vscale(col, n.add(0.85, n.mul(tile, 0.3)))
        col = n.vscale(col, n.sub(1.0, n.mul(g, 0.3)))
        return col, None, n.sub(0.5, n.mul(g, 0.5))

    kw.setdefault("grime", 0.25)
    return standard(color, rough, 0.0, pattern=pattern, **kw)


def asphalt_deck(color="#4b4f53", *, rough=0.9, **kw):
    kw.setdefault("bump", 0.5)
    kw.setdefault("bump_scale", 6.0)
    return standard(color, rough, 0.05, grime=0.25, **kw)


def glass(color="#1d2a33", *, rough=0.08, metal=0.5, **kw):
    kw.setdefault("ao", 0.15)
    kw.setdefault("grime", 0.05)
    return standard(color, rough, metal, vary=0.03, **kw)


def rubber(color="#1c1c1d", **kw):
    return standard(color, 0.9, 0.0, grime=0.1, vary=0.05, **kw)


def rock(color="#7d7a72", *, color2="#5d5a54", lichen="#6c7152", rough=0.86, **kw):
    def pattern(n: Nodes, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        nx, ny, nz = n.xyz(n.normal())
        strata = n.noise(n.vmul(p, (0.25, 0.25, 1.6)), 0.6, 4.0, 0.6)
        col = n.vlerp(col, srgb(color2), n.smooth(strata, 0.4, 0.65))
        crack = n.smooth(n.voronoi(n.vmul(p, (1.0, 1.0, 1.6)), 0.09, "DISTANCE_TO_EDGE"), 0.035, 0.0)
        crack = n.mul(crack, n.smooth(n.noise(p, 0.3, 3.0, 0.5), 0.45, 0.6))
        speck = n.noise(p, 9.0, 2.0, 0.5)
        col = n.vscale(col, n.add(0.88, n.mul(speck, 0.24)))
        col = n.vscale(col, n.sub(1.0, n.mul(crack, 0.45)))
        lich = n.mul(n.smooth(nz, 0.35, 0.8), n.smooth(n.noise(p, 0.5, 5.0, 0.65), 0.5, 0.62))
        col = n.vlerp(col, srgb(lichen), n.mul(lich, 0.55))
        h = n.add(n.mul(n.noise(p, 1.2, 6.0, 0.62), 0.9), n.mul(crack, -0.6))
        return col, n.mul(lich, 0.05), h

    kw.setdefault("ao", 0.45)
    kw.setdefault("ao_dist", 3.0)
    return standard(color, rough, 0.0, pattern=pattern, vary=0.1, grime=0.15, **kw)


def bark(color="#5b4636", **kw):
    def pattern(n: Nodes, col):
        p = n.pos()
        fur = n.noise(n.vmul(p, (3.0, 3.0, 0.25)), 2.5, 4.0, 0.65)
        col = n.vscale(col, n.add(0.7, n.mul(fur, 0.6)))
        return col, None, n.mul(fur, 1.0)

    return standard(color, 0.92, 0.0, pattern=pattern, ao=0.4, ao_dist=2.0, **kw)


def foliage(color="#3b5a2c", *, tip="#6f8a44", clump=0.6, radial_tip: float = 8.0, **kw):
    """Leaf / needle mass: clump cells, lighter outer tips, darker underside."""

    def pattern(n: Nodes, col):
        p = n.pos()
        x, y, z = n.xyz(p)
        nx, ny, nz = n.xyz(n.normal())
        cells = n.voronoi(p, clump, "F1", "EUCLIDEAN", "Distance")
        leaf = n.noise(p, 4.5, 3.0, 0.6)
        r = n.math("SQRT", n.add(n.mul(x, x), n.mul(y, y)))
        tipm = n.mul(n.smooth(r, radial_tip * 0.4, radial_tip), 0.7)
        col = n.vlerp(col, srgb(tip), n.clamp01(n.add(tipm, n.mul(n.smooth(nz, 0.2, 0.9), 0.3))))
        col = n.vscale(col, n.add(0.7, n.mul(leaf, 0.5)))
        col = n.vscale(col, n.lerp(0.55, 1.0, n.smooth(nz, -0.7, 0.2)))
        col = n.vscale(col, n.lerp(0.75, 1.05, n.smooth(cells, 0.9, 0.2)))
        h = n.add(n.mul(n.sub(1.0, cells), 0.8), n.mul(leaf, 0.6))
        return col, None, h

    kw.setdefault("ao", 0.55)
    kw.setdefault("ao_dist", 6.0)
    return standard(color, 0.8, 0.0, pattern=pattern, vary=0.12, vary_scale=0.15, grime=0.0, **kw)


def stripes(color_a, color_b, *, period=20.0, rough=0.6, metal=0.2, **kw):
    """Alternating height bands, e.g. aviation-obstruction mast paint."""

    def pattern(n: Nodes, col):
        x, y, z = n.xyz(n.pos())
        b = n.rect(z, period * 2, period, 0.25, 0.1)
        return n.vlerp(srgb(color_a), srgb(color_b), b), None, None

    return standard(color_a, rough, metal, pattern=pattern, rust=0.15, streak=0.2, **kw)
