import { BlueprintRunner } from "../shared/BlueprintRunner";
import { bridgeRouteClosed, leaderPose, newWithdrawal, stepWithdrawal, WithdrawalState } from "../shared/EngineBatchD12";
import { finiteNumber } from "../shared/EngineBatchB";
import { PauseRules } from "../shared/SessionGuard";
import type { CombatSession } from "./CombatSession";
export interface LeaderRuntime { phase: number; model: Model; state: WithdrawalState }
export function clearLeader(s: CombatSession): void { s.leaderWithdrawal?.model.Destroy(); s.leaderWithdrawal=undefined; }
export function closedBridgeRoute(s: CombatSession, id: string, kind: "sector" | "hull"): boolean {
 const bs=s.blueprintState;
 return bs!==undefined && bridgeRouteClosed(BlueprintRunner.ActivePhase(bs)?.bridgeClosures,bs.killedIds,id,kind);
}
/** Noncombat procedural silhouette, outside Enemy/target registries and all weapon hit paths. */
function createLeader(s: CombatSession): Model {
 const model=new Instance("Model"); model.Name="RUSK · COMMAND AIRCRAFT";
 const part=(name:string,size:Vector3,offset:Vector3)=>{ const p=new Instance("Part"); p.Name=name; p.Size=size; p.Position=offset; p.Color=Color3.fromRGB(155,70,65); p.Anchored=true; p.CanCollide=false; p.CanTouch=false; p.CanQuery=false; p.Parent=model; return p; };
 model.PrimaryPart=part("Fuselage",new Vector3(7,6,42),Vector3.zero);
 part("Wings",new Vector3(36,2,14),new Vector3(0,0,4)); part("Tail",new Vector3(2,10,10),new Vector3(0,5,16));
 model.SetAttribute("SkybreakEnemy",false); model.SetAttribute("Damageable",false); model.SetAttribute("RequiredTarget",false);
 const marker=new Instance("BillboardGui"); marker.Size=UDim2.fromOffset(290,30); marker.StudsOffset=new Vector3(0,15,0); marker.AlwaysOnTop=true; marker.MaxDistance=15000; marker.Adornee=model.PrimaryPart; marker.Parent=model;
 const label=new Instance("TextLabel"); label.Size=UDim2.fromScale(1,1); label.BackgroundTransparency=0.3; label.Text="RUSK · DEFEAT HIS FOUR WINGMEN"; label.TextColor3=Color3.fromRGB(255,190,100); label.TextSize=14; label.Parent=marker;
 model.Parent=s.folder; return model;
}
/** Active simulation only; withdrawal has no score, kill, warning, weapon or raycast path. */
export function stepLeader(s: CombatSession, dt: number, say:(line:string)=>void): void {
 const bs=s.blueprintState, plan=bs && BlueprintRunner.ActivePhase(bs)?.leaderWithdrawal;
 if(!bs || !plan || s.leaderWithdrawal && s.leaderWithdrawal.phase!==bs.phaseIndex) clearLeader(s);
 if(!bs || !plan || !s.active || s.cleaned || s.loading || s.launch || s.rearmElapsed!==undefined || s.cutInElapsed!==undefined || PauseRules.Paused(s.pause) || bs.outcome!==undefined || !finiteNumber(dt) || dt<=0) return;
 s.leaderWithdrawal ??= {phase:bs.phaseIndex,model:createLeader(s),state:newWithdrawal()};
 const runtime=s.leaderWithdrawal, wasDeparting=runtime.state.departing;
 const done=stepWithdrawal(runtime.state,plan,bs.phaseProgress,dt);
 if(!wasDeparting && runtime.state.departing) say("RUSK IS RUNNING FOR THE COAST · WING BROKEN");
 const pose=leaderPose(plan,runtime.state), p=pose.position;
 runtime.model.PivotTo(new CFrame(p.x,p.y,p.z).mul(CFrame.Angles(0,math.rad(pose.yaw),0)));
 if(done) {
  s.folder.SetAttribute("RuskDeparted",true);
  BlueprintRunner.ObserveLeaderDeparture(bs);
  clearLeader(s);
 }
}
