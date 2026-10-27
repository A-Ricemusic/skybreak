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
| Centred stick | Attitude hold. Only a stall, the ceiling, the airspace edge or the opt-in level assist move the nose. |
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

Throttle selects an engine target between 70 and 320 studs/s. Engine acceleration
toward it is `0.7 × (target − speed)`, capped at +28/−32 studs/s². Climbing costs
`38 × sin(climb angle)` studs/s² and diving returns the same. The default 65%
setting settles near 233 in level flight. Measured with `FlightMath` (offline):

| Manoeuvre at 65% throttle | Result |
|---|---|
| Full-stick loop from cruise | 5.0 s, ~340 studs tall, slowest point 200 studs/s, ends level and upright within ~45 studs of the entry altitude |
| Full-stick loop at 50% / 40% | slowest 163 / 138 studs/s (40% just touches the stall at the top) |
| Held 15° / 30° / 45° / 60° climb | settles near 218 / 205 / 195 / 183 studs/s and keeps climbing |
| Held vertical climb | still 170 studs/s after 800 studs; idle throttle eventually stalls and the nose falls through |

Below 165 the HUD warns of low speed; below 140 it warns STALL and asks for
acceleration plus nose down. Lift falls progressively (up to 65 studs/s of
sink), steering authority drops to 30%, and the nose sags toward the ground (up
to 0.6 rad/s, about the horizontal axis that gets there the short way, so an
inverted jet at the top of a slow loop is pulled through rather than flipped).
This is an arcade energy stall, not an angle-of-attack model. Full throttle and
a lowered nose restore speed and authority if altitude remains.

Above 950 studs the ceiling swings the nose down (as before, toward
`−(altitude − 950)/160` rad) and the altitude is clamped at 1050. Past the soft
boundary the heading turns back toward the centre about world up. On 0.7 s of
input silence (a suspended phone app, a dropped connection) the server centres
the stick and engages the level assist, so a held dive does not continue into
the ground while nobody is flying.

## Prediction, packets and camera

The client predictor reconciles position, the attitude quaternion (compared as
an angle; `q` and `−q` are the same attitude), the lean and speed, never the
derived angles, which jump by π passing the vertical. The 20 Hz state packet is
`[sequence, x, y, z, qw, qx, qy, qz, lean, speed, evadeRemaining,
echoedClientTime, hold]` (13 numbers). The input packet adds `assist`.

The chase camera ignores the turn lean and the evade roll but rolls with the
jet's canopy, smoothed at 5/s (about 0.2 s behind in a full-stick loop), so it
rides through loops and inverted flight instead of flipping at the vertical.

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
