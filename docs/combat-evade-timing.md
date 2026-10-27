# EVADE timing and PR42 integration evidence — 2026-10-27

## Delivered scope

Current-main fallback: the touch EVADE pulse and promoted keyboard/gamepad hint now
require server evidence that at least one hostile missile satisfies
`EvadeRules.Decoys(distance, remainingLife)`: within 450 studs **or** at most
1.2 seconds of life remaining. Charges and roll cooldown still gate the prompt.
MISSILE INBOUND remains an early threat warning. The button stays usable at all
ranges. No missile physics, difficulty, damage, charges or pursuit tuning changed.

The server publishes `evadeThreat` in flag 2048. The packet remains 29 numbers;
pause at 25/26 and tutorial observation at 27/28 remain intact. Flags 128–1024
are left for PR42's BREAK/HOLD/CLEAR. Older packets clear the advice rather than
infer a timing window from INBOUND. GameUI sanitation retains the new boolean;
both its promoted hint and HudControls' button use `evadeGauge.flash`.

This is independent of PR59 (head `8ae7619e0db845c9ddb290942510f5c901a34038`).
It neither incorporates nor changes that pursuit cap. A temporary local merge
with that exact PR59 head built successfully and passed **531/531** offline tests;
the merge was then aborted. Integrate PR59 separately.
The dirty project root was not edited. No Studio, Rojo, Roblox Jest, publishing,
asset uploads, paid generation or live-player validation was performed.

## Why PR42 was not pushed

Inspected remote PR42 at `19ce5c69ae5e867831e32079e53611caf8f44cbf`, including
reviews and inline comments: no submitted reviews or inline findings; CodeRabbit
reported a rate limit. Merged current main locally, resolved the four textual
conflicts, appended missile telemetry at 29/30, preserved pause/tutorial fields,
replaced partial FlightState copies with quaternion-preserving copies, added
quaternions/lean to fixtures, and replaced linear throttle mappings with
SpeedForThrottle/ThrottleForSpeed. The compatibility build passed.

The exploratory suite returned **556 passed / 9 failed**. One was my unfinished
codec test migration (it removed middle fields before reading appended fields),
not evidence of a production codec defect. The other eight were obsolete dodge,
acceleration, blind-flight and engagement-cadence expectations. They are not all
proofs of bad gameplay; they do invalidate the previous numerical certification.

A more consequential defect is the prediction/control contract. Misses predicts
instant throttle=1 and the old duel grants it. FlightController now changes
selected speed through AdjustThrottle, at +36 studs/s per second. A pilot starting
at 160 cannot select 600 immediately. Moreover the duel passes its chosen
reaction delay into CueTick, whereas production uses 0.3 seconds regardless of
actual reaction/transport delay.

The attached grid runs 12 bearings (0..330 by 30), ranges 800/1400/1800,
160/320/450/600 initial speeds via ThrottleForSpeed, every difficulty/act, and
0/0.3/0.6-second reactions: **3,888 scenarios**, including shots withheld by the
fair-launch gate. Each delay has 622 launches. These are deterministic scripts,
not people, phones, measured RTT, terrain or complete engagements.

| Actual reaction | Followed-cue hits with instant power and delay-aware predictor | Followed-cue hits with speed selection ramp and production 0.3 s predictor |
| --- | --- | --- |
| 0 s | 0 | 25 |
| 0.3 s | 0 | 32 |
| 0.6 s | 0 | 40 |

Raw TSV columns: difficulty, act, initial speed, reaction, launches, all hits,
shots with BREAK, hits after a break began. Each row covers 36 scenarios.
Artifacts: [idealized](evidence/combat-timing/pr42-idealized.tsv),
[current controls](evidence/combat-timing/pr42-current-controls.tsv),
[grid driver](evidence/combat-timing/envelope.luau),
[exact compiled control experiment](evidence/combat-timing/current-controls.patch).
The control experiment retains the predicted 0.25 back pressure and full lateral
stick; it changes only speed selection and predictor reaction knowledge.

To reproduce, integrate the above PR42 head with main `e69613b`, resolve the
compatibility changes listed above, build and adapt modules with the offline
runner, copy envelope.luau into build/offline-relay and execute with official Luau.
For the second series apply current-controls.patch to the adapted MissileDuel.luau.
The integration experiment was aborted; PR42's remote history remains untouched.
A sound full update needs prediction that matches attainable throttle/input
trajectories, delayed-cue validation, recalibrated cadence/Easy expectations and
multi-threat/live performance checks. Merely relaxing old assertions would hide
these gaps. This fallback makes no claim that current-main missiles are outflyable
or that Easy has completed tuning.

## Validation and bounded follow-up

`bun run build` passes; `LUAU_BIN=/tmp/luau-rev11/bin/luau bun tools/test-relay-offline.ts`
reports **528 passed, 0 failed**. `git diff --check` passes. Replacing the compiled
gauge condition with its old INBOUND condition fails two focused regression
tests (3 pass / 2 fail); the artifact was restored. Regression tests
exercise both eligibility paths, no-charge/rolling states, old packets, advice
clearing, and codec-to-gauge integration while preserving pause/tutorial numbers.
A 30/60 Hz straight head-on closure probe steps the real FlightMath jet at
160/320/450/600 against act speeds 580/660/740 and fuses 32/40/48. Guidance is
omitted: this is a timing probe, not an engagement simulation. All difficulties
share these speeds/fuses/lifetimes; difficulty steering and damage are not tested
by this probe. It compares the old 1799-stud prompt with the new eligibility
prompt, sampled at 10 Hz, with 0/0.15/0.3/0.6-second response delays. Immediate old
responses waste the charge in all 24 cases; immediate new responses decoy in all
24. The new prompt decoys 24/24 at 0.15 s, 14/24 at 0.3 s and 0/24 at 0.6 s.
Delayed responses can still arrive after impact. The rule is eligibility at
the server sample, not a survival guarantee; stale packets, fast closure and
receding threats remain limits.

Parent owns live validation. Bounded follow-up:

1. Desktop and physical landscape phone: one head-on and one tail missile at
   160 and 600, Act I and III, Easy and Normal. Record INBOUND onset, pulse/hint
   onset, range, press time and hull/charge change. Repeat immediate and delayed
   (~0.3 s) reactions; measure actual transport separately.
2. Verify a distant missile does not pulse, a <=450 missile does, and a distant
   missile in its final 1.2 seconds does; verify no pulse without charges or during
   the running roll. Include two simultaneous missiles, only one decoyable.
3. Pause/resume and the M1 turn/pitch lesson with telemetry updating: confirm
   budget/lesson progress remains correct. Observe on the smallest supported HUD
   whether INBOUND versus EVADE timing is understood without coaching.

Do not label this patch as approval of PR42, completed Easy tuning, or human
usability validation. Those remain parent-owned follow-up work.
