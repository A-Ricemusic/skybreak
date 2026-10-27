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
        self.temp = tempfile.TemporaryDirectory()
        self.state = Path(self.temp.name)
        self.journal = self.state / "journal-3407487520.json"
        self.halt = self.state / "HALT-3407487520"
        for name, value in (("STATE", self.state), ("JOURNAL", self.journal), ("HALT", self.halt)):
            patcher = patch.object(ru, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.addCleanup(self.temp.cleanup)

    def write_journal(self, uploads):
        self.journal.write_text(json.dumps({"uploads": uploads}))

    def test_constants_match_account_journal(self):
        self.assertEqual(ru.APPROVED, APPROVED)
        self.assertEqual(ru.REJECTED, REJECTED)
        self.assertEqual(ru.API, "https://apis.roblox.com/assets/v1")

    def test_default_paths_are_shared_account_files(self):
        source = (Path(__file__).resolve().parents[1] / "roblox_upload.py").read_text()
        self.assertIn('Path.home() / ".skybreak-roblox-uploads"', source)
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
        ru.gate()
        self.write_journal({"audio/a.ogg": {"state": APPROVED}, "voice/b-123.ogg": {"state": APPROVED}})
        ru.gate()
        ru.gate("audio/a.ogg")

    def test_gate_halt_file_blocks_everything(self):
        self.halt.write_text("rejected\n")
        with self.assertRaisesRegex(RuntimeError, "^Account halted by Roblox moderation; no uploads are permitted$"):
            ru.gate()
        with self.assertRaisesRegex(RuntimeError, "Account halted"):
            ru.gate("audio/a.ogg")

    def test_gate_blocks_other_unresolved_uploads(self):
        self.write_journal({"audio/a.ogg": {"state": APPROVED}, "voice/b-123.ogg": {"state": "UPLOADING"}})
        with self.assertRaisesRegex(RuntimeError, r"^Unresolved account upload voice/b-123\.ogg: UPLOADING$"):
            ru.gate()
        with self.assertRaisesRegex(RuntimeError, "Unresolved account upload voice/b-123.ogg"):
            ru.gate("audio/a.ogg")
        ru.gate("voice/b-123.ogg")

    def test_gate_treats_missing_state_as_unresolved(self):
        self.write_journal({"audio/a.ogg": {}})
        with self.assertRaisesRegex(RuntimeError, r"^Unresolved account upload audio/a\.ogg: None$"):
            ru.gate()

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

        def fake_http(method, url, key, body=None, content_type=None, *, deadline=None):
            calls.append((method, url))
            result = responses.pop(0)
            if isinstance(result, Exception):
                raise result
            return result

        with patch.object(ru, "http", fake_http), patch.object(ru.time, "sleep"), \
                contextlib.redirect_stdout(io.StringIO()):
            result = ru.submit_and_moderate("cue", "audio/cue.ogg", item, b"OggS", "d" * 64, "cue.ogg",
                                            "desc", "rev", "key", "Roblox rejected audio; account uploads are now halted")
        return result, calls

    def test_submit_and_moderate_approved(self):
        result, calls = self.run_upload([{"operationId": "op1"}, {"done": True, "response": {"assetId": "42"}},
                                         {"moderationResult": {"moderationState": "Approved"}}])
        self.assertEqual(result["assetId"], "42")
        self.assertEqual(result["state"], APPROVED)
        self.assertEqual(ru.load_journal()["uploads"]["audio/cue.ogg"]["state"], APPROVED)
        self.assertEqual(calls[0], ("POST", ru.API + "/assets"))
        self.assertFalse(self.halt.exists())

    def test_submit_and_moderate_rejection_writes_halt(self):
        with self.assertRaisesRegex(RuntimeError, "^Roblox rejected audio; account uploads are now halted$"):
            self.run_upload([{"moderationResult": {"moderationState": "Rejected"}}],
                            item={"sha256": "d" * 64, "assetId": "42", "state": "UPLOADING"})
        self.assertEqual(self.halt.read_text(), "audio/cue.ogg asset 42 rejected by moderation\n")
        self.assertEqual(ru.load_journal()["uploads"]["audio/cue.ogg"]["state"], REJECTED)
        with self.assertRaisesRegex(RuntimeError, "Account halted"):
            ru.gate()

    def test_submit_client_error_clears_journal_entry(self):
        error = urllib.error.HTTPError(ru.API + "/assets", 400, "bad", {}, io.BytesIO(b"nope"))
        with self.assertRaisesRegex(RuntimeError, "cue: Roblox upload HTTP 400"):
            self.run_upload([error])
        self.assertEqual(ru.load_journal()["uploads"], {})

    def test_submit_server_error_stays_ambiguous(self):
        error = urllib.error.HTTPError(ru.API + "/assets", 503, "busy", {}, io.BytesIO(b"later"))
        with self.assertRaisesRegex(RuntimeError, "HTTP 503"):
            self.run_upload([error])
        self.assertEqual(ru.load_journal()["uploads"]["audio/cue.ogg"]["state"], "SUBMITTING")
        with self.assertRaisesRegex(RuntimeError, "Unresolved account upload audio/cue.ogg: SUBMITTING"):
            ru.gate()

    def test_journaled_item_without_operation_is_ambiguous(self):
        with self.assertRaisesRegex(RuntimeError, "ambiguous"):
            self.run_upload([], item={"sha256": "d" * 64, "state": "SUBMITTING"})


if __name__ == "__main__":
    unittest.main()
