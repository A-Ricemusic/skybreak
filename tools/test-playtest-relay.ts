// Execute the actual LocalScript with inert Roblox surfaces and a deterministic clock.
import { resolve } from "node:path";
import { requireLuauBin } from "./luau-bin";
const root=resolve(import.meta.dir,"..");
const pilot=await Bun.file(resolve(root,"tools/playtest-relay.client.luau")).text();
const harness=await Bun.file(resolve(root,"tools/tests/playtest-relay-harness.luau")).text();
const path=resolve(root,"build/offline-relay/playtest-relay-regression.luau");
await Bun.write(path,harness.replace("-- ACTUAL_PILOT",pilot));
const proc=Bun.spawn([requireLuauBin(),path],{stdout:"inherit",stderr:"inherit"});
if(await proc.exited!==0)throw new Error("Actual QA pilot regression failed");
