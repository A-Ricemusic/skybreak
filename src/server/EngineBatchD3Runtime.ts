import { sphereSweep } from "../shared/SphereSweep";
import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { canyonSampleSafe, artilleryExposed, newArtillery, stepArtillery, CanyonEscape } from "../shared/EngineBatchD3";
import type { CombatSession } from "./CombatSession";

/** Audit centreline at <=32-stud spacing, including entry, bends and exit. No missing-ground fallback. */
export function auditCanyon(plan: CanyonEscape, params: RaycastParams): boolean {
	for(let i=1;i<plan.channel.size();i++) {
		const a=plan.channel[i-1], b=plan.channel[i];
		const delta=new Vector3(b.x-a.x,b.y-a.y,b.z-a.z);
		if(sphereSweep(new Vector3(a.x,a.y,a.z),math.min(20,plan.clearance/2),delta,params)) return false;
		const steps=math.max(1,math.ceil(new Vector3(b.x-a.x,b.y-a.y,b.z-a.z).Magnitude/32));
		for(let j=0;j<=steps;j++) {
			const t=j/steps, p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
			const hit=Workspace.Raycast(new Vector3(p.x,plan.ceiling+1,p.z),new Vector3(0,-8192,0),params);
			if(!canyonSampleSafe(plan,p,hit?.Position.Y)) return false;
		}
	}
	return true;
}
/** One phase owns its hazard; pause, launch, service and landing never advance it. */
export function stepCanyon(session: CombatSession, dt: number, say: (line: string)=>void): void {
	const bs=session.blueprintState, plan=bs && BlueprintRunner.ActivePhase(bs)?.canyonEscape;
	if(!bs || !plan) { session.artillery=undefined; return; }
	if(session.artillery?.phase!==bs.phaseIndex) {
		if(!session.collisionParams || !auditCanyon(plan,session.collisionParams)) { warn("SKYBREAK canyon route failed terrain clearance audit"); session.crashReason="internal_error"; return; }
		session.artillery={phase:bs.phaseIndex,state:newArtillery()};
	}
	const event=stepArtillery(session.artillery!.state,plan,dt);
	if(event.warning) say("ARTILLERY · DESCEND AND USE CANYON COVER");
	if(event.countdown) say(`ARTILLERY IMPACT IN ${plan.countdownSeconds} SECONDS`);
	if(!event.impact) return;
	const player=new Vector3(session.state.x,session.state.y,session.state.z), source=new Vector3(plan.source.x,plan.source.y,plan.source.z);
	const ray=Workspace.Raycast(source,player.sub(source),session.collisionParams);
	const masked=ray!==undefined && ray.Distance<player.sub(source).Magnitude-2;
	if(!artilleryExposed(plan,player.Y,masked)) return;
	const lost=math.min(session.health,plan.damage);
	session.health-=lost; session.damageTaken+=lost; session.lowestHealth=math.min(session.lowestHealth,session.health);
}
