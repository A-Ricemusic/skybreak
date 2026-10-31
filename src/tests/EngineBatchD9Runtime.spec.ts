import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { clearAirships, spatialJammersAt, stepAirships, protectedNavigationStep } from "../server/EngineBatchD9Runtime";
import { stepProtection, clearProtection } from "../server/EngineBatchD7Runtime";
import { announceJammerKill, liveJammers, lockAllowed } from "../server/EngineBatchCRuntime";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { d9Fixture } from "./EngineBatchD9Fixture";
import type { CombatSession } from "../server/CombatSession";
function fixture() {
 const folder=new Instance("Folder");folder.Parent=Workspace;
 const bs=BlueprintRunner.NewState(d9Fixture(),0);
 const s={folder,player:{UserId:1},blueprintState:bs,enemies:[],state:{x:1000,y:900,z:4500}} as unknown as CombatSession;
 return {s,bs,folder};
}
describe("D9 runtime (execution deferred to orchestrator Studio lease)",()=>{
 it("creates one static unarmed air target, no duplicate spawns; local radar/locks recover away from coverage",()=>{
  const {s,folder}=fixture();try {
   stepAirships(s);stepAirships(s);expect(s.enemies.size()).toBe(1);
   const a=s.enemies[0];expect(a.role).toBe("bomber");expect(a.velocity.Magnitude).toBe(0);expect(a.model.GetAttribute("Damageable")).toBe(true);
   expect(liveJammers(s)).toBe(1);expect(lockAllowed(s,701)).toBe(false);expect(lockAllowed(s,700)).toBe(true);
   s.state.x=8000;expect(liveJammers(s)).toBe(0);expect(lockAllowed(s,10000)).toBe(true);
   expect(spatialJammersAt(s,{x:1000,y:900,z:4500})).toBe(1);
   a.health=0;expect(spatialJammersAt(s,{x:1000,y:900,z:4500})).toBe(0);
  } finally {clearAirships(s);folder.Destroy();}
 });
 it("preserves global ground/aircraft ECM and airship kill calls across spatial phase opt-in",()=>{
  const {s,folder}=fixture();try {
   stepAirships(s);const airship=s.enemies[0],phase=BlueprintRunner.ActivePhase(s.blueprintState!)!;
   const ground={...airship,id:"ecm",airshipJammer:undefined,typedGround:{ecm:true}} as typeof airship;
   const aircraft={...airship,id:"legacy",airshipJammer:undefined,routeActor:{jammer:true}} as typeof airship;
   s.enemies.push(ground,aircraft);
   expect(liveJammers(s)).toBe(1);
   s.state.x=8000;expect(liveJammers(s)).toBe(0);
   const lines=new Array<string>();s.state.x=1000;airship.health=0;
   announceJammerKill(s,airship,line=>lines.push(line));announceJammerKill(s,airship,line=>lines.push(line));
   expect(lines.size()).toBe(1);expect(lines[0]).toBe(phase.jamming!.clearCall);
   phase.spatialJamming=undefined;expect(liveJammers(s)).toBe(2);
   ground.health=0;announceJammerKill(s,ground,line=>lines.push(line));expect(lines[1]).toBe(phase.jamming!.remainingCall);
   aircraft.health=0;announceJammerKill(s,aircraft,line=>lines.push(line));expect(lines[2]).toBe(phase.jamming!.clearCall);
   expect(liveJammers(s)).toBe(0);
  } finally {clearAirships(s);folder.Destroy();}
 });
 it("holds the covered protected aircraft independently, releases on source death or hold budget",()=>{
  const {s,folder}=fixture();try {
   const p=BlueprintRunner.ActivePhase(s.blueprintState!)!;
   // Cover the low protected aircraft at ingress, leaving the high route clear.
   p.spatialJamming!.corridors[0].a={x:-1000,y:900,z:6000};p.spatialJamming!.corridors[0].b={x:-1000,y:900,z:3000};
   stepAirships(s);stepProtection(s,10,()=>{});
   expect(s.protectedFlight!.actors[0].state.elapsed).toBe(10);expect(s.protectedFlight!.actors[1].state.elapsed).toBe(0);
   stepProtection(s,15,()=>{});expect(s.protectedFlight!.actors[1].state.elapsed).toBe(5);
   s.enemies[0].health=0;expect(protectedNavigationStep(s,{x:-1000,y:900,z:4500},10,0).advance).toBe(10);
  } finally {clearProtection(s);clearAirships(s);folder.Destroy();}
 });
 it("retires phase-owned targets without credit and cleanup is idempotent",()=>{
  const {s,bs,folder}=fixture();try {stepAirships(s);const model=s.enemies[0].model;bs.phaseIndex++;stepAirships(s);clearAirships(s);expect(model.Parent).toBeUndefined();expect(s.enemies.size()).toBe(0);expect(bs.killedIds.size()).toBe(0);}finally{folder.Destroy();}
 });
});
