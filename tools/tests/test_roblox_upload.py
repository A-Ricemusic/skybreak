import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import roblox_upload as ru  # noqa: E402

APPROVED = "MODERATION_STATE_APPROVED"
REJECTED = "MODERATION_STATE_REJECTED"


class RobloxUploadJournalTests(unittest.TestCase):
    def setUp(self):
        location = patch.object(ru, "validate_upload_state")
        location.start()
        self.addCleanup(location.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.state = Path(self.temp.name)
        self.journal = self.state / "journal-3407487520.json"
        self.halt = self.state / "HALT-3407487520"
        for name, value in (("STATE", self.state), ("JOURNAL", self.journal), ("HALT", self.halt), ("AUDIO_HALT", self.state / "HALT-audio"), ("MODEL_HALT", self.state / "HALT-models")):
            patcher = patch.object(ru, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.addCleanup(self.temp.cleanup)
        review = patch.object(ru, "require_model_review", return_value={})
        review.start()
        self.addCleanup(review.stop)

    def write_journal(self, uploads):
        self.journal.write_text(json.dumps({"uploads": uploads}))

    def test_constants_match_account_journal(self):
        self.assertEqual(ru.APPROVED, APPROVED)
        self.assertEqual(ru.REJECTED, REJECTED)
        self.assertEqual(ru.API, "https://apis.roblox.com/assets/v1")

    def test_default_paths_are_shared_account_files(self):
        source = (Path(__file__).resolve().parents[1] / "roblox_upload.py").read_text()
        self.assertIn("pwd.getpwuid(os.getuid())", source)
        self.assertIn('STATE / "journal-3407487520.json"', source)
        self.assertIn('STATE / "HALT-3407487520"', source)

    def test_save_writes_pretty_json_atomically(self):
        path = self.state / "out.json"
        ru.save(path, {"a": 1})
        self.assertEqual(path.read_text(), '{\n  "a": 1\n}\n')
        self.assertFalse((self.state / "out.json.tmp").exists())
        ru.save(path, {"b": 2})
        self.assertEqual(json.loads(path.read_text()), {"b": 2})

    def test_load_journal_defaults_when_missing(self):
        self.assertEqual(ru.load_journal(), {"uploads": {}})
        self.write_journal({"audio/x.ogg": {"state": APPROVED}})
        self.assertEqual(ru.load_journal(), {"uploads": {"audio/x.ogg": {"state": APPROVED}}})

    def test_gate_passes_empty_or_all_approved(self):
        ru.gate(asset_type="Model")
        self.write_journal({"audio/a.ogg": {"state": APPROVED}, "voice/b-123.ogg": {"state": APPROVED}})
        ru.gate(asset_type="Model")
        ru.gate("audio/a.ogg", asset_type="Model")

    def test_legacy_and_audio_halts_only_block_audio(self):
        for halt in (ru.HALT, ru.AUDIO_HALT):
            halt.write_text("rejected")
            ru.gate(asset_type="Model")
            with self.assertRaisesRegex(RuntimeError, "Audio halted"):
                ru.gate()
            self.assertEqual(halt.read_text(), "rejected")

    def test_audio_hard_blocked_without_halts(self):
        with patch.object(ru, "http") as http:
            with self.assertRaisesRegex(RuntimeError, "permanently disabled"):
                ru.submit_and_moderate("cue", "audio/cue.ogg", None, b"OggS", "d" * 64,
                                       "cue.ogg", "desc", "rev", "key", "rejected")
            http.assert_not_called()
        self.assertFalse(self.journal.exists())

    def test_raw_http_audio_post_is_hard_blocked(self):
        body = (b'--test\r\nContent-Disposition: form-data; name="request"\r\n\r\n'
                b'{"assetType":"Audio"}\r\n--test\r\n'
                b'Content-Disposition: form-data; name="fileContent"; filename="cue.ogg"\r\n\r\nOggS\r\n--test--\r\n')
        with patch.object(ru._http, "request_json") as request:
            with self.assertRaisesRegex(RuntimeError, "permanently disabled"):
                ru.http("POST", ru.API + "/assets", "unused", body, "multipart/form-data; boundary=test")
            request.assert_not_called()

    def test_model_halt_blocks_all_model_classes(self):
        ru.MODEL_HALT.write_text("rejected")
        for kind in ("Model", "Mesh", "MeshPart", "Image", "Decal"):
            with self.assertRaisesRegex(RuntimeError, "Model uploads halted"):
                ru.gate(asset_type=kind)

    def test_gate_blocks_models_but_ignores_audio_journal(self):
        self.write_journal({"voice/b.ogg": {"state": REJECTED}})
        ru.gate(asset_type="Model")
        ru.record("model/x.fbx", {"state": "UPLOADING", "assetType": "Model"})
        with self.assertRaisesRegex(RuntimeError, "Unresolved account upload"):
            ru.gate(asset_type="Model")
        ru.gate("model/x.fbx", asset_type="Model")

    def test_record_merges_and_removes(self):
        self.write_journal({"voice/b-123.ogg": {"state": APPROVED}})
        ru.record("audio/a.ogg", {"state": "SUBMITTING"})
        self.assertEqual(ru.load_journal()["uploads"],
                         {"voice/b-123.ogg": {"state": APPROVED}, "audio/a.ogg": {"state": "SUBMITTING"}})
        ru.record("audio/a.ogg", None)
        self.assertEqual(ru.load_journal()["uploads"], {"voice/b-123.ogg": {"state": APPROVED}})
        ru.record("audio/missing.ogg", None)
        self.assertEqual(ru.load_journal()["uploads"], {"voice/b-123.ogg": {"state": APPROVED}})

    def test_record_creates_journal(self):
        ru.record("audio/a.ogg", {"state": APPROVED})
        self.assertEqual(json.loads(self.journal.read_text()), {"uploads": {"audio/a.ogg": {"state": APPROVED}}})

    def test_http_rejects_endpoints_outside_allowlist(self):
        with patch.object(ru._http, "open") as opener:
            for url in ("https://apis.roblox.com/universes/v1/places", "https://evil.example/assets/v1/assets"):
                with self.assertRaisesRegex(RuntimeError, "allowlist"):
                    ru.http("GET", url, "key")
            opener.assert_not_called()

    def test_http_uses_no_redirect_opener(self):
        response = io.BytesIO(b'{"ok": true}')
        with patch.object(ru._http, "open", return_value=contextlib.nullcontext(response)) as opener, \
                patch.object(ru.urllib.request, "urlopen") as urlopen:
            self.assertEqual(ru.http("GET", ru.API + "/operations/1", "secret"), {"ok": True})
        urlopen.assert_not_called()
        request = opener.call_args.args[0]
        self.assertEqual(request.full_url, ru.API + "/operations/1")
        self.assertEqual(request.get_header("X-api-key"), "secret")
        self.assertEqual(opener.call_args.kwargs, {"timeout": 90})

    def run_upload(self, responses, item=None):
        calls = []
        if item is not None:
            item = {"assetType": "Model", **item}

        def fake_http(method, url, key, body=None, content_type=None, *, deadline=None):
            calls.append((method, url))
            result = responses.pop(0)
            if isinstance(result, Exception):
                raise result
            return result

        with patch.object(ru, "http", fake_http), patch.object(ru.time, "sleep"), \
                contextlib.redirect_stdout(io.StringIO()):
            result = ru.submit_and_moderate("cue", "model/cue.fbx", item, b"fbx", "d" * 64, "cue.fbx",
                                            "desc", "rev", "key", "Roblox rejected Model; model uploads are now halted", asset_type="Model")
        return result, calls

    def test_submit_and_moderate_approved(self):
        result, calls = self.run_upload([{"operationId": "op1"}, {"done": True, "response": {"assetId": "42"}},
                                         {"moderationResult": {"moderationState": "Approved"}}])
        self.assertEqual(result["assetId"], "42")
        self.assertEqual(result["state"], APPROVED)
        self.assertEqual(ru.load_journal()["uploads"]["model/cue.fbx"]["state"], APPROVED)
        self.assertEqual(calls[0], ("POST", ru.API + "/assets"))
        self.assertFalse(self.halt.exists())

    def test_submit_and_moderate_rejection_writes_halt(self):
        with self.assertRaisesRegex(RuntimeError, "^Roblox rejected Model; model uploads are now halted$"):
            self.run_upload([{"moderationResult": {"moderationState": "Rejected"}}],
                            item={"sha256": "d" * 64, "assetId": "42", "state": "UPLOADING"})
        self.assertEqual(ru.MODEL_HALT.read_text(), "model/cue.fbx asset 42 rejected by moderation\n")
        self.assertEqual(ru.load_journal()["uploads"]["model/cue.fbx"]["state"], REJECTED)
        with self.assertRaisesRegex(RuntimeError, "Model uploads halted"):
            ru.gate(asset_type="Model")

    def test_submit_client_error_clears_journal_entry(self):
        error = urllib.error.HTTPError(ru.API + "/assets", 400, "bad", {}, io.BytesIO(b"nope"))
        with self.assertRaisesRegex(RuntimeError, "cue: Roblox upload HTTP 400"):
            self.run_upload([error])
        self.assertEqual(ru.load_journal()["uploads"], {})

    def test_submit_server_error_stays_ambiguous(self):
        error = urllib.error.HTTPError(ru.API + "/assets", 503, "busy", {}, io.BytesIO(b"later"))
        with self.assertRaisesRegex(RuntimeError, "HTTP 503"):
            self.run_upload([error])
        self.assertEqual(ru.load_journal()["uploads"]["model/cue.fbx"]["state"], "SUBMITTING")
        with self.assertRaisesRegex(RuntimeError, "Unresolved account upload model/cue.fbx: SUBMITTING"):
            ru.gate(asset_type="Model")

    def test_journaled_item_without_operation_is_ambiguous(self):
        with self.assertRaisesRegex(RuntimeError, "ambiguous"):
            self.run_upload([], item={"sha256": "d" * 64, "state": "SUBMITTING"})


if __name__ == "__main__":
    unittest.main()
