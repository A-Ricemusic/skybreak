"""Original naval silhouettes; no third-party geometry, textures or markings.
Regenerate via build.py. Blender X=beam, -Y=bow, Z=up; bottom-centre export.
Mounts deliberately separate; gameplay owns their existing offsets, not hull meshes.
"""
import math
from skyasset import Asset, standard
from m01_assets import review_pack, REVIEW_VIEWS
VERSION = 'naval-kit-2'
NAMES = ('frigate','destroyer','cruiser','container-ship','supply-ship','landing-ship','missile-boat','submarine','landing-craft','gun','aa','sam')

def build(kind):
    a = Asset('naval-'+kind, 'Naval kit '+kind, texture=256, tri_limit=2400, export_version=VERSION + ('-profile2' if kind=='missile-boat' else ''), seed=86,
              usage='Dormant cosmetic naval kit; existing target and collision proxies retained.')
    paint=a.zone('naval grey',standard('#7b858b',rough=.72,metal=.3,vary=.045,bump=.008))
    deck=a.zone('non slip deck',standard('#515d64',rough=.9,metal=.15,vary=.04))
    dark=a.zone('opaque glazing and recesses',standard('#293940',rough=.4,metal=.3))
    steel=a.zone('steel fittings',standard('#9ba3a5',rough=.55,metal=.65))
    box=a.box
    def bridge(y,z,w=15):
        box('Deckhouse',(w,28,12),(0,y,z+6),paint)
        box('Bridge',(w+2,13,7),(0,y-6,z+15),paint)
        for x in [-w*.32,0,w*.32]: box('Opaque bridge window',(w*.23,.2,2),(x,y-12.6,z+16),dark)
        a.cyl('Mast',.5,23,(0,y,z+31),steel,segs=8)
        box('Radar',(12,1,2),(0,y,z+40),paint)
        box('Exhaust casing',(7,9,12),(0,y+18,z+6),paint)
        box('Exhaust cap',(6,8,.3),(0,y+18,z+12.2),dark)
    if kind in ('gun','aa','sam'):
        a.cyl('Mount foundation',5,2,(0,0,1),paint,segs=16)
        a.cyl('Turntable',3.5,3,(0,0,3.5),steel,segs=12)
        box('Angular shield',(8,8,5),(0,0,7),paint)
        if kind=='sam':
            for x in [-3,0,3]:
                box('Sealed missile canister',(2.4,15,2.4),(x,-2,11),paint,rot=(.3,0,0))
                box('Closed cap',(2.5,.3,2.5),(x,-9.2,8.8),dark)
        else:
            for x in ([0] if kind=='gun' else [-1.5,1.5]):
                a.cyl('Closed barrel',.5 if kind=='gun' else .3,15,(x,-9,9),paint,segs=10,rot=(math.pi/2,0,0))
                a.cyl('Sealed muzzle',.55 if kind=='gun' else .35,.3,(x,-16.5,9),dark,segs=10,rot=(math.pi/2,0,0))
    elif kind=='submarine':
        rings=[]
        for y,r in [(-100,1),(-90,7),(-70,11),(65,11),(85,7),(100,1)]:
            rings.append([(r*math.cos(i*math.tau/16),y,11+r*math.sin(i*math.tau/16)) for i in range(16)])
        a.loft('Pressure hull',rings,paint)
        box('Sail',(7,22,12),(0,15,26),paint)
        for y in [9,18]: a.cyl('Retractable sensor',.45,8,(0,y,35),steel,segs=8)
        box('Diving planes',(28,8,1),(0,70,12),paint)
        box('Tail fin',(1,12,18),(0,88,15),paint)
    else:
        w,l = {'frigate':(30,240),'destroyer':(34,270),'cruiser':(40,310),'container-ship':(44,280),'supply-ship':(40,240),'landing-ship':(40,220),'missile-boat':(18,105),'landing-craft':(28,90)}[kind]
        rings=[]
        # Closed chine hull, narrow bow, transom stern, deck sheer. No weapons fused to hull.
        for y,f in [(-l/2,.02),(-l*.40,.65),(-l*.22,1),(l*.32,1),(l/2,.8)]:
            rings.append([(-w*f*.30,y,0),(w*f*.30,y,0),(w*f*.5,y,8),(w*f*.5,y,16),(-w*f*.5,y,16),(-w*f*.5,y,8)])
        a.loft('Chined hull',rings,paint)
        box('Weather deck',(w*.82,l*.68,.8),(0,l*.08,16.2),deck)
        if kind=='landing-craft':
            for x in [-w*.44,w*.44]: box('Well bulwark',(2,l*.70,8),(x,-5,20),paint)
            box('Closed bow ramp',(w*.8,2,9),(0,-l*.38,20),paint)
            box('Wheelhouse',(w*.45,14,12),(w*.2,l*.32,22),paint)
        else:
            bridge(l*.22,17,w*.55)
            if kind=='missile-boat':
                # Keep patrol craft deckhouse and sensor height proportional to its short hull.
                for obj,_ in a.pieces[2:]:
                    obj.location.z=17+(obj.location.z-17)*.48
                    obj.scale.z*=.48
            if kind=='container-ship':
                for x in [-w*.23,w*.23]:
                    for y in [-80,-45,-10,25]:
                        box('Unmarked cargo container',(w*.4,30,19),(x,y,26),paint)
                        for dy in [-10,0,10]: box('Cargo rib',(.3,1,17),(x+w*.2,y+dy,26),steel)
            elif kind=='supply-ship':
                for y in [-65,-25]:
                    box('Cargo hatch',(w*.7,30,3),(0,y,19),deck)
                a.beam('Cargo crane pedestal',(w*.3,0,17),(w*.3,0,43),2,paint)
                a.beam('Cargo crane boom',(w*.3,0,43),(0,-35,40),1.5,paint)
            elif kind=='landing-ship':
                box('Vehicle deck',(w*.7,l*.5,3),(0,-l*.17,18),deck)
                box('Closed ramp',(w*.65,2,10),(0,-l*.4,21),paint)
            elif kind=='missile-boat':
                for x in [-w*.34,w*.34]: box('Equipment housing',(3,20,5),(x,5,20),paint)
            else:
                # Distinct sensor/exhaust silhouettes rather than scaled copies.
                if kind=='frigate':
                    box('Single funnel',(7,11,15),(0,0,30),paint)
                    box('Funnel cap',(7.2,11.2,1),(0,0,38),dark)
                    a.cyl('Search radome',3,4,(0,l*.22,61),paint,segs=12,r2=1)
                elif kind=='destroyer':
                    for y in [-12,20]:
                        box('Separated exhaust stack',(8,10,19),(0,y,30),paint)
                        box('Stack cap',(8.2,10.2,1),(0,y,40),dark)
                    for x in [-1,1]:
                        box('Fixed sensor panel',(.6,10,7),(x*w*.29,l*.22,37),deck)
                elif kind=='cruiser':
                    box('Broad centre citadel',(w*.6,55,15),(0,8,28),paint)
                    for y in [-20,38]:
                        a.cyl('Secondary lattice mast',.7,32,(0,y,45),steel,segs=8)
                        box('Secondary radar',(17,2,4),(0,y,60),paint)
                box('Forward deckhouse',(w*.55,l*.22,8),(0,-l*.12,21),paint)
                if kind=='cruiser': box('Aft deckhouse',(w*.6,35,9),(0,l*.37,21),paint)
            # Low-poly deck rails and ladders stay within the authored footprint.
            for x in [-w*.43,w*.43]:
                for y in [-l*.18,0,l*.18,l*.36]:
                    a.beam('Rail stanchion',(x,y,17),(x,y,21),.25,steel)
                a.beam('Deck rail',(x,-l*.18,21),(x,l*.36,21),.25,steel)
            for x in [-w*.35,w*.35]:
                for y in [-l*.28,l*.35]: a.cyl('Bollard',.65,2,(x,y,18),steel,segs=8)
    a.finish(extra_notes={'originalDesign':'SKYBREAK build agent via tools/assets/naval_kit.py (this PR). Original procedural modelling and textures only; no people, text, insignia, flags or national markings.'})
    review_pack(a,REVIEW_VIEWS,{},256,{'kitVersion':VERSION},review_status='PENDING independent exact-file 10/10 review; NOT approved; NOT uploaded')
BUILDERS={'naval-'+k:(lambda kind=k:build(kind)) for k in NAMES}
