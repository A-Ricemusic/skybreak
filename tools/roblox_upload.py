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
import os
import pwd
from pathlib import Path
import re
import subprocess
import time
import tempfile
from typing import Any
import urllib.error
import urllib.request
import uuid

import _http

def account_home() -> Path:
    """Read the OS account database, never the caller-controlled HOME."""
    return Path(pwd.getpwuid(os.getuid()).pw_dir)


def canonical_state() -> Path:
    """Shared upload state directory for every tool on this account."""
    return account_home() / ".skybreak-roblox-uploads"


def validate_state_location() -> Path:
    """Fail closed before state access, credentials or network on real runs."""
    home = account_home()
    if (not home.is_absolute() or Path.home() != home
            or ("HOME" in os.environ and Path(os.environ["HOME"]) != home)):
        raise RuntimeError("HOME/Path.home differs from OS account home; uploads refused")
    state = canonical_state()
    # Reject even dangling symlinks. Do not follow redirected state to inspect it.
    if state.is_symlink():
        raise RuntimeError("Canonical upload state directory must not be a symlink")
    return state


STATE = canonical_state()
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


def validate_upload_state() -> None:
    """Refuse real uploads unless the module paths still point at the canonical state."""
    state = validate_state_location()
    expected = {"STATE": state, "JOURNAL": state / "journal-3407487520.json",
                "HALT": state / "HALT-3407487520", "AUDIO_HALT": state / "HALT-audio-3407487520",
                "MODEL_HALT": state / "HALT-models-3407487520"}
    if any(globals()[name] != path for name, path in expected.items()):
        raise RuntimeError("Real uploads require canonical journal and HALT paths")


def save(path: Path, value: Any) -> None:
    """Write JSON atomically (temp file then rename) so a crash never truncates the journal."""
    # A predictable .tmp name could follow a pre-planted symlink or collide
    # with another writer. mkstemp creates a private, exclusive sibling.
    descriptor, name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    temp = Path(name)
    try:
        with os.fdopen(descriptor, "w") as output:
            output.write(json.dumps(value, indent=2) + "\n")
            output.flush()
            os.fsync(output.fileno())
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def load_journal() -> dict[str, Any]:
    """Read the shared journal; an absent journal is an empty one."""
    return json.loads(JOURNAL.read_text()) if JOURNAL.exists() else {"uploads": {}}


def asset_class(asset_type: str) -> str:
    """Map a Roblox asset type to the HALT class it belongs to: "audio" or "models"."""
    if asset_type in {"Audio", "Voice"}:
        return "audio"
    if asset_type in {"Model", "Mesh", "MeshPart", "Image", "Decal"}:
        return "models"
    raise RuntimeError("Unsupported upload asset type")


def gate(own: str | None = None, *, asset_type: str = "Audio") -> None:
    """Fail closed before any upload: audio is always refused; models need no model HALT and no
    unresolved non-audio journal entry other than ``own`` (so an interrupted upload can resume)."""
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
    """Require fetched origin/main evidence and identical working bytes.

    Callers fetch origin before real runs. A local HEAD commit is not approval.
    """
    root = ROOT if root is None else root
    if Path(path).is_absolute() or ".." in Path(path).parts:
        raise RuntimeError("Invalid evidence path")
    result = subprocess.run(["git", "show", "origin/main:" + path], cwd=root, capture_output=True)
    if result.returncode:
        raise RuntimeError("Missing committed origin/main independent safety-review record")
    local = root / path
    if not local.is_file() or local.is_symlink() or local.read_bytes() != result.stdout:
        raise RuntimeError("Local evidence differs from committed origin/main safety review")
    return result.stdout


