"""Shared Roblox Open Cloud upload journal, HALT gate and polling for SKYBREAK tools.

Imported by tools/upload-audio.py and tools/upload-voice.py (both run as
`python3 tools/<name>.py`, so this directory is on sys.path). Both tools share
one account journal and HALT file: a single moderation rejection halts every
upload for the account, and no new upload starts while another is unresolved.
Callers hold STATE / "audio-upload.lock" while using these helpers.
"""
import json
from pathlib import Path
import time
import urllib.error
import urllib.request
import uuid

import _http

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


def submit_and_moderate(name, entry, item, content, digest, filename, description, reviewer, key, rejected_message):
    """Submit (unless journaled), finish the operation, then wait for moderation.

    The caller has already run gate(entry), looked up `item` in the journal and
    verified its sha256. Returns the approved journal item.
    """
    if not item:
        meta = {"assetType": "Audio", "displayName": f"SKYBREAK {name}",
                "description": description,
                "creationContext": {"creator": {"userId": "3407487520"}}}
        boundary = uuid.uuid4().hex
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="request"\r\n\r\n{json.dumps(meta)}\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="fileContent"; filename="{filename}"\r\n'
                'Content-Type: audio/ogg\r\n\r\n').encode() + content + f"\r\n--{boundary}--\r\n".encode()
        item = {"sha256": digest, "assetType": "Audio", "state": "SUBMITTING", "reviewer": reviewer,
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
            raise RuntimeError(rejected_message)
        if state == APPROVED:
            print(f"{name}: approved asset {item['assetId']}", flush=True)
            return item
        time.sleep(5)
    raise RuntimeError(f"{name}: moderation pending; re-run later to resume (no duplicate upload)")
