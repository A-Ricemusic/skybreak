import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace, Players } from "@rbxts/services";
import { clearProtection, hitProtected, protectedTarget, stepProtection } from "../server/EngineBatchD7Runtime";
import type { CombatSession, Enemy } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { d7Fixture } from "./EngineBatchD7Fixture";
function fixture() {
 const folder=new Instance("Folder");folder.Parent=Workspace;
 const bs=BlueprintRunner.NewState(d7Fixture(),0);
 const session={folder,player:{UserId:Players.GetPlayers()[0]?.UserId ?? 1},blueprintState:bs,enemies:[],allies:[],projectiles:[],alliedKills:[]} as unknown as CombatSession;
 return {session,folder,bs};
}
describe("D7 protected aircraft Roblox integration (Studio pending)",()=>{
 it("creates separate friendly identities and routes without admitting player targets or armed allies",()=>{
  const f=fixture();try {
   stepProtection(f.session,0,()=>{}); const actors=f.session.protectedFlight!.actors;
   expect(actors.size()).toBe(2);expect(actors[0].aircraft.model.GetAttribute("Damageable")).toBe(false);expect(actors[0].aircraft.model.GetAttribute("SkybreakEnemy")).toBe(false);
   expect(actors[0].aircraft.model.GetAttribute("ProtectedObjective")).toBe(true);expect(actors[0].label.Text.find("ORCHARD ONE")[0]).toBeDefined();
   stepProtection(f.session,100,()=>{});expect(actors[0].aircraft.position.Y).toBe(2800);expect(actors[1].aircraft.position.Y).toBe(900);
   expect(f.session.enemies.size()).toBe(0);expect(f.session.allies.size()).toBe(0);
   const hostile={attackProtected:"high"} as Enemy;expect(protectedTarget(f.session,hostile)).toBe(actors[0].aircraft);
  } finally {clearProtection(f.session);f.folder.Destroy();}
 });
 it("warns once, loses immediately and grants no kill or score for a civilian hit",()=>{
  const f=fixture();try {
   stepProtection(f.session,0,()=>{});const target=f.session.protectedFlight!.actors[1].aircraft;const lines:string[]=[];
   hitProtected(f.session,target,10,line=>{lines.push(line);});hitProtected(f.session,target,10,line=>{lines.push(line);});expect(lines.size()).toBe(1);expect(target.health).toBe(100);
   hitProtected(f.session,target,100,()=>{});expect(f.bs.reason).toBe("protected_lost");expect(f.bs.killedIds.size()).toBe(0);expect(f.session.alliedKills.size()).toBe(0);
  } finally {clearProtection(f.session);f.folder.Destroy();}
 });
 it("retires safe aircraft and missile destinations; completes only when both safe and cleans phase changes",()=>{
  const f=fixture();try {
   stepProtection(f.session,200,()=>{});expect(f.bs.outcome).toBeUndefined();expect(protectedTarget(f.session,{attackProtected:"high",position:Vector3.zero} as Enemy)).toBe(f.session.protectedFlight!.actors[1].aircraft);
   stepProtection(f.session,10,()=>{});expect(f.bs.outcome).toBe("won");expect(f.session.protectedFlight).toBeUndefined();expect(f.folder.GetChildren().size()).toBe(0);
  } finally {clearProtection(f.session);f.folder.Destroy();}
 });
 it("destroys phase-owned aircraft on transition and supports idempotent cleanup",()=>{
  const f=fixture();try {stepProtection(f.session,0,()=>{});f.bs.phaseIndex++;stepProtection(f.session,0,()=>{});clearProtection(f.session);expect(f.folder.GetChildren().size()).toBe(0);} finally {f.folder.Destroy();}
 });
});
