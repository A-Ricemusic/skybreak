# Flight model, ground impacts, throttle and stalls

FlightMath is the single numeric integrator for the authoritative 30 Hz server,
the fixed-step client predictor, the QA pilot and the offline simulations. There
is no minimum altitude or automatic pull-up. The horizontal world recovery, hard
edge and ceiling remain.

## Attitude: rate-commanded, attitude hold, full loops

The jet's orientation is a unit quaternion (`qw, qx, qy, qz` in `FlightState`,
Roblox CFrame axes: right +X, up +Y, nose -Z). It is the only attitude that is
integrated, so there is no gimbal lock: the nose can go straight up, over the
top inverted and down the back of a loop. `yaw`, `pitch` and `roll` are derived
from it after every step (`FlightMath.Sync`) for the HUD, radar, AI and
telemetry; nothing steers by writing them. Use `FlightMath.ForwardOf/UpOf/RightOf`
for the jet's axes and `FlightMath.Visual` for the drawn CFrame quaternion.

The stick commands **rates**, not angles. Let go and the jet **holds** its
heading, pitch and upright/inverted attitude (no auto-level):

| Input | Effect |
|---|---|
| Stick up / down (touch left stick, gamepad LS, W/S, mouse steer) | Pitch rate about the wings, full stick 1.25 rad/s (72°/s). Held, the jet flies a full vertical loop: inverted over the top, upright at the bottom. INVERT PITCH flips it. |
| Stick left / right (touch left stick, LS, A/D) | Heading rate about world up, full stick 1.15 rad/s, with a cosmetic bank into the turn (up to 0.85 rad) that eases out when the stick centres. Inverted, the sign flips so the nose still moves toward the pilot's own left/right on screen. Within ~17° of straight up or down, heading authority fades to zero (pitch out of the vertical first). |
| Centred stick | Attitude hold. Only a stall, the airspace edge or the opt-in level assist move the nose. |
| Settings → LEVEL ASSIST (default **OFF**) | With a centred stick, eases the nose to the horizon (≤ 0.5 rad/s) and rolls an inverted jet upright (1.2 rad/s). Any stick input overrides it at once. |

Stick shaping is `v·(0.5 + 0.5|v|)`: half stick gives 37.5% rate for fine aim,
full stick full rate. Stall authority (below) scales both rates.

**Why bank-to-turn was not chosen for phones.** A phone has one steering stick
(two axes) for three rotations. Ace Combat's "Normal" mode solves that by making
roll automatic and auto-levelling it, which is what the owner asked to remove;
a roll-on-X ("Expert") scheme makes a held stick barrel-roll and needs a pull to
turn, and with attitude hold a banked jet would keep turning after release
(heading not held). So the left stick moves the nose where the thumb pushes it
on screen: up/down pitches, left/right turns, and the jet banks visually while
turning. The base attitude stays wings-level or inverted (heading turns about
world up and pitch about the wings never introduce a bank), so the horizon on a
phone is always readable, and loops, Immelmann-style half loops and inverted
flight all fall out of pitch alone. True roll control is not exposed; the
quaternion state supports adding it later for gamepad/keyboard.

## Energy

Throttle is a held speed command, not a persistent lever. Right stick/touch up,
E/R1 or Shift boost; right stick/touch down or Q/L1 brake. Releasing commands
300 studs/s. The normalized wire/FX/audio value stays 0..1: 0 targets 70,
0.65 targets 300, and 1 targets 320, with linear interpolation on each side.
The 0.18 axis deadzone rejects drift. Engine response is 2.5 × speed error,
capped at +120/−100 studs/s². Airspeed changes continuously; even release from
minimum speed returns within 5 studs/s of cruise in three seconds. Climbing,
diving and turning do not change the speed target or subtract engine power.
Only a held brake can sustain slowing into LOW SPEED (<165) or STALL (<140).
Stalls still reduce lift/authority and drop the nose; neutral restores engine
power without requiring a dive or another control input.

Release, Cancel, focus/text entry, disconnect and pause clear held controls.
Server input silence after 0.7 s commands cruise, centres steering and enables
level assist. Pause also resets the server speed command. The client predictor
uses exactly the same speed curve and fixed-step integrator as the server.

The former 950-stud forced push-over is removed. Full-rate loops at 300 span
480 studs and take about five seconds, including above altitude 950. From
altitude 3000 to 3600 upward translation eases proportionally to remaining
headroom, approaching the upper boundary without a position snap. Attitude and
airspeed remain pilot controlled, and downward travel immediately works at full
speed. This intentionally makes velocity differ from nose × airspeed at the
outer ceiling; it is an arcade world boundary. Horizontal recovery is unchanged.
The existing mission spawn (250, level) has space for an upward loop; terrain
and deliberate downward loops still require pilot clearance.

## Studio acceptance route (manual gameplay still required)

