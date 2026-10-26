#!/usr/bin/env python3
"""Pack the remaining SFX into five banks, conserving Roblox upload slots.

Three already submitted standalone loops remain unchanged. Native Roblox
playback/loop regions select each cue within a bank; no frame-timed seeking.
python3 tools/pack-audio.py --ffmpeg <executable>
"""
import argparse
import array
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets/audio"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", required=True)
    args = parser.parse_args()
    spec = json.loads((ASSETS / "cues.json").read_text())
    provenance = json.loads((ASSETS / "provenance.json").read_text())
    standalone = {"engineCruise", "engineBurn", "wind"}
    plan = {"version": 1, "cues": []}
    remaining = []
    for cue in spec["cues"]:
        name = cue["id"]
        if name in standalone:
            plan["cues"].append({"id": name, "members": [{"id": name, "start": 0, "end": provenance[name]["prepared"]["duration"]}]})
        else:
            remaining.append(cue)
    for index in range(0, len(remaining), 5):
        name = f"sfxBank{index // 5 + 1:02}"
        members = []
        samples = array.array("f")
        sources = {}
        for cue in remaining[index:index+5]:
            source = provenance[cue["id"]]
            if source.get("subscriptionTierAtGeneration") in (None, "free"):
                raise RuntimeError("Cannot pack noncommercial source " + cue["id"])
            path = ASSETS / (cue["id"] + ".ogg")
            pcm = subprocess.run([args.ffmpeg, "-v", "error", "-i", str(path), "-ar", "44100", "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
            samples.extend([0.0] * 11025)
            start = len(samples) / 44100
            samples.extend(array.array("f", pcm))
            end = len(samples) / 44100
            members.append({"id": cue["id"], "start": start, "end": end})
            sources[cue["id"]] = hashlib.sha256(path.read_bytes()).hexdigest()
        samples.extend([0.0] * 11025)
        output = ASSETS / (name + ".ogg")
        previous = provenance.get(name, {})
        cached = (output.exists() and previous.get("derivedFrom") == sources
                  and previous.get("prepared", {}).get("sha256") == hashlib.sha256(output.read_bytes()).hexdigest())
        if not cached:
            subprocess.run([args.ffmpeg, "-y", "-v", "error", "-f", "f32le", "-ar", "44100", "-ac", "1", "-i", "pipe:0", "-c:a", "libvorbis", "-q:a", "7", str(output)], input=samples.tobytes(), capture_output=True, check=True)
        decoded = subprocess.run([args.ffmpeg, "-v", "error", "-i", str(output), "-ar", "44100", "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
        peak = max(abs(x) for x in array.array("f", decoded))
        if peak > 0.99: raise RuntimeError(f"{name}: lossy codec overshoot requires more headroom before upload")
        provenance[name] = {"provider": "Local packing of ElevenLabs originals", "subscriptionTierAtGeneration": "starter",
                            "derivedFrom": sources, "prepared": {"sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "duration": len(decoded)/(44100*4), "peak": peak}}
        plan["cues"].append({"id": name, "members": members})
        print(f"{name}: {len(members)} effects, {len(decoded)/(44100*4):.2f}s", flush=True)
    (ASSETS / "upload-plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    (ASSETS / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")


if __name__ == "__main__":
    main()
