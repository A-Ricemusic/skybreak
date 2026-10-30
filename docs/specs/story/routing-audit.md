# Story routing audit and 18-mission remap

Baseline: main `7d73c44c1ea44f98d03b019ea1e2df34d8c319df` (PR #147 merged), 2026-10-29. Source audit only; no Studio or Player session. D-030/D-031 remain the arc contract. D-130 replaces the 27-order routing; D-131 records voice handoff.

## What actually plays

On main only practice and M1–M3 are available. M4–M18 rows describe the code-selected chapter **if enabled**, not Player observations. On main chapters play before launch, once per slot; a seen chapter skips straight to launch on retries/replays. Practice and M1 share chapter 0. A practice-first save does not replay it on the first M1 launch. This PR adds the D-030 Q8 opening reprise only for completed M1 replays; practice replays and retries still honour seen flags. No bridge plays automatically after a mission: its result text is followed by the next selected mission's chapter. Only a won M18 automatically plays the finale.

Main routes every launch via `src/client/GameUI.tsx:283` (`max(0, mission-1)`), records that numeric ID in `src/server/CampaignService.ts:175`, and selects closing chapter `MISSION_COUNT` at `src/client/GameUI.tsx:647`. New routing uses the same numeric IDs through `chapterBeforeMission`, but the authored table now has 19 entries.

| Mission | Main before (old chapter; source line) | After this PR before | Main after win → after this PR |
|---|---|---|---|
| 0 practice | c0 A voice in the static (`src/shared/RelayStory.ts:40`) | c0 A voice in the static | Results only → results only |
| 1 | c0 A voice in the static (`src/shared/RelayStory.ts:40`) | c0 A voice in the static | Results only → results only |
| 2 | c1 The sealed case (`src/shared/RelayStory.ts:47`) | c1 The sealed case | Results only → results only |
| 3 | c2 Fox trail (`src/shared/RelayStory.ts:54`) | c2 An unlisted station | Results only → results only |
| 4 | c3 An unlisted station (`src/shared/RelayStory.ts:61`) | c3 The orchard witnesses | Results only → results only |
| 5 | c4 The orchard witnesses (`src/shared/RelayStory.ts:68`) | c4 Fuel under grain | Results only → results only |
| 6 | c5 Fuel under grain (`src/shared/RelayStory.ts:75`) | c5 Military quays | Results only → results only |
| 7 | c6 The dust courier (`src/shared/RelayStory.ts:82`) | c6 Two ridges | Results only → results only |
| 8 | c7 Varda switch (`src/shared/RelayStory.ts:88`) | c7 The loyalist window | Results only → results only |
| 9 | c8 Vulture Lead (`src/shared/RelayStory.ts:95`) | c8 The frigate ring | Results only → results only |
| 10 | c9 The plateau chain (`src/shared/RelayStory.ts:102`) | c9 Walking the storm | Results only → results only |
| 11 | c10 Two ridges (`src/shared/RelayStory.ts:109`) | c10 High crossing | Results only → results only |
| 12 | c11 The portable voice (`src/shared/RelayStory.ts:116`) | c11 Vulture Two | Results only → results only |
| 13 | c12 The staging farm (`src/shared/RelayStory.ts:122`) | c12 The evidence launch | Results only → results only |
| 14 | c13 High crossing (`src/shared/RelayStory.ts:128`) | c13 Aurora archive | Results only → results only |
| 15 | c14 The loyalist window (`src/shared/RelayStory.ts:134`) | c14 The city in darkness | Results only → results only |
| 16 | c15 Walking the storm (`src/shared/RelayStory.ts:140`) | c15 The dawn landing | Results only → results only |
| 17 | c16 Aurora archive (`src/shared/RelayStory.ts:148`) | c16 The last fracture | Results only → results only |
| 18 | c17 Vulture Two (`src/shared/RelayStory.ts:155`) | c17 Broken relay | c18 Military quays → c18 A clear frequency |

## All routing/text surfaces

- `src/shared/RelayStory.ts:38` is the only chapter catalog. `storyFor` indexes it. `reachableStoryChapters` incorrectly claimed only c0 on main; it now reports c0–2 for the three live missions. Tests cover the entire approved future map.
- `src/client/RelayCinematic.tsx:224` consumes the selected chapter; beat speaker chips use `speakerStyle`, not a second mission table. Voice durations and playback consume `Voice.Story` in the same component. No separate cutscene catalog exists.
- `src/shared/CinematicStaging.ts:103–117`: tin/tape count, orchard burn, recovered recorder, roster wipe and aurora. Burn/wipe/recorder move to c9/c5/c16; aurora remains night+relay (c13). `RelayCinematic` uses these functions. c2 is dawn in the pass; no new terrain/asset upload is included.
- `src/shared/StoryDocuments.ts:12`: all chart evidence is re-keyed to current chapter IDs. Removed tower-orders, mobile truck, staging-farm and storm-platform drops; retained the roster at c3, dead governor at c5, ORDER 0001 at c14 and coastal relay bearing at c17. No collectible/drop unlock subsystem exists beyond these evidence-shot documents.
- `src/shared/VoiceLines.ts:30,50`: display IDs remain `story.cNN.bNN`. Current exact-text cue is preferred; unchanged moved beats can use immutable `recordingId` aliases. `VoiceCues.ts` and `VoiceBanks.ts` are approved bank history, deliberately not renumbered or edited. Legacy IDs above 18 here are **audio identities**, never mission/chapter selection. `assets/voice/transcripts.json`, upload-plan and bank bytes remain unchanged.
- `src/shared/missions/m01.ts:18–20`, `m02.ts:44–46`, `m03.ts:77–79`: live briefing/debrief/failure text. M1 is unchanged. M2 debrief now leads to recovery in the pass; M3 debrief names the orchard from the radar memory. Radio instructions in live phases remain unchanged. M4–M18 on baseline are locked placeholders (`m04.ts:4` through `m18.ts:4`); their narrative UI text now comes from `StoryMissionText.ts`. Planned phase radio lives alongside it; it does not create objectives or schedule radio by itself.
- Reviewed open #149 `feat/m04-mission` briefing/debrief/failure at m04:31–33 and #148 `feat/m05-mission` at m05:152–154. Their authored M4 intercept and M5 timed-score/escape mechanics inform this text. Those branches are not merged or modified here. Their mission-file conflicts must retain their gameplay plus this PR's story text (use `MISSION_STORY_TEXT[id]`); no cherry-picking gameplay into this PR.
- `src/client/screens/BriefingScreen.tsx:190` renders `mission.briefing`. `OutcomeScreen.tsx:153,181` renders debrief/failure and generic NEXT number. `src/shared/CampaignProgress.ts:4–16` handles sequential available unlocks. No old narrative unlock strings remain in that flow. `CampaignWire.ts` iterates 0–18.
- `src/server/CampaignRepository.ts:192–207,279,342–347,613–625`: numeric `cutscenesSeen` normalization/union remains 0–18, filters legacy out-of-range data, and preserves compatible values. Existing seen c2 continues to count as seen (no forced replay or progress loss). Retired stores are untouched; `GameConfig` still selects `SkybreakCampaign18_v1`.

## Retirement boundary

The retired full story is test-only in `src/tests/legacy/LegacyStory.ts`, beside the existing retired mission fixtures. The legacy campaign suite now imports that snapshot rather than making the live story satisfy 27-order assertions. Production story chapters/documents contain no chapter IDs above 18. Explicit immutable recording aliases may still name old c19–27 and are exact-text checked.

`MissionLayouts.ts` (27 geometry compositions), `WorldPlan.ts:79` (old coast coordinates), `PhaseDirector.ts:85` (old actor labels), legacy radio cues and corresponding fixtures are compatibility engine data, not current narrative routing. They remain byte-for-byte unchanged to preserve the requested engine snapshots and legacy regression coverage. Current mission validation/release guards prevent launching old indices. Locked future mission builders must opt into their own world and actor contracts rather than reuse those old numeric meanings. This PR does not claim those retired compositions implement future worlds. `docs/broken-relay.md` is a historical 27-order design document; the approved chapter-map and this audit supersede its numbering.

## Continuity decisions and remaining checks

Mission 5 is escape, not a kill: Sera records repeating guard-channel orders, so mission 6 has dead-governor evidence without inventing a recovered aircraft recorder. The harbour traffic yields Kiro's signing key; c6 seeks the two remaining logs. The broadcast is from Varda. The orchard reprisal precedes the handwriting reveal, then Vulture Two's ejection/confession; ORDER 0001 names Rusk only before M15. Rusk abandons four wingmen at M17; M18 breaks the works and ends in his solo duel before c18.

Studio/Player verification remains pending (Studio signed out and queue busy). This PR neither starts Studio nor generates/uploads audio. Recording inventory and tooling limitations are in [voice-script.md](voice-script.md). No Blender-origin asset changes or uploads.

## Result text inventory

Main results are rendered from each mission file at the listed line; failure text is its adjacent `failure` field. Locked future missions all said “In development”. New full briefing/failure/planned-radio text lives alongside these handoffs in `StoryMissionText.ts`.

| Mission | Main win result (source) | Proposed win result |
|---|---|---|
| 0 | Checkout interrupted: six bombers are crossing the islands. Mission 1 is ready when you are. (`src/shared/missions/practice.ts:12`) | Checkout interrupted: six bombers are crossing the islands. Mission 1 is ready when you are. |
| 1 | The six bombers are down and Varda Rim's runway is clear. The quartermaster hands you a sealed case from Teal's bunk, addressed to Sera. (`src/shared/missions/m01.ts:19`) | The six bombers are down and Varda Rim's runway is clear. The quartermaster hands you a sealed case from Teal's bunk, addressed to Sera. |
| 2 | All eleven bombers are burning on their pads. The farm will not launch another raid. Sera wants to know who paid for its runway. (`src/shared/missions/m02.ts:45`) | All eleven bombers are burning on their pads. The farm will not launch another raid. The manifest points recovery toward Teal's beacons in the pass. |
| 3 | Nine domes are down and the film is home. Sera locks the gun-camera tape in her desk: the station was watching trainees, not the sky. (`src/shared/missions/m03.ts:78`) | Nine domes are down and the film is home. Sera locks the gun-camera tape in her desk: the station watched trainees, and its memory names the Teklan orchard. |
| 4 | In development (`src/shared/missions/m04.ts:4`) | The high flyers are gone. The trucks reach Varda; the lead driver's granddaughter marks the fuel works on Sera's map. |
| 5 | In development (`src/shared/missions/m05.ts:4`) | The fuel works are burning. You escaped Vulture Lead; Sera recorded his relayed orders while he hunted you. Their signatures lead to Iron Coast. |
| 6 | In development (`src/shared/missions/m06.ts:4`) | The warships and tankers are gone. Harbour traffic gives Sera Kiro's signing key. Two more station logs will prove whose hand used it. |
| 7 | In development (`src/shared/missions/m07.ts:4`) | Three stations carry one signature. Varda's island transmitter can send the proof in thirty-five seconds. |
| 8 | In development (`src/shared/missions/m08.ts:4`) | The broadcast is out. Three garrisons heard it. Two stood down and are coming ashore to join us. |
| 9 | In development (`src/shared/missions/m09.ts:4`) | The landing holds. Then the Marshal answers Varda's broadcast: the Teklan orchard burns, and his guns close the river valleys. |
| 10 | In development (`src/shared/missions/m10.ts:4`) | The river line is broken. The orchard survivors can fly out over the snowy saddle on two civilian airliners. |
| 11 | In development (`src/shared/missions/m11.ts:4`) | Both airliners are clear. Sera matches Vulture Two's checkride signature to the forged orders. He is waiting over the command array. |
| 12 | In development (`src/shared/missions/m12.ts:4`) | Vulture Two ejected and was recovered. He admits the handwriting is his. His statement and the harbour master's paper copy leave on an evidence plane. |
| 13 | In development (`src/shared/missions/m13.ts:4`) | The evidence plane is clear. The crown station holds the first order; missiles are already on their way to silence it. |
| 14 | In development (`src/shared/missions/m14.ts:4`) | Archive received. ORDER 0001: RUSK, AIR MARSHAL. Sera finally has a name for the voice holding the city. |
| 15 | In development (`src/shared/missions/m15.ts:4`) | The city hears silence for the first time since spring. Rusk addresses the trainee by his own name while parliament's column approaches the dry coast. |
| 16 | In development (`src/shared/missions/m16.ts:4`) | The column is through. Recovery reaches the upper pass and finds Teal in his aircraft, his recorder still running. The witnesses head for parliament. |
| 17 | In development (`src/shared/missions/m17.ts:4`) | The four wingmen are down. Rusk abandoned them and ran to the coastal relay works. The witnesses reach parliament; his own voice is all he has left. |
| 18 | In development (`src/shared/missions/m18.ts:4`) | Rusk is down. The relay is dark. Every harbour is listening for the trainee's voice. |
