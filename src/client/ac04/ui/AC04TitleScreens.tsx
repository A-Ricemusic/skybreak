import React from "@rbxts/react";
import type { AC04Slot } from "../../../shared/AC04Progress";
import { AC04MissionData } from "../../../shared/AC04MissionData";
import type { AC04InputMode, AC04Rect, AC04TypeScale } from "../../../shared/ac04/ui/AC04MenuLayout";
import { ac04ContinueRecord, ac04RecordSummary } from "../../../shared/ac04/ui/AC04RecordSummary";
import { ac04Pad } from "../../../shared/ac04/ui/AC04UIFormat";
import { type AC04Status, AC04ListScreen } from "./AC04ListScreen";
import { type AC04Command, AC04Field, at } from "./AC04Primitives";
import { AC04_BODY_FONT, AC04_COMMAND_FONT, AC04Color } from "./AC04Theme";

export type AC04RecordsState = "loading" | "ready" | "failed";

interface Common {
	size: Vector2; input: AC04InputMode; focus: number; top: number;
	onFocus: (index: number, top: number) => void;
	status?: AC04Status;
	onConfirmSound: () => void;
}

function Fields({ rect, typography, rows }: { rect: AC04Rect; typography: AC04TypeScale; rows: [string, string, boolean?][] }) {
	return (
		<frame BackgroundTransparency={1} {...at(rect)}>
			<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, math.floor(typography.small * 0.8))} />
			{rows.map(([label, value, numeric], index) => <AC04Field key={label} label={label} value={value} labelSize={typography.small} valueSize={typography.body} width={rect.width} order={index} numeric={numeric === true} wrap={numeric !== true} />)}
		</frame>
	);
}

function Note({ rect, text, typography }: { rect: AC04Rect; text: string; typography: AC04TypeScale }) {
	return <textlabel BackgroundTransparency={1} FontFace={AC04_BODY_FONT} Text={text} TextColor3={AC04Color.White} TextSize={typography.body} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top} {...at(rect)} />;
}

function recordRows(slot: AC04Slot): [string, string, boolean?][] {
	const summary = ac04RecordSummary(slot);
	if (summary.empty) return [["RECORD", `${summary.index}`, true], ["STATUS", "No sorties completed."], ["NEXT SORTIE", `${ac04Pad(summary.nextMission, 2)}  ${summary.nextTitle}`]];
	return [
		["RECORD", `${summary.index}`, true],
		["NEXT SORTIE", summary.initialReleaseComplete ? "Initial campaign preview complete. Missions 06–18 are in preparation." : `${ac04Pad(summary.nextMission, 2)}  ${summary.nextTitle}`],
		["MISSIONS COMPLETED", `${ac04Pad(summary.completed, 2)} / 18`, true],
		["AIRCRAFT", summary.aircraft, true],
		["STORY CHAPTERS VIEWED", `${ac04Pad(summary.chaptersSeen, 2)} / 12`, true],
	];
}

/** Title: original SKYBREAK mark with Continue / Flight Records / Controls (and Retry only when records failed). */
export function AC04TitleScreen(props: Common & {
	slots: AC04Slot[]; recordsState: AC04RecordsState; busy: boolean;
	onContinue: (index: number) => void; onRecords: () => void; onControls: () => void; onRetry: () => void;
}) {
	const ready = props.recordsState === "ready" && !props.busy;
	const target = ac04ContinueRecord(props.slots);
	const summary = ac04RecordSummary(props.slots[target.index - 1]);
	const commands: AC04Command[] = [
		{ id: "continue", label: target.fresh ? "BEGIN CAMPAIGN" : "CONTINUE", enabled: ready,
			help: target.fresh ? "Start the campaign in flight record 1." : summary.initialReleaseComplete ? `Flight record ${target.index}: initial preview complete. Replay Missions 01–05 from the archive.` : `Resume flight record ${target.index}: ${ac04Pad(summary.nextMission, 2)} ${summary.nextTitle}.` },
		{ id: "records", label: "FLIGHT RECORDS", enabled: ready, help: "Choose one of four flight records." },
		{ id: "controls", label: "CONTROLS", enabled: true, help: "Keyboard, gamepad and touch controls." },
	];
	if (props.recordsState === "failed") commands.push({ id: "retry", label: "RETRY RECORDS", enabled: !props.busy, help: "Try to load flight records again." });
	return (
		<AC04ListScreen
			{...props}
			heading="SKYBREAK"
			commands={commands}
			onConfirmSound={props.onConfirmSound}
			onActivate={(index) => {
				const id = commands[index].id;
				if (id === "continue") props.onContinue(target.index);
				else if (id === "records") props.onRecords();
				else if (id === "controls") props.onControls();
				else props.onRetry();
			}}
			renderHeading={(layout) => (
				<frame BackgroundTransparency={1} Position={UDim2.fromOffset(layout.title.x, layout.title.y)} Size={UDim2.fromOffset(layout.title.width, layout.title.height + layout.typography.small + 10)}>
					<frame BackgroundColor3={AC04Color.Ink} BackgroundTransparency={0.2} BorderSizePixel={0} Size={UDim2.fromOffset(math.min(layout.title.width, 360), 1)} />
					<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text="SKYBREAK" TextColor3={AC04Color.White} TextSize={math.floor(layout.typography.title * 1.35)} TextXAlignment={Enum.TextXAlignment.Left} Position={UDim2.fromOffset(0, 6)} Size={new UDim2(1, 0, 0, math.floor(layout.typography.title * 1.35) + 4)} />
					<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text="ISAF  ·  MOBIUS 1" TextColor3={AC04Color.Muted} TextSize={layout.typography.small} TextXAlignment={Enum.TextXAlignment.Left} Position={UDim2.fromOffset(2, math.floor(layout.typography.title * 1.35) + 10)} Size={new UDim2(1, 0, 0, layout.typography.small + 4)} />
				</frame>
			)}
			renderDetail={(rect, typography, focus) => {
				const id = commands[focus]?.id;
				if (props.recordsState === "loading") return <Note rect={rect} typography={typography} text="Retrieving flight records." />;
				if (id === "continue" && props.recordsState === "ready") return <Fields rect={rect} typography={typography} rows={recordRows(props.slots[target.index - 1])} />;
				return undefined;
			}}
		/>
	);
}

