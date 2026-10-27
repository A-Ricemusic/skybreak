import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch
import urllib.error

TOOLS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("diagnostic", TOOLS / "diagnose-roblox-voice.py")
diagnostic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostic)


class DiagnosticsTests(unittest.TestCase):
    def test_target_combinations_and_no_secret_output(self):
        for place in ("", "private-wrong-place", diagnostic.target.OFFICIAL_PLACE):
            for universe in ("", "private-wrong-universe", diagnostic.target.OFFICIAL_UNIVERSE):
                with self.subTest(place=place, universe=universe):
                    output = io.StringIO()
                    with patch.dict(os.environ, {"ROBLOX_PLACE_ID": place, "ROBLOX_UNIVERSE_ID": universe}, clear=True), contextlib.redirect_stdout(output):
                        valid = diagnostic.target.validate_target()
                    self.assertEqual(valid, place == diagnostic.target.OFFICIAL_PLACE and universe == diagnostic.target.OFFICIAL_UNIVERSE)
                    self.assertNotIn("private-wrong", output.getvalue())

    def test_mismatch_stops_before_any_network(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(diagnostic.urllib.request, "build_opener") as opener, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(diagnostic.main(), 1)
            opener.assert_not_called()

    def test_metadata_success_is_not_grant_proof(self):
        response = io.BytesIO(json.dumps({"assetId": int(diagnostic.VOICE_IDS[0]), "assetType": "Audio", "description": "private-response"}).encode())
        response.status = 200
        opener = Mock()
        opener.open.return_value = response
        result = diagnostic.probe(diagnostic.VOICE_IDS[0], "private-key", opener)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(request.full_url, "https://apis.roblox.com/assets/v1/assets/96143096268975")
        self.assertTrue(result["metadata_identity_matches"])
        self.assertTrue(result["audio_type_matches"])
        self.assertEqual(result["experience_use_permission"], "unverified")
        self.assertNotIn("private", json.dumps(result))

    def test_http_failures_suppress_response_and_key(self):
        for status in (301, 401, 403, 404, 429, 500):
            opener = Mock()
            opener.open.side_effect = urllib.error.HTTPError("private-url", status, "private-key", {}, io.BytesIO(b"private-body"))
            result = diagnostic.probe(diagnostic.VOICE_IDS[0], "private-key", opener)
            self.assertEqual(result["http_status"], status)
            self.assertEqual(result["experience_use_permission"], "unverified")
            self.assertNotIn("private", json.dumps(result))

    def test_transport_failure_suppresses_exception(self):
        opener = Mock()
        opener.open.side_effect = RuntimeError("private-key")
        result = diagnostic.probe(diagnostic.VOICE_IDS[0], "private-key", opener)
        self.assertEqual(result["diagnosis"], "transport_or_response_error")
        self.assertNotIn("private", json.dumps(result))

    def test_redirect_refused(self):
        self.assertIsNone(diagnostic.NoRedirect().redirect_request(None, None, 302, "", {}, "https://elsewhere.example"))

    def test_publish_mismatch_never_calls_curl(self):
        with tempfile.TemporaryDirectory() as directory:
            fake_curl = Path(directory) / "curl"
            marker = Path(directory) / "called"
            fake_curl.write_text('#!/bin/sh\ntouch "$CURL_MARKER"\nexit 99\n')
            fake_curl.chmod(0o755)
            env = {"PATH": directory + os.pathsep + os.environ["PATH"], "CURL_MARKER": str(marker), "ROBLOX_PLACE_ID": "private-wrong", "ROBLOX_UNIVERSE_ID": diagnostic.target.OFFICIAL_UNIVERSE, "ROBLOX_API_KEY": "private-key"}
            result = subprocess.run(["bash", str(TOOLS / "publish-place.sh"), str(fake_curl)], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(marker.exists())
            self.assertNotIn("private", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
