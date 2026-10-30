#!/usr/bin/env python3
"""SKYBREAK voice-over pipeline: ElevenLabs lines -> processed clips -> Roblox banks.

Never uploads to Roblox and never embeds the ElevenLabs key; the key is read
privately from --key-file for the commands that call ElevenLabs.

  bun run test:offline && bun tools/voice-lines.ts      # refresh assets/voice/lines.json
  python3 tools/voice.py plan                            # dry run: reuse, new uploads, lines to generate, credits
  python3 tools/voice.py generate --key-file F --budget 25000
  python3 tools/voice.py pack                            # process, bank, cue table, transcripts
  python3 tools/voice.py stt --key-file F                # speech-to-text check of every new bank
  python3 tools/voice.py checklist                       # per-bank moderation pre-check
  python3 tools/voice.py sampler                         # one line per character
  python3 tools/voice.py legacy-import --ref origin/main # freeze the approved live banks (done once)

Every generated line is cached by sha256(voice_id + model + settings + text) in
$SKYBREAK_VOICE_CACHE (default ~/.skybreak-voice-cache), outside any worktree,
so a line is never paid for twice; editing a line only regenerates that line.

A line whose take already sits inside an approved, live bank (legacy-banks.json:
same cache key, ElevenLabs request id and raw sha256) plays from that bank's
region and is never re-uploaded (D-142). Only genuinely new takes are packed, into
small risk-ordered banks (TIERS, D-143); a tier packs only once every line in it
has a take, and until then its lines have no cue and stay silent.
"""
import argparse
import array
import concurrent.futures
import hashlib
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
# New banks stay small so a moderation rejection takes out few lines and points at them (D-143).
SMALL_BANK_LIMIT = 3.5 * 60
# Upload order, lowest moderation risk first. Upload one bank, wait for APPROVED, then the next.
TIERS = (("voiceBankN1", "lowest: tactical radio calls and landing chatter"),
         ("voiceBankN2", "medium: story chapters 9-18"),
         ("voiceBankN3", "highest: story chapters 0-8 (themes of the rejected voiceBank01)"))
LEGACY = VOICE / "legacy-banks.json"
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
    with _http.open(request, timeout=timeout) as response:
        data = response.read()
        return (data, dict(response.headers)) if raw else json.loads(data)


def subscription(key):
    data = api("GET", "/v1/user/subscription", key)
    return {"tier": data["tier"], "used": data["character_count"], "limit": data["character_limit"],
            "reset": data.get("next_character_count_reset_unix")}


# ---------------------------------------------------------------------------
# Approved live banks (reused, never re-uploaded)
# ---------------------------------------------------------------------------

def legacy_banks():
    return load_json(LEGACY, {"banks": {}})["banks"]


def legacy_takes(legacy):
    """Cache key -> (bank id, member) for every take inside an approved live bank."""
    out = {}
    for bank_id, bank in legacy.items():
        for member in bank["members"]:
            if member["cacheKey"] in out:
                raise SystemExit(f"legacy take {member['cacheKey'][:12]} appears twice")
            out[member["cacheKey"]] = (bank_id, member)
    return out


def legacy_take(line, key, takes, cached):
    """The approved region holding exactly this line's take, or None.

    The cache key covers voice, model, settings, spoken text and retake number, so
    a match is the same request. The treatment (tape) must match too, and the take
    must be the same ElevenLabs output: request id and raw sha256 agree with the
    local cache wherever the cache has them.
    """
    hit = takes.get(key)
    if not hit:
        return None
    bank_id, member = hit
    if member["tape"] != line["tape"] or member["spoken"] != line["spoken"]:
        return None
    entry = cached.get(key)
    if entry and (entry.get("requestId") != member["requestId"] or entry.get("sha256") != member["rawSha256"]):
        raise SystemExit(f"{line['id']}: cached take differs from approved legacy take {bank_id}/{member['legacyId']}")
    if raw_path(key).exists() and sha(raw_path(key)) != member["rawSha256"]:
        raise SystemExit(f"{line['id']}: raw take differs from approved legacy take {bank_id}/{member['legacyId']}")
    return bank_id, member


def tier_for(line):
    if line["kind"] == "radio":
        return TIERS[0][0]
    return TIERS[1][0] if int(line["id"].split(".")[1][1:]) >= 9 else TIERS[2][0]


