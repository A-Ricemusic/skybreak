# Mission route audit after #47 / #55

Base: `e69613bd2ec4e6bd3e4eef28cd08ddf5f8bb862b` (includes #58).
This is an offline source/geometry audit, not Studio, human flight or phone testing.

M11's current objective says “Follow the farm road north to Sable.” Its existing
road loop stops at Z=-780; the beacons are (300,280,-1200) and (-100,300,-1650).
An isolated baseline plan probe returns bare terrain at Y=44 beneath both
beacons and at (560,-990), midway from Merel to the first beacon. Add a connected
spur from Merel through both beacon footprints to Sable's apron. Preserve the
existing loop, target coordinates, ridges, expanded districts and flight tuning.
Reserve the spur before scenery placement so trees and buildings cannot obscure it.

The clearance audit previously tested structures only at the centre and sixteen
points on two rings. A narrow rotated rail at (23,17) inside an 80-stud disc can
miss all probes. It now intersects the full rotated part/prop footprint with the
disc, using uploaded asset manifest bounds and world-kit bounds. Non-solid
markers remain excluded. Water counts as an obstruction, matching the aircraft
sweep's `IgnoreWater=false`. Mesh boxes are conservative: this is not an engine
collision-fidelity test. Terrain still uses sampled analytic heights, so voxel
edges and unsampled terrain between probes remain live-validation concerns.
Ground-target meshes are not included in the plan's structure bounds; their
aprons are. Strike approaches must still be checked live.

Validation: `LUAU_BIN=/tmp/skybreak-luau/luau bun run test:offline` passes 529/529
contracts, including compilation. Added checks cover thin rotated geometry,
decoration filtering, water, continuous road/apron support every 10 studs on the
new spur, and representative route exits. Existing M3–M27 audits cover authored
flight points/legs, target grounding, prop support, full coastal launch paths and
world budgets. The M11 historical ridge crash was not reproduced on the current
straight route exit; this change does not claim to fix every ridge approach.

Exit checks use M3/M7 canyon, M11, M12 escort and M19/M21/M25 coastal plans. For
each multi-point route they continue the final leg at constant altitude for 600
studs, probing every 20 studs with an 80-stud lateral disc and 40-stud vertical
margin. The server currently sweeps a 4-stud fuselage sphere. The envelope is
therefore conservative for that collider, but it is not a turning simulation.
600 studs equals one second at 3000 displayed mph (600 studs/s), or 3.75 seconds
at 800 mph (160 studs/s). No guarantee is made for arbitrary bank, dives,
checkpoint-edge entries or combat pursuit.

Integration playtest targets:

- M11: destroy Merel, follow the connected spur through both Sable beacons, then
  strike Sable and return to the west-ridge signal volume. Check straight exits
  and turning recovery at 800 and 3000 mph. Verify road visibility under sunset
  lighting and navigation/HUD readability on a real phone.
- M3/M7: follow canyon checkpoints at authored altitude, continue straight beyond
  the last beacon, then turn back; inspect actual voxel and uploaded/fallback
  collider clearance. Include off-centre checkpoint crossings.
- M12: observe the transmitter truck along each escort leg and at the fork;
  inspect wheels against the actual road, not just endpoint positions.
- M19/M21/M25: inspect protected launches through canal bends, bridges and the
  beach approach, with uploaded assets and fallback geometry. Check hulls stay
  afloat and objective cues remain distinct from scenery.

Integration risk is limited to M11 scenery reservation/scatter and three new road
segments. Other layouts are unchanged; the stronger clearance helper is audit-only.
No combat, HUD, M1 instruction or flight-controller files change. Live checks,
review and merge belong to the parent/integration owner.
