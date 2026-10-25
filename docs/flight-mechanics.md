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
adjust throttle, Shift temporarily commands full power, and touch +/- remains.
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
gameplay-harness assertion has not been rerun in a new gameplay session.
