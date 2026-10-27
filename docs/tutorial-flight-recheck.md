# PR54 tutorial / flight / boundary recheck

## Scope and exact code

Original PR54 head: `e591576a850173166cfb647866c6ed27bb17f888`.
Rebased onto main `483abdf1ece1e5182d394a4a48fae38e94ad41c1`, which merged
PR55 (`520ed301706b2af3ff88a6f003273579f7b7e18a`). The FlightMath conflict
retains PR54's speed constants and PR55's WorldAirspace references. World and
mesh sources/assets and world regression entries are unchanged from main.

Used only existing Studio `d6047349-ad94-44b2-98f7-11a94c278ef8`, initially
loaded from the parent's combined `93b7f41` production place. All 107 production
script sources matched the rebased compilation by byte length and Adler32,
except the intentional UILayout instruction edit. Patched that one module in
Edit, then restarted Play. No other gameplay source was patched. The delivered
production place and SHA256/source manifest are in this worktree's `build/`.
Temporary regression modules were removed before production Play.

## Diagnosis and minimal fix

The movement HUD uses `getTutorialInstruction` in preference to the authoritative
objective. Its old generic control hint omitted the required three seconds of
turning and pitching, so the visible prompt did not explain how to advance.
The hint now names the input and both durations, including pitch up/down, within
the existing 34-byte line budget. A regression checks these requirements and
the existing viewport/text-length suite remains intact. Physics, mission gates,
spawn, target placement, missile guidance, enemy speeds, damage and balance are
unchanged. Rate control still holds attitude on release: use brief alternating
pitch corrections, rather than holding a dive while reading a prompt.

The initial Normal M1 production-API pilot completed in **38.0746 s**, with
**4 total kills / 1 ground kill** and 100 hull at its last sample. It used real
server missile resolution and mission progression. The diagnostic initially
also pressed FIRE twice during the target teaching step; those presses could
only be blind shots because that phase is not damageable. The successful radar
shots were issued during `tutorial_missile`, at 1039 and 848 studs. The checked-in
pilot was corrected to avoid premature presses and an invalid first sampling dt.
The corrected clean rerun on the final production sources completed in
**35.3260 s**, again **4 kills / 1 ground kill**, with 100 hull at its last
sample. Every FIRE press was in the missile or bandit phase. The first radar
shot was at 1024 studs; the radar was down by 17.426 s. Evidence:
[pr54-final-m1.json](evidence/pr54-final-m1.json).

Raw initial evidence: [pr54-baseline-m1.json](evidence/pr54-baseline-m1.json).

The eight-second neutral spawn corridor (1280 studs at 800 mph) is clear under
the production AircraftCollision allowlist and 4-stud sphere sweep. Spawn has
no overlapping FlightSolid parts; terrain directly below is Y=-16, giving 266
studs clearance. This does not protect intentional dives, terrain elsewhere,
or an aircraft already overlapping scenery. The live pilot keeps ground-attack
clearance, extends close passes, and accelerates to chase bandits.

The reported locked radar miss at 428 studs / 409 mph did not reproduce in the
successful live attack. A separate read-only numeric trajectory check, matching
production guided steering at 30 Hz, hit a stationary target at distance 428
for initial angles 0/40/60/80 degrees, in 0.533–0.600 s (750 studs/s missile,
36-stud fuse). This is a geometry check, not a replay of the unrecorded shot.
No guidance tuning is justified by that report alone.

## Speed and boundary reconciliation

800 mph means 160 studs/s. Four simulated seconds at that level speed cover
**640 studs**, not 1000–1600. A numeric regression now asserts the distance.
Input selection is distinct from actual speed and the controller's physics
state is distinct from wall time spent loading/paused. The diagnostic logs
wall time, authoritative elapsed time, sample interval, selected/predicted/server
speed, flight commands, pose and boundary excess.

The live safe-altitude orbit retained exact absolute selections for six seconds:

| Selected MPH | Predicted MPH at end | Server MPH at end |
| --- | --- | --- |
| 800 | 799.878 | 799.873 |
| 980 | 979.994 | 979.994 |
| 1900 | 1899.980 | 1899.976 |
| 3000 | 2999.912 | 2999.886 |

