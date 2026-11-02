# SKYBREAK redesign plan: rebuild the campaign on the Ace Combat 04 reference

> **Historical document (status updated 2026-11-01).** This is the plan as drafted on 2026-10-28, kept as the record of how the 18-mission campaign was scoped. It is not current status. The owner's decisions D-011 to D-016 (`docs/human/decisions.md`, 2026-10-28) changed it before work began: the Broken Relay story was kept and condensed to 18 chapters instead of writing an original AC04-shaped story (so phase 2C and the `systems/` specs were not produced as written), and missions and worlds follow the reference procedurally. The campaign was then built roughly along phases 0 to 6, with the remaining phase-7 cleanup tracked in `docs/human/next.md`. All 18 missions and Practice have been merged and are live since 2026-10-31; see `docs/human/README.md` for status and `docs/architecture/README.md` for the code as it is now. Section 7's open questions were answered in `decisions.md`.

Status at writing: DRAFT for owner review. Nothing in this document was approved or started when it was written.
Written 2026-10-28. Reference footage: "Ace Combat 04: Shattered Skies. Full campaign [HD 1080p 60fps]" by GamePlayShare, 4 h 52 min, https://youtu.be/lO7bCwQOYUs

## 1. Goal and boundaries

**Goal.** Replace the Broken Relay campaign (27 missions, original story) with an 18-mission campaign whose mission design, pacing, maps, menus, HUD, briefings, results screens and story structure follow Ace Combat 04 as closely as the footage allows. Keep the flight model, combat and weapons the owner already likes.

**Operating facts that shape the plan.**

- The owner is the only player and only playtests in Roblox Player. Every merge to main publishes to the live place. The live place *is* the test environment.
- Saves can be wiped at any time. No migration code.
- Unfinished missions are shown locked in the menu, so main is always a playable game.
- The repo already has a video-analysis skill (`skills/video-reference-analysis/`) that defines how footage evidence is captured and reported. All footage tasks follow it.
- An earlier AC04 attempt was rejected as a whole and reverted. It lives on branch `archive/ac04-local-tree-2026-10-28`. It is prior work to read, not code to merge. Its failure mode was: whole campaign in one PR, no owner feel-check until live.

**Copyright line (becomes decision D-001).** The recording may be copied; the game it shows belongs to Bandai Namco.

| Replicate closely | Make original |
|---|---|
| Mission order, objectives, phases, enemy waves and timing | Country, city, base, squadron and character names |
| Terrain shapes, landmark layout, how each map plays | All dialogue, briefing text and story prose, written fresh |
| HUD layout, radar behaviour, lock and missile feel | Music and voice recordings |
| Menu flow, briefing structure, results and ranking layout | Logos, emblems, fonts and artwork that are the game's own |
| Pacing, difficulty curve, how each mission feels | Any image or audio taken from the footage |

Internal documents may name reference missions by their original titles for cross-reference. Nothing shipped in the game does.

## 2. Agent roles

| Role | Model (per AGENTS.md) | Does |
|---|---|---|
| Orchestrator | Astra (parent) | Owns task order, file ownership, the four human docs, merges |
| Footage analyst | Opus 5.5 | Slices video, inspects frames, writes ledger entries and specs |
| Writer | Opus 5.5 | Story outline, original mission scripts, radio lines, briefing text |
| Engine engineer | GPT-6.1 Sol / GPT-5.6 Sol | Refactors, new objective types, systems screens |
| Mission builder | GPT Sol, Opus 5.5 for parallel world work | One mission's data file, map and script at a time |
| Reviewer | GPT Sol routinely; Astra sparingly | Independent review of every PR; spec-vs-build comparison |
| Asset reviewer | Independent agent, never the creator | The mandatory Blender upload safety gate |

Rule: one agent owns one file set per task. Two agents never edit the same mission or the same screen in parallel.

## 3. Phases, tasks and review points

Each task lists: owner role, inputs, output, done-when, dependencies. "Owner review" marks where the human looks.

### Phase 0: Repo setup (one PR, no gameplay change)

