#!/usr/bin/env python3
"""GET-only CI metadata probe. Metadata access is NOT experience-use permission.

Official references checked 2026-10-27:
https://create.roblox.com/docs/cloud/reference/features/assets
https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/cloud/assets/v1.json
https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/cloud/asset-permissions-api/v1.json

GET /assets/v1/assets/{assetId} requires asset:read. The documented permissions
API offers PATCH (asset-permissions:write), not a read/list operation. Do not
probe guessed endpoints, grant permissions, or infer experience access from 200.
"""
import importlib.util
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

from _http import NoRedirect

spec = importlib.util.spec_from_file_location("target", Path(__file__).with_name("verify-roblox-target.py"))
target = importlib.util.module_from_spec(spec)
spec.loader.exec_module(target)

VOICE_IDS = (
    "96143096268975", "72249736253176", "70686186147484",
    "112591774159889", "119322000491190", "115928309099950",
)


def probe(asset_id, key, opener):
    request = urllib.request.Request(
        f"https://apis.roblox.com/assets/v1/assets/{asset_id}",
        headers={"x-api-key": key}, method="GET",
    )
    result = {"asset_id": asset_id, "experience_use_permission": "unverified"}
    try:
        with opener.open(request, timeout=30) as response:
            result["http_status"] = response.status
            payload = json.load(response)
            result["metadata_identity_matches"] = str(payload.get("assetId")) == asset_id
            result["audio_type_matches"] = payload.get("assetType") == "Audio"
    except urllib.error.HTTPError as error:
        result["http_status"] = error.code
        result["diagnosis"] = {
            401: "key_not_authorized_for_operation",
            403: "required_permission_missing",
            404: "asset_not_found_or_not_visible",
            429: "rate_limited",
        }.get(error.code, "request_failed")
        error.close()
    except Exception:
        # Exceptions and response bodies can contain URLs/headers: never print them.
        result["diagnosis"] = "transport_or_response_error"
    return result


def main():
    if not target.validate_target():
        print("Target mismatch or missing configuration; no API requests made.")
        return 1
    key = os.environ.get("ROBLOX_API_KEY")
    if not key:
        print("api_key_present=false; no API requests made.")
        return 1
    opener = urllib.request.build_opener(NoRedirect())
    results = [probe(asset_id, key, opener) for asset_id in VOICE_IDS]
    print(json.dumps(results, indent=2))
    print("Experience grants remain UNVERIFIED: no documented API-key read/list endpoint found.")
    print("Verify each audio's experience permissions in Creator Dashboard for the official universe.")
    print("401/403 require checking the existing key's asset:read scope and creator access; they do not prove a missing experience grant.")
    return 0 if all(r.get("metadata_identity_matches") and r.get("audio_type_matches") for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
