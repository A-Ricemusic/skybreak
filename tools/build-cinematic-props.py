#!/usr/bin/env python3
"""Original cinematic furniture, authored in Blender; no third-party assets.
Run Blender --background --python tools/build-cinematic-props.py.
Uses the existing validated corner-normal mesh exporter, <=5000 triangles/prop.
"""
import json
import sys
import runpy
import math
from pathlib import Path
import bpy
p = runpy.run_path(str(Path(__file__).with_name('build-mission-assets.py')), run_name='cinematic_export')
box, cylinder = p['box'], p['cylinder']

def chair(c, m):
    # Padded aviator briefing chair: curved edge cushions, stitched channels,
    # tubular steel frame, sled feet and separate upholstered armrests.
    box('Seat cushion', (3.6, 3.5, .65), (0, 0, 2.5), c, m['Roof'], bevel=.22)
    back = box('Back cushion', (3.6, .65, 3.3), (0, 1.6, 4.15), c, m['Roof'], bevel=.24)
    back.rotation_euler[0] = math.radians(-8)
    for x in (-1.1, -.55, 0, .55, 1.1):
        seam = box('Upholstery seam', (.06, .035, 2.65), (x, 1.25, 4.195), c, m['Steel'])
        seam.rotation_euler[0] = math.radians(-8)
    for x in (-1.75, 1.75):
        for y in (-1.35, 1.35): cylinder('Frame upright', .13, 2.4, (x, y, 1.2), c, m['DarkMetal'], vertices=12)
        box('Sled foot', (.34, 4.1, .2), (x, 0, .12), c, m['DarkMetal'], bevel=.08)
        box('Arm cushion', (.65, 2.7, .4), (x, .1, 3.65), c, m['Roof'], bevel=.15)
        cylinder('Arm support', .12, 1.1, (x, -.8, 3.1), c, m['Steel'], vertices=12)
    box('Rear crossmember', (3.5, .22, .25), (0, 1.35, 1.1), c, m['Steel'], bevel=.06)

def desk(c, m):
    # Field control station: rolled lip, recessed drawers, panel seams,
    # ventilation slots, brass pulls and rubber foot pads.
    box('Worktop', (16, 9, .35), (0, 0, 4.8), c, m['Roof'], bevel=.12)
    for x in (-6, 6):
        box('Pedestal', (3.1, 7.4, 4.4), (x, .2, 2.35), c, m['Steel'], bevel=.12)
        for z in (1.2, 2.5, 3.8):
            box('Inset drawer', (2.7, .16, 1.1), (x, -3.55, z), c, m['DarkMetal'], bevel=.05)
            box('Drawer pull', (.9, .2, .12), (x, -3.75, z+.15), c, m['Warning'], bevel=.04)
        for y in (-2.6, 2.8): box('Rubber foot', (3.3, .65, .2), (x, y, .1), c, m['DarkMetal'], bevel=.05)
        for y in (-1.6, -.8, 0, .8, 1.6): box('Side vent', (.04, .4, 1.2), (x+1.57, y, 2.4), c, m['DarkMetal'])
    box('Rear cable tray', (9, .6, .5), (0, 3.4, 3.4), c, m['DarkMetal'], bevel=.08)

# Export canonical mesh inputs only; previews/Blender files are regenerable.
for slug, build in [('CinematicChair', chair), ('CinematicDesk', desk)]:
    p['reset_scene']()
    c = bpy.data.collections.new(slug); bpy.context.scene.collection.children.link(c)
    m = p['make_materials'](slug); build(c, m)
    objects = p['apply_and_consolidate'](c, slug)
    spec = p['AssetSpec'](slug, slug, build, 100, ((.1, 30), (.1, 30), (.1, 30)), ((25, -32, 20) if slug == 'CinematicDesk' else (11, -14, 9)))
    payload = p['export_json'](spec, objects, m)
    print(p['validate'](spec, payload))
    # Compact canonical data; generator and inspection renders are the review surface.
    (p['OUT'] / f'{slug.lower()}.mesh.json').write_text(json.dumps(payload, separators=(',', ':')) + '\n')

    if '--render' in sys.argv:
        data = bpy.data.lights.new('InspectionSun', 'SUN'); data.energy = 3
        light = bpy.data.objects.new('InspectionSun', data); bpy.context.scene.collection.objects.link(light)
        light.rotation_euler = (.4, -.3, -.6)
        p['render_asset'](spec)
