"""Broken Relay cutscene desk props: the radio console, the field recorder, Sera's status board
and the tape tin.

    tools/assets/build-all.sh cinematic-radio-console cinematic-field-recorder cinematic-status-board cinematic-tape-tin

They replace the part-built desk props in ``src/client/RelayCinematic.tsx`` (receiver box,
cylinder reels, recorder box, slate on a post, coffee-tin cylinder) once an independent
reviewer approves them and the coordinator uploads them. Until then their ``RobloxAssetIds``
entries stay undefined and the cinematic keeps its procedural props.

All four are original designs (D-001): no copy of any real product, no text, numbers, dial
scales, brand marks, flags or insignia. Markings are plain colour fields only. No figures or
faces: the console's front is deliberately asymmetric (one wide window, a meter on one side, a
grille on the other, one tuning knob, a row of toggles) and its two reels lie flat on the top
deck, joined by the tape path, so no pair of round shapes faces the camera.

Sizes keep the procedural envelopes the camera poses were tuned for (``CinematicStaging``):
receiver 7 x 4 x 3 studs, recorder 2 x 1 x 3, board 5 x 3.2 on a stand reaching about 9.4,
tin 1.8 across and 1.7 tall. Each checklist records ``anchors`` (Roblox model space, relative
to the bottom-centre pivot) so the game can seat a model on its procedural stand-in's spot,
plus the reel hubs (``rotors``) and the recorder's lid hinge (``controlSurfaces``).

Sides: authored front -Y, Z up, so the model's right is Blender **-X**; the export and import
only rotate, so the front is Roblox -Z and the right Roblox +X.
"""

from __future__ import annotations

import math

from m01_assets import REVIEW_VIEWS, review_pack, roblox_model
from skyasset import Asset, Nodes, srgb, standard

BUILDERS: dict = {}

PENDING = ("Pending independent safety review (AGENTS.md); not uploaded. Dormant slot in src/: RobloxAssetIds entry "
           "undefined, so the cinematic keeps its procedural prop until approval and upload.")
STATUS = "pending independent safety review (AGENTS.md); not uploaded; dormant RobloxAssetIds slot (undefined) with procedural fallback"
VIEWS = {
    **REVIEW_VIEWS,
    "front-low": ((0.0, -1.0, -0.25), "persp"),
    "front-high": ((0.0, -1.0, 0.7), "persp"),
    "3q-low-front-right": ((-0.9, -1.2, -0.3), "persp"),
}
SMALL = dict(vary_scale=1.4, grime_scale=1.2, ao_dist=0.25, ao=0.3)


def builder(name):
    def wrap(fn):
        BUILDERS[name] = fn
        return fn
    return wrap


def prop(color, rough=0.55, metal=0.0, **kw):
    """``standard`` tuned for desk-sized props: blotches and AO at stud scale, not building scale."""
    return standard(color, rough, metal, **{**SMALL, **kw})


def slots(color, axis="z", spacing=0.12, width=0.45, depth=0.35, rough=0.6, metal=0.3):
    """Dark grille: parallel slots along ``axis`` (no glyphs, just evenly spaced lines)."""

    def pattern(n: Nodes, col):
        x, y, z = n.xyz(n.pos())
        coord = {"x": x, "y": y, "z": z}[axis]
        line = n.lines(coord, spacing, width)
        col = n.vscale(col, n.sub(1.0, n.mul(line, 0.65)))
        return col, n.mul(line, 0.2), n.sub(0.5, n.mul(line, depth))

    return prop(color, rough, metal, pattern=pattern)


def ring(r, z, segs=32):
    return [(r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z) for i in range(segs)]


def shifted(points, dx, dy):
    return [(x + dx, y + dy, z) for x, y, z in points]


def anchors(a: Asset, points: dict) -> dict:
    return {k: roblox_model(a.shift(p)) for k, p in points.items()}


# --------------------------------------------------------------------------
# Radio console


