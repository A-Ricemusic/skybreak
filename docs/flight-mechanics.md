# Ground impacts, throttle and stalls

FlightMath is the single numeric integrator for the authoritative 30 Hz server
and the fixed-step client predictor. There is no minimum altitude or automatic
pull-up. The existing horizontal world recovery, hard edge and ceiling remain.

Throttle selects an engine target between 70 and 320 studs/s. Engine acceleration
is capped at +26/-32 studs/s²; pitch adds an energy cost/gain. The default 65%
setting settles near 233 in level flight. Below 165 the HUD warns of low speed;
below 140 it warns STALL and asks for acceleration plus nose down. Lift falls
progressively (up to 65 studs/s of sink), steering authority drops to 30%, and
the nose sags. This is an arcade energy stall, not an angle-of-attack model.
Full throttle and a lowered nose restore speed and authority if altitude remains.

Right-stick forward/up increases selected throttle, back/down reduces it.
An 18% vertical deadzone is rescaled outside the deadzone; full travel adjusts
40 percentage points/second. Neutral holds the setting. LB/RB and Q/E still
adjust throttle and Shift temporarily commands full power. The right touch stick
uses the same deadzone and rate: up accelerates, down decelerates, and release
recenters the knob while holding the selected percentage. Left touch steering
remains independent; a third finger can press FIRE, TGT or SPECIAL.
The HUD displays actual speed and the selected throttle (Shift is a temporary
override). Start resets to 65%; stop, focus loss, text entry, gamepad disconnect
and input cancellation clear held controls without resetting a selected setting.

The server spherecasts the full movement segment each flight step, with a
4-stud fuselage radius. It includes Terrain and explicitly tagged visible solid
mission scenery, sea/river slabs and ground assets. Scenery stays CanCollide=false
and CanTouch=false; solid surfaces become CanQuery=true. Translucent shallows,
marker lights, runway paint, invisible aim roots, navigation/mission markers, aircraft (including parked display jets) and
projectiles are excluded. Ground meshes use PreciseConvexDecomposition rather
than box fidelity; the hidden tutorial radar cannot collide until revealed.
The query allowlist is constructed at sortie start and refreshed at blueprint
phase transitions to include newly spawned protected vehicles and remove old
ones. Welded protected surfaces retain their query flag; invisible roots do not.

An impact ends the authoritative session before navigation observations, enemy
simulation or missile resolution for that flight step. The existing finish guard
makes the result single-shot. Crash reasons override runner outcomes and flow
through the normal campaign callback/save and debrief: crash_terrain or
crash_water. Existing terminal sessions do not continue simulating.

Collision is intentionally a compact fuselage approximation, not every wingtip.
Roblox mesh convex decomposition is approximate. Spherecasts do not detect
initial overlaps; normal mission launch positions are above the ground, and
there is no gameplay teleport. No extra invisible collision volumes were added.
Low-altitude warning is absolute altitude, not a terrain-clearance prediction.

## Validation

The implementation was validated in Studio on 2026-10-25. Tests run in
Roblox Studio through `bun run test:roblox`, not Bun's JavaScript VM.
`bun run build:place` builds the production place without test modules.

For gameplay, start a fresh mission in normal Studio Play, then inject
`tools/playtest-crash-stall.client.luau` as a normal client LocalScript. The harness
climbs with LS, adjusts throttle through RS, checks neutral/deadzone/cancellation,
observes server speed and lost altitude in a stall, recovers with throttle and
nose down, then dives and waits for a real server Failed result with crash reason.
It never sets health, kills, aircraft position or mission state. Its Folder
`PlayerScripts.SkybreakCrashStallQA` records results. The hook exercises the production
CAS handler below engine dispatch; it does not prove physical controller routing.

### Recorded results

- `bun run test:roblox`: 254/254 tests, 21/21 suites, all passing in Studio
  in the final run. Covers shared flight/prediction, throttle
  deadzone/ramp, loss of lift/recovery, swept thin scenery, terrain/ocean reasons,
  overlay exclusions, all campaign navigation contracts, special weapons and HUD
  separation across the existing viewport/input-mode matrix.
- `bun run build:place`: production place built successfully. No test modules
  are mapped by the production project. `git diff --check` passes.
- Normal production Studio Play, unpublished session saves, M1: initial throttle
  65%; authoritative speed 288.983 -> 118.380 (stall) -> 181.594 (recovery).
  HUD displayed `STALL · ACCELERATE + NOSE DOWN`. Deadzone, RS release/cancel,
  actual TextBox focus/release and LB/RB checks passed. Final legal LS dive
  returned exactly one server `Failed`, `crash_water`, kills 0. Water crash cause
  was also observed in the ordinary debrief.
- A separate fresh M1 direct legal LS dive reset to 65% throttle and returned
  exactly one `Failed`, `crash_terrain`, kills 0, and the ordinary debrief read “Your aircraft crashed into terrain or
  scenery.” Both gameplay runs used the actual controller, replication and
  server simulation, with no health/kill/position/state overrides. Launch used
  the normal CampaignRequest StartMission endpoint, with the normal loading,
  ready, Started and UI handlers; menu clicking itself was not tested.

