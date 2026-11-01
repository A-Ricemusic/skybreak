"""Original mobile ground kit. Blender -b --factory-startup --python tools/assets/build.py -- military-tank ...
One baked 256² PBR atlas / mesh per asset. No external source assets. Re-export bumps VERSION.
"""
import math
from skyasset import Asset, standard
from world import frustum
from m01_assets import review_pack, REVIEW_VIEWS

VERSION = 'military-ground-kit-1'
NAMES = ('tank', 'sam', 'aa', 'artillery', 'bunker', 'radar', 'truck', 'fuel', 'barracks', 'containers')

def build(kind):
    a = Asset('military-'+kind, 'Ground kit '+kind, texture=256, tri_limit=2500,
              export_version=VERSION + ('-track2' if kind in ('tank', 'artillery') else '-rack2' if kind == 'truck' else ''), seed=71, usage='Dormant ground-target visual; existing proxy retains collision, aim and score.')
    paint = a.zone('olive paint', standard('#555e42', rough=.72, metal=.25, vary=.07, bump=.015))
    dark = a.zone('rubber and recesses', standard('#242a26', rough=.9, vary=.04))
    steel = a.zone('worn steel', standard('#73766b', rough=.6, metal=.7))
    concrete = a.zone('concrete', standard('#8b897b', rough=.95, bump=.045))
    glass = a.zone('opaque glazing', standard('#304247', rough=.24, metal=.25))
    box = a.box
    def wheel(x,y,z=2.3,r=2.3):
        a.cyl('Tire',r,1.5,(x,y,z),dark,segs=12,rot=(0,math.pi/2,0))
        a.cyl('Hub',r*.55,1.6,(x,y,z),steel,segs=10,rot=(0,math.pi/2,0))
    def chassis(tracked=True):
        frustum(a,'Sloped hull',paint,-7,-12,7,12,2.5,7,inset=1)
        if tracked:
            for x in [-7,7]:
                for z in [.3,3.7]: box('Track belt',(3,24,.6),(x,0,z),dark)
                for y in [-9,-5.4,-1.8,1.8,5.4,9]: wheel(x,y,2,1.8)
                for y in range(-11,12,2): box('Tread',(3.2,.45,.35),(x,y,4.1),steel)
                box('Side skirt',(1,22,2),(x*1.18,0,5),paint)
        else:
            for x in [-6.8,6.8]:
                for y in [-8,3,9]: wheel(x,y)
        for y in [5,7,9]: box('Engine grille',(8,.6,.2),(0,y,7.05),dark)
    if kind in ('tank','artillery'):
        chassis()
        a.cyl('Turret ring',4.5,1,(0,0,7.5),steel,segs=16)
        frustum(a,'Angular turret',paint,-5,-5,5,5,8,11.5 if kind=='tank' else 14,inset=1)
        z=10 if kind=='tank' else 12
        a.cyl('Mantlet',1.4,3,(0,-5,z),paint,segs=12,rot=(math.pi/2,0,0))
        a.cyl('Covered barrel',.55,16,(0,-13,z),paint,segs=10,rot=(math.pi/2,0,0))
        a.cyl('Closed muzzle cap',.68,1,(0,-21,z),dark,segs=10,rot=(math.pi/2,0,0))
        a.cyl('Closed hatch',1.5,.4,(1,1,z+1.8 if kind=='tank' else 14.2),steel,segs=12)
        box('Stowage rack',(8,2,2),(0,5,10),paint)
    elif kind in ('truck','sam'):
        chassis(False)
        frustum(a,'Cab',paint,-6,-12,6,-5,5,12,inset=.7)
        box('Windshield',(9,.15,2.5),(0,-11.5,10),glass)
        box('Bumper',(13,1,1),(0,-12.5,4),steel)
        if kind=='truck':
            box('Cargo bed',(12,15,1),(0,3.5,7),steel)
            for x in [-5.6,5.6]: box('Cargo side',(1,15,4),(x,3.5,9),paint)
            box('Tailgate',(12,1,4),(0,11,9),paint)
            for y in [-2,3,8]:
                box('Canvas hoop',(12,.4,.5),(0,y,12),dark)
                for x in [-5.6,5.6]: box('Hoop upright',(.4,.4,4),(x,y,10),dark)
        else:
            a.cyl('Launcher turntable',4,1,(0,3,8),steel,segs=12)
            for x in [-3.6,0,3.6]:
                for z in [10,13.4]:
                    box('Sealed launch canister',(3,16,3),(x,2,z),paint,rot=(math.radians(12),0,0))
    elif kind=='aa':
        a.cyl('Plinth',6,2,(0,0,1),concrete,segs=12)
        for x in [-5,5]: box('Outrigger',(2,16,1),(x,0,1),paint)
        a.cyl('Pivot',3,4,(0,0,4),paint,segs=12)
        box('Breech',(7,6,4),(0,0,7),paint)
        for x in [-2,2]:
            a.cyl('Covered tube',.45,17,(x,-6,10),paint,segs=8,rot=(math.radians(65),0,0))
        box('Shield',(9,1,5),(0,-2,7),paint,rot=(.2,0,0))
    elif kind=='bunker':
        frustum(a,'Battered walls',concrete,-18,-15,18,15,0,11,inset=2)
        box('Roof',(36,30,3),(0,0,12.5),concrete)
        box('Recessed slit',(20,.15,2),(0,-13.9,8),dark)
        box('Rear sealed door',(6,.2,8),(6,13.9,4),steel)
        for x in [-14,14]: box('Roof joint',(.15,28,.05),(x,0,14.03),dark)
    elif kind=='radar':
        box('Equipment shelter',(14,14,9),(0,2,4.5),paint)
        a.cyl('Pedestal',2,15,(0,0,14),steel,segs=12)
        # Concave dish: original lathed cross-section, closed rear skin, no external mesh.
        rings=[]
        for radius,depth in [(.7,0),(3,.2),(6,1),(9,2.5),(9,3),(6,1.5),(3,.7),(.7,.5)]:
            rings.append([(radius*math.cos(i*math.tau/24),-3-depth,22+radius*math.sin(i*math.tau/24)) for i in range(24)])
        a.loft('Dish',rings,paint)
        a.beam('Feed support',(0,-3,22),(0,-10,22),.35,steel)
        a.cyl('Feed',.7,1.5,(0,-10,22),paint,segs=8,rot=(math.pi/2,0,0))
    elif kind=='fuel':
        for x in [-10,10]:
            a.cyl('Storage tank',8,24,(x,0,12),paint,segs=24)
            a.cyl('Roof rim',8.2,.5,(x,0,24),steel,segs=24)
            a.cyl('Roof',8,.5,(x,0,24.4),paint,segs=24,r2=6)
            a.cyl('Vent',.7,2,(x+2,0,25.5),steel,segs=8)
            for z in [5,14]: a.cyl('Band',8.12,.35,(x,0,z),steel,segs=24)
    elif kind=='barracks':
        box('Foundation',(30,70,1),(0,0,.5),concrete)
        box('Walls',(28,68,13),(0,0,7.5),paint)
        a.prism('Pitched roof',[(-15,14),(0,19),(15,14)],-35,35,steel,axis='y')
        for x in [-14.1,14.1]:
            for y in [-25,-12,1,14,27]: box('Shutter',(0.15,5,4),(x,y,9),dark)
        box('Door',(6,.2,9),(0,-34.1,5),dark)
    elif kind=='containers':
        for x,y,z in [(-8,0,0),(8,0,0),(0,0,12)]:
            box('Container',(15,36,12),(x,y,z+6),paint)
            for dy in range(-16,17,3):
                for dx in [-7.6,7.6]: box('Corrugation',(.25,.5,10),(x+dx,dy,z+6),steel)
            for dx in [-4,4]: box('Door locking bar',(.3,.3,10),(x+dx,-18.15,z+6),steel)
    a.finish(extra_notes={
        'noGoreOrWeaponsGlorification':'Static original military equipment, sealed tubes/barrels, no crew, ammunition, firing effects, gore or celebratory presentation. Creator precheck only; independent policy review required.',
        'noSuggestiveShapes':'Original hard-surface equipment; creator precheck, independent inspection pending.'})
    review_pack(a, REVIEW_VIEWS, {}, 256, {'kitVersion':VERSION}, review_status='PENDING independent exact-file 10/10 safety review; NOT approved; NOT uploaded; dormant IDs')

BUILDERS = {'military-'+k: (lambda kind=k: build(kind)) for k in NAMES}
