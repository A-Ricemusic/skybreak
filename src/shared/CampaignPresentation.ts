import { AuroraLineCutscenes, AuroraLineManifest, Cutscene } from "./AuroraLineManifest";

export type MissionLaunchReason = "briefing" | "next" | "retry";

/**
 * Pure presentation gate shared by briefing launch and sequential progression.
 * Retry deliberately resumes gameplay immediately; it never forces the player
 * through a story scene after a failed sortie.
 */
export function cutsceneForMissionLaunch(
	missionId: number,
	seenCutscenes: readonly string[] | undefined,
	reason: MissionLaunchReason,
): Cutscene | undefined {
	if (reason === "retry" || missionId % 1 !== 0 || missionId < 1 || missionId > AuroraLineManifest.MissionCount) return undefined;
	const scene = missionId === 1 ? AuroraLineCutscenes.Opening : AuroraLineCutscenes.ByActOf(missionId - 1);
	if (!scene) return undefined;
	if (scene.firstTimeOnly && seenCutscenes?.includes(scene.id)) return undefined;
	return scene;
}