def classify(cast, all_lines):
    """Split lines into reused legacy takes and new takes per upload tier."""
    cached = index()
    takes = legacy_takes(legacy_banks())
    reuse, tiers = {}, {tier: [] for tier, _ in TIERS}
    for line in all_lines:
        key = cache_key(request_for(cast, line))
        hit = legacy_take(line, key, takes, cached)
        if hit:
            reuse[line["id"]] = hit
        else:
            tiers[tier_for(line)].append((line, key))
    return reuse, tiers


def cmd_legacy_import(args):
    """Freeze the approved live banks of a git ref (their regions and take provenance)."""
    def show(path):
        return json.loads(run(["git", "-C", str(ROOT), "show", f"{args.ref}:{path}"]))
    commit = run(["git", "-C", str(ROOT), "rev-parse", args.ref]).decode().strip()
    plan, provenance = show("assets/voice/upload-plan.json"), show("assets/voice/provenance.json")["lines"]
    transcripts, uploaded = show("assets/voice/transcripts.json"), show("assets/voice/uploaded.json")
    banks = {}
    for bank in plan["banks"]:
        record = uploaded.get(bank["id"], {})
        if record.get("state") != "MODERATION_STATE_APPROVED" or record.get("sha256") != bank["sha256"]:
            continue
        members = []
        for member in bank["members"]:
            origin, line = provenance[member["id"]], transcripts[member["id"]]
            if origin["bank"] != bank["id"] or not origin.get("requestId") or not origin.get("rawSha256"):
                raise SystemExit(f"{member['id']}: incomplete provenance at {args.ref}")
            members.append({"legacyId": member["id"], "start": member["start"], "end": member["end"],
                            "cacheKey": origin["cacheKey"], "requestId": origin["requestId"], "rawSha256": origin["rawSha256"],
                            "speaker": line["speaker"], "tape": line["tape"], "spoken": line["spoken"], "text": line["text"]})
        banks[bank["id"]] = {"file": bank["file"], "sha256": bank["sha256"], "seconds": bank["seconds"],
                             "assetId": str(record["assetId"]), "state": record["state"], "approvedAt": record.get("at"),
                             "reviewer": record.get("reviewer"), "members": members}
    save_json(LEGACY, {"note": "Frozen record of moderation-approved, live voice banks. Their regions are reused, never re-uploaded. "
                               "Edit only by re-running `voice.py legacy-import` against a ref whose uploaded.json approves them.",
                       "source": {"ref": args.ref, "commit": commit}, "banks": banks})
    print(f"{len(banks)} approved banks, {sum(len(b['members']) for b in banks.values())} takes from {args.ref} ({commit[:9]})")


def pending(cast, all_lines):
    """Lines that need an ElevenLabs take: not cached and not already inside an approved live bank."""
    out = []
    seen = set()
    takes = legacy_takes(legacy_banks())
    cached = index()
    for line in all_lines:
        request = request_for(cast, line)
        key = cache_key(request)
        if key in seen or raw_path(key).exists() or legacy_take(line, key, takes, cached):
            continue
        seen.add(key)
        out.append((line, request, key))
    return out


def multiplier(cast):
    # eleven_turbo_v2_5 / eleven_flash_v2_5 bill half a credit per character on this plan.
    return {"eleven_turbo_v2_5": 0.5, "eleven_flash_v2_5": 0.5}.get(cast["model"], 1.0)


def estimate_seconds(line, key):
    """Measured processed length when cached, else a reading-speed estimate (2.6 words/s)."""
    processed = processed_path(key, line["tape"])
    if processed.exists():
        return processed.stat().st_size / 4 / RATE
    return len(line["spoken"].split()) / 2.6


