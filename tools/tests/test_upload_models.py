"""All upload tests use isolated state and fake HTTP; never contact Roblox."""
import contextlib
import fcntl
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import roblox_upload as ru

REAL_HTTP = ru.http

spec = importlib.util.spec_from_file_location("upload_models", Path(__file__).resolve().parents[1] / "upload-models.py")
models = importlib.util.module_from_spec(spec)
spec.loader.exec_module(models)


class UploadModelsTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.state = self.root / "state"
        self.state.mkdir()
        for obj, name, value in ((models, "ROOT", self.root), (ru, "ROOT", self.root), (ru, "STATE", self.state),
                                  (ru, "JOURNAL", self.state / "journal-3407487520.json"),
                                  (ru, "HALT", self.state / "HALT-3407487520"),
                                  (ru, "MODEL_HALT", self.state / "HALT-models"),
                                  (ru, "AUDIO_HALT", self.state / "HALT-audio")):
            patcher = patch.object(obj, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        for obj, name in ((ru, "http"), (ru._http, "open"), (ru._http, "read_key_file")):
            patcher = patch.object(obj, name, side_effect=AssertionError("Unexpected network or key read"))
            patcher.start()
            self.addCleanup(patcher.stop)
        self.folder = self.root / "assets/roblox-upload/jet"
        self.folder.mkdir(parents=True)
        self.content = b"Kaydara FBX Binary  \x00test embedded textures"
        (self.folder / "jet.fbx").write_bytes(self.content)
        self.approval_path = self.root / "docs/qa/asset-reviews/approvals/jet.json"
        self.approval_path.parent.mkdir(parents=True)
        self.checklist = {"exportVersion": "jet-2", "checks": {k: {"value": True} for k in models.REQUIRED_CHECKS}}
        self.approval = {"approved": True, "reviewer": "independent reviewer", "uploadAssetType": "Model",
                         "score": "10/10", "record": "docs/qa/asset-reviews/review.md",
                         "uploadSet": {"jet.fbx": hashlib.sha256(self.content).hexdigest()}, "exportVersion": "jet-2"}
        self.write_checklist()
        self.record_path = self.root / "docs/qa/asset-reviews/review.md"
        self.record_path.write_text("Independent review. Score 10/10. VERDICT: APPROVE")
        self.git("init", "-q")
        self.git("add", "docs")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "review")

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, check=True, capture_output=True)

    def write_approval(self):
        self.approval_path.write_text(json.dumps(self.approval))

    def write_checklist(self):
        data = json.dumps(self.checklist).encode()
        (self.folder / "checklist.json").write_bytes(data)
        self.approval["checklistSha256"] = hashlib.sha256(data).hexdigest()
        self.write_approval()

    def commit_evidence(self):
        self.git("add", "docs")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "updated review")

    def test_uncommitted_approval_refused(self):
        self.approval["note"] = "uncommitted"
        self.write_approval()
        self.refuse("differs from committed")

    def test_missing_committed_record_refused(self):
        self.git("rm", "--cached", "docs/qa/asset-reviews/review.md")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "remove review")
        self.refuse("Missing committed")

    def test_texture_hash_mismatch_refused(self):
        texture = self.folder / "jet-color.png"
        texture.write_bytes(b"reviewed texture")
        self.approval["embeddedTextures"] = {texture.name: hashlib.sha256(texture.read_bytes()).hexdigest()}
        self.write_approval()
        self.commit_evidence()
        texture.write_bytes(b"changed texture")
        self.refuse("texture SHA-256")

    def test_direct_shared_helper_cannot_skip_review(self):
        content = b"unreviewed FBX"
        with self.assertRaisesRegex(RuntimeError, "matching committed"):
            ru.submit_and_moderate("jet", "jet/jet.fbx", None, content,
                                   hashlib.sha256(content).hexdigest(), "jet.fbx", "desc",
                                   "independent reviewer", "fake-test-token", "rejected", asset_type="Model")
        self.assertFalse(ru.JOURNAL.exists())

    def test_committed_record_hash_cannot_be_replaced_in_working_tree(self):
        content = b"changed FBX"
        (self.folder / "jet.fbx").write_bytes(content)
        self.approval["uploadSet"]["jet.fbx"] = hashlib.sha256(content).hexdigest()
        self.write_approval()
        self.refuse("matching committed")

    def test_nonperfect_or_rejected_review_refused(self):
        self.approval["score"] = "9/10"
        self.write_approval()
        self.commit_evidence()
        self.refuse("10/10 APPROVE")
        self.approval["score"] = "10/10"
        self.write_approval()
        self.record_path.write_text("10/10 VERDICT: REJECT")
        self.commit_evidence()
        self.refuse("VERDICT: APPROVE")

    def test_legacy_audio_halt_and_rejection_allow_reviewed_model(self):
        ru.HALT.write_text("voice rejected")
        ru.record("voice/old.ogg", {"state": ru.REJECTED})
        self.assertIn("jet.fbx", self.dry())
        self.assertEqual(ru.HALT.read_text(), "voice rejected")

    def dry(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            models.main(["jet", "--dry-run"])
        return output.getvalue()

    def refuse(self, message):
        with self.assertRaisesRegex(RuntimeError, message):
            self.dry()

    def test_missing_approval(self):
        self.approval_path.unlink()
        self.refuse("missing or unreadable")

    def test_not_approved(self):
        self.approval["approved"] = False
        self.write_approval()
        self.refuse("approved: true")

    def test_reviewer_required(self):
        for value in (None, "", "  ", True):
            with self.subTest(value=value):
                self.approval["reviewer"] = value
                self.write_approval()
                self.refuse("nonempty reviewer")

    def test_wrong_asset_type(self):
        self.approval["uploadAssetType"] = "Image"
        self.write_approval()
        self.refuse("must be Model")

    def test_extra_upload_set_entry(self):
        self.approval["uploadSet"]["preview.png"] = "a" * 64
        self.write_approval()
        self.refuse("exactly jet.fbx")

    def test_missing_or_wrong_upload_set(self):
        for value in (None, {}, [], {"other.fbx": "a" * 64}):
            self.approval["uploadSet"] = value
            self.write_approval()
            self.refuse("exactly jet.fbx")

    def test_fbx_hash_mismatch(self):
        (self.folder / "jet.fbx").write_bytes(b"edited")
        self.refuse("FBX SHA-256")

    def test_checklist_hash_mismatch(self):
        (self.folder / "checklist.json").write_text("{}")
        self.refuse("checklist SHA-256")

    def test_export_version_mismatch(self):
        self.checklist["exportVersion"] = "jet-3"
        self.write_checklist()
        self.commit_evidence()
        self.refuse("exportVersion")

    def test_missing_export_version(self):
        del self.approval["exportVersion"]
        del self.checklist["exportVersion"]
        self.write_checklist()
        self.commit_evidence()
        self.refuse("exportVersion")

    def test_false_check(self):
        self.checklist["checks"]["noText"]["value"] = False
        self.write_checklist()
        self.commit_evidence()
        self.refuse("value: true")

    def test_empty_missing_flat_and_additional_false_checks(self):
        for checks in ({}, None, {k: True for k in models.REQUIRED_CHECKS},
                       {**self.checklist["checks"], "extra": {"value": False}}):
            self.checklist["checks"] = checks
            self.write_checklist()
            self.commit_evidence()
        self.refuse("value: true")

    def test_halt(self):
        ru.MODEL_HALT.write_text("halted")
        self.refuse("Model uploads halted")

    def test_unresolved_journal(self):
        ru.record("model/earlier.fbx", {"state": "UNKNOWN", "assetType": "Model"})
        self.refuse("Unresolved account upload")

    def test_dry_run_no_network_or_key_or_journal_write(self):
        output = json.loads(self.dry())
        self.assertEqual(output, {"asset": "jet", "file": "assets/roblox-upload/jet/jet.fbx",
                                  "size": len(self.content), "sha256": self.approval["uploadSet"]["jet.fbx"],
                                  "reviewer": "independent reviewer", "journalKey": "jet/jet.fbx"})
        self.assertFalse(ru.JOURNAL.exists())
        self.assertFalse((self.root / "src").exists())

    def test_lock_shared_with_other_upload_tools(self):
        with (self.state / "audio-upload.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.refuse("state lock")

    def test_invalid_names_and_outside_symlink(self):
        for name in ("../jet", 'jet"', "jet.fbx"):
            with self.assertRaisesRegex(RuntimeError, "Invalid asset name"):
                models.prepare(name)
        (self.folder / "jet.fbx").unlink()
        (self.folder / "jet.fbx").symlink_to("/etc/hosts")
        self.refuse("inside the repository")

    def test_fbx_size_limit(self):
        with patch.object(ru, "MAX_MODEL_BYTES", len(self.content)):
            self.refuse("regular file below")

    def test_batch_preflight_before_key_or_network(self):
        with self.assertRaisesRegex(RuntimeError, "missing or unreadable"):
            models.main(["--key-file", "unused-fake-path", "jet", "missing"])

    def fake_upload(self, responses):
        with patch.object(ru, "http", side_effect=responses) as http, contextlib.redirect_stdout(io.StringIO()):
            result = models.upload(models.prepare("jet"), "fake-test-token")
        return result, http

    def test_reviewed_model_passes_real_transport_validation_with_fake_network(self):
        responses = [{"operationId": "op1"}, {"done": True, "response": {"assetId": "42"}},
                     {"moderationResult": {"moderationState": "Approved"}}]
        with patch.object(ru, "http", wraps=REAL_HTTP), \
                patch.object(ru._http, "request_json", side_effect=responses) as request, \
                contextlib.redirect_stdout(io.StringIO()):
            result = models.upload(models.prepare("jet"), "fake-test-token")
        self.assertEqual(result["state"], ru.APPROVED)
        self.assertEqual(request.call_count, 3)

    def test_success_journals_id_and_only_fbx_multipart(self):
        result, http = self.fake_upload([{"operationId": "op1"}, {"done": True, "response": {"assetId": "42"}},
                                          {"moderationResult": {"moderationState": "Approved"}}])
        self.assertEqual(result["assetId"], "42")
        self.assertEqual(result["state"], ru.APPROVED)
        self.assertEqual(result["assetType"], "Model")
        self.assertEqual(result["reviewer"], "independent reviewer")
        self.assertEqual(result["operationId"], "op1")
        self.assertEqual(result["sha256"], self.approval["uploadSet"]["jet.fbx"])
        self.assertEqual(ru.load_journal()["uploads"]["jet/jet.fbx"], result)
        body = http.call_args_list[0].args[3]
        self.assertIn(b'"assetType": "Model"', body)
        self.assertIn(b'filename="jet.fbx"', body)
        self.assertIn(b'Content-Type: model/fbx', body)
        self.assertIn(self.content, body)
        self.assertEqual(body.count(b'name="fileContent"'), 1)
        self.assertNotIn(b'.png', body)
        self.assertNotIn(b'checklist.json', body)
        self.assertFalse((self.root / "src").exists())

    def journal_item(self, **values):
        item = {"sha256": self.approval["uploadSet"]["jet.fbx"], "assetType": "Model",
                "reviewer": "independent reviewer", "state": "UPLOADING", **values}
        ru.record("jet/jet.fbx", item)

    def test_resume_operation_never_posts(self):
        self.journal_item(operationId="op1")
        result, http = self.fake_upload([{"done": True, "response": {"assetId": "42"}},
                                          {"moderationResult": {"moderationState": "Approved"}}])
        self.assertEqual(result["assetId"], "42")
        self.assertTrue(all(c.args[0] == "GET" for c in http.call_args_list))

    def test_resume_asset_rechecks_moderation(self):
        self.journal_item(assetId="42", state=ru.APPROVED)
        _, http = self.fake_upload([{"moderationResult": {"moderationState": "Approved"}}])
        self.assertEqual(http.call_count, 1)
        self.assertIn("moderationResult", http.call_args.args[1])

    def test_rejected_writes_halt_and_blocks_next_asset(self):
        self.journal_item(assetId="42")
        with self.assertRaisesRegex(RuntimeError, "rejected Model"):
            self.fake_upload([{"moderationResult": {"moderationState": "Rejected"}}])
        self.assertTrue(ru.MODEL_HALT.exists())
        self.assertEqual(ru.load_journal()["uploads"]["jet/jet.fbx"]["state"], ru.REJECTED)
        with self.assertRaisesRegex(RuntimeError, "Model uploads halted"):
            ru.gate("jet/jet.fbx", asset_type="Model")

    def test_unknown_moderation_stops_without_resubmitting(self):
        self.journal_item(assetId="42")
        with patch.object(ru, "http", return_value={}) as http, patch.object(ru.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "moderation pending"):
                models.upload(models.prepare("jet"), "fake-test-token")
        self.assertTrue(all(c.args[0] == "GET" for c in http.call_args_list))
        self.assertEqual(ru.load_journal()["uploads"]["jet/jet.fbx"]["state"], "UNKNOWN")

    def test_ambiguous_submission_and_stale_journal_refused(self):
        self.journal_item()
        with self.assertRaisesRegex(RuntimeError, "ambiguous"):
            models.prepare("jet")
        self.journal_item(assetId="42", sha256="bad")
        with self.assertRaisesRegex(RuntimeError, "journal hash/type"):
            models.prepare("jet")

    def test_shared_model_validation_precedes_http(self):
        for filename, content, kind in (("jet.ogg", b"fbx", "Model"), ('jet.fbx"\r\nX: true', b"fbx", "Model"),
                                        ("jet.fbx", b"", "Model"), ("jet.fbx", b"fbx", "Image")):
            with self.assertRaises(RuntimeError):
                ru.submit_and_moderate("jet", "jet/jet.fbx", None, content, "hash", filename,
                                       "description", "reviewer", "fake-test-token", "rejected", asset_type=kind)
        self.assertFalse(ru.JOURNAL.exists())

    def test_cli_success_with_fake_key_reader_and_http(self):
        responses = [{"operationId": "op1"}, {"done": True, "response": {"assetId": "42"}},
                     {"moderationResult": {"moderationState": "Approved"}}]
        with patch.object(models._http, "read_key_file", return_value="fake-test-token") as read_key, \
                patch.object(ru, "http", side_effect=responses), contextlib.redirect_stdout(io.StringIO()) as output:
            models.main(["--key-file", "unused-fake-path", "jet"])
        read_key.assert_called_once_with(Path("unused-fake-path"))
        self.assertIn("approved asset 42", output.getvalue())
        self.assertEqual(ru.load_journal()["uploads"]["jet/jet.fbx"]["assetId"], "42")

    def test_cli_resume_allows_only_own_unresolved_entry(self):
        self.journal_item(operationId="op1")
        responses = [{"done": True, "response": {"assetId": "42"}},
                     {"moderationResult": {"moderationState": "Approved"}}]
        with patch.object(models._http, "read_key_file", return_value="fake-test-token"), \
                patch.object(ru, "http", side_effect=responses) as http, contextlib.redirect_stdout(io.StringIO()):
            models.main(["--key-file", "unused-fake-path", "jet"])
        self.assertTrue(all(c.args[0] == "GET" for c in http.call_args_list))

    def test_dry_run_refuses_own_unresolved_entry(self):
        self.journal_item(operationId="op1")
        self.refuse("Unresolved account upload")


if __name__ == "__main__":
    unittest.main()