| # | Task | Owner | Output | Done when |
|---|---|---|---|---|
| 0.1 | Convert `docs/human/` to Markdown: `README.md` (dashboard with 18-mission table), `shipped.md`, `next.md`, `blockers.md`, `decisions.md` | Orchestrator | Five files, four HTML files deleted | Owner can read status in under five minutes |
| 0.2 | Trim the AGENTS.md living-docs section to: the five-file table, "every PR updates affected files in the same PR", "never invent verification" | Orchestrator | AGENTS.md diff (deletions and one table) | Section under 20 lines |
| 0.3 | Create the reference folder: `reference/ac04/` gitignored, with `video/`, `frames/`, `audio/`, `transcripts/`; committed `reference/README.md` explaining layout and what may be committed (text only) | Engine engineer | Folder, `.gitignore` entry, README | Dry run: a PNG placed there is not picked up by `git status` |
| 0.4 | Point the video skill's extraction reference at the new paths; add the keyframe and scene-detect recipe | Engine engineer | `skills/video-reference-analysis/references/extraction.md` update | Commands run as written |
| 0.5 | Record D-001 (copyright line), D-002 (merge-to-live is the test loop, missions locked until ready), D-003 (saves wipe freely) in `decisions.md` | Orchestrator | Three entries | Owner has read them |
| 0.6 | Install prerequisites on the build Mac: `yt-dlp`, confirm FFmpeg, `faster-whisper` for local transcription, ~15 GB free | Engine engineer | Versions recorded in `reference/README.md` | `yt-dlp --version` works |
| 0.7 | **Owner action:** require the `validate` check on `main` in GitHub branch protection | Owner | Setting | A PR with failing validate cannot merge |

**Owner review:** skim `decisions.md`. Approve or amend D-001.

### Phase 1: Index the footage (produces the ledger, nothing else)

| # | Task | Owner | Output | Done when |
|---|---|---|---|---|
| 1.1 | Download the video at source resolution to `reference/ac04/video/`; record resolution, fps, duration, SHA-256 | Footage analyst | `reference/ac04/video/source.json` (committed? no: lives in gitignored folder; a copy of the metadata goes in the ledger) | Hash recorded |
| 1.2 | Make a 480p proxy and run FFmpeg scene-change detection; extract one keyframe per detected cut plus one frame every 10 s as a floor | Footage analyst | `reference/ac04/frames/index/` (gitignored) | Frame count and spacing recorded |
| 1.3 | Walk the keyframes and label every stretch: `title`, `menu`, `briefing`, `aircraft_select`, `cutscene`, `mission`, `debrief`, `loading`, `other`; record start and end to the second | Footage analyst (can split across 2 to 3 agents by time range) | `reference/ledger.md` (committed) | Every second of 4:52:02 is assigned to exactly one segment |
| 1.4 | Number the 18 mission segments and their attached briefing, cutscene and debrief segments; note which missions the player failed and replayed | Footage analyst | Ledger mission table | 18 missions identified with timestamps |
| 1.5 | Transcribe the audio locally; store transcripts in the gitignored folder only | Footage analyst | `reference/ac04/transcripts/` | Transcript timestamps align with the ledger within 2 s |
| 1.6 | Ledger honesty section: what was sampled, what was watched closely, what was not inspected | Footage analyst | Ledger section | Reviewer agrees it does not overstate coverage |

**Owner review:** 10 minutes on `reference/ledger.md`. Confirm the 18-mission split looks right.

### Phase 2: Specifications (the heart of the plan; most parallel)

Each spec is a committed Markdown file. Every claim cites a timestamp range. Unknowns are listed, not guessed. Dialogue is paraphrased as *function* ("wingman warns of incoming from the west"), never quoted.

**2A. Mission specs (18 tasks, one per mission, fully parallel across analysts).**

File: `docs/specs/missions/mNN.md`. Sections:

