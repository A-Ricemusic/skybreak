// Server adapters for LeaderWithdrawalRules: leader model, withdrawal steps, closed routes.
import { BlueprintRunner } from "../shared/BlueprintRunner";
import {
	WithdrawalIdentities,
	bridgeRouteClosed,
	leaderPose,
	newWithdrawal,
	stepWithdrawal,
	WithdrawalState,
} from "../shared/LeaderWithdrawalRules";
import { finiteNumber } from "../shared/LandingRules";
import { PauseRules } from "../shared/SessionGuard";
import type { CombatSession } from "./CombatSession";
export interface LeaderRuntime {
	phase: number;
	model: Model;
	state: WithdrawalState;
}
export function clearLeader(session: CombatSession): void {
	session.leaderWithdrawal?.model.Destroy();
	session.leaderWithdrawal = undefined;
}
export function closedBridgeRoute(session: CombatSession, id: string, kind: "sector" | "hull"): boolean {
	const blueprintState = session.blueprintState;
	return (
		blueprintState !== undefined &&
		bridgeRouteClosed(
			BlueprintRunner.ActivePhase(blueprintState)?.bridgeClosures,
			blueprintState.killedIds,
			id,
			kind,
		)
	);
}
/** Noncombat procedural silhouette, outside Enemy/target registries and all weapon hit paths. */
function createLeader(session: CombatSession): Model {
	const model = new Instance("Model");
	model.Name = "RUSK · COMMAND AIRCRAFT";
	const part = (name: string, size: Vector3, offset: Vector3) => {
		const piece = new Instance("Part");
		piece.Name = name;
		piece.Size = size;
		piece.Position = offset;
		piece.Color = Color3.fromRGB(155, 70, 65);
		piece.Anchored = true;
		piece.CanCollide = false;
		piece.CanTouch = false;
		piece.CanQuery = false;
		piece.Parent = model;
		return piece;
	};
	model.PrimaryPart = part("Fuselage", new Vector3(7, 6, 42), Vector3.zero);
	part("Wings", new Vector3(36, 2, 14), new Vector3(0, 0, 4));
	part("Tail", new Vector3(2, 10, 10), new Vector3(0, 5, 16));
	model.SetAttribute("TargetId", WithdrawalIdentities.leader);
	model.SetAttribute("SkybreakEnemy", false);
	model.SetAttribute("Damageable", false);
	model.SetAttribute("RequiredTarget", false);
	const marker = new Instance("BillboardGui");
	marker.Size = UDim2.fromOffset(290, 30);
	marker.StudsOffset = new Vector3(0, 15, 0);
	marker.AlwaysOnTop = true;
	marker.MaxDistance = 15000;
	marker.Adornee = model.PrimaryPart;
	marker.Parent = model;
	const label = new Instance("TextLabel");
	label.Size = UDim2.fromScale(1, 1);
	label.BackgroundTransparency = 0.3;
	label.Text = "RUSK · DEFEAT HIS FOUR WINGMEN";
	label.TextColor3 = Color3.fromRGB(255, 190, 100);
	label.TextSize = 14;
	label.Parent = marker;
	model.Parent = session.folder;
	return model;
}
/** Active simulation only; withdrawal has no score, kill, warning, weapon or raycast path. */
export function stepLeader(session: CombatSession, dt: number, say: (line: string) => void): void {
	const blueprintState = session.blueprintState;
	const plan = blueprintState && BlueprintRunner.ActivePhase(blueprintState)?.leaderWithdrawal;
	if (
		!blueprintState ||
		!plan ||
		(session.leaderWithdrawal && session.leaderWithdrawal.phase !== blueprintState.phaseIndex)
	)
		clearLeader(session);
	if (
		!blueprintState ||
		!plan ||
		!session.active ||
		session.cleaned ||
		session.loading ||
		session.launch ||
		session.rearmElapsed !== undefined ||
		session.cutInElapsed !== undefined ||
		PauseRules.Paused(session.pause) ||
		blueprintState.outcome !== undefined ||
		!finiteNumber(dt) ||
		dt <= 0
	)
		return;
	session.leaderWithdrawal ??= {
		phase: blueprintState.phaseIndex,
		model: createLeader(session),
		state: newWithdrawal(),
	};
	const runtime = session.leaderWithdrawal;
	const wasDeparting = runtime.state.departing;
	const done = stepWithdrawal(runtime.state, plan, blueprintState.phaseProgress, dt);
	if (!wasDeparting && runtime.state.departing) say("RUSK IS RUNNING FOR THE COAST · WING BROKEN");
	const pose = leaderPose(plan, runtime.state);
	const position = pose.position;
	runtime.model.PivotTo(new CFrame(position.x, position.y, position.z).mul(CFrame.Angles(0, math.rad(pose.yaw), 0)));
	if (done) {
		session.folder.SetAttribute("RuskDeparted", true);
		BlueprintRunner.ObserveLeaderDeparture(blueprintState);
		clearLeader(session);
	}
}
