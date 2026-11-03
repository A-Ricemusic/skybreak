import { finiteOr } from "../../shared/Finite";
import { normalizeMissionRecords } from "../../shared/CampaignWire";
import { Workspace } from "@rbxts/services";
import type { CampaignResponse, Persistence, SaveSlot, SlotDeletion, Telemetry } from "../../shared/Types";
import { MISSION_COUNT, ACT_NAMES, ACT_NUMERALS, MissionCatalog } from "../../shared/MissionCatalog";
import { WeaponRules } from "../../shared/WeaponRules";
import { SpecialWeapons } from "../../shared/SpecialWeapons";
import { Difficulty } from "../../shared/Difficulty";
import type { KillSnapshot } from "../../shared/ImpactFeedback";
import type { MenuLayout, Rectangle } from "../../shared/UILayout";
import { CountdownDisplay } from "../../shared/CountdownDisplay";

/** Seconds a radio line stays up when the server does not specify. */
const RADIO_SECONDS = 4.5;

function safeString(value: unknown, fallback: string): string {
	return typeIs(value, "string") && value.size() <= 80 ? value : fallback;
}

function safeRadio(value: unknown, fallback: string | undefined): string | undefined {
	return typeIs(value, "string") && value.size() > 0 && value.size() <= 140 ? value : fallback;
}

/** Rectangle in a scaled HUD frame -> root pixels. */
function scaleRectangle(rectangle: Rectangle, scale: number): Rectangle {
	return {
		x: rectangle.x * scale,
		y: rectangle.y * scale,
		width: rectangle.width * scale,
		height: rectangle.height * scale,
	};
}

function formatTime(value: number): string {
	const seconds = math.max(0, math.floor(finiteOr(value, 0)));
	return string.format("%02d:%02d", math.floor(seconds / 60), seconds % 60);
}

function normalizeSlots(response: CampaignResponse): SaveSlot[] | undefined {
	if (!response.slots || response.slots.size() !== 4) return undefined;
	const parsed = new Array<SaveSlot>();
	for (let offset = 0; offset < 4; offset++) {
		const source = response.slots[offset];
		if (!typeIs(source, "table")) return undefined;
		const bestTime = typeIs(source.bestTime, "number") ? finiteOr(source.bestTime, 0) : undefined;
		parsed.push({
			index: offset + 1,
			occupied: source.occupied === true,
			completed: source.completed === true,
			kills: math.clamp(math.floor(finiteOr(source.kills, 0)), 0, 99),
			bestTime,
			updatedAt: source.updatedAt,
			currentMission: math.clamp(math.floor(finiteOr(source.currentMission, 1)), 1, MISSION_COUNT),
			missions: normalizeMissionRecords(source.missions),
			introSeen: source.introSeen,
			cutscenesSeen: source.cutscenesSeen,
			special: SpecialWeapons.IsKind(source.special) ? source.special : undefined,
			difficulty: Difficulty.IsKind(source.difficulty) ? source.difficulty : undefined,
			mission1Completed: source.mission1Completed === true,
			mission2Completed: source.mission2Completed === true,
			mission1BestTime: typeIs(source.mission1BestTime, "number")
				? math.max(0, finiteOr(source.mission1BestTime, 0))
				: undefined,
			mission2BestTime: typeIs(source.mission2BestTime, "number")
				? math.max(0, finiteOr(source.mission2BestTime, 0))
				: undefined,
		});
	}
	return parsed;
}

function normalizePersistence(value: unknown): Persistence {
	return value === "cloud" || value === "session" ? value : "unavailable";
}

/** Deletion reports cross a remote; entries that are not well-formed tables are skipped, never indexed. */
function findDeletion(list: unknown, slot: number, generation?: number): SlotDeletion | undefined {
	if (!typeIs(list, "table")) return undefined;
	for (const entry of list as unknown[]) {
		if (!typeIs(entry, "table")) continue;
		const report = entry as Partial<SlotDeletion>;
		if (report.slot === slot && (generation === undefined || report.generation === generation))
			return report as SlotDeletion;
	}
	return undefined;
}

