# Decisions

Last updated: 2026-10-28.

| ID | Date | Decision | Alternatives considered | Why | Decided by | Status |
|---|---|---|---|---|---|---|
| T03 | 2026-10-27; confirmed 2026-10-28 | Preserve attitude-hold flight, prediction, controls and combat. | Replace flight first; freeze mechanics regardless of mission needs. | Owner likes the stable foundation; mission/story work builds on it. | Owner | Adopted |
| ROLLBACK-OWNER-001 | 2026-10-28 (carried-forward audit) | Restore the entire pre-AC04 release. | Keep #92 and patch individual complaints. | Owner rejected its in-flight UI, models, visual quality and feel as a whole; technical checks did not establish acceptance. | Owner | Implemented; historical rollback retained |
| DOC-03 | 2026-10-28 (carried-forward audit) | Merged gameplay is live via automatic CI/CD; owner verifies Player behaviour. | Require receipt inspection and separate Player session to report availability. | Owner release convention ties availability to merges without inventing verification; extended by D-002. | Owner | Adopted |
| REF-VIDEO-001 | 2026-10-28 (carried-forward audit) | Inspect actual frames in timestamped segments; separate observations/inferences and compare reference plus accepted baseline. | Treat links, thumbnails or functional tests as visual proof. | Earlier shortcuts failed to establish fidelity or preserved quality; use video-reference-analysis skill. | Project evidence workflow; original decider not recorded | Adopted |
| D-001 | 2026-10-28 | Copyright line: replicate structure and feel, make shipped expression original; exact boundary table below. | Copy names/dialogue/art/audio; abandon structural reference. | Preserve reference design while making original game content. | Owner (approved plan) | Adopted |
| D-002 | 2026-10-28 | Merge to main is the test loop: owner is the only player and playtests only in Roblox Player; unfinished missions show locked. | Studio-only owner testing; expose unfinished missions. | Live is the owner’s test environment; keep it playable. | Owner | Adopted |
| D-003 | 2026-10-28 | Saves wipe freely at the new campaign cutover; no migration code. | Migrate old campaign progress. | Owner permits wipes; campaign replacement does not need compatibility machinery. | Owner | Adopted |
| D-004 | 2026-10-28 | One mission at a time: build and go live, then owner reviews before the next starts. | Three-mission batches in source plan; whole-campaign release. | Get a feel-check before repeating mistakes; supersedes Phase 6 batching. | Owner | Adopted |
| D-005 | 2026-10-28 | Opus 5.5 preferred for footage analysis, writing and key reviews, but not used more than GPT-6.1 Sol; GPT-6.1 Sol handles most implementation and routine review; GPT-5.6 Sol handles contained tasks with every change audited by orchestrator. | Opus-heavy allocation; Astra for every review; unaudited contained tasks. | Balance specialist work, usage and oversight; Astra remains sparing under AGENTS.md. | Owner | Adopted |
| D-006 | 2026-10-28 | Keep the two existing original aircraft for now. | Add 4–6 original aircraft; remove aircraft selection from scope. | Keep scope on the first mission and preserve accepted models. | Phase 0 agent (requested default) | Provisional, owner may override |
| D-007 | 2026-10-28 | Keep Easy/Normal/Ace picker; tune Normal toward the reference. | Only reference Normal; preserve all current tuning unchanged. | Retain player choice while aiming for reference pacing. | Phase 0 agent (requested default) | Provisional, owner may override |
| D-008 | 2026-10-28 | Text-only story and radio with existing sound effects; no new voice recording. | Generate original music/voices; commission new recordings. | Reduce production and provenance scope while specs establish story functions. | Phase 0 agent (requested default) | Provisional, owner may override |
| D-009 | 2026-10-28 | Mobile touch stays a first-class layout. | Desktop/gamepad first; defer mobile. | Preserve SKYBREAK’s existing mobile-first controls and usability. | Phase 0 agent (requested default) | Provisional, owner may override |
| D-010 | 2026-10-28 | Store a 480p proxy plus per-mission 1080p clips because of disk space. | Store full-resolution campaign; use only low-resolution frames. | About 14 GB free prevents full-resolution retention; clips preserve detail when needed. | Phase 0 agent (requested default) | Provisional, owner may override |
| D-011 | 2026-10-28 | Keep the Broken Relay story. Missions are bent to fit it; the AC04 story is not adapted. | Write an original AC04-shaped story (the plan's phase 2C). | AC04's story can't be copied; the owner is happy with the existing one. Removes the original-story writing phase. | Owner | Adopted |
| D-012 | 2026-10-28 | Missions and worlds match AC04 as closely as possible: objectives, mission length, scoring, and the world itself (terrain, environment, landmarks), built procedurally like today's world builder. | Loose inspiration; hand-placed worlds. | The owner wants AC04's mission design and worlds; procedural building fits the current engine. Within D-001's copyright line. | Owner | Adopted |
| D-013 | 2026-10-28 | 18 missions, with the Broken Relay story condensed to 18 chapters. Each chapter is paired with the mission whose setting fits best; the mapping goes to the owner before mission 1 ships. | 27 missions (18 reference plus 9 original); 18 missions leaving unused chapters out. | Matches AC04's structure without inventing missions the footage can't inform. | Owner (accepted recommendation, 2026-10-28) | Adopted |
| D-014 | 2026-10-28 | Scoring follows the reference: points per target destroyed, with a rank threshold per mission, calibrated from the debrief screens in the footage. Unreadable values are flagged, not guessed. | Keep the current S–D formula and tune it toward reference scores. | The owner asked for matching scores; several reference missions are won by reaching a score inside a time limit. | Owner (accepted recommendation, 2026-10-28) | Adopted |
| D-015 | 2026-10-28 | Mission length: use the reference's countdown wherever it shows one; tune Normal so a typical run takes about as long as the footage player took. | Match the footage player's clear times exactly. | The footage player is skilled; exact matching would feel tight for typical play. | Owner (accepted recommendation, 2026-10-28) | Adopted |
| D-016 | 2026-10-28 | World scale: scale each world so crossing it takes the same time as in the reference, not the same distance. | Match real distances. | Our jets fly at different speeds; matching travel time keeps the pacing. | Owner (accepted recommendation, 2026-10-28) | Adopted |
| D-017 | 2026-10-28 | Ledger conventions: the recording is treated as one clean pass (no retries seen; possible edits noted, not assumed); mission time includes mid-mission landings and short in-game intros; post-victory scenes without a HUD count as cutscenes; weapon select is grouped with aircraft select; title cards with the briefing; black gaps folded into neighbours. | Count only combat time; split every screen separately. | Consistent mission lengths for D-015; matches how a player experiences each sortie. | Footage analyst (Opus 5.5) | Adopted (reviewable) |
| D-018 | 2026-10-28 | The main session agent is the owner's first mate and head of operations: the owner discusses decisions with it, and it runs and reviews all subagents. | Owner talks to individual agents. | One accountable point of contact. | Owner | Adopted |

## D-001 — Copyright line

The recording may be copied; the game it shows belongs to Bandai Namco.

| Replicate closely | Make original |
|---|---|
| Mission order, objectives, phases, enemy waves and timing | Country, city, base, squadron and character names |
| Terrain shapes, landmark layout, how each map plays | All dialogue, briefing text and story prose, written fresh |
| HUD layout, radar behaviour, lock and missile feel | Music and voice recordings |
| Menu flow, briefing structure, results and ranking layout | Logos, emblems, fonts and artwork that are the game's own |
| Pacing, difficulty curve, how each mission feels | Any image or audio taken from the footage |

Internal documents may name reference missions by their original titles for cross-reference. Nothing shipped in the game does.


The superseded AC04-specific adaptation/art/HUD/save decisions dropped with the rejected release remain historical in git, not current approvals. D-003 explicitly adopts a new cutover wipe; it does not restore the rejected release.

D-006–D-010 are defaults, not owner acceptance. Section 7's batch-size question is resolved by D-004 and model/review allocation by D-005; D-010 additionally records the disk constraint.
