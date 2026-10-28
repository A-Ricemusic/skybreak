#!/usr/bin/env python3
"""Original Broken Relay props. Shares the canonical corner-normal exporter.
Run: Blender --background --python tools/build-relay-assets.py
No textures, credentials, downloaded models or uploaded IDs.
"""
import runpy
import math
from pathlib import Path
import bpy
from mathutils import Vector
pipeline = runpy.run_path(str(Path(__file__).with_name('build-mission-assets.py')), run_name='relay_export_library')
box, cylinder = pipeline['box'], pipeline['cylinder']

def relay(c, m):
    box('Footing', (44,44,3),(0,0,1.5),c,m['Concrete'])
    box('EquipmentCabinet',(18,14,15),(0,0,10.5),c,m['Steel'],bevel=.4)
    for x in (-13,13):
        for y in (-13,13):
            cylinder('TowerLeg', .9,64,(x,y,35),c,m['DarkMetal'],vertices=8)
    for z in (22,38,54,67):
        for y in (-13,13): box('CrossBrace',(28,1,1),(0,y,z),c,m['Accent'])
        for x in (-13,13): box('CrossBrace',(1,28,1),(x,0,z),c,m['Accent'])
    for z in (30,46,62):
        for y in (-13,13):
            bar = box('Diagonal',(36, .8,.8),(0,y,z),c,m['Steel'])
            bar.rotation_euler[1]=math.radians(33)
    for side in (-1,1):
        box('AntennaPanel',(4,8,21),(side*15,0,60),c,m['Steel'],bevel=.5)
        box('AntennaStripe',(4.2,1,18),(side*15,-4.2,60),c,m['Warning'])
    cylinder('Mast',.75,24,(0,0,76),c,m['Accent'],vertices=10)
    cylinder('Beacon',1.4,2,(0,0,89),c,m['Warning'],vertices=12)
    box('AccessDoor',(7,.5,10),(0,-7.4,8),c,m['DarkMetal'])

def silo(c,m):
    cylinder('ConcretePad',21,3,(0,0,1.5),c,m['Concrete'],vertices=24)
    cylinder('Tank',17,52,(0,0,29),c,m['Steel'],vertices=24)
    for z in (5,17,29,41,53): cylinder('TankBand',17.35,1,(0,0,z),c,m['DarkMetal'],vertices=24)
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=17.5,radius2=2,depth=13,location=(0,0,61.5))
    pipeline['finish'](bpy.context.object,c,m['Roof'],smooth=True)
    cylinder('RoofVent',2,4,(0,0,70),c,m['Warning'],vertices=12)
    for z in range(7,55,4): box('LadderRung',(5,1,.5),(0,-17.5,z),c,m['Accent'])
    for x in (-2.5,2.5): box('LadderRail',(.6,1,52),(x,-18,29),c,m['DarkMetal'])
    box('FuelNotice',(9,.6,7),(0,-17.5,16),c,m['Warning'])

def truck(c,m):
    box('Chassis',(15,35,3),(0,0,7),c,m['DarkMetal'],bevel=.5)
    box('Cab',(15,12,11),(0,-11,14),c,m['Accent'],bevel=.8)
    box('Windshield',(12,.5,4),(0,-17.3,16.5),c,m['Glass'])
    box('Cargo',(14,21,12),(0,6,15),c,m['Steel'],bevel=.6)
    box('RadioBox',(7,7,4),(0,4,23),c,m['DarkMetal'])
    cylinder('Whip',.2,12,(4,8,28),c,m['Warning'],vertices=8)
    for x in (-8,8):
        for y in (-11,10): cylinder('Wheel',4,2,(x,y,5),c,m['DarkMetal'],vertices=16,rotation=(0,math.pi/2,0))
    for x in (-5,5): box('Headlamp',(2,.6,2),(x,-17.4,11),c,m['Warning'])

def launch(c,m):
    # Pointed bow faces Blender -Y / Roblox -Z.
    mesh=pipeline['mesh_object']('Hull',[(-11,24,2),(11,24,2),(-13,-13,2),(13,-13,2),(0,-33,2),(-9,21,-7),(9,21,-7),(-10,-12,-7),(10,-12,-7),(0,-29,-5)],[(0,1,3,4,2),(5,7,9,8,6),(0,5,6,1),(0,2,7,5),(1,6,8,3),(2,4,9,7),(4,3,8,9)],c,m['DarkMetal'])
    box('Deck',(21,35,2),(0,3,3),c,m['Steel'])
    box('Cabin',(15,16,12),(0,5,10),c,m['Accent'],bevel=.8)
    box('ForwardGlass',(12,.5,5),(0,-3.3,12),c,m['Glass'])
    cylinder('Antenna',.4,14,(0,7,23),c,m['Warning'],vertices=8)
    for x in (-10,10): box('Rail',(.5,35,1),(x,3,9),c,m['Steel'])
    cylinder('BowBeacon',1.2,2,(0,-19,5),c,m['Warning'],vertices=12)

original_render = pipeline['render_asset']
def lit_render(spec):
    data=bpy.data.lights.new('InspectionSun','SUN'); data.energy=2.5
    obj=bpy.data.objects.new('InspectionSun',data); bpy.context.scene.collection.objects.link(obj)
    obj.rotation_euler=(math.radians(25),math.radians(-20),math.radians(-35))
    original_render(spec)
pipeline['build_asset'].__globals__['render_asset']=lit_render

specs = [
    pipeline['AssetSpec']('CommsRelay','Broken Relay communications mast',relay,100,((43,45),(89,91),(43,45)),(130,-150,100)),
    pipeline['AssetSpec']('GrainSilo','Broken Relay fuel silo',silo,100,((41,43),(71,73),(41,43)),(105,-125,85)),
    pipeline['AssetSpec']('RelayTruck','Broken Relay utility truck',truck,100,((17,19),(33,35),(34,36)),(60,-75,48)),
    pipeline['AssetSpec']('HarborLaunch','Broken Relay evidence launch',launch,100,((25,27),(36,38),(56,58)),(75,-100,55)),
]
for spec in specs:
    print(pipeline['build_asset'](spec))
print('BROKEN_RELAY_ASSETS_COMPLETE')
