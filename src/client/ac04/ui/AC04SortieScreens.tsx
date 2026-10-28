import React from "@rbxts/react";
import type { AC04Record } from "../../../shared/AC04Progress";
import { AC04MissionData } from "../../../shared/AC04MissionData";
import { ac04FailureText } from "../../../shared/AC04Presentation";
import type { MissionFinished, Telemetry } from "../../../shared/Types";
import { AC04MissionNarrative } from "../../../shared/ac04/AC04Story";
import { type AC04InputMode, ac04DebriefLayout, ac04MenuLayout } from "../../../shared/ac04/ui/AC04MenuLayout";
import { ac04MoveFocus, ac04ClampFocus } from "../../../shared/ac04/ui/AC04Routing";
import { type AC04DebriefRow, ac04Debrief } from "../../../shared/ac04/ui/AC04ResultPresentation";
import { ac04Minutes, ac04Pad } from "../../../shared/ac04/ui/AC04UIFormat";
import { useAC04MenuKeys } from "./AC04Input";
import { type AC04Command, AC04CaptionLane, AC04CommandBar, AC04CommandList, AC04GridBackdrop, AC04Heading, AC04Line, AC04NavHints, at } from "./AC04Primitives";
import { AC04_BODY_FONT, AC04_COMMAND_FONT, AC04_NUMBER_FONT, AC04Color } from "./AC04Theme";

/** Ruled two-column table. */
function Table({ rows, width, rowHeight, textSize, title }: { rows: AC04DebriefRow[]; width: number; rowHeight: number; textSize: number; title: string }) {
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(0, width, 0, (rows.size() + 1) * rowHeight + 2)}>
			<uistroke Color={AC04Color.Ink} Transparency={0.3} Thickness={1} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
			<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={title} TextColor3={AC04Color.Muted} TextSize={textSize - 1} TextXAlignment={Enum.TextXAlignment.Left} Position={UDim2.fromOffset(8, 0)} Size={new UDim2(1, -16, 0, rowHeight)} />
			{rows.map((row, index) => (
				<frame key={row.label} BackgroundTransparency={1} Position={UDim2.fromOffset(0, (index + 1) * rowHeight)} Size={new UDim2(1, 0, 0, rowHeight)}>
					<frame BackgroundColor3={AC04Color.Ink} BackgroundTransparency={0.6} BorderSizePixel={0} Size={new UDim2(1, 0, 0, 1)} />
					<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={row.label} TextColor3={AC04Color.Ink} TextSize={textSize - 1} TextXAlignment={Enum.TextXAlignment.Left} Position={UDim2.fromOffset(8, 0)} Size={new UDim2(0.48, -8, 1, 0)} TextTruncate={Enum.TextTruncate.AtEnd} />
					<textlabel BackgroundTransparency={1} FontFace={AC04_NUMBER_FONT} Text={row.value} TextColor3={AC04Color.White} TextSize={textSize} TextXAlignment={Enum.TextXAlignment.Right} Position={UDim2.fromScale(0.48, 0)} Size={new UDim2(0.52, -8, 1, 0)} TextTruncate={Enum.TextTruncate.AtEnd} />
				</frame>
			))}
		</frame>
	);
}

export interface AC04DebriefProps {
	size: Vector2; input: AC04InputMode;
	result: MissionFinished; fallbackMissionId: number; record?: AC04Record;
	busy: boolean; errorText: string; focus: number;
	onFocus: (index: number) => void;
	onContinue: () => void; onRetry: () => void; onRecords: () => void;
	onConfirmSound: () => void;
}

