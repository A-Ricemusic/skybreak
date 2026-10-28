import React from "@rbxts/react";
import { AC04MissionData } from "../../../shared/AC04MissionData";
import { ac04InitialReleaseComplete, type AC04Slot } from "../../../shared/AC04Progress";
import type { AC04StoryChapter } from "../../../shared/ac04/AC04Story";
import { ac04ObjectiveText } from "../../../shared/ac04/ui/AC04BriefingPresentation";
import type { AC04InputMode, AC04Rect, AC04TypeScale } from "../../../shared/ac04/ui/AC04MenuLayout";
import { ac04CompletedCount, ac04MissionRows, ac04StoryArchive } from "../../../shared/ac04/ui/AC04RecordSummary";
import { ac04Clock, ac04Pad, ac04Thousands } from "../../../shared/ac04/ui/AC04UIFormat";
import { type AC04Status, AC04ListScreen } from "./AC04ListScreen";
import { type AC04Command, AC04Field, at } from "./AC04Primitives";

interface Common {
	size: Vector2; input: AC04InputMode; focus: number; top: number;
	onFocus: (index: number, top: number) => void;
	status?: AC04Status;
	onConfirmSound: () => void;
}

function Fields({ rect, typography, rows }: { rect: AC04Rect; typography: AC04TypeScale; rows: [string, string, boolean?][] }) {
	return (
		<scrollingframe BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={new UDim2()} AutomaticCanvasSize={Enum.AutomaticSize.Y} ScrollBarThickness={4} Selectable={false} {...at(rect)}>
			<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, math.floor(typography.small * 0.8))} />
			{rows.map(([label, value, numeric], index) => <AC04Field key={label} label={label} value={value} labelSize={typography.small} valueSize={typography.body} width={rect.width - 8} order={index} numeric={numeric === true} wrap={numeric !== true} />)}
		</scrollingframe>
	);
}

function missionFields(slot: AC04Slot, missionId: number, aircraft?: string): [string, string, boolean?][] {
	const mission = AC04MissionData.Get(missionId), objective = ac04ObjectiveText(mission), record = slot.missions[missionId];
	const rows: [string, string, boolean?][] = [
		["OPERATION", string.upper(mission.operation)],
		["OBJECTIVE", objective.headline],
		["TIME LIMIT", objective.timeLimit, true],
	];
	if (aircraft !== undefined) rows.push(["AIRCRAFT", aircraft, true]);
	if (record?.completed === true) {
		rows.push(["RECORD POINTS", ac04Thousands(record.bestScore), true]);
		rows.push(["RECORD TIME", ac04Clock(record.bestTime), true]);
	}
	return rows;
}

/** Pre-mission hub: explicit commands only. Start Mission leads to aircraft and objective confirmation; nothing launches here. */
export function AC04HubScreen(props: Common & {
	slot: AC04Slot; missionId: number; aircraft: string; busy: boolean;
	onStart: () => void; onBriefing: () => void; onAircraft: () => void; onMissions: () => void; onStory: () => void; onRecords: () => void; onBack: () => void;
}) {
	const mission = AC04MissionData.Get(props.missionId);
	const chapters = ac04StoryArchive(props.slot).size();
	const previewComplete = ac04InitialReleaseComplete(props.slot);
	const commands: AC04Command[] = [
		{ id: "start", label: previewComplete ? "REPLAY MISSION" : "START MISSION", enabled: !props.busy, help: previewComplete ? "Replay Missions 01–05; later missions are in preparation." : "Choose an aircraft, then confirm the objective to launch." },
		{ id: "briefing", label: "BRIEFING", enabled: !props.busy, help: "Review the operational map and objective." },
		{ id: "aircraft", label: "AIRCRAFT", enabled: !props.busy, detail: props.aircraft, help: "Review and change the aircraft for this record." },
		{ id: "missions", label: "MISSION ARCHIVE", enabled: !props.busy, detail: `${ac04Pad(ac04CompletedCount(props.slot), 2)}/18`, help: "Choose any unlocked mission to brief." },
		{ id: "story", label: "STORY ARCHIVE", enabled: !props.busy, detail: `${ac04Pad(chapters, 2)}/12`, help: "Replay chapters this record has unlocked." },
		{ id: "records", label: "FLIGHT RECORDS", enabled: !props.busy, detail: `RECORD ${props.slot.index}`, help: "Change flight record." },
	];
	const actions = [props.onStart, props.onBriefing, props.onAircraft, props.onMissions, props.onStory, props.onRecords];
	return (
		<AC04ListScreen {...props} heading={`${ac04Pad(props.missionId, 2)}  ${string.upper(mission.title)}`} sub={`RECORD ${props.slot.index}`} commands={commands}
			onActivate={(index) => actions[index]()} onBack={props.onBack}
			renderDetail={(rect, typography) => <Fields rect={rect} typography={typography} rows={missionFields(props.slot, props.missionId, props.aircraft)} />} />
	);
}