def reel(a: Asset, part: str, cx: float, cy: float, z0: float, zones: dict, pack: float) -> tuple:
    """A flat open-spoke tape reel lying on the deck, hub at the part origin; ``pack`` is the tape radius."""
    a.cyl(f"{part} flange", 0.85, 0.04, (cx, cy, z0 + 0.02), zones["reel"], part=part, segs=24)
    a.cyl(f"{part} tape", pack, 0.16, (cx, cy, z0 + 0.12), zones["tape"], part=part, segs=24)
    rings = [shifted(ring(0.85, z0 + 0.2), cx, cy), shifted(ring(0.85, z0 + 0.24), cx, cy),
             shifted(ring(0.66, z0 + 0.24), cx, cy), shifted(ring(0.66, z0 + 0.2), cx, cy)]
    a.loft(f"{part} rim", rings + [rings[0]], zones["reel"], part=part, cap_start=False, cap_end=False, smooth=30)
    for k in range(3):
        ang = 2 * math.pi * k / 3 + 0.3
        a.box(f"{part} spoke {k}", (0.5, 0.12, 0.04), (cx + math.cos(ang) * 0.42, cy + math.sin(ang) * 0.42, z0 + 0.22),
              zones["reel"], part=part, rot=(0, 0, ang))
    a.cyl(f"{part} hub", 0.17, 0.14, (cx, cy, z0 + 0.2), zones["steel"], part=part, segs=12)
    a.metadata.setdefault("pivots", {})[part] = (cx, cy, z0 + 0.14)
    return (cx, cy, z0 + 0.14)


