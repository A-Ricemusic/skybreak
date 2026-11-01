import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { stepM18Ascending } from "../server/M18AscendingRuntime";
import { stepFinaleDuel } from "../server/FinaleDuelRuntime";
import { mission } from "../shared/missions/m18";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { M18_ASCENDING } from "../shared/M18FinaleRules";
import { createCombatSession } from "../server/CombatSessionFactory";
import { FlightMath } from "../shared/FlightMath";
import type { CombatSession } from "../server/CombatSession";
function fixture(){
 const folder=new Instance("Folder");folder.Parent=Workspace;
 const bs=BlueprintRunner.NewState(mission,0);for(const t of mission.phases[0].groundTargets!)BlueprintRunner.RecordKill(bs,t.id,"ground",true,1);
 const aircraft=new Instance("Model");aircraft.Parent=folder;
 const session=createCombatSession({UserId:1} as Player,1,folder,aircraft,FlightMath.FromPose(0,1000,0,0,0,320),18,"flares","normal",0);
 session.blueprintState=bs;session.missiles=2;session.regen=1.25;session.health=37;
 return {session,folder,bs};
}
describe("M18 optional ascending runtime (execution pending Studio)",()=>{
 it("spawns exactly four once, never shoots, departs without objective credit or failure",()=>{
  const {session:s,folder,bs}=fixture();try{
   stepM18Ascending(s,0.1);stepM18Ascending(s,0.1);expect(s.enemies.size()).toBe(4);expect(s.airQueue.size()).toBe(0);
   for(let i=0;i<4;i++){const e=s.enemies[i];expect(e.id).toBe(M18_ASCENDING[i].id);expect(e.required).toBe(false);expect(e.cruiseTarget).toBe(true);expect(e.fireTimer).toBe(math.huge);}
   for(let i=0;i<801;i++)stepM18Ascending(s,0.1);
   expect(bs.outcome).toBeUndefined();expect(bs.phaseIndex).toBe(1);expect(bs.optionalAirKills).toBe(0);
   for(const e of s.enemies){expect(e.enabled).toBe(false);expect(e.model.Parent).toBeUndefined();}
  }finally{folder.Destroy();}
 });
 it("duel transition clears every optional launch without resetting damage/rack progress",()=>{
  const {session:s,folder,bs}=fixture();try{
   stepM18Ascending(s,0.1);bs.phaseIndex=2;stepFinaleDuel(s,()=>undefined);
   for(const e of s.enemies){expect(e.enabled).toBe(false);expect(e.model.Parent).toBeUndefined();}
   expect(s.health).toBe(37);expect(s.missiles).toBe(2);expect(s.regen).toBe(1.25);expect(bs.killedIds.size()).toBe(3);
   stepM18Ascending(s,0.1);expect(s.enemies.size()).toBe(4);
  }finally{folder.Destroy();}
 });
});
