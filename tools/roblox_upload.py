"""Shared Roblox Open Cloud upload journal, HALT gate and polling for SKYBREAK tools.

Imported by the Audio, Voice and Model upload tools. All tools share
one account journal and HALT file: a single moderation rejection halts every
upload for the account, and no new upload starts while another is unresolved.
Callers hold STATE / "audio-upload.lock" while using these helpers.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import time
from typing import Any
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
POLL_TIMEOUT_SECONDS = 600
MAX_AUDIO_BYTES = 20_000_000
MAX_MODEL_BYTES = 50_000_000


def save(path: Path, value: Any) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2) + "\n")
    temp.replace(path)


def load_journal() -> dict[str, Any]:
    return json.loads(JOURNAL.read_text()) if JOURNAL.exists() else {"uploads": {}}


def gate(own: str | None = None) -> None:
    if HALT.exists():
        raise RuntimeError("Account halted by Roblox moderation; no uploads are permitted")
    for name, item in load_journal()["uploads"].items():
        if name != own and item.get("state") != APPROVED:
            raise RuntimeError(f"Unresolved account upload {name}: {item.get('state')}")


def record(name: str, value: dict[str, Any] | None) -> None:
    # Merge the newest journal instead of overwriting entries from other tools.
    state = load_journal()
    if value is None:
        state["uploads"].pop(name, None)
    else:
        state["uploads"][name] = value
    save(JOURNAL, state)


def http(method: str, url: str, key: str, body: bytes | None = None,
         content_type: str | None = None, *, deadline: float | None = None) -> dict[str, Any]:
    # Match the entire URL, including method and query. Prefix matching also
    # admitted /assets-unrelated and attacker-controlled query strings.
    allowed = ((method == "POST" and url == API + "/assets") or
               (method == "GET" and re.fullmatch(
                   re.escape(API) + r"/(?:operations/[A-Za-z0-9_-]{1,128}|assets/[0-9]{1,20}\?readMask=moderationResult)", url)))
    if not allowed:
        raise RuntimeError("Endpoint outside audio asset upload/status allowlist")
    if not key or len(key) > 8192 or any(not 33 <= ord(c) <= 126 for c in key):
        raise RuntimeError("Invalid API key")
    headers = {"x-api-key": key}
    if content_type:
        headers["Content-Type"] = content_type
    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    return _http.request_json(request, timeout=90, deadline=deadline)


def moderation(key: str, asset: str, *, deadline: float | None = None) -> str | None:
    data = http("GET", f"{API}/assets/{asset}?readMask=moderationResult", key, deadline=deadline)
    result = data.get("moderationResult")
    state = result.get("moderationState") if isinstance(result, dict) else None
    # Never persist arbitrary remote text (which might contain a credential).
    return {"Approved": APPROVED, "Rejected": REJECTED,
            APPROVED: APPROVED, REJECTED: REJECTED}.get(state) if isinstance(state, str) else None


def _identifier(value: Any, kind: str, key: str) -> str:
    pattern = r"[0-9]{1,20}" if kind == "asset" else r"[A-Za-z0-9_-]{1,128}"
    if (not isinstance(value, (str, int)) or not re.fullmatch(pattern, str(value))
            or (key and key in str(value))):
        raise RuntimeError(f"Roblox returned an invalid {kind} ID; recover the journal before retrying")
    return str(value)


def _result_id(result: dict[str, Any], kind: str, key: str) -> str:
    value = result.get(kind + "Id")
    if not value:
        path = result.get("path")
        prefix = "assets/" if kind == "asset" else "operations/"
        value = path[len(prefix):] if isinstance(path, str) and path.startswith(prefix) else None
    return _identifier(value, kind, key)


def _pause(seconds: float, deadline: float) -> None:
    time.sleep(min(seconds, _http.remaining(deadline)))
    _http.remaining(deadline)


def submit_and_moderate(name: str, entry: str, item: dict[str, Any] | None,
                        content: bytes, digest: str, filename: str, description: str,
                        reviewer: str, key: str, rejected_message: str, *,
                        asset_type: str = "Audio") -> dict[str, Any]:
    """Submit once, then poll operation and moderation within one time budget.

    The caller has already run gate(entry), looked up `item` in the journal and
    verified its sha256. Returns the approved journal item.
    """
    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    if asset_type == "Audio":
        if not re.fullmatch(r"[A-Za-z0-9_-]+\.ogg", filename) or not content.startswith(b"OggS") or len(content) >= MAX_AUDIO_BYTES:
            raise RuntimeError("Invalid Ogg upload content or filename")
        content_type = "audio/ogg"
    elif asset_type == "Model":
        if not re.fullmatch(r"[A-Za-z0-9_-]+\.fbx", filename) or not 0 < len(content) < MAX_MODEL_BYTES:
            raise RuntimeError("Invalid FBX upload content or filename (must be below 50 MB)")
        content_type = "model/fbx"
    else:
        raise RuntimeError("Unsupported upload asset type")
    if not item:
        meta = {"assetType": asset_type, "displayName": f"SKYBREAK {name}",
                "description": description,
                "creationContext": {"creator": {"userId": "3407487520"}}}
        boundary = uuid.uuid4().hex
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="request"\r\n\r\n{json.dumps(meta)}\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="fileContent"; filename="{filename}"\r\n'
                f'Content-Type: {content_type}\r\n\r\n').encode() + content + f"\r\n--{boundary}--\r\n".encode()
        item = {"sha256": digest, "assetType": asset_type, "state": "SUBMITTING", "reviewer": reviewer,
                "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        record(entry, item)
        try:
            operation = http("POST", API + "/assets", key, body, "multipart/form-data; boundary=" + boundary,
                             deadline=deadline)
        except (_http.HTTPFailure, urllib.error.HTTPError) as error:
            status = error.code if isinstance(error, urllib.error.HTTPError) else error.status
            # A definite client rejection didn't create an asset. Timeouts and
            # transport/5xx failures remain ambiguous; never blindly resubmit.
            if status is not None and 400 <= status < 500 and status != 408:
                record(entry, None)
            if isinstance(error, urllib.error.HTTPError):
                error.close()
            detail = f"HTTP {status}" if status is not None else "transport/deadline failure"
            raise RuntimeError(f"{name}: Roblox upload {detail}; re-run to resume or recover the journal") from None
        item.update({"operationId": _result_id(operation, "operation", key), "state": "UPLOADING"})
        record(entry, item)
    if not item.get("assetId"):
        operation_id = item.get("operationId")
        if not operation_id:
            raise RuntimeError(f"{name}: earlier submission is ambiguous; recover it from Roblox before retrying")
        operation_id = _identifier(operation_id, "operation", key)
        for _ in range(60):
            _http.remaining(deadline)
            result = http("GET", API + "/operations/" + operation_id, key, deadline=deadline)
            if result.get("done"):
                if result.get("error"):
                    # Remote operation messages can echo credentials or headers.
                    raise RuntimeError(f"{name}: Roblox asset operation failed; recover the journal before retrying")
                response = result.get("response")
                if not isinstance(response, dict):
                    raise RuntimeError("Roblox asset operation completed without an asset response")
                item["assetId"] = _result_id(response, "asset", key)
                record(entry, item)
                break
            _pause(3, deadline)
        if not item.get("assetId"):
            raise RuntimeError(f"{name}: upload unfinished; re-run to resume")
    item["assetId"] = _identifier(item["assetId"], "asset", key)
    for _ in range(60):
        _http.remaining(deadline)
        state = moderation(key, item["assetId"], deadline=deadline)
        item["state"] = state or "UNKNOWN"
        record(entry, item)
        if state == REJECTED:
            HALT.write_text(f"{entry} asset {item['assetId']} rejected by moderation\n")
            raise RuntimeError(rejected_message)
        if state == APPROVED:
            print(f"{name}: approved asset {item['assetId']}", flush=True)
            return item
        _pause(5, deadline)
    raise RuntimeError(f"{name}: moderation pending; re-run later to resume (no duplicate upload)")
