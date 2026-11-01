#!/usr/bin/env python3
"""Upload only independently approved, byte-matched FBX Models; never edits src/."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
from typing import Any

import _http
import roblox_upload as ru

ROOT = Path(__file__).resolve().parent.parent
CANONICAL_STATE = Path.home() / ".skybreak-roblox-uploads"
REQUIRED_CHECKS = {"noText", "noLogosOrBrands", "noRealMilitaryInsignia", "noFaces",
                   "noSuggestiveShapes", "noGoreOrWeaponsGlorification", "originalDesign"}


def read_file(path: Path, limit: int) -> bytes:
    """Bound regular-file reads and reject paths resolving outside this repo."""
    try:
        resolved = path.resolve(strict=True)
        if not resolved.is_relative_to(ROOT.resolve(strict=True)):
            raise RuntimeError("Upload evidence must remain inside the repository")
        descriptor = os.open(resolved, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
        with os.fdopen(descriptor, "rb") as source:
            info = os.fstat(source.fileno())
            if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size < limit:
                raise RuntimeError(f"{path.name}: must be a nonempty regular file below {limit} bytes")
            content = source.read(limit)
        if len(content) >= limit:
            raise RuntimeError(f"{path.name}: file exceeds size limit")
        return content
    except OSError:
        raise RuntimeError(f"{path.name}: missing or unreadable file") from None


def read_object(content: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(content)
    except (ValueError, UnicodeError):
        raise RuntimeError(f"{label}: invalid JSON") from None
    if not isinstance(value, dict):
        raise RuntimeError(f"{label}: expected JSON object")
    return value


def prepare(asset: str) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", asset):
        raise RuntimeError("Invalid asset name; use letters, digits, underscores or hyphens")
    filename = asset + ".fbx"
    folder = ROOT / "assets/roblox-upload" / asset
    approval = read_object(read_file(ROOT / "docs/qa/asset-reviews/approvals" / (asset + ".json"),
                                     1_000_000), "approval")
    reviewer = approval.get("reviewer")
    if approval.get("approved") is not True or not isinstance(reviewer, str) or not reviewer.strip():
        raise RuntimeError(f"{asset}: approval requires approved: true and a nonempty reviewer")
    if approval.get("uploadAssetType") != "Model":
        raise RuntimeError(f"{asset}: approval uploadAssetType must be Model")
    upload_set = approval.get("uploadSet")
    if not isinstance(upload_set, dict) or set(upload_set) != {filename}:
        raise RuntimeError(f"{asset}: uploadSet must contain exactly {filename}")
    content = read_file(folder / filename, ru.MAX_MODEL_BYTES)
    digest = hashlib.sha256(content).hexdigest()
    if digest != upload_set[filename]:
        raise RuntimeError(f"{asset}: FBX SHA-256 differs from approval; re-review required")
    committed = ru.require_model_review(filename, content, digest, root=ROOT)
    if approval != committed:
        raise RuntimeError(f"{asset}: working approval differs from committed safety review")
    for texture, texture_digest in approval.get("embeddedTextures", {}).items():
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", texture):
            raise RuntimeError("Invalid texture filename in approval")
        if hashlib.sha256(read_file(folder / texture, ru.MAX_MODEL_BYTES)).hexdigest() != texture_digest:
            raise RuntimeError(f"{asset}: texture SHA-256 differs from approval; re-review required")
    checklist_bytes = read_file(folder / "checklist.json", 1_000_000)
    if hashlib.sha256(checklist_bytes).hexdigest() != approval.get("checklistSha256"):
        raise RuntimeError(f"{asset}: checklist SHA-256 differs from approval")
    checklist = read_object(checklist_bytes, "checklist")
    version = approval.get("exportVersion")
    if not isinstance(version, str) or not version.strip() or checklist.get("exportVersion") != version:
        raise RuntimeError(f"{asset}: exportVersion missing or differs from approval")
    checks = checklist.get("checks")
    if (not isinstance(checks, dict) or not REQUIRED_CHECKS.issubset(checks)
            or any(not isinstance(check, dict) or check.get("value") is not True for check in checks.values())):
        raise RuntimeError(f"{asset}: all required and additional checklist checks must have value: true")
    entry = f"{asset}/{filename}"
    item = ru.load_journal()["uploads"].get(entry)
    if item is not None:
        if item.get("sha256") != digest or item.get("assetType") != "Model":
            raise RuntimeError(f"{asset}: journal hash/type differs; recover journal or use a new versioned name")
        if not item.get("assetId") and not item.get("operationId"):
            raise RuntimeError(f"{asset}: earlier submission is ambiguous; recover journal before retrying")
    return {"asset": asset, "file": str((folder / filename).relative_to(ROOT)),
            "size": len(content), "sha256": digest, "reviewer": reviewer,
            "journalKey": entry, "content": content, "item": item}


def upload(plan: dict[str, Any], key: str) -> dict[str, Any]:
    ru.gate(plan["journalKey"], asset_type="Model")
    return ru.submit_and_moderate(
        plan["asset"], plan["journalKey"], plan["item"], plan["content"], plan["sha256"],
        plan["asset"] + ".fbx", "SKYBREAK original reviewed game Model with embedded textures.",
        plan["reviewer"], key, "Roblox rejected Model; model uploads are now halted", asset_type="Model")


def fetch_origin() -> None:
    subprocess.run(["git", "fetch", "origin"], cwd=ROOT, check=True, capture_output=True)


def main(argv: list[str] | None = None) -> None:
    names = ("STATE", "JOURNAL", "HALT", "AUDIO_HALT", "MODEL_HALT")
    previous = {name: getattr(ru, name) for name in names}
    try:
        _main(argv)
    finally:
        for name, value in previous.items():
            setattr(ru, name, value)


def _main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key-file", type=Path)
    parser.add_argument("--state-dir", type=Path, help="Override shared state for isolated offline verification")
    parser.add_argument("assets", nargs="+")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if not args.dry_run and args.key_file is None:
        parser.error("--key-file is required unless --dry-run is used")
    if args.state_dir is not None and not args.dry_run:
        raise RuntimeError("--state-dir is permitted only with --dry-run; network uploads require canonical state")
    if not args.dry_run:
        fetch_origin()
    if not args.dry_run or args.state_dir is not None:
        ru.STATE = CANONICAL_STATE if not args.dry_run else args.state_dir
        ru.JOURNAL = ru.STATE / "journal-3407487520.json"
        ru.HALT = ru.STATE / "HALT-3407487520"
        ru.AUDIO_HALT = ru.STATE / "HALT-audio-3407487520"
        ru.MODEL_HALT = ru.STATE / "HALT-models-3407487520"
    ru.STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (ru.STATE / "audio-upload.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("Another account upload tool holds the state lock") from None
        # Dry runs never excuse unresolved entries, including this asset's own.
        # Actual runs allow only their own entry so interrupted operations resume.
        if args.dry_run:
            ru.gate(asset_type="Model")
        plans = []
        for asset in dict.fromkeys(args.assets):
            ru.gate(None if args.dry_run else f"{asset}/{asset}.fbx", asset_type="Model")
            plans.append(prepare(asset))
        if args.dry_run:
            for plan in plans:
                print(json.dumps({k: plan[k] for k in ("asset", "file", "size", "sha256", "reviewer", "journalKey")}))
            return
        key = _http.read_key_file(args.key_file)
        for plan in plans:
            upload(plan, key)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError, TypeError) as error:
        print(f"REFUSED: {error}", file=sys.stderr)
        sys.exit(2)
