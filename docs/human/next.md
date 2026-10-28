# Next

Last updated: 2026-10-28. Priority order; in-progress assignments are owner-supplied status, not completion or gameplay verification.

1. **Phase 0 — this PR, implemented and locally validated; awaiting review/merge.** Replace the human docs, preserve the approved source plan, record decisions, and set up ignored research storage and extraction recipes. This gives the redesign a concise, honest review trail without changing gameplay; prerequisite installation is a separate assignment and branch protection needs owner action.
2. **Phase 1 — footage indexing, in progress.** Build the timestamped coverage ledger from a 480p proxy and inspect selected 1080p mission clips. This establishes mission boundaries and evidence before specifications; sparse indexing does not count as full viewing.
3. **Phase 3.1–3.4 — refactors, in progress.** Split mission data, unify the mission runner, extract PhaseDirector, and split GameUI by screen while preserving Broken Relay behaviour. These reduce shared-file conflicts and make individual mission and screen work manageable; they are not shipped by this PR.
4. **Mission 1 specification.** Write `docs/specs/missions/m01.md` from indexed footage with timestamped observations, unknowns and engine gaps. It bounds the first playable slice and gives the owner a small design to review.
5. **Systems specifications.** Specify title/menu flow, briefing, aircraft selection, HUD/radar, results/ranking, story presentation and consolidated engine gaps under `docs/specs/systems/`. These give screen and engine implementation an evidence-backed target while preserving the accepted flight and combat foundation.
6. **Mission 1 vertical slice.** Build its original map, mission data and scripts, complete independent reviews and any exact-asset safety gate, then merge with mission 1 unlocked and missions 2–18 locked. The owner reviews it in Player before mission 2 starts; D-004 replaces the source plan's later three-mission batching proposal.

See [Blockers](blockers.md) for branch protection and disk constraints, and [Decisions](decisions.md) for provisional defaults and owner overrides.
