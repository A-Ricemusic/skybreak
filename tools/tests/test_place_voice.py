"""Artifact-gate tests use synthetic XML; they do not build or run a Roblox place."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location("check_place_voice", Path(__file__).parents[1] / "check-place-voice.py")
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class VoiceArtifactTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.output = Path(self.tmp.name) / "out"
        self.place = Path(self.tmp.name) / "place.rbxlx"
        self.tree = ET.Element("roblox")
        self.items = {}
        for path, (kind, relative) in gate.REQUIRED.items():
            parent = self.tree
            prefix = ""
            for segment in path.split("/"):
                prefix = f"{prefix}/{segment}" if prefix else segment
                if prefix not in self.items:
                    item = ET.SubElement(parent, "Item", {"class": kind if prefix == path else "Folder"})
                    properties = ET.SubElement(item, "Properties")
                    ET.SubElement(properties, "string", {"name": "Name"}).text = segment
                    self.items[prefix] = item
                parent = self.items[prefix]
            source = 'Voice:Story(0, 0, "line"); VoicePlayer:Play(clip); VoicePlayer:Preload()\n'
            ET.SubElement(parent.find("Properties"), "ProtectedString", {"name": "Source"}).text = source
            compiled = self.output / relative
            compiled.parent.mkdir(parents=True, exist_ok=True)
            compiled.write_text(source)

    def check(self):
        ET.ElementTree(self.tree).write(self.place)
        gate.check(self.place, self.output)

    def test_current_scripts_pass(self):
        self.check()

    def test_rojo_string_sources_pass(self):
        for item in self.items.values():
            source = item.find("Properties/ProtectedString[@name='Source']")
            if source is not None:
                source.tag = "string"
        self.check()

    def test_missing_voice_player_fails(self):
        parent = self.items[gate.CLIENT]
        parent.remove(self.items[f"{gate.CLIENT}/VoicePlayer"])
        with self.assertRaisesRegex(ValueError, "Missing ModuleScript.*VoicePlayer"):
            self.check()

    def test_stale_cinematic_fails(self):
        self.items[f"{gate.CLIENT}/RelayCinematic"].find("Properties/ProtectedString").text = "return {}"
        with self.assertRaisesRegex(ValueError, "Stale packaged source.*RelayCinematic"):
            self.check()

    def test_both_compiled_and_packaged_consumer_missing_fails(self):
        self.items[f"{gate.CLIENT}/RelayCinematic"].find("Properties/ProtectedString").text = "return {}"
        (self.output / "client/RelayCinematic.luau").write_text("return {}")
        with self.assertRaisesRegex(ValueError, "no recorded-dialogue consumer"):
            self.check()

    def test_wrong_instance_class_fails(self):
        self.items[f"{gate.SHARED}/VoiceBanks"].set("class", "Folder")
        with self.assertRaisesRegex(ValueError, "Missing ModuleScript.*VoiceBanks"):
            self.check()


if __name__ == "__main__":
    unittest.main()
