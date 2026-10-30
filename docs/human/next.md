# Next

Last updated: 2026-10-30.

**TGT button (D-210, 2026-10-30, open PR `fix/tgt-closest-onscreen`).** After playing, the owner found the target itself good but the button inconsistent. The PR makes every TGT press (PC key, gamepad Y, on-screen button) select the closest enemy on screen, or the second closest when the closest is already selected; quick presses keep walking outward. Automatic targeting after a kill is unchanged. Next: merge on green CI, then the owner checks it on a phone and on PC (steps under "Mission 2 beta test"). Spec: [targeting](../specs/engine/targeting.md).

## M12/M13 worlds — in review [#170](https://github.com/A-Ricemusic/skybreak/pull/170)

1. Review [M12 composition/table](../specs/worlds/m12-composition.md) and [M13 composition/table](../specs/worlds/m13-composition.md). Estimates12.770960s/13.253200s retain3.229040s/2.746800s against16s. Branch stacks on #167 → #166 → #164; rebase main as dependencies merge; do not merge this PR yet.
2. Render and fly crater ingress/service approaches and the fog ravine/exit, compare against accepted specs, inspect procedural silhouettes and conservative ravine width, and measure build/clear/phone costs before activation.
3. Integrate M12 seven live guns then elite,24 ground/9 air kills,15:00+10:00, initial3/18/21; resolve initial/final count difference, ECM, finite ammunition/rearm, animated destruction/ejection. Integrate M13 ≥1300 at7:00 expiry then15:00 protected-plane intercept,32 jammers, spatial coverage, visual guns, damageable plane and fighter priorities. No unlock changes here.

## M10/M11 world review and integration

