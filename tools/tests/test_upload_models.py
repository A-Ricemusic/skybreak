"""All upload tests use isolated state and fake HTTP; never contact Roblox."""
import contextlib
import fcntl
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import urllib.error
import shutil
from unittest.mock import patch
from types import SimpleNamespace

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
        self.state = self.root / ".skybreak-roblox-uploads"
        self.state.mkdir()
        account = SimpleNamespace(**{"pw_dir": str(self.root)})
        home = patch.object(ru.pwd, "getpwuid", return_value=account)
        home.start()
        self.addCleanup(home.stop)
        env = patch.dict(os.environ, {"HOME": str(self.root)})
        env.start()
        self.addCleanup(env.stop)
        for obj, name, value in ((models, "ROOT", self.root), (ru, "ROOT", self.root), (ru, "STATE", self.state),
                                  (ru, "JOURNAL", self.state / "journal-3407487520.json"),
                                  (ru, "HALT", self.state / "HALT-3407487520"),
                                  (ru, "MODEL_HALT", self.state / "HALT-models-3407487520"),
                                  (ru, "AUDIO_HALT", self.state / "HALT-audio-3407487520")):
            patcher = patch.object(obj, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        for obj, name in ((models, "fetch_origin"), (ru, "http"), (ru._http, "open"), (ru._http, "read_key_file")):
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
        self.manifest_path = self.folder / "export-manifest.json"
        self.decision_path = self.root / "docs/qa/asset-reviews/decisions/jet.json"
        self.decision_path.parent.mkdir()
        self.manifest = dict(asset="jet", creator="build agent", exportVersion="jet-2", files=self.approval["uploadSet"])
        self.decision = dict(self.manifest, reviewer="independent reviewer", score=10, verdict="APPROVE",
                             reviewDate="2026-10-31", policyLinks=["https://www.roblox.com/termsofuse",
                             "https://en.help.roblox.com/hc/en-us/articles/203313410-Roblox-Community-Standards/"],
                             sourceReview="docs/qa/asset-reviews/review.md")
        self.manifest_path.write_text(json.dumps(self.manifest))
        self.decision_path.write_text(json.dumps(self.decision))
        self.git("init", "-q")
        self.git("add", "docs", "assets")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "review")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")

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
        self.git("add", "docs", "assets")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "updated review")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")

    def test_uncommitted_approval_refused(self):
        self.approval["note"] = "uncommitted"
        self.write_approval()
        self.refuse("differs from committed")

    def test_missing_committed_record_refused(self):
        self.git("rm", "--cached", "docs/qa/asset-reviews/review.md")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "remove review")
        self.git("update-ref", "refs/remotes/origin/main", "HEAD")
        self.refuse("Missing committed")

    def test_texture_hash_mismatch_refused(self):
        texture = self.folder / "jet-color.png"
        texture.write_bytes(b"reviewed texture")
        self.approval["embeddedTextures"] = {texture.name: hashlib.sha256(texture.read_bytes()).hexdigest()}
        self.write_approval()
        self.commit_evidence()
        texture.write_bytes(b"changed texture")
        self.refuse("manifest")

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
        self.refuse("differs from committed")

    def test_nonperfect_or_rejected_review_refused(self):
        for score, verdict in ((9, "APPROVE"), (10, "REJECT")):
            self.decision.update(score=score, verdict=verdict)
            self.decision_path.write_text(json.dumps(self.decision))
            self.commit_evidence()
            self.refuse("10/10 APPROVE")

    def test_home_override_refused_before_fetch_state_key_or_upload(self):
        ru.MODEL_HALT.write_text("canonical halt")
        alternate = self.root / "alternate-home"
        with patch.dict(os.environ, {"HOME": str(alternate)}), \
                patch.object(models, "fetch_origin") as fetch, patch.object(models, "prepare") as prepare:
            self.assertEqual(ru.canonical_state(), self.state)
            with self.assertRaisesRegex(RuntimeError, "account home"):
                models.main(["jet", "--key-file", "unused"])
            with self.assertRaisesRegex(RuntimeError, "account home"):
                ru.validate_upload_state()
        fetch.assert_not_called()
        prepare.assert_not_called()
        self.assertFalse(alternate.exists())
        self.assertEqual(ru.MODEL_HALT.read_text(), "canonical halt")

    def test_path_home_mismatch_refused_even_with_matching_home_environment(self):
        with patch.object(Path, "home", return_value=self.root / "other"), \
                self.assertRaisesRegex(RuntimeError, "account home"):
            ru.validate_state_location()

    def test_symlinked_canonical_state_refused_before_access(self):
        self.state.rmdir()
        alternate = self.root / "redirected-state"
        for exists in (False, True):
            if exists:
                alternate.mkdir()
            self.state.symlink_to(alternate, target_is_directory=True)
            with patch.object(models, "fetch_origin") as fetch, \
                    self.assertRaisesRegex(RuntimeError, "symlink"):
                models.main(["jet", "--key-file", "unused"])
            fetch.assert_not_called()
            with self.assertRaisesRegex(RuntimeError, "symlink"):
                ru.validate_upload_state()
            self.state.unlink()
        self.assertEqual(list(alternate.iterdir()), [])

    def add_reviewed_texture(self):
        texture = b"reviewed embedded texture"
        (self.folder / "jet-color.png").write_bytes(texture)
        self.approval["embeddedTextures"] = {"jet-color.png": hashlib.sha256(texture).hexdigest()}
        self.write_approval()
        self.manifest["files"] = {**self.approval["uploadSet"], **self.approval["embeddedTextures"]}
        self.decision["files"] = self.manifest["files"]
        self.manifest_path.write_text(json.dumps(self.manifest))
        self.decision_path.write_text(json.dumps(self.decision))
        self.commit_evidence()

    def test_texture_only_negative_decision_blocks_even_another_asset(self):
        self.add_reviewed_texture()
        self.dry()  # Full-set approval is valid before any rejection.
        for verdict, score in (("REJECT", 10), ("APPROVE", 9)):
            reject = {**self.decision, "asset": "other", "exportVersion": "other-1",
                      "files": self.approval["embeddedTextures"], "verdict": verdict, "score": score}
            self.decision_path.with_name("negative.json").write_text(json.dumps(reject))
            self.commit_evidence()
            self.refuse("REJECT/lesser score")

    def test_same_asset_version_reject_blocks_different_hashes(self):
        reject = {**self.decision, "files": {"other.fbx": "0" * 64}, "verdict": "REJECT"}
        self.decision_path.with_name("negative.json").write_text(json.dumps(reject))
        self.commit_evidence()
        self.refuse("REJECT/lesser score")

    def test_full_approve_then_later_texture_subset_reject_blocks(self):
        self.add_reviewed_texture()
        self.dry()
        reject = {**self.decision, "files": self.approval["embeddedTextures"],
                  "verdict": "REJECT", "reviewDate": "2026-11-01"}
        # Sort after the approval as well as having a later date.
        self.decision_path.with_name("zz-later-rejection.json").write_text(json.dumps(reject))
        self.commit_evidence()
        self.refuse("REJECT/lesser score")

    def test_state_dir_cannot_redirect_real_upload(self):
        alternate = self.root / "alternate"
        with patch.object(models, "prepare") as prepare, patch.object(models, "fetch_origin") as fetch:
            with self.assertRaisesRegex(RuntimeError, "only with --dry-run"):
                models.main(["jet", "--state-dir", str(alternate), "--key-file", "unused"])
        prepare.assert_not_called()
        fetch.assert_not_called()
        self.assertFalse(alternate.exists())

    def test_real_run_reinstates_canonical_halt_after_poisoned_globals(self):
        ru.MODEL_HALT.write_text("canonical halt")
        alternate = self.root / "alternate"
        with patch.object(ru, "STATE", alternate), patch.object(ru, "MODEL_HALT", alternate / "HALT"), \
                patch.object(models, "fetch_origin"):
            with self.assertRaisesRegex(RuntimeError, "Model uploads halted"):
                models.main(["jet", "--key-file", "unused"])
        self.assertFalse(alternate.exists())

    def test_dry_state_override_is_restored_and_never_sends(self):
        alternate = self.root / "alternate"
        with contextlib.redirect_stdout(io.StringIO()):
            models.main(["jet", "--dry-run", "--state-dir", str(alternate)])
        self.assertEqual(ru.STATE, self.state)
        self.assertEqual(ru.MODEL_HALT, self.state / "HALT-models-3407487520")
        self.assertFalse((alternate / "journal-3407487520.json").exists())

    def test_wrong_hash_in_final_decision_refused(self):
        self.decision["files"] = {"jet.fbx": "0" * 64}
        self.decision_path.write_text(json.dumps(self.decision))
        self.commit_evidence()
        self.refuse("Missing or ambiguous")

    def test_earlier_approve_later_reject_blocks_same_hash(self):
        reject = {**self.decision, "verdict": "REJECT", "reviewDate": "2026-11-01"}
        self.decision_path.with_name("jet-rejection.json").write_text(json.dumps(reject))
        self.commit_evidence()
        self.refuse("REJECT/lesser score")

    def test_multiple_even_positive_final_decisions_are_ambiguous(self):
        self.decision_path.with_name("jet-second.json").write_text(json.dumps(self.decision))
        self.commit_evidence()
        self.refuse("ambiguous")

    def test_creator_and_creator_markers_cannot_review(self):
        for identity in ("build agent", "BUILD AGENT", "independent creator", "self review", "implementation agent"):
            self.decision["reviewer"] = identity
            self.decision_path.write_text(json.dumps(self.decision))
            self.commit_evidence()
            self.refuse("non-independent")

    def test_local_only_commit_is_not_merged_evidence(self):
        self.decision["note"] = "only HEAD"
        self.decision_path.write_text(json.dumps(self.decision))
        self.git("add", "docs")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "local only")
        self.refuse("differs from committed origin/main")

    def test_uncommitted_or_local_only_extra_decision_refused(self):
        self.decision_path.with_name("jet-uncommitted.json").write_text(json.dumps(self.decision))
        self.refuse("local-only")

    def test_local_source_review_or_manifest_edits_refused(self):
        for path in (self.record_path, self.manifest_path):
            original = path.read_bytes()
            path.write_bytes(original + b" ")
            self.refuse("differs from committed")
            path.write_bytes(original)

    def test_duplicate_decision_fields_refused(self):
        self.decision_path.write_text(self.decision_path.read_text()[:-1] + ', "verdict":"REJECT"}')
        self.commit_evidence()
        self.refuse("duplicate JSON")

    def test_halt_created_between_post_and_poll_retries(self):
        # Exercise real multipart checks, real retry loop, and fake transport only.
        for stage in ("POST", "GET"):
            ru.MODEL_HALT.unlink(missing_ok=True)
            ru.JOURNAL.unlink(missing_ok=True)
            calls = []
            def transport(request, timeout):
                calls.append(request.get_method())
                if stage == "GET" and len(calls) == 1:
                    return io.BytesIO(b'{"operationId":"op1"}')
                raise urllib.error.HTTPError(request.full_url, 429, "busy", {}, io.BytesIO())
            with patch.object(ru, "http", wraps=REAL_HTTP), patch.object(ru._http, "open", side_effect=transport), \
                    patch.object(ru._http.time, "sleep", side_effect=lambda _: ru.MODEL_HALT.write_text("new HALT")):
                with self.assertRaisesRegex(RuntimeError, "Model uploads halted"):
                    models.upload(models.prepare("jet"), "fake-test-token")
            self.assertEqual(calls, ["POST"] if stage == "POST" else ["POST", "GET"])

    def test_existing_markdown_table_reviews_pass_after_merge(self):
        repository = Path(__file__).resolve().parents[2]
        for asset in ("heavy-transport", "cinematic-field-recorder"):
            approval_path = Path("docs/qa/asset-reviews/approvals") / (asset + ".json")
            approval = json.loads((repository / approval_path).read_text())
            decision_path = Path("docs/qa/asset-reviews/decisions") / (asset + ".json")
            manifest_path = Path("assets/roblox-upload") / asset / "export-manifest.json"
            manifest = json.loads((repository / manifest_path).read_text())
            paths = [approval_path, decision_path, manifest_path, Path(approval["record"])]
            paths += [manifest_path.parent / name for name in manifest["files"]]
            for path in paths:
                target = self.root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(repository / path, target)
            self.commit_evidence()
            content = (self.root / manifest_path.parent / (asset + ".fbx")).read_bytes()
            self.assertEqual(ru.require_model_review(asset + ".fbx", content,
                             hashlib.sha256(content).hexdigest()), approval)


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
        with patch.object(models, "fetch_origin"), self.assertRaisesRegex(RuntimeError, "missing or unreadable"):
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
        with patch.object(models, "fetch_origin"), patch.object(models._http, "read_key_file", return_value="fake-test-token") as read_key, \
                patch.object(ru, "http", side_effect=responses), contextlib.redirect_stdout(io.StringIO()) as output:
            models.main(["--key-file", "unused-fake-path", "jet"])
        read_key.assert_called_once_with(Path("unused-fake-path"))
        self.assertIn("approved asset 42", output.getvalue())
        self.assertEqual(ru.load_journal()["uploads"]["jet/jet.fbx"]["assetId"], "42")

    def test_cli_resume_allows_only_own_unresolved_entry(self):
        self.journal_item(operationId="op1")
        responses = [{"done": True, "response": {"assetId": "42"}},
                     {"moderationResult": {"moderationState": "Approved"}}]
        with patch.object(models, "fetch_origin"), patch.object(models._http, "read_key_file", return_value="fake-test-token"), \
                patch.object(ru, "http", side_effect=responses) as http, contextlib.redirect_stdout(io.StringIO()):
            models.main(["--key-file", "unused-fake-path", "jet"])
        self.assertTrue(all(c.args[0] == "GET" for c in http.call_args_list))

    def test_dry_run_refuses_own_unresolved_entry(self):
        self.journal_item(operationId="op1")
        self.refuse("Unresolved account upload")


if __name__ == "__main__":
    unittest.main()
