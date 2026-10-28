import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkAC04Only } from "../check-ac04-only";
for (const kind of ["tool", "asset", "mapped", "package"]) test(`AC04 gate rejects ${kind} legacy input`, async () => {
 const root = await mkdtemp(join(tmpdir(), "ac04-gate-"));
 try {
  await mkdir(join(root, "src/server"), { recursive: true });
  await writeFile(join(root, "src/server/AC04CampaignService.ts"), 'GetDataStore("SkybreakAC04Fresh_20261027_v1"); `player_${player.UserId}`');
  const file = kind === "tool" ? "tools/generate.py" : kind === "asset" ? "assets/mission/commsrelay.mesh.json" : kind === "package" ? "package.json" : "extra/input.json";
  await mkdir(join(root, file, ".."), { recursive: true });
  await writeFile(join(root, file), kind === "asset" ? "{}" : '"Broken Relay"');
  if (kind === "mapped") await writeFile(join(root, "default.project.json"), JSON.stringify({ tree: { Legacy: { $path: file } } }));
  await expect(checkAC04Only(root)).rejects.toThrow(/Retired/);
 } finally { await rm(root, {recursive: true, force: true}); }
});
test("mathematical relay and historical documentation are allowed", async () => {
 const root = await mkdtemp(join(tmpdir(), "ac04-gate-"));
 try {
  await mkdir(join(root,"src/server"),{recursive:true});
  await mkdir(join(root,"docs/archive"),{recursive:true});
  await writeFile(join(root,"docs/archive/history.json"),'"Broken Relay"');
  await writeFile(join(root,"src/server/AC04CampaignService.ts"),'// relay signal\nGetDataStore("SkybreakAC04Fresh_20261027_v1"); `player_${player.UserId}`');
  expect(await checkAC04Only(root)).toBe(1);
 } finally { await rm(root,{recursive:true,force:true}); }
});
