"""Shared Roblox Open Cloud upload journal, HALT gate and polling for SKYBREAK tools.

Audio uploads are permanently disabled. Legacy/audio HALTs apply only to audio;
model-class rejections halt models, meshes and images. The journal is shared,
with unresolved operations serialized within each asset class.
Callers hold STATE / "audio-upload.lock" while using these helpers.
"""
from __future__ import annotations

from email.parser import BytesParser
from email.policy import default
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
from typing import Any
import urllib.error
import urllib.request
import uuid

import _http

STATE = Path.home() / ".skybreak-roblox-uploads"
JOURNAL = STATE / "journal-3407487520.json"
HALT = STATE / "HALT-3407487520"
AUDIO_HALT = STATE / "HALT-audio-3407487520"
MODEL_HALT = STATE / "HALT-models-3407487520"
ROOT = Path(__file__).resolve().parent.parent
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


def asset_class(asset_type: str) -> str:
    if asset_type in {"Audio", "Voice"}:
        return "audio"
    if asset_type in {"Model", "Mesh", "MeshPart", "Image", "Decal"}:
        return "models"
    raise RuntimeError("Unsupported upload asset type")


def gate(own: str | None = None, *, asset_type: str = "Audio") -> None:
    kind = asset_class(asset_type)
    if kind == "audio":
        if HALT.exists() or AUDIO_HALT.exists():
            raise RuntimeError("Audio halted by Roblox moderation; audio/voice uploads are permanently disabled")
        raise RuntimeError("Audio/voice uploads are permanently disabled by owner decision")
    if MODEL_HALT.exists():
        raise RuntimeError("Model uploads halted by Roblox moderation")
    for name, item in load_journal()["uploads"].items():
        # Older audio journal entries predate assetType. Unknown entries fail closed.
        entry_type = item.get("assetType")
        is_audio = entry_type in {"Audio", "Voice"} or (
            entry_type is None and name.startswith(("audio/", "voice/")))
        if not is_audio and name != own and item.get("state") != APPROVED:
            raise RuntimeError(f"Unresolved account upload {name}: {item.get('state')}")


def committed_file(path: str, *, root: Path | None = None) -> bytes:
    """Read evidence from HEAD, never from uncommitted working-tree approvals."""
    root = ROOT if root is None else root
    parts = Path(path).parts
    if not parts or Path(path).is_absolute() or ".." in parts or not path.startswith("docs/qa/asset-reviews/"):
        raise RuntimeError("Safety review must be inside docs/qa/asset-reviews")
    result = subprocess.run(["git", "show", "HEAD:" + path], cwd=root, capture_output=True)
    if result.returncode:
        raise RuntimeError("Missing committed independent safety-review record")
    return result.stdout


def require_model_review(filename: str, content: bytes, digest: str, *,
                         root: Path | None = None) -> dict[str, Any]:
    """Require exact bytes in a committed independent 10/10 APPROVE record."""
    root = ROOT if root is None else root
    if hashlib.sha256(content).hexdigest() != digest:
        raise RuntimeError("Upload SHA-256 differs from content")
    if not re.fullmatch(r"[A-Za-z0-9_-]+\.fbx", filename):
        raise RuntimeError("Invalid FBX upload filename")
    approval = json.loads(committed_file(
        "docs/qa/asset-reviews/approvals/" + filename[:-4] + ".json", root=root))
    reviewer = approval.get("reviewer")
    if (approval.get("approved") is not True or approval.get("score") != "10/10"
            or not isinstance(reviewer, str) or "independent" not in reviewer.lower()
            or approval.get("uploadAssetType") != "Model"
            or approval.get("uploadSet") != {filename: digest}):
        raise RuntimeError("Missing matching committed independent 10/10 APPROVE safety review")
    record_path = approval.get("record")
    if not isinstance(record_path, str):
        raise RuntimeError("Missing committed safety-review verdict record")
    verdict = committed_file(record_path, root=root).decode("utf-8")
    if not re.search(r"VERDICT\s*:\s*APPROVE\b", verdict, re.I) or "10/10" not in verdict:
        raise RuntimeError("Safety-review record requires 10/10 and VERDICT: APPROVE")
    return approval


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
        raise RuntimeError("Endpoint outside asset upload/status allowlist")
    if not key or len(key) > 8192 or any(not 33 <= ord(c) <= 126 for c in key):
        raise RuntimeError("Invalid API key")
    if method == "POST":
        # The transport helper is also callable directly. Never allow raw POSTs
        # to bypass the audio ban, model gate or committed byte review.
        if not content_type or not content_type.startswith("multipart/form-data; boundary=") or not body:
            raise RuntimeError("Upload POST requires reviewed Model multipart content")
        message = BytesParser(policy=default).parsebytes(
            ("Content-Type: " + content_type + "\r\nMIME-Version: 1.0\r\n\r\n").encode() + body)
        parts = list(message.iter_parts())
        if len(parts) != 2 or [part.get_param("name", header="content-disposition") for part in parts] != ["request", "fileContent"]:
            raise RuntimeError("Invalid upload multipart content")
        metadata = json.loads(parts[0].get_payload(decode=True))
        kind = metadata.get("assetType")
        if asset_class(kind) == "audio":
            gate(asset_type=kind)
        if MODEL_HALT.exists():
            raise RuntimeError("Model uploads halted by Roblox moderation")
        if kind != "Model":
            raise RuntimeError("Unsupported upload asset type")
        data = parts[1].get_payload(decode=True)
        require_model_review(parts[1].get_filename(), data, hashlib.sha256(data).hexdigest())
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

    The shared gate and committed review are checked even for direct callers. Returns the approved journal item.
    """
    gate(entry, asset_type=asset_type)
    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    if asset_type == "Model":
        if not re.fullmatch(r"[A-Za-z0-9_-]+\.fbx", filename) or not 0 < len(content) < MAX_MODEL_BYTES:
            raise RuntimeError("Invalid FBX upload content or filename (must be below 50 MB)")
        require_model_review(filename, content, digest)
        if item and (item.get("sha256") != digest or item.get("assetType") != asset_type):
            raise RuntimeError("Journal hash/type differs from reviewed upload")
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
            MODEL_HALT.write_text(f"{entry} asset {item['assetId']} rejected by moderation\n")
            raise RuntimeError(rejected_message)
        if state == APPROVED:
            print(f"{name}: approved asset {item['assetId']}", flush=True)
            return item
        _pause(5, deadline)
    raise RuntimeError(f"{name}: moderation pending; re-run later to resume (no duplicate upload)")
