"""Original modular infrastructure, using the existing mission-mesh exporter.
Blender --background --python tools/build-world-kit.py
No external meshes, textures, downloads or asset uploads.
"""
import importlib.util
import json
import math
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location('mission', Path(__file__).with_name('build-mission-assets.py'))
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)

def runway(c, mat):
    # 100-stud modules, not a stretched runway block: crowned pavement,
    # drainage shoulders, continuous edge paint and discrete centre dashes.
    m.mesh_object('Pavement', [(-50,-50,0), (0,-50,.35), (50,-50,0),(-50,50,0),(0,50,.35),(50,50,0),(-50,-50,-1),(50,-50,-1),(-50,50,-1),(50,50,-1)], [(0,3,4,1),(1,4,5,2),(6,8,3,0),(2,5,9,7),(6,0,1,2,7),(8,9,5,4,3),(6,7,9,8)], c, mat['DarkMetal'])
    for side in [-1,1]:
        m.box('DrainageShoulder', (10,100,.4),(side*55,0,-.3),c,mat['Concrete'])
        m.box('EdgePaint',(1,100,.06),(side*46,0,.07),c,mat['Concrete'])
    m.box('CentreDash',(2.5,40,.06),(0,0,.42),c,mat['Concrete'])

def road(c, mat):
    # Full cross section: shoulder, shallow camber, dashed centre and edges.
    verts=[(-16,-50,0),(-12,-50,.3),(0,-50,.6),(12,-50,.3),(16,-50,0),(-16,50,0),(-12,50,.3),(0,50,.6),(12,50,.3),(16,50,0)]
    m.mesh_object('CamberedRoad',verts,[(i,i+5,i+6,i+1) for i in range(4)],c,mat['DarkMetal'])
    for side in [-1,1]:
        m.box('GravelShoulder',(3,100,.3),(side*17.5,0,-.15),c,mat['Concrete'])
        m.box('EdgePaint',(.35,100,.06),(side*11,0,.39),c,mat['Concrete'])
    m.box('CentreDash',(.45,35,.06),(0,0,.65),c,mat['Warning'])

def cliff(c, mat):
    # Deterministic stratified buttress: closed irregular cross sections.
    verts=[]
    for j,(z,reach) in enumerate([(0,38),(12,30),(38,26),(42,31),(70,20),(76,26),(100,12)]):
        for i in range(9):
            x=-100+i*25
            y=-reach-5*math.sin(i*1.7+j*.9)
            verts.append((x,y,z))
        verts.extend([(100,24,z),(-100,24,z)])
    faces=[]
    for j in range(6):
        for i in range(11):
            faces.append((j*11+i,j*11+(i+1)%11,(j+1)*11+(i+1)%11,(j+1)*11+i))
    faces.extend([tuple(reversed(range(11))),tuple(range(66,77))])
    m.mesh_object('LayeredButtress',verts,faces,c,mat['Concrete'])

# Infrastructure palettes have matte pavement and paint, never polished steel.
m.MATERIALS['DarkMetal'] = ((.055,.065,.075,1), .96, 0)
m.MATERIALS['Concrete'] = ((.58,.56,.51,1), .94, 0)
m.MATERIALS['Warning'] = ((.8,.62,.18,1), .9, 0)
specs=[m.AssetSpec('RunwayTile','SKYBREAK crowned runway module',runway,12,((119,121),(1,3),(99,101)),(160,-180,160)),m.AssetSpec('RoadTile','SKYBREAK cambered road module',road,12,((37,39),(.8,2),(99,101)),(85,-120,90)),m.AssetSpec('CliffTile','SKYBREAK stratified cliff buttress',cliff,100,((199,201),(99,101),(55,75)),(220,-240,175))]
def daylight_preview(spec):
    scene = m.bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.32,.4,.52,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
    light = m.bpy.data.lights.new('Daylight','SUN')
    light.energy = 3
    sun = m.bpy.data.objects.new('Daylight',light)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (.5,-.4,-.7)
    data = m.bpy.data.cameras.new('Inspection')
    data.type = 'ORTHO'
    data.ortho_scale = 280 if spec.slug == 'CliffTile' else 160
    camera = m.bpy.data.objects.new('Inspection',data)
    scene.collection.objects.link(camera)
    camera.location = spec.camera
    m.track_to(camera, m.Vector((0,0,0)))
    scene.camera = camera
    scene.render.filepath = str(m.OUT / (spec.slug.lower()+'-preview.png'))
    m.bpy.ops.render.render(write_still=True)
m.render_asset = daylight_preview
stats=[m.build_asset(s) for s in specs]
(m.OUT/'world-kit.stats.json').write_text(json.dumps(stats,indent=2)+'\n')
