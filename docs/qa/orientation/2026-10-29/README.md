# Mission 4–5 uploaded asset orientation — 2026-10-29

Local Roblox Studio inspection by the PR #142 implementation agent, 2026-10-29. Captures used `dc5e59f` plus the fixture fix; rebase onto main `cbdec3a` left the inspected production loader, specs, asset IDs and world placement code byte-for-byte unchanged. No uploads, publishing, merging or Roblox Player testing.

## Loader regression

The original branch reproduced **779 passed / 2 failed, 77 suites, 781 tests** in Studio. Both failures were FuelTanker fixtures. At the pilot aircraft's default 28× scale, the fixture requested `(1288, 1668.8, 7466.956)` studs on one MeshPart. Roblox clamped Z to 2048; the loader correctly rejected the resulting proportions (`implausible size 1288, 1668.7999, 2048 for in-game 46, 59.6, 266.677`). This was not a world-loader dispatch failure.

World fixtures now default to authored scale; aircraft retain the 28× regression case. A fixture assertion prevents accidental oversized parts. The existing acceptance and rotation tests remain intact; a new test exercises cached `WorldAssets.Preload` → `PlaceUploaded` and checks all three bounds and the keel-to-waterline offset. Production shape validation was not relaxed.

## Inspection method

Build the isolated `test.project.json` place, open locally in Studio Edit mode, and execute [setup.luau](setup.luau) through Studio MCP. The script loads real Roblox model IDs through the game's `UploadedAssets.Template`; the tanker is placed through `WorldAssets.PlaceUploaded`. It creates only a temporary QA folder in an otherwise empty Workspace. All models face the same nominal -Z direction, with the heavy bomber and regular Vanta v2 as references. Aircraft centres are at Y=25, tanker contact at sea level Y=0. Yellow markers lie ahead along -Z; the translucent blue plane has its top at Y=0.

## Observed results

All seven real uploads passed the production loader's mesh, appearance, required-part and proportion validation with `ImportScale=1`. All five new assets face **-Z**, with **+Y up**, matching the heavy bomber and regular Vanta v2. The table rounds measured bounds to 0.001 studs; full output is in [measurements.json](measurements.json).

| Asset / Roblox model ID | Measured XYZ bounds (studs) | Observation |
|---|---|---|
| HeavyBomber / 112476761254185 (reference) | 72.740 × 16.600 × 64.800 | Nose toward -Z; dorsal fin up; four engine intakes forward. |
| HeavyTransport / 135095912449793 | 72.680 × 19.599 × 67.551 | Transport nose forward, high wings and tail upright, engines below wings. Roughly bomber span/length, with a deeper fuselage; plausible. |
| RadarJammer / 80069408823339 | 59.319 × 15.878 × 62.178 | Nose forward, radome on top, upright tail. Slightly smaller than bomber; plausible. |
| FuelTanker / 83861380699092 | 46.000 × 59.600 × 266.677 | Bow forward, bridge/funnel aft and upright. Roughly 4.1 bomber lengths; appropriate for the medium tanker. Keel Y=-16, waterline Y=0, highest point Y=43.600. The sea plane intersects the boot-top/hull waterline, leaving the lower hull submerged. Starboard orange lifeboat is on +X; deck piping and crane stay above water. |
| AttackHelicopter / 80747426523090 | 14.356 × 6.245 × 21.025 | Cockpit forward, main rotor on top, tail rotor aft on the port (-X) side. About 0.32 bomber length and 0.20 bomber span; plausible. |
| VantaV2Elite / 139083376207373 | 24.690 × 7.029 × 26.400 | Nose/canards forward, canopy/fin up and exhaust aft, matching regular Vanta v2. About 0.41 bomber length. |
| VantaV2 / 93195734008147 (reference) | 24.578 × 7.298 × 26.400 | Same heading/up axes and length as elite; expected livery/rear-geometry differences. |

Helicopter rotor **part pivots** in the normalised model:

- MainRotor: `(0, 1.897526, -0.512396)` versus configured `(0, 1.8975, -0.5125)`; Y axis up.
- TailRotor: `(-0.619995, 1.547527, 8.937605)` versus configured `(-0.62, 1.5475, 8.9375)`; X axis lateral.

Both errors are below 0.0002 studs. Their pivot bases are identity to floating-point precision (right +X, up +Y, look -Z). The main mesh bounds centre is 0.0575 studs above its hub; use the part pivot rather than its bounds centre for future animation. Pink QA spheres mark the configured hubs, including the visible tail-hub marker in the port-side capture. Rotors are static; animation was not tested.

**Correction decision:** keep all five yaw/pitch/roll offsets at zero and keep tanker `groundOffset=16`. No asset re-export or production loader relaxation was necessary.

## Captures examined

Studio MCP supplied 1842×1050 JPEG viewport captures, converted to PNG with macOS `sips` without retouching. `overview.png`, `lineup-top.png` and `lineup-front.png` show the shared scale scene. In the lineup views, left to right is regular Vanta v2, elite Vanta, helicopter, tanker, jammer, transport, bomber. Individual captures temporarily hide the other models using `LocalTransparencyModifier` to prevent side-view occlusion; geometry, materials, placement and scale are unchanged. Yellow forward markers and the blue sea plane remain visible.

For **each** of `HeavyTransport`, `RadarJammer`, `FuelTanker`, `AttackHelicopter`, `VantaV2Elite`, plus references `HeavyBomber` and `VantaV2`, examined `<name>-front.png`, `<name>-side.png` (port side) and `<name>-top.png`. Also examined `FuelTanker-starboard.png`. Individual top views have -Z at the top (the lineup top view has -Z at the bottom); port-side views have the nose/bow at the left. Perspective and different camera distances in individual views mean only the lineup is suitable for direct visual scale comparison.

## Validation

- `bun install --frozen-lockfile`: exit 0, 122 packages installed.
- `bun run build`: exit 0.
- `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline`: exit 0 after rebase; `OFFLINE_LUAU_RESULT passed=691 failed=0`, catalog snapshots 19/0, 122 tooling tests passed, place voice artifact checks and generated reports passed.
- `bun run test:roblox`: exit 0; **808 passed, 0 failed, 80 suites** after rebase onto main `cbdec3a` (#139/#141). The initial fixed branch passed 782/782 across 77 suites (baseline 779 passed / 2 failed).
- Studio closed after inspection; the single Studio lease is released. No Roblox Player test was performed.
