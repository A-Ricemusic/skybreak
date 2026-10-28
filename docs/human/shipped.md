# Shipped

Last updated: 2026-10-28. Audited against `origin/main` at `0fb47579945a7c94c702ec61acd6aa914595c2c0`.

[Play SKYBREAK in Roblox Player](https://www.roblox.com/games/112911685457826). Broken Relay is the live 27-mission campaign. Latest merged gameplay revision: `6fc5d9a4c92decc57a50516d62c329d0748ccca6` (#80). Gameplay merges are live through automatic CI/CD under the owner's convention; documentation and housekeeping changes do not add game content.

## Merged 2026-10-28, newest first

| PR | Commit | Exact title | Kind | What the owner will see |
|---|---|---|---|---|
| #95 | `0fb47579945a7c94c702ec61acd6aa914595c2c0` | chore: second cleanup pass for a fresh baseline | Docs / housekeeping | Cleaner repo and baseline docs; no gameplay change. |
| #80 | `6fc5d9a4c92decc57a50516d62c329d0748ccca6` | fix(ui): show every settings row, unstick picker highlights, dedupe sticks | Gameplay / UI | Every settings row including VOICE VOLUME visible; no stuck touch picker highlights. Touch-stick deduplication has no intended visible effect. |
| #78 | `ed53a22b8d1a1b4897e15549e6e50128f624600c` | fix(server): never let world/asset loading hold remote handlers | Gameplay / server | Remote handlers register before slow world/asset loading. |
| #81 | `fd05768952b187a0782cec80007519ef23cd5bfe` | refactor(shared): single sources for kill targets, fire notices and briefing numbers | Gameplay code / briefing correction | Special-weapon briefing numbers match mission data; no intended combat behaviour change. |
| #94 | `5a01aa655ecf08666aa06a997169231d49edb594` | chore: tidy repo after AC04 revert; archive dated reports, drop one-off tools | Docs / housekeeping | Repo cleanup after revert; no new game content. |

## Verification limits and prior feedback

No Roblox Player test was performed by agents for these changes. Expected effects above are based on merged code, not observed gameplay. Owner Player verification of #78 and #80 remains pending in the carried-forward record. Beta readiness has not been reassessed since the revert. No place version or upload receipt was checked for these merges; the previous guide supplied no last-known value to carry forward.

The owner likes the current flight and combat foundation. The earlier AC04 release (#92) was rejected as a whole and reverted by `b0737fac53c60484fde11290c512f9162efa5504`; it is not live. #77 (M1 tutorial handoff) and #91 (TypeScript 5.9) were closed without merging. No open reviewer feedback was recorded against the baseline.

Phase 0 is proposed in this unmerged PR: documentation and research-folder setup only. It does not change Player content. Other redesign work in progress is listed in [Next](next.md), not claimed as shipped here.

Local Phase 0 evidence (2026-10-28, this unmerged branch): `bun install --frozen-lockfile` passed; `LUAU_BIN='/Users/pelicannurse/Projects/test app/build/offline-luau/luau' bun run validate:offline` passed (544 compiled-domain contracts, 3 relay regressions, 10 audio simulations, 8 voice lifecycle simulations, 4 radio checks, 90 Python tests, generated tables/world counts current). `git diff --check` passed. These are offline checks, not a Roblox Player test or a gameplay release.
