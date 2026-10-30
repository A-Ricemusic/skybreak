"""Offline checks for the voice pipeline's reuse rules and moderation gates (D-142, D-143)."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import voice  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("upload_voice", ROOT / "tools/upload-voice.py")
upload_voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upload_voice)


def line(id="story.c01.b03", kind="story", tape=True, spoken="Words."):
    return {"id": id, "kind": kind, "tape": tape, "spoken": spoken, "text": spoken, "speaker": "TEAL"}


class LexiconTests(unittest.TestCase):
    def test_rejected_manifest_reading_is_a_hard_failure(self):
        hard, _, _ = voice.lexicon_hits("The manifest sends grain drums to a farm with a runway, then five keys on Iron Coast. Nobody ships grain in drums.")
        self.assertIn("keys", hard)
        self.assertIn("phrase: clandestine airstrip", hard)
        self.assertIn("phrase: cargo hidden in drums", hard)

    def test_fuel_context_explains_the_rewritten_manifest(self):
        hard, review, notes = voice.lexicon_hits("The manifest calls it grain. It's aviation fuel: drums to a farm with a runway, then on to the Iron Coast docks. Nobody ships grain in drums.")
        self.assertEqual((hard, review), ([], []))
        self.assertEqual(len(notes), 2)

    def test_lookalikes_need_review_but_ordinary_words_do_not(self):
        self.assertEqual(voice.lexicon_hits("The ships and tankers are his supply line.")[1], ["tankers"])
        self.assertEqual(voice.lexicon_hits("Three loyalist frigates cover the landing.")[1], ["frigates"])
        self.assertEqual(voice.lexicon_hits("Storms ground frightened people. Fuel tanks only."), ([], [], []))
        self.assertEqual(voice.lexicon_hits("Workers live two blocks from those docks."), ([], [], []))

    def test_review_hits_pass_only_with_a_reasoned_reviewer_acceptance(self):
        bank = {"sha256": "x", "members": [{"id": "radio.m09.story.1"}]}
        transcripts = {"radio.m09.story.1": {"text": "SERA: Clear the guns above the beach."}}
        check = {"sha256": "x", "perLine": {"radio.m09.story.1": {"heard": "Clear the guns above the beach."}}}
        self.assertFalse(voice.heard_lexicon(bank, transcripts, check, {})["pass"])
        self.assertFalse(voice.heard_lexicon(bank, transcripts, check, {"radio.m09.story.1": {"words": ["beach"]}})["pass"])
        accepted = {"radio.m09.story.1": {"words": ["beach"], "reason": "Shoreline", "reviewer": "independent"}}
        self.assertTrue(voice.heard_lexicon(bank, transcripts, check, accepted)["pass"])

    def test_missing_or_stale_heard_text_fails(self):
        bank = {"sha256": "new", "members": [{"id": "a"}]}
        transcripts = {"a": {"text": "Clean words."}}
        stale = {"sha256": "old", "perLine": {"a": {"heard": "Clean words."}}}
        self.assertEqual(voice.heard_lexicon(bank, transcripts, stale, {})["linesWithoutHeardText"], ["a"])


class SttEvidenceTests(unittest.TestCase):
    def test_audio_events_and_stray_words_are_reported(self):
        bank = {"sha256": "s", "members": [{"id": "a", "start": 0.25, "end": 1.0}]}
        transcripts = {"a": {"text": "Hello there.", "spoken": "Hello there."}}
        data = {"words": [{"text": "Hello", "start": 0.3, "end": 0.5, "type": "word"}, {"text": " ", "start": 0.5, "end": 0.6, "type": "spacing"},
                          {"text": "there.", "start": 0.6, "end": 0.9, "type": "word"}, {"text": "(laughs)", "start": 1.5, "end": 1.8, "type": "audio_event"},
                          {"text": "extra", "start": 2.0, "end": 2.2, "type": "word"}]}
        check = voice.bank_check(bank, data, transcripts, {})
        self.assertEqual(check["perLine"]["a"]["heard"], "Hello there.")
        self.assertEqual([t["type"] for t in check["nonWordTokens"]], ["audio_event"])
        self.assertEqual([w["text"] for w in check["unassignedWords"]], ["extra"])


class LegacyReuseTests(unittest.TestCase):
    def setUp(self):
        self.member = {"legacyId": "story.c12.b02", "start": 1.0, "end": 2.0, "cacheKey": "k", "requestId": "r", "rawSha256": "h",
                       "speaker": "TEAL", "tape": True, "spoken": "Words.", "text": "Words."}
        self.takes = {"k": ("voiceBank01", self.member)}
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        patcher = patch.object(voice, "CACHE", Path(temp.name))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_same_take_reuses_the_approved_region(self):
        self.assertEqual(voice.legacy_take(line(), "k", self.takes, {"k": {"requestId": "r", "sha256": "h"}}), ("voiceBank01", self.member))
        self.assertEqual(voice.legacy_take(line(), "k", self.takes, {}), ("voiceBank01", self.member))

    def test_other_treatment_or_request_is_not_reused(self):
        self.assertIsNone(voice.legacy_take(line(tape=False), "k", self.takes, {}))
        self.assertIsNone(voice.legacy_take(line(), "other", self.takes, {}))

    def test_diverged_cache_is_an_error_not_a_silent_mismatch(self):
        with self.assertRaises(SystemExit):
            voice.legacy_take(line(), "k", self.takes, {"k": {"requestId": "r2", "sha256": "h"}})
        with self.assertRaises(SystemExit):
            voice.legacy_take(line(), "k", self.takes, {"k": {"requestId": "r", "sha256": "h2"}})

    def test_tiers_follow_risk_order(self):
        self.assertEqual(voice.tier_for(line("radio.m06.story.1", "radio")), "voiceBankN1")
        self.assertEqual(voice.tier_for(line("story.c09.b00")), "voiceBankN2")
        self.assertEqual(voice.tier_for(line("story.c08.b04")), "voiceBankN3")


class ShippedInventoryTests(unittest.TestCase):
    def test_reused_regions_are_the_frozen_approved_takes(self):
        plan = json.loads((ROOT / "assets/voice/upload-plan.json").read_text())
        legacy = json.loads((ROOT / "assets/voice/legacy-banks.json").read_text())["banks"]
        uploaded = json.loads((ROOT / "assets/voice/uploaded.json").read_text())
        provenance = json.loads((ROOT / "assets/voice/provenance.json").read_text())["lines"]
        for bank in plan["legacyBanks"]:
            frozen = legacy[bank["id"]]
            self.assertEqual(uploaded[bank["id"]]["state"], "MODERATION_STATE_APPROVED")
            self.assertEqual((uploaded[bank["id"]]["sha256"], str(uploaded[bank["id"]]["assetId"])), (frozen["sha256"], frozen["assetId"]))
            for member in bank["members"]:
                take = next(m for m in frozen["members"] if m["legacyId"] == member["legacyId"])
                origin = provenance[member["id"]]
                self.assertEqual((origin["cacheKey"], origin["requestId"], origin["rawSha256"]), (take["cacheKey"], take["requestId"], take["rawSha256"]))
                self.assertEqual((member["start"], member["end"]), (take["start"], take["end"]))


class UploadOrderTests(unittest.TestCase):
    plan = {"banks": [{"id": "voiceBankN1", "uploadOrder": 1, "sha256": "a"}, {"id": "voiceBankN2", "uploadOrder": 2, "sha256": "b"}]}

    def test_one_bank_per_run(self):
        self.assertTrue(upload_voice.order_problems(self.plan, self.plan["banks"], {}))

    def test_later_bank_waits_for_earlier_approval(self):
        later = [self.plan["banks"][1]]
        self.assertTrue(upload_voice.order_problems(self.plan, later, {}))
        self.assertTrue(upload_voice.order_problems(self.plan, later, {"voiceBankN1": {"state": "MODERATION_STATE_REJECTED", "sha256": "a"}}))
        self.assertEqual(upload_voice.order_problems(self.plan, later, {"voiceBankN1": {"state": "MODERATION_STATE_APPROVED", "sha256": "a"}}), [])
        self.assertEqual(upload_voice.order_problems(self.plan, [self.plan["banks"][0]], {}), [])


if __name__ == "__main__":
    unittest.main()
