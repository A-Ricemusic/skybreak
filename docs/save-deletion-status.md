# Save deletion durability

The audited defect was `CampaignService.deleteSlot` ignoring `flush()`'s boolean and returning local acceptance as though it confirmed a cloud delete. `GameUI` inferred success from `persistence`, which can remain `cloud` while a write exceeds the flush deadline.

`CampaignResponse.ok` still means the command was accepted. The additive `deletions` receipts identify the slot and deletion generation separately from profile persistence:

- `confirmed`: a successful cloud update returned the empty slot at the exact tombstone generation sent by that write. UI: “deletion confirmed in cloud.”
- `pending`: its write is scheduled or running, including after the five-second flush deadline. UI: “deleted here; cloud confirmation pending. It may return next session.”
- `failed`: no confirmation and no write scheduled/running (including exhausted attempts or a write that did not persist the tombstone). UI: “deleted here; cloud deletion is unconfirmed after saving. It may return next session.” The local deletion remains accepted; the existing dirty-save recovery contract is preserved.
- `session-only`: no store exists. UI: “deleted for this session only. Cloud saves are disabled.” A successful session flush cannot mean cloud confirmation.

For pending deletion the UI checks the read-only `DeletionStatus` action every three seconds, at most ten times, and displays late confirmation or failure. Navigation/new requests or unmount stop observation. A transport failure, cancelled observation, or expiry leaves the last pending warning; it never manufactures confirmation. These checks neither retry deletion nor trigger writes. Future responses also carry current receipts. No new remotes or persistence schema fields are introduced. Receipts live only for the current coordinator session.

Existing save retries continue to merge snapshots using generation tombstones. A late successful tombstone write can confirm the original deletion while newly recreated local progress remains intact and is drained next. A recovery write containing recreated progress does not pretend the empty tombstone itself was confirmed. No status check calls `deleteSlot`, and no automatic destructive retry is added. Confirmation records that the tombstone was acknowledged, not that another session can never write newer progress.

Validation uses synthetic in-memory stores only, injected clock/wait functions, and the standalone Luau CLI. Cases cover successful write, exhausted write, scheduled/inflight deadline expiry, late success/failure, session-only mode, successful recovery, and recreated-slot safety. `bun run build` and the offline domain suite suffice for this change; no Studio, published place, DataStore, or real user save is accessed. Runtime UI/network behavior remains for parent review.
