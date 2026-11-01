import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { auditCanyon, stepCanyon } from "../server/ArtilleryRuntime";
import { CanyonEscape } from "../shared/ArtilleryRules";
import { CombatSession } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { FlightMath } from "../shared/FlightMath";
import { createGroundTarget } from "../server/GroundTargetFactory";
function fixture() {
 const folder=new Instance("Folder"); folder.Parent=Workspace;
 const floor=new Instance("Part"); floor.Anchored=true; floor.Size=new Vector3(600,20,600); floor.Position=new Vector3(0,9990,0); floor.Parent=folder;
 const params=new RaycastParams(); params.FilterType=Enum.RaycastFilterType.Include; params.FilterDescendantsInstances=[folder];
 const plan: CanyonEscape={ceiling:10585,source:{x:400,y:10300,z:0},warningSeconds:3,countdownSeconds:4,intervalSeconds:12,damage:30,clearance:60,channel:[{x:0,y:10300,z:-100},{x:0,y:10300,z:100}]};
 const bs=BlueprintRunner.NewState({...MissionCatalog.Get(1),phases:[{kind:"return_line",label:"Escape",canyonEscape:plan}]},0);
 const session={blueprintState:bs,collisionParams:params,state:FlightMath.FromPose(0,10300,0,0,0,160),health:100,damageTaken:0,lowestHealth:100} as unknown as CombatSession;
 return {folder,floor,params,plan,session};
}
describe("D3 Roblox terrain and hazard integration",()=>{
 it("audits built floor samples and rejects an obstructed channel or missing floor",()=>{
  const f=fixture(); try {
   expect(auditCanyon(f.plan,f.params)).toBe(true);
   const wall=new Instance("Part"); wall.Anchored=true; wall.Size=new Vector3(40,400,10); wall.Position=new Vector3(0,10200,0); wall.Parent=f.folder;
   expect(auditCanyon(f.plan,f.params)).toBe(false); wall.Destroy(); f.floor.Destroy(); expect(auditCanyon(f.plan,f.params)).toBe(false);
  } finally { f.folder.Destroy(); }
 });
 it("audits a long leg and detects a sphere obstruction beyond the first segment",()=>{
  const f=fixture(); try {
   // A 2,000-stud leg exceeds Roblox's 1,024-stud Spherecast limit.
   f.floor.Size=new Vector3(600,20,2048); f.floor.Position=new Vector3(0,9990,900);
   f.plan.channel=[{x:0,y:10300,z:-100},{x:0,y:10300,z:1900}];
   expect(auditCanyon(f.plan,f.params)).toBe(true);
   // Offset from the centreline: floor rays miss this wall, but the sweep's
   // 20-stud radius must catch it 1,500 studs down the leg (segment two).
   const wall=new Instance("Part"); wall.Anchored=true; wall.Size=new Vector3(12,100,10); wall.Position=new Vector3(24,10300,1400); wall.Parent=f.folder;
   expect(auditCanyon(f.plan,f.params)).toBe(false);
   wall.Destroy(); expect(auditCanyon(f.plan,f.params)).toBe(true);
  } finally { f.folder.Destroy(); }
 });
 it("punishes exposed low flight once per impact and preserves damage accounting",()=>{
  const f=fixture(); try {
   const lines: string[]=[]; const say=(line:string)=>{lines.push(line);};
   stepCanyon(f.session,1,say); stepCanyon(f.session,2,say); stepCanyon(f.session,4,say);
   expect(lines.size()).toBe(2); expect(f.session.health).toBe(70); expect(f.session.damageTaken).toBe(30); expect(f.session.lowestHealth).toBe(70);
   stepCanyon(f.session,1,say); expect(f.session.health).toBe(70); expect(lines.size()).toBe(2);
  } finally { f.folder.Destroy(); }
 });
 it("terrain masks a low aircraft but a climb above the absolute ceiling is punished",()=>{
  const f=fixture(); try {
   const ridge=new Instance("Part"); ridge.Anchored=true; ridge.Size=new Vector3(20,800,300); ridge.Position=new Vector3(200,10300,0); ridge.Parent=f.folder;
   stepCanyon(f.session,7,()=>{}); expect(f.session.health).toBe(100);
   stepCanyon(f.session,5,()=>{}); f.session.state.y=10600;
   stepCanyon(f.session,7,()=>{}); expect(f.session.health).toBe(70);
  } finally { f.folder.Destroy(); }
 });
 it("constructs distinct procedural M7 targets with one shared target identity",()=>{
  for(const targetType of ["solar_panel","solar_tower","flak_gun","pillbox"] as const) {
   const model=createGroundTarget({id:"single",type:targetType,position:{x:0,y:0,z:0},yaw:0,required:false,scoreRole:"ground"});
   try { expect(model.GetAttribute("TargetId")).toBe("single"); expect(model.GetChildren().size()).toBeGreaterThan(2); } finally { model.Destroy(); }
  }
 });
});
