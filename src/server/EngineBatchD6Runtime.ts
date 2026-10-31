import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { artilleryExposed } from "../shared/EngineBatchD3";
import { ContactBudget, detailContacts, newSchedule, stepSchedule } from "../shared/EngineBatchD6";
import { TypedGroundTarget, GROUND_TARGET_LABELS } from "../shared/CampaignEncounters";
import { auditCanyon } from "./EngineBatchD3Runtime";
import { createGroundTarget } from "./GroundTargetFactory";
import type { CombatSession } from "./CombatSession";
/** Static scenery only: movers, weapons and aircraft retain their original geometry/aim semantics. */
export function cheapEligible(spec: TypedGroundTarget): boolean {
	return ["container","containers","watchtower","antenna","barracks","sub_pen","storage"].includes(spec.type) && !spec.route && !spec.parentId && !spec.sam;
}
export function createCheapContact(spec: TypedGroundTarget): Model {
	const model=new Instance("Model"), part=new Instance("Part");
	model.Name=GROUND_TARGET_LABELS[spec.type]; model.SetAttribute("TargetId",spec.id); model.SetAttribute("D6Detailed",false);
	part.Name="Aim"; part.Size=new Vector3(12,8,12); part.Anchored=true; part.CanCollide=false; part.CanTouch=false; part.CanQuery=false;
	part.CFrame=new CFrame(spec.position.x,spec.position.y+4,spec.position.z); part.Color=Color3.fromRGB(105,120,112); part.Parent=model; model.PrimaryPart=part;
	return model;
}
/** Keeps the aim Part and Model identities stable for missiles, HUD and health attributes. */
export function setContactDetail(model: Model, spec: TypedGroundTarget, detailed: boolean): void {
	const aim=model.PrimaryPart!;
	for(const child of model.GetChildren()) if(child!==aim) child.Destroy();
	if(detailed) {
		const full=createGroundTarget(spec);
		for(const child of full.GetChildren()) if(child!==full.PrimaryPart) {
			if(child.IsA("BasePart")) { child.SetAttribute("OriginalTransparency",child.Transparency); child.SetAttribute("FlightSolid",child.Transparency<1); child.CanQuery=child.Transparency<1; }
			child.Parent=model;
		}
		full.Destroy();
	}
	aim.Transparency=detailed ? 1 : 0; aim.CanQuery=!detailed;
	aim.SetAttribute("OriginalTransparency",aim.Transparency); aim.SetAttribute("FlightSolid",!detailed);
	model.SetAttribute("D6Detailed",detailed);
}
export function stepContacts(session: CombatSession, dt: number): void {
	const phase=session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState);
	if(!phase?.cheapContacts && session.contactClock===undefined) return;
	session.contactClock=(session.contactClock ?? 0)+dt;
	if(session.contactClock<ContactBudget.interval) return;
	session.contactClock=0;
	const contacts=session.enemies.filter(e=>e.health>0 && e.model.GetAttribute("D6Detailed")!==undefined);
	const chosen=detailContacts(contacts.filter(e=>phase?.cheapContacts===true && e.enabled).map(e=>({id:e.id,distanceSquared:(e.position.X-session.state.x)**2+(e.position.Z-session.state.z)**2})));
	let detailed=0, changes=0;
	for(const e of contacts) if(e.model.GetAttribute("D6Detailed")===true) detailed++;
	// Retire detail first; at most two geometry mutations per service tick, including demotions.
	for(const e of contacts) if(changes<ContactBudget.changesPerStep && e.model.GetAttribute("D6Detailed")===true && !chosen.has(e.id)) { setContactDetail(e.model,e.typedGround!,false); if(!e.enabled) e.model.PrimaryPart!.CanQuery=false; detailed--; changes++; }
	for(const e of contacts) if(changes<ContactBudget.changesPerStep && detailed<ContactBudget.detailed && chosen.has(e.id) && e.model.GetAttribute("D6Detailed")!==true) { setContactDetail(e.model,e.typedGround!,true); detailed++; changes++; }
}
/** Retires a live parked representation without credit; returns the sole airborne kill id. */
export function handoffParked(session: CombatSession, id: string): string | undefined {
	const parked=session.enemies.find(e=>e.id===id && e.kind==="ground");
	if(!parked || parked.health<=0 || !parked.enabled || session.retiredGroundIds?.has(id)) return undefined;
	parked.health=0; parked.enabled=false; parked.model.Destroy();
	if(!session.retiredGroundIds) session.retiredGroundIds=new Set();
	session.retiredGroundIds.add(id);
	if(session.target===parked) { session.target=undefined; session.lockProgress=0; }
	return id;
}
export function stepRepeatedArtillery(session: CombatSession, dt: number, say: (line:string)=>void): void {
	const bs=session.blueprintState, plan=bs && BlueprintRunner.ActivePhase(bs)?.repeatedArtillery;
	if(!bs || !plan) {session.repeatedArtillery=undefined; return;}
	if(session.repeatedArtillery?.phase!==bs.phaseIndex) {
		if(!session.collisionParams || !auditCanyon(plan,session.collisionParams)) {session.crashReason="internal_error"; return;}
		session.repeatedArtillery={phase:bs.phaseIndex,state:newSchedule()};
	}
	const event=stepSchedule(session.repeatedArtillery!.state,plan,dt);
	if(event.warning) say("ARTILLERY · DESCEND AND USE VALLEY COVER");
	if(event.countdown) say(`ARTILLERY IMPACT IN ${plan.countdownSeconds} SECONDS`);
	if(!event.impact) return;
	const player=new Vector3(session.state.x,session.state.y,session.state.z), source=new Vector3(plan.source.x,plan.source.y,plan.source.z);
	const ray=Workspace.Raycast(source,player.sub(source),session.collisionParams);
	if(!artilleryExposed(plan,player.Y,ray!==undefined && ray.Distance<player.sub(source).Magnitude-2)) {say("ARTILLERY · COVER HELD"); return;}
	const lost=math.min(session.health,plan.damage); session.health-=lost; session.damageTaken+=lost; session.lowestHealth=math.min(session.lowestHealth,session.health);
}