/** Ruled debrief of the authoritative result; Continue (on success), Retry and Records stay pinned to the footer. */
export function AC04DebriefScreen(props: AC04DebriefProps) {
	const layout = ac04DebriefLayout(props.size.X, props.size.Y, props.input);
	const missionId = props.result.missionId ?? props.fallbackMissionId;
	const debrief = ac04Debrief(props.result, props.fallbackMissionId, AC04MissionData.Get(missionId).title, props.record);
	const commands: AC04Command[] = [];
	if (debrief.accomplished) commands.push({ id: "continue", label: "CONTINUE", enabled: !props.busy });
	commands.push({ id: "retry", label: "RETRY", enabled: !props.busy });
	commands.push({ id: "records", label: "FLIGHT RECORDS", enabled: !props.busy });
	const enabled = commands.map((command) => command.enabled);
	const focus = math.max(0, ac04ClampFocus(math.min(props.focus, commands.size() - 1), enabled));
	const run = (index: number) => {
		const id = commands[index]?.id;
		if (id === "continue") props.onContinue(); else if (id === "retry") props.onRetry(); else if (id === "records") props.onRecords();
	};
	useAC04MenuKeys(true, (intent) => {
		if (intent === "left" || intent === "up") props.onFocus(ac04MoveFocus(focus, -1, enabled));
		else if (intent === "right" || intent === "down") props.onFocus(ac04MoveFocus(focus, 1, enabled));
		else if (intent === "confirm" && commands[focus]?.enabled) { props.onConfirmSound(); run(focus); }
	});
	const caption = debrief.accomplished ? AC04MissionNarrative[missionId]?.debriefing ?? "" : ac04FailureText(props.result.reason);
	const typography = layout.typography, narrow = layout.form === "narrow";
	const tables = narrow
		? (
			<scrollingframe BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={new UDim2()} AutomaticCanvasSize={Enum.AutomaticSize.Y} ScrollBarThickness={4} Selectable={false} Position={UDim2.fromOffset(layout.summary.x, layout.summary.y)} Size={UDim2.fromOffset(layout.summary.width, layout.statistics.y + layout.statistics.height - layout.summary.y)}>
				<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 8)} />
				<Table rows={debrief.summary} width={layout.summary.width - 8} rowHeight={layout.rowHeight} textSize={typography.body} title="SORTIE" />
				{debrief.statistics.size() > 0 && <Table rows={debrief.statistics} width={layout.summary.width - 8} rowHeight={layout.rowHeight} textSize={typography.body} title="STATISTICS" />}
			</scrollingframe>
		)
		: (
			<>
				<frame BackgroundTransparency={1} {...at(layout.summary)}><Table rows={debrief.summary} width={layout.summary.width} rowHeight={layout.rowHeight} textSize={typography.body} title="SORTIE" /></frame>
				<frame BackgroundTransparency={1} {...at(layout.statistics)}>{debrief.statistics.size() > 0 && <Table rows={debrief.statistics} width={layout.statistics.width} rowHeight={layout.rowHeight} textSize={typography.body} title="STATISTICS" />}</frame>
			</>
		);
	return (
		<frame BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
			<AC04GridBackdrop width={props.size.X} height={props.size.Y} />
			<AC04NavHints rect={layout.hints} input={props.input} sideways={true} textSize={typography.small} />
			<AC04Heading rect={layout.title} text={debrief.outcome} sub={`MISSION ${ac04Pad(debrief.missionId, 2)}`} size={typography.title} subSize={typography.small} stackSub={narrow} />
			{tables}
			<AC04CaptionLane rect={layout.caption} text={caption} textSize={typography.body} />
			<AC04Line rect={layout.status} text={props.errorText !== "" ? props.errorText : debrief.saveNote} textSize={typography.small} color={props.errorText !== "" || debrief.saveWarning ? AC04Color.Warning : AC04Color.Muted} font={AC04_COMMAND_FONT} />
			<AC04CommandBar rect={layout.commands} commands={commands} focus={focus} textSize={typography.small + 1} onFocus={props.onFocus} onActivate={run} />
		</frame>
	);
}

export interface AC04PauseProps {
	size: Vector2; input: AC04InputMode;
	telemetry: Telemetry; missionTitle: string;
	busy: boolean; errorText: string; highContrast: boolean; focus: number;
	onFocus: (index: number) => void;
	onResume: () => void; onReturn: () => void; onContrast: () => void;
	onConfirmSound: () => void;
}

