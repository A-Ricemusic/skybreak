import { MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { coveringJammers, navigationStep } from "../shared/EngineBatchD9";
import type { AirshipJammer } from "../shared/EngineBatchD9";
import type { FlightPoint } from "../shared/MissionCatalog";
import type { CombatSession, Enemy } from "./CombatSession";

export function spatialJammersAt(s: CombatSession, point: FlightPoint): number | undefined {
 const plan=s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.spatialJamming;
 if(!plan) return undefined;
 const ids=s.enemies.filter(e=>e.enabled && e.health>0 && e.withdrawUntil===undefined && (e.airshipJammer || e.routeActor?.jammer===true)).map(e=>e.id);
 return coveringJammers(plan,point,ids);
}
function createAirship(s: CombatSession, a: AirshipJammer): Enemy {
 const scene=s.folder.FindFirstChild(MissionCatalog.WorldKey(s.blueprint!) ?? "");
 const drawn=scene?.FindFirstChild(a.id);
 const model=drawn?.IsA("Model") ? drawn : new Instance("Model");model.Name="AIRSHIP JAMMER";
 if(drawn!==model) {
  const hull=new Instance("Part");hull.Name="Envelope";hull.Shape=Enum.PartType.Ball;hull.Size=new Vector3(24,24,60);hull.Color=Color3.fromRGB(119,131,137);hull.Anchored=true;hull.Parent=model;model.PrimaryPart=hull;
  const keel=new Instance("Part");keel.Name="Jammer keel";keel.Size=new Vector3(10,7,22);keel.Position=new Vector3(0,-15,0);keel.Color=Color3.fromRGB(45,58,64);keel.Anchored=true;keel.Parent=model;
 } else {
  model.PrimaryPart=model.GetChildren().find(c=>c.IsA("BasePart")) as BasePart;
 }
 for(const c of model.GetDescendants()) if(c.IsA("BasePart")) { c.CanCollide=false;c.CanTouch=false;c.SetAttribute("FlightSolid",false); }
 const position=new Vector3(a.position.x,a.position.y,a.position.z),direction=new Vector3(0,0,-1);
 model.PivotTo(new CFrame(position));model.SetAttribute("SkybreakOwner",s.player.UserId);model.SetAttribute("SkybreakEnemy",true);model.SetAttribute("TargetKind","air");model.SetAttribute("TargetId",a.id);model.SetAttribute("RequiredTarget",false);model.SetAttribute("Damageable",true);model.SetAttribute("Health",a.health);model.SetAttribute("MaxHealth",a.health);model.Parent=s.folder;
 return {id:a.id,name:"AIRSHIP JAMMER",model,health:a.health,maxHealth:a.health,position,direction,velocity:Vector3.zero,kind:"air",role:"bomber",airshipJammer:true,phaseOwner:s.blueprintState!.phaseIndex,scoreRole:a.scoreRole,required:false,enabled:true,fireTimer:0,windup:0,mode:"run",modeTimer:0,passDirection:direction,side:1,flares:0,flareTimer:0,speedBonus:0,lockBreakTimer:0,flareUntil:0,breakTimer:0,breakUntil:0,lockBreakChance:0,hiddenParts:[]};
}
export function clearAirships(s: CombatSession): void {
 for(const e of s.enemies) if(e.airshipJammer) { e.enabled=false;e.model.Destroy(); }
 s.enemies=s.enemies.filter(e=>!e.airshipJammer);s.airshipPhase=undefined;
}
/** No independent damage or score path: D1 guns and the accepted kill ledger own both. */
export function stepAirships(s: CombatSession): void {
 const bs=s.blueprintState, plan=bs && BlueprintRunner.ActivePhase(bs)?.spatialJamming;
 if(!bs || !plan || bs.outcome!==undefined) {if(s.airshipPhase!==undefined) clearAirships(s);return;}
 if(s.airshipPhase===bs.phaseIndex) return;
 clearAirships(s);s.airshipPhase=bs.phaseIndex;
 for(const a of plan.airships) s.enemies.push(createAirship(s,a));
}
export function protectedNavigationStep(s: CombatSession, point: FlightPoint, dt: number, held: number): {advance:number;held:number} {
 const plan=s.blueprintState && BlueprintRunner.ActivePhase(s.blueprintState)?.spatialJamming;
 return navigationStep(dt,(spatialJammersAt(s,point) ?? 0)>0,held,plan?.navigationHoldSeconds ?? 0);
}