@builder("cinematic-radio-console")
def radio_console():
    a = Asset("cinematic-radio-console", "Field radio console with reel-to-reel deck (cutscene desk prop)", texture=512,
              tri_limit=3500, bump_distance=0.02, seed=611, export_version="cinematic-radio-console-1",
              usage="Broken Relay cutscenes: Teal's receiver on the radio desk in every chapter; its two reels turn while a tape or the log speaks. " + PENDING)
    z = {
        "case": a.zone("case", prop("#34474c", 0.5, 0.35, grime=0.25, streak=0.2)),
        "panel": a.zone("panel", prop("#22292c", 0.6, 0.25, grime=0.2)),
        "window": a.zone("window", prop("#123533", 0.12, 0.35, ao=0.1, grime=0.05, vary=0.03)),
        "steel": a.zone("steel", prop("#9ba1a4", 0.32, 0.9, grime=0.15)),
        "meter": a.zone("meter", prop("#d6ceb2", 0.5, 0.0, grime=0.12)),
        "ink": a.zone("ink", prop("#1b1c1d", 0.5, 0.1, grime=0.0)),
        "grille": a.zone("grille", slots("#2a3033")),
        "knob": a.zone("knob", prop("#17191a", 0.55, 0.05, grime=0.1)),
        "deck": a.zone("deck", prop("#a7abad", 0.38, 0.85, streak=0.25, streak_axis="x", grime=0.12)),
        "reel": a.zone("reel", prop("#56636d", 0.32, 0.65, grime=0.1)),
        "tape": a.zone("tape", prop("#3b2a1e", 0.42, 0.1, grime=0.0, vary=0.03)),
        "keys": a.zone("keys", prop("#cdc8b7", 0.48, 0.0, grime=0.15)),
        "rubber": a.zone("rubber", prop("#1c1c1d", 0.9, 0.0, grime=0.1)),
        "dark": a.zone("dark", prop("#2a2e31", 0.5, 0.45, grime=0.2)),
    }
    # Housing 7 x 3 x 4 studs on rubber feet; front face at y = -1.5 like the procedural receiver.
    a.box("Housing", (6.9, 2.9, 3.9), (0.0, 0.0, 2.0), z["case"], bevel=0.1, bevel_segments=2)
    a.box("Front panel", (6.5, 0.06, 3.5), (0.0, -1.47, 2.0), z["panel"], bevel=0.02)
    for x in (-3.0, 3.0):
        for y in (-1.1, 1.1):
            a.box("Foot", (0.6, 0.5, 0.12), (x, y, 0.06), z["rubber"], bevel=0.03)
    # Front, deliberately asymmetric (no face reading): top row a long window on the model's right
    # (Blender -X) and one meter on its left; bottom row a wide grille under the window and the
    # tuning knob, a column of two small knobs and a column of three toggles on the left.
    wx, wz, ww = -0.9, 2.75, 4.2
    a.box("Frequency window", (ww, 0.05, 0.7), (wx, -1.51, wz), z["window"])
    for dz in (-0.4, 0.4):
        a.box("Window bezel", (ww + 0.2, 0.08, 0.1), (wx, -1.53, wz + dz), z["steel"], bevel=0.02)
    for x in (wx - ww / 2 - 0.05, wx + ww / 2 + 0.05):
        a.box("Window bezel", (0.1, 0.08, 0.8), (x, -1.53, wz), z["steel"], bevel=0.02)
    mx, mz = 2.35, 2.75
    a.box("Meter face", (1.3, 0.05, 0.8), (mx, -1.51, mz), z["meter"])
    a.box("Meter needle", (0.035, 0.03, 0.58), (mx + 0.08, -1.545, mz - 0.1), z["ink"], rot=(0, math.radians(28), 0))
    for dz in (-0.45, 0.45):
        a.box("Meter bezel", (1.5, 0.08, 0.09), (mx, -1.53, mz + dz), z["steel"], bevel=0.02)
    for x in (mx - 0.7, mx + 0.7):
        a.box("Meter bezel", (0.09, 0.08, 0.99), (x, -1.53, mz), z["steel"], bevel=0.02)
    a.box("Speaker grille", (3.4, 0.05, 1.4), (-1.3, -1.51, 1.15), z["grille"], bevel=0.03)
    a.cyl("Tuning knob", 0.38, 0.22, (1.3, -1.6, 1.2), z["knob"], segs=20, rot=(math.radians(90), 0, 0), bevel=0.03)
    a.cyl("Tuning knob cap", 0.22, 0.04, (1.3, -1.72, 1.2), z["steel"], segs=16, rot=(math.radians(90), 0, 0))
    for zz in (1.65, 0.85):
        a.cyl("Small knob", 0.15, 0.16, (2.3, -1.57, zz), z["knob"], segs=12, rot=(math.radians(90), 0, 0))
    for i, zz in enumerate((0.6, 1.2, 1.8)):
        a.box("Toggle plate", (0.26, 0.04, 0.32), (2.95, -1.505, zz), z["steel"])
        a.beam("Toggle lever", (2.95, -1.53, zz), (2.95, -1.72, zz + (0.07 if i % 2 else -0.07)), 0.06, z["steel"], segs=6)
    # Side carry handles.
    for x in (-3.58, 3.58):
        for y in (-0.8, 0.8):
            a.box("Handle standoff", (0.2, 0.18, 0.18), (x * 0.985, y, 2.9), z["dark"])
        a.beam("Handle", (x, -0.85, 2.9), (x, 0.85, 2.9), 0.18, z["steel"], segs=8)
    # Rear: heat-sink fins and two round connectors.
    for i in range(7):
        a.box("Heat sink fin", (0.07, 0.18, 1.9), (-1.8 + i * 0.6, 1.53, 2.3), z["dark"])
    for x in (2.3, 2.85):
        a.cyl("Connector", 0.15, 0.18, (x, 1.55, 1.0), z["steel"], segs=12, rot=(math.radians(90), 0, 0))
    # Top deck: brushed plate, two flat reels, the tape path through a head block, transport keys.
    a.box("Transport deck", (6.6, 2.7, 0.08), (0.0, 0.0, 3.99), z["deck"], bevel=0.02)
    top = 4.03
    # A nearly full supply reel and a nearly empty take-up reel, so the deck never reads as a pair of eyes.
    # They are also staggered front to back.
    hubs = {"ReelL": reel(a, "ReelL", 2.15, 0.3, top, z, 0.62), "ReelR": reel(a, "ReelR", -2.15, -0.1, top, z, 0.3)}
    a.box("Head block", (1.3, 0.55, 0.32), (0.0, -0.78, top + 0.16), z["dark"], bevel=0.05)
    a.box("Head cover", (0.7, 0.2, 0.24), (0.0, -0.98, top + 0.14), z["steel"], bevel=0.03)
    for x in (-1.0, 1.0):
        a.cyl("Tape guide", 0.07, 0.3, (x, -0.86, top + 0.15), z["steel"], segs=8)
    a.cyl("Capstan", 0.05, 0.32, (0.78, -1.02, top + 0.16), z["steel"], segs=8)
    a.cyl("Pinch roller", 0.12, 0.22, (0.78, -1.2, top + 0.13), z["rubber"], segs=12)
    for p0, p1 in (((2.15, -0.32), (1.0, -0.93)), ((1.0, -0.93), (-1.0, -0.93)), ((-1.0, -0.93), (-2.15, -0.4))):
        a.beam("Tape", (p0[0], p0[1], top + 0.12), (p1[0], p1[1], top + 0.12), 0.02, z["tape"], h=0.14)
    # Transport keys in a row along the front edge on the model's right, beside the head block.
    for i in range(5):
        a.box("Transport key", (0.26, 0.34, 0.12), (-1.5 - i * 0.3, -1.18, top + 0.06), z["keys"] if i != 3 else z["ink"],
              bevel=0.03)
    # A short whip antenna at the right rear corner, leaning back.
    a.cyl("Antenna base", 0.13, 0.3, (-3.05, 1.15, top + 0.15), z["dark"], segs=10)
    a.beam("Antenna whip", (-3.05, 1.15, top + 0.3), (-3.3, 1.75, top + 2.9), 0.05, z["steel"], segs=6)
    a.sphere("Antenna tip", 0.06, (-3.3, 1.75, top + 2.93), z["steel"], subdiv=1)
    window = (wx, -1.535, wz)
    a.finish(extra_notes={
        "noText": "No letters, numbers, dial scales, frequency markings, codes or glyph-like marks: the window is a plain dark teal pane, the meter a plain cream face with one needle, the grille parallel slots, the keys plain colour.",
        "noLogosOrBrands": "No maker's plate, badge or brand marks; a plain blue-grey painted housing.",
        "noRealMilitaryInsignia": "No flags, roundels, unit or national markings; an original field-radio layout, not a copy of any real set.",
        "noFaces": "No faces or figures. The front is deliberately asymmetric: top row a long window on the model's right and one small meter on its left; bottom row a wide slotted grille under the window, then one tuning knob, a column of two small knobs and a column of three toggles on the left. Nothing is paired across the centre line and there is no central feature under a pair. The two round reels lie flat on the top deck with visibly different tape packs (one nearly full, one nearly empty), staggered front to back and joined by the tape path; the head block is at the front centre and the transport keys run along the front edge on the right, so the top view reads as a tape transport, not a pair of eyes. Checked in preview-front, preview-front-low, preview-front-high, preview-closeup-front and preview-closeup-deck.",
        "noSuggestiveShapes": "Ordinary hard-surface radio equipment in every view.",
        "noGoreOrWeaponsGlorification": "A radio and tape deck: no weapons, damage or gore.",
    })
    review_pack(a, VIEWS, {
        "closeup-front": ((0.0, -1.5, 1.8), (0.0, -1.0, 0.15), 7.5),
        "closeup-deck": ((0.0, 0.0, 4.1), (-0.25, -0.8, 1.0), 6.5),
        "closeup-reel": ((2.15, 0.3, 4.2), (0.4, -0.9, 0.8), 3.2),
        "closeup-rear": ((0.0, 1.5, 2.2), (0.3, 1.0, 0.25), 7.0),
        "closeup-desk-camera": ((0.0, 0.0, 2.0), (-0.5, -1.0, 0.27), 20.0),
    }, 512, {
        "anchors": anchors(a, {"Body": (0.0, 0.0, 2.0), "FrequencyWindow": window}),
        "rotors": {name: {"hub": roblox_model(a.shift(h)), "axis": "Roblox +Y", "radiusStuds": 0.85, "blades": 3,
                          "note": "Tape reel lying flat on the deck; part origin is the hub; spin about the part's Y axis."}
                   for name, h in hubs.items()},
        "orientation": "Front (window, meter, grille, knobs) at Roblox -Z; the meter, knobs and toggles are on the model's left (Roblox -X), the long window, grille, transport keys and antenna on its right (Roblox +X).",
        "design": "Original field radio console: blue-grey painted steel housing, dark front panel with a long frequency window in a steel bezel, one analogue meter, a wide slotted speaker grille, one tuning knob, two small knobs and three toggles, side carry handles, rear heat-sink fins and connectors, and a brushed reel-to-reel transport on top (two open-spoke reels as ReelL and ReelR parts, tape path through a head block, capstan and pinch roller, five transport keys) and a short whip antenna.",
        "sizeRationale": "Housing 7 x 4 x 3 studs, the procedural receiver's envelope; the camera's radio and wide poses were tuned around it. Anchors.Body is the housing centre (the procedural receiver's centre, desk-relative (0, 7, 0)); anchors.FrequencyWindow is the centre of the 4.2 x 0.7 window's front face, where the game keeps a 4.0 x 0.6 glowing teal strip.",
        "cinematicUse": "Seat with model:PivotTo(target * CFrame.new(-anchors.Body)). Spin ReelL/ReelR about their own Y axis while a tape or the log speaks.",
    }, review_status=STATUS)


