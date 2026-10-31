import { describe, expect, it } from "@rbxts/jest-globals";
import { applyGroundPhase, releaseZoneReserves } from "../server/EngineBatchD11Runtime";
import type { CombatSession, Enemy } from "../server/CombatSession";
import { BlueprintRunner as R } from "../shared/BlueprintRunner";
import { newGroundProgress } from "../shared/EngineBatchD5";
import { d4Fixture } from "./EngineBatchD4Fixture";

/** Only the model boundary is fake: real reserve release and phase presentation run in offline Luau. */
function contact(id: string, gate?: string) {
 const attributes = new Map<string, unknown>();
 const part = { Transparency: 1, CanQuery: false, IsA(name: string) { return name === "BasePart"; }, GetAttribute(name: string) { return name === "OriginalTransparency" ? 0.25 : name === "FlightSolid"; } };
 const model = { GetDescendants() { return [part]; }, SetAttribute(name: string, value: unknown) { attributes.set(name, value); } };
 const enemy = { id, model, typedGround: { reinforceAfterSector: gate }, health: 55, enabled: false, phaseOwner: 0, required: false } as unknown as Enemy;
 return { enemy, part, attributes };
}
describe("D11 score deadline reserve presentation", () => {
 it("preserves D8 wreck scenery without enabling targeting or collision queries", () => {
  const wreck=contact("wreck");wreck.enemy.typedGround!.type="wreck";
  applyGroundPhase([wreck.enemy],0);
  expect(wreck.part.Transparency).toBe(0.25);expect(wreck.enemy.enabled).toBe(false);expect(wreck.part.CanQuery).toBe(false);
  expect(wreck.attributes.get("SkybreakEnemy")).toBe(false);
  applyGroundPhase([wreck.enemy],-1);expect(wreck.part.Transparency).toBe(1);
 });
 it("keeps an unsecured reserve hidden through score expiry into city bombers", () => {
  const bp = d4Fixture(); bp.id = 15;
  const plan = { sectors: [{ id: "city", kind: "troops" as const, clearTargetIds: ["gate-tank"], seconds: 10, health: 100, route: { speed: 10, waypoints: [{ x: 0, y: 40, z: 0 }, { x: 0, y: 40, z: -100 }] }, advanceCall: "Advance", securedCall: "Secured", hitCall: "Hit" }] };
  bp.phases[0].groundProgress = plan;
  const bs = R.NewState(bp, 0), reserve = contact("reserve", "city"), survivor = contact("gate-tank");
  const session = { blueprintState: bs, enemies: [reserve.enemy, survivor.enemy], groundDirector: { phase: 0, states: newGroundProgress(plan) } } as CombatSession;
  applyGroundPhase(session.enemies, 0); releaseZoneReserves(session);
  expect(reserve.enemy.reserveReleased).toBeUndefined(); expect(reserve.part.Transparency).toBe(1);
  bs.score = 800; R.Tick(bs, 420);
  expect(bs.phaseIndex).toBe(1); expect(R.ActivePhase(bs)?.bombers?.count).toBe(6);
  session.groundDirector = undefined; applyGroundPhase(session.enemies, bs.phaseIndex); releaseZoneReserves(session);
  expect(reserve.part.Transparency).toBe(1); expect(reserve.part.CanQuery).toBe(false);
  expect(reserve.enemy.enabled).toBe(false); expect(reserve.attributes.get("SkybreakEnemy")).toBe(false); expect(reserve.attributes.get("RequiredTarget")).toBe(false);
  expect(survivor.part.Transparency).toBe(0.25); expect(survivor.enemy.enabled).toBe(false);
  expect(bs.killedIds.size()).toBe(0); expect(bs.score).toBe(800);
 });
 it("remembers a released reserve after its director is cleared, preserving legacy survivors", () => {
  const bp = d4Fixture();
  bp.phases[0].groundProgress = { sectors: [{ id: "city", kind: "troops", clearTargetIds: [], seconds: 10, health: 100, route: { speed: 10, waypoints: [{ x: 0, y: 40, z: 0 }, { x: 0, y: 40, z: -100 }] }, advanceCall: "Advance", securedCall: "Secured", hitCall: "Hit" }] };
  const reserve = contact("reserve", "city"), bs = R.NewState(bp, 0);
  const session = { blueprintState: bs, enemies: [reserve.enemy], groundDirector: { phase: 0, states: [{ secured: true, health: 100 }] } } as CombatSession;
  releaseZoneReserves(session); expect(reserve.enemy.reserveReleased).toBe(true); expect(reserve.enemy.enabled).toBe(true);
  session.groundDirector = undefined;
  applyGroundPhase(session.enemies, 1); expect(reserve.part.Transparency).toBe(0.25); expect(reserve.enemy.enabled).toBe(false); expect(reserve.part.CanQuery).toBe(false);
  for (let id = 1; id <= 9; id++) { const legacy = contact(`m${id}`); applyGroundPhase([legacy.enemy], 1); expect(legacy.part.Transparency).toBe(0.25); expect(legacy.enemy.enabled).toBe(false); }
 });
});
