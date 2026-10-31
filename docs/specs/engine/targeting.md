# Targeting: automatic acquisition and the TGT press

Status: implemented on PR #172 (branch `fix/tgt-closest-onscreen`), superseding the TGT part of D-087 (PR #157) with D-210. Automatic acquisition is unchanged from #157. This is a code specification, not a Roblox Player observation; see the "Verification" section for what was actually run.

Code: `src/shared/TargetPriority.ts` (pure order, frustum, press rule), `src/server/TargetView.ts` (payload validation), `src/server/CombatService.ts` (`targetCandidates`, `acquireTarget`, `cycleTarget`, `selectTarget`, the `CombatAction` handler), `src/client/FlightController.ts` (`CycleTarget`, `TryTapTarget`). Tests: `src/tests/TargetPriority.spec.ts` (also run offline), `src/tests/TargetView.spec.ts` (Roblox Jest only, needs `CFrame`).

## 1. Candidates

A contact is a candidate when the session owns it (`ownsEnemy`: an enemy model under the session folder that `AlliedRules.PlayerTarget` accepts). Allies are never candidates. Each candidate carries the server's distance and nose dot from the jet, `required`, `inRange` (lock envelope for its kind), `held` (a retreating ace, or anything the phase protects: `sessionCanDamage` false) and, after a bounded raycast budget, `blocked` (terrain or flight-solid scenery between jet and contact; aircraft and target models are never cover). For a TGT press each candidate also carries `onScreen`.

## 2. Automatic acquisition (unchanged, D-087)

Spawn, kill, phase entry and target-lost use the nose-first order: ahead, in range and clear first; then blocked or held; then ahead but out of range; then behind. Within a tier the nose dot wins, a required contact gets a bounded +0.05 bonus (about 18 degrees), and a nearness bias of at most 0.01 breaks near-ties. Line of sight is raycast for the leading four contacts, cached per contact for 0.1 s. Phase entries and spawns keep a still-valid target; only a lost one is replaced. Lock progress resets only when the target actually changes.

## 3. The TGT press (D-210)

The same rule serves the PC keys (Tab, R), the gamepad Y button and the on-screen TGT button; all three call `FlightController.CycleTarget`.

**What the press sees.** The client sends its camera with the press: `{ action: "CycleTarget", view: { cframe, fov, aspect } }` where `cframe` is `Workspace.CurrentCamera.CFrame`, `fov` its vertical `FieldOfView` and `aspect` the viewport width over height. The server (`TargetView.FromClient`) accepts the view only when `cframe` is a real `CFrame` with finite, unit-length axes whose position lies within 500 studs of the server's jet (`TargetPriority.MaxCameraOffset`); FOV is clamped to 20–120 degrees and aspect to 0.3–4, with defaults of 75 degrees and 16:9 when a value is missing or not a number. Anything else, including a missing payload, uses the jet's nose frame with the defaults, so the press always works. The payload is covered by the existing per-action rate limit (`WeaponRules.AcceptAction`, 0.09 s).

**On screen.** `TargetPriority.InView` projects the server's position of each owned contact through that frustum: it is on screen when it is at least 1 stud ahead of the camera along the look axis and inside both the vertical half-angle and the horizontal half-angle (vertical times aspect). Under jamming, a contact beyond the phase's visual range from the camera is treated as off screen because the HUD hides its box. Line of sight is raycast for the four nearest on-screen damageable contacts only (`PressLosChecks`), reusing the 0.1 s cache.

**Order.** A contact whose box is on screen but which terrain hides from the jet is not something the player can actually see, so it ranks after every clear on-screen contact yet before off-screen ones (still reachable with a further press). `PressOrder` sorts by tier, then distance from the jet (closest first), then id:

| Tier | Meaning |
|---|---|
| 0 | On screen, clear line of sight, damageable now |
| 1 | On screen but blocked by terrain or held (retreating ace, phase-protected) |
| 2 | Off screen, including behind the camera and outside the viewport |

A required contact counts 30 studs nearer (`RequiredTieStuds`): a tie-break only, never a priority over a clearly closer optional contact. Non-finite distances sort last within their tier.

**Rule (`Press`).** With the current target not the first in order (or no target, or a target that is not a candidate), the press selects the first: the closest contact on screen. With the current target already first, it selects the second. A press within 2.5 s of the previous press (`CycleChainSeconds`), with the target unchanged since, is a chained press: it selects the contact after the current one in the order and wraps to the first after the last, so every contact stays reachable with quick presses. Any target change in between (a tap, an automatic retarget after a kill) ends the chain. After 2.5 s without a press the next press applies the closest-or-second rule again.

**Nothing on screen.** Tier 2 means the order falls through to the closest owned contact overall (or the second closest when that is the current target), so the button always answers and the edge arrow then points at the pick. Keeping the current target was rejected because a dead button is what the owner described as inconsistent.

**Unchanged.** Allies are never selectable. Jamming lock gates (`lockAllowed`) and the lock envelope are untouched; the press can select a contact the jet cannot lock yet. Lock progress resets only on an actual change; a press that lands on the current target (a single contact) keeps its lock. Tap-to-target on touch (`SelectTarget`, validated as an owned enemy model) is unchanged and takes priority over the press when the player taps a box. The tutorial's `tutorial_target` hook still fires from `selectTarget`.

## 4. Why the camera and not a client list (D-210)

The client could have sent the ordered list of on-screen enemy models. The camera payload was chosen because it is fixed-size and fully bounded (one CFrame and two clamped numbers), the server keeps ownership, distances and the candidate set, and a forged camera can only choose among contacts the player may already select by tapping. A client list would be variable-length, would need per-element ownership checks and a server re-sort, and could still omit contacts the server knows about. The cost is a small mismatch at the viewport edge: the client draws the smoothed clone while the server projects the authoritative position, so a contact exactly on the edge may count as on or off screen for one press.

## 5. Verification

- Pure tests (`TargetPriority.spec.ts`): closest when not selected, second when the closest is selected, chain through four contacts and wrap, snap back after the chain lapses, off-screen and behind contacts excluded until nothing else remains, fallback with nothing on screen, blocked and held tiers, required tie-break, id ties and non-finite distances, LOS budget, frustum construction, aspect handling, clamps and rejections.
- Server validation tests (`TargetView.spec.ts`): plausible chase camera accepted; missing, non-table, non-CFrame, NaN and far-away cameras fall back to the nose; FOV and aspect clamped; unusable jet frame still yields a view.
- Build, `validate:offline` and `test:roblox` results are recorded in the PR description. No Roblox Player or phone test is claimed by the agent; the owner's check is listed in `docs/human/next.md`.