def cmd_plan(args):
    cast = casting()
    all_lines = lines()
    reuse, tiers = classify(cast, all_lines)
    todo = pending(cast, all_lines)
    wanted = {line["id"] for line, _, _ in todo}
    used = sorted({bank for bank, _ in reuse.values()})
    print(f"{len(all_lines)} lines: {len(reuse)} reuse approved live takes ({', '.join(used) or 'none'}); "
          f"{sum(len(m) for m in tiers.values())} need a new upload")
    print("New banks, in upload order (one at a time; stop on any rejection):")
    for tier, risk in TIERS:
        members = tiers[tier]
        seconds = sum(estimate_seconds(l, k) + GAP for l, k in members) + GAP
        missing = [l["id"] for l, _ in members if l["id"] in wanted]
        print(f"  {tier:12} {len(members):3} lines ~{seconds:5.0f} s; {len(missing)} need generation; risk {risk}")
    chars = sum(len(r["text"]) for _, r, _ in todo)
    by = {}
    for line, request, _ in todo:
        by[line["speaker"]] = by.get(line["speaker"], 0) + len(request["text"])
    print(f"{len(todo)} lines need generation; {chars} characters "
          f"~{chars * multiplier(cast):.0f} credits with {cast['model']}")
    for speaker, count in sorted(by.items(), key=lambda x: -x[1]):
        print(f"  {speaker:14} {count:6} chars")
    for line, request, _ in todo:
        print(f"  {line['id']:22} {len(request['text']):4} chars  {line['spoken']}")


def cmd_generate(args):
    cast = casting()
    key = Path(args.key_file).read_text().strip()
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
                detail = error.read().decode()[:300]
                if error.code in (429, 500, 502, 503) and attempt < 2:
                    time.sleep(4 * (attempt + 1))
                    continue
                with lock:
                    state["failed"].append((line["id"], error.code, detail))
                return
            except (urllib.error.URLError, TimeoutError) as error:
                if attempt < 2:
                    time.sleep(4 * (attempt + 1))
                    continue
                with lock:
                    state["failed"].append((line["id"], "network", str(error)))
                return
        if not audio.startswith(b"ID3") and audio[:2] not in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
            with lock:
                state["failed"].append((line["id"], "format", audio[:80]))
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


def write_cue_table(cues, all_lines):
    out = ["// Generated by tools/voice.py pack. Do not edit: edit RelayStory/MissionCatalog, then regenerate.",
           "// Every voiced line: its bank, region (seconds), speaker, tape treatment and exact on-screen text.",
           "// Reused takes point at regions of approved live banks; new takes at the risk-ordered new banks.",
           "export interface VoiceCue { bank: string; start: number; finish: number; speaker: string; tape: boolean; radio: boolean; text: string }",
           "export const VOICE_CUES: Record<string, VoiceCue> = {"]
    for line in all_lines:
        if line["id"] not in cues:
            continue
        bank, start, end = cues[line["id"]]
        out.append(f'\t{ts_string(line["id"])}: {{ bank: "{bank}", start: {start:.3f}, finish: {end:.3f}, '
                   f'speaker: {ts_string(line["speaker"])}, tape: {str(line["tape"]).lower()}, radio: {str(line["kind"] == "radio").lower()}, '
                   f'text: {ts_string(line["text"])} }},')
    out.append("};")
    out.append("/** Scripted lines whose new take is not packed yet: no cue, so they stay silent (subtitles only). */")
    out.append("export const VOICE_PENDING: Record<string, string> = {")
    for line in all_lines:
        if line["id"] not in cues:
            out.append(f'\t{ts_string(line["id"])}: {ts_string(line["text"])},')
    out.append("};\n")
    (ROOT / "src/shared/VoiceCues.ts").write_text("\n".join(out))


def bank_asset_lines(plan, uploaded, approved_state="MODERATION_STATE_APPROVED"):
    """Bank -> asset id lines for VoiceBanks.ts: approved live banks first, then the new banks."""
    out = []
    for bank in plan.get("legacyBanks", []) + plan["banks"]:
        item = uploaded.get(bank["id"], {})
        approved = item.get("state") == approved_state and item.get("sha256") == bank["sha256"] and item.get("assetId")
        out.append(f'\t{bank["id"]}: "{"rbxassetid://" + str(item["assetId"]) if approved else ""}",')
    return out


def write_bank_assets(plan, uploaded):
    """Bank -> Roblox asset id. Empty until tools/upload-voice.py records a moderation-approved upload."""
    out = ["// Generated by tools/voice.py pack / tools/upload-voice.py. Approved Roblox audio only;",
           "// an empty id means the bank is not uploaded yet and every line in it stays silent.",
           "export const VOICE_BANK_ASSETS: Record<string, string> = {", *bank_asset_lines(plan, uploaded), "};\n"]
    (ROOT / "src/shared/VoiceBanks.ts").write_text("\n".join(out))


