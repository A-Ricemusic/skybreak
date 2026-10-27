#!/usr/bin/env python3
"""Upload final, reviewed SKYBREAK Ogg effects; never publishes the place.

Uses the same account journal/halt file as roblox-asset-upload.py. Every new
asset must pass review, operation completion AND explicit moderation approval.
Re-running resumes recorded operations rather than consuming another upload.
Credentials are read privately from --key-file and never stored in the game.

python3 tools/upload-audio.py --key-file <private-file> [--only cueId] [--dry-run]
Review format in assets/audio/review.json: commercialUsePermitted: true,
files: {cueId: {sha256, approved: true, transcript: "", reviewer, method}}.
This tool only accepts non-vocal SFX; voice recordings need a separate human
listening review with the owner's transcript/identity/licensing checks.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request
import uuid

import _http

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets/audio"
STATE = Path.home() / ".skybreak-roblox-uploads"
JOURNAL = STATE / "journal-3407487520.json"
HALT = STATE / "HALT-3407487520"
API = "https://apis.roblox.com/assets/v1"
APPROVED = "MODERATION_STATE_APPROVED"
REJECTED = "MODERATION_STATE_REJECTED"


def save(path, value):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2) + "\n")
    temp.replace(path)


def load_journal():
    return json.loads(JOURNAL.read_text()) if JOURNAL.exists() else {"uploads": {}}


def gate(own=None):
    if HALT.exists():
        raise RuntimeError("Account halted by Roblox moderation; no uploads are permitted")
    for name, item in load_journal()["uploads"].items():
        if name != own and item.get("state") != APPROVED:
            raise RuntimeError(f"Unresolved account upload {name}: {item.get('state')}")


def record(name, value):
    # Merge the newest journal instead of overwriting entries from other tools.
    state = load_journal()
    if value is None:
        state["uploads"].pop(name, None)
    else:
        state["uploads"][name] = value
    save(JOURNAL, state)


def http(method, url, key, body=None, content_type=None):
    # No arbitrary endpoints: this credential can never reach place publishing.
    if not url.startswith(API + "/assets") and not url.startswith(API + "/operations/"):
        raise RuntimeError("Endpoint outside audio asset upload/status allowlist")
    headers = {"x-api-key": key}
    if content_type: headers["Content-Type"] = content_type
    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    with _http.open(request, timeout=90) as response:
        return json.load(response)


def moderation(key, asset):
    data = http("GET", f"{API}/assets/{asset}?readMask=moderationResult", key)
    state = data.get("moderationResult", {}).get("moderationState")
    return {"Approved": APPROVED, "Rejected": REJECTED}.get(state, state)


def upload(cue, review, key):
    name = cue["id"]
    filename = name + ".ogg"
    content = (ASSETS / filename).read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    checked = review.get("files", {}).get(name, {})
    if not (review.get("commercialUsePermitted") is True and checked.get("approved") is True
            and checked.get("sha256") == digest and checked.get("transcript") == ""
            and checked.get("reviewer") and checked.get("method")):
        raise RuntimeError(f"{name}: missing matching non-vocal PG-13 review or commercial-use confirmation")
    if not content.startswith(b"OggS") or len(content) >= 20_000_000:
        raise RuntimeError(f"{name}: invalid Ogg upload")
    journal_key = "audio/" + filename
    gate(journal_key)
    item = load_journal()["uploads"].get(journal_key)
    if item and item.get("sha256") != digest:
        raise RuntimeError(f"{name}: audio changed since upload; use a new versioned filename")
    if not item:
        meta = {"assetType": "Audio", "displayName": f"SKYBREAK {name}",
                "description": "Original non-vocal aircraft game sound effect. No speech or music.",
                "creationContext": {"creator": {"userId": "3407487520"}}}
        boundary = uuid.uuid4().hex
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="request"\r\n\r\n{json.dumps(meta)}\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="fileContent"; filename="{filename}"\r\n'
                'Content-Type: audio/ogg\r\n\r\n').encode() + content + f"\r\n--{boundary}--\r\n".encode()
        item = {"sha256": digest, "assetType": "Audio", "state": "SUBMITTING", "reviewer": checked["reviewer"],
                "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        record(journal_key, item)
        try:
            operation = http("POST", API + "/assets", key, body, "multipart/form-data; boundary=" + boundary)
        except urllib.error.HTTPError as error:
            # A definite client rejection didn't create an asset. Transport/5xx
            # failures remain journaled as ambiguous; never blindly resubmit.
            if 400 <= error.code < 500: record(journal_key, None)
            raise RuntimeError(f"{name}: Roblox upload HTTP {error.code}: {error.read().decode()[:400]}") from None
        operation_id = operation.get("operationId") or operation.get("path", "").split("/")[-1]
        item.update({"operationId": operation_id, "state": "UPLOADING"})
        record(journal_key, item)
    if not item.get("assetId"):
        operation_id = item.get("operationId")
        if not operation_id:
            raise RuntimeError(f"{name}: earlier submission is ambiguous; recover it from Roblox before retrying")
        for _ in range(60):
            result = http("GET", API + "/operations/" + operation_id, key)
            if result.get("done"):
                if result.get("error"):
                    raise RuntimeError(f"{name}: asset operation failed: {result['error']}")
                response = result.get("response", {})
                item["assetId"] = response.get("assetId") or response.get("path", "").split("/")[-1]
                record(journal_key, item)
                break
            time.sleep(3)
        if not item.get("assetId"): raise RuntimeError(f"{name}: upload unfinished; re-run to resume")
    for _ in range(60):
        state = moderation(key, item["assetId"])
        item["state"] = state or "UNKNOWN"
        record(journal_key, item)
        if state == REJECTED:
            HALT.write_text(f"{journal_key} asset {item['assetId']} rejected by moderation\n")
            raise RuntimeError("Roblox rejected audio; account uploads are now halted")
        if state == APPROVED:
            print(f"{name}: approved asset {item['assetId']}", flush=True)
            return item
        time.sleep(5)
    raise RuntimeError(f"{name}: moderation pending; re-run later to resume (no duplicate upload)")


def write_bank(spec, uploaded):
    provenance = json.loads((ASSETS / "provenance.json").read_text())
    definitions = {x["id"]: x for x in json.loads((ASSETS / "cues.json").read_text())["cues"]}
    lines = ['// Generated by tools/upload-audio.py. Approved Roblox audio only.',
             'export interface SoundDefinition { assetId: string; seconds: number; loop: boolean; start: number; finish: number }',
             'export const SoundBank: Record<string, SoundDefinition> = {']
    for cue in spec["cues"]:
        name = cue["id"]
        if name not in uploaded or uploaded[name].get("state") != APPROVED: continue
        members = cue.get("members", [{"id": name, "start": 0, "end": provenance[name]["prepared"]["duration"]}])
        for member in members:
            entry = member["id"]
            seconds = member["end"] - member["start"]
            lines.append(f'\t{entry}: {{ assetId: "rbxassetid://{uploaded[name]["assetId"]}", seconds: {seconds:.6f}, loop: {str(definitions[entry]["loop"]).lower()}, start: {member["start"]:.6f}, finish: {member["end"]:.6f} }},')
    lines.append('};\n')
    (ROOT / "src/shared/SoundBank.ts").write_text("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key-file", required=True)
    parser.add_argument("--only")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (STATE / "audio-upload.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if HALT.exists(): raise RuntimeError("Account halted; no uploads permitted")
        plan_path = ASSETS / "upload-plan.json"
        spec = json.loads((plan_path if plan_path.exists() else ASSETS / "cues.json").read_text())
        review = json.loads((ASSETS / "review.json").read_text())
        provenance = json.loads((ASSETS / "provenance.json").read_text())
        selected = [x for x in spec["cues"] if not args.only or x["id"] == args.only]
        if not selected: raise RuntimeError("Unknown cue")
        # Preflight the ENTIRE batch before consuming the first upload slot.
        for cue in selected:
            name = cue["id"]
            path = ASSETS / (name + ".ogg")
            checked = review.get("files", {}).get(name, {})
            if provenance.get(name, {}).get("subscriptionTierAtGeneration") in (None, "free"):
                raise RuntimeError(f"{name}: no paid-plan generation provenance")
            if not path.exists() or checked.get("sha256") != hashlib.sha256(path.read_bytes()).hexdigest():
                raise RuntimeError(f"{name}: missing prepared file or stale review")
            if not (checked.get("approved") is True and checked.get("transcript") == "" and checked.get("reviewer") and checked.get("method") and review.get("commercialUsePermitted") is True):
                raise RuntimeError(f"{name}: incomplete content/license review")
        if args.dry_run:
            gate()
            print(f"Preflight passed for {len(selected)} effects; nothing uploaded")
            return
        key = Path(args.key_file).read_text().strip()
        result_path = ASSETS / "uploaded.json"
        uploaded = json.loads(result_path.read_text()) if result_path.exists() else {}
        for cue in selected:
            uploaded[cue["id"]] = upload(cue, review, key)
            save(result_path, uploaded)
            write_bank(spec, uploaded)


if __name__ == "__main__":
    main()
