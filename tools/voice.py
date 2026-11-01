#!/usr/bin/env python3
"""SKYBREAK voice-over pipeline: ElevenLabs lines -> processed clips -> Roblox banks.

Never uploads to Roblox and never embeds the ElevenLabs key; the key is read
privately from --key-file for the commands that call ElevenLabs.

  bun run test:offline && bun tools/voice-lines.ts      # refresh assets/voice/lines.json
  python3 tools/voice.py plan                            # dry run: uncached lines, characters, credits
  python3 tools/voice.py generate --key-file F --budget 25000
  python3 tools/voice.py pack                            # process, bank, cue table, transcripts
  python3 tools/voice.py stt --key-file F                # speech-to-text check of every bank
  python3 tools/voice.py checklist                       # per-bank moderation pre-check
  python3 tools/voice.py sampler                         # one line per character

Every generated line is cached by sha256(voice_id + model + settings + text) in
$SKYBREAK_VOICE_CACHE (default ~/.skybreak-voice-cache), outside any worktree,
so a line is never paid for twice; editing a line only regenerates that line.
"""
import argparse
import array
import concurrent.futures
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid

import _http

ROOT = Path(__file__).resolve().parent.parent
VOICE = ROOT / "assets/voice"
CACHE = Path(os.environ.get("SKYBREAK_VOICE_CACHE", Path.home() / ".skybreak-voice-cache"))
API = "https://api.elevenlabs.io"
RATE = 44100
GAP = 0.25            # silence before every line and after the last one in a bank
BANK_LIMIT = 6.25 * 60  # Roblox allows 6.5 min per upload; keep headroom
TARGET_LUFS = -16.0
PROCESS_VERSION = "v1"  # bump when the processing chain changes (re-processes, never re-generates)
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
OGGENC = os.environ.get("OGGENC", "oggenc")


def load_json(path, fallback=None):
    return json.loads(path.read_text()) if path.exists() else fallback


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=1, ensure_ascii=False) + "\n")
    temp.replace(path)


def casting():
    return load_json(VOICE / "casting.json")


def lines():
    return load_json(VOICE / "lines.json")["lines"]


def settings_for(cast, speaker):
    settings = dict(cast["defaultSettings"])
    settings.update(cast["speakers"][speaker].get("settings", {}))
    return settings


def request_for(cast, line):
    """Everything that decides the generated audio; its hash is the cache key."""
    request = {"voice_id": line["voice"], "model_id": cast["model"], "output_format": cast["outputFormat"],
               "voice_settings": settings_for(cast, line["speaker"]), "text": line["spoken"]}
    # A retake (after a failed listening or speech-to-text check) is a new cache entry; the old take stays cached.
    take = cast.get("retakes", {}).get(line["id"])
    if take:
        request["take"] = take
    return request