def pack_tier(tier, risk, members):
    """Greedy fill of one risk tier into banks under SMALL_BANK_LIMIT: voiceBankN1, voiceBankN1b, ..."""
    banks, current = [], None
    for line, key in members:
        samples = process_line(key, line["tape"])
        seconds = len(samples) / RATE
        if current is None or current["seconds"] + seconds + GAP * 2 > SMALL_BANK_LIMIT:
            suffix = "" if not banks else chr(ord("a") + len(banks))
            current = {"id": tier + suffix, "tier": tier, "risk": risk, "samples": array.array("f"), "members": [], "seconds": 0}
            banks.append(current)
        current["samples"].extend([0.0] * int(GAP * RATE))
        start = len(current["samples"]) / RATE
        current["samples"].extend(samples)
        current["members"].append({"id": line["id"], "start": start, "end": len(current["samples"]) / RATE, "cacheKey": key})
        current["seconds"] = len(current["samples"]) / RATE + GAP
    return banks


def cmd_pack(args):
    cast = casting()
    all_lines = lines()
    cached = index()
    legacy = legacy_banks()
    reuse, tiers = classify(cast, all_lines)
    banks, pending_tiers = [], {}
    for tier, risk in TIERS:
        members = tiers[tier]
        missing = [l["id"] for l, k in members if not raw_path(k).exists()]
        if missing:
            # Never pack a partial tier: its bank would change again once the rest is generated.
            pending_tiers[tier] = {"risk": risk, "lines": [l["id"] for l, _ in members], "needGeneration": missing}
            continue
        banks.extend(pack_tier(tier, risk, members))
    plan = {"version": 2, "format": "ogg/vorbis mono 44.1 kHz", "gapSeconds": GAP, "banks": [], "legacyBanks": [], "pendingTiers": pending_tiers}
    provenance = {"provider": "ElevenLabs text-to-speech", "model": cast["model"], "license": cast["license"], "lines": {}}
    cues = {}
    for order, bank in enumerate(banks, 1):
        bank["samples"].extend([0.0] * int(GAP * RATE))
        output = VOICE / (bank["id"] + ".ogg")
        encode_ogg(bank["samples"], output)
        decoded = decode(output)
        peak = max(abs(x) for x in decoded)
        if peak > 0.99:
            raise SystemExit(f"{bank['id']}: codec overshoot ({peak:.3f}); lower the limiter")
        seconds = len(decoded) / RATE
        if seconds > SMALL_BANK_LIMIT:
            raise SystemExit(f"{bank['id']}: {seconds:.1f}s is over the {SMALL_BANK_LIMIT:.0f}s small-bank limit")
        size = output.stat().st_size
        plan["banks"].append({"id": bank["id"], "file": output.name, "sha256": sha(output), "seconds": round(seconds, 3),
                              "bytes": size, "peak": round(peak, 4), "tier": bank["tier"], "risk": bank["risk"], "uploadOrder": order,
                              "members": [{"id": m["id"], "start": round(m["start"], 3), "end": round(m["end"], 3)} for m in bank["members"]]})
        for member in bank["members"]:
            entry = cached.get(member["cacheKey"], {})
            cues[member["id"]] = (bank["id"], round(member["start"], 3), round(member["end"], 3))
            provenance["lines"][member["id"]] = {"cacheKey": member["cacheKey"], "bank": bank["id"], "source": "new",
                                                 "generatedAt": entry.get("generatedAt"), "requestId": entry.get("requestId"),
                                                 "subscriptionTierAtGeneration": entry.get("subscriptionTierAtGeneration"),
                                                 "rawSha256": entry.get("sha256")}
        print(f"{bank['id']}: {len(bank['members'])} lines, {seconds / 60:.2f} min, {size / 1e6:.2f} MB, peak {peak:.3f}", flush=True)
    for bank_id, record in legacy.items():
        members = sorted(((line_id, member) for line_id, (b, member) in reuse.items() if b == bank_id), key=lambda x: x[1]["start"])
        if not members:
            continue
        path = VOICE / record["file"]
        if not path.exists() or sha(path) != record["sha256"]:
            raise SystemExit(f"{bank_id}: restore the exact approved file: git show <ref>:assets/voice/{record['file']} > {path.relative_to(ROOT)}")
        plan["legacyBanks"].append({"id": bank_id, "file": record["file"], "sha256": record["sha256"], "seconds": record["seconds"],
                                    "assetId": record["assetId"],
                                    "members": [{"id": i, "start": m["start"], "end": m["end"], "legacyId": m["legacyId"]} for i, m in members]})
        for line_id, member in members:
            cues[line_id] = (bank_id, member["start"], member["end"])
            entry = cached.get(member["cacheKey"], {})
            provenance["lines"][line_id] = {"cacheKey": member["cacheKey"], "bank": bank_id, "source": "legacy", "legacyId": member["legacyId"],
                                            "generatedAt": entry.get("generatedAt"), "requestId": member["requestId"],
                                            "subscriptionTierAtGeneration": entry.get("subscriptionTierAtGeneration"),
                                            "rawSha256": member["rawSha256"]}
    for tier, info in pending_tiers.items():
        for line, key in tiers[tier]:
            entry = cached.get(key, {})
            provenance["lines"][line["id"]] = {"cacheKey": key, "bank": None, "source": "pending", "tier": tier,
                                               "generatedAt": entry.get("generatedAt"), "requestId": entry.get("requestId"),
                                               "subscriptionTierAtGeneration": entry.get("subscriptionTierAtGeneration"),
                                               "rawSha256": entry.get("sha256")}
        print(f"{tier}: pending, {len(info['needGeneration'])} of {len(info['lines'])} lines need generation (first: {info['needGeneration'][0]})")
    print(f"legacy: {len(reuse)} lines reuse {len(plan['legacyBanks'])} approved live banks")
    keep = {b["id"] for b in plan["banks"]} | {b["id"] for b in plan["legacyBanks"]}
    for stale in VOICE.glob("voice*.ogg"):
        if stale.stem not in keep:
            stale.unlink()
    new_ids = {b["id"] for b in plan["banks"]}
    for stale in (VOICE / "checklists").glob("*.json"):
        if stale.stem not in new_ids:
            stale.unlink()
    stt = load_json(VOICE / "stt.json")
    if stt is not None:
        stt["banks"] = {k: v for k, v in stt["banks"].items() if k in new_ids}
        save_json(VOICE / "stt.json", stt)
    provenance["lines"] = {l["id"]: provenance["lines"][l["id"]] for l in all_lines}
    save_json(VOICE / "upload-plan.json", plan)
    save_json(VOICE / "provenance.json", provenance)
    transcripts = {l["id"]: {"speaker": l["speaker"], "text": l["text"], "spoken": l["spoken"], "voice": l["voice"],
                             "voiceName": cast["speakers"][l["speaker"]]["voiceName"], "tape": l["tape"],
                             "bank": cues.get(l["id"], (None,))[0], "source": provenance["lines"][l["id"]]["source"]}
                   for l in all_lines}
    save_json(VOICE / "transcripts.json", transcripts)
    write_cue_table(cues, all_lines)
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


