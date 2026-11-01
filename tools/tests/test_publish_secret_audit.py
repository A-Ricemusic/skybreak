"""Publish shell tests use inert executables and synthetic values; no HTTP."""
import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import traceback
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import urllib.error

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
import _http


class PublishSecretAuditTests(unittest.TestCase):
    def run_publish(self, status="200", curl_exit="0", value="fake-audit-value", gate_exit="0"):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def executable(name, body):
                path = root / name
                path.write_text("#!/bin/sh\n" + body)
                path.chmod(0o755)
            executable("python3", '''case "$1" in
              *check-place-voice.py) echo "$2" > "$FIXTURE/voice-path";;
              *check-place-assets.py) echo "$2" > "$FIXTURE/asset-path"; exit "$GATE_EXIT";;
              esac
            ''')
            executable("git", "exit 0\n")
            executable("sleep", "exit 0\n")
            executable("curl", '''printf '%s\\n' "$@" > "$FIXTURE/arguments"
              cat > "$FIXTURE/headers"
              while [ "$#" -gt 0 ]; do
                if [ "$1" = -o ]; then shift; printf '%s' "$ROBLOX_API_KEY" > "$1"; fi
                shift
              done
              printf '%s' "$FAKE_STATUS"
              exit "$CURL_EXIT"
            ''')
            artifact = root / "input.rbxlx"
            artifact.write_text("synthetic place")
            env = {**os.environ, "PATH": str(root) + os.pathsep + os.environ["PATH"],
                   "FIXTURE": str(root), "ROBLOX_API_KEY": value,
                   "ROBLOX_PLACE_ID": "112911685457826", "ROBLOX_UNIVERSE_ID": "10772984313",
                   "FAKE_STATUS": status, "CURL_EXIT": curl_exit, "GATE_EXIT": gate_exit}
            result = subprocess.run(["bash", "-x", str(TOOLS / "publish-place.sh"), str(artifact)],
                                    env=env, capture_output=True, text=True)
            self.assertNotIn(value, result.stdout + result.stderr)
            arguments = (root / "arguments").read_text() if (root / "arguments").exists() else ""
            self.assertNotIn(value, arguments)
            if arguments:
                self.assertEqual(arguments.splitlines()[0], "--disable")
                self.assertIn("-o\n/dev/null\n", arguments)
                self.assertEqual((root / "headers").read_text(), "x-api-key: " + value + "\n")
                voice = (root / "voice-path").read_text().strip()
                self.assertEqual(voice, (root / "asset-path").read_text().strip())
                self.assertNotEqual(voice, str(artifact))
                self.assertFalse(Path(voice).exists(), "private snapshot must be removed")
            return result, arguments

    def test_success_discards_remote_body_and_keeps_key_off_argv_and_trace(self):
        result, _ = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_http_and_transport_failures_return_nonzero_without_remote_text(self):
        for status, code in (("403", "0"), ("000", "7")):
            result, _ = self.run_publish(status, code)
            self.assertNotEqual(result.returncode, 0)

    def test_gate_failure_and_injected_header_never_call_curl(self):
        for options in ({"gate_exit": "1"}, {"value": "fake-value\nInjected: fake"}):
            result, arguments = self.run_publish(**options)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(arguments, "")


class LegacyTransportSecretTests(unittest.TestCase):
    def test_http_error_is_sanitized_before_legacy_callers_can_log_it(self):
        value = "fake-reflected-audit-value"
        body = Mock(wraps=io.BytesIO(value.encode()))
        error = urllib.error.HTTPError("https://example.invalid/" + value, 429, value,
                                       {"Retry-After": "3"}, body)
        request = __import__("urllib.request", fromlist=["Request"]).Request("https://example.invalid/fixed")
        with patch.object(_http.OPENER, "open", side_effect=error):
            with self.assertRaises(urllib.error.HTTPError) as raised:
                _http.open(request, timeout=1)
        self.assertNotIn(value, "".join(traceback.format_exception(raised.exception)))
        self.assertEqual(raised.exception.code, 429)
        self.assertEqual(raised.exception.headers["Retry-After"], "3")
        self.assertFalse(raised.exception.read())
        raised.exception.close()
        body.read.assert_not_called()
        body.close.assert_called_once()

    def test_transport_error_does_not_echo_remote_reason(self):
        with patch.object(_http.OPENER, "open", side_effect=urllib.error.URLError("fake-reflected-audit-value")):
            with self.assertRaises(_http.HTTPFailure) as raised:
                _http.open(None, timeout=1)
        self.assertNotIn("fake-reflected-audit-value", "".join(traceback.format_exception(raised.exception)))

    def test_voice_failure_reports_do_not_print_remote_body_or_audio(self):
        spec = importlib.util.spec_from_file_location("audit_voice", TOOLS / "voice.py")
        voice = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(voice)
        value = "fake-reflected-audit-value"
        request = {"text": "test", "model_id": "fake", "voice_settings": {},
                   "voice_id": "fake", "output_format": "fake"}
        args = SimpleNamespace(key_file="unused", only=None, limit=None, budget=1000)
        for result in (value.encode(), urllib.error.HTTPError(
                "https://example.invalid", 400, value, {}, io.BytesIO(value.encode()))):
            with contextlib.ExitStack() as stack:
                for name, replacement in {
                    "casting": {}, "lines": [], "pending": [({"id": "fake-line"}, request, "fake-cache")],
                    "load_json": {"baselineUsed": 0, "runs": []}, "multiplier": 1,
                    "subscription": {"tier": "paid", "used": 0, "limit": 1000},
                    "save_json": None,
                }.items():
                    stack.enter_context(patch.object(voice, name, return_value=replacement))
                stack.enter_context(patch.object(voice._http, "read_key_file", return_value="fake-audit-value"))
                if isinstance(result, Exception):
                    stack.enter_context(patch.object(voice, "api", side_effect=result))
                else:
                    stack.enter_context(patch.object(voice, "api", return_value=(result, {})))
                output = stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                with self.assertRaises(SystemExit) as raised:
                    voice.cmd_generate(args)
                self.assertEqual(raised.exception.code, 1)
                self.assertIn("FAILED", output.getvalue())
                self.assertNotIn(value, output.getvalue())

    def test_voice_response_read_failure_does_not_echo_remote_text(self):
        spec = importlib.util.spec_from_file_location("audit_voice_read", TOOLS / "voice.py")
        voice = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(voice)
        response = Mock()
        response.read.side_effect = OSError("fake-reflected-audit-value")
        with patch.object(voice._http, "open", return_value=contextlib.nullcontext(response)):
            with self.assertRaises(_http.HTTPFailure) as raised:
                voice.api("GET", "/v1/voices", "fake-audit-value")
        self.assertNotIn("fake-reflected-audit-value", "".join(traceback.format_exception(raised.exception)))