This is local Studio gameplay evidence, not a published-server or physical
controller/device test. All 27 missions were not replayed end to end under the
new physics; their world construction, navigation contracts, campaign state and
special weapons passed the engine suite. Existing combat QA pilots that choose
5–20% throttle now deliberately enter the unsafe speed range and may need new
flight tactics before reusing them for full-campaign acceptance. Phone/console
performance and mesh-decomposition cost have not been measured. Simultaneous
last-objective/impact timing was not stress-tested over a real network. No publication
or merge was performed during implementation.

## Independent review corrections

Astra reviewed the flight changes and surrounding architecture. Both blocking
findings were corrected: incoming missile/lock messages lead combined warnings,
with STALL also retained in the speed readout on every input mode; decorative
RelayWorld navigation lights are excluded from aircraft collision. Regression
coverage exercises simultaneous threats and actual campaign-world light parts.
The corrected engine suite passes 256 tests across 22 suites. The final HUD
text sizing was also rebuilt after that run. Physical device checks remain as above.

Additional CodeRabbit findings were fixed: narrow HUDs use compact stall advice,
the gameplay harness requires a warning label, and phase-spawned protected actors
enter the sweep filter with their visible surfaces queryable after welding.
The resulting Studio suite passes 258 tests across 22 suites. The strengthened
gameplay-harness assertion was subsequently rerun successfully; see the followup evidence below.


## Explicit scenery eligibility followup (2026-10-25)

Scenery collision eligibility now comes from `PartOptions.flightSolid`, never a
display name. Visible parts default to solid; fully invisible parts remain
excluded even with `flightSolid: true`. Cylinder and Disc forward the option,
and Light defaults to decorative with an explicit override available. Existing
shallows, marker/navigation lights, apron/runway paint and lit windows opt out.
Beach, sea/river slabs and structural light fixtures keep their previous
classifications. Water crash reason classification is unchanged.

- Complete Studio engine suite: **259/259 tests, 22/22 suites passing**.
  The actual M1–M27 builders are audited against their previous surface
  classifications, then solids are renamed to “Marker light” and decorations
  renamed before checking the collision allowlist. Primitive sweep regressions
  also cover a solid initially named “Marker light”, renamed decorations,
  Cylinder/Disc/Light option propagation and the invisible exclusion.
- `bun run build:place` succeeded; `git diff --check` passed.
- Opened the freshly built production place as
  `/tmp/skybreak-flight-solid-qa.rbxlx` in normal Studio Play (unpublished,
  session-only persistence). Launched M1 through the normal CampaignRequest
  StartMission endpoint; normal loading/ready/Started and UI handlers ran.
  Injected the **unchanged strengthened** crash/stall LocalScript.
- Harness outcome **Passed**: initial throttle **0.65**, authoritative telemetry
  speed **288.058533 → 119.769384 → 180.120922** studs/s. The required
  WarningText label was found and read **STALL · ACCELERATE + NOSE DOWN**.
  Loss-of-lift, RS deadzone/release/cancel, real TextBox focus/release, recovery
  and LB/RB assertions passed.
- The legal LS dive received exactly **one server MissionState result**:
  **Failed**, **crash_water**, **kills 0**. The ordinary debrief displayed
  “Your aircraft crashed into the water.” No health, kill, position or mission
  state overrides were used. Studio Play was stopped afterward.

These are local production-place gameplay results using bound controller
handlers, not physical controller routing or a published server. Earlier
device/performance/network and full-campaign gameplay limitations still apply.
The new run exercises water impact; the earlier recorded terrain-impact run
was not repeated in this followup.

## Engine, missile and flare effects

All of these use built-in `rbxasset://textures/particles/*` textures, so no assets need uploading.

- `JetFactory.Create` adds an `ExhaustFx` attachment (afterburner flame, glow and a
  PointLight) plus a `WingVapor` emitter on each wingtip. `JetFactory.IsCosmetic`
  covers trails, emitters and lights. `SetTrails` and the client hide/show paths
  (FlightController, EnemySmoothing) switch them all together: server models stay dark
  and local visual clones draw them.
- The player's local visual takes its afterburner from the predicted throttle
  (`EngineFx.Intensity`, which is zero below 45% throttle and smoothsteps to full at max,
  then spools). Vapor appears in hard pulls (stick past 70%) above 200 studs/s. Enemy
  clones hold a constant, modest glow (`EngineFx.EnemyIntensity`).
- Missile smoke is client-only (`src/client/MissileTrails.ts`). A carrier parented to
  Terrain follows each replicated missile's tail with a widening smoke ribbon and
  drifting puffs, so the plume lingers for about 1.6 s after impact. A motor flame and
  light sit on the missile part, and hostile flames are orange-red. Missiles replicate
  exactly as before.
- `JetFactory.Flares` (Flare Pod and EVADE) ejects six magnesium flares relative to the
  jet's frame. Each one kicks out, then drops in an eased arc on a smoke trail.

## Combat threat, evade and aces (round 2)

All numbers live in `CombatService.TUNING` (per act) and the pure rule modules (`ThreatRules`, `EvadeRules`, `AceRules`, `WavePlan`); `Difficulty` multiplies them on top of the Normal values below. Missions 1–4 use the gentle gate.

### Lock envelope (`WeaponRules`)

| | Before | After |
|---|---|---|
| Air targets | 62° half-cone, 2450 studs | **40° half-cone, 1800 studs** |
| Ground targets | 80°, 2450 | 80°, 2450 (unchanged) |
| Drone / lance | range × 1.35 / 3800 | same, air range scaled by 1800/2450 |

### Hostile fire control

