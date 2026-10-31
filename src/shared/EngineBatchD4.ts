import { finiteNumber } from "./EngineBatchB";
import { compileBomberEncounter } from "./BomberEncounter";
import type { FlightPoint, MissionPhaseBlueprint } from "./MissionCatalog";

/** No invented health budget: any surviving bomber reaching its endpoint loses the site. */
export interface InterceptHold {
	/** Optional existing world model id; renderer adopts it without moving or cloning it. */
	siteId?: string;
	site: FlightPoint;
	siteName: string;
	/** Original broadcast ignition subtitle and visual; no new audio. */
	ignitionSecondsRemaining: number;
	ignitionCall: string;
}
export function validateBatchD4(phases: MissionPhaseBlueprint[], limit: number): void {
	for (const p of phases) {
		if (p.concurrentFighters !== undefined) {
			assert(finiteNumber(p.concurrentFighters) && p.concurrentFighters%1===0 && p.concurrentFighters>=1 && p.concurrentFighters<=12,"D4 fighter budget must be 1–12");
			assert(p.execution?.directSpawn!==true,"D4 population must use queued admissions");
			assert((p.fighterWaves ?? []).reduce((n,w)=>n+w.count,0)<=150,"D4 finite wave inventory exceeds 150");
		}
		const h=p.interceptHold, b=p.bombers;
		if (b?.arrivalSeconds) {
			assert(h!==undefined && b.escorts.count===0,"Stream arrivals need an unescorted intercept hold");
			assert(b.arrivalSeconds.size()===b.count,"Stream arrivals must match bomber count");
			let last=0;
			for(const at of b.arrivalSeconds) { assert(finiteNumber(at) && at>=last && at< (p.update?.countdownSeconds ?? 0),"Invalid stream arrival time"); last=at; }
		}
		if (!h) continue;
		assert(h.siteId===undefined || h.siteId.size()>0,"Empty protected world id");
		const seconds=p.update?.countdownSeconds;
		assert(p.kind==="required_air" && b!==undefined && b.count===p.count && b.targetIds!==undefined,"Intercept hold needs identified required bombers");
		assert(seconds!==undefined && finiteNumber(seconds) && seconds>0,"Intercept hold needs a fresh phase clock");
		assert(p.twist===undefined && p.points===undefined && p.seconds===undefined && p.returnLine===undefined && p.landing===undefined && p.parkedEscort===undefined,"Intercept owns progress and navigation");
		for(const n of [h.site.x,h.site.y,h.site.z]) assert(finiteNumber(n),"Invalid protected site");
		assert(math.abs(h.site.x)<=limit && math.abs(h.site.z)<=limit && h.site.y>=0 && h.site.y<=2000,"Protected site outside airspace");
		assert(h.siteName.size()>0 && h.siteName.size()<=40 && h.ignitionCall.size()>0 && h.ignitionCall.size()<=72,"Invalid broadcast text");
		assert(finiteNumber(h.ignitionSecondsRemaining) && h.ignitionSecondsRemaining>0 && h.ignitionSecondsRemaining<seconds,"Invalid ignition time");
		const route=compileBomberEncounter(b);
		assert(route.duration+(b.arrivalSeconds?.[b.count-1] ?? 0)<=seconds,"All bombers must reach escape by hold expiry");
	}
}
