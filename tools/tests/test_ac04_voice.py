"""Offline isolation checks; no provider request, Roblox upload or real bank writes."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

TOOLS = Path(__file__).resolve().parents[1]
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location("ac04_voice_adapter", TOOLS / "ac04-voice.py")
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)


class AC04VoiceIsolation(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.old_voice, self.old_output = adapter.voice.VOICE, adapter.OUTPUT
        adapter.voice.VOICE = adapter.OUTPUT = self.folder
        self.plan = {"banks": [{"id": "voiceBank01", "sha256": "exact-bank-hash", "members": [
            {"id": "ac04.story.i01.b00", "start": 0.25, "end": 8.5}]}]}

    def tearDown(self):
        adapter.voice.VOICE, adapter.OUTPUT = self.old_voice, self.old_output
        self.temp.cleanup()

    def test_pack_uses_ac04_files_and_namespaces_exact_captions(self):
        adapter.write_cues(self.plan, [{"id": "ac04.story.i01.b00", "text": "Exact original caption.",
                                      "speaker": "THE STORYTELLER", "tape": False, "kind": "story"}])
        source = (self.folder / "AC04VoiceCues.ts").read_text()
        self.assertIn('"bank": "ac04_voiceBank01"', source)
        self.assertIn('"text": "Exact original caption."', source)
        self.assertFalse((self.folder / "VoiceCues.ts").exists())

    def test_moderated_record_without_independent_matching_review_stays_silent(self):
        uploaded = {"voiceBank01": {"state": "MODERATION_STATE_APPROVED", "sha256": "exact-bank-hash", "assetId": 123}}
        adapter.write_banks(self.plan, uploaded)
        self.assertNotIn("rbxassetid://123", (self.folder / "AC04VoiceBanks.ts").read_text())
        review = {"commercialUsePermitted": True, "banks": {"voiceBank01": {
            "sha256": "stale-hash", "approved": True, "reviewer": "independent-fixture", "method": "fixture",
            "transcriptMatch": {"engine": "fixture-stt", "minRate": 1, "flagged": []}}}}
        (self.folder / "review.json").write_text(json.dumps(review))
        adapter.write_banks(self.plan, uploaded)
        self.assertNotIn("rbxassetid://123", (self.folder / "AC04VoiceBanks.ts").read_text())
        review["banks"]["voiceBank01"]["sha256"] = "exact-bank-hash"
        (self.folder / "review.json").write_text(json.dumps(review))
        adapter.write_banks(self.plan, uploaded)
        self.assertIn('"ac04_voiceBank01": "rbxassetid://123"', (self.folder / "AC04VoiceBanks.ts").read_text())
        self.assertFalse((self.folder / "VoiceBanks.ts").exists())


if __name__ == "__main__":
    unittest.main()