Each bandit keeps its own reload. The flight shares one gate between windup starts, divided by the number of live hostiles (`ThreatRules.FlightGate`: +50% per extra hostile, capped), never closer than 1.5 s, and a cap on concurrent threats (lit windups plus missiles in flight, one per two live hostiles). Aces sit outside both: they fire on their own reload while their wingmen wind up. A radar-directed phase (`directed`) halves the gate.

| Act | Gate, one bandit | Max divisor | Gate, five bandits | Threat cap | Bandit reload | Damage | Before (any count) |
|---|---|---|---|---|---|---|---|
| M1–M4 (gentle) | 14 s | 1.5 | 9.3 s | 1 | 10 s | 10 | one windup per 6.9 s |
| I (M5–M9) | 14 s | 2 | 7 s | 1 | 10 s | 10 | one windup per 6.9 s |
| II | 13 s | 2.5 | 5.2 s | 2 | 7.5 s | 12 | one per 5.5 s |
| III | 15 s | 3 | 5 s | 2 | 5.5 s | 13 | one per 4.7 s |

Act III was softened after live playtests (2026-10-26): the scripted pilot, timing every evade, was shot down in Mission 26 on eight straight attempts at gate 12 s / cap 3 / 14 damage / 350-stud decoy / 12 s recharge and a 10-bandit wing. With the values above and an 8-bandit wing it completed M26 in 205 s and 188 s (35 hull) and M27 in 193 s (87 hull).

Ace: reload 9 / 8 / 7 s, +2 damage per missile, salvo 1 / 1 / 2 (2 in every act on Ace difficulty).

### Bandits

| | Before | After |
|---|---|---|
| Hull (required bandits) | 100 / 110 / 110 (two missiles everywhere) | **100 / 130 / 160** (two / three / three missiles); raiders 100 |
| Spawn | 1300–1500 studs, lockable on frame one | **2600–3200 studs** (reinforcements from behind 2000–2400) |
| Defensive break | roll every step while a guided missile is inside 700 (effectively always) | **once per 12 s**: a lock building past 80% inside 900 studs (odds 0 gentle / 0.5 Act I / 1 Acts II–III, ×difficulty), or a guided missile inbound (0.15 / 0.4 / 0.6); a failed roll waits 3 s |
| Flares | none | **Act III bandits carry one**: it pops when a player missile is inside 260 studs and decoys every player missile inside 260 for 2.5 s |
| Speed while extending | player + 24 | **player − 10** (floor 180), so turning back in earns a rear shot |
| Terrain | clamped to 170–1000 only | plus a 200-stud forward ray every third step; a hit pulls the jet up for 0.8 s |

### Evade (`EvadeRules`)

Input-agnostic: keyboard F, gamepad B and the touch EVADE button all send `CombatAction "Evade"`.

| | Before | After |
|---|---|---|
| Uses | unlimited, 6 s cooldown | **3 charges**, each recharging in 10 s (one at a time) |
| What it decoys | every hostile missile within 700 studs, plus 1.6 s of immunity | only missiles **within 450 studs or in their last 1.2 s**, during a 0.6 s window after the press; no immunity |
| Telemetry | `evadeCooldown` | `evadeCooldown` (roll, else 0 with a charge, else time to the next charge), `evadeCharges`, `incomingDistance` |

At Act III burn speed (620) the window means pressing when the missile is inside about 700 studs; a press at 1800 wastes the charge.

### Hostile missiles and dodging (`MissileRules`)

Owner playtest (2026-10-26): flares or EVADE were the only way to survive a missile. Hostile missiles flew 580–740 studs/s for 7–9 s and steered with `direction.Lerp(toTarget, DampAlpha(1.6–2.8))`, which turns in proportion to the angle error with no ceiling (at 90° off it out-turned the jet about 4×). They led the jet by up to 0.9 s, saw it from any angle and through terrain, and fused at 32–48 studs. Every hostile missile now flies `src/shared/MissileRules.ts`, a pure module (plain points, no Vector3) that runs on the server, in Jest and in the offline Luau VM:

1. **Launch on a collision course, and only a fair one.** The shooter fires where a straight-flying jet will be (`LaunchHeading`: `LeadDirection`, at most 0.8 × the seeker cone off the line of sight); the ace salvo fan is added on top. A jet that ignores the missile needs no correction from it and is hit. `ShotClear` refuses a shot that would arrive in under `minLaunch` seconds (Easy 1.6, Normal 1.5, Ace 1.8). It is checked when a windup would start and again at launch; a shooter that closed to point-blank during its windup holds fire and may wind up again 1.5 s later. **No warning without a missile:** the ace, and a bandit whose last windup was held, keep a fair range through the windup (`ThreatRules.KeepsRange`): sat within 60° of the player's tail, they fly for the point `MissileRules.Standoff` studs back on the player's track (the range a tail shot takes `minLaunch` + 0.3 s to cover; Ace + 0.8 s) at the player's speed, falling back while closer. Every other shooter's windup is lit only if the shot is still fair after chasing straight at the player for the whole windup (`ChaseClear`); one that keeps its range is checked on its current line (`ShotClear`).
2. **Burn, then coast.** Full speed for the burn, then `speed × exp(-0.35 t)`. A coasting missile slower than the jet loses the chase; below 160 studs/s it self-destructs.
3. **Capped proportional navigation.** Heading rate = 3 × line-of-sight rate (+0.5/s pursuit), clamped to `turnCap` rad/s. `burnSpeed × turnCap` is the missile's sideways acceleration: 157–198 studs/s² on Normal, under a hard-turning jet's ~325 (290 × 1.12 rad/s).
4. **Seeker cone.** Once the jet is more than `gimbal` off the missile's nose, the lock is gone for good. The missile flies straight on and self-destructs when its life runs out (a small burst). Unlocked missiles never raise MISSILE INBOUND.
5. **Terrain.** Each step's segment is raycast against `AircraftCollision.Parameters` (terrain plus `FlightSolid` scenery, via `AircraftCollision.MissileRay`); a hit detonates the missile there, harmlessly.
6. **Proximity fuse.** Measured on the path relative to the jet through the step (no tunnelling at 600 studs/s), and only if the closest point comes before any terrain hit.