STT_ENGINE = "ElevenLabs speech-to-text scribe_v1 (word timestamps, audio events tagged)"


def transcribe(key, path):
    boundary = uuid.uuid4().hex
    # Audio events are tagged so the checklist can fail on any non-speech sound (D-143).
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\neng\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="tag_audio_events"\r\n\r\ntrue\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="timestamps_granularity"\r\n\r\nword\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\nContent-Type: audio/ogg\r\n\r\n').encode() \
        + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    return api("POST", "/v1/speech-to-text", key, body, {"Content-Type": "multipart/form-data; boundary=" + boundary}, timeout=600)


def stt_cache_path(bank):
    return CACHE / "stt" / f"{bank['sha256']}.events.json"


def score_line(line, said, line_id, accepted):
    expected = line["text"].split(": ", 1)[-1] if line["text"] != line["spoken"] else line["text"]
    rate = max(match_rate(expected, said), match_rate(line["spoken"], said))
    row = {"rate": round(rate, 3), "heard": said, "flag": rate < 0.9}
    # Under 90 % only because of a homophone or number formatting, confirmed by reading the transcript.
    if row["flag"] and line_id in accepted:
        row["flag"], row["acceptedBecause"] = False, accepted[line_id]
    return row


def bank_check(bank, data, transcripts, accepted):
    """Per-line heard text plus the stray-token evidence the checklist gates on."""
    tokens = data.get("words", [])
    heard = [w for w in tokens if w.get("type", "word") == "word"]
    windows = [(m, m["start"] - 0.12, m["end"] + 0.12) for m in bank["members"]]
    rows = {}
    for member, low, high in windows:
        # A word belongs to the line its midpoint falls inside (lines are 0.25 s apart).
        said = " ".join(w["text"] for w in heard if low <= (w["start"] + w["end"]) / 2 <= high)
        rows[member["id"]] = score_line(transcripts[member["id"]], said, member["id"], accepted)
    # Anything that is not a spoken word (audio events, unknown types) and any word outside every line fails the bank.
    non_word = [{"type": w.get("type"), "text": w.get("text"), "start": w.get("start"), "end": w.get("end")}
                for w in tokens if w.get("type", "word") not in ("word", "spacing")]
    stray = [{"text": w["text"], "start": w["start"], "end": w["end"]} for w in heard
             if not any(low <= (w["start"] + w["end"]) / 2 <= high for _, low, high in windows)]
    flagged = [k for k, v in rows.items() if v["flag"]]
    rates = [v["rate"] for v in rows.values()]
    return {"sha256": bank["sha256"], "lines": len(rows), "meanRate": round(sum(rates) / len(rates), 4),
            "minRate": min(rates), "flagged": flagged, "acceptedUnder90": [k for k, v in rows.items() if "acceptedBecause" in v],
            "nonWordTokens": non_word, "unassignedWords": stray, "perLine": rows}


