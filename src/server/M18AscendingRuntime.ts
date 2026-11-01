import { finiteNumber } from "../shared/LandingRules";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { ascendingPose } from "../shared/M18FinaleRules";
import { CruiseBudget } from "../shared/CruiseMissileRules";
import type { CombatSession, Enemy } from "./CombatSession";
/** Opt-in optional exterior missiles. No D10 director, admission slots, weapons or endpoint failure. */
export function stepM18Ascending(s:CombatSession,dt:number):void {
 const plan=s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.finale?.ascending;
 if(!finiteNumber(dt) || dt<=0 || dt>0.1 || s.missionId!==18 || !plan || !s.active || s.blueprintState?.outcome!==undefined) return;
 if(!s.m18Ascending) {
  const actors:Enemy[]=[];
  for(const t of plan) {
   const model=new Instance("Model"),aim=new Instance("Part");model.Name="ASCENDING";
   aim.Name="Aim";aim.Size=new Vector3(6,24,6);aim.Anchored=true;aim.CanCollide=false;aim.CanTouch=false;aim.Material=Enum.Material.Neon;aim.Color=Color3.fromRGB(255,150,60);aim.Parent=model;model.PrimaryPart=aim;
   const position=new Vector3(t.start.x,t.start.y,t.start.z),direction=new Vector3(0,1,0);
   model.PivotTo(new CFrame(position));model.Parent=s.folder;
   for(const [key,value] of pairs({SkybreakEnemy:true,SkybreakOwner:s.player.UserId,TargetKind:"air",RequiredTarget:false,Damageable:true,Health:CruiseBudget.health,RadarDetected:true}))model.SetAttribute(key,value);
   const e:Enemy={id:t.id,name:"ASCENDING",model,health:CruiseBudget.health,maxHealth:CruiseBudget.health,kind:"air",role:"bomber",cruiseTarget:true,scoreRole:"ascending",phaseOwner:s.blueprintState!.phaseIndex,position,direction,velocity:direction.mul(t.speed),required:false,enabled:true,fireTimer:math.huge,windup:0,mode:"run",modeTimer:0,passDirection:direction,side:1,flares:0,flareTimer:0,flareUntil:0,speedBonus:0,lockBreakTimer:0,breakTimer:0,breakUntil:0,lockBreakChance:0,hiddenParts:[]};
   actors.push(e);s.enemies.push(e);
  }
  s.m18Ascending={elapsed:0,actors};
 }
 const r=s.m18Ascending;r.elapsed+=dt;
 for(let i=0;i<plan.size();i++) {
  const e=r.actors[i],t=plan[i];if(e.health<=0 || !e.enabled)continue;
  const p=ascendingPose(t,r.elapsed);e.position=new Vector3(p.x,p.y,p.z);e.frame=new CFrame(e.position);
  if(p.y>=t.end.y) {e.enabled=false;e.health=0;e.model.Destroy();if(s.target===e){s.target=undefined;s.lockProgress=0;}}
 }
}
