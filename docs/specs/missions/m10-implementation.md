# M10 RIVER LINE — implementation review

2026-10-30. Branch `feat/m10-mission`, based on D6 and merged main `248e387`. Depends on #182, #183, #185. Proposed D-380–D-383; not a recovered exact reference roster or visual fidelity claim. No Studio/Player run, audio upload or new Blender asset.

## Target ledger

| Combat role / world drawing | Count | Points each | Total |
|---|---:|---:|---:|
| Container | 12 | 30 | 360 |
| Barracks | 12 | 50 | 600 |
| Barracks / provisional tank drawing | 12 | 50 | 600 |
| AA gun | 12 | 20 | 240 |
| SAM | 12 | 30 | 360 |
| Antenna | 8 | 40 | 320 |
| Watchtower | 8 | 30 | 240 |
| Flak | 8 | 40 | 320 |
| Fuel tank | 8 | 100 | 800 |
| Control tower / provisional radar drawing | 8 | 100 | 800 |
| Gunboat / frigate drawing | 8 | 30 | 240 |
| Container ship / tanker drawing | 8 | 120 | 960 |
| Gunboat | 6 | 30 | 180 |
| Submarine | 2 | 120 | 240 |
| Added pen | 2 | 200 | 400 |
| Added crane | 2 | 20 | 40 |
| Parked prop transport role | 1 | 100 | 100 |
| Parked VTOL role | 6 | 60 | 360 |
| Parked transport helicopter | 5 | 40 | 200 |
| **Static/parked total** | **140** | | **7,360** |
| Additional attack helicopters | 8 | 50 | 400 |
| Additional transport helicopters | 2 | 40 | 80 |
| Additional VTOL roles | 6 | 60 | 360 |
| Heavy/canard fighter roles | 3 | 60 | 180 |
| Additional pressure fighters | 12 | 60 | 720 |
| LOCKKEEPER ace | 1 | 240 | 240 |
| **Additional airborne total** | **32** | | **1,980** |
| **Maximum score** | | | **9,340** |

Twelve parked aircraft can become airborne once, using the same kill id; they never add twelve more score entries. Total finite airframes = 12 parked handoffs + 32 additional = **44**. The debrief source air tally totals 32 despite its opening 26-air map count; this slice preserves the known roles and adds twelve attacking fighters as owner-directed pressure. It does not claim 150 simultaneous contacts or source-exact ground/naval subtypes. All 124 dormant world ids remain adopted; extra contacts have separate `m10_parked_*`, `m10_pen_*`, `m10_crane_*` ids. Existing models and procedural geometry stand in for specialized aircraft and structures.

Four LANTERN allies share one mission kill, without player credit. At most eight route aircraft/fighters are admitted together, with at most two routed helicopters so six slots remain for pursuing aircraft. Blocked routes yield to later fighters; helicopters retire after one patrol under 90 seconds without score. Finite waves queue. D6 bounds static detail to 24 nearby targets and two geometry changes per half-second. Route inventory permits 16 on D6 cheap-contact phases, preserving six elsewhere.

## Phases and failure

| Phase/service | Trigger | Completion or effect |
|---|---|---|
| Distributed strike | Airborne NE start, Y=617 | Score >=3,000 at 1,200 active seconds; no early completion/all-target requirement |
| Parked handoffs | 180 + 15i seconds, i=0–11, when queue admits | Live parked contact retired without credit; one airborne identity; destroyed parked contact suppresses flight |
| Pressure waves | 480/660/840 seconds | Four extra attacking fighters per finite wave |
| Ace | 960 seconds | Optional 240 points, queued |
| Artillery | Warn at 240; impact at 300/420/540/660/780/900/1020/1140 | 45-second warning, 15-second countdown, 35 damage if above Y=585 OR unmasked |
| Optional runway rearm | Southwest service gate | Landing/takeoff/menu pause sortie and hostile simulation; refill ammunition, preserve score/damage/identities |
| Result | Strike expiry | Victory at minimum score; lower score fails. Destruction, collision and bounds retain engine failure rules |

Artillery ceiling is absolute. Source (15000,700,-15000) uses <=1,000-stud ray segments, including endpoint exclusion. Offline checks sample the shared built surface for the A-runway refuge (x2940, z5500–9000, Y300), distant masking and normal-cruise NE ingress. Ingress lowering preserves the generated water footprint. Runtime swept clearance/raycast agreement, high-pose recovery and rendered reference framing still need orchestrator Studio verification.

Optional service runway: southbound heading 180, touchdown (-9600,86,11268), 2,400-stud approach, 20-second approach + 15-second rollout + 20-second takeoff and weapon menu. Finite stocks: 58 missiles, 750 gun rounds, 12 selected special charges; 4AAM ground footprint radius220/depth80/damage180. Health is never restored.

## Ranks

| Rank | Points | Evidence/tuning |
|---|---:|---|
| C / completion | 3,000 | Spec minimum |
| B | 3,800 | Above observed C 3,370, at/below observed B 3,930 |
| A | 4,200 | Above observed B 4,170, at/below observed A 4,210 |
| S | 5,400 | Above observed A 5,340, at/below observed S 5,460 |

The observed 6,190 S run is not used as the exact S cutoff. Allied kills may lower the player-achievable maximum without changing the ledger ceiling.

Story uses MISSION_STORY_TEXT[10], remapped chapter 9 “Walking the storm,” in next-day clear weather. Added dialogue is subtitle-only. Rusk is not identified. Full Beta/Studio checklist: [human next](../../human/next.md).
