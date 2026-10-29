"""Blender regression check: unchanged default airframe against pre-revision-3 geometry.
Run with Blender --background --factory-startup --python tools/assets/check_vanta_default.py.
Hashes every vertex, polygon, material slot/index, metadata (hinges/pivots) and attachment.
"""
import sys,json,hashlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import aircraft_v2
x,attachments=aircraft_v2.vanta_v2_airframe()
import bpy
payload={'objects':[(o.name, [list(v.co) for v in o.data.vertices], [list(p.vertices) for p in o.data.polygons], [p.material_index for p in o.data.polygons], [m.name for m in o.data.materials]) for o in sorted(bpy.context.scene.objects,key=lambda o:o.name) if o.type=='MESH'], 'metadata':x.metadata,'attachments':attachments}
print('DEFAULT_AIRFRAME_SHA256', hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest())

assert hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest() == '0061228793c8c7f5579fe63f2a4cb8b0a14da974517425ee42e03221f7634f82', 'Default Vanta geometry/loader contract changed'
