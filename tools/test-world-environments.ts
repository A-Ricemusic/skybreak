// Match the client registry to the world keys actually registered/published by server builders.
import assert from "node:assert/strict";
const registry = await Bun.file("src/shared/WorldEnvironments.ts").text();
const keys = new Set([...registry.matchAll(/\[(M\d+_WORLD_KEY),\s*(M\d+_ENVIRONMENT)\]/g)].map(m => {
 assert.equal(m[1].replace("_WORLD_KEY", ""), m[2].replace("_ENVIRONMENT", ""));
 return m[1];
}));
const registered = new Set<string>();
for await (const file of new Bun.Glob("*World.ts").scan("src/server")) {
 const source = await Bun.file("src/server/"+file).text();
 for (const m of source.matchAll(/registerWorldClear\(\s*(M\d+_WORLD_KEY)|WorldEnvironment\.ApplySpec\(\s*M\d+_ENVIRONMENT,\s*(M\d+_WORLD_KEY)/g)) {
  const key = m[1] ?? m[2];
  assert(keys.has(key), file+" publishes/registers "+key+" without a client environment");
  registered.add(key);
 }
}
assert.deepEqual([...keys].sort(), [...registered].sort(), "Client registry must cover exactly the server world keys");
assert.equal(keys.size, 18);
const m17=await Bun.file("src/server/M17World.ts").text();
assert.match(m17,/descendants,\s*M17.cloudFeet,\s*0.25/, "M17 builder must publish the tested cloud-base metadata");
console.log("WORLD_ENVIRONMENTS passed="+keys.size+" failed=0 (static registry/publication contract)");