def cache_key(request):
    return hashlib.sha256(json.dumps(request, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def raw_path(key):
    return CACHE / "raw" / (key + ".mp3")


def index():
    return load_json(CACHE / "index.json", {})


_index_lock = threading.Lock()


def record_index(key, entry):
    with _index_lock:
        data = index()
        data[key] = entry
        save_json(CACHE / "index.json", data)


def api(method, path, key, body=None, headers=None, timeout=120, raw=False):
    request = urllib.request.Request(API + path, data=body, method=method,
                                     headers={"xi-api-key": key, **(headers or {})})
    try:
        with _http.open(request, timeout=timeout) as response:
            data = response.read()
            return (data, dict(response.headers)) if raw else json.loads(data)
    except urllib.error.HTTPError:
        raise  # open() already strips remote error text; callers need retry status.
    except (OSError, http.client.HTTPException, ValueError):
        raise _http.HTTPFailure("Audio response failed") from None


def subscription(key):
    data = api("GET", "/v1/user/subscription", key)
    return {"tier": data["tier"], "used": data["character_count"], "limit": data["character_limit"],
            "reset": data.get("next_character_count_reset_unix")}


def pending(cast, all_lines):
    out = []
    seen = set()
    for line in all_lines:
        request = request_for(cast, line)
        key = cache_key(request)
        if key in seen or raw_path(key).exists():
            continue
        seen.add(key)
        out.append((line, request, key))
    return out


def multiplier(cast):
    # eleven_turbo_v2_5 / eleven_flash_v2_5 bill half a credit per character on this plan.
    return {"eleven_turbo_v2_5": 0.5, "eleven_flash_v2_5": 0.5}.get(cast["model"], 1.0)


def cmd_plan(args):
    cast = casting()
    all_lines = lines()
    todo = pending(cast, all_lines)
    chars = sum(len(r["text"]) for _, r, _ in todo)
    by = {}
    for line, request, _ in todo:
        by[line["speaker"]] = by.get(line["speaker"], 0) + len(request["text"])
    print(f"{len(all_lines)} lines; {len(todo)} need generation; {chars} characters "
          f"~{chars * multiplier(cast):.0f} credits with {cast['model']}")
    for speaker, count in sorted(by.items(), key=lambda x: -x[1]):
        print(f"  {speaker:14} {count:6} chars")


def cmd_generate(args):
    cast = casting()
    key = _http.read_key_file(Path(args.key_file))
    todo = pending(cast, lines())
    if args.only:
        wanted = set(args.only.split(","))
        todo = [t for t in todo if t[0]["id"] in wanted]
    if args.limit:
        todo = todo[:args.limit]
    ledger_path = CACHE / "ledger.json"
    ledger = load_json(ledger_path, None)
    before = subscription(key)
    if ledger is None:
        ledger = {"baselineUsed": before["used"], "baselineAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "runs": []}
        save_json(ledger_path, ledger)
    spent = before["used"] - ledger["baselineUsed"]
    estimate = sum(len(r["text"]) for _, r, _ in todo) * multiplier(cast)
    print(f"Subscription {before['tier']}: {before['used']}/{before['limit']} used; {spent} spent by this pipeline; "
          f"{len(todo)} lines ~{estimate:.0f} credits; budget {args.budget}")
    if spent + estimate > args.budget:
        raise SystemExit("Refusing: this run would exceed the credit budget")
    if before["limit"] - before["used"] < estimate:
        raise SystemExit("Refusing: not enough credits left on the subscription")
    if before["tier"] in (None, "free"):
        raise SystemExit("Refusing: free-tier output is not licensed for commercial use")
    lock = threading.Lock()
    state = {"done": 0, "failed": []}

    def one(item):
        line, request, ckey = item
        body = json.dumps({"text": request["text"], "model_id": request["model_id"],
                           "voice_settings": request["voice_settings"]}).encode()
        path = f"/v1/text-to-speech/{request['voice_id']}?output_format={request['output_format']}"
        for attempt in range(3):
            try:
                audio, headers = api("POST", path, key, body, {"Content-Type": "application/json", "Accept": "audio/mpeg"}, raw=True)
                break
            except urllib.error.HTTPError as error:
                error.close()
                detail = "HTTP request failed"
                if error.code in (429, 500, 502, 503) and attempt < 2:
                    time.sleep(4 * (attempt + 1))
                    continue
                with lock:
                    state["failed"].append((line["id"], error.code, detail))
                return
            except (urllib.error.URLError, TimeoutError, _http.HTTPFailure):
                if attempt < 2:
                    time.sleep(4 * (attempt + 1))
                    continue
                with lock:
                    state["failed"].append((line["id"], "network", "HTTP transport failed"))
                return
        if not audio.startswith(b"ID3") and audio[:2] not in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
            with lock:
                state["failed"].append((line["id"], "format", "Invalid audio response"))
            return
        target = raw_path(ckey)
        target.parent.mkdir(parents=True, exist_ok=True)
        temp = target.with_suffix(".part")
        temp.write_bytes(audio)
        temp.replace(target)
        record_index(ckey, {"request": request, "firstLineId": line["id"], "speaker": line["speaker"],
                            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "subscriptionTierAtGeneration": before["tier"],
                            "requestId": headers.get("request-id") or headers.get("Request-Id"),
                            "characterCost": headers.get("character-cost") or headers.get("Character-Cost"),
                            "sha256": hashlib.sha256(audio).hexdigest()})
        with lock:
            state["done"] += 1
            if state["done"] % 25 == 0:
                print(f"  {state['done']}/{len(todo)} generated", flush=True)

    # Starter allows a few concurrent requests; re-check real spend between chunks.
    for start in range(0, len(todo), 60):
        chunk = todo[start:start + 60]
        now = subscription(key)
        spent = now["used"] - ledger["baselineUsed"]
        if spent + sum(len(r["text"]) for _, r, _ in chunk) * multiplier(cast) > args.budget:
            print("Stopping: next chunk would exceed the budget")
            break
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(one, chunk))
        if state["failed"]:
            break
    after = subscription(key)
    ledger["runs"].append({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "before": before["used"],
                           "after": after["used"], "generated": state["done"], "failed": len(state["failed"])})
    save_json(ledger_path, ledger)
    print(f"Generated {state['done']} lines; subscription {before['used']} -> {after['used']} "
          f"({after['used'] - before['used']} this run, {after['used'] - ledger['baselineUsed']} total for the pipeline)")
    for failure in state["failed"]:
        print("  FAILED", failure)
    if state["failed"]:
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# Processing
# ---------------------------------------------------------------------------

def run(command, data=None):
    return subprocess.run(command, input=data, capture_output=True, check=True).stdout


def decode(path):
    return array.array("f", run([FFMPEG, "-v", "error", "-i", str(path), "-ar", str(RATE), "-ac", "1", "-f", "f32le", "-"]))


def tape_chain():
    # Old cassette on a desk recorder: narrow band, slight wow, soft saturation, faint hiss.
    return ("highpass=f=200,lowpass=f=5200,vibrato=f=0.6:d=0.025,asoftclip=type=tanh,"
            "aecho=0.8:0.5:14:0.12[v];anoisesrc=color=pink:sample_rate=44100:amplitude=0.0025,highpass=f=1200[n];"
            "[v][n]amix=inputs=2:duration=first:normalize=0")


def processed_path(key, tape):
    return CACHE / "processed" / f"{key}-{PROCESS_VERSION}{'-tape' if tape else ''}.f32"


def process_line(key, tape):
    """Raw mp3 -> trimmed, (tape), loudness-normalised mono float32 at 44.1 kHz."""
    out = processed_path(key, tape)
    if out.exists():
        return array.array("f", out.read_bytes())
    trim = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,"
            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse")
    chain = f"[0:a]{trim},aresample={RATE}," + (tape_chain() if tape else "anull")
    shaped = run([FFMPEG, "-v", "error", "-i", str(raw_path(key)), "-filter_complex", chain,
                  "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"])
    # Two steps: measure integrated loudness, then a linear gain plus a true-peak limiter.
    measured = subprocess.run([FFMPEG, "-hide_banner", "-f", "f32le", "-ar", str(RATE), "-ac", "1", "-i", "pipe:0",
                               "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                              input=shaped, capture_output=True, check=True).stderr.decode()
    stats = json.loads(measured[measured.rindex("{"):measured.rindex("}") + 1])
    gain = TARGET_LUFS - float(stats["input_i"]) if stats["input_i"] not in ("-inf", "inf") else 0
    final = run([FFMPEG, "-v", "error", "-f", "f32le", "-ar", str(RATE), "-ac", "1", "-i", "pipe:0",
                 "-af", f"volume={gain:.2f}dB,alimiter=limit=0.84:level=disabled,afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse",
                 "-f", "f32le", "-"], shaped)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(final)
    return array.array("f", final)


def encode_ogg(samples, output):
    # oggenc (vorbis-tools): Homebrew's ffmpeg ships without libvorbis.
    wav = run([FFMPEG, "-v", "error", "-f", "f32le", "-ar", str(RATE), "-ac", "1", "-i", "pipe:0", "-c:a", "pcm_s16le", "-f", "wav", "-"],
              samples.tobytes())
    run([OGGENC, "--quiet", "-q", "4", "--serial", "1", "-o", str(output), "-"], wav)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ts_string(text):
    return json.dumps(text, ensure_ascii=False)


def write_cue_table(plan, all_lines):
    by_id = {l["id"]: l for l in all_lines}
    out = ["// Generated by tools/voice.py pack. Do not edit: edit RelayStory/MissionCatalog, then regenerate.",
           "// Every voiced line: its bank, region (seconds), speaker, tape treatment and exact on-screen text.",
           "export interface VoiceCue { bank: string; start: number; finish: number; speaker: string; tape: boolean; radio: boolean; text: string }",
           "export const VOICE_CUES: Record<string, VoiceCue> = {"]
    for bank in plan["banks"]:
        for member in bank["members"]:
            line = by_id[member["id"]]
            out.append(f'\t{ts_string(line["id"])}: {{ bank: "{bank["id"]}", start: {member["start"]:.3f}, finish: {member["end"]:.3f}, '
                       f'speaker: {ts_string(line["speaker"])}, tape: {str(line["tape"]).lower()}, radio: {str(line["kind"] == "radio").lower()}, '
                       f'text: {ts_string(line["text"])} }},')
    out.append("};\n")
    (ROOT / "src/shared/VoiceCues.ts").write_text("\n".join(out))


def write_bank_assets(plan, uploaded):
    """Bank -> Roblox asset id. Empty until tools/upload-voice.py records a moderation-approved upload."""
    out = ["// Generated by tools/voice.py pack / tools/upload-voice.py. Approved Roblox audio only;",
           "// an empty id means the bank is not uploaded yet and every line in it stays silent.",
           "export const VOICE_BANK_ASSETS: Record<string, string> = {"]
    for bank in plan["banks"]:
        item = uploaded.get(bank["id"], {})
        approved = item.get("state") == "MODERATION_STATE_APPROVED" and item.get("sha256") == bank["sha256"] and item.get("assetId")
        out.append(f'\t{bank["id"]}: "{"rbxassetid://" + str(item["assetId"]) if approved else ""}",')
    out.append("};\n")
    (ROOT / "src/shared/VoiceBanks.ts").write_text("\n".join(out))


def cmd_pack(args):
    cast = casting()
    all_lines = lines()
    missing = [l["id"] for l in all_lines if not raw_path(cache_key(request_for(cast, l))).exists()]
    if missing:
        raise SystemExit(f"{len(missing)} lines not generated yet (first: {missing[0]}); run generate")
    cached = index()
    banks = []
    # Story in chapter order, then radio in mission order, filled greedily: fewest uploads.
    current = None
    for line in all_lines:
        key = cache_key(request_for(cast, line))
        samples = process_line(key, line["tape"])
        seconds = len(samples) / RATE
        if current is None or current["seconds"] + seconds + GAP * 2 > BANK_LIMIT:
            current = {"id": f"voiceBank{len(banks) + 1:02}", "samples": array.array("f"), "members": [], "seconds": 0}
            banks.append(current)
        current["samples"].extend([0.0] * int(GAP * RATE))
        start = len(current["samples"]) / RATE
        current["samples"].extend(samples)
        current["members"].append({"id": line["id"], "start": start, "end": len(current["samples"]) / RATE, "cacheKey": key})
        current["seconds"] = len(current["samples"]) / RATE + GAP
    plan = {"version": 1, "format": "ogg/vorbis mono 44.1 kHz", "gapSeconds": GAP, "banks": []}
    provenance = {"provider": "ElevenLabs text-to-speech", "model": cast["model"], "license": cast["license"], "lines": {}}
    for bank in banks:
        bank["samples"].extend([0.0] * int(GAP * RATE))
        output = VOICE / (bank["id"] + ".ogg")
        encode_ogg(bank["samples"], output)
        decoded = decode(output)
        peak = max(abs(x) for x in decoded)
        if peak > 0.99:
            raise SystemExit(f"{bank['id']}: codec overshoot ({peak:.3f}); lower the limiter")
        seconds = len(decoded) / RATE
        if seconds > 6.5 * 60:
            raise SystemExit(f"{bank['id']}: {seconds:.1f}s is over the 6.5 minute Roblox limit")
        size = output.stat().st_size
        plan["banks"].append({"id": bank["id"], "file": output.name, "sha256": sha(output), "seconds": round(seconds, 3),
                              "bytes": size, "peak": round(peak, 4),
                              "members": [{"id": m["id"], "start": round(m["start"], 3), "end": round(m["end"], 3)} for m in bank["members"]]})
        for member in bank["members"]:
            entry = cached.get(member["cacheKey"], {})
            provenance["lines"][member["id"]] = {"cacheKey": member["cacheKey"], "bank": bank["id"],
                                                 "generatedAt": entry.get("generatedAt"), "requestId": entry.get("requestId"),
                                                 "subscriptionTierAtGeneration": entry.get("subscriptionTierAtGeneration"),
                                                 "rawSha256": entry.get("sha256")}
        print(f"{bank['id']}: {len(bank['members'])} lines, {seconds / 60:.2f} min, {size / 1e6:.2f} MB, peak {peak:.3f}", flush=True)
    for stale in VOICE.glob("voice*.ogg"):
        if stale.stem not in {b["id"] for b in banks}:
            stale.unlink()
    save_json(VOICE / "upload-plan.json", plan)
    save_json(VOICE / "provenance.json", provenance)
    by_bank = {m["id"]: b["id"] for b in plan["banks"] for m in b["members"]}
    transcripts = {l["id"]: {"speaker": l["speaker"], "text": l["text"], "spoken": l["spoken"], "voice": l["voice"],
                             "voiceName": cast["speakers"][l["speaker"]]["voiceName"], "tape": l["tape"], "bank": by_bank[l["id"]]}
                   for l in all_lines}
    save_json(VOICE / "transcripts.json", transcripts)
    write_cue_table(plan, all_lines)
    write_bank_assets(plan, load_json(VOICE / "uploaded.json", {}))


# ---------------------------------------------------------------------------
# Speech-to-text verification
# ---------------------------------------------------------------------------

NUMBERS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
           "8": "eight", "9": "nine", "10": "ten", "12": "twelve", "20": "twenty", "100": "hundred"}


SPELLING = {"harbour": "harbor", "harbours": "harbors", "colour": "color", "armoured": "armored", "defence": "defense"}


def words(text):
    # Spelling-insensitive: apostrophes dropped ("truck's" = "trucks"), British = American spelling, digits as words.
    text = text.lower().replace("’", "").replace("'", "").replace("-", " ")
    return [SPELLING.get(NUMBERS.get(token, token), NUMBERS.get(token, token)) for token in re.findall(r"[a-z0-9]+", text)]


def match_rate(expected, heard):
    """Share of expected words found in order in what the recogniser heard (LCS recall)."""
    a, b = words(expected), words(heard)
    if not a:
        return 1.0
    previous = [0] * (len(b) + 1)
    for x in a:
        row = [0]
        for j, y in enumerate(b):
            row.append(previous[j] + 1 if x == y else max(previous[j + 1], row[j]))
        previous = row
    return previous[-1] / len(a)


def transcribe(key, path):
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\neng\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="tag_audio_events"\r\n\r\nfalse\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="timestamps_granularity"\r\n\r\nword\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\nContent-Type: audio/ogg\r\n\r\n').encode() \
        + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    return api("POST", "/v1/speech-to-text", key, body, {"Content-Type": "multipart/form-data; boundary=" + boundary}, timeout=600)


def cmd_stt(args):
    key = _http.read_key_file(Path(args.key_file))
    plan = load_json(VOICE / "upload-plan.json")
    transcripts = load_json(VOICE / "transcripts.json")
    store = CACHE / "stt"
    accepted = casting().get("sttAccepted", {})
    result = {"engine": "ElevenLabs speech-to-text scribe_v1 (word timestamps)", "threshold": 0.9, "banks": {}}
    before = subscription(key)
    for bank in plan["banks"]:
        if args.only and bank["id"] not in args.only.split(","):
            continue
        cached = store / f"{bank['sha256']}.json"
        if cached.exists():
            data = json.loads(cached.read_text())
        else:
            data = transcribe(key, VOICE / bank["file"])
            store.mkdir(parents=True, exist_ok=True)
            cached.write_text(json.dumps(data))
        heard = [w for w in data.get("words", []) if w.get("type", "word") == "word"]
        rows = {}
        for member in bank["members"]:
            # A word belongs to the line its midpoint falls inside (lines are 0.25 s apart).
            said = " ".join(w["text"] for w in heard
                            if member["start"] - 0.12 <= (w["start"] + w["end"]) / 2 <= member["end"] + 0.12)
            line = transcripts[member["id"]]
            rate = max(match_rate(line["text"].split(": ", 1)[-1] if line["text"] != line["spoken"] else line["text"], said),
                       match_rate(line["spoken"], said))
            row = {"rate": round(rate, 3), "heard": said, "flag": rate < 0.9}
            # Under 90 % only because of a homophone or number formatting, confirmed by reading the transcript.
            if row["flag"] and member["id"] in accepted:
                row["flag"], row["acceptedBecause"] = False, accepted[member["id"]]
            rows[member["id"]] = row
        flagged = [k for k, v in rows.items() if v["flag"]]
        rates = [v["rate"] for v in rows.values()]
        result["banks"][bank["id"]] = {"sha256": bank["sha256"], "lines": len(rows), "meanRate": round(sum(rates) / len(rates), 4),
                                       "minRate": min(rates), "flagged": flagged,
                                       "acceptedUnder90": [k for k, v in rows.items() if "acceptedBecause" in v], "perLine": rows}
        print(f"{bank['id']}: mean {sum(rates) / len(rates):.3f}, min {min(rates):.3f}, {len(flagged)} flagged under 90%, "
              f"{len(result['banks'][bank['id']]['acceptedUnder90'])} accepted homophones", flush=True)
    after = subscription(key)
    result["creditsBefore"], result["creditsAfter"] = before["used"], after["used"]
    previous = load_json(VOICE / "stt.json", {"banks": {}})
    previous["banks"].update(result["banks"])
    current = {b["id"] for b in plan["banks"]}
    result["banks"] = {k: v for k, v in previous["banks"].items() if k in current}
    save_json(VOICE / "stt.json", result)
    print(f"STT subscription usage {before['used']} -> {after['used']}")


# ---------------------------------------------------------------------------
# Moderation pre-check
# ---------------------------------------------------------------------------

# Coarse automated screens; the independent reviewer still reads every transcript.
PROFANITY = {"fuck", "shit", "bitch", "bastard", "damn", "hell", "crap", "piss", "dick", "cock", "ass", "arse", "bloody", "slut", "whore", "goddamn", "jesus", "christ"}
SEXUAL = {"sex", "sexy", "naked", "nude", "kiss", "bed", "breast"}
REAL_WORLD = {"nato", "usaf", "raf", "usa", "america", "american", "russia", "russian", "china", "chinese", "ukraine", "israel", "gaza", "iran",
              "korea", "taliban", "isis", "nazi", "hitler", "putin", "biden", "trump", "obama", "kremlin", "pentagon", "f-16", "f16", "f-35", "mig", "sukhoi",
              "boeing", "lockheed", "london", "paris", "moscow", "washington", "europe", "africa", "asia", "un", "congress", "senate", "democrat", "republican"}
GORE = {"blood", "bleeding", "gore", "guts", "corpse", "torture", "behead", "suicide", "kill yourself"}


def cmd_checklist(args):
    plan = load_json(VOICE / "upload-plan.json")
    transcripts = load_json(VOICE / "transcripts.json")
    cast = casting()
    stt = load_json(VOICE / "stt.json", {"banks": {}})
    voices = load_json(CACHE / "voices.json", {})
    for bank in plan["banks"]:
        hits = {"profanity": [], "sexual": [], "realWorld": [], "gore": []}
        for member in bank["members"]:
            # Apostrophes kept here ("He'll" is not "hell"); the pronoun "us" is not the country, so "usa" is listed instead.
            tokens = set(re.findall(r"[a-z0-9]+(?:['’][a-z]+)?", transcripts[member["id"]]["text"].lower()))
            for name, table in (("profanity", PROFANITY), ("sexual", SEXUAL), ("realWorld", REAL_WORLD), ("gore", GORE)):
                found = sorted(tokens & table)
                if found:
                    hits[name].append({"id": member["id"], "words": found})
        used = sorted({transcripts[m["id"]]["voice"] for m in bank["members"]})
        premade = all(voices.get(v) == "premade" for v in used) if voices else None
        check = stt["banks"].get(bank["id"], {})
        sttok = check.get("sha256") == bank["sha256"] and not check.get("flagged")
        checklist = {
            "bank": bank["id"], "file": bank["file"], "sha256": bank["sha256"], "seconds": bank["seconds"], "lines": len(bank["members"]),
            "automated": {
                "noProfanityOrSlurs": {"pass": not hits["profanity"], "hits": hits["profanity"]},
                "noSexualContent": {"pass": not hits["sexual"], "hits": hits["sexual"]},
                "noRealNamesOrRealWorldPoliticalMilitaryReferences": {"pass": not hits["realWorld"], "hits": hits["realWorld"],
                                                                      "note": "Fictional setting only: Varda Rim, Iron Coast, Teklan farmers, Air Marshal Rusk; no real places, forces, aircraft or people."},
                "pg13CombatOnly": {"pass": not hits["gore"], "hits": hits["gore"], "note": "Aerial combat and sabotage only; no gore, torture or self-harm."},
                "premadeVoicesWithCommercialLicence": {"pass": premade, "voices": {v: voices.get(v, "unchecked") for v in used},
                                                       "note": cast["license"]},
                "noImitationOfRealPeopleOrKnownCharacters": {"pass": premade, "note": "ElevenLabs library premades only; no cloning, no voice design prompts naming people."},
                "speechToTextMatch": {"pass": sttok, "meanRate": check.get("meanRate"), "minRate": check.get("minRate"), "flagged": check.get("flagged")},
                "durationUnderRobloxLimit": {"pass": bank["seconds"] <= 390},
            },
            "transcript": [{"id": m["id"], "start": m["start"], "end": m["end"], "speaker": transcripts[m["id"]]["speaker"],
                            "text": transcripts[m["id"]]["text"]} for m in bank["members"]],
            "humanReview": {"required": True, "approved": False, "reviewer": None,
                            "instructions": "Listen to the whole bank against this transcript; confirm every item above, then record approval in assets/voice/review.json."},
        }
        save_json(VOICE / "checklists" / f"{bank['id']}.json", checklist)
        ok = all(v["pass"] for v in checklist["automated"].values())
        print(f"{bank['id']}: automated checks {'PASS' if ok else 'ATTENTION'}")


def cmd_voices(args):
    """Record each cast voice's library category (premade) for the licence check."""
    key = _http.read_key_file(Path(args.key_file))
    data = api("GET", "/v1/voices", key)
    category = {v["voice_id"]: v.get("category") for v in data["voices"]}
    cast = casting()
    result = {s["voice"]: category.get(s["voice"]) for s in cast["speakers"].values()}
    save_json(CACHE / "voices.json", result)
    print(result)


def cmd_sampler(args):
    cast = casting()
    all_lines = lines()
    picks = []
    for speaker in cast["speakers"]:
        options = [l for l in all_lines if l["speaker"] == speaker and raw_path(cache_key(request_for(cast, l))).exists()]
        if not options:
            continue
        # A mid-length line says more about the voice than the shortest one.
        options.sort(key=lambda l: abs(len(l["spoken"]) - 70))
        picks.append(options[0])
    samples = array.array("f")
    listing = []
    for line in picks:
        clip = process_line(cache_key(request_for(cast, line)), line["tape"])
        samples.extend([0.0] * int(0.5 * RATE))
        listing.append({"speaker": line["speaker"], "voice": cast["speakers"][line["speaker"]]["voiceName"], "id": line["id"],
                        "start": round(len(samples) / RATE, 2), "text": line["text"]})
        samples.extend(clip)
    samples.extend([0.0] * int(0.5 * RATE))
    output = VOICE / "sampler.mp3"
    run([FFMPEG, "-y", "-v", "error", "-f", "f32le", "-ar", str(RATE), "-ac", "1", "-i", "pipe:0", "-c:a", "libmp3lame", "-b:a", "96k", str(output)], samples.tobytes())
    save_json(VOICE / "sampler.json", listing)
    print(f"{output.relative_to(ROOT)}: {len(picks)} voices, {len(samples) / RATE:.1f}s")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("plan")
    generate = sub.add_parser("generate")
    generate.add_argument("--key-file", required=True)
    generate.add_argument("--budget", type=float, required=True, help="maximum credits this pipeline may ever spend (ledger in the cache)")
    generate.add_argument("--only", help="comma-separated line ids")
    generate.add_argument("--limit", type=int)
    sub.add_parser("pack")
    stt = sub.add_parser("stt")
    stt.add_argument("--key-file", required=True)
    stt.add_argument("--only")
    sub.add_parser("checklist")
    voices = sub.add_parser("voices")
    voices.add_argument("--key-file", required=True)
    sub.add_parser("sampler")
    args = parser.parse_args()
    {"plan": cmd_plan, "generate": cmd_generate, "pack": cmd_pack, "stt": cmd_stt, "checklist": cmd_checklist,
     "voices": cmd_voices, "sampler": cmd_sampler}[args.command](args)


if __name__ == "__main__":
    main()