def cmd_stt_offline(args):
    """Re-score without the API: from the cached raw STT when present, else from stored heard strings."""
    plan = load_json(VOICE / "upload-plan.json")
    transcripts = load_json(VOICE / "transcripts.json")
    result = load_json(VOICE / "stt.json", {"engine": STT_ENGINE, "threshold": 0.9, "banks": {}})
    accepted = casting().get("sttAccepted", {})
    for bank in plan["banks"]:
        raw = stt_cache_path(bank)
        if raw.exists():
            result["banks"][bank["id"]] = bank_check(bank, json.loads(raw.read_text()), transcripts, accepted)
            print(f"{bank['id']}: re-scored from cached raw STT")
            continue
        check = result["banks"].get(bank["id"])
        if not check or check["sha256"] != bank["sha256"]:
            raise ValueError(f"{bank['id']}: no cached STT for this audio hash; run voice.py stt")
        rows = check["perLine"]
        if set(rows) != {m["id"] for m in bank["members"]}:
            raise ValueError(f"{bank['id']}: cached STT membership differs from upload plan")
        for id, row in rows.items():
            rows[id] = score_line(transcripts[id], row["heard"], id, accepted)
        rates = [r["rate"] for r in rows.values()]
        check.update(lines=len(rows), meanRate=round(sum(rates) / len(rates), 4), minRate=min(rates),
                     flagged=[id for id, r in rows.items() if r["flag"]],
                     acceptedUnder90=[id for id, r in rows.items() if "acceptedBecause" in r])
        print(f"{bank['id']}: {len(check['flagged'])} flagged, {len(check['acceptedUnder90'])} accepted under 90% (cached STT only)")
    result["banks"] = {k: v for k, v in result["banks"].items() if k in {b["id"] for b in plan["banks"]}}
    save_json(VOICE / "stt.json", result)


def cmd_stt(args):
    key = Path(args.key_file).read_text().strip()
    plan = load_json(VOICE / "upload-plan.json")
    transcripts = load_json(VOICE / "transcripts.json")
    accepted = casting().get("sttAccepted", {})
    result = {"engine": STT_ENGINE, "threshold": 0.9, "banks": {}}
    before = subscription(key)
    for bank in plan["banks"]:
        if args.only and bank["id"] not in args.only.split(","):
            continue
        cached = stt_cache_path(bank)
        if cached.exists():
            data = json.loads(cached.read_text())
        else:
            data = transcribe(key, VOICE / bank["file"])
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_text(json.dumps(data))
        check = bank_check(bank, data, transcripts, accepted)
        result["banks"][bank["id"]] = check
        print(f"{bank['id']}: mean {check['meanRate']:.3f}, min {check['minRate']:.3f}, {len(check['flagged'])} flagged under 90%, "
              f"{len(check['acceptedUnder90'])} accepted homophones, {len(check['nonWordTokens'])} non-word tokens, "
              f"{len(check['unassignedWords'])} words outside every line", flush=True)
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

