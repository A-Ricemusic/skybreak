"""Round-trip every exported FBX through Blender's importer and compare with its checklist.

    Blender --background --factory-startup --python tools/assets/verify_fbx.py

Checks object names, triangle count, size (studs x the checklist's
``fbxMetresPerStud``: 0.01 for current exports, 0.28 for legacy ones) and that the
material still references four embedded image textures. Where a checklist has ``sha256``
hashes, every listed file must match; a checklist with an ``exportVersion`` must also
list every file in its folder (``skyasset.write_checklist``).
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

UPLOAD = Path(__file__).resolve().parents[2] / "assets" / "roblox-upload"
failures = []
for checklist in sorted(UPLOAD.glob("*/checklist.json")):
    c = json.loads(checklist.read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(checklist.parent / c["fbx"]["file"]))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    names = sorted(o.name for o in meshes)
    tris = 0
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    images = set()
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
        for slot in o.material_slots:
            if slot.material and slot.material.node_tree:
                images |= {n.image.name for n in slot.material.node_tree.nodes if n.type == "TEX_IMAGE" and n.image}
    size = hi - lo
    sx, sy, sz = c["robloxSizeStuds"]
    expected = Vector((sx, sz, sy)) * c.get("fbxMetresPerStud", 0.28)
    error = max(abs(a - b) / max(b, 1e-6) for a, b in zip(size, expected))
    want = sorted(o["name"] for o in c["objects"])
    hashes = c.get("sha256", {})
    bad = sorted(f for f, h in hashes.items()
                 if not (checklist.parent / f).is_file() or hashlib.sha256((checklist.parent / f).read_bytes()).hexdigest() != h)
    if "exportVersion" in c:
        bad += sorted(f"{p.name} (unlisted)" for p in checklist.parent.iterdir()
                      if p.is_file() and p.name != "checklist.json" and p.name not in hashes)
    ok = tris == c["triangleCount"] and error < 0.01 and names == want and len(images) >= 4 and not bad
    print(f"FBX {'OK  ' if ok else 'FAIL'} {checklist.parent.name}: objects={names} tris={tris} size_m={[round(v, 2) for v in size]} images={len(images)}"
          + (f" hashes={len(hashes)} {c.get('exportVersion', 'unversioned')}" if hashes else "") + (f" BAD {bad}" if bad else ""))
    if not ok:
        failures.append(checklist.parent.name)
print("FBX_VERIFY " + ("PASS" if not failures else "FAIL " + " ".join(failures)))
sys.exit(1 if failures else 0)