# --------------------------------------------------------------------------
# Field recorder


@builder("cinematic-field-recorder")
def field_recorder():
    a = Asset("cinematic-field-recorder", "Handheld cassette field recorder (cutscene desk prop)", texture=512,
              tri_limit=1800, bump_distance=0.015, seed=612, export_version="cinematic-field-recorder-1",
              usage="Broken Relay cutscenes: Teal's handheld recorder on the desk (recorder close-ups); the Lid part opens in chapter 25. " + PENDING)
    z = {
        "case": a.zone("case", prop("#62656b", 0.5, 0.5, vary=0.03, grime=0.12, streak=0.1)),
        "rubber": a.zone("rubber", prop("#1e1f20", 0.85, 0.0, grime=0.1)),
        "grille": a.zone("grille", slots("#34383b", axis="y", spacing=0.12, width=0.4)),
        "keys": a.zone("keys", prop("#d2cdbd", 0.45, 0.0, grime=0.2)),
        "record": a.zone("record", prop("#8a2a24", 0.45, 0.0, grime=0.15)),
        "door": a.zone("door", prop("#2b3033", 0.3, 0.2, grime=0.12)),
        "window": a.zone("window", prop("#3d4a4c", 0.08, 0.2, ao=0.1, grime=0.05, vary=0.02)),
        "lamp": a.zone("lamp", prop("#6e1512", 0.2, 0.0, ao=0.05, grime=0.0)),
        "dark": a.zone("dark", prop("#2a2d30", 0.5, 0.5, grime=0.15)),
        "mic": a.zone("mic", slots("#3a3e41", axis="x", spacing=0.05, width=0.5)),
    }
    # Body 2 x 3 x 1 studs (the procedural recorder box), rubber corner bumpers.
    a.box("Body", (2.0, 3.0, 1.0), (0.0, 0.0, 0.5), z["case"], bevel=0.12, bevel_segments=2)
    for x in (-0.93, 0.93):
        for y in (-1.43, 1.43):
            a.box("Corner bumper", (0.26, 0.26, 1.04), (x, y, 0.5), z["rubber"], bevel=0.06)
    # Top: speaker grille (front, model's right), three transport keys and a red record key (front, model's left).
    a.box("Speaker grille", (0.9, 0.6, 0.03), (-0.3, -0.9, 1.0), z["grille"], bevel=0.01)
    for i, x in enumerate((0.3, 0.55, 0.8)):
        a.box("Key", (0.21, 0.32, 0.12), (x, -1.12, 1.03), z["record"] if i == 2 else z["keys"], bevel=0.025)
    # Cassette door (Lid part) over the tape well, hinged along its rear edge; smoked window inset.
    hinge_y, hinge_z = 0.625, 1.03
    a.box("Tape well", (1.2, 0.75, 0.02), (0.0, 0.2, 1.0), z["dark"])
    a.box("Cassette door", (1.3, 0.85, 0.06), (0.0, 0.2, hinge_z), z["door"], part="Lid", bevel=0.015)
    a.box("Door window", (0.9, 0.42, 0.02), (0.0, 0.18, hinge_z + 0.035), z["window"], part="Lid")
    a.box("Door latch", (0.3, 0.06, 0.05), (0.0, -0.21, hinge_z + 0.02), z["dark"], part="Lid")
    a.metadata.setdefault("pivots", {})["Lid"] = (0.0, hinge_y, hinge_z)
    a.cyl("Hinge barrel", 0.035, 1.2, (0.0, hinge_y, hinge_z), z["dark"], segs=8, rot=(0, math.radians(90), 0))
    # Tally lamp at the rear on the model's left, where the game keeps its blinking red light.
    lamp = (0.6, 1.1, 1.08)
    a.cyl("Lamp housing", 0.12, 0.08, (0.6, 1.1, 1.02), z["dark"], segs=12)
    a.cyl("Lamp lens", 0.08, 0.06, (0.6, 1.1, 1.06), z["lamp"], segs=12)
    # One round microphone on the front end, a thumbwheel on the right side, a jack on the left; nothing paired on a side.
    a.cyl("Microphone", 0.22, 0.28, (0.0, -1.62, 0.55), z["mic"], segs=16, rot=(math.radians(90), 0, 0))
    a.cyl("Microphone ring", 0.25, 0.06, (0.0, -1.51, 0.55), z["dark"], segs=16, rot=(math.radians(90), 0, 0))
    a.cyl("Thumbwheel", 0.2, 0.08, (-1.04, 0.85, 0.6), z["rubber"], segs=16, rot=(0, math.radians(90), 0))
    a.cyl("Jack", 0.07, 0.06, (1.02, 0.9, 0.55), z["dark"], segs=8, rot=(0, math.radians(90), 0))
    a.finish(hinges={"Lid": ((-0.65, hinge_y, hinge_z), (0.65, hinge_y, hinge_z))}, extra_notes={
        "noText": "No letters, numbers, level marks, codes or glyph-like marks: keys are plain cream and one plain red, the grilles are parallel slots, the door a smoked pane.",
        "noLogosOrBrands": "No maker's badge or brand marks; a plain worn grey case.",
        "noRealMilitaryInsignia": "No flags, roundels or markings; an original recorder layout, not a copy of any real product.",
        "noFaces": "No faces or figures. The top has one grille, a row of three keys, the cassette door and one small lamp in an irregular layout; the front end carries a single round microphone, the right side a single thumbwheel and the left side a single small jack, never a pair. Checked in preview-top, preview-front, preview-closeup-top and preview-closeup-front.",
        "noSuggestiveShapes": "Ordinary hard-surface recorder in every view.",
        "noGoreOrWeaponsGlorification": "A tape recorder: no weapons, damage or gore.",
    })
    review_pack(a, VIEWS, {
        "closeup-top": ((0.0, 0.0, 1.0), (-0.3, -0.5, 1.0), 4.2),
        "closeup-front": ((0.0, -1.5, 0.55), (-0.2, -1.0, 0.2), 3.4),
        "closeup-lamp": ((0.6, 1.1, 1.05), (0.5, 0.7, 0.8), 1.6),
        "closeup-desk-camera": ((0.0, 0.0, 0.5), (-0.55, 0.8, 0.45), 7.5),
    }, 512, {
        "anchors": anchors(a, {"Centre": (0.0, 0.0, 0.5), "Lamp": lamp}),
        "orientation": "Microphone end at Roblox -Z; the keys and lamp are on the model's left (Roblox -X), the grille and thumbwheel on its right (Roblox +X).",
        "design": "Original handheld cassette field recorder: worn grey metal case with rubber corner bumpers, a slotted speaker grille, three cream transport keys and a red record key, a smoked cassette door (Lid part) over the tape well hinged along its rear edge, a red tally lamp, one round microphone on the front end, a side thumbwheel and a jack.",
        "sizeRationale": "Body 2 x 1 x 3 studs, the procedural recorder box's envelope (the recorder close-up pose frames it). Anchors.Centre is the body centre (the procedural box's CFrame); anchors.Lamp is the lens top where the game keeps its blinking neon light. controlSurfaces.Lid is the door hinge: rotate the Lid part about it (positive angle about Roblox +X lifts the door) for chapter 25.",
    }, review_status=STATUS)


