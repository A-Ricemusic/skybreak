# Engine plan for missions 6–18

Written 2026-10-30 against `origin/main` **6df703f** (after #147, #155, #153, #154, #162, #163). This is a source review of the mission specs (`docs/specs/missions/m06.md`–`m18.md`, §2–§3 and §10 "Engine gaps") and world specs (`docs/specs/worlds/m06.md`–`m18.md`), checked against the code on main. It is not a Studio or Roblox Player observation. Batch D1 (this PR) is the only part implemented here.

## 1. What main already has (do not rebuild)

| Batch | Capability on main | Where |
|---|---|---|
| A | Typed ground targets (19 types), `required` flag, per-type score roles; arrivals by time / approach / ground group / required count / phase start; standalone ace; firing AA guns | `CampaignEncounters.ts`, `GroundAirDefence.ts`, `CombatService.ts` AA step |
| A | Bomber routes with escorts and escape failure (M01) | `BomberEncounter.ts`, `BomberRules.ts` |
| B | Mission update with fresh phase clock, cumulative score kept; directional return line; skippable authored landing; terrain-relative LOW ALTITUDE | `EngineBatchB.ts`, `EngineBatchBRuntime.ts` |
| C | Score threshold (optionally held to clock expiry, then successor update); radar jamming by route jammer aircraft; optional rearm (score phases only, missiles/special, damage preserved, clock paused); route helicopters/jammers; generic ship target at the waterline; bounded night lighting | `EngineBatchC.ts`, `EngineBatchCRuntime.ts`, `NightLighting.ts` |
| — | Large mission airspace (±15,360 hard), mission start poses, carrier fly-off launch stage (M01) | `MissionPolicy.ts`, `M04Limits.ts`, `LaunchStage.ts`, `M01CarrierPlan.ts` |
| Weapons | Lock/guided/blind missile, eight-missile rack regenerating every 2.5 s; specials UAV, flares, 4AAM salvo, XLAA lance (salvo/lance hit ground) | `WeaponRules.ts`, `SpecialWeapons.ts` |
| **D1 (this PR)** | **Opt-in player gun; opt-in finite sortie missile/special stocks; rearm restores them** | `SortieArmament.ts`, `CombatService.ts`, `EngineBatchCRuntime.ts` |

Verified absent on main before D1: no player gun action (`CombatActionKind` had FireMissile/Special only); no finite ammunition; `sam` targets are typed and scored but **do not fire** (only `aa_gun` runs the `GroundAirDefence` loop); jamming validation requires airborne jammer waves; rearm is rejected outside score-threshold phases and with `health: true`; encounter points are capped at Y ≤ 2,000; route actors are capped at six per phase and must be jammers or helicopters.

## 2. Missing features, deduplicated

Sizes: **S** bounded data/validation/hook; **M** subsystem extension with runtime and tests; **L** new runtime lifecycle or cross-system change. Sizes are scope, not time.

| # | Feature | Needed by | Size | Depends on | Notes from the specs |
|---|---|---|---|---|---|
| F1 | Player gun (hold-to-fire, server hits, ammo counter, PC/gamepad/touch) | 6–18 (explicit: 8, 13 airships; parity notes in 6–7, 9–10, 14–17) | M | — | **D1, done (opt-in).** M13's airship sweep is the first mission that is mechanically built around it |
| F2 | Opt-in finite sortie ammunition (missiles, specials) | 6, 9, 10, 12, 14–17; M11 notes only | M | — | **D1, done.** M18 duel must keep the regenerating rack (m18 §10) |
| F3 | Rearm restores finite stocks and gun | 6, 9, 10, 12, 15, 16, 17 | S | F2, batch C | **D1, done.** Default rearm unchanged |
| F4 | SAMs that fire (guided ground-to-air missile, lock warning, evade/flares, per-difficulty) | 6, 7, 9, 10, 12, 15, 16 | M | — | `sam` exists only as a scored target today |
| F5 | Naval targets: distinct classes, hull + mount component targets without double pay, mounts die with the hull, sinking presentation | 6, 9, 17 | L | F4 (ship SAM mounts) | m06 §7: mounts independently targetable; hull/mount ownership is new |
| F6 | Moving surface routes (ships underway, landing craft, friendly frigate) | 6, 9, 17 | M | F5; batch C route actors | Route actors today are air-only (jammer/helicopter) |
| F7 | Anti-ship weapon equivalent (trajectory, hull damage, scoring) | 6, 9 | M | F2, F5 | A generic ground lock is not anti-ship behaviour (m06/m09 §10) |
| F8 | Area-attack weapon (authored footprint, multi-target damage, single kill credit) | 7, 10 | M | F2 | Four salvo missiles are not bomblet dispersal (m07 §10) |
| F9 | Guided bomb equivalent | 12 | M | F2, F8 (shared air-to-ground special plumbing) | m12 §10.7 |
| F10 | New typed ground targets and labels | 6 (container ship, supply/landing ship, missile boat, submarine, gun mount, storage), 7 (solar panel, solar tower, flak gun, pillbox), 9 (artillery, bunker, tank, vehicle), 10 (container, watchtower, antenna, barracks, gunboat, sub pen), 12 (railgun emplacement, non-targetable wreck), 15–16 (tanks, AA/SAM vehicles, self-propelled guns, tents), 17 (bridge section), 18 (generator, core) | S each | asset reviews for new meshes | Add per mission; do not relabel warehouses |
| F11 | Artillery hazard: warning → countdown → absolute safe-altitude band with terrain masking → impact, repeatable; distinct from LOW ALTITUDE | 7 (escape), 10 (repeated), 12 (ring line-of-fire sweep) | M (7) + S (10 schedule) + M (12 sweep) | batch B terrain probe | m07 §7: 2,000 ft ≈ 585 studs absolute; ravine must stay below it |
| F12 | Canyon / ravine / trench low flight: authored navigable channels, terrain-safe spawns and turn basins, masking check against F11 | 7, 10, 13; enclosed variant 18 | M (world) | F11 | Mostly world-plan work; engine part is the masking test and spawn audit |
| F13 | Intercept-plus-hold objective (required kills that do not end the phase before its clock) and protected ground site | 8, 9 (beach), 15 | M | batch B/C clocks | M8 phase 2: six bombers, phase lasts 6:00 |
| F14 | Large battle population (air budget > today's seven-aircraft / six-route caps; cheap distant armour; 100–150 contacts) | 8, 10, 16 | M | — | Performance-sensitive; needs phone measurements |
| F15 | Carrier-deck rearm (land on and catapult from the carrier) | 9 | M | F3, M01 carrier launch stage | Batch C rearm assumes a runway |
| F16 | Friendly ground progress director: troop/landing/column routes, sector progress tied to cleared areas, zone reinforcements, radio feedback | 9, 15, 16, 17 | L | F6, F10 | One shared director, not four mission scripts |
| F17 | Enemy aircraft that prioritise non-player targets (airliners, protected plane, beach, column) | 9, 11, 13, 15 | M | F16 or F18 | Generic player-chasing raiders cannot reproduce these objectives |
| F18 | Protected aircraft: per-aircraft health and routes, damage warnings, distinct friendly markers, "all safe" completion and loss failure | 11 (two airliners), 13 (evidence plane) | L | F17 | Legacy escort/defend phases are not individually damageable aircraft |
| F19 | Altitude envelope extension for authored routes (Y > 2,000 encounter cap) | 11 | S | — | Proposed compressed bands 2,800/900 studs (D-016 adaptation) |
| F20 | Ground-target radar jamming (live ECM target, not an aircraft) | 12 | S | batch C jamming | Validation currently demands a jammer wave |
| F21 | Airship jammer class and spatial (corridor) jamming coverage, including the protected plane's navigation | 13 | M | F20, F18, F1 | "Any jammer alive" is global today |
| F22 | Rearm outside score phases (required-ground strike) | 12 | S | batch C | Keep pause/score/damage rules |
| F23 | Rearm repair (damage back to 0%) | 15, 16, 17 | S | F3 | **Provisional D-156 (owner side): allowed where the footage shows it**, i.e. missions 15–17 only. Lift batch C's `health: true` ban per mission; other rearms keep damage |
| F24 | Weapon-select at rearm and separate landing/takeoff HUD clocks | 6, 10, 12, 15, 16 (presentation) | M | F2, F3 | Presentation parity, not required to play |
| F25 | Elite formation lifecycle: one-kill-ends-and-others-retreat, ejection story flag, required wingmen plus a protected leader who must survive and depart | 12, 17 | M | batch A ace | AceRules stage immunity is temporary, not survival/departure |
| F26 | Cruise-missile intercept targets: low-flying routes, impact failure at the protected site, parent/child separation without kill credit, low-altitude radar detection | 14 | L | F6-style route sampling | m14 §10 |
| F27 | Dependency objective: generators destroyed unlock the core route/objective | 18 | S | batch A ground groups | Arrival triggers exist; objective reveal does not |
| F28 | Interior vent run: checkpoint sequence, timed opening, exit volume, enclosed collision and occlusion-safe targeting | 18 | L | F12, F27 | |
| F29 | Duel arena: cleanup (remove fighters and their missiles, structure guns off, allies hold fire), strict one-on-one, independent 5:00 clock, keep rack/special state, finale once | 18 | M | F28 | D-031 original addition |
| F30 | Single-owner environment transition without reload | 18 | M | night-lighting ownership rules | |
| F31 | Parked vs airborne aircraft deduplication (no double score) | 10 | S | — | |

Multi-phase clocks are already covered by batch B updates and batch C threshold/update; the remaining clock work is F13 (hold to expiry for non-score phases), F24 (separate service clocks) and F29 (independent duel clock).

## 3. Batch order (build missions 6 → 18 in order)

Each batch is dormant until a mission opts in, keeps missions 1–5 and practice unchanged, and lands before or with the first mission that needs it.

| Batch | Contents | Unblocks | Rough size |
|---|---|---|---|
| **D1** (this PR) | F1 gun, F2 finite stocks, F3 rearm refill | M6, M7 weapons; reused through M18 | M |
| **D2** | F4 firing SAMs; F5 naval component targets and sinking; F6 moving surface routes; F7 anti-ship weapon; F10 M6 types | **M6** | L |
| **D3** | F11 artillery hazard (single escape sequence); F12 canyon masking/spawn audit; F8 area-attack weapon; F10 M7 types | **M7** | M–L |
| **D4** | F13 intercept-plus-hold and protected ground site; F14 air population budget | **M8** | M |
| **D5** | F15 carrier-deck rearm; F16 friendly ground progress (landing craft, sectors); F17 attack aircraft targeting the beach; F10 M9 types | **M9** | L |
| **D6** | F11 repeated schedule; F31 parked/airborne dedupe; F14 contact-count performance; F10 M10 types | **M10** | M |
| **D7** | F18 protected aircraft; F17 airliner-priority AI; F19 altitude envelope | **M11**, reused by M13 | L |
| **D8** | F20 ground ECM; F22 rearm in strike phases; F9 guided bomb; F25 elite one-kill retreat and ejection flag; F11 ring sweep variant; F10 M12 types | **M12** | L |
| **D9** | F21 airship jammers and corridor jamming (uses F1 gun, D7 protected plane) | **M13** | M |
| **D10** | F26 cruise-missile intercept | **M14** | L |
| **D11** | F16 extensions (city squads, desert column, zone reinforcements); F13 bombers threatening city zones; F23 rearm repair (provisional D-156: opt-in `rearm.health` for missions 15–17; M17 reuses it in D12); F24 weapon select and service clocks; F14 cheap armour rendering | **M15**, **M16** | L |
| **D12** | F25 protected Rusk withdrawal with four required wingmen; bridge damage linked to routes; naval turrets (reuses D2) | **M17** | M |
| **D13** | F27 generators unlock core; F28 vent run; F29 duel arena; F30 environment transition | **M18** | L |

**Provisional decision D-156 (owner side, 2026-10-30):** rearm may repair damage where the footage shows it: missions 15, 16 and 17 (65% → 0% at M15 3:41:40–3:44:25; damaged → 0% at M16 4:00–4:01:40; 25% → 0% at M17 4:20:00–4:27:57). Implement in D11 as an explicit per-mission opt-in (`rearm.health: true`, validated only for those missions' plans); missions 6, 9, 10 and 12 keep batch C's damage-preserving rearm. Revisit if owner playtests say repair makes M15–M17 too easy.

Ordering rationale: D2 and D3 are the only hard blockers for the next two missions. D4–D6 are smaller and keep one-mission-at-a-time (D-004) moving. D7 lands before M11 and is reused by M13 (D9). D11 batches the two ground-support missions because they share the column/squad director. F24 and F23 are presentation/parity work that can slide later if owner feedback says rearm feels fine.

## 4. Batch D1 as implemented

- **Data:** `MissionBlueprint.armament?: { gun?: { rounds }, stock?: { missiles, specialCharges? } }`, validated at catalog load (`validateArmament`: integers, gun 1–2,000 rounds, 1–120 missiles, 0–16 special charges; a rearm with `gun: true` needs a fitted gun). `RearmPlan.gun?` (absent follows `missiles`). **No mission sets `armament`**; the frozen catalog snapshot, `EngineM01Snapshot` and `EnginePracticeSnapshot` are unchanged.
- **Default (every current mission):** eight missiles regenerating one per 2.5 s, the special's own charges and flare recharge, no gun. `SortieArmament.RackTick` reproduces the old regeneration exactly (tested step by step).
- **Finite stock:** no missile regeneration, no special recharge, withdrawal refunds capped at the stock, empty FIRE says "MISSILES EXPENDED". Rearm restores the stock, the special's stock and the gun magazine.
- **Gun:** hold G (keyboard), LT (gamepad) or the touch GUN button (only drawn when fitted). The client sends `GunStart`/`GunStop`; the server owns the trigger, magazine and hits: 10 rounds/s from a server shot cooldown that keeps running across releases (tapping never beats the held rate), 4 damage per round, 900-stud range, each round an instant line from the nose with a generous cone. Any terrain/solid-scenery hit before the aim point blocks the round (2-stud epsilon; the target's own parts and water never block), using the missile kill path (ace staging, phase damage rules, scoring). `GunStop` is never rate-limited; pause, landing, rearm, input silence and an empty magazine all release the trigger. Tracers are local cosmetic parts; impacts use the existing `hit` effect and its approved metal-hit sounds. Gun rounds do not change missile accuracy in the debrief.
- **HUD:** `GUN n` leads the ammo line only when fitted; the line shrinks to fit its panel when the gun cell or a stock above eight makes it longer. Telemetry carries rounds in a new tail slot (index 33); legacy packet lengths are unchanged.

Not done in D1 and recorded for later batches: a dedicated cannon firing sound (D-142 forbids new audio uploads; the gun is silent except impacts), a gun lead reticle, gun accuracy in the debrief, and any Studio/Player check (Studio is signed out; Jest specs compile but have not run).

## 5. Batch D2 implementation (stacked on D1; unmerged)

`EngineBatchD2.ts` defines surface-route sampling/validation, naval classes, SAM tuning and anti-ship aim rules. `EngineBatchD2Runtime.ts` owns moving independent hull/mount models, sinking and firing SAMs. Encounter validation rejects cross-phase/nested/non-hull parents, required or routed mounts, invalid health, firing non-SAMs, invalid water routes/speeds, initial yaw differing from the first leg by more than 0.1°, and out-of-envelope mounts. Hulls may author `health`; absent retains 55. Mount positions are initial world positions, transformed with the hull during movement. Procedural target geometry needs no new asset/audio uploads.

No catalog mission opts in; practice/M01 engine snapshots and the full catalog remain unchanged. M6 can reuse batch C score hold and damage-preserving rearm without alteration. M6 roster, rank and world readiness are separate activation work. Area attack first belongs to M7/D3, and service weapon selection/separate clocks remain F24/D11. See D-190–D-193 for provisional gameplay contracts and outstanding Roblox verification.

D2 review follow-up: SAM caps count both warmups and marked airborne SAM missiles (Easy/Normal/Ace: 1/2/3), using loop counts. Retired mount membership is read alongside the killed-id set by group arrival predicates, avoiding per-step union allocation. Anti-ship guidance aims 160 studs ahead at cruise height before terminal homing, has a dedicated hull-only refusal notice, and keeps XLAA range defined only in SpecialWeapons. Additional contracts cover admission, route yaw, retirement/group scoring, combined budgets and scenery obstruction.
