# Blockers

Last updated: 2026-10-29.

## Open

| Date | Raised by | What is blocked | Impact | What is needed |
|---|---|---|---|---|
| 2026-10-29 | Mission 2 agent | Mission 1's runway may have the same hidden-pavement problem found on mission 2 (a 4-stud slab on terrain, D-056). It has not been checked. | Mission 1's runway may be hard to see. | Check mission 1's runway in Studio and fix it separately if needed. |
| 2026-10-29 | Mission 2 world implementation | Phone performance is unmeasured. Mission 2 took 16.0–16.1 s to build on desktop in Studio, including 15.4–15.6 s of terrain work; mission 1 and mission 3 full-scale worlds also lack real-phone measurements. | Loading or frame rate may be worse on a real phone than desktop Studio or the emulator. | The owner's Player playtest on a phone is the real check; report loading and frame-rate problems. Measure mission 3 before activation. |
| 2026-10-29 | Mission 2 implementation | Mission 2's rank cuts, failure rules and air roster are assumptions rather than direct footage readings (D-049, D-057, D-052). | Rank results, the 15:00 failure rule and combat pressure may feel wrong. | Owner feedback after playing mission 2; tune from that result. |
| 2026-10-29 | Mission 3 implementation | Mission 3 runtime quality and integration are unverified; mission data/unlock are still in progress. | The merged world and engine support are dormant and cannot make mission 3 playable by themselves. | Finish mission data, then inspect cold load, shell/LOD continuity, update/radio/return flow, real-aircraft landing and mountain clearance in Studio before activation. |
| 2026-10-28 | Orchestrator | `main` has no required `validate` branch-protection check. | A PR can merge before validation even though every gameplay merge publishes automatically. | In GitHub Settings → Branches, require the `validate` check on `main`; until then the orchestrator continues to gate merges manually. |

## Resolved

| Date | Raised by | What was blocked | Resolution |
|---|---|---|---|
| 2026-10-29 | PR #143 independent review | Mission 2 completion erased mission 1 score breakdowns; mission 1 replays and save normalization also lost fields. Mission 2 decision IDs collided with PR #141. | Fixed and merged in #143. Completion repair and legacy-time normalization update records in place; shared offline/Roblox Jest regressions cover breakdown preservation, replays, loaded saves, locked mission rejection and legitimate mission 2 completion. Failure rules and weapons use D-057/D-058. The publish workflow succeeded as place version 92. No agent Player test is claimed. |
| 2026-10-29 | Asset wiring / PR #142 | Mission 4–5 uploaded asset orientation and scale; two Studio-only tanker Jest failures. | Studio checked all five uploads: -Z forward, +Y up, plausible scale, tanker waterline at Y=0 with offset 16, helicopter rotor hubs and port tail rotor correct. The fixture was fixed; Jest passed 808/808 across 80 suites. Assets remain dormant; no Player test. |
| 2026-10-29 | Orchestrator | Owner acceptance of the first mission 1 beta. | The owner played mission 1 and reported that it loaded but was too easy. #134 moved the bombers farther away, added attacking raiders and raised the S threshold. Feedback on the tuned version remains welcome but no longer blocks mission 2. |
| 2026-10-29 | PR #137 elite safety gate | The elite Vanta livery revisions 1–2 did not meet the strict upload gate. | Revision 3 received an independent 10/10 approval for the exact export and textures. It and the other four approved mission 4–5 models were uploaded and moderation-approved, then wired dormant in #142. A 10/10 is the project's maximum safety judgment, not a guarantee against moderation or future policy changes. |
| 2026-10-28 | Orchestrator | Uploading the approved bomber and carrier. | Both models uploaded and passed moderation (assets `112476761254185` and `118082412288291`), then were wired and checked in Studio in #124. |
| 2026-10-28 | Independent reviewer | Bomber and carrier safety review. | Revision 2 was approved at 10/10 in review 3 (D-032). |
| 2026-10-28 | Orchestrator | Whether full-scale worlds could load in reasonable time. | Measured in #109: feasible with level of detail (D-028); full detail everywhere is not. Real-phone performance remains open above. |
| 2026-10-28 | Orchestrator | Disk space was down to about 10 GB free. | The owner approved removing this project's old checkouts under safety rules; free space increased to about 22 GB. |
| 2026-10-28 | Footage analyst | Whether 1080p sections of the reference could be downloaded. | Confirmed with 1440×1080, 59.94 fps mission clips. |
| 2026-10-28 | Several agents | Fresh worktrees lack an offline Luau runner. | Set `LUAU_BIN=/Users/pelicannurse/Projects/test app/build/offline-luau/luau`; agent briefs now carry this requirement. |

## M04/M05 pending verification and assumptions


The two worlds are merged and dormant (#144). The full Studio test suite passed with them (840/840), but no world was loaded and inspected visually, and no Player test was performed. Cold load times, water appearance, shell continuity in the renderer, uploaded assets and phone performance need the orchestrator’s Studio/Player pass before activation. M05 point/search/runway lights need engine batch C; this PR exports anchors only. Approved assets from merged PR #142 use stand-ins if runtime loading fails.

Assumptions: M04’s translated start and NE/east/SE route implement the reference’s recommended hook; initial jammer and escort offsets and four later escort poses are provisional. M05 uses A3’s 48 rig /40 refinery ground split; per-type counts, eight linked decks, individual coordinates, coastline, northbound runway and light-anchor density are not readable precisely in the footage. Review fixes lower the navigable sea bed to8 beneath surface32, clear rotated tanker keels, extend the tower apron and support grass-free rotated tracks. M04 exports nine ordinary escorts plus one ace (maximum1,540); M05 includes an assumed command building for the observed100-point contact and a2,400-point rig ledger. Ship waterline poses stay32. These choices are recorded in D-080–D-085 and the composition specs; mission failure/scoring/RTB behavior remains separate integration work.

Cold Studio builds remain unmeasured. Apply M02’s approximately 1.5× estimate correction when planning the lease (roughly 14 s: M04 9.259 s ×1.5 ≈13.89 s; M05 9.281 s ×1.5 ≈13.92 s); no measured runtime is claimed.
