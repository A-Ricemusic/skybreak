import { MissionCatalog } from "../shared/MissionCatalog";
import { MissionRules } from "../shared/MissionRules";
import { WorldLayouts } from "../shared/WorldLayouts";

// Pure domain fixtures, shared by the Roblox Jest suite and the explicitly
// non-engine offline runner. Synthetic observations here are unit-test data,
// never playtest evidence and never a live mission shortcut.
export function verifyDefinition(id: number): void {
	const definition = MissionCatalog.Get(id);
	assert(definition.id === id && definition.phases.size() > 0);
	assert(definition.targetTime > 0 && definition.targetTime < 600);
	assert(definition.name.size() > 0 && definition.briefing.size() > 0);
	assert(MissionCatalog.RequiredAirKills(definition) + MissionCatalog.RequiredGroundKills(definition) > 0);
	for (const phase of definition.phases) {
		assert(phase.objective.size() > 0);
		if (phase.count !== undefined) assert(phase.count >= 1 && phase.count <= 8 && phase.count % 1 === 0);
		if (phase.duration !== undefined) assert(phase.duration > 0 && phase.duration < 120);
		for (const point of phase.route ?? []) assert(math.abs(point[0]) < 2300 && math.abs(point[2]) < 2300 && point[1] >= 200 && point[1] <= 950);
	}
	const layout = WorldLayouts.Get(id);
	assert(layout.sites.size() > 0 && layout.peaks.size() > 0);
	for (const point of layout.sites) assert(math.abs(point[0]) < 2100 && math.abs(point[1]) < 2300);
}

export function verifyProgression(id: number): void {
	const state = MissionRules.NewState(id, 0);
	let now = 0, serial = 0;
	for (let guard = 0; guard < 25 && state.outcome === undefined; guard++) {
		const phase = MissionRules.Phase(state);
		const index = state.phaseIndex;
		if (phase.kind === "tutorial_move") {
			for (let i = 0; i < 7; i++) { now += 0.1; MissionRules.ObserveControls(state,0.6,0.6,0.1,now); }
		} else if (phase.kind === "tutorial_target") MissionRules.CycleTarget(state,++now);
		else if (phase.kind === "survive_pursuit") { now += (phase.duration ?? 45) + 0.01; MissionRules.Tick(state,now); }
		else if (phase.kind === "escort_convoy") {
			const before = state.phaseProgress;
			MissionRules.ObserveEscort(state,false,100,0.1,now+0.1); now += 0.1;
			assert(state.phaseProgress === before, "Escort cannot advance while out of range");
			for (let i=0; i<1200 && state.phaseIndex === index && state.outcome === undefined; i++) { now += 0.1; MissionRules.ObserveEscort(state,true,100,0.1,now); }
		} else if (phase.kind === "recon_route") {
			MissionRules.ObservePosition(state,2600,1000,2600,++now);
			assert(state.phaseProgress === 0,"Off-route flight cannot grant beacon credit");
			for (const point of phase.route!) MissionRules.ObservePosition(state,point[0],point[1],point[2],++now);
		} else {
			const kind = phase.kind === "destroy_ace_required" ? "ace" : phase.kind === "destroy_air_required" || phase.kind === "intercept_bombers" ? "air" : "ground";
			for (let i=0;i<(phase.count ?? 1);i++) {
				const key = `test_${serial++}`;
				assert(!MissionRules.RecordKill(state,`wrong_${serial}`,kind === "ground" ? "air" : "ground",true,++now),"Wrong target type accepted");
				assert(MissionRules.RecordKill(state,key,kind,true,now),"Required kill rejected");
				assert(!MissionRules.RecordKill(state,key,kind,true,now),"Duplicate kill accepted");
			}
		}
		assert(state.phaseIndex > index || state.outcome === "won","Phase failed to advance");
	}
	assert(state.outcome === "won",`Mission ${id} cannot finish`);
	assert(state.groundKills === MissionCatalog.RequiredGroundKills(MissionCatalog.Get(id)));
	assert(state.requiredAirKills + state.aceKills === MissionCatalog.RequiredAirKills(MissionCatalog.Get(id)));
	const elapsed = state.elapsed;
	MissionRules.Tick(state,900,0); assert(state.outcome === "won" && state.elapsed === elapsed);
	const retry = MissionRules.NewState(id,1000);
	assert(retry.phaseIndex === 0 && retry.groundKills === 0 && retry.killedIds.size() === 0);
	MissionRules.Tick(retry,1600); assert(retry.outcome === "failed" && retry.reason === "timeout");
	assert(!MissionRules.RecordKill(retry,"late","air",true,1600));
	const destroyed = MissionRules.NewState(id,0); MissionRules.Tick(destroyed,1,0); assert(destroyed.reason === "destroyed");
}
