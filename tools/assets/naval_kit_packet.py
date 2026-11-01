#!/usr/bin/env python3
"""Pin exact local naval exports and all dependencies. Does not grant approval."""
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/qa/asset-reviews/naval-kit'
OUT.mkdir(parents=True,exist_ok=True)
lines=['# Naval kit — pending independent review','',
'Status: **NOT APPROVED; NOT UPLOADED**. Reviewer/date/verdict: unassigned / pending / pending. Creator cannot approve these exports. No Studio or Player verification.',
'', 'Creator provenance: **SKYBREAK build agent via tools/assets/naval_kit.py (this PR)**. Export version: `naval-kit-2`. Original procedural modelling and procedural atlas textures only; no third-party sources. One joined mesh, one atlas material, four 256×256 PBR maps, maximum 2,400 triangles per asset. No crew, people, skin, text, real names, hull numbers, national insignia, flags or ensigns. Static weapons use sealed barrels and canisters. Creator declarations are not independent review evidence.',
'', 'Before ANY upload, an independent reviewer must inspect exact FBX exports, all textures and assembled UV/material appearance on every surface and relevant angle; consult current [Roblox Terms](https://www.roblox.com/termsofuse), [Community Standards](https://en.help.roblox.com/hc/en-us/articles/203313410-Roblox-Community-Standards/) and applicable linked policies; record reviewer/date, hashes, previews examined, findings and explicit 10/10 approval in the existing `docs/qa/asset-reviews/approvals/*.json` format. No approval record is fabricated by this creator. Re-export requires new review. A maximum project judgment cannot guarantee moderation or account outcomes.',
'', '## Mission inventory (source-derived, not observed in Player)',
'', '| Mission | Hulls / scenery | Separate mounts |','|---|---|---|',
'| M06 | 36: 6 destroyers, 9 cruisers, 3 submarines, 3 missile boats, 3 supply ships, 3 landing ships, 3 container ships, 6 frigates | 18 defence pontoons: 6 gun, 6 AA, 6 SAM; original +180 X offset / Y48 retained |',
'| M09 | 6 frigates and 6 friendly landing craft; existing Carrier remains | No new mounts invented; shore batteries unchanged |',
'| M17 | 4: cruiser, destroyer, submarine, supply ship | 7 guns: existing Y80 and Z−60/+60 offsets retained |',
'', 'Evidence: `m06TargetLayout`, `buildM09Plan`, `M17_TARGETS`. M06 frigate combat labels remain destroyer; visual lookup preserves the layout frigate class. M17 unresolved layout hulls retain the existing typed combat allocation. No new target IDs, mount offsets, health, scores, routes or sinking rules.',
'', '## Integration and pivots',
'', '`NavalKit.ts` maps hull classes and naval-only mounts. Bottom-centre pivots and uniform fit within the pre-decoration bounds follow the military ground kit pattern. Aim is captured first; original parts remain query/collision proxies and fallback. Visuals are non-queryable, non-colliding and non-flight-solid. Each placement is individually bounded by the existing 24-instance kit allowance and counted by WorldInstanceBudget; oversized imports are destroyed before proxies are hidden. M09 scenery overlays preserve its original hull/well proxies and existing uploaded frigate fallback. All 12 IDs remain undefined. No FBX is embedded in the place. Mounts are separate target-owned models and retain D2/D12 ownership, promotion, route and death semantics.',
'', 'Future owner import: preserve single mesh/material, bottom-centre pivot, authored units and -Z bow; verify fit, alignment, sinking and phone rendering before activation. These exports contain no fused weapon targets. Review packet and offline checks cannot establish actual device performance.',
'', 'Rebuild: `JOBS=1 sh tools/assets/build-all.sh '+ ' '.join('naval-'+k for k in ('frigate','destroyer','cruiser','container-ship','supply-ship','landing-ship','missile-boat','submarine','landing-craft','gun','aa','sam'))+'`; then `python3 tools/assets/naval_kit_packet.py`. Bump export version before changing exports.', '', '## Exact files and hashes','']
records=[]; exports=[]
for path in sorted((ROOT/'assets/roblox-upload').glob('naval-*/checklist.json')):
 c=json.loads(path.read_text()); assert c['triangleCount']<=2400 and len(c['objects'])==1
 assert len(c['textures'])==4
 lines += ['### '+c['name'],'',f"Version `{c['exportVersion']}`, triangles {c['triangleCount']}/2400; size {c['robloxSizeStuds']}; pivot `{c['pivot']}`; asset ID undefined.",'','| Path | SHA-256 |','|---|---|']
 hashes={}
 for f in sorted(path.parent.iterdir()):
  if not f.is_file():continue
  key=str(f.relative_to(ROOT));digest=hashlib.sha256(f.read_bytes()).hexdigest();hashes[key]=digest
  lines.append(f'| `{key}` | `{digest}` |')
  if f.suffix=='.fbx' or f.name.startswith('preview-') or f.name=='contact-sheet.png':exports.append(key)
 records.append({'asset':c['name'],'exportVersion':c['exportVersion'],'creator':'SKYBREAK build agent via tools/assets/naval_kit.py (this PR)','triangleCount':c['triangleCount'],'sha256':hashes,'previews':c['previews'],'pendingApprovalRecord':{'asset':c['name'],'exportVersion':c['exportVersion'],'embeddedTextures':{t['file']:hashes[str((path.parent/t['file']).relative_to(ROOT))] for t in c['textures']},'uploadSet':{c['fbx']['file']:hashes[str((path.parent/c['fbx']['file']).relative_to(ROOT))]},'reviewedAt':None,'record':'docs/qa/asset-reviews/naval-kit/README.md','approved':False,'score':None,'reviewer':None,'uploadAssetType':'Model','checklistSha256':hashes[str(path.relative_to(ROOT))]},'reviewer':None,'reviewedAt':None,'approved':False,'score':None,'status':'pending independent review; no upload'})
assert len(records)==12
(OUT/'README.md').write_text('\n'.join(lines)+'\n')
(OUT/'pending-exports.json').write_text(json.dumps(records,indent=2)+'\n')
(OUT/'exports-and-previews.txt').write_text('\n'.join(exports)+'\n')
print('NAVAL_PACKET',len(records),'pending exports')
