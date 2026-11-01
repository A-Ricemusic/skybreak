"""Offline regressions for ambiguous upload inputs and journal temp files."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
import roblox_upload as upload

spec = importlib.util.spec_from_file_location("audit_place_gate", TOOLS / "check-place-assets.py")
place_gate = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = place_gate
spec.loader.exec_module(place_gate)


class UploadGateAuditTests(unittest.TestCase):
    def test_duplicate_shared_blob_cannot_hide_first_uploaded_bytes(self):
        xml = b'''<roblox><SharedStrings>
        <SharedString md5="same">dW5yZXZpZXdlZA==</SharedString>
        <SharedString md5="same">cmV2aWV3ZWQ=</SharedString>
        </SharedStrings></roblox>'''
        with self.assertRaisesRegex(RuntimeError, "duplicate shared blob"):
            place_gate.inventory(xml)

    def test_ambiguous_metadata_never_reaches_transport(self):
        for metadata in (b'{"assetType":"Audio","assetType":"Model"}',
                         b'{"assetType":"Model","assetType":"Audio"}'):
            body = (b'--audit\r\nContent-Disposition: form-data; name="request"\r\n\r\n'
                    + metadata + b'\r\n--audit\r\n'
                    b'Content-Disposition: form-data; name="fileContent"; filename="jet.fbx"\r\n\r\n'
                    b'fake FBX\r\n--audit--\r\n')
            with patch.object(upload._http, "request_json") as transport:
                with self.assertRaisesRegex(RuntimeError, "duplicate JSON"):
                    upload.http("POST", upload.API + "/assets", "fake-audit-value", body,
                                "multipart/form-data; boundary=audit")
                transport.assert_not_called()

    def test_duplicate_mime_headers_never_reach_transport(self):
        body = (b'--audit\r\nContent-Disposition: form-data; name="request"\r\n'
                b'Content-Disposition: form-data; name="fileContent"\r\n\r\n'
                b'{"assetType":"Model"}\r\n--audit\r\n'
                b'Content-Disposition: form-data; name="fileContent"; filename="jet.fbx"\r\n\r\n'
                b'fake FBX\r\n--audit--\r\n')
        with patch.object(upload._http, "request_json") as transport:
            with self.assertRaisesRegex(RuntimeError, "Ambiguous"):
                upload.http("POST", upload.API + "/assets", "fake-audit-value", body,
                            "multipart/form-data; boundary=audit")
            transport.assert_not_called()

    def test_save_does_not_follow_predictable_temp_symlink(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            victim = root / "keep.txt"
            victim.write_text("keep")
            (root / "journal.json.tmp").symlink_to(victim)
            upload.save(root / "journal.json", {"uploads": {}})
            self.assertEqual(victim.read_text(), "keep")
            self.assertEqual(json.loads((root / "journal.json").read_text()), {"uploads": {}})
            self.assertEqual((root / "journal.json").stat().st_mode & 0o777, 0o600)

    def test_fetch_explicitly_refreshes_main_even_with_narrow_remote_refspec(self):
        spec = importlib.util.spec_from_file_location("audit_models", TOOLS / "upload-models.py")
        models = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(models)
        with patch.object(models.subprocess, "run") as run:
            models.fetch_origin()
        self.assertEqual(run.call_args.args[0],
                         ["git", "fetch", "origin", "+refs/heads/main:refs/remotes/origin/main"])
