#!/usr/bin/env python3
"""Offline place asset inventory and fail-closed publication authorization.

No credentials/network/account-state access in inventory or validate(). Only the
publish CLI mode checks the canonical model HALT immediately before transport.
"""
from __future__ import annotations
import argparse
import base64
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

import roblox_upload as upload

ROOT = Path(__file__).resolve().parent.parent
VISUAL_PROPERTIES = {"MeshId", "MeshID", "TextureID", "TextureId", "Texture", "ColorMap",
                     "NormalMap", "MetalnessMap", "RoughnessMap", "AlphaMap", "OverlayTexture"}

@dataclass(frozen=True)
class Blob:
    name: str
    content: bytes

    @property
    def sha256(self):
        return hashlib.sha256(self.content).hexdigest()


def inventory(content: bytes) -> tuple[list[Blob], set[str]]:
    # ElementTree does not fetch external entities. Reject DTDs explicitly too.
    if b"<!DOCTYPE" in content or b"<!ENTITY" in content:
        raise RuntimeError("Place DTD/entities refused")
    root = ET.fromstring(content)
    if root.tag != "roblox":
        raise RuntimeError("Expected XML Roblox place")
    blobs, references = [], set()
    shared = {}
    for entry in root.findall("./SharedStrings/SharedString"):
        shared[entry.get("md5")] = base64.b64decode("".join((entry.text or "").split()), validate=True)
    for item in root.iter("Item"):
        props = item.find("Properties")
        if props is None:
            continue
        name = props.find("*[@name='Name']")
        name = name.text if name is not None else item.get("class", "unknown")
        for prop in props:
            field, text = prop.get("name", ""), "".join(prop.itertext())
            # Every StringValue payload is data, including non-JSON/custom mesh
            # encodings. Renaming fields inside the JSON must not evade review.
            if item.get("class") == "StringValue" and field == "Value" and text:
                if prop.tag != "string" or not re.fullmatch(r"[A-Za-z0-9_-]+", name):
                    raise RuntimeError("Unsupported embedded data encoding/name")
                blobs.append(Blob(name + ".json", text.encode()))
            if prop.tag in {"BinaryString", "SharedString"}:
                if prop.tag == "SharedString":
                    if text not in shared:
                        raise RuntimeError("Missing shared blob")
                    value = shared[text]
                else:
                    value = base64.b64decode("".join(text.split()), validate=True)
                if value:
                    digest = hashlib.sha256(value).hexdigest()
                    blobs.append(Blob(digest + ".bin", value))
            if field in VISUAL_PROPERTIES or prop.tag == "Content":
                value = text.strip()
                if value and value != "null":
                    match = re.fullmatch(r"rbxassetid://([1-9][0-9]*)", value)
                    if not match:
                        raise RuntimeError(f"Unrecognized content URI {name}.{field}: {value[:100]}")
                    references.add(match[1])
            # Runtime LoadAsset model catalog is compiled into this ModuleScript.
            if field == "Source" and name == "RobloxAssetIds":
                references.update(re.findall(r"\b\w+\s*=\s*([1-9][0-9]{5,})", text))
    # Unused shared blobs are still uploaded; don't let them bypass the gate.
    for value in shared.values():
        if value and not any(b.content == value for b in blobs):
            blobs.append(Blob(hashlib.sha256(value).hexdigest() + ".bin", value))
    return blobs, references


def approved_ids(root: Path) -> set[str]:
    manifest = upload.strict_json(upload.committed_file("assets/roblox-upload/manifest.json", root=root))
    if manifest.get("idsTable") != "src/shared/RobloxAssetIds.ts":
        raise RuntimeError("Unexpected uploaded asset catalog")
    table = upload.committed_file(manifest["idsTable"], root=root).decode()
    keys = {a["robloxAssetIdsKey"] for a in manifest["assets"]}
    return {value for key, value in re.findall(r"^\s*(\w+):\s*([1-9][0-9]*),", table, re.M) if key in keys}


def validate(content: bytes, *, root: Path = ROOT) -> tuple[list[Blob], set[str]]:
    blobs, references = inventory(content)
    failures = []
    for blob in blobs:
        try:
            upload.require_model_review(blob.name, blob.content, blob.sha256, root=root, embedded=True)
        except (RuntimeError, ValueError) as exc:
            failures.append(f"{blob.name} sha256={blob.sha256}: {exc}")
    try:
        unknown = references - approved_ids(root)
    except (RuntimeError, ValueError) as exc:
        failures.append("Uploaded ID catalog: " + str(exc))
        unknown = set()
    if unknown:
        failures.append("Unapproved referenced asset IDs: " + ", ".join(sorted(unknown)))
    if failures:
        raise RuntimeError("Place asset publication refused:\n" + "\n".join(failures))
    return blobs, references


def main_geometry_hashes(root: Path) -> set[str]:
    # Reproduce package-aircraft.ts JSON.stringify, using the previous main commit's project mapping.
    project = json.loads(subprocess.run(["git", "show", "origin/main^:default.project.json"],
                         cwd=root, check=True, capture_output=True).stdout)
    hashes = set()
    for name in project["tree"]["ServerStorage"]:
        if not name.endswith("Geometry"):
            continue
        stem = name[:-len("Geometry")].lower()
        folder = "aircraft" if stem in {"kestrel", "vanta"} else "mission"
        data = subprocess.run(["git", "show", f"origin/main^:assets/{folder}/{stem}.mesh.json"],
                              cwd=root, check=True, capture_output=True).stdout
        # Bun/JS number formatting differs from Python; ask the build's runtime.
        packed = subprocess.run(["bun", "-e", "process.stdout.write(JSON.stringify(JSON.parse(await Bun.stdin.text())))"],
                                input=data, check=True, capture_output=True).stdout
        hashes.add(hashlib.sha256(packed).hexdigest())
    return hashes


def check_publish_halt(blobs: list[Blob], *, root: Path = ROOT) -> None:
    newly_embedded = {b.sha256 for b in blobs} - main_geometry_hashes(root)
    if newly_embedded:
        upload.validate_state_location()
        if upload.MODEL_HALT.exists():
            raise RuntimeError("Model HALT blocks newly embedded content")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("place", type=Path)
    parser.add_argument("--inventory", action="store_true", help="Report only; never authorizes publication")
    parser.add_argument("--publish", action="store_true", help="Also check model HALT for new content")
    args = parser.parse_args()
    if args.inventory and args.publish:
        parser.error("inventory cannot authorize publication")
    content = args.place.read_bytes()
    if args.inventory:
        blobs, refs = inventory(content)
    else:
        blobs, refs = validate(content)
        if args.publish:
            check_publish_halt(blobs)
    print(json.dumps({"blobs": [{"file": b.name, "sha256": b.sha256, "bytes": len(b.content)} for b in blobs],
                      "referencedAssetIds": sorted(refs), "authorized": not args.inventory}, indent=2))

if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, ET.ParseError, subprocess.CalledProcessError) as exc:
        raise SystemExit(str(exc))