# Heard-text lexicon (D-143). Roblox moderates its own transcript of the audio, so these run on what
# a recogniser HEARD as well as on the script: "quays" was heard as "keys" next to a manifest and a
# farm with a runway, which reads as narcotics smuggling.
# Hard failures: drug and drug-quantity slang. No acceptance possible; rewrite the line.
DRUG_TERMS = {"keys", "kilo", "kilos", "kilogram", "kilograms", "gram", "grams", "cocaine", "coke", "heroin", "meth", "dope", "weed",
              "marijuana", "cannabis", "narcotic", "narcotics", "cartel", "cartels", "fentanyl", "opium", "crack"}
# Review list: drug-adjacent words and profanity look-alikes another recogniser may mishear
# ("tankers", "frigates", "beach"). Each hit fails unless casting.json lexiconAccepted records the
# word for that line with a reason and the independent reviewer who accepted it.
LOOKALIKES = {"key", "brick", "bricks", "powder", "pills", "stash", "dealer", "dealers", "shipment", "smuggle", "smuggled", "smuggling",
              "smuggler", "smugglers", "fudge", "fork", "forking", "forked", "duck", "ducking", "ducked", "beach", "sheet", "shiitake", "bich",
              "frig", "frigs", "frigging", "frigged", "frigate", "frigates"}
LOOKALIKE_PREFIXES = ("tanker", "wank", "fuk", "fuc")
# Smuggling phrasing: fails unless the same line names a legitimate cargo (the fuel plot).
SMUGGLING = ((r"\bfarm with a runway\b|\brunway farm\b|\bairstrip\b", "clandestine airstrip"),
             (r"\b(ship|ships|shipped|shipping|send|sends|sent|carry|carries|carried|move|moves|moved)\b[^.]{0,40}\bin (drums|barrels)\b", "cargo hidden in drums"),
             (r"\bgrain drums\b", "cargo hidden in drums"))
LEGIT_CARGO = r"\b(fuel|petrol|diesel|kerosene)\b"


def lexicon_hits(text):
    """(hard hits, review words, phrase notes) for one string."""
    lower = text.lower().replace("’", "'")
    tokens = re.findall(r"[a-z0-9]+(?:'[a-z]+)?", lower)
    hard = sorted({t for t in tokens if t in DRUG_TERMS})
    review = sorted({t for t in tokens if t in LOOKALIKES or t.startswith(LOOKALIKE_PREFIXES)})
    notes = []
    for pattern, name in SMUGGLING:
        if re.search(pattern, lower):
            if re.search(LEGIT_CARGO, lower):
                notes.append(f"{name} (legitimate cargo named in the same line)")
            else:
                hard.append(f"phrase: {name}")
    return hard, review, notes


def heard_lexicon(bank, transcripts, check, accepted):
    hard, review, notes, missing = [], [], [], []
    for member in bank["members"]:
        heard = check.get("perLine", {}).get(member["id"], {}).get("heard") if check.get("sha256") == bank["sha256"] else None
        if heard is None:
            missing.append(member["id"])
            heard = ""
        script = transcripts[member["id"]]["text"]
        for source, text in (("heard", heard), ("script", script)):
            h, r, n = lexicon_hits(text)
            if h:
                hard.append({"id": member["id"], "in": source, "hits": h})
            ok = accepted.get(member["id"], {})
            waived = set(ok.get("words", [])) if ok.get("reason") and ok.get("reviewer") else set()
            if [w for w in r if w not in waived]:
                review.append({"id": member["id"], "in": source, "words": r, "accepted": sorted(waived & set(r))})
            notes.extend({"id": member["id"], "in": source, "note": x} for x in n)
    return {"pass": not hard and not review and not missing, "hardHits": hard, "unacceptedReview": review,
            "phraseNotes": notes, "linesWithoutHeardText": missing,
            "note": "Runs on the STT heard text and the script. Drug slang and unexplained smuggling phrasing cannot be waived; "
                    "look-alikes need a casting.json lexiconAccepted entry with reason and independent reviewer."}