/** All 18 missions in order. Locked rows show why and cannot be chosen; choosing briefs, it never launches. */
export function AC04MissionArchiveScreen(props: Common & { slot: AC04Slot; busy: boolean; onSelect: (missionId: number) => void; onBack: () => void }) {
	const rows = ac04MissionRows(props.slot);
	const commands: AC04Command[] = rows.map((row) => ({
		id: `m${row.id}`, label: `${ac04Pad(row.id, 2)}  ${string.upper(row.title)}`, enabled: !props.busy && !row.locked,
		detail: row.preparing ? "IN PREPARATION" : row.locked ? "LOCKED" : row.completed ? ac04Thousands(row.bestScore ?? 0) : "OPEN",
		help: row.preparing ? "This mission is retained in the campaign archive for a future release." : row.locked ? `Complete Mission ${ac04Pad(row.id - 1, 2)} to unlock.` : "Select to open the briefing.",
	}));
	return (
		<AC04ListScreen {...props} heading="MISSION ARCHIVE" sub={`RECORD ${props.slot.index}`} commands={commands}
			onActivate={(index) => props.onSelect(rows[index].id)} onBack={props.onBack}
			renderDetail={(rect, typography, focus) => {
				const row = rows[math.max(0, focus)];
				if (row === undefined) return undefined;
				if (row.preparing) return <Fields rect={rect} typography={typography} rows={[["MISSION", `${ac04Pad(row.id, 2)}  ${row.title}`], ["STATUS", "In preparation for a future release."]]} />;
				if (row.locked) return <Fields rect={rect} typography={typography} rows={[["MISSION", `${ac04Pad(row.id, 2)}  ${row.title}`], ["STATUS", `Locked. Complete Mission ${ac04Pad(row.id - 1, 2)} first.`]]} />;
				return <Fields rect={rect} typography={typography} rows={[["MISSION", `${ac04Pad(row.id, 2)}  ${row.title}`], ["STATUS", row.completed ? "Completed" : "Not yet completed"], ...missionFields(props.slot, row.id)]} />;
			}} />
	);
}

function chapterTrigger(chapter: AC04StoryChapter): string {
	if (chapter.trigger.event === "beforeCampaign") return "Before Mission 01";
	if (chapter.trigger.event === "epilogue") return "After Mission 18";
	return `After Mission ${ac04Pad(chapter.trigger.missionId ?? 0, 2)}`;
}

/** Unlocked chapters only. Replay returns here with the same row focused. */
export function AC04StoryArchiveScreen(props: Common & { slot: AC04Slot; busy: boolean; onPlay: (chapterId: string) => void; onBack: () => void }) {
	const chapters = ac04StoryArchive(props.slot);
	const commands: AC04Command[] = chapters.map((chapter, index) => ({
		id: chapter.id, label: `${ac04Pad(index + 1, 2)}  ${string.upper(chapter.title)}`, enabled: !props.busy,
		detail: props.slot.seen.includes(chapter.id) ? undefined : "NEW", help: "Select to play this chapter.",
	}));
	return (
		<AC04ListScreen {...props} heading="STORY ARCHIVE" sub={`RECORD ${props.slot.index}`} commands={commands}
			onActivate={(index) => props.onPlay(chapters[index].id)} onBack={props.onBack}
			renderDetail={(rect, typography, focus) => {
				const chapter = chapters[math.max(0, focus)];
				return chapter === undefined ? undefined : <Fields rect={rect} typography={typography} rows={[["CHAPTER", chapter.title], ["PLACEMENT", chapterTrigger(chapter)], ["SCENES", `${chapter.beats.size()}`, true]]} />;
			}} />
	);
}
