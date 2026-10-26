#!/usr/bin/env python3
"""Upload reviewed SKYBREAK voice-over banks to Roblox; never publishes the place.

Same account journal, HALT file and lock as tools/upload-audio.py. A bank is
only uploaded when assets/voice/review.json approves its exact sha256 with
transcript-match evidence, its moderation checklist passed every automated
check, and assets/voice/stt.json shows no line under 90 % for that file. Every
upload must complete AND be explicitly approved by moderation; one rejection
writes the HALT file and stops all uploads for the account. Re-running resumes
recorded operations instead of consuming another upload slot.

python3 tools/upload-voice.py --key-file <private-file> [--only voiceBank01] [--dry-run]

Review format (assets/voice/review.json), written by the independent reviewer:
{"commercialUsePermitted": true,
 "banks": {"voiceBank01": {"sha256": "...", "approved": true, "reviewer": "...",
           "method": "listened to the whole bank against checklists/voiceBank01.json",
           "transcriptMatch": {"engine": "...", "meanRate": 0.99, "minRate": 0.9, "flagged": []}}}}
"""
import argparse
import fcntl
import hashlib
import json
from pathlib import Path
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent.parent
VOICE = ROOT / "assets/voice"
STATE = Path.home() / ".skybreak-roblox-uploads"
JOURNAL = STATE / "journal-3407487520.json"
HALT = STATE / "HALT-3407487520"
API = "https://apis.roblox.com/assets/v1"
APPROVED = "MODERATION_STATE_APPROVED"
REJECTED = "MODERATION_STATE_REJECTED"
MAX_SECONDS = 6.5 * 60


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
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def moderation(key, asset):
    data = http("GET", f"{API}/assets/{asset}?readMask=moderationResult", key)
    state = data.get("moderationResult", {}).get("moderationState")
    return {"Approved": APPROVED, "Rejected": REJECTED}.get(state, state)


def journal_key(bank):
    # A changed bank is a new file to Roblox: version the journal entry by content.
    return f"voice/{bank['id']}-{bank['sha256'][:12]}.ogg"


def preflight(bank, review, stt):
    """Every check that must pass before a bank may consume an upload slot."""
    name = bank["id"]
    path = VOICE / bank["file"]
    if not path.exists():
        raise RuntimeError(f"{name}: missing {bank['file']}")
    content = path.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    if digest != bank["sha256"]:
        raise RuntimeError(f"{name}: file differs from upload-plan.json; re-run tools/voice.py pack")
    if not content.startswith(b"OggS") or len(content) >= 20_000_000:
        raise RuntimeError(f"{name}: invalid Ogg upload")
    if bank["seconds"] > MAX_SECONDS:
        raise RuntimeError(f"{name}: {bank['seconds']}s is over Roblox's 6.5 minute limit")
    checked = review.get("banks", {}).get(name, {})
    match = checked.get("transcriptMatch", {})
    if not (review.get("commercialUsePermitted") is True and checked.get("approved") is True
            and checked.get("sha256") == digest and checked.get("reviewer") and checked.get("method")
            and match.get("engine") and isinstance(match.get("minRate"), (int, float)) and match.get("flagged") == []):
        raise RuntimeError(f"{name}: missing matching independent review with transcript-match evidence")
    heard = stt.get("banks", {}).get(name, {})
    if heard.get("sha256") != digest or heard.get("flagged") != []:
        raise RuntimeError(f"{name}: speech-to-text check missing, stale or has lines under 90%")
    checklist_path = VOICE / "checklists" / f"{name}.json"
    checklist = json.loads(checklist_path.read_text()) if checklist_path.exists() else {}
    if checklist.get("sha256") != digest or not all(item.get("pass") is True for item in checklist.get("automated", {}).values()):
        raise RuntimeError(f"{name}: moderation checklist missing, stale or failing")
    return content, digest, checked