/** Compact pause command list over a dimmed HUD; targeting stays hidden by the controller while paused. */
export function AC04PauseMenu(props: AC04PauseProps) {
	const layout = ac04MenuLayout(props.size.X, props.size.Y, props.input, 3);
	const commands: AC04Command[] = [
		{ id: "resume", label: "RESUME", enabled: !props.busy, help: "Return to the sortie." },
		{ id: "return", label: "RETURN TO HUB", enabled: !props.busy, help: "Abandon this sortie and return to the pre-mission hub. Mission progress is unchanged." },
		{ id: "contrast", label: "HUD BACKING", enabled: !props.busy, detail: props.highContrast ? "HIGH" : "STANDARD", help: "Stronger backing behind HUD text for bright skies." },
	];
	const enabled = commands.map((command) => command.enabled);
	const focus = math.max(0, ac04ClampFocus(props.focus, enabled));
	const actions = [props.onResume, props.onReturn, props.onContrast];
	useAC04MenuKeys(true, (intent) => {
		if (intent === "up") props.onFocus(ac04MoveFocus(focus, -1, enabled));
		else if (intent === "down") props.onFocus(ac04MoveFocus(focus, 1, enabled));
		else if (intent === "confirm" && commands[focus]?.enabled) { props.onConfirmSound(); actions[focus](); }
		else if (intent === "back" && !props.busy) { props.onConfirmSound(); props.onResume(); }
	});
	const t = props.telemetry, typography = layout.typography;
	const remaining = t.pauseRemaining;
	const details = [`OBJECTIVE >  ${t.objective ?? "Awaiting orders"}`];
	if (t.objectiveTotal !== undefined && t.objectiveTotal > 0) details.push(`PROGRESS >  ${ac04Pad(t.objectiveProgress ?? 0, 2)} / ${ac04Pad(t.objectiveTotal, 2)}`);
	details.push(`TIME LEFT >  ${ac04Minutes(t.timeRemaining ?? 0)}`);
	if (remaining !== undefined) details.push(`PAUSE TIME LEFT >  ${ac04Minutes(remaining)}`);
	return (
		<frame BackgroundColor3={AC04Color.Base} BackgroundTransparency={0.18} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} ZIndex={20} Active={true}>
			<AC04NavHints rect={layout.hints} input={props.input} textSize={typography.small} />
			<AC04Heading rect={layout.title} text="SORTIE PAUSED" sub={string.upper(props.missionTitle)} size={typography.title} subSize={typography.small} />
			<AC04CommandList rect={layout.list} commands={commands} focus={focus} rowPitch={layout.rowPitch} textSize={typography.command} onFocus={props.onFocus} onActivate={(index) => actions[index]()} />
			<textlabel BackgroundTransparency={1} FontFace={AC04_BODY_FONT} Text={details.join("\n")} TextColor3={AC04Color.White} TextSize={typography.body} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top} {...at(layout.detail)} />
			<AC04Line rect={layout.help} text={commands[focus]?.help ?? ""} textSize={typography.small + 1} color={AC04Color.Ink} />
			{props.errorText !== "" && <AC04Line rect={layout.status} text={props.errorText} textSize={typography.small} color={AC04Color.Warning} font={AC04_COMMAND_FONT} />}
		</frame>
	);
}

/** Sortie preparation while the server builds the world; Return is the existing ReturnToMenu request. */
export function AC04LoadingScreen({ size, input, missionId, busy, errorText, onReturn, onConfirmSound }: { size: Vector2; input: AC04InputMode; missionId: number; busy: boolean; errorText: string; onReturn: () => void; onConfirmSound: () => void }) {
	const layout = ac04MenuLayout(size.X, size.Y, input, 1);
	const mission = AC04MissionData.Get(missionId);
	// Back only: a confirm press carried over from launch must not abandon the sortie.
	useAC04MenuKeys(true, (intent) => { if (intent === "back" && !busy) { onConfirmSound(); onReturn(); } });
	return (
		<frame BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
			<AC04GridBackdrop width={size.X} height={size.Y} />
			<AC04Heading rect={layout.title} text={`${ac04Pad(missionId, 2)}  ${string.upper(mission.title)}`} sub="PREPARING SORTIE" size={layout.typography.title} subSize={layout.typography.small} />
			<AC04Line rect={layout.help} text={errorText !== "" ? errorText : "Preparing terrain, aircraft and mission systems."} textSize={layout.typography.body} color={errorText !== "" ? AC04Color.Warning : AC04Color.Ink} />
			<AC04CommandBar rect={layout.commands} commands={[{ id: "return", label: "RETURN TO HUB", enabled: !busy }]} textSize={layout.typography.small + 1} onActivate={onReturn} />
		</frame>
	);
}
