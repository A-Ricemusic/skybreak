import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { landingPose, landingRadioDue, terrainClearance } from "../shared/EngineBatchB";
import { CombatSession } from "./CombatSession";

/** At most ten probes per wall-clock second, using the existing flight-solid allowlist. */
export function sampleClearance(session: CombatSession, now: number): number | undefined {
	if (session.blueprint?.terrainRelativeWarnings !== true) return undefined;
	if (session.clearanceProbeAt === undefined || now-session.clearanceProbeAt>=0.1) {
		session.clearanceProbeAt=now;
		const s=session.state;
		const hit=Workspace.Raycast(new Vector3(s.x,s.y,s.z),new Vector3(0,-8192,0),session.collisionParams);
		session.terrainClearance=terrainClearance(s.y,hit?.Position.Y);
	}
	return session.terrainClearance;
}
/** Landing owns the complete fixed step: no flight, damage, input, score time or hostile simulation. */
export function stepLanding(session: CombatSession, dt: number, send: (message: unknown)=>void, say?: (line: string)=>void): boolean {
	const state=session.blueprintState;
	const plan=state && BlueprintRunner.ActivePhase(state)?.landing;
	if (!state || !plan) return false;
	if (!session.landingSent) { session.landingSent=true; session.landingStartedAt=os.clock(); send({kind:"LandingStarted",plan}); }
	const before=state.landingElapsed ?? 0;
	BlueprintRunner.AdvanceLanding(state,dt);
	// The home controller talks the approach down; a skip passes its remaining cues silently.
	if (say) for (const line of landingRadioDue(plan,before,state.landingElapsed ?? before)) say(line);
	session.state=landingPose(plan,state.landingElapsed ?? plan.approachSeconds+plan.rolloutSeconds);
	return true;
}
/** An accepted skip: the runner jumps to the runway hold (or ends); the client follows the authoritative time. */
export function skipLanding(session: CombatSession, send: (message: unknown)=>void): void {
	const state=session.blueprintState;
	if (!state || state.landingElapsed === undefined) return;
	BlueprintRunner.AdvanceLanding(state,0,true);
	if (state.outcome === undefined && state.landingElapsed !== undefined) send({kind:"LandingSkipped",elapsed:state.landingElapsed});
}