# --------------------------------------------------------------------------
# Status board


@builder("cinematic-status-board")
def status_board():
    a = Asset("cinematic-status-board", "Rolling slate status board (cutscene set prop)", texture=512, tri_limit=1800,
              bump_distance=0.02, seed=613, export_version="cinematic-status-board-1",
              usage="Broken Relay cutscenes: Sera's board beside the radio desk; the game adds the three plain name strips (Teal's lit) in front of the slate. " + PENDING)

    def chalk(n: Nodes, col):
        p = n.pos()
        smudge = n.smooth(n.noise(n.vmul(p, (1.0, 1.0, 2.5)), 0.9, 4.0, 0.6), 0.55, 0.8)
        return n.vlerp(col, srgb("#5b6e69"), n.mul(smudge, 0.35)), None, None

    z = {
        "slate": a.zone("slate", prop("#1e322e", 0.85, 0.0, grime=0.1, pattern=chalk)),
        "alu": a.zone("alu", prop("#a8adb0", 0.35, 0.85, grime=0.15)),
        "backing": a.zone("backing", prop("#8f969a", 0.6, 0.4, grime=0.2)),
        "frame": a.zone("frame", prop("#3c4246", 0.5, 0.6, grime=0.25)),
        "rubber": a.zone("rubber", prop("#1c1c1d", 0.9, 0.0, grime=0.1)),
    }
    cz = 7.6
    a.box("Slate", (5.0, 0.25, 3.2), (0.0, 0.0, cz), z["slate"])
    a.box("Backing", (4.9, 0.03, 3.1), (0.0, 0.14, cz), z["backing"])
    for dz in (-1.66, 1.66):
        a.box("Board frame", (5.24, 0.32, 0.12), (0.0, 0.0, cz + dz), z["alu"], bevel=0.03)
    for x in (-2.56, 2.56):
        a.box("Board frame", (0.12, 0.32, 3.44), (x, 0.0, cz), z["alu"], bevel=0.03)
    # A thin ledge under each of the three name-strip rows (the game draws the strips on them).
    for dz in (0.9, 0.2, -0.5):
        a.box("Strip ledge", (3.7, 0.08, 0.05), (0.0, -0.165, cz + dz - 0.18), z["alu"])
    a.box("Marker tray", (3.6, 0.3, 0.08), (0.0, -0.28, cz - 1.68), z["alu"])
    a.box("Tray lip", (3.6, 0.04, 0.12), (0.0, -0.42, cz - 1.64), z["alu"])
    # Two uprights behind the board on wheeled feet, a crossbar and rear brackets.
    py = 0.24
    for x in (-2.4, 2.4):
        a.box("Upright", (0.16, 0.16, 9.25), (x, py, 0.15 + 9.25 / 2), z["frame"], bevel=0.03)
        a.box("Foot", (0.2, 2.4, 0.16), (x, py, 0.2), z["frame"], bevel=0.04)
        for y in (py - 1.1, py + 1.1):
            a.cyl("Caster", 0.12, 0.08, (x, y, 0.12), z["rubber"], segs=12, rot=(0, math.radians(90), 0))
        for dz in (-1.2, 1.2):
            a.box("Bracket", (0.22, 0.16, 0.3), (x, 0.18, cz + dz), z["frame"])
        a.sphere("Upright cap", 0.11, (x, py, 9.42), z["rubber"], subdiv=1)
    a.box("Crossbar", (4.8, 0.12, 0.12), (0.0, py, 1.7), z["frame"], bevel=0.02)
    a.finish(extra_notes={
        "noText": "No letters, numbers, writing or glyph-like marks: the slate is plain dark green with soft chalk-dust smudges; the game's name strips are blank colour bars.",
        "noLogosOrBrands": "No maker's marks; plain aluminium frame and dark painted stand.",
        "noRealMilitaryInsignia": "No flags, roundels or markings.",
        "noFaces": "No faces or figures; a plain rectangle on a two-post stand with three thin horizontal strip ledges.",
        "noSuggestiveShapes": "Ordinary office/workshop board in every view.",
        "noGoreOrWeaponsGlorification": "A status board: no weapons, damage or gore.",
    })
    review_pack(a, VIEWS, {
        "closeup-front": ((0.0, -0.12, cz), (0.0, -1.0, 0.05), 7.0),
        "closeup-foot": ((2.4, py, 0.3), (0.6, -1.0, 0.5), 3.5),
        "closeup-back": ((0.0, 0.2, cz), (0.2, 1.0, 0.1), 7.5),
    }, 512, {
        "anchors": anchors(a, {"Board": (0.0, 0.0, cz)}),
        "orientation": "Slate face at Roblox -Z; the marker tray is in front of it, the uprights and rear brackets behind it.",
        "design": "Original rolling status board: a dark green slate in an aluminium frame with a marker tray and three thin strip ledges, on two dark uprights with wheeled feet and a crossbar.",
        "sizeRationale": "Slate 5 x 3.2 x 0.25 studs centred 7.6 above the floor, the procedural board's envelope; anchors.Board is the slate centre (the procedural BOARD point, desk-relative (12.5, 7.6, 2.5)). The game keeps its name strips 0.15 in front of that point.",
    }, review_status=STATUS)