function sanitizeTelemetry(payload: Telemetry, previous: Telemetry): Telemetry {
	const missionId = MissionCatalog.IsValidId(payload.missionId) ? payload.missionId : previous.missionId;
	const targetKind =
		payload.targetKind === "ground" || payload.targetKind === "air" ? payload.targetKind : previous.targetKind;
	const tutorialStep =
		payload.tutorialStep === "move" ||
		payload.tutorialStep === "target" ||
		payload.tutorialStep === "missile" ||
		payload.tutorialStep === ""
			? payload.tutorialStep
			: previous.tutorialStep;
	return {
		kind: "Telemetry",
		health: math.clamp(finiteOr(payload.health, previous.health), 0, 100),
		speed: math.max(0, finiteOr(payload.speed, previous.speed)),
		altitude: finiteOr(payload.altitude, previous.altitude),
		kills: math.clamp(math.floor(finiteOr(payload.kills, previous.kills)), 0, 99),
		total: math.clamp(math.floor(finiteOr(payload.total, previous.total)), 1, 99),
		gunRounds: typeIs(payload.gunRounds, "number")
			? math.max(0, math.floor(finiteOr(payload.gunRounds, 0)))
			: undefined,
		missiles: math.max(0, math.floor(finiteOr(payload.missiles, previous.missiles))),
		missileCooldown: math.max(0, finiteOr(payload.missileCooldown, previous.missileCooldown)),
		evadeCooldown: math.max(0, finiteOr(payload.evadeCooldown, previous.evadeCooldown)),
		evadeCharges:
			typeIs(payload.evadeCharges, "number") && finiteOr(payload.evadeCharges, -1) >= 0
				? math.clamp(math.floor(payload.evadeCharges), 0, 9)
				: undefined,
		target: typeIs(payload.target, "Instance") && payload.target.IsA("Model") ? payload.target : undefined,
		targetName: safeString(payload.targetName, previous.targetName),
		lockProgress: math.clamp(finiteOr(payload.lockProgress, previous.lockProgress), 0, 1),
		incoming: payload.incoming === true,
		evadeThreat: payload.evadeThreat === true,
		lockWarning: payload.lockWarning === true,
		elapsed: math.max(0, finiteOr(payload.elapsed, previous.elapsed)),
		targetDistance: math.max(0, finiteOr(payload.targetDistance, previous.targetDistance ?? 0)),
		boundaryWarning:
			payload.boundaryWarning === undefined ? previous.boundaryWarning : payload.boundaryWarning === true,
		missionId,
		navigation: typeIs(payload.navigation, "Vector3") ? payload.navigation : undefined,
		navigationRadius:
			typeIs(payload.navigationRadius, "number") && finiteOr(payload.navigationRadius, -1) >= 0
				? payload.navigationRadius
				: undefined,
		navigationCeiling:
			typeIs(payload.navigationCeiling, "number") && finiteOr(payload.navigationCeiling, -1) >= 0
				? payload.navigationCeiling
				: undefined,
		protectedHealth: payload.protectedHealth,
		terrainClearance: payload.terrainClearance,
		missionUpdateSeconds: payload.missionUpdateSeconds,
		// Score-threshold missions: the server-authoritative points total for the PTS line.
		missionPoints:
			typeIs(payload.missionPoints, "number") && finiteOr(payload.missionPoints, -1) >= 0
				? math.floor(payload.missionPoints)
				: undefined,
		phase: safeString(payload.phase, previous.phase ?? ""),
		objective: safeString(payload.objective, previous.objective ?? "Complete the objective"),
		objectiveProgress: math.max(
			0,
			math.floor(finiteOr(payload.objectiveProgress, previous.objectiveProgress ?? 0)),
		),
		objectiveTotal: math.max(0, math.floor(finiteOr(payload.objectiveTotal, previous.objectiveTotal ?? 0))),
		timeRemaining: CountdownDisplay.Value(missionId, payload.timeRemaining, previous.timeRemaining),
		pauseRemaining: typeIs(payload.pauseRemaining, "number")
			? math.clamp(finiteOr(payload.pauseRemaining, 0), 0, 300)
			: undefined,
		turnObserved: payload.turnObserved,
		pitchObserved: payload.pitchObserved,
		tutorialStep,
		groundKills: math.max(0, math.floor(finiteOr(payload.groundKills, previous.groundKills ?? 0))),
		targetKind,
		targetRequired:
			payload.targetRequired === undefined ? previous.targetRequired : payload.targetRequired === true,
		radio: safeRadio(payload.radio, undefined),
		radioSerial: typeIs(payload.radioSerial, "number")
			? math.max(0, math.floor(finiteOr(payload.radioSerial, previous.radioSerial ?? 0)))
			: previous.radioSerial,
		radioPriority: payload.radioPriority === true,
		radioSeconds: typeIs(payload.radioSeconds, "number")
			? math.clamp(finiteOr(payload.radioSeconds, RADIO_SECONDS), 0.25, 10)
			: undefined,
		fireDenied: WeaponRules.IsFireNotice(payload.fireDenied) ? payload.fireDenied : undefined,
		special: SpecialWeapons.IsKind(payload.special) ? payload.special : previous.special,
		specialCharges: math.max(0, math.floor(finiteOr(payload.specialCharges, previous.specialCharges ?? 0))),
		specialCooldown: math.max(0, finiteOr(payload.specialCooldown, previous.specialCooldown ?? 0)),
		specialActive: math.max(0, finiteOr(payload.specialActive, previous.specialActive ?? 0)),
		targetDamageable: payload.targetDamageable === undefined ? undefined : payload.targetDamageable === true,
		fireDeniedSerial: typeIs(payload.fireDeniedSerial, "number")
			? math.max(0, math.floor(finiteOr(payload.fireDeniedSerial, previous.fireDeniedSerial ?? 0)))
			: previous.fireDeniedSerial,
		targetHealth: typeIs(payload.targetHealth, "number")
			? math.clamp(finiteOr(payload.targetHealth, 1), 0, 1)
			: undefined,
		aceKilled: payload.aceKilled === true,
		optionalKills: math.max(0, math.floor(finiteOr(payload.optionalKills, previous.optionalKills ?? 0))),
		incomingDistance: typeIs(payload.incomingDistance, "number")
			? math.max(0, finiteOr(payload.incomingDistance, 0))
			: undefined,
	};
}

