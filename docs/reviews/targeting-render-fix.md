Targeting review

Baseline: origin/main 5cbae26. No movement physics, input or flight camera changes.
The GUI uses IgnoreGuiInset=true and WorldToViewportPoint; the camera and enemy
smoothing run before box projection in the same callback. Uploaded aircraft are
normalised to their bounds centre. The problematic handoff is a root-only CFrame
write on a welded local clone during RenderStep: the targeting frame advances
before joint propagation necessarily moves its visible parts. PivotTo now moves
all parts immediately, respecting PrimaryPart.PivotOffset. No guessed offsets.

Tuning: min/max 18/60 -> 14/40 px; selected min 30 -> 24 px; reference height
share .13 -> .08; lock .8 -> .45 seconds. UAV remains .4 seconds. Existing
server ownership, phase, health and Damageable checks stay authoritative.

Validation: build passes; offline Luau domain suite 492 passed, zero failures,
including WeaponRules acquisition/damageability assertions and target layout. EnemySmoothing.spec is an engine
geometry regression (translation, rotation and nonzero pivot offset); it compiles
but was not run here because another agent owns Studio.

Studio acceptance to commission separately:
- Run Roblox Jest including EnemySmoothing.spec and WeaponRules.spec.
- Track a turning bandit at 30/60/120fps and simulated replication latency;
  inspect Body position and root frame immediately within the render callback.
- Check desktop and phone portrait/landscape at HUD scale .8, 1 and 1.3;
  marker stays centred during roll, camera shake and target crossing.
- Confirm near/far marker sizes, .45s acquisition and steady red LOCKED;
  phase-protected/foreign/dead targets never acquire a damageable-looking box.
- Confirm teardown, killed clone claiming and drone glyphs still work.

The screenshot symptom is consistent with deferred joint propagation; visual
acceptance remains required before treating the diagnosis as runtime proven.