# --------------------------------------------------------------------------
# Tape tin


@builder("cinematic-tape-tin")
def tape_tin():
    a = Asset("cinematic-tape-tin", "Open coffee tin for cassette tapes (cutscene desk prop)", texture=256, tri_limit=1200,
              bump_distance=0.01, seed=614, export_version="cinematic-tape-tin-1",
              usage="Broken Relay cutscenes: the coffee tin of Teal's tapes on the desk from chapter 1; the game stands the remaining cassettes in it. " + PENDING)

    def label(n: Nodes, col):
        x, y, zz = n.xyz(n.pos())
        band = n.band(zz, 0.42, 1.3, 0.01)
        stripe = n.maxf(n.band(zz, 0.5, 0.54, 0.005), n.band(zz, 1.18, 1.22, 0.005))
        middle = n.band(zz, 0.74, 0.98, 0.005)
        col = n.vlerp(col, srgb("#d8caa2"), band)
        col = n.vlerp(col, srgb("#4d5a3c"), n.mul(middle, band))
        col = n.vlerp(col, srgb("#5a3420"), n.mul(stripe, band))
        return col, n.mul(band, 0.15), None

    z = {
        "tin": a.zone("tin", prop("#76302a", 0.45, 0.55, grime=0.25, rust=0.2, pattern=label)),
        "inner": a.zone("inner", prop("#5d5f61", 0.4, 0.8, grime=0.3, rust=0.15)),
    }
    profile = [(0.86, 0.0), (0.9, 0.04), (0.9, 0.28), (0.925, 0.31), (0.9, 0.34), (0.9, 1.38), (0.925, 1.41), (0.9, 1.44),
               (0.9, 1.62), (0.95, 1.665), (0.93, 1.705), (0.875, 1.705)]
    a.loft("Tin wall", [ring(r, h) for r, h in profile], z["tin"], cap_start=True, cap_end=False, smooth=40)
    a.loft("Tin inside", [ring(r, h) for r, h in ((0.875, 1.705), (0.86, 1.64), (0.86, 0.1))], z["inner"],
           cap_start=False, cap_end=True, smooth=40)
    a.finish(extra_notes={
        "noText": "No letters, numbers, brand name or glyph-like marks: the label is a plain cream band with two thin brown pinstripes and one olive band.",
        "noLogosOrBrands": "No coffee brand, logo or product marks; plain colour fields only.",
        "noRealMilitaryInsignia": "No flags, roundels or markings.",
        "noFaces": "No faces or figures; a plain open cylinder.",
        "noSuggestiveShapes": "An ordinary open tin in every view.",
        "noGoreOrWeaponsGlorification": "A tin can: no weapons, damage or gore.",
    })
    review_pack(a, VIEWS, {
        "closeup-inside": ((0.0, 0.0, 1.2), (-0.3, -0.4, 1.0), 3.2),
        "closeup-label": ((0.0, -0.9, 0.85), (0.2, -1.0, 0.15), 2.8),
    }, 256, {
        "anchors": anchors(a, {"Centre": (0.0, 0.0, 0.85)}),
        "orientation": "Rotationally symmetric; open end up (Roblox +Y).",
        "design": "Original open coffee tin: oxide-red painted steel with two rolled ribs and a rolled rim, a plain cream paper label band with brown pinstripes and an olive band, bare steel inside.",
        "sizeRationale": "1.9 studs across the rim, 1.7 tall: the procedural tin cylinder's envelope. anchors.Centre is the procedural TIN point (desk-relative (-5.2, 5.85, -2.6)); the game stands the cassettes in the open top.",
    }, review_status=STATUS)
