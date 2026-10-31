import { chapterBeforeMission, shouldPlayChapter } from "./RelayStory";

/** Menu start and results continuation share story gating; unlock authority stays on the server. */
export function launchWithChapter(missionId: number, seen: number[] | undefined, completed: boolean, fromMenu: boolean,
	launch: (playedChapter?: number) => void, play: (chapter: number, finish: () => void) => void): void {
	if (!shouldPlayChapter(missionId, seen, completed, fromMenu)) { launch(); return; }
	const chapter = chapterBeforeMission(missionId);
	let finished = false;
	// Natural completion and explicit Skip use the same one-shot acknowledgement. Cancel does not.
	play(chapter, () => { if (finished) return; finished = true; launch(chapter); });
}