| Value | Act I | Act II | Act III | Easy | Ace | fired by the ace |
|---|---|---|---|---|---|---|
| Burn speed (studs/s) | 560 | 600 | 620 | — | — | — |
| Burn (s) | 3.0 | 3.2 | 3.4 | ×0.75 | ×1.4 | — |
| Turn cap (rad/s) | 0.28 | 0.30 | 0.32 | ×0.75 | ×1.3 | +0.04 |
| Seeker cone (half-angle) | 45° | 45° | 45° | ×1.1 | ×1.3 | +5° |
| Proximity fuse (studs) | 18 | 22 | 26 | — | — | — |
| Life (s) | 7 | 8 | 9 | — | — | — |
| Shortest shot (`minLaunch`, s to impact) | 1.5 | 1.5 | 1.5 | 1.6 | 1.8 | — |

Knobs: `Difficulty` `missileTurn` (Easy 0.75 / Ace 1.3), `missileBurn` (0.75 / 1.4) and `missileGimbal` (1.1 / 1.3). Easy's short burn means many tail shots can be outrun. Ace's harder turn, longer burn and wider cone follow a break started before BREAK shows, and its longer shortest shot means most Ace missiles have that early phase.

**The BREAK cue is a prediction, not a window.** Live play on the first version of this PR (Studio, Normal, M26 and M20 in Act III) showed BREAK for only 2–3 of 7–8 missiles, and breaking on it changed nothing. The causes, found with the closed-loop duel below:

