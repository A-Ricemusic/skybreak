#!/usr/bin/env python3
"""Grant only the 14 existing voice and SFX banks to the official experience (dry-run default).

API contract: https://raw.githubusercontent.com/Roblox/creator-docs/main/content/en-us/reference/cloud/asset-permissions-api/v1.json
Requires x-api-key scope asset-permissions:write and authority over assets/subject.
No metadata response is treated as permission evidence. No automatic retries.
"""
import argparse
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

ASSET_IDS = (96143096268975, 72249736253176, 70686186147484,
             112591774159889, 119322000491190, 115928309099950,
             100845993226613, 96034533542673, 129430411346132, 140586818884141,
             119891912328421, 103061867054487, 78239725791801, 119485031741286)
ENDPOINT = "https://apis.roblox.com/asset-permissions-api/v1/assets/permissions"
MAX_RESPONSE_BYTES = 65536


def grant_request(key):
    # No caller-supplied asset, subject, action, or dependency parameters.
    body = {"subjectType": "Universe", "subjectId": target.OFFICIAL_UNIVERSE, "action": "Use",
            "requests": [{"assetId": asset_id, "grantToDependencies": False}
                         for asset_id in ASSET_IDS]}
    return urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(),
                                  headers={"x-api-key": key, "Content-Type": "application/json"},
                                  method="PATCH")


def report(payload):
    # Never emit server text, unknown IDs, error codes, or exception messages.
    successes = payload.get("successAssetIds") if isinstance(payload, dict) else None
    errors = payload.get("errors") if isinstance(payload, dict) else None
    valid_ids = isinstance(successes, list) and all(type(i) is int for i in successes)
    no_errors = isinstance(payload, dict) and errors in (None, [])
    complete = (valid_ids and len(successes) == 14 and set(successes) == set(ASSET_IDS)
                and no_errors)
    for asset_id in ASSET_IDS:
        failed = isinstance(errors, list) and any(
            isinstance(e, dict) and e.get("assetId") == asset_id for e in errors)
        outcome = "error" if failed else (
            "success_reported" if valid_ids and asset_id in successes else "unconfirmed")
        print(f"asset_id={asset_id} outcome={outcome}")
    print(f"all_14_grants_confirmed={str(complete).lower()}")
    return 0 if complete else 1


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Apply the fixed 14 Universe Use grants")
    args = parser.parse_args(argv)
    if not target.validate_target():
        print("Target mismatch or missing configuration; no API requests made.")
        return 1
    if not args.execute:
        print(f"dry_run=true subject_type=Universe subject_id={target.OFFICIAL_UNIVERSE} action=Use grant_to_dependencies=false")
        for asset_id in ASSET_IDS:
            print(f"asset_id={asset_id} outcome=planned")
        return 0
    key = os.environ.get("ROBLOX_API_KEY")
    if not key:
        print("api_key_present=false; no API requests made.")
        return 1
    try:
        opener = urllib.request.build_opener(NoRedirect())
        with opener.open(grant_request(key), timeout=30) as response:
            if response.status != 200:
                print("request_failed; grants unconfirmed.")
                return report(None)
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise ValueError()
            return report(json.loads(raw))
    except urllib.error.HTTPError as error:
        # Numeric HTTP status only; bodies and reason strings can contain secrets.
        print(f"http_status={error.code if type(error.code) is int else 0}")
        if error.code == 403:
            print("Check asset-permissions:write scope and authority over all 14 assets and the official universe.")
        error.close()
    except Exception:
        print("transport_or_response_error; grants unconfirmed; inspect before retrying.")
    return report(None)


if __name__ == "__main__":
    raise SystemExit(main())
