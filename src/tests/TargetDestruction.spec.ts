import { describe, expect, it } from "@rbxts/jest-globals";
import { disableDestroyedTarget, destroyTargetVisual } from "../server/TargetDestruction";
import { AlliedRules } from "../shared/AlliedRules";
import { GroundAirDefence } from "../shared/GroundAirDefence";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";

// Minimal Instance boundary: exercise the production destruction code in standalone Luau.
function fixture(leaveWreck: boolean) {
 const attrs = new Map<string, AttributeValue>();
 attrs.set("LeaveWreck", leaveWreck); attrs.set("TargetId", "gun");
 const dark = {} as Color3;
 const part = { Anchored: false, CanCollide: true, CanTouch: true, CanQuery: true, Color: {} as Color3,
  IsA(kind: string) { return kind === "BasePart"; }, SetAttribute(key: string, value: AttributeValue) { attrs.set(key, value); } };
 const lamp = { Enabled: true, IsA(kind: string) { return kind === "Light"; } };
 const folder = {} as Instance;
 const model = { Parent: folder as Instance | undefined,
  SetAttribute(key: string, value: AttributeValue | undefined) { if(value === undefined) attrs.delete(key); else attrs.set(key,value); },
  GetAttribute(key: string) { return attrs.get(key); },
  GetDescendants() { return [part, lamp]; },
  Destroy() { this.Parent = undefined; },
 };
 const actor = { model: model as unknown as Model, health: 165, enabled: true, damageable: true, windup: 2, warning: { Enabled: true } as BillboardGui };
 return { attrs, dark, part, lamp, folder, model, actor,
  cleanup: () => { if(model.Parent === folder) model.Destroy(); } };
}

describe("opt-in gun wreck lifecycle", () => {
 it("keeps darkened geometry in the sortie until end/retry cleanup, with no collision or query surfaces", () => {
  const f = fixture(true);
  disableDestroyedTarget(f.actor); destroyTargetVisual(f.actor.model, f.dark);
  expect(f.model.Parent).toBe(f.folder);
  expect(f.model.GetDescendants().size()).toBe(2);
  expect(f.attrs.get("Wreck")).toBe(true);
  expect(f.attrs.get("TargetId")).toBeUndefined();
  expect(f.part.Color).toBe(f.dark);
  expect(f.part.Anchored).toBe(true);
  expect(f.part.CanCollide).toBe(false); expect(f.part.CanTouch).toBe(false); expect(f.part.CanQuery).toBe(false);
  expect(f.attrs.get("FlightSolid")).toBe(false); expect(f.lamp.Enabled).toBe(false);
  f.cleanup(); expect(f.model.Parent).toBeUndefined();
 });
 it("excludes the retained gun from player/auto targeting and firing, and cannot score twice", () => {
  const mission = MissionCatalog.Get(12), state = BlueprintRunner.NewState(mission, 0), ledger = new TargetScore(MissionCatalog.Scoring(12));
  const gun = mission.phases[0].groundTargets!.find(t => t.type === "railgun_emplacement")!;
  const f = fixture(true);
  expect(recordScoredKill(state, ledger, gun.id, "ground", true, 1, gun.scoreRole)).toBe(true);
  disableDestroyedTarget(f.actor); destroyTargetVisual(f.actor.model, f.dark);
  expect(AlliedRules.PlayerTarget(f.actor)).toBe(false);
  expect(GroundAirDefence.Eligible(f.actor.health > 0, f.actor.enabled, 100)).toBe(false);
  // Ring sweep uses the same live actor gates, regardless of retained geometry.
  expect(f.actor.enabled && f.actor.health > 0).toBe(false);
  expect(f.actor.damageable).toBe(false); expect(f.actor.windup).toBe(0); expect(f.actor.warning.Enabled).toBe(false);
  for(const flag of ["SkybreakEnemy", "RequiredTarget", "Damageable", "AttackWarning"]) expect(f.attrs.get(flag)).toBe(false);
  expect(recordScoredKill(state, ledger, gun.id, "ground", true, 2, gun.scoreRole)).toBe(false);
  expect(ledger.Total()).toBe(250);
 });
 it("still deletes targets without the explicit opt-in, including other missions", () => {
  const f = fixture(false); f.attrs.delete("LeaveWreck");
  disableDestroyedTarget(f.actor); destroyTargetVisual(f.actor.model, f.dark);
  expect(f.model.Parent).toBeUndefined(); expect(f.attrs.get("Wreck")).toBeUndefined();
 });
});
