import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { mission, M11_HEALTH } from "../shared/missions/m11";
import { stepProtection, clearProtection, protectedTarget, hitProtected, warnProtectedAttack } from "../server/ProtectedAircraftRuntime";
import type { CombatSession, Enemy } from "../server/CombatSession";
import { sessionFixture } from "./SessionFixture";
// Authored Jest integration; deliberately not run without an authorized Studio lease.
describe("M11 protected aircraft runtime",()=>{
 it("adopts world ids once, keeps priority, and warns on HUD/radio before a civilian hit",()=>{
  const folder=new Instance("Folder");folder.Parent=Workspace;
  const existing=new Instance("Model");existing.Name="m11_civilian_low";existing.Parent=folder;
  const hull=new Instance("Part");hull.Position=new Vector3(-1440,900,6240);hull.Parent=existing;
  const session=sessionFixture(mission,{folder});session.blueprintState=BlueprintRunner.NewState(mission,0);
  const lines:string[]=[];
  try {
   stepProtection(session,0,line=>{lines.push(line);});
   const actors=session.protectedFlight!.actors,low=actors[0],high=actors[1];
   expect(low.aircraft.model).toBe(existing);expect(hull.CanCollide).toBe(false);expect(hull.CanQuery).toBe(false);expect(existing.GetAttribute("SkybreakEnemy")).toBe(false);
   const attacker={attackProtected:"m11_civilian_high",position:low.aircraft.position,enabled:true,health:90,windup:2,windupTarget:high.aircraft} as Enemy;
   session.enemies.push(attacker);
   // Assigned high plane wins even when the attacker is closer to the low plane.
   expect(protectedTarget(session,attacker)).toBe(high.aircraft);
   warnProtectedAttack(session,attacker.windupTarget,line=>{lines.push(line);});
   stepProtection(session,0,()=>{});
   expect(high.label.Text.find("INCOMING")[0]).toBeDefined();expect(lines.size()).toBe(1);expect(lines[0].find("ORCHARD ONE")[0]).toBeDefined();expect(high.state.health).toBe(M11_HEALTH.normal);
   hitProtected(session,high.aircraft,7,line=>{lines.push(line);});expect(lines.size()).toBe(2);expect(high.state.health).toBe(M11_HEALTH.normal-7);expect(low.state.health).toBe(M11_HEALTH.normal);
   // Protection owns the civilian models; the session fixture also contains the player aircraft.
   stepProtection(session,314,()=>{});expect(session.blueprintState!.outcome).toBe("won");expect(session.protectedFlight).toBeUndefined();expect(folder.GetChildren()).toEqual([session.aircraft]);
  } finally { clearProtection(session);folder.Destroy(); }
 });
});
