# Blockers

Last updated: 2026-10-29.

## Open

Mission 3 world (#139) and engine batch B (#141) are merged and dormant. Its offline contracts establish geometry only; no Studio or Player observation is claimed.


| Date | Raised by | What is blocked | Impact | What is needed |
|---|---|---|---|---|
| 2026-10-29 | Mission 2 world implementation; updated by the mission 2 agent | Mission 2 phone performance is unmeasured. Studio (desktop) measured the world build at 16.0–16.1 s in Play (terrain 15.4–15.6 s), with one 0.32 s terrain write stall, against an offline estimate of 10.5 s. | The loading screen holds about 16 s on desktop; a phone may be slower. | Your Player playtest on a phone is the real check; tell the orchestrator if loading feels too long. |
| 2026-10-29 | Mission 2 agent | Mission 1's runway may have the same hidden-pavement problem found on mission 2 (a 4-stud slab on terrain, D-056). Not checked; mission 1 was left unchanged. | If so, mission 1's runway is hard to see. | Orchestrator: check mission 1's runway in Studio and fix in a separate PR if needed. |
| 2026-10-29 | Mission 2 implementation | Mission 2's rank cuts, failure rules and air roster are assumptions, not footage readings (spec A1–A3: D-049, D-057, D-052). | Ranks, fail conditions and pressure may feel off until you play it. | **You:** after mission 2 merges, tell the orchestrator whether the ranks, the 15:00 limit and the enemy pressure feel right. |
| 2026-10-29 | Mission 3 implementation | M03 Studio load time, rendered shell continuity/LOD seams, landing path verification and phone performance are unmeasured. | Offline estimates and swept geometry checks do not establish runtime quality. | Measure cold load and inspect all shell/LOD transitions; verify the engine landing with the real aircraft and measure a real phone before activation. |
| 2026-10-29 | Mission 3 implementation | Mission 3 mission data/unlock remain outstanding; engine batch B is merged and dormant. | World composition alone cannot make mission 3 playable. | Engine batch B owns mission update banner, clock reset, return-line objective, automatic skippable landing and terrain-relative LOW ALTITUDE; do not implement the warning in the world builder. |
| 2026-10-29 | Engine batch B | Mission 3 runtime quality and integration are unverified. | Dormant features do not enable mission 3; no Studio or Player test performed. | Orchestrator runs Roblox specs under its Studio lease, checks update/radio/return/landing/skip and mountain clearance, then integrates mission 3 data and the remaining presentation items in Next. PR #141 review corrections are merged and dormant; they do not establish visual quality. |
| 2026-10-29 | Orchestrator | Owner acceptance of mission 1 (the beta test). | Mission 2 waits for your feedback (D-004). | **You:** play the practice flight and mission 1 in Roblox Player and report what you notice. |
| 2026-10-28 | Large-world measurement | Real-phone performance and streaming for full-scale worlds are unverified. Studio measured mission 1's world at 4 to 5.5 s server build and 60 FPS in the phone emulator (#114), but the emulator runs on desktop hardware. | Mission 1's world may need tuning after it goes live. | Re-measure the tuned world in Studio before the campaign switch; your Player playtest on a phone is the real check. |
| 2026-10-28 | Orchestrator | Enforced checks before merge: main has no branch protection. | A PR can merge before its `validate` check passes, and every merge goes live. The orchestrator gates merges by hand for now. | **You:** in GitHub, Settings → Branches, require the `validate` check on `main`. |

## Resolved

| Date | Raised by | What was blocked | Resolution |
|---|---|---|---|
| 2026-10-29 | PR #143 independent review | Mission 2 completion erased mission 1 score breakdowns; mission 1 replays and save normalization also lost fields. Mission 2 decision IDs collided with PR #141. | Fixed on unmerged PR #143: completion repair and legacy-time merging update existing records in place. Shared offline/Roblox Jest regressions cover breakdown preservation, replays, loaded saves, locked mission rejection and legitimate mission 2 completion. Failure rules and weapons now use D-057/D-058. Validation: build passed; offline Luau 682/0, catalog 19/0, relay 3/0; full offline gate passed. New Jest cases compiled but Studio was not run. Orchestrator retains Studio validation and merge ownership. |
| 2026-10-29 | Asset wiring / PR #142 | Mission 4–5 uploaded asset orientation and scale; two Studio-only tanker Jest failures. | Studio checked all five real uploads beside the bomber and regular Vanta v2: -Z forward, +Y up, scale plausible, tanker waterline at Y=0 with offset 16, helicopter rotor hubs and port tail rotor correct. No correction data changes needed. The tanker fake exceeded Roblox’s 2048-stud part limit; fixed fixture scale without weakening validation. Jest 808 passed / 0 failed, 80 suites after rebase onto main (#139/#141). [Evidence](../qa/orientation/2026-10-29/README.md). Assets remain dormant; no Player test. |
| 2026-10-28 | Orchestrator | Uploading the approved bomber and carrier (the first key request timed out). | You provided the key through the secure card; both models uploaded and passed moderation (assets 112476761254185 and 118082412288291), then were wired in and checked in Studio (#124). |
| 2026-10-28 | Independent reviewer | Bomber and carrier safety review: review 1 rejected both; review 2 stopped at a brief error. | Revision 2 approved at 10/10 in review 3 (D-032). |
| 2026-10-28 | Orchestrator | Whether full-scale worlds (D-019) could load in reasonable time. | Measured (#109): feasible with level of detail (D-028). Full detail everywhere is not. |
| 2026-10-28 | Orchestrator | Disk space was down to about 10 GB free. | Owner approved removing this project's old checkouts only. An agent removed 129 that were clean and whose work was pushed or merged; free space is now about 22 GB. 47 were kept by the safety rules (recent, uncommitted, or commits not proven elsewhere). |
| 2026-10-28 | Footage analyst | Whether 1080p sections of the video could be downloaded was unconfirmed. | Confirmed: mission 1 was downloaded at 1440×1080, 59.94 fps. |
| 2026-10-28 | Orchestrator | The first footage agent ended its turn while the download was still running, with no ledger. | The download had completed. A second agent resumed from there and finished the ledger; the first was cancelled so only one agent owned the footage folder. |
| 2026-10-28 | Several agents | Fresh worktrees have no offline Luau runner, so the offline validator fails at first. | Point `LUAU_BIN` at the main checkout's copy (`build/offline-luau/luau`). This recurs in every new worktree; agent briefs now mention it. |

## PR #137 elite safety gate — resolved

Revision 3 (`vanta-v2-elite-3`) fixed the rejected rear treatment. Independent review 3 approved the exact export at 10/10: [review record](../qa/asset-reviews/2026-10-29-pr137-review-3.md). All five models were uploaded and moderation-approved on 2026-10-29 (journal `~/.skybreak-roblox-uploads/journal-3407487520.json`). Wiring on this branch remains unused until missions 4–5. The Studio orientation/scale gate passed on 2026-10-29; see the resolved row above. No upload or Player test was performed by this implementation agent.
