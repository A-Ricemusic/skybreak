# Military kit world-instance budget audit (2026-10-31)

Baseline: origin/main a06d05f9 (#218). No Studio or Player execution in this change.

M03's guard was `scene.GetDescendants().size() <= M03.budget.descendants` after
`adoptGroundTarget`, with a limit of 148. The plan creates 80 scenery Parts;
targets add 37 primitive Parts, 14 Aim Parts and 14 target Models: **145**.
Nine radar and four AA targets receive military decorations; the helicopter does
not. The committed exports have one mesh/material per model (see the military
kit review README). UploadedAssets normalizes these into a Model containing a
MeshPart with SurfaceAppearance: **3 additional instances per decoration**, so
**184** total, exceeding 148. This is a source/instance-structure calculation,
not a measurement of a live server's downloaded asset. Any retained attachments
or additional mesh children increase the count further. Existing proxy geometry
is retained, not replaced, by GroundTargetFactory.

| Builder | Previous cap position | Resolution |
| --- | --- | --- |
| M01 | 1300 descendants, including uploads, +4 reserve | Shared accounting; same cap/reserve. No military placement today. |
| M02 | 1300 descendants after adoption, +4 reserve | Separate bounded kit descendants; same base cap/reserve. |
| M03 | 148 descendants after adoption | Separate bounded kit descendants; same base cap. |
| CompositionWorld / M04–M18 | Per-world descendant limit before target adoption | Same shared accounting and original per-world limits. Every later military decoration is independently bounded at placement. |
| Practice / MissionWorld / RelayWorld | Scenery.Report BasePart warning (600 primitive parts; uploaded split) | No throwing descendant assertion to fix; unchanged. |
| MilitaryGroundKit / WorldAssets | Mapping / generic clone placement; no world cap | Decorator accepts at most 24 total instances including Model root, otherwise destroys only that decoration before hiding proxies. |

The 24-instance allowance follows the existing composition per-prop reservation.
For the fixed M03 layout, the accepted total is bounded by its 148 base limit +
13 × 24 = 460 instances (457 with today’s 145-instance base), rather than an
unbounded exclusion of uploaded content.
WorldInstanceBudget traverses the actual instance tree: only marked, individually
bounded kit decoration subtrees move to the separate budget. Original target
Models, Aim Parts and collision proxies still count against the base cap. Other
uploaded assets keep their original cap treatment. The number of target owners
is itself bounded by the base cap. No budget is deleted; no gameplay identifiers,
proxies, geometry positions or aiming calculations change.

Studio Jest regressions build all M01–M18 builders with terrain writing and
environment application stubbed, and an in-memory UploadedAssets loader (no
network) that exercises the real normalization and placement path. The richer
fixture contains two MeshParts, each with SurfaceAppearance and Attachment (7
instances per Model). M03 also tests the current 3-instance shape and verifies
the old total exceeds 148 while the corrected cap succeeds, target IDs and Aim
roots survive, and mesh visuals remain non-queryable. Additional tests reject
base-cap overflow and retain visible procedural proxies for oversized imports.
These tests are compiled here; execution belongs to the orchestrator's Studio run.

Validation for this hotfix: frozen install, standalone build and prescribed LUAU_BIN validate:offline all exited 0. Studio assembly regressions compiled only; orchestrator execution pending.