The small initial deficit at 800 reflects the final climb correction. A held
R1 through the production CAS handler then reached 3000; six seconds after End,
predicted/server speed were 3000 within 0.000001 mph. A fresh mission selected
and flew 800. Exact intermediate holds use disclosed `SetThrottle` absolute
selection; held acceleration uses `SimulateGamepadInput`, below hardware routing.
`axis` records the right-stick axis, which is zero when R1 is used; the command
throttle and selected speed record the R1 ramp. Evidence:
[pr54-speed-live.json](evidence/pr54-speed-live.json).

The loaded horizontal limits are **soft 3600 / hard 3800**, shared by server and
predictor. A coordinate near 3049 alone does not identify a boundary intervention.
A read-only 30-second neutral level simulation at cap preserved altitude exactly
and returned inward; hard-limit contact can briefly clip translation at cap.
The regression repeats recovery in both directions, at 800/980/1900/3000 mph
and 60/30/10 Hz, preserving altitude and speed. Held pitch commands can lose
altitude through a loop or dive, regardless of horizontal recovery. The prior
3049 pin/altitude-loss report lacks synchronized input, state and terminal-result
samples; its specific cause remains unresolved, rather than attributed to a
boundary or control bug without evidence. A live 20-second neutral-heading recovery at cap reached the actual 3800 hard
edge, returned inward to (1096.85, 1499.82, 751.81), and retained 3000 mph.
Altitude changed from 1499.98 to a minimum of 1499.82 (the remaining pitch
settling), not a drain. A subsequent fresh sortie again reset to 800. See
[pr54-boundary-live.json](evidence/pr54-boundary-live.json).

The observed 1085 mph short sample
is not an acceleration cap: the live retained 3000 result contradicts it.

## Validation and limits

- Production build succeeds; offline compiled Luau contracts: **522 passed**.
- Existing Studio, temporary compiled Flight/UILayout Jest modules: **81 passed,
  2 suites**. The MCP request timed out at its transport boundary, but Studio's
  console reported both suites and all 81 tests passed after 15.975 s.
- No new Studio process, publication, merge, watch, target damage injection,
  health override, fake kill, pose teleport or mission-state override.
- Session-only unpublished saves; launch uses the normal CampaignRequest API,
  normal loading/ready/Started handling and production controller methods.
  This does not validate menu clicking, physical keyboard/controller routing,
  physical touch, device performance or published networking.
- M1 success demonstrates a viable reasonable control route, not universal player
  success. It does not establish all missions or every terrain approach is safe.
  The parent's fresh 5.6 acceptance still owns those broader checks.

## Reasonable M1 control route for the fresh recheck

1. Launch Normal M1 at the default 800 mph. Use gentle alternating turns and
   small alternating up/down pitch inputs for at least three seconds per axis.
   Centring a stick stops rotation; it retains the current climb or dive angle.
2. Press TGT/Tab/Y when its teaching step appears. Keep clear of scenery while
   lining up the radar. Fire only after the missile step and a full lock.
3. Approach from several hundred studs altitude; fire on a stable approach
   before a close overflight. Arrest a descent early, extend a close pass, then
   turn back. A ground target's wide lock cone permits a shot without flying
   directly into it. The diagnostic uses 450-stud minimum attack altitude.
4. After the radar falls, accelerate to chase the bandits (the pilot chooses
   1100 mph near a contact and 1600 at long range), turn toward the contact,
   wait for the real lock, and fire. Release acceleration to retain selection.
   Use the existing evade control for a close incoming missile.

Run `tools/playtest-tutorial-diagnostic.client.luau` as a normal LocalScript in
PlayerScripts to reproduce the disclosed production API route. It launches
Normal M1 in slot 1 using session-only Studio persistence and records its own
attributes. Run `tools/playtest-speed-diagnostic.client.luau` separately for
the speed matrix; setting its `BoundaryOnly` attribute selects the live edge
route. These scripts deliberately operate one at a time.
