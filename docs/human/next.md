# Next

Last updated: 2026-10-30.

Audio policy (D-142): continue the story in subtitles beyond existing approved voices; changed lines stay silent. No further audio uploads. Any cause investigation must remain offline using the [preserved case file](../qa/audio-rejections/2026-10-30-voicebank01.md).

## Engine batch D2 — stacked implementation

D2 is implemented on `feat/engine-batch-d2`, based on D1 / [#165](https://github.com/A-Ricemusic/skybreak/pull/165); it is unmerged and activates no mission. Rebase onto main after D1 merges; preserve both main’s nose-first targeting/`launchId` changes (#157) and D2’s naval imports, special-launch behavior and `retiredGroundIds` when resolving overlapping edits. It adds opt-in firing SAMs, naval classes and independent deck mounts, once-only hull/mount credit, six-second sinking, moving surface routes and a hull-only sea-skimming XLAA fit. Procedural harbour targets need no uploads or new audio. Decisions D-190–D-193 describe the provisional rules. Frozen install, build and the full offline validation gate passed (785 Luau contracts, catalog snapshots and 122 Python checks). Nine D2 Roblox runtime specs compile but were not executed: the shared Studio remained occupied; no Player test is claimed.

Independent review of #168 at `20d21ec` approved with nits (orchestrator reports live parity confirmed). Follow-up fixes combine SAM warmups/in-flight missiles into a difficulty-scaled cap, validate initial route yaw, remove per-step collection allocation, use short look-ahead sea-skimming guidance, and explain hull-only refusals. Added coverage includes sinking/credit and retired-group integration, SAM saturation, hull-only special admission and scenery obstruction. Updated-head Roblox tests are still unexecuted while Studio is occupied; the reported parity observation belongs to the earlier head.

Before M6 activation: author the roster/score roles and finite stocks, resolve or explicitly document provisional counts and ranks, fit `armament.antiShip` if wanted, and author per-target health/routes/mount ownership/SAM opt-ins. Exercise these in Studio and compare the assembled harbour, ship motion, weapon trajectory, warnings and service sequence in Player; phone performance remains unmeasured. Existing score-at-expiry and damage-preserving rearm need no D2 changes. Area attack belongs to D3/M7; weapon selection at rearm and separate service clocks remain F24/D11 in the accepted engine plan.

## Mission 2 beta test — start here

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). Mission 2 is live through the automatic pipeline and unlocks after you finish mission 1 on the same save. Agents have not performed a Roblox Player test.

1. **Reach it.** Finish mission 1 at any rank. Mission 2's tile should read NEXT. The chapter "The sealed case" plays once before the briefing "NO ANIMALS".
2. **Fly north.** You start in the air about 470 studs up with three LANTERN wingmen and a 15:00 countdown. Follow the red-and-white power line for about two minutes to the "farm" airfield.
3. **Destroy eleven parked bombers.** Each is a red TGT; the mission ends when the last bomber is destroyed. No landing is required. The substation under the power line, seven hangars, four firing AA guns and the control tower are optional points.
4. **Watch the air.** Two fighters meet you head-on around 35 seconds, two rise from the base as you approach, and one scrambles from the runway. The ace HARROW SIX arrives after four bombers; two more fighters arrive from the west valley after six.
5. **Use missiles or 4AAM.** There are no bombs and, despite earlier wording here, no player gun in mission 2 (D-150). The 4AAM salvo can hit four targets per press and suits the parked rows.
6. **Check scoring and persistence.** Bombers are 120 each; hangars 50; AA guns 20; tower and substation 100 each; fighters 60; ace 240. S ≥ 2,200, A ≥ 1,750, B ≥ 1,500, C ≥ 1,320. Everything destroyed totals 2,610. Afterward, confirm mission 1's saved score breakdown still appears through replays and a save reload.

Most useful feedback: whether the base is easy to find and read; whether the parked bombers, pavement and optional targets look convincing; whether the AA and fighters create enough pressure; whether 15:00 and the rank cuts feel right; how the roughly 16-second desktop Studio load feels on your phone; and whether the briefing, radio and results are clear. Mission 2's rank cuts, failure rules and air roster remain assumptions awaiting owner feedback.

