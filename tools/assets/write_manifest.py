#!/usr/bin/env python3
"""Collect every asset checklist into the upload manifest and the game's spec table.

    python3 tools/assets/write_manifest.py

Writes ``assets/roblox-upload/manifest.json`` and ``src/shared/UploadedAssetSpecs.ts``
(sizes, ground offsets, attachments and hinges the loaders need). Fails if any
checklist is missing, over budget or has a moderation check that is not true.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UPLOAD = ROOT / "assets" / "roblox-upload"
SPECS = ROOT / "src" / "shared" / "UploadedAssetSpecs.ts"

# Folder name -> RobloxAssetIds key, in manifest order.
KEYS = {
    "kestrel": "Kestrel",
    "vanta": "Vanta",
    "vanta-vulture": "VantaVulture",
    "vanta-rusk": "VantaRusk",
    "frigate": "Frigate",
    "oil-platform": "OilPlatform",
    "harbour-quay": "HarbourQuay",
    "container-stack": "ContainerStack",
    "gantry-crane": "GantryCrane",
    "hangar": "Hangar",
    "control-tower": "ControlTower",
    "office-midrise": "OfficeMidrise",
    "apartment-block": "ApartmentBlock",
    "city-tower": "CityTower",
    "farmhouse": "Farmhouse",
    "barn": "Barn",
    "grain-silo": "GrainSilo",
    "radar-dish": "RadarDish",
    "relay-mast": "RelayMast",
    "pine": "Pine",
    "broadleaf": "Broadleaf",
    "rock-a": "RockA",
    "rock-b": "RockB",
    "rock-c": "RockC",
}
REQUIRED_CHECKS = ("noText", "noLogosOrBrands", "noRealMilitaryInsignia", "noFaces", "noSuggestiveShapes",
                   "noGoreOrWeaponsGlorification", "originalDesign")
PREVIEWS = ("preview-front.png", "preview-side.png", "preview-top.png", "preview-3q.png")


def ts_vec(values) -> str:
    return "new Vector3(" + ", ".join(f"{v:g}" for v in values) + ")"


def main() -> None:
    entries, specs, problems = [], [], []
    for folder, key in KEYS.items():
        path = UPLOAD / folder / "checklist.json"
        if not path.exists():
            problems.append(f"{folder}: missing checklist.json")
            continue
        c = json.loads(path.read_text())
        for check in REQUIRED_CHECKS:
            if c["checks"].get(check, {}).get("value") is not True:
                problems.append(f"{folder}: {check} is not true")
        if c["triangleCount"] > c["triangleLimit"]:
            problems.append(f"{folder}: {c['triangleCount']} triangles over {c['triangleLimit']}")
        limit = 1024 if c["pivot"] == "bounds-center" else 512
        for t in c["textures"]:
            if t["width"] > limit or t["height"] > limit:
                problems.append(f"{folder}: texture {t['file']} exceeds {limit}")
            if not (UPLOAD / folder / t["file"]).exists():
                problems.append(f"{folder}: missing {t['file']}")
        for p in PREVIEWS:
            if not (UPLOAD / folder / p).exists():
                problems.append(f"{folder}: missing {p}")
        entries.append({
            "folder": folder,
            "robloxAssetIdsKey": key,
            "title": c["title"],
            "variantOf": c.get("variantOf"),
            "upload": [{"file": c["fbx"]["file"], "robloxAssetType": "Model", "from": "FBX (textures embedded)"}]
            + [{"file": t["file"], "robloxAssetType": "Image", "role": t["role"],
                "note": "SurfaceAppearance map; upload only if the FBX import does not carry it"} for t in c["textures"]],
            "usage": c["usage"],
            "triangleCount": c["triangleCount"],
            "textures": [f"{t['file']} {t['width']}x{t['height']}" for t in c["textures"]],
            "robloxSizeStuds": c["robloxSizeStuds"],
            "allChecksTrue": c["allChecksTrue"],
            "previews": [f"{folder}/{p}" for p in PREVIEWS],
        })
        lines = [f"\t{key}: {{", f"\t\tfolder: \"{folder}\",", f"\t\tkind: \"{'aircraft' if c['pivot'] == 'bounds-center' else 'world'}\",",
                 f"\t\tsize: {ts_vec(c['robloxSizeStuds'])},", f"\t\tgroundOffset: {c['groundOffsetStuds']:g},"]
        if c.get("attachments"):
            a = c["attachments"]
            lines.append("\t\tattachments: { " + ", ".join(f"{k}: {ts_vec(a[k])}" for k in ("leftWingtip", "rightWingtip", "exhaust")) + " },")
        if c.get("controlSurfaces"):
            lines.append("\t\tcontrolSurfaces: {")
            for name, h in c["controlSurfaces"].items():
                lines.append(f"\t\t\t{name}: {{ from: {ts_vec(h['from'])}, to: {ts_vec(h['to'])} }},")
            lines.append("\t\t},")
        lines.append("\t},")
        specs.append("\n".join(lines))
    if problems:
        print("\n".join(problems), file=sys.stderr)
        raise SystemExit(1)
    manifest = {
        "schema": "skybreak.roblox-upload-manifest.v1",
        "studMetres": 0.28,
        "pipeline": "docs/roblox-asset-pipeline.md",
        "idsTable": "src/shared/RobloxAssetIds.ts",
        "assets": entries,
    }
    (UPLOAD / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    names = " | ".join(f'"{k}"' for k in KEYS.values())
    SPECS.write_text(
        "// Generated by tools/assets/write_manifest.py from assets/roblox-upload/*/checklist.json. Do not edit.\n"
        "// Sizes are Roblox studs; aircraft are bounds-centred, world props are bottom-centred and\n"
        "// groundOffset is the ground or waterline height above the model's lowest point.\n\n"
        f"export type UploadedAssetName = {names};\n\n"
        "export interface HingeSpec {\n\tfrom: Vector3;\n\tto: Vector3;\n}\n\n"
        "export interface UploadedAssetSpec {\n\tfolder: string;\n\tkind: \"aircraft\" | \"world\";\n\tsize: Vector3;\n\tgroundOffset: number;\n"
        "\tattachments?: { leftWingtip: Vector3; rightWingtip: Vector3; exhaust: Vector3 };\n"
        "\tcontrolSurfaces?: Record<string, HingeSpec>;\n}\n\n"
        "export const UploadedAssetSpecs: Record<UploadedAssetName, UploadedAssetSpec> = {\n"
        + "\n".join(specs) + "\n};\n"
    )
    print(f"MANIFEST {len(entries)} assets")


if __name__ == "__main__":
    main()