- Bandits kept closing during the 1.7 s windup (the fire gate checked range only at windup start), so most shots launched from 80–600 studs with 0.1–0.8 s to impact: under the 0.9 s window edge, never cued, and too close for any turn.
- A break started under about 1.0–1.3 s to impact never worked, so the lower half of the 0.9–1.8 s window asked for a losing turn, and the cue pilot's reaction time pushed most breaks into it.
- Only one turn direction worked for many geometries, and "away from the missile's side" was the losing one about half the time (for example a 9 o'clock missile at a jet already turning left).

Now the cue tells the pilot both when to **start** and when to **stop** the break (`MissileRules.CueTick`, on the server at each 10 Hz telemetry tick, with a `BreakTrack` per session that remembers the break between ticks):

1. **BREAK ← / →.** For the most urgent locked missile (soonest impact, else nearest) inside 3.5 s, `MissileRules.BreakCue` flies copies of the missile and jet forward with `FlightMath.Step` and `MissileRules.Advance`, the same step function the server's `stepHostileMissile` flies every hostile missile through (open sky, at the server's 1/30 s step): once with the pilot's current stick, then with a hard break started 0.3 s from now (full stick, 0.25 back pressure, full throttle) **held until the missile can no longer hit**, trying the way the pilot is already turning, then away from the missile, then the other way. BREAK shows, with that turn, only when the missile would hit the jet as flown and misses the sustained break.
2. **HOLD ← / →.** Once the pilot pulls the cued way (stick at least 0.5 that way) against the missile BREAK was raised for, the row reads `HOLD → · MISSILE 1.2s`: letting go is not yet safe. It follows that one missile even after its seeker lets go (MISSILE INBOUND then drops, but a blind missile's fuse is still live). A pilot who lets go during HOLD drops the track and gets BREAK again only if a new break would win.
3. **CLEAR** (green, 1 s, then the row clears) once that missile is gone (self-destructed, into terrain, decoyed) or `MissileRules.Unreachable`: it is blind and `BlindPast`, or it is further away than it and the jet could close together in the rest of its life (remaining `Travel` plus 385 studs/s, padded by two steps, beyond fuse + 30 studs). That is a proof about **every** future input, not a predicted release time: a pilot who lets go on CLEAR, pulls on for another two seconds, or goes to any stick or throttle afterwards, is equally safe. A new BREAK for another missile replaces CLEAR.

This replaces 4b09507's fixed release check (the predicted break let go after exactly 1.5 s, and was also flown to the end). The re-check of 4b09507 showed why checking release times cannot close it: the turn escaped letting go at 1.5 s or never, but letting go at 1.6 s was hit (Normal I, the cruise-circle pilot at 232.5 studs/s, a shot from 330° at 1400 studs); with the cue protocol the row still reads HOLD at 1.6 s, and that case is a regression in `MissileDuel.spec.ts` (with the Easy I, 320 studs/s, 30°, 1400 studs case from the same re-check), on both sides.

Telemetry carries the cue in the flags word (`TelemetryCodec`): 128 BREAK, 512 HOLD, 1024 CLEAR (at most one is set), and 256 says the BREAK / HOLD turn is to the right; 64 (paused) and field 25 (pauseAck) are unchanged. During HOLD, `incomingSeconds` is the followed missile's time to impact (absent once it is no longer closing: `HOLD →`).

A prediction counts as a miss only once the missile **can no longer hit**: it self-destructs (out of life, or coasting below 160 studs/s), or `Unreachable` holds (the same closed form CLEAR uses). Losing the lock or passing the jet is not enough: a blind missile flies straight on with a live fuse, and a break can carry the jet back across its path (the re-review of 2a1dc51 reproduced exactly that, Easy I hit at 3.47 s and Normal III at 6.27 s after the cue had called the break safe; both are regression cases in `MissileDuel.spec.ts`).

**Cost.** BREAK runs at most three predictions (it was five: the 1.5 s release check is gone) for one missile per player, each bounded by the missile's remaining life (≤ 30 × life + 2 steps), so ≤ 816 flight/missile step pairs per call in Act III in theory (was 1,360). HOLD and CLEAR run no prediction at all: one closed-form `Unreachable` for the followed missile, and while HOLD shows no other missile is predicted. Over the duel grid (cue and ignoring pilots, 39,223 cue calls) a call averaged 36 pairs with a maximum of 274 (4b09507: 114 and 413); the 9,237 HOLD calls cost 0. The 274-pair call, repeated 1,000 times in the offline Luau CLI, took 7.7 ms per call (best of five) on a shared machine at a load average near 100, so that time is an upper figure, not a server measurement (the re-check measured 3.8–7.8 ms for a 493-pair call). The server runs one mission session (`CombatService.StartMission`); immediate telemetry on radio and action events also runs the cue, as before.

**How a player dodges**, in the order the HUD teaches it:

- The warning box keeps `MISSILE INBOUND`; the HUD's break-cue row under it shows the most urgent locked missile: `MISSILE 7 O'CLOCK ↓ 2.1s` (narrow rows: `MISSILE ↓ 2.1s`). The arrow points where the missile is (↑ ahead, → right wing, ↓ tail, ← left wing), and the seconds are range ÷ closing speed. Where that row is the warning row itself (compact roots, and the shortest ones where both are the objective line), the cue replaces `MISSILE INBOUND` in the one shared text instead (`MISSILE ↓ 2.1s · LOW SPEED`), so two labels never overlap. The long wording is used only when it fits the row's width at its text size (`MissileCue.Route`), so `POWER↑` is never truncated.
- When a break now would win, it becomes `BREAK ← · MISSILE 1.4s` (narrow: `BREAK ←`). Turn hard the way the arrow points; the server has checked that turn, and it can be toward the missile's side. Below 285 studs/s the cue adds `POWER↑`, on narrow screens too (`BREAK ← POWER↑`), because the checked break is at full throttle.
- While pulling it reads `HOLD ← · MISSILE 1.2s` (narrow: `HOLD ←`, `POWER↑` as for BREAK): keep pulling. When it reads `CLEAR` in green, let go whenever you like; it clears after a second. HOLD and CLEAR stay in the row even after MISSILE INBOUND drops, and on shared rows they go ahead of any flight advice (`HOLD ← · STALL`).
- A missile that is going to miss anyway (burnt out, outrun) shows no BREAK. A long tail shot is outrun at full throttle once the burn ends. Flying low behind a ridge makes the missile hit the ridge.
- EVADE (3 charges, inside 450 studs or the missile's last 1.2 s) and the Flare Pod special are unchanged.

**Closed-loop duel** (`src/tests/MissileDuel.ts`, enforced by `MissileDuel.spec.ts` offline and in Jest). A bandit starts its windup at every 30° around the jet, at six ranges across the act's fire range, nose on; it chases through the windup the way `stepEnemies` flies an attacking bandit, then fires through `ShotClear` and `LaunchHeading`. The jet circles left at 0.35 stick and cruise throttle (the live test's pilot). Pilots: *ignore*; *cue* (reads the row: on BREAK, exactly the break the cue checked, 9 steps (0.3 s) later, full stick the arrow's way, 0.25 back, full throttle; keeps pulling while HOLD shows; lets go 9 steps after CLEAR shows, to neutral stick at full power; again on a later BREAK. Before this PR's last change it let go after a fixed 45 steps, 1.5 s, back to circling); *away* (the same pull, always away from the missile's side: the old arrow); *beam* (on BREAK, turn onto the nearer heading square to the missile's line of sight and hold it); *early* (the cue pull started at launch); *run* (full throttle straight ahead; rear-hemisphere shots only). Each cell below is the share of launched missiles that **hit**, except "BREAK shown" (share of ignored hits that showed BREAK), "cue dodges" (share of cue-pilot breaks that dodged) and the cue-pilot counts. Two telemetry phases, 144 windups per row.

Before (the PR's first version: fixed TTI window, away arrow, no launch gate; reaction 0.25 s):

| Level | Act | Ignored: hit | BREAK shown | Cue pilot: hit | Beam: hit | Early: hit | Run: hit |
|---|---|---|---|---|---|---|---|
| Easy | I / II / III | 83 / 86 / 89% | 42 / 48 / 58% | 55 / 54 / 53% | 64 / 71 / 72% | 38 / 43 / 51% | 71 / 75 / 76% |
| Normal | I / II / III | 96 / 100 / 100% | 49 / 56 / 62% | 55 / 56 / 64% | 74 / 82 / 91% | 42 / 61 / 76% | 81 / 83 / 88% |
| Ace | I / II / III | 100 / 100 / 100% | 48 / 54 / 61% | 57 / 64 / 94% | 83 / 94 / 100% | 56 / 83 / 97% | 82 / 88 / 90% |

4b09507 (reaction 0.3 s; `ChaseClear` windup check; *run* starts at full speed; the cue flies blind missiles to the end; BREAK checked for a 1.5 s pull and a sustained one). "Cue pilot" is breaks flown exactly as cued, letting go after 1.5 s / of those, hit; "kept pulling" is the same pilot never letting go of the break:

| Level | Act | Shots taken / held | Ignored: hit | BREAK shown | Cue pilot: breaks / hit | Kept pulling: hit | Away: hit | Beam: hit | Early: hit | Run: hit |
|---|---|---|---|---|---|---|---|---|---|---|
| Easy | I | 30 / 114 | 60% | 100% | 18 / 0 | 0 | 0% | 13% | 7% | 23% |
| Easy | II | 36 / 108 | 67% | 100% | 24 / 0 | 0 | 6% | 33% | 3% | 38% |
| Easy | III | 44 / 100 | 77% | 100% | 34 / 0 | 0 | 9% | 45% | 5% | 41% |
| Normal | I | 44 / 100 | 95% | 100% | 42 / 0 | 0 | 5% | 45% | 18% | 55% |
| Normal | II | 50 / 94 | 100% | 92% | 46 / 0 | 0 | 12% | 64% | 40% | 60% |
| Normal | III | 56 / 88 | 100% | 93% | 52 / 0 | 0 | 18% | 75% | 43% | 58% |
| Ace | I | 38 / 106 | 100% | 95% | 36 / 0 | 0 | 5% | 68% | 58% | 65% |
| Ace | II | 44 / 100 | 100% | 91% | 40 / 0 | 0 | 14% | 91% | 68% | 78% |
| Ace | III | 52 / 92 | 100% | 77% | 40 / 0 | 0 | 31% | 100% | 85% | 84% |

Holding the break for 1.6, 2, 2.5, 3, 4 or 6 s instead of 1.5 s: 0 of 332 breaks hit on this grid, but the re-check of 4b09507 found fair shots off it where letting go at 1.6 s lost, which the HOLD / CLEAR cue below answers. With a 0.15 s or 0.45 s reaction, or 0 or 0.6 back pressure (breaks the cue did not check), cue dodges stay at 88–100% on every row. On Ace, of the shots where BREAK first shows 0.7 s or more after launch, a break 0.7 s before the cue pilot's is hit every time (53 of 53). The working window of break start times (a 1.5 s pull) has a median of 1.3–1.6 s on Easy and Normal and 0.9–1.3 s on Ace.

Reading it: on Normal an ignored missile hits (95–100%), BREAK shows for 92–100% of them, and following BREAK dodges every time in the grid, whether the pilot lets go after 1.5 s or keeps pulling. On Easy following BREAK dodges every time and 59–77% of rear shots are outrun at full throttle. On Ace BREAK shows for 77–95% of hits and following it dodges; breaking before it is followed. A beam turn (the nearer perpendicular heading, held) is not a reliable defence in this model; the sustained hard break the cue asks for is. "Held" counts windups the gate refused, mostly bandits starting inside about 1000 studs nose-on, which would otherwise have been free hits; they wind up again when the geometry allows. With `ChaseClear` nearly all of them are refused before the windup lights, so no warning shows. The coordinator's live test should watch whether that lowers threat pressure too much.

Now (BREAK / HOLD / CLEAR, 2026-10-26, same grid). *Cue pilot* breaks on BREAK, pulls through HOLD and lets go on CLEAR; *never lets go* is the same pilot pulling to the end; *let go 0.1–2 s after CLEAR* replays each cleared break letting go 1–20 telemetry ticks later (to neutral stick); *let go during HOLD* replays each break letting go a reaction after every third HOLD sample (0.3 s apart), and how many of those were within the last second before CLEAR. HOLD is from the break's first pulled step to CLEAR. *Early* is a 1.5 s pull started 0.7 s before the cue pilot's.

| Level | Act | Shots | Ignored: hit | BREAK shown | Cue pilot: breaks / hit | Never lets go: hit | CLEAR shown | Let go 0.1–2 s after CLEAR: hit | Let go during HOLD: hit (last 1 s) | HOLD mean / longest | Early: hit | Run: hit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Easy | I | 30 | 60% | 100% | 18 / 0 | 0 | 18 | 0 of 360 | 22 of 186, 12% (0 of 58) | 3.1 / 3.9 s | — | 23% |
| Easy | II | 36 | 67% | 100% | 24 / 0 | 0 | 21 | 0 of 420 | 34 of 214, 16% (0 of 64) | 3.1 / 4.0 s | — | 38% |
| Easy | III | 44 | 77% | 100% | 34 / 0 | 0 | 31 | 0 of 620 | 47 of 329, 14% (0 of 103) | 3.2 / 4.3 s | 0 of 2 | 41% |
| Normal | I | 44 | 95% | 100% | 42 / 0 | 0 | 42 | 0 of 840 | 71 of 400, 18% (0 of 143) | 2.8 / 3.8 s | 0 of 3 | 55% |
| Normal | II | 50 | 100% | 96% | 48 / 0 | 0 | 44 | 0 of 880 | 91 of 419, 22% (1 of 153) | 2.8 / 4.0 s | 33% | 60% |
| Normal | III | 56 | 100% | 100% | 56 / 0 | 0 | 51 | 0 of 1,020 | 143 of 497, 29% (2 of 172) | 2.9 / 4.1 s | 33% | 58% |
| Ace | I | 38 | 100% | 100% | 38 / 0 | 0 | 35 | 0 of 700 | 133 of 312, 43% (0 of 111) | 2.7 / 3.4 s | 100% | 65% |
| Ace | II | 44 | 100% | 100% | 44 / 0 | 0 | 42 | 0 of 840 | 180 of 377, 48% (0 of 140) | 2.7 / 3.5 s | 100% | 78% |
| Ace | III | 52 | 100% | 100% | 52 / 0 | 0 | 51 | 0 of 1,020 | 253 of 457, 55% (2 of 165) | 2.7 / 3.6 s | 100% | 84% |

Reading it: BREAK now shows for 96–100% of the missiles that would hit on every level (it was 77–95% on Normal II–III and Ace while it also had to win a 1.5 s release). Following the row never loses, whether the pilot lets go on CLEAR, up to 2 s later, or never; the other breaks the cue pilot took ran past the missile's self-destruct still in HOLD (in the server a missile that self-destructs shows CLEAR). Letting go while HOLD shows is hit 12–29% of the time on Easy and Normal and 43–55% on Ace, so HOLD means something; CLEAR is conservative (only 5 of 1,109 releases in the second before it were hit), which costs the pilot about a second of extra pull. A break held through HOLD takes 2.7–3.2 s on average and at most 4.3 s.

The spec flies both telemetry phases and enforces, on every level and act, **zero** hits on a pilot who breaks on BREAK, pulls through HOLD and lets go a reaction after CLEAR, on the same pilot letting go at every 0.1 s from 0.1 to 2 s later, and on one who never lets go (a percentage would let a false winning cue back in); and that letting go during HOLD is hit at least once (HOLD is not decoration). Per act it also keeps: Normal ignored hits ≥ 85% and BREAK on ≥ 90% of hits; Easy ≥ 40% of rear shots outrun and ignored hits ≥ 50%; Ace BREAK on ≥ 50% of hits, ignored hits ≥ 85%, and ≥ 75% of early breaks hit. Off the grid, 180 seeded shots (any bearing, range across the act's fire range, telemetry phase and cruise throttle; 45 drew a BREAK and 44 a CLEAR) require zero hits on the never-let-go pilot and on three releases per cleared break at a random step 0–60 after CLEAR's reaction, each to a random stick, back pressure and throttle. It replays the first review's head-on case (a jet at 320 meeting a missile launched 1500 studs ahead, Normal Act III, following the first BREAK escapes), the re-review's two blind-fuse cases on both sides (Easy I, 320 studs/s, bearing 60°, 1100 studs; Normal III, 285 studs/s, bearing 120°, 1500 studs: at every 10 Hz sample, whenever the prediction calls a break safe, flying that break to the end with `MissileRules.Step` alone agrees, and following the cue escapes) and the re-check's two release cases on both sides (the row reads HOLD when the 1.6 s pilot lets go, the Normal one is then hit as reported, and pulling through HOLD to CLEAR escapes, the row reading BREAK, HOLD, CLEAR in that order). It checks `BlindPast` directly (a burning missile pulling away is clear; a slow one the jet is catching, or a blind one coming head-on, is not), that BREAK stays dark for a missile that will burn out and for an unlocked one, and the launch gate.

`src/tests/MissileRules.spec.ts` keeps the single-engagement contracts: an ignored missile hits from four aspects on every level; a 500-stud break misses on Normal; a too-late break still hits; long tail shots are outrun after the burn; the seeker cone drops a lock for good; a ridge (an injected ray) takes the missile; and the fuse catches a 15-stud pass but lets 30 go. `src/tests/MissileCue.spec.ts` covers the HUD wording, and `AircraftCollision.spec.ts` covers the real raycast set (a ridge detonates the missile, a painted overlay does not).

**Engagement cadence** (`src/tests/EngageSim.ts`, enforced by `EngageSim.spec.ts` offline and in Jest). The real jet circles at cruise against 1–4 bandits and/or the ace flying `stepEnemies`' pursuit, overshoot and fire control under `CombatBalance`'s flight gate, divisor and cap, the launch gate and the standoff (3 seeds × 240 s; AceRules stages, notches, defensive breaks, flares and terrain are left out, so a real fight fires less). With the launch gate alone, the ace sat about 600 studs behind the turning jet, closed inside the shortest shot during nearly every windup and held it: MISSILE LOCK with no missile.

Ace launches per minute against the circling pilot (the ace alone; with two bandits up in brackets):

| Level | Before: launch gate only (windups held) | After | Target |
|---|---|---|---|
| Easy | 0.08 / 0.17 / 0.25 (89 / 83 / 79 of 91 / 86 / 82) | 1.75 / 1.75 / 1.75 (1.75 / 1.75 / 1.75), 0 held | 1.2–2.0 |
| Normal | 2.67 / 2.75 / 2.75 (1 / 0 / 2 of ~34) | 2.83 / 2.83 / 2.75 (2.92 / 2.75 / 2.75), 0 held | 2.5–3.5 |
| Ace | 0.42 / 0.17 / 0.17 (84 / 88 / 88 of ~90) | 5.83 / 5.42 / 5.42 (5.75 / 5.50 / 5.58), 0 held | 5–6 |

Columns are Act I / II / III. The ace now launches nearly every windup, so its reload sets the cadence; Easy's ace reload is ×2 (30 s) so it is not over-corrected. Ordinary bandits (1, 2 and 4 bandits; windups / launches / held, longest run of held windups by one bandit):

| Level | Act | Before | After |
|---|---|---|---|
| Easy | I / II / III | 86/55/30 (4) · 99/84/14 (2) · 99/84/15 (3) | 83/61/21 (2) · 99/92/5 (1) · 99/94/4 (1) |
| Normal | I / II / III | 117/83/34 (3) · 137/99/37 (5) · 137/106/30 (3) | 114/94/19 (2) · 140/108/30 (2) · 136/117/18 (1) |
| Ace | I / II / III | 163/117/44 (4) · 174/125/48 (2) · 172/138/33 (2) | 158/133/24 (2) · 169/142/25 (1) · 166/151/13 (1) |

The spec enforces the ace bands above in every act (and in Act III with two bandits up), no held ace windup, no bandit holding more than two windups running, ≥ 70% of bandit windups launching, and that every launch (bandit and ace) has at least the level's `minLaunch` to impact. With the *cue* pilot (each BREAK pulled through HOLD and let go back to circling after CLEAR, two bandits and the ace up, every level and act) it requires zero hits by a missile whose BREAK the pilot followed with no other missile's break followed since. Each followed break lets go a different delay after CLEAR, 0, 0.1, … 2 s in turn (the second seed starts at 1 s), so every delay is flown in every level. Over seeds 11 and 23 that pilot followed 9–44 such breaks per level and act, let go after CLEAR on 8–44 of them, and none was hit; the hits it did take (0–9 of 7–33 launches per run) all came from missiles it could not answer, mostly while already pulling for another one (HOLD follows one missile at a time).

**Normal Act III hull.** #40's contact windows (`MissionPacing.ContactWindows`) × the measured Normal Act III launch rate for that many live bandits (and the ace's, +2 damage) × the measured hit share (ignore: 97–100%; breaking on every BREAK: 0–13%, re-measured with the blind-fuse fix). Lit warnings stay at the same rate (383 → 382 over the bandit runs), but a held windup was a lost window, so with fewer of them bandits launch about 11% more (280 → 312 launches):

| Pilot | Before (M19–M25 · M26 · M27) | After |
|---|---|---|
| Ignores every missile | 92–97 · 108 · 118 | 105–109 · 122 · 128 |
| Breaks on every BREAK | 1–4 · 3 · 4 | 1–3 · 1 · 7 |
| 50/50 mix (end hull) | 47–50 (50–53) · 56 (44) · 61 (39) | 53–56 (44–47) · 62 (38) · 68 (32) |

(The PR's first version estimated 50–59 end hull for the 50/50 pilot with a coarser rate model; the "before" column re-measures it with this one.)

PR #37's threat cap and gates are unchanged. A missile that has lost its lock still counts against the cap until it self-destructs (at most its life, 7–9 s), so a dodge buys breathing room rather than an instant next shot.

### Aces (`AceRules`)

| | Before | After |
|---|---|---|
| Hull (Normal) | 220 / 260 / 320 × act scale (220 / 299 / 416) | **300 / 400 / 500** (M2's legacy ace stays 165) |
| Hits to kill at 55 | 6 / 6 / 9 | 6 / 9 / 12 |
| Stage line (2/3, 1/3) | 1.2 s invulnerable | **3 s invulnerable, lock reset to 0**, then a retreat beyond 1800 studs (or 10 s), a call for the phase's raiders, a hold off while they fight (until they are down, or 25 s), and a return with an `aceReturns` line. Hits still land during the retreat and hold, but stop above the next line (short of the kill in the last stage) until the ace has turned back in, so no stage's call or return is skipped |
| Flares | 2 / 3 / 4, each eats one missile, 5 s apart | 2 / 3 / 4, each **decoys every player missile within 260 studs for 2.5 s**, 6 s apart |

### Difficulty

| Knob | Easy | Normal | Ace |
|---|---|---|---|
| Hostile gate and reloads | ×1.25 (was 1.5) | 1 | ×0.7 |
| Ace reload (`aceGate`) | ×2 (was 1.25; PR #42: the ace now launches nearly every windup) | 1 (15 s) | ×0.5 |
| Bandit hull | ×0.75 (was 0.85): Act II bandits become two-missile kills | 1 | ×1 (was 1.15) |
| Protected-actor drain | ×0.75 | 1 (0.55 per raider per s) | ×1.25 |
| Behaviour | — | — | every bandit breaks close locks and carries a flare; aces fire two missiles per windup; every raider wave brings one more, and the live-aircraft budget rises from 7 to 8 to match |
| Hostile missiles | turn cap ×0.75 (was missile turn ×0.8), burn ×0.75, seeker cone ×1.1, shortest shot 1.6 s | 1 (shortest shot 1.5 s) | turn cap ×1.3 (was ×1.2), burn ×1.4, seeker cone ×1.3, shortest shot 1.8 s |

Damage, windup, ace hull, break odds and score multipliers are unchanged from the difficulty selector (#33); the missile knobs now drive `MissileRules` (see above).
