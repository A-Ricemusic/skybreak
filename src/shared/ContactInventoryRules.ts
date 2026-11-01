// Large contact inventories: cheap-contact detail budget, parked-aircraft handoff and repeated artillery schedules (pure). Formerly EngineBatchD6.
import { finiteNumber } from "./LandingRules";
import { CanyonEscape, newArtillery, stepArtillery, ArtilleryState, validateArtilleryPhases } from "./ArtilleryRules";
import type { MissionPhaseBlueprint } from "./MissionCatalog";
/** Authored cadence, not a claim about reference timing. Clock pauses with hostile simulation. */
export interface RepeatedArtillery extends CanyonEscape { startSeconds: number; salvos: number }
export interface ScheduledArtillery { delay: number; completed: number; salvo: ArtilleryState }
export function newSchedule(): ScheduledArtillery { return {delay:0,completed:0,salvo:newArtillery()}; }
export function stepSchedule(state: ScheduledArtillery, plan: RepeatedArtillery, dt: number) {
	const none={warning:false,countdown:false,impact:false};
	if(!finiteNumber(dt) || dt<=0 || state.completed>=plan.salvos) return none;
	if(state.delay<plan.startSeconds) { const before=state.delay; state.delay=math.min(plan.startSeconds,before+dt); dt-=state.delay-before; }
	if(dt<=0) return none;
	const cycle=state.salvo.cycle, event=stepArtillery(state.salvo,plan,dt);
	if(state.salvo.cycle!==cycle) state.completed++;
	return event;
}
export const ContactBudget = { maxContacts:150, detailed:24, changesPerStep:2, interval:0.5, radius:2400 } as const;
/** Stable nearest-first selection, bounded even when every contact is near the player. */
export function detailContacts(contacts: {id:string; distanceSquared:number}[]): Set<string> {
	assert(contacts.size()<=ContactBudget.maxContacts,"Contact scan exceeds budget");
	const nearby=contacts.filter(c=>finiteNumber(c.distanceSquared) && c.distanceSquared<=ContactBudget.radius**2);
	nearby.sort((a,b)=>a.distanceSquared===b.distanceSquared ? a.id<b.id : a.distanceSquared<b.distanceSquared);
	return new Set(nearby.filter((_,i)=>i<ContactBudget.detailed).map(c=>c.id));
}
export function validateContactInventoryPhases(phases: MissionPhaseBlueprint[], limit: number, warnings: boolean): void {
	if(phases.some(p=>p.cheapContacts===true)) assert(phases.reduce((n,p)=>n+(p.groundTargets?.size() ?? 0),0)<=ContactBudget.maxContacts,"Sortie contact inventory exceeds budget");
	for(const phase of phases) {
		const plan=phase.repeatedArtillery;
		if(plan) {
			assert(phase.kind==="score_threshold" && phase.canyonEscape===undefined,"Repeated artillery needs its own score strike phase");
			assert(finiteNumber(plan.startSeconds) && plan.startSeconds>=0 && plan.startSeconds<=1200 && finiteNumber(plan.salvos) && plan.salvos%1===0 && plan.salvos>=1 && plan.salvos<=100,"Invalid artillery schedule");
			// Reuse D3's full point/channel/timing validation without changing D3's escape contract.
			validateArtilleryPhases([{kind:"required_ground",label:"audit"},{kind:"return_line",label:"audit",returnLine:{a:{x:-50,z:0},b:{x:50,z:0},direction:{x:0,z:1},markerY:300},update:{objective:"audit",radio:[],countdownSeconds:300},canyonEscape:plan}] as MissionPhaseBlueprint[],limit,warnings);
		}
		if(phase.cheapContacts) assert((phase.groundTargets?.size() ?? 0)<=ContactBudget.maxContacts,"Too many contacts");
		const linked=new Set<string>();
		for(const wave of phase.fighterWaves ?? []) if(wave.parkedSourceId!==undefined) {
			const parked=phase.groundTargets?.find(t=>t.id===wave.parkedSourceId);
			assert(parked!==undefined && (parked.type==="parked_bomber" || parked.type==="parked_helicopter") && !parked.required && wave.count===1 && parked.scoreRole===wave.scoreRole && !linked.has(parked.id),"Invalid parked aircraft handoff");
			linked.add(parked.id);
		}
	}
}
