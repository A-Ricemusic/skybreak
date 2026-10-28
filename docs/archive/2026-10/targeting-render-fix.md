# Targeting render review — revised after Studio measurement

PR #51 started at `520f583a9dfbba08c03d4b3bf5ddf1f818c74268` and is now
rebased onto main `d31ed1d` (includes merged flight #52 and cutscenes #53).
The offline runner retains WeaponRules tests from #51 and VoiceReadiness tests
from main. The dirty project root was not modified.

## Diagnosis and coordinate reasoning

The earlier root-only welded-clone write was a separate render-order problem.
The retained PivotTo change moves visible parts immediately, respecting
PrimaryPart.PivotOffset. The supplied earlier engine evidence found zero
geometry divergence at 30/60/120 Hz; this implementation run did not repeat that
rate sweep.

**The reported desktop 58px difference is not proof of a rendered offset.**
Studio reproduces `ScreenGui.AbsolutePosition=(0,-58)` with
IgnoreGuiInset=true and ScreenInsets=None. AbsolutePosition is inset-relative,
like Camera.WorldToScreenPoint; WorldToViewportPoint is not. A separate magenta
mesh and green outline, using the original raw viewport offset, visibly align
in [the native Studio capture](../../reviews/targeting-desktop-coordinate-probe.png).
Measured viewport point `(506,268)`, screen point `(506,210)`, and GUI absolute
center `(506,210)` describe the same rendered center. Blindly adding 58 would
introduce an offset. This explains the supplied `(622.1,279.3)` versus
`(622,221)` comparison; it does not establish whether any other live-production
symptom remains.

There is a real brittle assumption: direct viewport offsets assume the
full-screen GUI's measured origin plus inset is zero. Device safe areas and
other ScreenInsets modes need not satisfy that assumption. ViewportGui now
maps all ordinary boxes, selected brackets, selected edge arrows, and drone
on-screen/offscreen glyphs through one explicit transform:

`Position.Scale = (viewportPoint - GetGuiInset().topLeft - parent.AbsolutePosition) / parent.AbsoluteSize`

This first enters inset-relative screen coordinates, then the parent's local
space, then normalizes by its **rendered** size. On the observed desktop full
viewport layer the origin terms cancel, preserving correct rendering. A scaled
HUD root uses its measured size, so its UIScale is not applied twice. Combat
cue sizes remain offsets in the separate unscaled targeting GUI. Keep-outs use
the HUD's viewport origin (`AbsolutePosition + inset`), independently of the
targeting layer's origin. Ordinary box positions are re-evaluated even for a
stationary contact when safe-area geometry changes.

Tuning remains 14–40px, selected minimum 24px, normal lock .45s and UAV .4s.
The old locked-bracket floor of 26px is now the shared selected minimum of 24px.
Ownership, dead-target, immunity and server authority rules are retained.

## Executed evidence

- `bun run build` and `bun run build:place` passed. The final constant/cache
  cleanup was compiled again with `bun run build`.
- Official standalone Luau domain suite: **498 passed, zero failures**. This is
  not Roblox Jest and contains no GUI emulation.
- [Client engine regression](../../../tools/validate-targeting.luau): **207 checks
  each** on desktop 1012×536, emulated iPhone 17 Pro landscape 750×381 and
  emulated portrait 401×778. Each run crosses ScreenInsets None,
  DeviceSafeInsets and CoreUISafeInsets with HUD scales .8, 1 and 1.3.
  Maximum center error: desktop .000031px; phone .5px (pixel rounding).
- The fixture invokes production EnemySmoothing, TargetBoxOverlay,
  createTargetCue, selected cue and drone methods. Its independent oracle is
  the actual visible clone Body.Position projected by WorldToScreenPoint,
  compared to rendered AbsolutePosition + AbsoluteSize/2. It checks 24px
  selected/locked rendering, steady LOCKED, TRACK for immunity, omitted
  foreign/dead/protected boxes, edge cues via engine camera rays, and
  keep-outs against a separately rendered scaled control. A deliberately
  displaced marker must fail the same center oracle. No helper inverse is
  used to manufacture an expected center.
- [Server fixture](../../../tools/validate-targeting-lock.server.luau): a normal
  server Script used the initialized CombatService, actual sortie fixed
  stepping and an enabled damageable ground contact held in the envelope.
  No lock progress was injected after its initial reset. The .45s rule gained
  .074074 per 1/30s tick: .962963 after 13 ticks, 1 after 14 ticks. Wall time
  was .448951s (start occurred between ticks); simulation quantization is
  14/30=.466667s. This is server integration evidence, not normal-play evidence.
- [Raw results and lock samples](../../reviews/targeting-runtime-evidence.json).

The render tests first used fresh clones of compiled targeting modules to
avoid require-cache contamination. Final 207-check runs used the compiled
modules temporarily installed into the existing Studio place. The server
fixture used that place's existing CombatService with the compiled PR
WeaponRules. It was not a runtime acceptance of the complete rebased main.
Studio's original module sources were restored afterward; Play is stopped,
all temporary runtime instances are gone, and device simulation is reset to
default landscape. Nothing was published.

## Reproduction and remaining acceptance

Build and open the new `build/skybreak.rbxlx` for fresh acceptance. In Client,
load `tools/validate-targeting.luau` as a temporary ModuleScript and call its
returned function with `LocalPlayer.PlayerScripts.Client`. It yields for GUI
layout and restores its camera binding and fixture instances. Use the Studio
device simulator for each orientation. For server timing, install the server
fixture as a normal Script in a fresh unpublished session with no active
sortie; inspect workspace.TargetingServerValidation. MCP execute_luau requires
can have a separate module context, so calling CombatService.StartMission
directly from that tool is not a substitute for the normal Script.

Fresh GPT5.6 acceptance remains with the parent orchestrator: use a real valid
contact in the active sortie, production smoothing and cue ownership, moving
camera/roll/shake and near/far selection. Compare WorldToScreenPoint with GUI
absolute center, or convert both to viewport space, and inspect a native
capture. The current tests isolate engine geometry and UI layout; they do not
certify flight/cutscene changes, a full normal-control playthrough, frame-rate
or replication-latency sweeps. No physical phone was available. Portrait was
forced in the emulator as a stress test; the authored game orientation remains
LandscapeSensor.