def strict_json(content: bytes) -> dict[str, Any]:
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise RuntimeError("Ambiguous duplicate JSON decision field")
            result[key] = value
        return result
    value = json.loads(content, object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise RuntimeError("Expected safety evidence object")
    return value


def require_model_review(filename: str, content: bytes, digest: str, *,
                         root: Path | None = None, embedded: bool = False) -> dict[str, Any]:
    """Exact manifest plus final decisions; negative decisions always win.

    Identity checks cannot prove independence: an orchestrator-assigned reviewer
    and PR merge provide that process guarantee. No substring grants approval.
    """
    root = ROOT if root is None else root
    if hashlib.sha256(content).hexdigest() != digest:
        raise RuntimeError("Upload SHA-256 differs from content")
    extension = r"(?:json|mesh|png|bin)" if embedded else "fbx"
    if not re.fullmatch(r"[A-Za-z0-9_-]+\." + extension, filename):
        raise RuntimeError("Invalid embedded asset filename" if embedded else "Invalid FBX upload filename")
    asset = filename.rsplit(".", 1)[0]
    approval = strict_json(committed_file(
        "docs/qa/asset-reviews/approvals/" + asset + ".json", root=root))
    if approval.get("uploadSet") != {filename: digest}:
        raise RuntimeError("Missing matching committed independent 10/10 APPROVE safety review")
    folder = "assets/roblox-upload/" + asset + "/"
    manifest = strict_json(committed_file(folder + "export-manifest.json", root=root))
    files = manifest.get("files")
    creator = manifest.get("creator")
    version = manifest.get("exportVersion")
    if (not isinstance(creator, str) or not creator.strip() or not isinstance(version, str) or not version
            or version != approval.get("exportVersion") or not isinstance(files, dict)
            or files != {**approval.get("embeddedTextures", {}), **approval["uploadSet"]}):
        raise RuntimeError("Invalid creator/exportVersion/files in export manifest")
    for name, sha in files.items():
        if (not re.fullmatch(r"[A-Za-z0-9_-]+\.(?:fbx|png|json|mesh|bin)", name)
                or not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{64}", sha)):
            raise RuntimeError("Invalid dependency hash/path")
        data = committed_file(folder + name, root=root)
        if name == filename and data != content:
            raise RuntimeError("Uploaded FBX differs from committed origin/main asset")
        if hashlib.sha256(data).hexdigest() != sha:
            raise RuntimeError("Uploaded file/dependency SHA-256 differs from manifest")
    # All decision JSONs are authoritative, not just a selected positive record.
    directory = "docs/qa/asset-reviews/decisions"
    listing = subprocess.run(["git", "ls-tree", "-r", "--name-only", "origin/main", "--", directory],
                             cwd=root, capture_output=True, check=True).stdout.decode().splitlines()
    local = {str(p.relative_to(root)) for p in (root / directory).rglob("*.json")}
    paths = {p for p in listing if p.endswith(".json")}
    if paths != local:
        raise RuntimeError("Uncommitted/local-only or missing safety decision records")
    matches = []
    for path in sorted(paths):
        decision = strict_json(committed_file(path, root=root))
        hashes = decision.get("files")
        if not isinstance(hashes, dict):
            raise RuntimeError("Invalid safety decision files")
        overlaps = bool(set(files.values()).intersection(hashes.values()))
        same_export = decision.get("asset") == asset and decision.get("exportVersion") == version
        negative = (decision.get("verdict") != "APPROVE" or type(decision.get("score")) is not int
                    or decision["score"] != 10)
        if negative and (overlaps or same_export):
            raise RuntimeError("Safety decision requires 10/10 APPROVE; REJECT/lesser score blocks these bytes or export")
        if digest not in hashes.values():
            continue
        reviewer = decision.get("reviewer")
        policies = decision.get("policyLinks")
        if (decision.get("verdict") != "APPROVE" or type(decision.get("score")) is not int
                or decision["score"] != 10):
            raise RuntimeError("Safety decision requires 10/10 APPROVE; REJECT/lesser score blocks these bytes")
        if (decision.get("asset") != asset or hashes != files or decision.get("exportVersion") != version
                or decision.get("creator") != creator or not isinstance(reviewer, str) or not reviewer.strip()
                or reviewer.casefold().strip() == creator.casefold().strip()
                or any(marker in reviewer.casefold() for marker in ("creator", "self", "implementation", "author"))
                or creator.casefold().strip() in reviewer.casefold()
                or not re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:T.*Z)?", str(decision.get("reviewDate", "")))
                or not isinstance(policies, list) or not {
                    "https://www.roblox.com/termsofuse",
                    "https://en.help.roblox.com/hc/en-us/articles/203313410-Roblox-Community-Standards/"
                }.issubset(policies)):
            raise RuntimeError("Invalid or non-independent matching safety decision")
        committed_file(decision.get("sourceReview", ""), root=root)
        matches.append(decision)
    if len(matches) != 1:
        raise RuntimeError("Missing or ambiguous matching committed 10/10 APPROVE decision")
    return approval


def record(name: str, value: dict[str, Any] | None) -> None:
    """Upsert (or delete, when ``value`` is None) one journal entry against the newest journal on disk."""
    # Merge the newest journal instead of overwriting entries from other tools.
    state = load_journal()
    if value is None:
        state["uploads"].pop(name, None)
    else:
        state["uploads"][name] = value
    save(JOURNAL, state)


def http(method: str, url: str, key: str, body: bytes | None = None,
         content_type: str | None = None, *, deadline: float | None = None) -> dict[str, Any]:
    """Keyed Open Cloud request on the asset upload/status allowlist.

    A POST is re-parsed and re-gated (audio ban, model HALT, committed review) here and again before
    every retry, so direct callers cannot bypass ``submit_and_moderate``."""
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
        # Reject ambiguous wire representations rather than relying on Roblox
        # and Python to choose the same duplicate header/JSON field or encoding.
        for part in [message, *parts]:
            names = [name.casefold() for name, _ in part.raw_items()]
            if (len(names) != len(set(names)) or part.defects
                    or part.get("Content-Transfer-Encoding") is not None):
                raise RuntimeError("Ambiguous upload multipart content")
        if any(part.get_content_disposition() != "form-data" for part in parts):
            raise RuntimeError("Invalid upload multipart disposition")
        metadata = strict_json(parts[0].get_payload(decode=True))
        kind = metadata.get("assetType")
        if asset_class(kind) == "audio":
            gate(asset_type=kind)
        validate_upload_state()
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
    def before_attempt():
        validate_upload_state()
        if MODEL_HALT.exists():
            raise RuntimeError("Model uploads halted by Roblox moderation")
        if method == "POST":
            if asset_class(kind) == "audio":
                gate(asset_type=kind)
            require_model_review(parts[1].get_filename(), data, hashlib.sha256(data).hexdigest())
    return _http.request_json(request, timeout=90, deadline=deadline, before_attempt=before_attempt)


def moderation(key: str, asset: str, *, deadline: float | None = None) -> str | None:
    """Return the asset's moderation state as one of the two known constants, or None while pending/unknown."""
    data = http("GET", f"{API}/assets/{asset}?readMask=moderationResult", key, deadline=deadline)
    result = data.get("moderationResult")
    state = result.get("moderationState") if isinstance(result, dict) else None
    # Never persist arbitrary remote text (which might contain a credential).
    return {"Approved": APPROVED, "Rejected": REJECTED,
            APPROVED: APPROVED, REJECTED: REJECTED}.get(state) if isinstance(state, str) else None


def _identifier(value: Any, kind: str, key: str) -> str:
    """Validate an operation or asset id returned by Roblox and make sure it does not echo the key."""
    pattern = r"[0-9]{1,20}" if kind == "asset" else r"[A-Za-z0-9_-]{1,128}"
    if (not isinstance(value, (str, int)) or not re.fullmatch(pattern, str(value))
            or (key and key in str(value))):
        raise RuntimeError(f"Roblox returned an invalid {kind} ID; recover the journal before retrying")
    return str(value)


def _result_id(result: dict[str, Any], kind: str, key: str) -> str:
    """Read ``<kind>Id`` or the ``path`` form of an id from an Open Cloud response."""
    value = result.get(kind + "Id")
    if not value:
        path = result.get("path")
        prefix = "assets/" if kind == "asset" else "operations/"
        value = path[len(prefix):] if isinstance(path, str) and path.startswith(prefix) else None
    return _identifier(value, kind, key)


def _pause(seconds: float, deadline: float) -> None:
    """Sleep without overrunning the deadline; raises once the deadline has passed."""
    time.sleep(min(seconds, _http.remaining(deadline)))
    _http.remaining(deadline)


def submit_and_moderate(name: str, entry: str, item: dict[str, Any] | None,
                        content: bytes, digest: str, filename: str, description: str,
                        reviewer: str, key: str, rejected_message: str, *,
                        asset_type: str = "Audio") -> dict[str, Any]:
    """Submit once, then poll operation and moderation within one time budget.

    The shared gate and committed review are checked even for direct callers. Returns the approved journal item.
    """
    if asset_class(asset_type) != "audio":
        validate_upload_state()
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