1. Re-review PR [#167](https://github.com/A-Ricemusic/skybreak/pull/167) P1 fix: generated-water connectivity and centreline checks now pass; M10 estimate14.732s with1.268s headroom. Review [M10](../specs/worlds/m10-composition.md) and [M11](../specs/worlds/m11-composition.md), including provisional inventories, full target tables and budgets. Rebase onto main after #164/#166 merge; do not merge this PR as part of this task.
2. Once Studio is authenticated, compare ingress, river turn/pen mouth and snowy high/low bands against the cited spec views, fly both landing envelopes and both civilian routes, and measure real build/clear/phone performance. Offline checks establish geometry contracts only.
3. Resolve M10 per-type roster/26-air activation, artillery, ammunition/rearm and 3,000-point/20:00 integration. Extend M11 encounter validation above 2,000 without clipping its 2,800-stud route; implement independent survival/progress for both civilians and the 5:30 protection objective. Review compressed vertical/cloud treatment together before activation.


## M08/M09 worlds — in review

Review the [broadcast island](../specs/worlds/m08-composition.md) and [three beaches/carrier](../specs/worlds/m09-composition.md), including full scenery tables. Offline estimates are 4.235 s / 10.474 s (≤16 s). Rebase `feat/m08-m09-worlds` onto main after #164 merges. Later authenticated Studio work must check silhouette, materials, native/distant sea seams, carrier deck/approach, navigation, build/clear costs and phone readability. Resolve M09 subtype/83-contact inventory before activating mission data; preserve M08 7:00+6:00/six bombers/NW ingress and M09 10:00+7:00/six attack jets/carrier rearm. No Studio or gameplay activation in this PR.

## M06/M07 worlds — in review

Review the dormant [M06 harbour](../specs/worlds/m06-composition.md) and [M07 array/canyon](../specs/worlds/m07-composition.md) worlds, including their complete target tables. Chunk/yield estimates: 10.265 s / 14.501 s under the 16 s caps (legacy jobs ×1.5: 6.384 s / 10.716 s); actual load cost is unmeasured. Once Studio is authenticated, inspect silhouette, materials, low canyon flight, waterline props and service approach against the accepted specs, then measure terrain/build/clear on desktop and phone. Resolve M06 subtype totals and M07 51-versus-52 accounting before mission activation. No Studio launch is authorized in this work; no catalog/unlock changes are included.


**Story with subtitles (D-142, 2026-10-30).** Roblox rejected the regenerated voiceBank01, and the owner's policy is now no more audio uploads ([blockers](blockers.md)). Merging #159 keeps main's six approved voice banks: 78 story beats keep their exact recordings, and every new or changed line is subtitle-only. #159 also rewrites the 10 riskiest lines. Next: merge #159, then carry its story text into M04/M05 integration. Any investigation of the rejection's cause stays offline, using the [preserved case file](../qa/audio-rejections/2026-10-30-voicebank01.md).
Audio policy (D-142): continue the story in subtitles beyond existing approved voices; changed lines stay silent. No further audio uploads. Any cause investigation must remain offline using the [preserved case file](../qa/audio-rejections/2026-10-30-voicebank01.md).

## Launch loading UX

Confirming a launch after its story chapter immediately covers the world with the existing opaque loading screen. You will see “Building world…” with an animated bar and replicated planning/terrain/scenery phase when available, or “Waiting for the previous mission to clear…” during cleanup. The screen stays up through the existing replication/preload percentage and tower clearance; mission clocks and the carrier fly-off still begin through the existing Ready handshake. Launch inputs stay locked until flight starts. Refusals and build errors restore the briefing with the existing error toast; the queue and post-build readiness timeouts retain their existing bounds. PR [#160](https://github.com/A-Ricemusic/skybreak/pull/160) also bounds a silent launch request at 510 seconds (the server’s 390-second cleanup wait plus 120 seconds to build). On expiry you return to briefing with a timeout toast. Late responses and loading/start events cannot hijack a retry. The old launch is cancelled; while its server build still owns the world, retries say “still preparing” rather than building another world. If a server thread never recovers, retries remain refused until that server is restarted.

Owner check after merge: launch practice and missions 1–3, including an immediate relaunch after results. Construction should stay hidden, the queue should advance automatically, and mission 1's carrier fly-off should follow loading. Offline regression tests cover the shared launch state machine; Studio verification is blocked: the attempted Jest launch displayed the login dialog (2026-10-29 PDT); no practice/M01–M03 or carrier-intro runtime check was performed. Another agent acquired Studio during the final lease interval; the accidental overlapping launch was stopped, and only this task’s processes were closed. Engine snapshots are unchanged.
## Mission 1 pressure tuning — proposed, unmerged

- Owner feedback: wingmen absorbed too much attention and the bomber approach was too quiet. M01 alone opts into 80% player-priority targeting slots (revisited every eight seconds), close/tail/fire overrides (guided/special launches and player hits start an eight-second threat window). Tail breaks/jinking use existing break steering with three seconds of recovery after overshoot extends. Easy forces only tail breaks, keeps zero close-lock odds and rolled inbound breaks, and adds no flare; Normal/Ace force close-lock/inbound breaks and give hostile raiders/escorts one flare. Wingmen get no pressure flare. Mission 2 keeps legacy targeting and defence.
- Opening raiders increase four → six and arrive 10–25° either side of the nose, head-on, 2,600–3,200 studs ahead between carrier and bombers. Two escorts plus five admitted raiders fill the seven-fighter cap; remaining requests wait. The two aft raiders at T+120 and escort/ace at T+150 remain. No increase in simultaneous fighter budget.
- Normal maximum 1,500 (six bombers 600 + three escorts 180 + ace 240 + eight raiders 480). Ranks S 1,320 / A 1,020 / B 600 / C 500; without ace Normal tops out at 1,260. Ace adds two raiders as before, maximum 1,620. Ally kills still earn nothing. The frozen EngineM01Snapshot and catalog fixture deliberately adopt these owner-requested data changes.
- Test Easy/Normal/Ace: fly through or fight the forward screen, tail a raider, shoot at a wingman-focused enemy, observe breaks/flares and return attacks. Record actual missile launches at player versus allies; 80% is the targeting-slot policy, not a measured launch ratio. Confirm Easy bomber interception remains achievable, rear wave queues once at 120 s, ace keeps queue priority, bomber route/240 s escape and 10:00 countdown remain solid. Phone frame rate and human combat balance remain unmeasured.
**Story with subtitles (D-142, 2026-10-30).** Roblox rejected the regenerated voiceBank01, and the owner's policy is now no more audio uploads ([blockers](blockers.md)). Merging #159 keeps main's six approved voice banks: 78 story beats keep their exact recordings, and every new or changed line is subtitle-only. #159 also rewrites the 10 riskiest lines. Next: merge #159, then carry its story text into M04/M05 integration.

## Mission 2 beta test — start here

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). Mission 2 is live through the automatic pipeline and unlocks after you finish mission 1 on the same save. Agents have not performed a Roblox Player test.

Targeting: on a phone, tap an enemy target box to select it. Auto-targeting after a kill still picks what the nose is on (#157). The TGT button, Tab/R and gamepad Y now select the closest enemy you can see on screen; if that is already your target, the second closest; quick presses within 2.5 s keep walking outward and wrap (D-210, this PR). With nothing on screen it picks the closest enemy overall and the edge arrow points to it. Check: with two or three enemies in view, one TGT press should take the nearest, a second quick press the next nearest; turn so an enemy leaves the screen and confirm TGT no longer picks it while others are visible. Tapping a box should not steer the jet.

1. **Reach it.** Finish mission 1 at any rank. Mission 2's tile should read NEXT. The chapter "The sealed case" plays once before the briefing "NO ANIMALS".
2. **Fly north.** You start in the air about 470 studs up with three LANTERN wingmen and a 15:00 countdown. Follow the red-and-white power line for about two minutes to the "farm" airfield.
3. **Destroy eleven parked bombers.** Each is a red TGT; the mission ends when the last bomber is destroyed. No landing is required. The substation under the power line, seven hangars, four firing AA guns and the control tower are optional points.
4. **Watch the air.** Two fighters meet you head-on around 35 seconds, two rise from the base as you approach, and one scrambles from the runway. The ace HARROW SIX arrives after four bombers; two more fighters arrive from the west valley after six.
5. **Use missiles, gun or 4AAM.** There are no bombs. The 4AAM salvo can hit four targets per press and suits the parked rows.
6. **Check scoring and persistence.** Bombers are 120 each; hangars 50; AA guns 20; tower and substation 100 each; fighters 60; ace 240. S ≥ 2,200, A ≥ 1,750, B ≥ 1,500, C ≥ 1,320. Everything destroyed totals 2,610. Afterward, confirm mission 1's saved score breakdown still appears through replays and a save reload.

Most useful feedback: whether the base is easy to find and read; whether the parked bombers, pavement and optional targets look convincing; whether the AA and fighters create enough pressure; whether 15:00 and the rank cuts feel right; how the roughly 16-second desktop Studio load feels on your phone; and whether the briefing, radio and results are clear. Mission 2's rank cuts, failure rules and air roster remain assumptions awaiting owner feedback.

## Avatar death fix — what to check when playing

[PR #156](https://github.com/A-Ricemusic/skybreak/pull/156) stops the Roblox avatar from existing at all, so the top-right health bar and the red damage flash should never appear again (D-086). When you next play:

1. **Menu and flight.** The menu backdrop, briefing, flight camera, HUD, pause, results and mobile touch controls should behave exactly as before. Nothing in the game used the avatar.
2. **No red flash, no health bar.** Play practice, mission 1 and mission 2 for a few minutes each, including the loading screen and the return to the menu. There should be no red screen flash and no health bar in the top-right corner at any point.
3. **Escape menu.** The Roblox menu's "Reset Character" entry is disabled on purpose; the jet is the only thing you control.

If any of these still appear, report where and when (menu, loading, in flight, results).

## Mission 3 beta (once #147 is merged)
## Mission 3 beta (#147 merged)

Mission 3 is live by pipeline convention after #147 merged; no new Player test is claimed.
## Mission 3 beta — live after #147

Mission 3 merged as `7d73c44` (#147) and is live by pipeline; it unlocks after mission 2.

1. **How to reach it.** Finish missions 1 and 2 on the same save file (any rank). Mission 3's tile then reads NEXT; a file that has not finished mission 2 cannot start it. The current chapter cutscene plays once, then the briefing "NOBODY SIGNED" (region SNOWY MOUNTAINS).
2. **The sortie.** You start in the air over snowy mountains, heading north-west toward site 1 with three LANTERN wingmen; a 15:00 countdown starts. Destroy all **nine radar domes** (red TGT, white spheres): five along a ridge crest about 1–2 minutes ahead, four on a high saddle further west-north-west. LOW ALTITUDE now warns about the ground under you, not sea level.
3. **Pressure.** Two fighters meet you head-on at about 10 seconds and three more at about 40 seconds. When site 1's five domes are down, two fighters and the ace **CAIRN LEAD** come from the west. AA guns (one at site 1, three at site 2) fire at you; they and the parked helicopter at site 2 are optional points.
4. **Going home.** When the last dome dies a blinking **MISSION UPDATE** box appears, the clock resets to 15:00, enemy fighters break off and a **white dashed line** appears across the ground far to the south. The HUD's second row reads RTB and the green cue points at the nearest part of the line (SERA tells you to follow it; the radar minimap does not draw the line). Fly south across it.
5. **Landing.** Crossing the line cuts to a cockpit approach at the home runway: a 3:00 landing clock, DIST counting down to touchdown, and RIM TOWER talking you in. It flies itself. Press SPACE / RT or tap SKIP to jump to the end. MISSION ACCOMPLISHED shows on the runway, then the results. Landing time does not count.
6. **Scoring.** Radar 100, AA gun 20, helicopter 40, fighter 60, ace 240. Rank S ≥ 1,300, A ≥ 1,150, B ≥ 1,000, C ≥ 900 (all domes). Everything destroyed = 1,680, the reference player's S score. Fails if you are shot down or either 15:00 clock runs out; the landing cannot fail.

**Most useful feedback:** whether the domes and sites are easy to find in the mountains; how flying low in the valleys feels with the new LOW ALTITUDE warning; whether the update, the dashed line and the landing read clearly and feel right; whether 15:00 and the pressure feel right (the footage player took 5:35 plus 1:12 home); how the snow, rock and sky look.

**Known:** the world took 35–88 seconds to build in Studio on a desktop (five measurements; mission 2 takes 16), so expect a long loading screen, After the results appear the server clears the mountains, which froze it for 17–46 s in Studio; launching another mission straight away currently shows "Clearing the last sortie. Your launch is queued..." (the pending launch UX change above moves this wait onto the loading screen) and starts by itself once that finishes (D-067). The mountains look terraced (large flat steps), and on low graphics quality distant ground may not draw (see Blockers). Phone load time and frame rate are not measured. There are no bombs; use missiles and the gun. Optional targets you leave behind stay standing but can no longer be scored after the update. The radar minimap does not draw the return line; the green cue points to it.

## Missions 4–5 — in review

See [per-level status](levels.html) for the current pieces, findings and owner test checklists. Mission 3 [#147](https://github.com/A-Ricemusic/skybreak/pull/147) is merged. Mission 4 [#149](https://github.com/A-Ricemusic/skybreak/pull/149), and mission 5 [#148](https://github.com/A-Ricemusic/skybreak/pull/148) remain open; sequential unlocks depend on preceding missions merging. Worlds #139/#144 and engines #141/#145 are merged but dormant.
See [per-level status](levels.html). Mission 3 #147 is merged; mission 4 [#149](https://github.com/A-Ricemusic/skybreak/pull/149) and mission 5 [#148](https://github.com/A-Ricemusic/skybreak/pull/148) remain open.

1. Orchestrator: re-check M04 normal completion, construction failure/player leave and immediate queued relaunch through #147's shared gate. This revision did not launch Studio.
2. Confirm the D-096 transport escape at 6:48.33 (57,166.079 studs at 140 studs/s); offline tests enforce 6:30–7:00 and sample all transport positions inside soft airspace. The exit heads west back inside the world; the owner should judge this inland turn in beta. Jammers now follow the same hook at 110 studs/s and remain present through transport escape; re-check radar and point availability.
3. Review and merge the `perf/m04-m05-terrain` PR after #149 (D-120). In a Studio Play terrain bench it cut M04 terrain from 66 s to 11.7 s and M05 from 107 s to 37 s; the cleanup is one native clear (M04 8–12 s) through the shared gate, and `M04World.Clear(cancelled)`/`M05World.Clear(cancelled)` stay the registered entry points. Sign Studio back in first (see Blockers), then re-measure the real campaign path and fix M05's water cost (still over 20 s). Real-phone performance remains unmeasured.
4. Re-check M05 lighting and M03 terrain/LOD presentation. Earlier linked Studio evidence does not verify these M04 changes; no Player test is claimed.

## Missions 6–9 — specs ready for review

Mission and world specs are in review in [PR #155](https://github.com/A-Ricemusic/skybreak/pull/155), at `docs/specs/missions/m06.md`–`m09.md` and `docs/specs/worlds/m06.md`–`m09.md`, with source timestamps, observed debriefs, scale sketches, Broken Relay adaptations and main’s engine gaps. Review the flagged inventory/trigger/rank assumptions before implementation; these are documentation proposals, not mission activation or Player verification.

## Cutscene modernization — in review (this PR, not merged)

Why: the story cutscenes before every mission still used grey blocks, a single slate floor and part-built desk props next to the realistic jets. Details: [cutscene asset spec](../specs/cutscene-assets.md); decisions D-110–D-116.

Done in code (live once merged; no upload needed):
- Approved, already-uploaded scenery stands around the desk in every non-hangar chapter: city blocks and towers, farm buildings and an orchard (charred stumps once it burns in chapter 9, "Walking the storm"), rocks, pines, relay masts and a radar dish, the harbour quay, cranes and containers, and frigates in chapter 8, "The frigate ring". A second band stands in front of the desk so the most common shot has a background. Any model that does not load gets its own part-built stand-in at its spot (ships and the story subject included).
- If the stage cannot be built, or something fails on a later frame or input, everything already created is undone and the cutscene is skipped like Skip. Every cleanup step runs once, even if another fails; a model that fails to place is destroyed before its stand-in goes up.
- Per-scene ground, a strip of harbour water and a larger sea; a gentle per-mood colour grade, sun rays at dawn and dusk, and depth of field on close shots. Phones keep their existing effect trims.
- Cutscene timing, text, voice, camera poses and controls are unchanged; practice and missions are untouched.

Approved, uploaded and wired (live once this PR merges):
- Four original Blender desk props: radio console with spinning tape reels, field recorder with an opening lid, rolling status board, tape tin. They received an independent 10/10 safety review ([record](../qa/asset-reviews/2026-10-29-pr152-review-1.md)), were uploaded and passed moderation: radio console `107763051422036`, field recorder `87111261775563`, status board `105938775214679`, tape tin `86951943477271`. If one fails to load, the cutscene keeps today's procedural prop.

Still to do: check the radio, recorder (chapter 16 with the lid open), board and wide shots in Studio, including the props' import orientation and scale, which no Studio session has checked yet. Next in the plan: textured desk and chair. Agents have not performed a Roblox Player test; Studio before/after captures and the Roblox Jest run are still pending: Studio is signed out on this Mac and needs the owner to sign back in (see Blockers); `docs/qa/cutscenes/2026-10-29/` has only the Blender set preview for now.

## Later

- Mission and world specs for 10–13 are in review in [PR #153](https://github.com/A-Ricemusic/skybreak/pull/153): [M10](../specs/missions/m10.md), [M11](../specs/missions/m11.md), [M12](../specs/missions/m12.md), [M13](../specs/missions/m13.md), with companion world specs. Unresolved rosters, rank cuts and layout assumptions remain explicit. M10–M13 worlds are in review; mission gameplay remains unbuilt, locked and unavailable; no Player verification.

Story remap #159 is implemented (D-130/D-131): use its [0–18 routing audit](../specs/story/routing-audit.md), retain its story text when integrating M04/M05 gameplay, and keep new dialogue subtitle-only (D-142); the [voice script](../specs/story/voice-script.md) lists which beats are silent. Studio and audible Player verification are pending. Mission 18 retains the one-on-one Rusk duel (D-031).

## Missions 14–18 specifications — in review

[PR #154](https://github.com/A-Ricemusic/skybreak/pull/154) contains [M14](../specs/missions/m14.md), [M15](../specs/missions/m15.md), [M16](../specs/missions/m16.md), [M17](../specs/missions/m17.md) and [M18](../specs/missions/m18.md), companion world specs and source coverage in `reference/ledger.md`. Review unresolved ground subtypes/rank cuts and proposed layouts before implementation; preserve Rusk’s M17 withdrawal and added M18 duel. The duel keeps the existing regenerating missile rack; reference finite racks/rearm loadouts remain an explicit engine gap. Missions remain unbuilt and locked; no Studio/Player quality is claimed. Main now includes PR #155 (M6–9) and PR #153 (M10–13); their dashboard, level-card and ledger updates are preserved.

AI voice disclosure (D-140, pending merge): the owner will see a permanent ElevenLabs AI voice credit at the end of Settings and a passive 12-second banner when the first voiced cutscene or radio line starts each session. No gameplay or playback changes. Latest Studio log contains LoginDialog; no Studio screenshot or Player verification claimed.

Story review priority: **start a new save slot to see the new c1/c2 chapters**; existing numeric seen flags intentionally skip chapters already seen. Verify M3 now receives “An unlisted station”, M4 “The orchard witnesses”, M5 “Fuel under grain”; follow M5 escape into recorded guard-channel evidence. Existing seen flags remain compatible; D-030 Q8 adds the opening reprise on completed M1 launches from the mission menu only; Retry after death does not replay the opening. M3 is live on main (#147); M4–M18 remain locked.
