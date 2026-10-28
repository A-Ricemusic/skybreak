# Combat fairness audit — 2026-10-27

Base: main `e69613b`. Existing missile PR #42 inspected at
`19ce5c69ae5e867831e32079e53611caf8f44cbf`; its branch is preserved, not merged
or rewritten. This change addresses one independently reproducible pursuit defect.

## Implemented: defensive breaks respect the bandit's speed cap

Normal pursuit caps ordinary bandits/raiders at 350 studs/s. Extension used only
`max(180, playerSpeed - 10)`, so at the current 600 maximum it instantly jumped
to 590. A maneuver intended to offer a rear shot instead gave the enemy a
240 studs/s speed increase. Easy shares this movement rule. Extension now also
respects the same 350 cap. Ace movement, courier speed, damage, firing gates,
lock-break probability and missile guidance are unchanged. Existing behavior at
player speeds up to 360 is preserved, including the 180 floor at low speed.

`CombatBalance.spec.ts` contains reproducible aligned rear-shot probes using
current `FlightMath.Step` and `ThrottleForSpeed`. Start at a 900-stud gap, hold
450 or 600, and let the enemy extend straight ahead for the early/middle/late
1.4/1.6/1.8-second defensive breaks or the 3-second overshoot extension.
Both 30 and 60 Hz give these rounded gaps:

| Player speed | Duration | Old gap | New gap |
| --- | --- | --- | --- |
| 450 | 1.4 / 1.6 / 1.8 | 886 / 884 / 882 | 760 / 740 / 720 |
| 600 | 1.4 / 1.6 / 1.8 | 886 / 884 / 882 | 550 / 500 / 450 |
| 450 | 3.0 | 870 | 600 |
| 600 | 3.0 | 870 | 150 |

These are deterministic kinematic simulations, not complete engagements or human
results. They omit enemy steering, terrain, locks, weapons and player reaction.
The smaller gap can also cause a fast pilot to overshoot at closer starting
ranges; live handling must be judged before merge.

Validation: `bun run build`; compiled offline Luau suite **529 passed, 0 failed**;
`git diff --check`. Replacing the compiled extension rule with the old rule makes
both the speed-cap and high-speed closing-distance tests fail (8 pass / 2 fail
in the focused file). The compiled artifact was restored afterward.
Reproduce after building with `LUAU_BIN=/path/to/official/luau bun tools/test-relay-offline.ts`.
No Studio, Rojo server/build, Roblox Jest, human, phone or network testing was run.

## PR #42 integration assessment

The PR body is outdated: its latest code includes predictive BREAK/HOLD/CLEAR,
fair-shot launch gating and shooter standoff, not just capped missile turns.
Do not replace this with another missile rewrite. It needs a dedicated integration
pass before its prior simulation claims can describe current main:

- `git merge-tree --write-tree origin/main origin/t3/missile-dodging` reports
  conflicts in AircraftCollision.ts, TelemetryCodec.ts, FlightPrediction.spec.ts
  and tools/test-relay-offline.ts. This read-only merge analysis did not change
  the checkout.
- Main has 29 telemetry numbers: slot 26 pauseRemaining, 27 turnObserved,
  28 pitchObserved. #42 puts incomingSeconds/bearing at 26/27 with 28 fields.
  Preserve main's slots and append missile fields at 29/30, then update the
  encoder, decoder, length checks and packet tests together. Preserve cue bits.
- #42 `MissileRules.Misses` copies a FlightState with only x/y/z, yaw/pitch/roll
  and speed; its duel/engagement fixtures also construct the old state shape.
  Current FlightState requires quaternion components and lean. These are source
  compatibility blockers even in files Git auto-merges. Use current state
  construction/copy semantics before rerunning predictions.
- EngageSim initializes speed from the old linear throttle formula
  `MinSpeed + (MaxSpeed-MinSpeed)*throttle`, and describes cruise circling. Current
  cruise is 160 with persistent speed control and maximum 600. Rebuild the grid
  using current ThrottleForSpeed, explicit initial speeds and quaternion state.
  Historical 255/320-speed tables and acceleration guarantees cannot certify it.
- Keep this extension cap when merging #42's standoff logic. The two-argument
  ExtendSpeed API remains compatible with its simulation calls, but behavior at
  high speed changes; rerun those suites. Keep the union of offline spec lists.
- Current-main EVADE hint/flash starts for any incoming missile within 1800,
  although decoys require 450 range or the last 1.2 seconds and the press window
  lasts 0.6 seconds. An immediate response to a distant cue can waste a charge.
  This remains a readability concern, not a guarantee that every prompt fails;
  closing speed and remaining life matter. Evaluate alongside #42's new cues.

## Live matrix for the integration agent

Use actual players on desktop keyboard/mouse and a physical phone in landscape;
record device, viewport, frame rate, actual RTT, mission/phase, difficulty,
airspeed, hull delta, missiles/evades spent, time to reacquire/kill, and a short
player explanation of each warning. Scripted pilots are a separate data series.

| Scenario | Controls / repeats | Observe and acceptance question |
| --- | --- | --- |
| Early M3 and M9, Easy then Normal | 160, 320, 450, 600; three engagements each | Does a bandit extension offer a rear shot without unexpected acceleration? Can a new pilot avoid overshooting without losing the target repeatedly? M9 adds ace pressure. |
| Middle M12 and M18, Easy then Normal | Same speeds; three engagements each | Compare chase/reacquisition time, defensive breaks, and ace/wingman pressure; does Easy leave time to read and react? |
| Late M21 and M27, Easy/Normal; Ace control run | Same speeds; three engagements each | Check late flares/breaks and ace stages; verify this ordinary-bandit change has not flattened the ace fight or created trivial kills. |
| Current-main missile warnings | Tail, side, head-on; near/far launches; respond immediately versus wait until close | Record wasted EVADE charges, cue visibility and reaction-to-impact time. Confirm players distinguish LOCK from INBOUND without coaching. |
| #42 only after compatibility fixes | Same bearings at 160/320/450/600, all acts and difficulties; ignore, follow cue, release early, delayed reaction | Read BREAK/HOLD/CLEAR while steering; measure actual cue/reaction timing and misses/hits. Repeat at measured normal and degraded RTT. No human guarantee from scripted cue following. |
| Terrain and UI workload | Terrain-adjacent break with radio/subtitles; desktop plus smallest supported phone layout | Can players see terrain and missile advice together, reach EVADE, and maintain target awareness? Collision/terrain validation belongs to integration/world owners. |

Physical human input is required to assess touch reach, finger occlusion, warning
comprehension, cognitive load and perceived chasing. This patch neither proves
Easy is sufficiently easy nor resolves the missile design without #42 integration.
