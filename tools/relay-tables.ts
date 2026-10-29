// The old 27-mission tables are historical, never regenerated from the new catalog.
import { resolve } from "node:path";
const doc = await Bun.file(resolve(import.meta.dir,"../docs/broken-relay.md")).text();
if (!doc.startsWith("# Historical")) throw new Error("Retired campaign must be marked historical");
console.log("Historical Broken Relay tables retained; active catalog covered by snapshot and campaign contracts.");
