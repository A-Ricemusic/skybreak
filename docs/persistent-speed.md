# Persistent speed flight contract

PR #54 starts from main `d31ed1d`. This specification supersedes the historical
return-to-300-studs/s behavior. Only the assigned worktree was changed; world
files, imported assets and targeting logic remain separately owned.

## Units and tuning

| Quantity | Pilot units | Simulation / command units |
| --- | --- | --- |
| Spawn / default selection | 800 mph | 160 studs/s; normalized command 0.65 |
| Lowest selection / forward floor | 75 mph | 15 studs/s; command 0 |
| Highest selection / actual cap | 3000 mph | 600 studs/s; command 1 |
| Held acceleration | +180 mph/s | +36 studs/s per second of selection |
| Held brake | −250 mph/s | −50 studs/s per second of selection |
| Engine acceleration / braking caps | +300 / −400 mph/s | +60 / −80 studs/s² |
| Engine response | 2.5/s | speed error × 2.5, then capped |
| Vertical climb / dive energy term | −20 / +20 mph/s maximum | −4 × nose-up component studs/s² |
| Steady vertical climb / dive offset | −8 / +8 mph | −1.6 / +1.6 studs/s from selection |
| Low speed / lift degradation band | 75–100 mph | full stall at 15; no stall above 20 studs/s |
| Stall sink / nose drop at full severity | 65 studs/s / 0.6 rad/s | retained arcade recovery behavior |
| Pitch / upright heading rates | 1.25 / 1.15 rad/s | ~5.03 s full pitch loop |
| Axis deadzone | 0.18 | remapped remaining travel to ±1 |
| Server / prediction step | 30 Hz | 1/30 s; 20 studs maximum forward travel |
| Input send / keepalive / timeout | 20 Hz / 10 Hz / 0.7 s | absolute selection; never a held accelerator packet |

**Conversion is explicit:** `FromMph(mph) = mph × 0.2` studs/s and
`ToMph(speed) = speed / 0.2`. This is a deliberate compressed arcade distance
scale, not a claim that a Roblox stud has a particular real-world length.
A real mile at the chosen scale would be 720 studs; this does not change
altitude or objective distances, which remain studs. No world size was changed.
The prior 300-studs/s cruise is therefore 1500 mph in the new scale; 800-mph
spawn is intentionally slower in world distance. A linear conversion preserves
meaningful speed ratios (top speed is 3.75 times spawn) without 3000 studs/s.

## Controls, retention and actual speed

E/R1/Shift, right-stick up and touch-throttle up increase selection continuously;
Q/L1 and down reduce it. Opposing axes cancel, drift inside the deadzone is
neutral. Full acceleration takes ~12.2 seconds from spawn to cap; braking from
spawn to floor takes ~2.9 seconds. End/Cancel/focus loss/text entry/disconnect
clear held controls. Pause clears held controls and freezes simulation; resume
retains selection. A new sortie resets to 800 mph.

The client integrates selection, then sends an **absolute** normalized command.
The server and predictor use the same piecewise conversion (75→800→3000 mph
at 0→0.65→1). A released control and a lost packet cannot cause the server to
keep integrating acceleration/brake. Server silence retains its last received
selection, centers steering and enables level assist. It may retain a slightly
older selection if the final packet was lost; keepalives recover it. There is no
reset to 800 on interruption. The smaller command-send threshold keeps high
speed selection changes at 20 Hz across the wide upper range.

Actual speed eases toward selection: it can continue settling briefly after
release (roughly 72 mph of lag during sustained acceleration, then exponential
settling), but never returns to default cruise. The speed instrument shows
**actual mph**, with an explicit MPH caption or compact suffix. Gentle energy
exchange changes actual speed without rewriting the selection. A 30° climb
settles about 4 mph below selection; a dive settles about 4 mph above. This
keeps loops smooth and avoids the old nose-up drag stalls. Actual speed is
clamped to 75–3000 mph even while diving.

At 75 mph the aircraft still travels forward and loses lift, sinks and drops
its nose; it does not freeze in midair. Recovery requires acceleration and/or
nose down. The 75–100 mph band progressively reduces authority to 30% and adds
sink. With a held minimum selection, a nose-down stalled aircraft can settle a
few mph above the forward floor because of dive energy; this is intentional.
STALL displays at the 75 mph threshold, LOW SPEED in the approach band or when
the measured trend projects a stall. Terrain warning continues to take priority.

## Downstream assessment

- Collision: existing server spherecast sweeps the whole path with a 4-stud
  fuselage radius, including every 20-stud step at cap. It is not endpoint-only
  collision. Starting overlaps and extremely thin/complex authored scenery
  still need engine-level acceptance. Ground/water remain fatal.