def cmd_checklist(args):
    plan = load_json(VOICE / "upload-plan.json")
    transcripts = load_json(VOICE / "transcripts.json")
    cast = casting()
    stt = load_json(VOICE / "stt.json", {"banks": {}})
    voices = load_json(CACHE / "voices.json", {})
    lexicon_accepted = cast.get("lexiconAccepted", {})
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
        current = check.get("sha256") == bank["sha256"]
        sttok = current and not check.get("flagged")
        clean = current and "nonWordTokens" in check and "unassignedWords" in check \
            and not check["nonWordTokens"] and not check["unassignedWords"]
        checklist = {
            "bank": bank["id"], "file": bank["file"], "sha256": bank["sha256"], "seconds": bank["seconds"], "lines": len(bank["members"]),
            "tier": bank["tier"], "risk": bank["risk"], "uploadOrder": bank["uploadOrder"],
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
                "heardTextModerationLexicon": heard_lexicon(bank, transcripts, check, lexicon_accepted),
                "sttOnlySpeechInsideLineRegions": {"pass": clean, "nonWordTokens": check.get("nonWordTokens"), "unassignedWords": check.get("unassignedWords"),
                                                   "note": "Fails on any audio event or non-word token, and on any heard word outside every line's region."},
                "smallRiskOrderedBank": {"pass": bank["seconds"] <= SMALL_BANK_LIMIT, "limitSeconds": SMALL_BANK_LIMIT},
                "durationUnderRobloxLimit": {"pass": bank["seconds"] <= 390},
            },
            "transcript": [{"id": m["id"], "start": m["start"], "end": m["end"], "speaker": transcripts[m["id"]]["speaker"],
                            "text": transcripts[m["id"]]["text"],
                            "heard": check.get("perLine", {}).get(m["id"], {}).get("heard") if current else None} for m in bank["members"]],
            "humanReview": {"required": True, "approved": False, "reviewer": None,
                            "instructions": "Listen to the whole bank against this transcript; confirm every item above, then record approval in assets/voice/review.json. "
                                            "Upload this bank alone, and only after every earlier bank in uploadOrder is APPROVED."},
        }
        save_json(VOICE / "checklists" / f"{bank['id']}.json", checklist)
        ok = all(v["pass"] for v in checklist["automated"].values())
        print(f"{bank['id']}: automated checks {'PASS' if ok else 'ATTENTION'}")


def cmd_lexicon(args):
    """Print lexicon hits for the given text (or every script line), e.g. to vet a rewrite before generating it."""
    texts = [(None, " ".join(args.text))] if args.text else [(l["id"], l["text"]) for l in lines()]
    for line_id, text in texts:
        hard, review, notes = lexicon_hits(text)
        if hard or review or notes:
            print(f"{line_id or '-'}: hard={hard} review={review} notes={notes}")


def cmd_voices(args):
    """Record each cast voice's library category (premade) for the licence check."""
    key = Path(args.key_file).read_text().strip()
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
    sub.add_parser("stt-offline", help="re-score existing stt.json heard strings without API access")
    sub.add_parser("checklist")
    voices = sub.add_parser("voices")
    voices.add_argument("--key-file", required=True)
    sub.add_parser("sampler")
    legacy = sub.add_parser("legacy-import", help="freeze the approved live banks of a git ref into legacy-banks.json")
    legacy.add_argument("--ref", default="origin/main")
    lexicon = sub.add_parser("lexicon", help="run the heard-text lexicon over stored or given text, without audio")
    lexicon.add_argument("text", nargs="*")
    args = parser.parse_args()
    {"plan": cmd_plan, "generate": cmd_generate, "pack": cmd_pack, "stt": cmd_stt, "checklist": cmd_checklist,
     "voices": cmd_voices, "sampler": cmd_sampler, "stt-offline": cmd_stt_offline,
     "legacy-import": cmd_legacy_import, "lexicon": cmd_lexicon}[args.command](args)


if __name__ == "__main__":
    main()