## Mission 3 beta (once #147 is merged)

Mission 3 becomes playable when its PR merges; until then it shows as locked.

1. **How to reach it.** Finish missions 1 and 2 on the same save file (any rank). Mission 3's tile then reads NEXT; a file that has not finished mission 2 cannot start it. The current chapter cutscene plays once, then the briefing "NOBODY SIGNED" (region SNOWY MOUNTAINS).
2. **The sortie.** You start in the air over snowy mountains, heading north-west toward site 1 with three LANTERN wingmen; a 15:00 countdown starts. Destroy all **nine radar domes** (red TGT, white spheres): five along a ridge crest about 1–2 minutes ahead, four on a high saddle further west-north-west. LOW ALTITUDE now warns about the ground under you, not sea level.
3. **Pressure.** Two fighters meet you head-on at about 10 seconds and three more at about 40 seconds. When site 1's five domes are down, two fighters and the ace **CAIRN LEAD** come from the west. AA guns (one at site 1, three at site 2) fire at you; they and the parked helicopter at site 2 are optional points.
4. **Going home.** When the last dome dies a blinking **MISSION UPDATE** box appears, the clock resets to 15:00, enemy fighters break off and a **white dashed line** appears across the ground far to the south. The HUD's second row reads RTB and the green cue points at the nearest part of the line (SERA tells you to follow it; the radar minimap does not draw the line). Fly south across it.
5. **Landing.** Crossing the line cuts to a cockpit approach at the home runway: a 3:00 landing clock, DIST counting down to touchdown, and RIM TOWER talking you in. It flies itself. Press SPACE / RT or tap SKIP to jump to the end. MISSION ACCOMPLISHED shows on the runway, then the results. Landing time does not count.
6. **Scoring.** Radar 100, AA gun 20, helicopter 40, fighter 60, ace 240. Rank S ≥ 1,300, A ≥ 1,150, B ≥ 1,000, C ≥ 900 (all domes). Everything destroyed = 1,680, the reference player's S score. Fails if you are shot down or either 15:00 clock runs out; the landing cannot fail.

**Most useful feedback:** whether the domes and sites are easy to find in the mountains; how flying low in the valleys feels with the new LOW ALTITUDE warning; whether the update, the dashed line and the landing read clearly and feel right; whether 15:00 and the pressure feel right (the footage player took 5:35 plus 1:12 home); how the snow, rock and sky look.

**Known:** the world took 35–88 seconds to build in Studio on a desktop (five measurements; mission 2 takes 16), so expect a long loading screen, After the results appear the server clears the mountains, which froze it for 17–46 s in Studio; launching another mission straight away shows "Clearing the last sortie. Your launch is queued..." and starts by itself once that finishes (D-067). The mountains look terraced (large flat steps), and on low graphics quality distant ground may not draw (see Blockers). Phone load time and frame rate are not measured. There are no bombs and no player gun (D-150); use missiles and specials. Optional targets you leave behind stay standing but can no longer be scored after the update. The radar minimap does not draw the return line; the green cue points to it.

## Missions 3–5 — in review