1. Reference segment timestamps (briefing, mission, debrief, cutscene if any)
2. Mission type and one-paragraph summary of how it plays
3. Objectives and phases in order; success condition; failure conditions; time limit if shown
4. Enemy roster: air and ground types, counts, arrival timing, direction, behaviour observed
5. Map: terrain character, landmarks, start position, boundaries, weather and time of day
6. Radio and story beats as functions with timestamps
7. Presentation specifics: briefing map motion, special HUD elements, results screen rank shown
8. Engine gaps: anything SKYBREAK cannot do today
9. Unknowns and assumptions

Reference mission list for cross-reference (titles are the original game's; type column is a starting hypothesis, the footage is the authority):

| # | Reference title | Expected type (verify from footage) |
|---|---|---|
| 1 | Sitting Duck | Ground strike, tutorial pacing |
| 2 | Imminent Threat | Air defence of a base |
| 3 | The Northern Eye | Radar site strike |
| 4 | Blockade | Intercept transports and escorts |
| 5 | Lifeline | Verify |
| 6 | Invincible Fleet | Naval strike |
| 7 | Deep Strike | Verify |
| 8 | Shattered Skies | Large air battle, rival squadron |
| 9 | Operation Bunker Shot | Landing support, ground targets |
| 10 | Tango Line | Verify |
| 11 | Escort | Escort transports |
| 12 | Stonehenge Offensive | Destroy giant ground cannons under their fire |
| 13 | Safe Return | Verify |
| 14 | Breaking Arrows | Verify |
| 15 | Emancipation | City liberation, mixed targets |
| 16 | Whiskey Corridor | Large ground assault |
| 17 | Siege of Farbanti | Capital siege, rival ace duel |
| 18 | Megalith | Final structure run, tunnel or interior flight |

**2B. Systems specs (7 tasks, parallel, one engine engineer or analyst each).**

| # | Spec file | Covers |
|---|---|---|
| 2B.1 | `docs/specs/systems/title-and-menus.md` | Title screen, campaign menu, option flow, transitions, timing |
| 2B.2 | `docs/specs/systems/briefing.md` | Briefing layout, map animation, text pacing, how objectives are presented |
| 2B.3 | `docs/specs/systems/aircraft-select.md` | Hangar view, stats panel, weapon select; which aircraft classes exist in the footage |
| 2B.4 | `docs/specs/systems/hud-and-radar.md` | Every HUD element, radar modes, lock-on cycle, target box behaviour, warnings |
| 2B.5 | `docs/specs/systems/results-and-ranking.md` | Debrief layout, score composition as observed, rank thresholds if inferable |
| 2B.6 | `docs/specs/systems/story-presentation.md` | How cutscenes are framed, length, still-image style, subtitle treatment |
| 2B.7 | `docs/specs/systems/engine-gap-list.md` | Union of every mission spec's gap section, deduplicated and sized |

**2C. Story (3 tasks, sequential, one writer).**

| # | Task | Output | Done when |
|---|---|---|---|
| 2C.1 | Story structure analysis: arcs, narrator device, rival squadron arc, turning points, ending, per-mission beat table | `docs/specs/story/structure.md` | Each beat has a timestamp and a stated function |
| 2C.2 | Original setting bible: two nations, war cause, places, squadrons, named characters, the rival ace, all original | `docs/specs/story/setting.md` | Reviewer confirms no reference names or lines survive |
| 2C.3 | Original scripts: per-mission briefing text, radio lines by function, interlude scenes | `docs/specs/story/scripts/mNN.md` | Each line maps to a function in 2C.1 |

**Owner review:** mission 1 spec, the HUD spec, the story structure and setting bible. These four decide the look and voice of everything after.

### Phase 3: Refactor and engine gaps (no visible gameplay change until 3.6)

| # | Task | Owner | Done when |
|---|---|---|---|
| 3.1 | One file per mission with named fields: `src/shared/missions/mNN.ts`; catalog becomes an index | Engine engineer | Existing 27 Broken Relay missions load unchanged; tests pass |
| 3.2 | Single mission runner: fold the hand-coded missions 1 and 2 rules into blueprint phase kinds; delete `MissionRules` legacy path | Engine engineer | Missions 1 and 2 play identically; one state machine |
| 3.3 | Extract phase direction from `CombatService` into `PhaseDirector`; `CombatService` keeps enemies, missiles, telemetry | Engine engineer | File under 1,000 lines; tests pass |
| 3.4 | Split `GameUI.tsx` by screen: title, campaign, briefing, aircraft select, HUD, results, cutscene | Engine engineer | No visual change; each file under 500 lines |
| 3.5 | Add Prettier and a one-time format commit; add a format check to validate | Engine engineer | Diff is whitespace only |
| 3.6 | Implement engine gaps from 2B.7 in priority order, each as its own PR with a test. Expected items (verify): giant ground weapon with timed fire, tunnel or interior flight volume with collision, naval targets with movement, mission timers shown on HUD, scripted allied aircraft, mid-mission scripted events | Engine engineer, parallel by item | Each gap closed with a Jest test and an offline contract |
| 3.7 | Fresh save epoch and campaign reset: 18 slots, locked-state menu rendering, no migration | Engine engineer | New store name; old progress ignored |

Reviewer runs a before/after playtest script on Broken Relay missions 1 to 3 for 3.1 to 3.5 to confirm no behaviour change.

**Owner review:** none required. Broken Relay should play exactly as before. Spot-check if you like.

### Phase 4: Systems screens (parallel, one agent per screen)

| # | Task | Spec | Done when |
|---|---|---|---|
| 4.1 | Title and menu flow | 2B.1 | Reviewer compares against reference frames side by side |
| 4.2 | Briefing screen with map animation | 2B.2 | Same |
| 4.3 | Aircraft select | 2B.3 | Same |
| 4.4 | HUD and radar rework | 2B.4 | Same, plus playtest script confirms lock timing unchanged |
| 4.5 | Results and ranking | 2B.5 | Same |
| 4.6 | Story interlude presentation | 2B.6 | Same |

These can merge to live before any new mission, wrapped around Broken Relay. The owner then sees the new presentation on a known game and can judge it in isolation.

**Owner review:** playtest in Roblox Player after 4.1 to 4.5 merge. This is the first feel-check and the cheapest place to redirect the visual direction.

### Phase 5: Mission 1 vertical slice

| # | Task | Owner | Done when |
|---|---|---|---|
| 5.1 | Mission 1 map: terrain, landmarks, start, boundaries, per spec | Mission builder | World report matches spec landmarks |
| 5.2 | Mission 1 data file: phases, roster, timing, radio functions | Mission builder | Offline contract test from spec passes |
| 5.3 | Mission 1 script: briefing, radio lines, opening interlude from 2C.3 | Writer | Reviewer confirms original text |
| 5.4 | Any Blender assets needed: build, independent safety review, upload | Asset pipeline + asset reviewer | Gate record filed |
| 5.5 | Independent spec-vs-build review using reference frames | Reviewer | Written comparison with timestamps |
| 5.6 | Merge: campaign switches to the new 18-mission list, mission 1 playable, 2 to 18 locked, Broken Relay content removed in this PR | Orchestrator | Live |

**Owner review:** playtest mission 1 end to end: title, briefing, select, mission, results, interlude. Feedback goes into `decisions.md` and `blockers.md`. **Nothing in phase 6 starts until this feedback is in.**

### Phase 6: Missions 2 to 18 in batches

Batches of three, three mission builders in parallel, each owning one mission's files. Each mission repeats 5.1 to 5.5. Each batch merges as one PR with the next missions unlocked.

| Batch | Missions | Note |
|---|---|---|
| A | 2, 3, 4 | Early-game pacing; small maps |
| B | 5, 6, 7 | First naval mission; first large map |
| C | 8, 9, 10 | Rival squadron introduction; largest air battle |
| D | 11, 12, 13 | Stonehenge is the first big set piece and likely the hardest engine item |
| E | 14, 15, 16 | City and corridor maps |
| F | 17, 18 | Finale: rival duel and the structure run; budget extra time |

**Owner review:** playtest after each batch. A batch is not "done" until the owner has flown it and either accepted it or logged issues.

### Phase 7: Closeout

| # | Task |
|---|---|
| 7.1 | Delete Broken Relay leftovers that survived: voice banks, campaign doc and its table check, old tests, old world layouts |
| 7.2 | Full-campaign playtest script run by an agent in Studio; owner full playthrough in Player |
| 7.3 | Update README, AGENTS.md project reference, and the five human docs to the final state |

## 4. The human docs during this work

| File | Updated when |
|---|---|
| `docs/human/README.md` | Every merge: the 18-row table (footage, spec, built, owner-tested) |
| `docs/human/shipped.md` | Every merge to main: what changed and what the owner will see |
| `docs/human/next.md` | Start of each phase and batch |
| `docs/human/blockers.md` | The moment an agent is stuck, assumes a value, or needs an owner call |
| `docs/human/decisions.md` | Every taste or model choice, with alternatives and reasoning |

Rule for agents: a PR that changes behaviour and does not update `shipped.md` and the dashboard table is incomplete.

## 5. Parallelism map

```
Phase 0 ──► Phase 1 ──► Phase 2A (18 parallel) ──┐
                   │                              ├──► Phase 5 ──► Phase 6 batches ──► Phase 7
                   ├──► Phase 2B (7 parallel) ─────┤
                   │          │                    │
                   │          └──► Phase 4 (6 parallel, after 3.4)
                   ├──► Phase 2C (sequential) ─────┘
                   │
                   └──► Phase 3.1–3.5 (sequential, can start during Phase 1)
                              └──► Phase 3.6 gaps (parallel, after 2B.7)
```

Peak parallelism is in phase 2 (up to 25 agents if usage allows; 6 to 8 at a time is realistic) and phase 6 (3 builders plus 1 reviewer).

## 6. Risks and how the plan handles them

| Risk | Mitigation |
|---|---|
| Rebuilding the rejected attempt's mistake: whole campaign lands before anyone feels it | Phase 4 and phase 5 each end in an owner playtest before further building |
| Copyright drift: names or lines leak from transcripts into shipped text | Transcripts never leave the gitignored folder; specs paraphrase function; reviewer checks every script against the setting bible |
| Footage shows one route | Specs list unknowns; builders pick reasonable values and log them in `blockers.md` as assumptions for owner correction |
| Studio-only test suite blocks agents | Phase 3 adds offline contracts for every new objective type; Studio Jest runs at batch merge |
| Agents collide on shared files | One mission per agent; screens split by file in 3.4 before phase 4 |
| Engine gaps are bigger than expected (Stonehenge, Megalith) | Gap list sized in 2B.7 before any mission is scheduled; big items start early in 3.6 |
| Usage limits on Opus/Sol | AGENTS.md rule stands: no silent provider switch; blocked work goes in `blockers.md` |

## 7. Open questions for the owner

1. **Aircraft roster.** The reference has many selectable aircraft. SKYBREAK has two original designs. Options: keep two, add a small original roster of 4 to 6 over time, or treat aircraft as out of scope. Affects 2B.3 and 4.3.
2. **Difficulty.** Match the reference's Normal, or keep SKYBREAK's Easy/Normal/Ace picker and tune Normal to the reference?
3. **Music and voice.** The reference has a full score and voice acting. Options: silent with text, generated original music via the existing audio pipeline, generated voice via the existing voice pipeline. Each needs the existing provenance rules.
4. **Mobile.** SKYBREAK is mobile-first with touch sticks. The reference is a console game. Keep touch as a first-class layout, or desktop and gamepad first?
5. **Batch size.** Three missions per batch means about six owner playtests. Fewer, larger batches mean less steering; more, smaller batches mean more of your time.
6. **Review strictness.** Should every mission PR get an Astra review, or Sol only with Astra reserved for the four key reviews (HUD, mission 1, Stonehenge, finale)?

## 8. What this plan does not do

- It does not implement anything. Every task above waits for approval.
- It does not promise the footage answers every design question. Where it is silent, agents will choose and log.
- It does not change the flight model, combat tuning or weapons unless a spec shows a reason and the owner approves it in `decisions.md`.
