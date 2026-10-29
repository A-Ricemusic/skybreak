import { Workspace } from "@rbxts/services";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { landingPose, terrainClearance } from "../shared/EngineBatchB";
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
export function stepLanding(session: CombatSession, dt: number, send: (message: unknown)=>void): boolean {
	const state=session.blueprintState;
	const plan=state && BlueprintRunner.ActivePhase(state)?.landing;
	if (!state || !plan) return false;
	if (!session.landingSent) { session.landingSent=true; send({kind:"LandingStarted",plan}); }
	BlueprintRunner.AdvanceLanding(state,dt);
	session.state=landingPose(plan,state.landingElapsed ?? plan.approachSeconds+plan.rolloutSeconds);
	return true;
}
