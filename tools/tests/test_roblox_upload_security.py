"""Security regression tests. Every HTTP call is mocked; Roblox is never contacted."""
import contextlib
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import ssl
import sys
import tempfile
import traceback
import unittest
from unittest.mock import Mock, patch
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import _http
import roblox_upload as ru

spec = importlib.util.spec_from_file_location("upload_audio_security", Path(__file__).resolve().parents[1] / "upload-audio.py")
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)

voice_spec = importlib.util.spec_from_file_location("upload_voice_security", Path(__file__).resolve().parents[1] / "upload-voice.py")
voice = importlib.util.module_from_spec(voice_spec)
voice_spec.loader.exec_module(voice)

SECRET = "private-credential-must-never-appear"


class NoNetworkTests(unittest.TestCase):
    def setUp(self):
        network = patch.object(_http.OPENER, "open", side_effect=AssertionError("Unmocked HTTP is forbidden"))
        network.start()
        self.addCleanup(network.stop)

    def assert_private(self, error):
        rendered = "".join(traceback.format_exception(type(error), error, error.__traceback__))
        self.assertNotIn(SECRET, str(error))
        self.assertNotIn(SECRET, repr(error))
        self.assertNotIn(SECRET, rendered)


class HttpSecurityTests(NoNetworkTests):
    def request(self, method="GET"):
        return urllib.request.Request(ru.API + "/operations/op1", method=method, headers={"x-api-key": SECRET})

    def http_error(self, status, headers=None):
        body = Mock(wraps=io.BytesIO((SECRET * 1000).encode()))
        error = urllib.error.HTTPError("https://example.invalid/" + SECRET, status, SECRET, headers or {}, body)
        return error, body

    def test_redirects_never_forward_credentials(self):
        for status in (301, 302, 303, 307, 308):
            self.assertIsNone(_http.NoRedirect().redirect_request(self.request(), None, status, "", {}, "https://elsewhere.invalid"))

    def test_default_opener_keeps_verified_https_handler(self):
        https = next(handler for handler in _http.OPENER.handlers if isinstance(handler, urllib.request.HTTPSHandler))
        context = https._context  # None (older Python) means urllib's default verified context.
        if context is not None:
            self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
            self.assertTrue(context.check_hostname)
        self.assertTrue(any(isinstance(handler, _http.NoRedirect) for handler in _http.OPENER.handlers))

    def test_safe_get_retries_429_and_503_with_backoff(self):
        limited, limited_body = self.http_error(429, {"Retry-After": "3"})
        busy, busy_body = self.http_error(503)
        with patch.object(_http, "open", side_effect=[limited, busy, io.BytesIO(b'{"ok":true}')]) as opener, \
                patch.object(_http.time, "sleep") as sleep:
            self.assertEqual(_http.request_json(self.request()), {"ok": True})
        self.assertEqual(opener.call_count, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [3, 2])
        for body in (limited_body, busy_body):
            body.read.assert_not_called()
            body.close.assert_called_once()
        for call in opener.call_args_list:
            self.assertGreater(call.kwargs["timeout"], 0)
            self.assertLessEqual(call.kwargs["timeout"], 90)

    def test_retry_after_http_date_is_honored(self):
        future = format_datetime(datetime.now(timezone.utc) + timedelta(seconds=10), usegmt=True)
        error, _ = self.http_error(429, {"Retry-After": future})
        with patch.object(_http, "open", side_effect=[error, io.BytesIO(b'{}')]), patch.object(_http.time, "sleep") as sleep:
            _http.request_json(self.request())
        self.assertGreaterEqual(sleep.call_args.args[0], 8)
        self.assertLessEqual(sleep.call_args.args[0], 10)

    def test_excessive_retry_after_fails_instead_of_retrying_early(self):
        error, body = self.http_error(429, {"Retry-After": "3600"})
        with patch.object(_http, "open", side_effect=error) as opener, patch.object(_http.time, "sleep") as sleep:
            with self.assertRaises(_http.HTTPFailure) as raised:
                _http.request_json(self.request())
        self.assertEqual(raised.exception.status, 429)
        self.assert_private(raised.exception)
        self.assertEqual(opener.call_count, 1)
        sleep.assert_not_called()
        body.read.assert_not_called()

    def test_malformed_retry_after_falls_back_to_backoff(self):
        for value in (SECRET, "NaN", "Infinity", "-1"):
            with self.subTest(value=value):
                error, _ = self.http_error(429, {"Retry-After": value})
                with patch.object(_http, "open", side_effect=[error, io.BytesIO(b'{}')]), patch.object(_http.time, "sleep") as sleep:
                    _http.request_json(self.request())
                sleep.assert_called_once_with(1)

    def test_retries_stop_after_three_attempts_and_redact_all_error_text(self):
        errors = [self.http_error(503)[0] for _ in range(3)]
        with patch.object(_http, "open", side_effect=errors) as opener, patch.object(_http.time, "sleep") as sleep:
            with self.assertRaisesRegex(_http.HTTPFailure, "Roblox HTTP 503") as raised:
                _http.request_json(self.request())
        self.assert_private(raised.exception)
        self.assertEqual(opener.call_count, 3)
        self.assertEqual(sleep.call_count, 2)

    def test_upload_post_never_retries_5xx_or_transport_failure(self):
        for error in (self.http_error(503)[0], urllib.error.URLError(SECRET)):
            with self.subTest(error=type(error).__name__):
                with patch.object(_http, "open", side_effect=error) as opener, patch.object(_http.time, "sleep") as sleep:
                    with self.assertRaises(_http.HTTPFailure) as raised:
                        _http.request_json(self.request("POST"))
                self.assert_private(raised.exception)
                self.assertEqual(opener.call_count, 1)
                sleep.assert_not_called()

    def test_upload_post_can_retry_explicit_rate_limit(self):
        error, _ = self.http_error(429)
        with patch.object(_http, "open", side_effect=[error, io.BytesIO(b'{}')]) as opener, patch.object(_http.time, "sleep"):
            self.assertEqual(_http.request_json(self.request("POST")), {})
        self.assertEqual(opener.call_count, 2)

    def test_client_and_redirect_failures_are_private_and_not_retried(self):
        for status in (302, 307, 400, 401, 403):
            with self.subTest(status=status):
                error, body = self.http_error(status)
                with patch.object(_http, "open", side_effect=error) as opener:
                    with self.assertRaises(_http.HTTPFailure) as raised:
                        _http.request_json(self.request())
                self.assert_private(raised.exception)
                self.assertEqual(opener.call_count, 1)
                body.read.assert_not_called()

    def test_transport_and_json_errors_never_echo_secrets(self):
        errors = (urllib.error.URLError(SECRET), OSError(SECRET), http.client.BadStatusLine(SECRET), ValueError(SECRET))
        for error in errors:
            with self.subTest(error=type(error).__name__):
                with patch.object(_http, "open", side_effect=error):
                    with self.assertRaises(_http.HTTPFailure) as raised:
                        _http.request_json(self.request())
                self.assert_private(raised.exception)
        for content in (SECRET.encode(), json.dumps(SECRET).encode(), b'[]', b'\xff'):
            with self.subTest(content=content[:8]):
                with patch.object(_http, "open", return_value=io.BytesIO(content)):
                    with self.assertRaises(_http.HTTPFailure) as raised:
                        _http.request_json(self.request())
                self.assert_private(raised.exception)

    def test_json_response_reads_at_most_limit_plus_one(self):
        class TrackingBody(io.BytesIO):
            total_read = 0

            def read(self, size=-1):
                if size < 0:
                    raise AssertionError("Unbounded response read")
                result = super().read(size)
                self.total_read += len(result)
                return result

            read1 = read

        body = TrackingBody(b"x" * (_http.MAX_RESPONSE_BYTES + 100))
        with patch.object(_http, "open", return_value=body):
            with self.assertRaisesRegex(_http.HTTPFailure, "size limit"):
                _http.request_json(self.request())
        self.assertEqual(body.total_read, _http.MAX_RESPONSE_BYTES + 1)

    def test_deadline_limits_timeout_and_prevents_excessive_retry_sleep(self):
        error, _ = self.http_error(429, {"Retry-After": "3"})
        with patch.object(_http.time, "monotonic", return_value=100), patch.object(_http.time, "sleep") as sleep, \
                patch.object(_http, "open", side_effect=error) as opener:
            with self.assertRaisesRegex(_http.HTTPFailure, "deadline"):
                _http.request_json(self.request(), deadline=102)
        self.assertEqual(opener.call_args.kwargs["timeout"], 2)
        sleep.assert_not_called()

    def test_deadline_expiring_during_http_error_does_not_reveal_exception_context(self):
        error, _ = self.http_error(429)
        with patch.object(_http.time, "monotonic", side_effect=[100, 103]), \
                patch.object(_http, "open", side_effect=error):
            with self.assertRaisesRegex(_http.HTTPFailure, "deadline") as raised:
                _http.request_json(self.request(), deadline=102)
        self.assert_private(raised.exception)

    def test_deadline_checked_between_streamed_response_reads(self):
        now = [100.0]

        class SlowBody(io.BytesIO):
            reads = 0

            def read1(self, size):
                self.reads += 1
                now[0] += 6
                return b" "

        body = SlowBody()
        with patch.object(_http.time, "monotonic", side_effect=lambda: now[0]), patch.object(_http, "open", return_value=body):
            with self.assertRaisesRegex(_http.HTTPFailure, "deadline"):
                _http.request_json(self.request(), deadline=110)
        self.assertEqual(body.reads, 2)

    def test_expired_deadline_never_opens_request(self):
        with patch.object(_http.time, "monotonic", return_value=100), patch.object(_http, "open") as opener:
            with self.assertRaisesRegex(_http.HTTPFailure, "deadline"):
                _http.request_json(self.request(), deadline=99)
        opener.assert_not_called()

    def test_endpoint_allowlist_rejects_prefix_and_query_bypasses(self):
        urls = [ru.API + suffix for suffix in (
            "/assets-evil", "/assets/1?key=" + SECRET, "/operations/../assets", "/operations/id?x=1",
            "/operations/id#fragment", "/operations/id\n", "/assets/1?readMask=moderationResult&x=1")]
        urls += ["http://apis.roblox.com/assets/v1/operations/id", "https://apis.roblox.com.evil/assets/v1/operations/id"]
        with patch.object(_http, "open") as opener:
            for url in urls:
                with self.subTest(url=url), self.assertRaisesRegex(RuntimeError, "allowlist") as raised:
                    ru.http("GET", url, SECRET)
                self.assert_private(raised.exception)
            with self.assertRaisesRegex(RuntimeError, "allowlist"):
                ru.http("DELETE", ru.API + "/assets", SECRET)
        opener.assert_not_called()

    def test_invalid_header_key_rejected_without_echo(self):
        with patch.object(_http, "open") as opener:
            for key in ("", SECRET + "\nHeader: injected", SECRET + "\u2603"):
                with self.assertRaisesRegex(RuntimeError, "Invalid API key") as raised:
                    ru.http("POST", ru.API + "/assets", key)
                self.assert_private(raised.exception)
        opener.assert_not_called()

    def test_secret_files_are_bounded_and_fail_without_exposing_content_or_path(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / SECRET
            path.write_bytes((SECRET + "\n").encode())
            self.assertEqual(_http.read_key_file(path), SECRET)
            for content in (b"", (SECRET + "\nsecond-line").encode(), SECRET.encode() + b'\xff', b'x' * 8193):
                path.write_bytes(content)
                with self.assertRaises(RuntimeError) as raised:
                    _http.read_key_file(path)
                self.assert_private(raised.exception)
            path.unlink()
            with self.assertRaises(RuntimeError) as raised:
                _http.read_key_file(path)
            self.assert_private(raised.exception)


class AudioPathSecurityTests(NoNetworkTests):
    def setUp(self):
        super().setUp()
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.base = Path(temp.name)
        for name in ("HALT", "AUDIO_HALT", "MODEL_HALT", "JOURNAL"):
            patcher = patch.object(ru, name, self.base / name)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.root = self.base / "repo"
        self.assets = self.root / "assets/audio"
        self.assets.mkdir(parents=True)
        for name, value in (("ROOT", self.root), ("ASSETS", self.assets)):
            patcher = patch.object(audio, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.content = b"OggS-reviewed-content"
        self.digest = hashlib.sha256(self.content).hexdigest()
        self.review = {"commercialUsePermitted": True, "files": {"cue": {
            "sha256": self.digest, "approved": True, "transcript": "", "reviewer": "human", "method": "listened"}}}

    def test_audio_and_voice_clis_refuse_before_key_read_or_state_changes(self):
        for module in (audio, voice):
            state = self.base / "must-not-be-created"
            with patch.object(module, "STATE", state), \
                    patch.object(sys, "argv", ["upload.py", "--key-file", "/unused"]), \
                    patch.object(Path, "read_text", side_effect=AssertionError("No files should be read")), \
                    self.assertRaisesRegex(RuntimeError, "permanently disabled"):
                module.main()
            self.assertFalse(state.exists())

    def test_valid_audio_still_uses_existing_upload_interface(self):
        (self.assets / "cue.ogg").write_bytes(self.content)
        with patch.object(audio, "gate") as gate, patch.object(audio, "load_journal", return_value={"uploads": {}}), \
                patch.object(audio, "submit_and_moderate", return_value={"assetId": "42"}) as submit:
            self.assertEqual(audio.upload({"id": "cue"}, self.review, SECRET), {"assetId": "42"})
        gate.assert_called_once_with("audio/cue.ogg")
        self.assertEqual(submit.call_args.args[3:6], (self.content, self.digest, "cue.ogg"))

    def test_cue_ids_cannot_escape_assets_or_inject_multipart_headers(self):
        for name in ("../outside", "/tmp/outside", "a/b", "a\\b", 'cue"', "cue\r\nInjected", "cue.ogg", "", None):
            with self.subTest(name=name), patch.object(audio, "submit_and_moderate") as submit:
                with self.assertRaisesRegex(RuntimeError, "cue ID"):
                    audio.upload({"id": name}, self.review, SECRET)
                submit.assert_not_called()

    def test_outside_symlink_is_rejected(self):
        outside = self.base / "outside.ogg"
        outside.write_bytes(self.content)
        (self.assets / "cue.ogg").symlink_to(outside)
        with self.assertRaisesRegex(RuntimeError, "inside"):
            audio.read_audio("cue")

    def test_asset_directory_must_itself_be_inside_repo(self):
        outside = self.base / "outside"
        outside.mkdir()
        (outside / "cue.ogg").write_bytes(self.content)
        with patch.object(audio, "ASSETS", outside), self.assertRaisesRegex(RuntimeError, "inside"):
            audio.read_audio("cue")

    def test_target_extension_is_checked_after_symlink_resolution(self):
        (self.assets / "secret.txt").write_bytes(self.content)
        (self.assets / "cue.ogg").symlink_to(self.assets / "secret.txt")
        with self.assertRaisesRegex(RuntimeError, "inside"):
            audio.read_audio("cue")

    def test_missing_directory_fifo_invalid_and_oversize_files_rejected(self):
        path = self.assets / "cue.ogg"
        with self.assertRaisesRegex(RuntimeError, "Unable to read"):
            audio.read_audio("cue")
        path.mkdir()
        with self.assertRaises(RuntimeError):
            audio.read_audio("cue")
        path.rmdir()
        os.mkfifo(path)
        with self.assertRaisesRegex(RuntimeError, "regular file"):
            audio.read_audio("cue")
        path.unlink()
        for content in (b"", b"not an Ogg"):
            path.write_bytes(content)
            with self.assertRaises(RuntimeError):
                audio.read_audio("cue")
        with path.open("wb") as source:
            source.write(b"OggS")
            source.truncate(ru.MAX_AUDIO_BYTES)
        with self.assertRaisesRegex(RuntimeError, "below 20 MB"):
            audio.read_audio("cue")

    def test_changed_content_still_requires_matching_review(self):
        (self.assets / "cue.ogg").write_bytes(b"OggS-changed")
        with patch.object(audio, "submit_and_moderate") as submit:
            with self.assertRaisesRegex(RuntimeError, "matching non-vocal"):
                audio.upload({"id": "cue"}, self.review, SECRET)
        submit.assert_not_called()

    def test_entire_batch_validated_before_upload_or_key_read(self):
        (self.assets / "cue.ogg").write_bytes(self.content)
        (self.assets / "cues.json").write_text(json.dumps({"cues": [{"id": "cue"}, {"id": "../outside"}]}))
        (self.assets / "review.json").write_text(json.dumps(self.review))
        (self.assets / "provenance.json").write_text(json.dumps({"cue": {"subscriptionTierAtGeneration": "paid"}}))
        with patch.object(audio, "STATE", self.base / "state"), patch.object(audio, "HALT", self.base / "HALT"), \
                patch.object(sys, "argv", ["upload-audio.py", "--key-file", "/unused"]), \
                patch.object(audio._http, "read_key_file") as read_key, patch.object(audio, "upload") as upload:
            with self.assertRaisesRegex(RuntimeError, "permanently disabled"):
                audio.main()
        upload.assert_not_called()
        read_key.assert_not_called()

    def test_dry_run_never_reads_key_or_uploads(self):
        (self.assets / "cue.ogg").write_bytes(self.content)
        (self.assets / "cues.json").write_text(json.dumps({"cues": [{"id": "cue"}]}))
        (self.assets / "review.json").write_text(json.dumps(self.review))
        (self.assets / "provenance.json").write_text(json.dumps({"cue": {"subscriptionTierAtGeneration": "paid"}}))
        with patch.object(audio, "STATE", self.base / "state"), patch.object(audio, "HALT", self.base / "HALT"), \
                patch.object(sys, "argv", ["upload-audio.py", "--key-file", "/unused", "--dry-run"]), \
                patch.object(audio._http, "read_key_file") as read_key, patch.object(audio, "upload") as upload, \
                patch.object(audio, "gate"), contextlib.redirect_stdout(io.StringIO()) as output:
            audio.main()
        self.assertIn("Preflight passed for 1 effects", output.getvalue())
        upload.assert_not_called()
        read_key.assert_not_called()


class PollSecurityTests(NoNetworkTests):
    def setUp(self):
        super().setUp()
        location = patch.object(ru, "validate_upload_state")
        location.start()
        self.addCleanup(location.stop)
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.state = Path(temp.name)
        review = patch.object(ru, "require_model_review", return_value={})
        review.start()
        self.addCleanup(review.stop)
        for name, value in (("JOURNAL", self.state / "journal.json"), ("HALT", self.state / "HALT"), ("MODEL_HALT", self.state / "HALT-models")):
            patcher = patch.object(ru, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def submit(self, item=None, filename="cue.fbx"):
        if item is not None:
            item = {"assetType": "Model", "sha256": "d" * 64, **item}
        return ru.submit_and_moderate("cue", "model/cue.fbx", item, b"fbx", "d" * 64, filename,
                                     "desc", "human", SECRET, "Roblox rejected Model; model uploads are now halted", asset_type="Model")

    def test_shared_deadline_bounds_submission_operation_and_sleep(self):
        now = [100.0]
        deadlines = []

        def fake_http(method, url, key, body=None, content_type=None, *, deadline=None):
            deadlines.append(deadline)
            now[0] += 4
            return {"operationId": "op1"} if method == "POST" else {"done": False}

        with patch.object(ru, "POLL_TIMEOUT_SECONDS", 10), patch.object(ru, "http", side_effect=fake_http) as http, \
                patch.object(ru.time, "monotonic", side_effect=lambda: now[0]), \
                patch.object(ru.time, "sleep", side_effect=lambda seconds: now.__setitem__(0, now[0] + seconds)):
            with self.assertRaisesRegex(RuntimeError, "deadline"):
                self.submit()
        self.assertEqual(deadlines, [110, 110])
        self.assertEqual(http.call_count, 2)
        self.assertEqual(now[0], 110)
        self.assertEqual(ru.load_journal()["uploads"]["model/cue.fbx"]["state"], "UPLOADING")

    def test_moderation_uses_the_same_deadline(self):
        deadlines = []

        def fake_http(method, url, key, body=None, content_type=None, *, deadline=None):
            deadlines.append(deadline)
            return {"moderationResult": {"moderationState": "Approved"}}

        with patch.object(ru, "http", side_effect=fake_http), patch.object(ru.time, "monotonic", return_value=100), \
                contextlib.redirect_stdout(io.StringIO()):
            result = self.submit({"assetId": "42"})
        self.assertEqual(result["state"], ru.APPROVED)
        self.assertEqual(deadlines, [100 + ru.POLL_TIMEOUT_SECONDS])

    def test_operation_failure_never_echoes_remote_error(self):
        with patch.object(ru, "http", return_value={"done": True, "error": {"message": SECRET}}):
            with self.assertRaisesRegex(RuntimeError, "asset operation failed") as raised:
                self.submit({"operationId": "op1"})
        self.assert_private(raised.exception)

    def test_unsafe_operation_ids_rejected_before_status_request(self):
        for operation in ({"operationId": SECRET}, {"operationId": "../" + SECRET}, {"path": "https://elsewhere.invalid/" + SECRET}, {}):
            with self.subTest(operation=operation), patch.object(ru, "http", return_value=operation) as http:
                with self.assertRaisesRegex(RuntimeError, "invalid operation ID") as raised:
                    self.submit()
                self.assert_private(raised.exception)
                self.assertEqual(http.call_count, 1)
                self.assertEqual(ru.load_journal()["uploads"]["model/cue.fbx"]["state"], "SUBMITTING")

    def test_known_asset_path_response_is_supported(self):
        responses = [{"path": "operations/op1"}, {"done": True, "response": {"path": "assets/42"}},
                     {"moderationResult": {"moderationState": ru.APPROVED}}]
        with patch.object(ru, "http", side_effect=responses), contextlib.redirect_stdout(io.StringIO()):
            result = self.submit()
        self.assertEqual(result["assetId"], "42")

    def test_upload_timeout_and_transport_failures_stay_ambiguous(self):
        errors = [_http.HTTPFailure("safe", 408), _http.HTTPFailure("safe"), _http.HTTPFailure("safe", 503)]
        for error in errors:
            with self.subTest(status=error.status), patch.object(ru, "http", side_effect=error):
                with self.assertRaises(RuntimeError):
                    self.submit()
                self.assertEqual(ru.load_journal()["uploads"]["model/cue.fbx"]["state"], "SUBMITTING")

    def test_moderation_pending_and_remote_text_are_bounded_and_not_persisted(self):
        with patch.object(ru, "http", return_value={"moderationResult": {"moderationState": SECRET}}) as http, \
                patch.object(ru.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "moderation pending") as raised:
                self.submit({"assetId": "42"})
        self.assertEqual(http.call_count, 60)
        self.assert_private(raised.exception)
        self.assertNotIn(SECRET, ru.JOURNAL.read_text())
        self.assertFalse(ru.MODEL_HALT.exists())

    def test_prefixed_moderation_rejection_halts_account(self):
        with patch.object(ru, "http", return_value={"moderationResult": {"moderationState": ru.REJECTED}}):
            with self.assertRaisesRegex(RuntimeError, "rejected Model"):
                self.submit({"assetId": "42"})
        self.assertTrue(ru.MODEL_HALT.exists())
        self.assertEqual(ru.load_journal()["uploads"]["model/cue.fbx"]["state"], ru.REJECTED)

    def test_multipart_header_injection_fails_before_any_request_or_journal_write(self):
        with patch.object(ru, "http") as http:
            with self.assertRaisesRegex(RuntimeError, "filename"):
                self.submit(filename='cue.ogg"\r\nX-Injected: true')
        http.assert_not_called()
        self.assertFalse(ru.JOURNAL.exists())


if __name__ == "__main__":
    unittest.main()
