import { expect } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { CombatSession } from "../../server/CombatSession";
import { BlueprintRunner } from "../../shared/BlueprintRunner";
import { MissionCatalog } from "../../shared/MissionCatalog";
import { nextResultMission } from "../../shared/ResultContinuation";

/** Jest assertion failures are tables, sometimes containing nested/cyclic matcher values. */
export function smokeError(value: unknown, seen = new Set<defined>(), depth = 0): string {
 if (!typeIs(value, "table")) return tostring(value);
 if (seen.has(value)) return "[cycle]";
 if (depth >= 6) return "[depth limit]";
 seen.add(value);
 const fields: string[] = [];
 for (const [key, item] of pairs(value)) fields.push(`${tostring(key)}: ${smokeError(item, seen, depth + 1)}`);
 seen.delete(value);
 return `{${fields.join(", ")}}`;
}

/** ReadVoxels arrays also contain Size: Vector3. Generalized iteration visits that key. */
export function assertEmptySmokeVoxels(occupancy: ReadVoxelsArray<number>): void {
 const size = occupancy.Size;
 for (let x = 0; x < size.X; x++) for (let y = 0; y < size.Y; y++) for (let z = 0; z < size.Z; z++) {
  expect(occupancy[x][y][z]).toBe(0);
 }
}

/** Test-only forced completion. It deliberately bypasses objective play, never settlement or unlocks. */
export function forceSmokeVictory(s: CombatSession): void {
 const bs = s.blueprintState, bp = s.blueprint;
 assert(bs !== undefined && bp !== undefined, "Production session must have blueprint state");
 // Match terminal state even after the phase inspection pass replaced the phase list.
 bs.phases = MissionCatalog.ExpandedPhases(bp);
 bs.phaseIndex = bs.phases.size();
 const final = bs.phases[bs.phases.size() - 1];
 bs.phaseProgress = final.count ?? 1;
 bs.requiredGroundKills = MissionCatalog.RequiredGroundKills(bp);
 bs.requiredAirKills = MissionCatalog.RequiredAirKills(bp);
 bs.aceKilled = false;
 bs.elapsed = math.max(30, bs.elapsed);
 bs.outcome = "won"; bs.reason = "complete";
 // M2 ends in required_ground, rather than an ace/landing. Exercise that phase's
 // actual completion rule with its required target ids; optional AA/ace never block it.
 if (final.kind === "required_ground" && final.groundTargets !== undefined && !final.scoreThreshold) {
  bs.phaseIndex = bs.phases.size() - 1; bs.phaseProgress = 0;
  bs.requiredGroundKills -= final.count ?? 0;
  bs.outcome = undefined; bs.reason = undefined;
  bs.startedAt = os.clock() - bs.elapsed;
  for (const target of final.groundTargets) if (target.required) {
   bs.killedIds.delete(target.id);
   assert(BlueprintRunner.RecordKill(bs, target.id, "ground", true, os.clock()), `Forced ground kill refused: ${target.id}`);
  }
  assert(bs.outcome === "won", "Required ground phase did not complete");
 }
 s.kills = bs.requiredAirKills + bs.requiredGroundKills;
 s.active = true; s.finished = false; s.crashReason = undefined;
}

export function assertSmokeSpawn(s: CombatSession): void {
 const p = new Vector3(s.state.x, s.state.y, s.state.z);
 expect(math.abs(p.X)).toBeLessThanOrEqual(s.airspace.hardHalfWidth);
 expect(math.abs(p.Z)).toBeLessThanOrEqual(s.airspace.hardHalfWidth);
 const params = new RaycastParams(); params.FilterType = Enum.RaycastFilterType.Include;
 params.FilterDescendantsInstances = [Workspace.Terrain]; params.IgnoreWater = false;
 // Cast from above so a spawn buried inside a hill cannot masquerade as clear air.
 const ground = Workspace.Raycast(new Vector3(p.X, 8192, p.Z), new Vector3(0, -15000, 0), params);
 expect(p.Y).toBeGreaterThan((ground?.Position.Y ?? 0) + 8);
 const [, occupancy] = Workspace.Terrain.ReadVoxels(new Region3(p.sub(new Vector3(4,4,4)), p.add(new Vector3(4,4,4))).ExpandToGrid(4), 4);
 assertEmptySmokeVoxels(occupancy);
 // Production collision filter excludes aircraft/invisible aim roots and includes authored solid scenery.
 const collision = s.collisionParams;
 assert(collision !== undefined, "Production session must have collision filters");
 expect(Workspace.Spherecast(p, 6, new Vector3(0, 1, 0), collision)).toBeUndefined();
 const overlap = new OverlapParams(); overlap.FilterType = Enum.RaycastFilterType.Include;
 overlap.FilterDescendantsInstances = collision.FilterDescendantsInstances;
 expect(Workspace.GetPartBoundsInRadius(p, 4, overlap).size()).toBe(0);
}

export function assertSmokeAdoption(s: CombatSession): number {
 const blueprint = s.blueprint;
 assert(blueprint !== undefined, "Production session must have a blueprint");
 const phases = MissionCatalog.ExpandedPhases(blueprint);
 // Practice uses blueprint.ground and generated identities, without typed phase ownership.
 const legacy = s.enemies.filter(e => e.kind === "ground" && e.typedGround === undefined);
 expect(legacy.size()).toBe(blueprint.ground.size());
 for (let index = 0; index < legacy.size(); index++) {
  expect(legacy[index].groundIndex).toBe(index);
  expect(legacy[index].model.Parent).toBe(s.folder);
  expect(legacy[index].model.PrimaryPart).toBeDefined();
 }
 const ids = new Set<string>();
 for (let index = 0; index < phases.size(); index++) for (const spec of phases[index].groundTargets ?? []) {
  if (!spec.required) continue;
  expect(ids.has(spec.id)).toBe(false); ids.add(spec.id);
  const contacts = s.enemies.filter(e => e.id === spec.id);
  expect(contacts.size()).toBe(1);
  const e = contacts[0];
  expect(e.phaseOwner).toBe(index); expect(e.typedGround).toBe(spec);
  expect(e.model.Parent).toBe(s.folder); expect(e.model.PrimaryPart).toBeDefined();
  expect(e.model.GetAttribute("TargetId")).toBe(spec.id);
  expect(e.model.GetDescendants().some(p => p.IsA("BasePart") && p.GetAttribute("OriginalTransparency") !== undefined)).toBe(true);
  // No duplicate world-owned drawing left behind after production adoption.
  expect(s.folder.GetDescendants().filter(p => p.IsA("Model") && p.GetAttribute("TargetId") === spec.id).size()).toBe(1);
 }
 expect(nextResultMission(true, 18)).toBeUndefined();
 return s.enemies.size();
}