Build with `bun run build:place`, open `build/skybreak.rbxlx` in a separate Studio
window and Play. Start a sortie with LEVEL ASSIST off. Use keyboard first, then
physical gamepad and phone/touch emulation; physical touch needs device testing.

1. Leave throttle centred: verify 300±5. Hold boost, release, verify 300±5 within
   3 s. Brake to LOW SPEED, release, verify recovery above 165 and then 300
   without another input (within 3 s even from minimum speed).
2. Climb and turn for 10 s without braking; verify no LOW SPEED. Fly three full
   vertical loops from altitude 500, then around 950. Verify upright completion,
   speed above 165 and continuous attitude through vertical/inverted transitions.
3. Repeat braking/release with Q/E, RS, touch. Repeat Cancel, pause/menu,
   focus/text entry and gamepad disconnect while braking; resume with cruise.
   For Studio focus auto-pause set Workspace.SkybreakAutoPause=true.
4. Inspect `FlightController.GetActive():GetControlStateForStudio()` from the
   client: raw RS/touch axes, normalized command, predicted position/speed,
   quaternion, reconciliation outcome/RTT and pending correction are returned
   on demand, with no production logging. Sample alongside authoritative
   FlightState packets/telemetry to check drift or repeated snaps. The existing
   Studio gamepad simulation method can exercise End/Cancel through the real
   bound-input handler; it does not prove physical device routing.

## Prediction, packets and camera

The client predictor reconciles position, the attitude quaternion (compared as
an angle; `q` and `−q` are the same attitude), the lean and speed, never the
derived angles, which jump by π passing the vertical. The 20 Hz state packet is
`[sequence, x, y, z, qw, qx, qy, qz, lean, speed, evadeRemaining,
echoedClientTime, hold]` (13 numbers). The input packet adds `assist`.

The chase camera ignores the turn lean and the evade roll but rolls with the
jet's canopy, smoothed at 5/s (about 0.2 s behind in a full-stick loop), so it
rides through loops and inverted flight instead of flipping at the vertical.

Right-stick and right touch stick share the held command/deadzone described
above. Left touch steering remains independent; a third finger can press FIRE,
TGT or SPECIAL. The HUD displays actual speed and normalized throttle.

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

## Validation of neutral-cruise fixes

The implementation passed the compiler, 482 offline Luau contracts, and 55
Studio Jest tests across Flight, FlightPrediction, FlightWarnings and TouchSticks.
No genuine sortie, physical gamepad, physical touch, or client/server correction
inspection was performed for this revision. Use the acceptance route above.

## Historical validation before neutral-cruise fixes

The evidence below describes previous revisions and does not verify the new
speed curve, recovery timings or ceiling. References to climb energy and the
old ceiling are superseded by the rules above.

The flight-model rework (rate-commanded attitude) is covered by `Flight.spec`
and `FlightPrediction.spec`, which now also run in the offline Luau runner
(`bun run test:offline`): a full loop at 65% (inverted at the top, upright and
level at the end, never below 165 studs/s), no gimbal flip through the vertical,
attitude held for 3 s after release, a held 30° climb gaining altitude every
second for 6 s, climb/dive/throttle energy, stable inverted flight with
screen-relative turns, opt-in level assist, the ceiling, quaternion
reconciliation through a loop and the 13-number state packet round-trip. The
M3–M27 navigation-volume contracts fly the updated `NavigationPilot`. It has
not yet been played in Studio or on a device.

The crash/stall gameplay harness below was updated for rate control: it raises
the nose about 20° with LS, releases and asserts the climb attitude holds to
850 studs, levels off, then runs the stall checks and pulls out of the recovery
dive before the remaining checks. Its earlier recorded results predate the
rework.

The implementation was validated in Studio on 2026-10-25. Tests run in
Roblox Studio through `bun run test:roblox`, not Bun's JavaScript VM.
`bun run build:place` builds the production place without test modules.

For gameplay, start a fresh mission in normal Studio Play, then inject
`tools/playtest-crash-stall.client.luau` as a normal client LocalScript. The harness
climbs with LS (a short input, then attitude hold), adjusts throttle through RS, checks neutral/deadzone/cancellation,
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

At Act III missile speed (740) the window means pressing when the missile is inside about 800 studs; a press at 1800 wastes the charge.

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
| Bandit hull | ×0.75 (was 0.85): Act II bandits become two-missile kills | 1 | ×1 (was 1.15) |
| Protected-actor drain | ×0.75 | 1 (0.55 per raider per s) | ×1.25 |
| Behaviour | — | — | every bandit breaks close locks and carries a flare; aces fire two missiles per windup; every raider wave brings one more, and the live-aircraft budget rises from 7 to 8 to match |

Damage, windup, missile turn, ace hull, break odds and score multipliers are unchanged from the difficulty selector (#33).
