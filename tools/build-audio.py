#!/usr/bin/env python3
"""Generate cached SKYBREAK SFX, normalize them, and verify decoded PCM.

python3 tools/build-audio.py --key-file <private-file> --ffmpeg <executable>
Only missing raw takes are generated. --only cueId limits a run.
Final Ogg files and their provenance belong in assets/audio; raw takes and
measurement reports are kept under ignored build/audio. Never logs credentials.
"""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets/audio"
WORK = ROOT / "build/audio"


def save(path, value):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2) + "\n")
    temp.replace(path)


def run(args):
    return subprocess.run(args, check=True, capture_output=True).stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key-file", required=True)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--only")
    args = parser.parse_args()
    key = Path(args.key_file).read_text().strip()
    account_request = urllib.request.Request("https://api.elevenlabs.io/v1/user/subscription", headers={"xi-api-key": key})
    with urllib.request.urlopen(account_request, timeout=30) as response:
        subscription = json.load(response)
    tier = subscription.get("tier")
    if not tier or tier == "free":
        raise RuntimeError("Final game effects require an ElevenLabs plan with commercial rights; current tier: " + str(tier))
    spec = json.loads((ASSETS / "cues.json").read_text())
    WORK.mkdir(parents=True, exist_ok=True)
    provenance_path = ASSETS / "provenance.json"
    provenance = json.loads(provenance_path.read_text()) if provenance_path.exists() else {}
    reports = {}
    for cue in spec["cues"]:
        name = cue["id"]
        if args.only and args.only != name:
            continue
        raw = WORK / (name + ".mp3")
        request_file = WORK / (name + ".request.json")
        request = {"text": cue["prompt"] + " Sound effect only. No speech, voices, profanity, screams, human injury, gore, music, or copyrighted recordings.",
                   "duration_seconds": cue["seconds"], "loop": cue["loop"],
                   "prompt_influence": 0.65, "model_id": spec["model"]}
        if raw.exists() and (not request_file.exists() or json.loads(request_file.read_text()) != request):
            raise RuntimeError(f"{name}: cached take differs from prompt; preserve it before regenerating")
        if not raw.exists():
            print(f"Generating {name} ({cue['seconds']}s)", flush=True)
            req = urllib.request.Request("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
                                         data=json.dumps(request).encode(),
                                         headers={"xi-api-key": key, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=180) as response:
                    content = response.read()
                    billed = response.headers.get("character-cost")
            except urllib.error.HTTPError as error:
                raise RuntimeError(f"ElevenLabs HTTP {error.code}: {error.read().decode()[:600]}") from None
            raw.write_bytes(content)
            save(request_file, request)
            provenance[name] = {"provider": spec["provider"], "model": spec["model"], "request": request,
                                "billedCharacters": billed, "rawSha256": hashlib.sha256(content).hexdigest(),
                                "subscriptionTierAtGeneration": tier,
                                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            save(provenance_path, provenance)
        final = ASSETS / (name + ".ogg")
        previous = provenance.get(name, {})
        if (final.exists() and previous.get("prepared", {}).get("sha256") == hashlib.sha256(final.read_bytes()).hexdigest()
                and previous.get("rawSha256") == hashlib.sha256(raw.read_bytes()).hexdigest()
                and previous.get("subscriptionTierAtGeneration") not in (None, "free")):
            reports[name] = previous["prepared"]
            print(f"Cached verified final {name}", flush=True)
            continue
        # Mono enables unambiguous positional playback. Loops get an overlap
        # crossfade (not a fade to silence) across the original seam.
        pcm = run([args.ffmpeg, "-v", "error", "-i", str(raw), "-ac", "1", "-ar", "44100", "-f", "f32le", "-"])
        duration = len(pcm) / (4 * 44100)
        filters = []
        prepared_input = raw
        if cue["loop"]:
            samples = array.array("f", pcm)
            cross = round(0.08 * 44100)
            # End blends into the original beginning; rotate the middle to the
            # front so both the crossfade and the final wrap stay continuous.
            seam = array.array("f", (samples[-cross+i] * (1-i/(cross-1)) + samples[i] * (i/(cross-1)) for i in range(cross)))
            loop_pcm = samples[cross:-cross] + seam
            prepared_input = WORK / (name + ".loop.wav")
            subprocess.run([args.ffmpeg, "-y", "-v", "error", "-f", "f32le", "-ar", "44100", "-ac", "1",
                            "-i", "pipe:0", str(prepared_input)], input=loop_pcm.tobytes(), capture_output=True, check=True)
            filters = ["-af", "loudnorm=I=-20:TP=-2:LRA=7,alimiter=limit=0.8:level=false"]
        else:
            filters = ["-af", f"silenceremove=start_periods=1:start_duration=0.005:start_threshold=-45dB,"
                       f"afade=t=out:st={max(0.1, duration - 0.08)}:d=0.08,loudnorm=I=-18:TP=-2:LRA=7,alimiter=limit=0.8:level=false"]
        run([args.ffmpeg, "-y", "-v", "error", "-i", str(prepared_input), *filters,
             "-ac", "1", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "5", str(final)])
        decoded = run([args.ffmpeg, "-v", "error", "-i", str(final), "-f", "f32le", "-ac", "1", "-ar", "44100", "-"])
        samples = array.array("f", decoded)
        if sys.byteorder != "little": samples.byteswap()
        peak = max(abs(x) for x in samples)
        # Lossy Vorbis can overshoot on very short impulses even after a PCM
        # limiter. Re-encode from the prepared source with measured headroom.
        if peak > 0.89:
            adjusted = [*filters]
            adjusted[-1] += f",volume={0.8 / peak}"
            run([args.ffmpeg, "-y", "-v", "error", "-i", str(prepared_input), *adjusted,
                 "-ac", "1", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "5", str(final)])
            decoded = run([args.ffmpeg, "-v", "error", "-i", str(final), "-f", "f32le", "-ac", "1", "-ar", "44100", "-"])
            samples = array.array("f", decoded)
            if sys.byteorder != "little": samples.byteswap()
            peak = max(abs(x) for x in samples)
        rms = math.sqrt(sum(x*x for x in samples) / len(samples))
        if peak > 0.99 or rms < 0.0001 or len(samples) < 2205:
            raise RuntimeError(f"{name}: decoded audio failed peak/silence/duration check")
        report = {"duration": round(len(samples)/44100, 4), "peakDb": round(20*math.log10(max(peak, 1e-9)), 2),
                  "rmsDb": round(20*math.log10(max(rms, 1e-9)), 2), "bytes": final.stat().st_size,
                  "sha256": hashlib.sha256(final.read_bytes()).hexdigest(), "loop": cue["loop"]}
        reports[name] = report
        provenance[name]["prepared"] = report
        save(provenance_path, provenance)
        save(WORK / "measurements.json", reports)
        print(f"Prepared {name}: {report['duration']}s, peak {report['peakDb']} dBFS", flush=True)


if __name__ == "__main__":
    main()