- Loops/bounds: quaternion attitude and full pitch rates are retained. No
  950-stud forced nose-down exists. Upward translation eases between 3000 and
  3600 studs without rotating attitude. After rebasing on merged PR #55,
  horizontal recovery uses the world-owned 3600/3800-stud soft/hard limits.
  At cap the level turn radius is ~522 studs and a vertical
  loop spans ~960 studs; the finite airspace makes high-speed boundary
  encounters frequent. World expansion must account for these dimensions.
- Camera/FX/audio: FOV/chase-distance speed effect now spans cruise to cap;
  wind reaches full mix at 600 studs/s; vapor ramps from 120 to 320 studs/s.
  Engine glow/burn/pitch remain bounded functions of selected normalized speed,
  so releasing a high selection intentionally retains high-speed engine sound.
  Particle rates and trail lifetimes stay capped. Top-speed trail cost needs
  mobile inspection (0.7 s maximum ribbon can span 420 studs).
- AI/weapons: velocities and lead calculations remain studs/s. Bandits/aces
  retain their existing clamps (~285–380 studs/s plus stage bonuses), so a
  player at 600 can extend away and an 800-mph player must accelerate to chase.
  Hostile missiles remain 580/660/740 studs/s; Easy missiles may be outrun at
  cap. This is a meaningful speed choice, but requires combat acceptance.
  No targeting, lock, guidance, weapon or damage values were changed.
- Navigation: shared QA pilot explicitly requests its established 195/240
  studs/s (975/1200 mph), preserving route/orbit travel timing instead of
  accidentally using stale normalized values. `SetThrottle` selects an
  absolute speed; `SetTouchThrottleAxis` simulates a held accelerator/brake.
- Mission clocks/objective distances remain unchanged. Offline campaign and
  blueprint contracts pass, but slower default travel can affect deadlines,
  tutorial feel and courier interception. Studio route acceptance is required;
  no world or timing assumptions were silently scaled.
- Packets: existing full numeric state/telemetry arrays already carry 15–600
  studs/s without quantization or a narrow integer limit. No state fields or
  packet shape changed. Prediction tests cover both endpoints and intermediate
  selections, quaternion loops, reconciliation and stale packet handling.

## Validation and required Studio acceptance

`bun run build:place` compiles and builds the place without launching Studio.
Implementation validation: **490 offline contracts passed, 0 failed**; place build
and `git diff --check` passed.

Offline contracts run with the official standalone Luau executable using
`LUAU_BIN=... bun tools/test-relay-offline.ts` after compilation. This is not a
Studio/Roblox Jest result. There was no Studio access, playtest, publish, merge
or PR watch during implementation.

Offline tests cover held axes and release at multiple selections, 75/800/3000
unit anchors, saturation, 60/30/10-Hz stall/recovery and loops, 144/60/30/10-Hz
selection accumulation, gentle climb/dive energy, touch cancellation/clearing,
prediction across the range and flight-state endpoint packet round trips.

After the parent finishes targeting PR #51 acceptance and commissions actual
flight acceptance (5.6), use real keyboard, physical gamepad and touch:

1. Spawn at 800 mph. Hold accelerate, release around 1100/1800/2600 mph;
   verify selection stays fixed and actual speed settles there. Reach 3000;
   hold and dive without exceeding cap. Repeat braking to 500/150/75 mph.
2. At 75 verify forward travel, sink/nose drop, terrain/water collision and
   acceleration recovery. Release brake and verify it does not restore 800.
3. Hold mild climbs/dives at several selections; confirm gentle speed trend
   and stable held attitude. Perform three loops from 500/950 studs at cruise,
   then at high speed with adequate terrain/ceiling clearance. Check inverted
   and vertical transitions and the high-altitude translation limit.
4. Interrupt acceleration and braking with End/Cancel, focus loss, text focus,
   gamepad disconnect and pause/resume. No selection reset and no continued
   held adjustment. Drop input traffic >0.7 s; the server must retain the last
   selection and center steering. Test delayed/out-of-order packets and resume.
5. Inspect `GetControlStateForStudio()` selectedMph/actualMph, raw axes,
   command, prediction/RTT and pending corrections against server telemetry.
   Check 30/60/low-FPS playback and simulated latency for repeated snaps.
6. Sweep terrain, thin objects and water at 3000 mph; test boundaries and
   top-speed loops. Check phone HUD MPH readability at compact scales, audio,
   trails and frame time. Run M1 tutorial and representative timed navigation,
   courier and ace missions at default and high selection on all difficulties.

Parent review and actual flight acceptance are required before merge.
