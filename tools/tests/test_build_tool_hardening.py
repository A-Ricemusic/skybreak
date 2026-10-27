"""Local-only regressions: fake Rojo builds and disposable Git repositories."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

TOOLS = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("install_rojo_connect", TOOLS / "install-rojo-connect.py")
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="rojo hardening ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.plugins = self.root / "Plugins"
        self.plugins.mkdir()
        self.official = self.plugins / "RojoManagedPlugin.rbxm"
        self.official.write_bytes(b"installed official plugin")
        self.target = self.plugins / "PhoneGameRojoConnect.rbxm"
        self.receipt = self.target.with_suffix(".rbxm.sha256")
        for name, value in {"ROOT": self.root, "PLUGINS": self.plugins, "OFFICIAL": self.official,
                            "TARGET": self.target, "RECEIPT": self.receipt}.items():
            patcher = patch.object(installer, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.result = b"packaged companion"
        self.xml = '<roblox><Item class="Script"><Properties><string name="Name">Plugin</string></Properties></Item></roblox>'

    def fake_rojo(self, args, **kwargs):
        self.assertIsInstance(args, list)
        self.assertTrue(kwargs["check"])
        self.assertEqual(kwargs["timeout"], 120)
        output = Path(args[-1])
        self.assertNotEqual(output.parent, self.plugins)
        project = json.loads(Path(args[2]).read_text())
        if output.suffix == ".rbxmx":
            self.assertEqual(Path(project["tree"]["Rojo"]["$path"]).read_bytes(), self.official.read_bytes())
            output.write_text(self.xml)
        else:
            model = ET.parse(project["tree"]["$path"])
            self.assertEqual(model.findtext(".//bool[@name='Disabled']"), "true")
            output.write_bytes(self.result)

    def install(self, side_effect=None):
        with patch.object(installer.subprocess, "run", side_effect=side_effect or self.fake_rojo) as run:
            with contextlib.redirect_stdout(io.StringIO()):
                installer.main()
        return run

    def test_first_install_and_verified_update(self):
        self.assertEqual(self.install().call_count, 2)
        self.assertEqual(self.target.read_bytes(), self.result)
        self.assertEqual(self.receipt.read_text().strip(), hashlib.sha256(self.result).hexdigest())
        self.result = b"updated companion"
        self.install()
        self.assertEqual(self.target.read_bytes(), self.result)
        self.assertEqual(self.receipt.read_text().strip(), hashlib.sha256(self.result).hexdigest())
        self.assertEqual(set(p.name for p in self.plugins.iterdir()),
                         {self.official.name, self.target.name, self.receipt.name})

    def test_unrecognized_or_modified_plugin_is_preserved(self):
        for receipt in (None, "0" * 64, "invalid"):
            with self.subTest(receipt=receipt):
                self.target.write_bytes(b"manual plugin")
                if receipt is not None:
                    self.receipt.write_text(receipt)
                with patch.object(installer.subprocess, "run") as run:
                    with self.assertRaises(RuntimeError):
                        installer.main()
                    run.assert_not_called()
                self.assertEqual(self.target.read_bytes(), b"manual plugin")

    def test_symlink_files_are_rejected_without_touching_referent(self):
        victim = self.root / "outside.rbxm"
        victim.write_bytes(b"preserve me")
        for path in (self.official, self.target, self.receipt):
            with self.subTest(path=path):
                original = path.read_bytes() if path.exists() else None
                path.unlink(missing_ok=True)
                path.symlink_to(victim)
                with patch.object(installer.subprocess, "run") as run:
                    with self.assertRaises((OSError, RuntimeError)):
                        installer.main()
                    run.assert_not_called()
                self.assertEqual(victim.read_bytes(), b"preserve me")
                path.unlink()
                if original is not None:
                    path.write_bytes(original)

    def test_symlink_plugin_directory_is_rejected(self):
        real = self.root / "real-plugins"
        self.plugins.rename(real)
        self.plugins.symlink_to(real, target_is_directory=True)
        with self.assertRaises(RuntimeError):
            self.install()
        self.assertFalse((real / self.target.name).exists())

    def test_fifo_or_directory_cannot_be_used_as_a_plugin(self):
        self.official.unlink()
        os.mkfifo(self.official)
        with self.assertRaises(RuntimeError):
            self.install()
        self.official.unlink()
        self.official.mkdir()
        with self.assertRaises(RuntimeError):
            self.install()

    def test_missing_official_and_missing_directory_have_nonzero_exit(self):
        self.official.unlink()
        for missing_directory in (False, True):
            if missing_directory:
                self.plugins.rmdir()
            with self.assertRaisesRegex(SystemExit, "rojo plugin install"):
                self.install()

    def test_build_failure_or_timeout_preserves_previous_install(self):
        self.install()
        previous = self.target.read_bytes(), self.receipt.read_bytes()
        for error in (subprocess.CalledProcessError(1, ["rojo"]), subprocess.TimeoutExpired(["rojo"], 120)):
            for failure_stage in (1, 2):
                with self.subTest(error=type(error).__name__, stage=failure_stage):
                    calls = []

                    def fail(args, **kwargs):
                        calls.append(args)
                        if len(calls) == failure_stage:
                            Path(args[-1]).write_bytes(b"partial output")
                            raise error
                        self.fake_rojo(args, **kwargs)

                    with self.assertRaises(type(error)):
                        self.install(fail)
                    self.assertEqual((self.target.read_bytes(), self.receipt.read_bytes()), previous)

    def test_unexpected_or_empty_build_output_is_not_installed(self):
        for invalid in ("unexpected-script", "empty-plugin"):
            with self.subTest(invalid=invalid):
                if invalid == "unexpected-script":
                    self.xml = "<roblox/>"
                else:
                    self.xml = '<roblox><Item class="Script"><Properties><string name="Name">Plugin</string></Properties></Item></roblox>'
                    self.result = b""
                with self.assertRaises(RuntimeError):
                    self.install()
                self.assertFalse(self.target.exists())
                self.assertFalse(self.receipt.exists())

    def test_target_changed_during_build_is_preserved(self):
        def change_target(args, **kwargs):
            self.fake_rojo(args, **kwargs)
            if Path(args[-1]).suffix == ".rbxm":
                self.target.write_bytes(b"concurrent manual plugin")

        with self.assertRaisesRegex(RuntimeError, "Refusing to overwrite"):
            self.install(change_target)
        self.assertEqual(self.target.read_bytes(), b"concurrent manual plugin")
        self.assertFalse(self.receipt.exists())
        self.assertFalse(list(self.plugins.glob(".*-*")))


@unittest.skipUnless(shutil.which("bun"), "Bun is required to exercise the actual cleanup CLI")
class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="cleanup hardening ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve() / "fixture repo"
        (self.root / "tools").mkdir(parents=True)
        shutil.copy2(TOOLS / "clean-artifacts.ts", self.root / "tools/clean-artifacts.ts")
        self.git("init", "-q")

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.root), *args], check=True, capture_output=True)

    def write(self, name, data="keep or delete"):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data)
        return path

    def clean(self, *args, success=True):
        result = subprocess.run([shutil.which("bun"), str(self.root / "tools/clean-artifacts.ts"), *args],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def test_dry_run_then_normal_cleanup_preserves_locks_and_canonical_assets(self):
        disposable = ["out/generated.js", "include/runtime.lua", "assets/aircraft/kestrel.fbx",
                      "build/decode.log", "build/transient.tmp", "build/jest-cache/result", "build/test-game.rbxlx",
                      "build/screenshots/menu.jpg"]
        preserved = ["build/skybreak.rbxlx", "build/skybreak-tests.rbxlx", "build/skybreak-tests.rbxlx.lock",
                     "build/session.lock", "build/screenshots/new.jpg", "assets/aircraft/kestrel.mesh.json",
                     "assets/aircraft/kestrel.blend"]
        for name in disposable + preserved:
            self.write(name)
        self.clean("--dry-run")
        self.assertTrue(all((self.root / name).exists() for name in disposable + preserved))
        self.clean()
        self.assertTrue(all(not (self.root / name).exists() for name in disposable))
        self.assertTrue(all((self.root / name).exists() for name in preserved))

    def test_tracked_files_and_their_containing_directories_are_preserved(self):
        tracked = ["out/source.ts", "include/source.lua", "build/jest-source/source.ts", "build/notes.tmp",
                   "assets/aircraft/kestrel.fbx", "build/screenshots/menu.jpg"]
        for name in tracked:
            self.write(name)
        self.git("add", "--", *tracked)
        disposable = self.write("build/disposable.log")
        self.clean()
        self.assertTrue(all((self.root / name).exists() for name in tracked))
        self.assertFalse(disposable.exists())

    def test_symlinked_ancestors_and_candidates_never_touch_external_files(self):
        for name, child in (("build", "external.log"), ("build/screenshots", "menu.jpg"),
                            ("assets", "aircraft/kestrel.fbx"), ("assets/aircraft", "kestrel.fbx"),
                            ("out", "source.ts"), ("include", "source.lua"), ("build/jest-link", "source.ts")):
            with self.subTest(name=name):
                outside = Path(self.temp.name).resolve() / "outside"
                victim = outside / child
                victim.parent.mkdir(parents=True, exist_ok=True)
                victim.write_text("external source")
                link = self.root / name
                link.parent.mkdir(parents=True, exist_ok=True)
                link.symlink_to(outside, target_is_directory=True)
                self.clean()
                self.assertTrue(link.is_symlink())
                self.assertEqual(victim.read_text(), "external source")
                link.unlink()
                shutil.rmtree(outside)

    def test_nested_symlink_in_deleted_directory_is_not_followed(self):
        outside = Path(self.temp.name).resolve() / "external.txt"
        outside.write_text("external source")
        generated = self.write("out/generated.js")
        (generated.parent / "external-link").symlink_to(outside)
        self.clean()
        self.assertFalse(generated.parent.exists())
        self.assertEqual(outside.read_text(), "external source")

    def test_missing_git_index_aborts_before_deletion(self):
        victim = self.write("out/source.ts")
        shutil.rmtree(self.root / ".git")
        self.clean(success=False)
        self.assertTrue(victim.exists())


if __name__ == "__main__":
    unittest.main()
