import contextlib
import importlib.util
import io
import json
import os
import re
import sys
from pathlib import Path
import unittest
from unittest.mock import Mock, patch
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # scripts import tools/_http.py
spec = importlib.util.spec_from_file_location("repair", Path(__file__).resolve().parents[1] / "repair-roblox-audio-permissions.py")
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)
IDS = [100845993226613, 96034533542673, 129430411346132, 140586818884141, 119891912328421, 103061867054487, 78239725791801, 119485031741286]
ENV = {"ROBLOX_PLACE_ID": "112911685457826", "ROBLOX_UNIVERSE_ID": "10772984313",
       "ROBLOX_API_KEY": "private-key"}


class PermissionsTests(unittest.TestCase):
    def run_repair(self, payload=None, error=None, env=None, execute=True, status=200):
        opener = Mock()
        response = io.BytesIO(json.dumps(payload).encode())
        response.status = status
        opener.open.return_value = response
        opener.open.side_effect = error
        output = io.StringIO()
        with patch.dict(os.environ, ENV if env is None else env, clear=True), patch.object(
                repair.urllib.request, "build_opener", return_value=opener) as build, contextlib.redirect_stdout(output):
            result = repair.main(["--execute"] if execute else [])
        self.assertNotIn("private", output.getvalue())
        return result, output.getvalue(), opener, build

    def test_wrong_or_missing_targets_never_open_network(self):
        for field in ("ROBLOX_PLACE_ID", "ROBLOX_UNIVERSE_ID"):
            for value in ("", "private-wrong"):
                env = dict(ENV, **{field: value})
                code, _, opener, build = self.run_repair(env=env)
                self.assertEqual(code, 1)
                build.assert_not_called()
                opener.open.assert_not_called()

    def test_dry_run_default_and_missing_key_never_open_network(self):
        code, out, _, build = self.run_repair(env={k: v for k, v in ENV.items() if k != "ROBLOX_API_KEY"}, execute=False)
        self.assertEqual(code, 0)
        self.assertEqual(out.count("outcome=planned"), 8)
        build.assert_not_called()
        code, _, _, build = self.run_repair(env={k: v for k, v in ENV.items() if k != "ROBLOX_API_KEY"})
        self.assertEqual(code, 1)
        build.assert_not_called()

    def test_exact_request_and_success(self):
        code, out, opener, build = self.run_repair({"successAssetIds": list(reversed(IDS)), "errors": []})
        self.assertEqual(code, 0)
        self.assertIn("all_8_grants_confirmed=true", out)
        opener.open.assert_called_once()
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://apis.roblox.com/asset-permissions-api/v1/assets/permissions")
        self.assertEqual(request.get_method(), "PATCH")
        self.assertEqual(request.get_header("X-api-key"), "private-key")
        self.assertEqual(request.get_header("Content-type"), "application/json")
        self.assertEqual(json.loads(request.data), {
            "subjectType": "Universe", "subjectId": "10772984313", "action": "Use",
            "requests": [{"assetId": i, "grantToDependencies": False} for i in IDS]})
        self.assertEqual(opener.open.call_args.kwargs, {"timeout": 30})
        self.assertIsInstance(build.call_args.args[0], repair.NoRedirect)

    def test_partial_and_malformed_results_fail_closed(self):
        for payload in (
            None, [], {}, {"successAssetIds": IDS[:-1]},
            {"successAssetIds": IDS + [IDS[0]]}, {"successAssetIds": IDS + [42]},
            {"successAssetIds": [str(i) for i in IDS]},
            {"successAssetIds": IDS, "errors": [{"assetId": IDS[0], "code": "private-error"}]},
            {"successAssetIds": IDS, "errors": "private-error"},
            {"successAssetIds": IDS, "errors": [{"assetId": 42}]},
        ):
            with self.subTest(payload=payload):
                code, out, _, _ = self.run_repair(payload)
                self.assertEqual(code, 1)
                self.assertIn("all_8_grants_confirmed=false", out)
                self.assertEqual(out.count("outcome="), 8)
        code, out, _, _ = self.run_repair({"successAssetIds": IDS[:-1], "errors": [{"assetId": IDS[-1], "code": "CannotManageAsset"}]})
        self.assertEqual(out.count("outcome=success_reported"), 7)
        self.assertIn(f"asset_id={IDS[-1]} outcome=error", out)

    def test_http_and_transport_failures_suppress_secrets(self):
        for status in (301, 302, 307, 308, 401, 403, 429, 500):
            error = urllib.error.HTTPError("private-url", status, "private-reason", {}, io.BytesIO(b"private-body"))
            code, out, opener, _ = self.run_repair(error=error)
            self.assertEqual(code, 1)
            opener.open.assert_called_once()
            if status == 403:
                self.assertIn("asset-permissions:write", out)
        code, _, _, _ = self.run_repair(error=RuntimeError("private-key"))
        self.assertEqual(code, 1)
        code, _, _, _ = self.run_repair({"private-key": "private-body"})
        self.assertEqual(code, 1)
        code, _, _, _ = self.run_repair({"successAssetIds": IDS, "private": "x" * 65536})
        self.assertEqual(code, 1)
        code, _, _, _ = self.run_repair({"successAssetIds": IDS}, status=302)
        self.assertEqual(code, 1)

    def test_allowlist_matches_approved_records_and_runtime_banks(self):
        root = Path(__file__).resolve().parents[2]
        recorded = set()
        runtime = set()
        for directory, source in (("audio", "SoundBank.ts"),):
            entries = json.loads((root / "assets" / directory / "uploaded.json").read_text())
            for entry in entries.values():
                self.assertEqual(entry["assetType"], "Audio")
                self.assertEqual(entry["state"], "MODERATION_STATE_APPROVED")
                recorded.add(int(entry["assetId"]))
            runtime.update(int(i) for i in re.findall(r"rbxassetid://(\d+)", (root / "src/shared" / source).read_text()))
        self.assertEqual(recorded, set(IDS))
        self.assertEqual(runtime, set(IDS))
        self.assertEqual(tuple(IDS), repair.ASSET_IDS)
        self.assertEqual(len(set(IDS)), 8)

    def test_redirect_refused(self):
        for status in (301, 302, 303, 307, 308):
            self.assertIsNone(repair.NoRedirect().redirect_request(None, None, status, "", {}, "https://elsewhere.example"))


if __name__ == "__main__":
    unittest.main()
