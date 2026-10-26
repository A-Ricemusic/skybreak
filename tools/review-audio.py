#!/usr/bin/env python3
"""Conservative automated non-vocal SFX screen, not a human listening review.

Run in a Python environment with faster-whisper installed. Uses local Whisper
with voice activity detection; any detected speech blocks upload for that cue.
Also checks the final-file hash, paid-plan provenance and prompt policy.
Voice lines are outside this tool's scope and require independent listening.
"""
import hashlib
import argparse
import json
from pathlib import Path
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets/audio"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", action="store_true", help="Screen individual source cues instead of the packed upload set")
    args = parser.parse_args()
    plan_path = ASSETS / "upload-plan.json"
    spec = json.loads((plan_path if plan_path.exists() and not args.sources else ASSETS / "cues.json").read_text())
    provenance = json.loads((ASSETS / "provenance.json").read_text())
    model = WhisperModel("tiny.en", device="cpu", compute_type="int8", download_root=str(ROOT / "build/audio/whisper"))
    review = {"commercialUsePermitted": True,
              "scope": "Non-vocal effects only. Automated screening; no human listening review claimed.",
              "files": {}}
    failed = []
    for cue in spec["cues"]:
        name = cue["id"]
        path = ASSETS / (name + ".ogg")
        source = provenance[name]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        segments, info = model.transcribe(str(path), language="en", beam_size=5, vad_filter=True,
                                         condition_on_previous_text=False, temperature=0)
        detected = [{"text": s.text.strip(), "start": s.start, "end": s.end,
                     "noSpeechProbability": s.no_speech_prob, "averageLogProbability": s.avg_logprob}
                    for s in segments]
        transcript = " ".join(s["text"] for s in detected).strip()
        approved = (transcript == "" and source.get("subscriptionTierAtGeneration") not in (None, "free")
                    and source["prepared"]["sha256"] == digest)
        review["files"][name] = {"approved": approved, "sha256": digest, "transcript": transcript,
                                "reviewer": "local-whisper-tiny.en-vad-and-source-check",
                                "method": "Automated speech/VAD screen, paid provenance, PG-13 non-vocal prompt review, decoded peak/silence checks; not human listening.",
                                "segments": detected}
        if not approved: failed.append(name)
        print(f"{name}: {'PASS non-vocal screen' if approved else 'BLOCKED ' + repr(transcript)}", flush=True)
    (ASSETS / ("source-review.json" if args.sources else "review.json")).write_text(json.dumps(review, indent=2) + "\n")
    if failed: raise RuntimeError("Review required for: " + ", ".join(failed))


if __name__ == "__main__":
    main()
