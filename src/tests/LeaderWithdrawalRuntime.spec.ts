import { engineRuntimeFixture } from "./EngineRuntimeFixture";
import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { clearLeader, stepLeader } from "../server/LeaderWithdrawalRuntime";
import type { CombatSession, Enemy } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { PauseRules } from "../shared/SessionGuard";
import { sinkNavalTarget, stepSurfaceTargets } from "../server/SurfaceTargetRuntime";
import { sessionFixture } from "./SessionFixture";
function fixture() {
 const folder=new Instance("Folder"); folder.Parent=Workspace;
 const blueprint={...engineRuntimeFixture(),phases:[{kind:"required_air" as const,label:"Wing",count:4,leaderWithdrawal:{departure:{waypoints:[{x:0,y:500,z:0},{x:-2000,y:500,z:0}],speed:200}}}]};
 const bs=BlueprintRunner.NewState(blueprint,0);
 const s=sessionFixture(bs.blueprint,{folder}); s.blueprintState=bs;
 return {folder,bs,s};
}
describe("D12 server lifecycle",()=>{
 it("creates an untargetable nonquery leader, respects service/pause, departs and cleans exactly once",()=>{
  const f=fixture(),lines:string[]=[];
  try {
   f.s.loading={} as CombatSession["loading"]; stepLeader(f.s,1,()=>{}); expect(f.s.leaderWithdrawal).toBeUndefined();
   f.s.loading=undefined; stepLeader(f.s,1,()=>{});
   const model=f.s.leaderWithdrawal!.model;
   expect(model.GetAttribute("SkybreakEnemy")).toBe(false); expect(model.GetAttribute("Damageable")).toBe(false);
   for(const p of model.GetDescendants()) if(p.IsA("BasePart")) expect(p.CanQuery).toBe(false);
   expect(f.s.enemies.size()).toBe(0);
   f.bs.phaseProgress=4; f.s.rearmElapsed=0; stepLeader(f.s,100,()=>{}); expect(f.s.leaderWithdrawal!.state.elapsed).toBe(0);
   f.s.rearmElapsed=undefined; PauseRules.Pause(f.s.pause,0); stepLeader(f.s,100,()=>{}); expect(f.s.leaderWithdrawal!.state.elapsed).toBe(0);
   f.s.pause=PauseRules.New(); stepLeader(f.s,10,line=>lines.push(line));
   expect(f.bs.outcome).toBe("won"); expect(f.folder.GetAttribute("RuskDeparted")).toBe(true); expect(model.Parent).toBeUndefined();
   expect(f.bs.killedIds.size()).toBe(0); expect(f.s.leaderWithdrawal).toBeUndefined();
   stepLeader(f.s,10,line=>lines.push(line)); expect(lines.size()).toBe(1);
  } finally {clearLeader(f.s);f.folder.Destroy();}
 });
 it("disposes an interrupted leader on phase changes and is idempotent",()=>{
  const f=fixture(); try {
   stepLeader(f.s,1,()=>{}); const model=f.s.leaderWithdrawal!.model;
   f.bs.phaseIndex=1; stepLeader(f.s,1,()=>{}); expect(model.Parent).toBeUndefined();
   clearLeader(f.s); clearLeader(f.s); expect(f.s.leaderWithdrawal).toBeUndefined();
  } finally {f.folder.Destroy();}
 });
 it("freezes a linked moving hull without resetting pose and reuses D2 collateral mount retirement without credit",()=>{
  const f=fixture(); try {
   f.bs.phases[0].bridgeClosures=[{targetId:"bridge",sectorIds:[],hullIds:["hull"]}];
   const model=new Instance("Model"), root=new Instance("Part"); root.Anchored=true; root.Parent=model; model.PrimaryPart=root; model.Parent=f.folder;
   const hull={id:"hull",model,position:Vector3.zero,velocity:Vector3.zero,health:100,enabled:true,typedGround:{id:"hull",type:"destroyer",position:{x:0,y:0,z:0},yaw:0,naval:true,route:{waypoints:[{x:0,y:0,z:0},{x:0,y:0,z:-100}],speed:10}}} as Enemy;
   const mountModel=model.Clone(); mountModel.PivotTo(new CFrame(5,10,0)); mountModel.Parent=f.folder;
   const mount={...hull,id:"mount",model:mountModel,position:mountModel.PrimaryPart!.Position,typedGround:{id:"mount",type:"gun_mount",parentId:"hull"}} as Enemy;
   f.s.enemies=[hull,mount]; stepSurfaceTargets(f.s,1); const position=hull.position, mountPosition=mount.position, mountPivot=mountModel.GetPivot();
   expect(hull.velocity.Magnitude>0).toBe(true); expect(mount.velocity).toEqual(hull.velocity);
   expect(mount.position.sub(hull.position)).toEqual(new Vector3(5,10,0));
   f.bs.killedIds.add("bridge"); stepSurfaceTargets(f.s,10); expect(hull.position).toEqual(position); expect(hull.velocity).toEqual(Vector3.zero);
   expect(mount.velocity).toEqual(Vector3.zero); expect(mount.position).toEqual(mountPosition); expect(mountModel.GetPivot()).toEqual(mountPivot);
   stepSurfaceTargets(f.s,1); expect(mount.velocity).toEqual(Vector3.zero); expect(mount.position.sub(hull.position)).toEqual(new Vector3(5,10,0));
   expect(sinkNavalTarget(f.s,hull)).toBe(true); expect(mount.enabled).toBe(false); expect(mount.health).toBe(0);
   expect(f.s.retiredGroundIds!.has("mount")).toBe(true); expect(f.bs.killedIds.has("mount")).toBe(false);
  } finally {f.folder.Destroy();}
 });
});
