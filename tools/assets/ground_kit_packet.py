#!/usr/bin/env python3
"""Generate exact-file review packet and mission inventory after validate:offline.
Uses the compiled campaign catalog, deduplicating IDs across expanded phases.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/qa/asset-reviews/military-ground-kit'
OUT.mkdir(parents=True, exist_ok=True)
runner = ROOT / 'build/offline-relay/ground-kit-inventory.luau'
runner.write_text('''local C=require("./MissionCatalog").MissionCatalog
local K=require("./MilitaryGroundKit").MILITARY_GROUND_KIT
for i=1,18 do
 local seen={}
 for _,p in C:ExpandedPhases(C:Get(i)) do
  for _,t in p.groundTargets or {} do
   if not seen[t.id] then
    seen[t.id]=true
    print(string.format("CONTACT\\t%d\\t%s\\t%s\\t%s",i,t.id,t.type,K[t.type] or "-"))
   end
  end
 end
end
''')
result = subprocess.run([os.environ['LUAU_BIN'], str(runner)], check=True, capture_output=True, text=True)
contacts = [dict(zip(('mission','id','type','kit'),line.split('\t')[1:])) for line in result.stdout.splitlines() if line.startswith('CONTACT\t')]
(OUT/'mission-inventory.json').write_text(json.dumps(contacts, indent=2)+'\n')
lines = ['# Military ground kit — independent review packet', '',
 'Status: **PENDING — NOT APPROVED, NOT UPLOADED**. Creator: implementation agent. Reviewer: unassigned. Review date/verdict: pending. No 10/10 safety assessment has been performed.', '',
 'All ten RobloxAssetIds are undefined. No Studio launch, upload or Player test. Before any upload an independent reviewer must inspect the exact FBX exports, all four included textures and their assembled UV/material appearance from every relevant angle, consult current official policies (including applicable linked policies), record reviewer/date and explicitly approve 10/10. A re-export invalidates any approval. A maximum project safety judgment cannot guarantee moderation outcomes.', '',
 'Policies for the reviewer to consult at review time: [Terms](https://www.roblox.com/termsofuse), [Community Standards](https://en.help.roblox.com/hc/en-us/articles/203313410-Roblox-Community-Standards/). This packet does not claim a current-policy review.', '',
 'Original procedural modeling only, no external models or textures. No figures, skin, text, flags, insignia or unit markings. Static covered gun barrels and sealed launch canisters are present: reviewer must assess them explicitly. Generator precheck booleans are creator declarations, not independent approval. No approval JSON is created.', '',
 'Generator: `tools/assets/military_ground_kit.py`, invoked through `tools/assets/build.py`. One atlas material and one mesh per model, four 256² PBR maps, maximum 2,500 triangles; centimetre FBX convention and bottom-centre pivot from skyasset. No Blender source file required; scripts regenerate every export. Versions are pinned per checklist. Track revisions have suffix `-track2`; truck rack revision has suffix `-rack2`.', '',
 'Runtime: `MilitaryGroundKit.ts` maps types; `GroundTargetFactory` fits each visual uniformly within the original bounds, retains invisible original query proxies and pre-decoration aim, and uses `WorldAssets.PlaceUploaded` with unchanged fallback on unset/failed IDs. World preload is bounded. D6 detail promotion uses the same factory; far cheap contacts deliberately keep their existing low-cost Part LOD. No target ID/position/footprint/health/score changes. Specialist generators, core and railguns are excluded. M10 semantic aliases are preserved; M15 already types 61 slots as vehicle, so this kit uses trucks there without inferring new barracks/tank roles. Future upload integration must verify orientation and appearance in Player; this branch cannot establish phone rendering or frame cost.', '',
 '## Mission inventory', '',
 'Counts are unique typed target IDs across expanded phases, including reserves and additions; not simultaneous contact counts or scenery counts. Generated from the compiled mission catalog with `tools/assets/ground_kit_packet.py`; full per-ID evidence is `mission-inventory.json`. M11, M13, M14 and M18 have no matching typed contacts (their specialist/protected scenery remains separate).', '',
 '| Asset | M01–06 | M07 | M08 | M09 | M10 | M11–14 | M15 | M16 | M17 | M18 | Total |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
checklists = sorted((ROOT/'assets/roblox-upload').glob('military-*/checklist.json'))
assert len(checklists) == 10, 'Expected all ten completed kit exports'
for path in checklists:
 c=json.loads(path.read_text())
 assert c['triangleCount'] <= 2500 and len(c['objects']) == 1
 assert len(c['textures']) == 4 and all(t['width'] == t['height'] == 256 for t in c['textures'])
 for name,digest in c['sha256'].items():
  assert hashlib.sha256((path.parent/name).read_bytes()).hexdigest() == digest, f'Stale checklist: {path.parent/name}'
for path in checklists:
 c=json.loads(path.read_text()); key='Military'+c['name'].removeprefix('military-').capitalize()
 groups=[range(1,7),[7],[8],[9],[10],range(11,15),[15],[16],[17],[18],range(1,19)]
 counts=[sum(int(t['mission']) in g and t['kit']==key for t in contacts) for g in groups]
 lines.append('| '+c['name']+' | '+' | '.join(map(str,counts))+' |')
lines+=['', 'Regenerate under one build lease: `JOBS=1 sh tools/assets/build-all.sh ' + ' '.join(p.parent.name for p in checklists) + '` (bump export versions first). After offline validation: `LUAU_BIN=... python3 tools/assets/ground_kit_packet.py`.', '', '## Exact exports and dependencies','', 'Every file below is relative to its asset folder under `assets/roblox-upload/`. Checklists also pin every dependency and preview hash. FBX embeds all four maps; standalone maps permit review. Checklists themselves are hashed here. No uploads are authorized by this packet.','']
for path in checklists:
 c=json.loads(path.read_text()); lines += ['### '+c['name'],'', f"Version `{c['exportVersion']}`; {c['triangleCount']} / {c['triangleLimit']} triangles; size {c['robloxSizeStuds']} studs; pivot `{c['pivot']}`; ID unset.",'', '| File | SHA-256 |','|---|---|']
 for f in sorted(path.parent.iterdir()):
  if f.is_file():lines.append(f'| `{f.relative_to(ROOT)}` | `{hashlib.sha256(f.read_bytes()).hexdigest()}` |')
 lines += ['', 'Preview list: '+', '.join('`'+p+'`' for p in c['previews'])+'. Contact sheet: `contact-sheet.png`.', '', 'Reviewer findings / exact-file inspection / policy links actually consulted / verdict: **pending**.', '']
(OUT/'exports-and-previews.txt').write_text('\n'.join(str(f.relative_to(ROOT)) for p in checklists for f in sorted(p.parent.iterdir()) if f.suffix == '.fbx' or f.name.startswith('preview-') or f.name == 'contact-sheet.png')+'\n')
(OUT/'README.md').write_text('\n'.join(lines).rstrip()+'\n')
print('GROUND_KIT_PACKET',len(checklists),'assets',len(contacts),'unique mission contacts')
