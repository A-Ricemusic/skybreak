# Blockers

Last updated: 2026-10-29.

## Open

| Date | Raised by | What is blocked | Impact | What is needed |
|---|---|---|---|---|
| 2026-10-29 | M01 pressure implementation | Roblox Jest and an observed/scripted M01 combat run are blocked by the shared Studio lease (PID 78049, another checkout’s M03 QA). No Studio was started, stopped or modified. | Player/allied launch counts, observed forward-screen appearance and Easy balance remain unverified; do not treat the PR as playtested. | Orchestrator assigns the exclusive lease after the owner closes Studio, verifies no Studio across ≥5 minutes, then runs `bun run test:roblox` plus M01 combat verification and records actual shot counts. |
| 2026-10-29 | Mission 2 agent | Mission 1's runway may have the same hidden-pavement problem found on mission 2 (a 4-stud slab on terrain, D-056). It has not been checked. | Mission 1's runway may be hard to see. | Check mission 1's runway in Studio and fix it separately if needed. |
| 2026-10-29 | Mission 2 world implementation | Phone performance is unmeasured. Mission 2 took 16.0–16.1 s to build on desktop in Studio, including 15.4–15.6 s of terrain work; mission 1 and mission 3 full-scale worlds also lack real-phone measurements. | Loading or frame rate may be worse on a real phone than desktop Studio or the emulator. | The owner's Player playtest on a phone is the real check; report loading and frame-rate problems. Measure mission 3 before activation. |
| 2026-10-29 | Mission 2 implementation | Mission 2's rank cuts, failure rules and air roster are assumptions rather than direct footage readings (D-049, D-057, D-052). | Rank results, the 15:00 failure rule and combat pressure may feel wrong. | Owner feedback after playing mission 2; tune from that result. |
| 2026-10-29 | Mission 3 implementation | Mission 3 data/unlock are in review in #147. Its Studio report records scripted integration, with 35–88 s loads, terraced mountains and low-quality distant terrain concerns. | The merged world and engine support are dormant and cannot make mission 3 playable by themselves. | Finish mission data, then inspect cold load, shell/LOD continuity, update/radio/return flow, real-aircraft landing and mountain clearance in Studio before activation. |
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

## Missions 4–5 review findings

Worlds #144 and engine #145 are merged and dormant; playable data/unlock remain in open #149 and #148. See [per-level status](levels.html) and those PRs for reported Studio checks and assumptions. Earlier cold-load estimates of about 14 s were superseded by reported roughly 45–46 s live-asset Studio builds. Terrain cleanup can delay menu restoration; work on `perf/m04-m05-terrain` is not merged or verified here.

Mission 4 transports exit after about 4:43.5 despite a 12:00 HUD clock; pacing remains unresolved. Mission 5 reports dark rig/tankers, follow-up lighting fixes awaiting Studio re-check, and a cleanup dependency on #147. Main still locks missions 3–18. No Player test is claimed.
