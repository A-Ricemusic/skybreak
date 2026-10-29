#!/usr/bin/env python3
"""Collect every asset checklist into the upload manifest and the game's spec table.

    python3 tools/assets/write_manifest.py

Writes ``assets/roblox-upload/manifest.json`` and ``src/shared/UploadedAssetSpecs.ts``
(sizes, ground offsets, attachments and hinges the loaders need). Fails if any
checklist is missing, over budget or has a moderation check that is not true.

Aircraft specs are in **in-game** studs: the uploaded Kestrel and Vanta are scaled so
their length matches the procedural aircraft in ``assets/aircraft/*.mesh.json`` (the
size cameras, targeting and effects are tuned for). World props keep their authored
real-world size.
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
    "kestrel-v2": "KestrelV2",
    "vanta-v2": "VantaV2",
    "vanta-v2-vulture": "VantaV2Vulture",
    "vanta-v2-rusk": "VantaV2Rusk",
    "heavy-bomber": "HeavyBomber",
    "carrier": "Carrier",
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
# Procedural aircraft whose length the uploaded aircraft are fitted to.
PROCEDURAL = {"kestrel": "kestrel", "vanta": "vanta", "vanta-vulture": "vanta", "vanta-rusk": "vanta",
              "kestrel-v2": "kestrel", "vanta-v2": "vanta", "vanta-v2-vulture": "vanta", "vanta-v2-rusk": "vanta"}
# Version 2 aircraft must land in the 10k-15k triangle band (detail floor as well as a budget).
V2_AIRCRAFT = {"kestrel-v2", "vanta-v2", "vanta-v2-vulture", "vanta-v2-rusk"}
V2_TRIANGLES = (10000, 15000)
# Delivery parts the game renders see-through (SurfaceAppearance part Transparency).
GLASS_PARTS = ("Canopy",)
# Mobile texture budget (max map edge): aircraft 1024, small world props 256, large props 512.
SMALL_PROPS = {"container-stack", "farmhouse", "barn", "grain-silo", "radar-dish", "relay-mast", "pine", "broadleaf",
               "rock-a", "rock-b", "rock-c"}
LEGACY_FBX_METRES_PER_STUD = 0.28
REQUIRED_CHECKS = ("noText", "noLogosOrBrands", "noRealMilitaryInsignia", "noFaces", "noSuggestiveShapes",
                   "noGoreOrWeaponsGlorification", "originalDesign")
PREVIEWS = ("preview-front.png", "preview-side.png", "preview-top.png", "preview-3q.png")


def ts_vec(values) -> str:
    return "new Vector3(" + ", ".join(f"{v:g}" for v in values) + ")"


def texture_limit(folder: str) -> int:
    if folder in PROCEDURAL or folder == "heavy-bomber":
        return 1024
    return 256 if folder in SMALL_PROPS else 512


def game_scale(folder: str, authored) -> float:
    """Uniform factor from authored studs to in-game studs (1 for world props)."""
    if folder not in PROCEDURAL:
        return 1.0
    mesh = json.loads((ROOT / "assets" / "aircraft" / f"{PROCEDURAL[folder]}.mesh.json").read_text())
    return max(mesh["bounds"]["dimensions"]) / max(authored)


def scaled(values, k: float) -> list[float]:
    return [round(v * k, 4) for v in values]


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
        if folder in V2_AIRCRAFT and not V2_TRIANGLES[0] <= c["triangleCount"] <= V2_TRIANGLES[1]:
            problems.append(f"{folder}: {c['triangleCount']} triangles outside {V2_TRIANGLES[0]}-{V2_TRIANGLES[1]}")
        if folder in V2_AIRCRAFT and "preview-closeup.png" not in c["previews"]:
            problems.append(f"{folder}: v2 aircraft need preview-closeup.png")
        limit = texture_limit(folder)
        for t in c["textures"]:
            if t["width"] > limit or t["height"] > limit:
                problems.append(f"{folder}: texture {t['file']} exceeds {limit}")
            if not (UPLOAD / folder / t["file"]).exists():
                problems.append(f"{folder}: missing {t['file']}")
        for p in sorted(set(PREVIEWS) | set(c["previews"])):
            if not (UPLOAD / folder / p).exists():
                problems.append(f"{folder}: missing {p}")
        k = game_scale(folder, c["robloxSizeStuds"])
        fbx_mps = c.get("fbxMetresPerStud", LEGACY_FBX_METRES_PER_STUD)
        entries.append({
            "folder": folder,
            "robloxAssetIdsKey": key,
            "title": c["title"],
            "variantOf": c.get("variantOf"),
            # Only the FBX is uploaded: a Model import turns its embedded maps into a
            # SurfaceAppearance on every MeshPart (confirmed with the Kestrel pilot upload).
            "upload": [{"file": c["fbx"]["file"], "robloxAssetType": "Model", "from": "FBX (textures embedded)"}],
            "embeddedTextures": [{"file": t["file"], "role": t["role"]} for t in c["textures"]],
            "fbxMetresPerStud": fbx_mps,
            "expectedImportSizeStuds": scaled(c["robloxSizeStuds"], fbx_mps * 100),
            "gameSizeStuds": scaled(c["robloxSizeStuds"], k),
            "usage": c["usage"],
            "triangleCount": c["triangleCount"],
            "textures": [f"{t['file']} {t['width']}x{t['height']}" for t in c["textures"]],
            "textureLimit": limit,
            "robloxSizeStuds": c["robloxSizeStuds"],
            "allChecksTrue": c["allChecksTrue"],
            "previews": [f"{folder}/{p}" for p in c["previews"]],
        })
        lines = [f"\t{key}: {{", f"\t\tfolder: \"{folder}\",", f"\t\tkind: \"{'aircraft' if c['pivot'] == 'bounds-center' else 'world'}\",",
                 f"\t\tsize: {ts_vec(scaled(c['robloxSizeStuds'], k))},", f"\t\tauthoredSize: {ts_vec(c['robloxSizeStuds'])},",
                 f"\t\tgameScale: {round(k, 5):g},", f"\t\tgroundOffset: {round(c['groundOffsetStuds'] * k, 4):g},"]
        if c.get("attachments"):
            a = c["attachments"]
            lines.append("\t\tattachments: { " + ", ".join(f"{n}: {ts_vec(scaled(a[n], k))}" for n in ("leftWingtip", "rightWingtip", "exhaust")) + " },")
        glass = [o["name"] for o in c["objects"] if o["name"] in GLASS_PARTS]
        if glass:
            lines.append("\t\tglassParts: [" + ", ".join(f'"{g}"' for g in glass) + "],")
        if c.get("controlSurfaces"):
            lines.append("\t\tcontrolSurfaces: {")
            for name, h in c["controlSurfaces"].items():
                lines.append(f"\t\t\t{name}: {{ from: {ts_vec(scaled(h['from'], k))}, to: {ts_vec(scaled(h['to'], k))} }},")
            lines.append("\t\t},")
        lines.append("\t},")
        specs.append("\n".join(lines))
    if problems:
        print("\n".join(problems), file=sys.stderr)
        raise SystemExit(1)
    manifest = {
        "schema": "skybreak.roblox-upload-manifest.v1",
        "studMetres": 0.28,
        "fbxImport": "Roblox reads FBX centimetres as studs. Folders with fbxMetresPerStud 0.01 import at their authored size; "
                     "legacy 0.28 exports import 28x too large. The game rescales every import to gameSizeStuds.",
        "pipeline": "docs/roblox-asset-pipeline.md",
        "idsTable": "src/shared/RobloxAssetIds.ts",
        "assets": entries,
    }
    (UPLOAD / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    names = " | ".join(f'"{k}"' for k in KEYS.values())
    SPECS.write_text(
        "// Generated by tools/assets/write_manifest.py from assets/roblox-upload/*/checklist.json. Do not edit.\n"
        "// Sizes are Roblox studs; aircraft are bounds-centred, world props are bottom-centred and\n"
        "// groundOffset is the ground or waterline height above the model's lowest point. `size`,\n"
        "// attachments and hinges are in-game studs: authoredSize x gameScale, where aircraft are\n"
        "// fitted to the procedural aircraft's length and world props keep their authored size.\n\n"
        f"export type UploadedAssetName = {names};\n\n"
        "export interface HingeSpec {\n\tfrom: Vector3;\n\tto: Vector3;\n}\n\n"
        "export interface UploadedAssetSpec {\n\tfolder: string;\n\tkind: \"aircraft\" | \"world\";\n\tsize: Vector3;\n"
        "\tauthoredSize: Vector3;\n\tgameScale: number;\n\tgroundOffset: number;\n"
        "\tattachments?: { leftWingtip: Vector3; rightWingtip: Vector3; exhaust: Vector3 };\n"
        "\tcontrolSurfaces?: Record<string, HingeSpec>;\n"
        "\t/** Parts the loader makes see-through (the v2 canopy over its cockpit). */\n\tglassParts?: string[];\n}\n\n"
        "export const UploadedAssetSpecs: Record<UploadedAssetName, UploadedAssetSpec> = {\n"
        + "\n".join(specs) + "\n};\n"
    )
    print(f"MANIFEST {len(entries)} assets")


if __name__ == "__main__":
    main()
