import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { artilleryMasked, newArtillery, stepArtillery } from "../shared/EngineBatchD3";
import { inRingSweep } from "../shared/EngineBatchD8";
import type { CombatSession } from "./CombatSession";
/** Called in the active combat step only, after pause/cut-in/rearm gates. No world-owned instances. */
export function stepRingSweep(s: CombatSession, dt: number, say: (line: string)=>void): void {
 const bs=s.blueprintState, p=bs && BlueprintRunner.ActivePhase(bs)?.ringSweep;
 if(!bs || !p) { s.ringArtillery=undefined; return; }
 if(s.ringArtillery?.phase!==bs.phaseIndex) s.ringArtillery={phase:bs.phaseIndex,state:newArtillery()};
 const state=s.ringArtillery!.state;
 // Reuse D3 timing and segmented masking (<=1,000 studs, never a >15,000-stud ray).
 const clock={...p,ceiling:2000,source:p.guns[0].source,channel:[],clearance:1};
 const event=stepArtillery(state,clock,dt);
 if(event.warning) say("RING BATTERY · CLEAR THE FIRING LINE");
 if(event.countdown) say(`RING SWEEP IN ${p.countdownSeconds} SECONDS`);
 if(!event.impact) return;
 for(const g of p.guns) {
  const live=s.enemies.some(e=>e.id===g.targetId && e.enabled && e.health>0 && e.phaseOwner===bs.phaseIndex);
  if(!live || !inRingSweep(p,g,s.state)) continue;
  const masked=s.collisionParams!==undefined && artilleryMasked({...clock,source:g.source},s.state,(o,d)=>Workspace.Raycast(new Vector3(o.x,o.y,o.z),new Vector3(d.x,d.y,d.z),s.collisionParams)?.Distance);
  if(masked) continue;
  const lost=math.min(s.health,p.damage); s.health-=lost; s.damageTaken+=lost; s.lowestHealth=math.min(s.lowestHealth,s.health);
  break; // Overlapping gun lines never multiply one salvo's damage.
 }
}

/** Accepted elite defeat only. Surviving fighters depart without kill/score credit. */
export function completeEliteRetreat(s: CombatSession, withdraw: ()=>void, say: (line: string)=>void): void {
 if(s.folder.GetAttribute("EliteRecoveryAnnounced")===true) return;
 s.folder.SetAttribute("EliteRecoveryAnnounced",true);
 s.folder.SetAttribute("VultureTwoRecovered",true);
 s.airQueue.clear();
 withdraw();
 for(let i=s.projectiles.size()-1;i>=0;i--) if(s.projectiles[i].hostile) { s.projectiles[i].part.Destroy(); s.projectiles.remove(i); }
 say("VULTURE TWO EJECTED · RECOVERY DISPATCHED. ELITE FLIGHT WITHDRAWING.");
}