See [per-level status](levels.html) for the current pieces, findings and owner test checklists. Mission 3 [#147](https://github.com/A-Ricemusic/skybreak/pull/147), mission 4 [#149](https://github.com/A-Ricemusic/skybreak/pull/149), and mission 5 [#148](https://github.com/A-Ricemusic/skybreak/pull/148) remain open; sequential unlocks depend on preceding missions merging. Worlds #139/#144 and engines #141/#145 are merged but dormant.

Priorities before activation: resolve review findings, reconcile sequential integration, reduce roughly 45–46 s M04/M05 loading and cleanup delays (work on `perf/m04-m05-terrain`), and address M04 transports escaping at about 4:43.5 versus the 12:00 HUD clock. M03 terrain/LOD presentation and M05 lighting follow-up remain review concerns. Linked PRs report Studio checks; this docs change performed no Studio or Player test.

## Engine for missions 6–18 — plan written, batch D1 in review

The [missions 6–18 engine plan](../specs/engine/missions-06-18-plan.md) lists 31 missing engine features from the mission and world specs, which missions need each, sizes and dependencies, and a batch order D1–D13 so missions can be built 6 → 18. In priority order:

1. **D1 (this PR, in review): player gun, optional finite missile/special stocks, rearm refills them.** Nothing changes in practice or missions 1–5: no mission uses it yet (D-150, D-152). The gun is hold G / LT / touch GUN; it is only fitted where a mission opts in. Proposal D-151: enable it everywhere after you have tried it in mission 6 or 7.
2. **D2 for mission 6:** SAMs that actually fire, ship hulls with separately targetable weapon mounts and sinking, ships that move, an anti-ship weapon.
3. **D3 for mission 7:** incoming artillery (warning, countdown, safe-altitude band under the canyon rim), canyon flight checks, an area-attack weapon.
4. **D4–D6 for missions 8–10:** intercept-and-hold objectives with a protected site, bigger air battles, carrier-deck rearm, friendly landing/column progress, repeated artillery.
5. **D7–D9 for missions 11–13:** protected airliners/plane that enemies target, ground and airship radar jammers, rearm during a strike, guided bombs, elite retreat and ejection.
6. **D10–D13 for missions 14–18:** cruise-missile intercepts, city/column support, rearm repair for missions 15–17 only (provisional D-156), Rusk's protected withdrawal, generators-unlock-core, the vent run and the final duel.

D1 has offline tests only; its Roblox Jest specs compile but have not run because Studio is signed out (see Blockers). No Studio or Player check is claimed.

## Missions 6–9 — specs ready for review

Mission and world specs are in review in [PR #155](https://github.com/A-Ricemusic/skybreak/pull/155), at `docs/specs/missions/m06.md`–`m09.md` and `docs/specs/worlds/m06.md`–`m09.md`, with source timestamps, observed debriefs, scale sketches, Broken Relay adaptations and main’s engine gaps. Review the flagged inventory/trigger/rank assumptions before implementation; these are documentation proposals, not mission activation or Player verification.

## Later

- Mission and world specs for 10–13 are in review in [PR #153](https://github.com/A-Ricemusic/skybreak/pull/153): [M10](../specs/missions/m10.md), [M11](../specs/missions/m11.md), [M12](../specs/missions/m12.md), [M13](../specs/missions/m13.md), with companion world specs. Unresolved rosters, rank cuts and layout assumptions remain explicit. Missions remain unbuilt, locked and unavailable; no Player verification.

Before the finale, remap the final story chapter and retire leftover code keyed to the old 27-mission campaign. Mission 18 retains the planned one-on-one Rusk duel (D-031).

## Missions 14–18 specifications — in review

[PR #154](https://github.com/A-Ricemusic/skybreak/pull/154) contains [M14](../specs/missions/m14.md), [M15](../specs/missions/m15.md), [M16](../specs/missions/m16.md), [M17](../specs/missions/m17.md) and [M18](../specs/missions/m18.md), companion world specs and source coverage in `reference/ledger.md`. Review unresolved ground subtypes/rank cuts and proposed layouts before implementation; preserve Rusk’s M17 withdrawal and added M18 duel. The duel keeps the existing regenerating missile rack; reference finite racks/rearm loadouts remain an explicit engine gap. Missions remain unbuilt and locked; no Studio/Player quality is claimed. Main now includes PR #155 (M6–9) and PR #153 (M10–13); their dashboard, level-card and ledger updates are preserved.

AI voice disclosure (D-140, pending merge): the owner will see a permanent ElevenLabs AI voice credit at the end of Settings and a passive 12-second banner when the first voiced cutscene or radio line starts each session. No gameplay or playback changes. Latest Studio log contains LoginDialog; no Studio screenshot or Player verification claimed.
