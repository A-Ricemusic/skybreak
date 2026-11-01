import { expect } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { CombatSession } from "../../server/CombatSession";
import { MissionCatalog } from "../../shared/MissionCatalog";
import { nextResultMission } from "../../shared/ResultContinuation";

/** Test-only forced completion. It deliberately bypasses objective play, never settlement or unlocks. */
export function forceSmokeVictory(s: CombatSession): void {
 const bs = s.blueprintState!, bp = s.blueprint!;
 bs.phaseIndex = MissionCatalog.TotalPhases(bp);
 bs.requiredGroundKills = MissionCatalog.RequiredGroundKills(bp);
 bs.requiredAirKills = MissionCatalog.RequiredAirKills(bp);
 bs.aceKilled = false;
 bs.elapsed = math.max(30, bs.elapsed);
 bs.outcome = "won"; bs.reason = "complete";
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
 for (const plane of occupancy) for (const row of plane) for (const cell of row) expect(cell).toBe(0);
 // Production collision filter excludes aircraft/invisible aim roots and includes authored solid scenery.
 expect(Workspace.Spherecast(p, 6, new Vector3(0, 1, 0), s.collisionParams)).toBeUndefined();
 const overlap = new OverlapParams(); overlap.FilterType = Enum.RaycastFilterType.Include;
 overlap.FilterDescendantsInstances = s.collisionParams!.FilterDescendantsInstances;
 expect(Workspace.GetPartBoundsInRadius(p, 4, overlap).size()).toBe(0);
}

export function assertSmokeAdoption(s: CombatSession): number {
 const phases = MissionCatalog.ExpandedPhases(s.blueprint!);
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