/** Four flight records with a detail pane; Back returns to the title with its focus intact. */
export function AC04RecordsScreen(props: Common & { slots: AC04Slot[]; enabled: boolean; busy: boolean; onRefresh: () => void; onSelect: (index: number) => void; onBack: () => void }) {
	const commands: AC04Command[] = props.slots.map((slot) => {
		const summary = ac04RecordSummary(slot);
		return {
			id: `record${slot.index}`, label: `RECORD ${slot.index}`, enabled: props.enabled,
			detail: summary.empty ? "NEW" : `M${ac04Pad(summary.nextMission, 2)}  ${ac04Pad(summary.completed, 2)}/18`,
			help: summary.empty ? "No sorties completed. Select to begin from Mission 01." : `Select to prepare ${ac04Pad(summary.nextMission, 2)} ${AC04MissionData.Get(summary.nextMission).title}.`,
		};
	});
	commands.push({ id: "refresh", label: "REFRESH / RETRY SAVE", enabled: !props.busy, help: "Reload flight records and retry any pending save." });
	return (
		<AC04ListScreen {...props} heading="FLIGHT RECORDS" commands={commands} onActivate={(index) => { if (index < props.slots.size()) props.onSelect(index + 1); else props.onRefresh(); }} onBack={props.onBack}
			renderDetail={(rect, typography, focus) => focus >= 0 && focus < props.slots.size() ? <Fields rect={rect} typography={typography} rows={recordRows(props.slots[focus])} /> : undefined} />
	);
}

const BINDINGS: { id: AC04InputMode; label: string; rows: [string, string][] }[] = [
	{ id: "keyboard", label: "KEYBOARD & MOUSE", rows: [
		["FLY", "W A S D or arrow keys; hold right mouse to steer by cursor"], ["THROTTLE", "Q / E, hold Shift to accelerate"], ["MISSILE", "Space or left click"],
		["GUN", "Hold G"], ["TARGET", "Tab or R"], ["SPECIAL WEAPON", "C"], ["EVADE", "F"], ["PAUSE", "P"],
	] },
	{ id: "gamepad", label: "GAMEPAD", rows: [
		["FLY", "Left stick"], ["THROTTLE", "Right stick, L1 / R1"], ["MISSILE", "R2"], ["GUN", "Hold L2"],
		["TARGET", "Y"], ["SPECIAL WEAPON", "X"], ["EVADE", "B"], ["PAUSE", "Menu button"],
	] },
	{ id: "touch", label: "TOUCH", rows: [
		["FLY", "Left stick"], ["THROTTLE", "Right stick"], ["WEAPONS", "MSL, GUN (hold), SP.W"], ["TARGET", "TGT"],
		["EVADE", "EVADE"], ["REARM", "REARM, south of the return line"], ["PAUSE", "PAUSE"],
	] },
];

/** Control reference; focus starts on the active input family. Rearming: cross the southern return line. */
export function AC04ControlsScreen(props: Common & { onBack: () => void }) {
	const commands: AC04Command[] = BINDINGS.map((group) => ({ id: group.id, label: group.label, enabled: true, help: "Crossing the southern return line replenishes weapons and repairs the aircraft." }));
	return (
		<AC04ListScreen {...props} heading="CONTROLS" commands={commands} onActivate={() => undefined} onBack={props.onBack}
			renderDetail={(rect, typography, focus) => {
				const group = BINDINGS[math.max(0, focus)];
				return (
					<scrollingframe BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={new UDim2()} AutomaticCanvasSize={Enum.AutomaticSize.Y} ScrollBarThickness={4} Selectable={false} {...at(rect)}>
						<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 4)} />
						{group.rows.map(([action, binding], index) => (
							<frame key={action} BackgroundTransparency={1} LayoutOrder={index} Size={new UDim2(1, -8, 0, typography.body + 8)}>
								<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={action} TextColor3={AC04Color.Ink} TextSize={typography.small} TextXAlignment={Enum.TextXAlignment.Left} Size={new UDim2(0.42, 0, 1, 0)} />
								<textlabel BackgroundTransparency={1} FontFace={AC04_BODY_FONT} Text={binding} TextColor3={AC04Color.White} TextSize={typography.body} TextXAlignment={Enum.TextXAlignment.Left} TextWrapped={true} Position={UDim2.fromScale(0.44, 0)} Size={new UDim2(0.56, 0, 1, 0)} />
							</frame>
						))}
					</scrollingframe>
				);
			}} />
	);
}