def upload(bank, review, stt, key):
    name = bank["id"]
    content, digest, checked = preflight(bank, review, stt)
    entry = journal_key(bank)
    gate(entry)
    item = load_journal()["uploads"].get(entry)
    if item and item.get("sha256") != digest:
        raise RuntimeError(f"{name}: journal entry {entry} has a different file")
    if not item:
        meta = {"assetType": "Audio", "displayName": f"SKYBREAK {name}",
                "description": "Original voice-over dialogue for a fictional flight game. Synthetic premade voices; no music.",
                "creationContext": {"creator": {"userId": "3407487520"}}}
        boundary = uuid.uuid4().hex
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="request"\r\n\r\n{json.dumps(meta)}\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="fileContent"; filename="{bank["file"]}"\r\n'
                'Content-Type: audio/ogg\r\n\r\n').encode() + content + f"\r\n--{boundary}--\r\n".encode()
        item = {"sha256": digest, "assetType": "Audio", "state": "SUBMITTING", "reviewer": checked["reviewer"],
                "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        record(entry, item)
        try:
            operation = http("POST", API + "/assets", key, body, "multipart/form-data; boundary=" + boundary)
        except urllib.error.HTTPError as error:
            # A definite client rejection didn't create an asset. Transport/5xx
            # failures remain journaled as ambiguous; never blindly resubmit.
            if 400 <= error.code < 500: record(entry, None)
            raise RuntimeError(f"{name}: Roblox upload HTTP {error.code}: {error.read().decode()[:400]}") from None
        operation_id = operation.get("operationId") or operation.get("path", "").split("/")[-1]
        item.update({"operationId": operation_id, "state": "UPLOADING"})
        record(entry, item)
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
                record(entry, item)
                break
            time.sleep(3)
        if not item.get("assetId"): raise RuntimeError(f"{name}: upload unfinished; re-run to resume")
    for _ in range(60):
        state = moderation(key, item["assetId"])
        item["state"] = state or "UNKNOWN"
        record(entry, item)
        if state == REJECTED:
            HALT.write_text(f"{entry} asset {item['assetId']} rejected by moderation\n")
            raise RuntimeError("Roblox rejected voice audio; account uploads are now halted")
        if state == APPROVED:
            print(f"{name}: approved asset {item['assetId']}", flush=True)
            return item
        time.sleep(5)
    raise RuntimeError(f"{name}: moderation pending; re-run later to resume (no duplicate upload)")


def write_banks(plan, uploaded):
    out = ["// Generated by tools/voice.py pack / tools/upload-voice.py. Approved Roblox audio only;",
           "// an empty id means the bank is not uploaded yet and every line in it stays silent.",
           "export const VOICE_BANK_ASSETS: Record<string, string> = {"]
    for bank in plan["banks"]:
        item = uploaded.get(bank["id"], {})
        approved = item.get("state") == APPROVED and item.get("sha256") == bank["sha256"] and item.get("assetId")
        out.append(f'\t{bank["id"]}: "{"rbxassetid://" + str(item["assetId"]) if approved else ""}",')
    out.append("};\n")
    (ROOT / "src/shared/VoiceBanks.ts").write_text("\n".join(out))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--key-file", required=False, help="Roblox Open Cloud key file (not needed for --dry-run)")
    parser.add_argument("--only")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Same lock as the effects uploader: the two tools never write the shared journal at once.
    with (STATE / "audio-upload.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if HALT.exists(): raise RuntimeError("Account halted; no uploads permitted")
        plan = json.loads((VOICE / "upload-plan.json").read_text())
        review_path = VOICE / "review.json"
        review = json.loads(review_path.read_text()) if review_path.exists() else {}
        stt = json.loads((VOICE / "stt.json").read_text()) if (VOICE / "stt.json").exists() else {}
        selected = [b for b in plan["banks"] if not args.only or b["id"] in args.only.split(",")]
        if not selected: raise RuntimeError("Unknown bank")
        # Preflight the ENTIRE batch before consuming the first upload slot.
        problems = []
        for bank in selected:
            try:
                preflight(bank, review, stt)
            except RuntimeError as error:
                problems.append(str(error))
        if args.dry_run:
            gate()
            for bank in selected:
                print(f"{bank['id']}: {bank['seconds'] / 60:.2f} min, {len(bank['members'])} lines, sha256 {bank['sha256'][:12]}, journal {journal_key(bank)}")
            if problems:
                print("Preflight would block:\n  " + "\n  ".join(problems))
                raise SystemExit(1)
            print(f"Preflight passed for {len(selected)} banks; nothing uploaded")
            return
        if problems: raise RuntimeError("Preflight failed:\n  " + "\n  ".join(problems))
        if not args.key_file: raise RuntimeError("--key-file is required to upload")
        key = Path(args.key_file).read_text().strip()
        result_path = VOICE / "uploaded.json"
        uploaded = json.loads(result_path.read_text()) if result_path.exists() else {}
        for bank in selected:
            uploaded[bank["id"]] = upload(bank, review, stt, key)
            save(result_path, uploaded)
            write_banks(plan, uploaded)


if __name__ == "__main__":
    main()
