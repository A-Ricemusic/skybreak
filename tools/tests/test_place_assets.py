"""Offline regression coverage: never access account state or send HTTP."""
import base64
import importlib.util
import json
from pathlib import Path
import sys
import subprocess
import os
import re
import tempfile
import hashlib
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location("place_assets", TOOLS / "check-place-assets.py")
gate = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = gate
spec.loader.exec_module(gate)


def place(value='{"vertices":[[0,0,0]],"faces":[[0,0,0]]}'):
    root = ET.Element("roblox")
    item = ET.SubElement(root, "Item", {"class": "StringValue"})
    props = ET.SubElement(item, "Properties")
    ET.SubElement(props, "string", {"name": "Name"}).text = "FixtureGeometry"
    ET.SubElement(props, "string", {"name": "Value"}).text = value
    return ET.tostring(root)


class PlaceAssetsTests(unittest.TestCase):
    def test_approved_exact_bytes_pass_and_one_vertex_change_refused(self):
        original = place()
        approved = gate.inventory(original)[0][0].sha256
        def review(name, content, digest, **kwargs):
            if digest != approved:
                raise RuntimeError("Unapproved exact bytes")
        with patch.object(gate.upload, "require_model_review", side_effect=review), patch.object(gate, "approved_ids", return_value=set()):
            gate.validate(original)
            with self.assertRaisesRegex(RuntimeError, "publication refused"):
                gate.validate(place('{"vertices":[[1,0,0]],"faces":[[0,0,0]]}'))

    def test_current_build_inventory_and_vertex_tamper(self):
        path = TOOLS.parent / "build/skybreak.rbxlx"
        self.assertTrue(path.is_file(), "run bun run build:place first")
        root = ET.fromstring(path.read_bytes())
        blobs, refs = gate.inventory(path.read_bytes())
        self.assertEqual(len(blobs), 13)
        # Derive catalog IDs from the source inventory, independently of the
        # compiled-place extractor, so new approved uploads need no magic count.
        manifest = json.loads((TOOLS.parent / "assets/roblox-upload/manifest.json").read_text())
        table = (TOOLS.parent / manifest["idsTable"]).read_text()
        keys = {asset["robloxAssetIdsKey"] for asset in manifest["assets"]}
        expected = {value for key, value in re.findall(r"^\s*(\w+):\s*([1-9][0-9]*),", table, re.M) if key in keys}
        self.assertEqual(refs, expected)
        # An integrity regression against the current build, no invented approval.
        approved = {b.sha256 for b in blobs}
        def exact(name, content, digest, **kwargs):
            if digest not in approved:
                raise RuntimeError("Changed vertex")
        with patch.object(gate.upload, "require_model_review", side_effect=exact), patch.object(gate, "approved_ids", return_value=refs):
            gate.validate(path.read_bytes())
            prop = next(p for p in root.iter("string") if p.get("name") == "Value" and '"vertices"' in (p.text or ""))
            data = json.loads(prop.text)
            data["vertices"][0][0] += 1
            prop.text = json.dumps(data, separators=(",", ":"))
            with self.assertRaisesRegex(RuntimeError, "Changed vertex"):
                gate.validate(ET.tostring(root))

    def test_military_upload_provenance_matches_approved_exports(self):
        root = TOOLS.parent
        manifest = json.loads((root / "assets/roblox-upload/manifest.json").read_text())
        table = dict(re.findall(r"^\s*(\w+):\s*([1-9][0-9]*),",
                                (root / manifest["idsTable"]).read_text(), re.M))
        military = [a for a in manifest["assets"] if a["folder"].startswith("military-")]
        self.assertEqual(len(military), 10)
        ledger = (root / "docs/qa/uploaded-assets.md").read_text()
        for asset in military:
            record = asset["approvedUpload"]
            approval = json.loads((root / record["approval"]).read_text())
            self.assertEqual(record["assetId"], table[asset["robloxAssetIdsKey"]])
            row = next(line for line in ledger.splitlines()
                       if line.startswith(f"| {asset['folder']} |"))
            self.assertIn(f"| {record['assetId']} | Model |", row)
            self.assertIn("10/10 2026-10-31", row)
            self.assertIn("APPROVED 2026-10-31", row)
            for filename, digest in approval["uploadSet"].items():
                self.assertIn(f"assets/roblox-upload/{asset['folder']}/{filename}", row)
                self.assertIn(digest, row)
            self.assertEqual(record["moderation"], "APPROVED")
            self.assertEqual(record["moderationDate"], "2026-10-31")
            for field in ("uploadSet", "embeddedTextures"):
                self.assertEqual(record[field], approval[field])
                for filename, digest in record[field].items():
                    self.assertEqual(hashlib.sha256((root / "assets/roblox-upload" /
                                                    asset["folder"] / filename).read_bytes()).hexdigest(), digest)

    def test_real_merged_records_pass_then_tampering_or_local_only_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            def git(*args):
                return subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)
            def write(path, value):
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps(value))
            git("init", "-q")
            git("config", "user.name", "Fixture")
            git("config", "user.email", "fixture@example.invalid")
            content = gate.inventory(place())[0][0].content
            digest = hashlib.sha256(content).hexdigest()
            files = {"FixtureGeometry.json": digest}
            asset = "assets/roblox-upload/FixtureGeometry/"
            write(asset + "export-manifest.json", {"creator": "Alice", "exportVersion": "v1", "files": files})
            (root / asset / "FixtureGeometry.json").write_bytes(content)
            write("docs/qa/asset-reviews/approvals/FixtureGeometry.json", {"uploadSet": files, "exportVersion": "v1", "embeddedTextures": {}})
            decision = {"asset": "FixtureGeometry", "creator": "Alice", "reviewer": "Bob",
                        "exportVersion": "v1", "files": files, "verdict": "APPROVE", "score": 10,
                        "reviewDate": "2026-10-31", "sourceReview": "review.md",
                        "policyLinks": ["https://www.roblox.com/termsofuse", "https://en.help.roblox.com/hc/en-us/articles/203313410-Roblox-Community-Standards/"]}
            write("docs/qa/asset-reviews/decisions/fixture.json", decision)
            (root / "review.md").write_text("Synthetic test only, never a real approval")
            write("assets/roblox-upload/manifest.json", {"idsTable": "src/shared/RobloxAssetIds.ts", "assets": []})
            (root / "src/shared").mkdir(parents=True)
            (root / "src/shared/RobloxAssetIds.ts").write_text("")
            git("add", ".")
            git("commit", "-qm", "fixture")
            git("update-ref", "refs/remotes/origin/main", "HEAD")
            gate.validate(place(), root=root)
            with self.assertRaisesRegex(RuntimeError, "publication refused"):
                gate.validate(place('{"vertices":[[1,0,0]],"faces":[[0,0,0]]}'), root=root)
            decision["verdict"] = "REJECT"
            write("docs/qa/asset-reviews/decisions/local.json", decision)
            with self.assertRaisesRegex(RuntimeError, "local-only"):
                gate.validate(place(), root=root)
            git("add", ".")
            git("commit", "-qm", "reject")
            git("update-ref", "refs/remotes/origin/main", "HEAD")
            with self.assertRaisesRegex(RuntimeError, "REJECT"):
                gate.validate(place(), root=root)

    def test_binary_and_shared_blobs_including_unused(self):
        raw = b"mesh vertex bytes"
        encoded = base64.b64encode(raw).decode()
        data = f'<roblox><Item class="MeshPart"><Properties><BinaryString name="MeshData">{encoded}</BinaryString></Properties></Item><SharedStrings><SharedString md5="x">{encoded}</SharedString></SharedStrings></roblox>'.encode()
        self.assertEqual(gate.inventory(data)[0][0].content, raw)
        with self.assertRaises(ValueError):
            gate.inventory(data.replace(encoded.encode(), b"%%%"))

    def test_unknown_reference_and_external_uri_refused(self):
        data = b'<roblox><Item class="MeshPart"><Properties><Content name="MeshId"><url>rbxassetid://123456</url></Content></Properties></Item></roblox>'
        with patch.object(gate, "approved_ids", return_value=set()):
            with self.assertRaisesRegex(RuntimeError, "123456"):
                gate.validate(data)
        with self.assertRaisesRegex(RuntimeError, "URI"):
            gate.inventory(data.replace(b"rbxassetid://123456", b"https://example.com/mesh"))

    def test_new_blob_halt_but_unchanged_content_does_not_access_state(self):
        blob = gate.Blob("mesh.bin", b"vertices")
        with patch.object(gate, "main_geometry_hashes", return_value={blob.sha256}), patch.object(gate.upload, "validate_state_location", side_effect=AssertionError("No account access")):
            gate.check_publish_halt([blob])
        with patch.object(gate, "main_geometry_hashes", return_value=set()), patch.object(gate.upload, "validate_state_location"), patch.object(gate.upload, "MODEL_HALT") as halt:
            halt.exists.return_value = True
            with self.assertRaisesRegex(RuntimeError, "HALT"):
                gate.check_publish_halt([blob])

    def test_retry_stops_when_gate_rejects_before_second_post(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            def command(name, body):
                path = temp / name
                path.write_text("#!/bin/sh\n" + body)
                path.chmod(0o755)
            command("python3", 'case "$1" in *check-place-assets.py) if [ -e "$FIXTURE/gated" ]; then exit 1; fi; touch "$FIXTURE/gated";; esac\n')
            command("git", "exit 0\n")
            command("sleep", "exit 0\n")
            command("curl", 'cat >/dev/null; echo POST >> "$FIXTURE/posts"; printf 409\n')
            artifact = temp / "place.rbxlx"
            artifact.write_bytes(place())
            environment = {**os.environ, "PATH": str(temp) + os.pathsep + os.environ["PATH"],
                           "FIXTURE": str(temp), "ROBLOX_API_KEY": "synthetic-test-value",
                           "ROBLOX_UNIVERSE_ID": "1", "ROBLOX_PLACE_ID": "1"}
            result = subprocess.run(["bash", str(TOOLS / "publish-place.sh"), str(artifact)],
                                    cwd=TOOLS.parent, env=environment, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((temp / "posts").read_text().splitlines(), ["POST"])

    def test_every_post_attempt_uses_snapshot_and_gate(self):
        script = (TOOLS / "publish-place.sh").read_text()
        loop = script[script.index("for ATTEMPT"):script.index("done")]
        self.assertLess(loop.index("check-place-assets.py"), loop.index("curl"))
        self.assertIn('--data-binary "@${PLACE_SNAPSHOT}"', loop)

if __name__ == "__main__":
    unittest.main()