function resumeMission(slot?: SaveSlot): number {
	return slot?.currentMission ?? 1;
}

function killSnapshot(telemetry: Telemetry): KillSnapshot {
	// `kills` is required destructions only; raiders still earn a SPLASH callout.
	return {
		kills: telemetry.kills + (telemetry.optionalKills ?? 0),
		groundKills: telemetry.groundKills ?? 0,
		aceKilled: telemetry.aceKilled === true,
	};
}

/** Screen point (HUD-root pixels) of the target that just died, if it was the selected one and on screen. */
function killedTargetPoint(target: Model | undefined, root: Frame | undefined): Vector2 | undefined {
	const camera = Workspace.CurrentCamera;
	// The server destroys a killed target, so a still-parented selection was someone else.
	if (!target || target.Parent !== undefined || !camera || !root) return undefined;
	const [ok, pivot] = pcall(() => target.GetPivot());
	if (!ok) return undefined;
	const [screen, visible] = camera.WorldToViewportPoint(pivot.Position);
	if (!visible) return undefined;
	const point = new Vector2(screen.X, screen.Y).sub(root.AbsolutePosition);
	return point.X >= 0 && point.Y >= 0 && point.X <= root.AbsoluteSize.X && point.Y <= root.AbsoluteSize.Y
		? point
		: undefined;
}

function missileReady(telemetry: Telemetry): boolean {
	return telemetry.missileCooldown <= 0 && telemetry.missiles > 0;
}

function panelPosition(menu: MenuLayout) {
	return {
		Position: UDim2.fromOffset(menu.panel.x, menu.panel.y),
		Size: UDim2.fromOffset(menu.panel.width, menu.panel.height),
	};
}

function missionNumber(id: number): string {
	return string.format("%02d", id);
}

function actLabel(act: number): string {
	return `ACT ${ACT_NUMERALS[act] ?? tostring(act)} · ${ACT_NAMES[act] ?? ""}`;
}

function completedCount(slot?: SaveSlot, act?: number): number {
	let count = 0;
	for (const blueprint of MissionCatalog.All()) {
		if ((act === undefined || blueprint.act === act) && slot?.missions?.[blueprint.id]?.completed === true) count++;
	}
	return count;
}

export {
	actLabel,
	completedCount,
	findDeletion,
	formatTime,
	killedTargetPoint,
	killSnapshot,
	missileReady,
	missionNumber,
	normalizePersistence,
	normalizeSlots,
	panelPosition,
	RADIO_SECONDS,
	resumeMission,
	safeString,
	sanitizeTelemetry,
	scaleRectangle,
};
