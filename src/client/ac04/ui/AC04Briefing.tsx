import React, { useMemo } from "@rbxts/react";
import { AC04MissionData } from "../../../shared/AC04MissionData";
import { AC04WorldPlanner } from "../../../shared/AC04WorldData";
import type { AC04MissionNarrativeEntry } from "../../../shared/ac04/AC04Story";
import { type AC04BriefingMap, type AC04MapWindow, ac04BriefingMap, ac04ForceCount, ac04InWindow, ac04ObjectiveText } from "../../../shared/ac04/ui/AC04BriefingPresentation";
import { type AC04InputMode, type AC04Rect, ac04BriefingLayout, ac04ObjectiveLayout } from "../../../shared/ac04/ui/AC04MenuLayout";
import type { AC04BriefingStep } from "../../../shared/ac04/ui/AC04Routing";
import { ac04Pad } from "../../../shared/ac04/ui/AC04UIFormat";
import { useAC04MenuKeys } from "./AC04Input";
import { type AC04Command, AC04CaptionLane, AC04CommandBar, AC04Field, AC04Line, AC04NavHints, at } from "./AC04Primitives";
import { AC04_BODY_FONT, AC04_COMMAND_FONT, AC04Color } from "./AC04Theme";

/** Map data for a mission, or undefined if the planner cannot place it (the briefing then shows text only). */
function useBriefingMap(missionId: number): AC04BriefingMap | undefined {
	return useMemo(() => {
		const [ok, map] = pcall(() => ac04BriefingMap(AC04MissionData.Get(missionId), AC04WorldPlanner.Layout(missionId), AC04WorldPlanner.UnitPosition));
		if (!ok) warn(`AC04 briefing map unavailable for mission ${missionId}: ${tostring(map)}`);
		return ok ? map : undefined;
	}, [missionId]);
}

const GRID_DIVISIONS = 8;

/** Original vector briefing map: blue grid, hostile/friendly marks, the start point and the southern return line. */
export function AC04BriefingMapView({ rect, map, window, labelSize }: { rect: AC04Rect; map?: AC04BriefingMap; window: AC04MapWindow; labelSize: number }) {
	const side = rect.width;
	const children: React.Element[] = [];
	for (let i = 1; i < GRID_DIVISIONS; i++) {
		const offset = math.floor((side * i) / GRID_DIVISIONS);
		children.push(<frame key={`gx${i}`} BackgroundColor3={AC04Color.Grid} BackgroundTransparency={0.2} BorderSizePixel={0} Position={UDim2.fromOffset(offset, 0)} Size={new UDim2(0, 1, 1, 0)} />);
		children.push(<frame key={`gy${i}`} BackgroundColor3={AC04Color.Grid} BackgroundTransparency={0.2} BorderSizePixel={0} Position={UDim2.fromOffset(0, offset)} Size={new UDim2(1, 0, 0, 1)} />);
	}
	if (map) {
		const place = (x: number, y: number) => UDim2.fromOffset(math.floor(x * side), math.floor(y * side));
		if (map.returnY !== undefined) {
			const y = (map.returnY - window.y) / window.size;
			if (y >= 0 && y <= 1) {
				children.push(<frame key="ReturnLine" BackgroundColor3={AC04Color.Friendly} BackgroundTransparency={0.15} BorderSizePixel={0} Position={place(0, y)} Size={new UDim2(1, 0, 0, 2)} />);
				children.push(<textlabel key="ReturnLabel" BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text="RETURN LINE" TextColor3={AC04Color.Friendly} TextSize={labelSize} TextXAlignment={Enum.TextXAlignment.Left} AnchorPoint={new Vector2(0, 1)} Position={new UDim2(0, 6, 0, math.floor(y * side) - 2)} Size={UDim2.fromOffset(160, labelSize + 2)} />);
			}
		}
		for (const marker of map.markers) {
			const color = marker.kind === "protected" ? AC04Color.Friendly : AC04Color.Hostile;
			marker.points.forEach((point, index) => {
				const inside = ac04InWindow(point, window);
				if (!inside) return;
				const dot = marker.required ? 7 : 5;
				children.push(<frame key={`${marker.id}_${index}`} AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={color} BackgroundTransparency={marker.required ? 0.05 : 0.55} BorderSizePixel={0} Position={place(inside.x, inside.y)} Size={UDim2.fromOffset(dot, dot)} ZIndex={3} />);
			});
			const centre = ac04InWindow(marker.centroid, window);
			if (centre && (marker.required || marker.kind === "protected")) {
				children.push(
					<textlabel key={`${marker.id}_label`} BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={`${marker.required ? "TGT " : ""}${string.upper(marker.label)} ×${marker.count}`} TextColor3={color} TextSize={labelSize} TextStrokeColor3={AC04Color.Shadow} TextStrokeTransparency={0.4} TextXAlignment={Enum.TextXAlignment.Left} Position={new UDim2(0, math.floor(centre.x * side) + 8, 0, math.floor(centre.y * side) - labelSize - 4)} Size={UDim2.fromOffset(200, labelSize + 2)} ZIndex={4} />,
				);
			}
		}
		const start = ac04InWindow(map.spawn, window);
		if (start) {
			children.push(<textlabel key="Start" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundTransparency={1} Font={Enum.Font.GothamBlack} Text="▲" TextColor3={AC04Color.Friendly} TextSize={labelSize + 4} Position={place(start.x, start.y)} Size={UDim2.fromOffset(18, 18)} ZIndex={5} />);
			children.push(<textlabel key="StartLabel" BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text="MOBIUS 1" TextColor3={AC04Color.Friendly} TextSize={labelSize} TextXAlignment={Enum.TextXAlignment.Left} Position={new UDim2(0, math.floor(start.x * side) + 12, 0, math.floor(start.y * side) - math.floor(labelSize / 2))} Size={UDim2.fromOffset(120, labelSize + 2)} ZIndex={5} />);
		}
	} else {
		children.push(<textlabel key="NoMap" BackgroundTransparency={1} FontFace={AC04_BODY_FONT} Text="Map data unavailable for this briefing." TextColor3={AC04Color.Muted} TextSize={labelSize + 2} Size={UDim2.fromScale(1, 1)} />);
	}
	return (
		<frame BackgroundColor3={AC04Color.Map} BackgroundTransparency={0} BorderSizePixel={0} ClipsDescendants={true} {...at(rect)}>
			<uistroke Color={AC04Color.Ink} Transparency={0.2} Thickness={1} />
			{children}
			<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text="N ▲" TextColor3={AC04Color.Ink} TextSize={labelSize} AnchorPoint={new Vector2(1, 0)} Position={new UDim2(1, -6, 0, 4)} Size={UDim2.fromOffset(40, labelSize + 2)} TextXAlignment={Enum.TextXAlignment.Right} ZIndex={6} />
		</frame>
	);
}

export interface AC04BriefingProps {
	size: Vector2; input: AC04InputMode;
	missionId: number; narrative: AC04MissionNarrativeEntry; step: AC04BriefingStep;
	busy: boolean;
	onStep: (step: AC04BriefingStep) => void;
	/** Leaves the briefing for the hub (after the detail view, or Back from the strategic view). */
	onDone: () => void;
	onConfirmSound: () => void;
}

/** Two manual stages: strategic context, then the operational detail map and objective. No timed auto-advance. */
export function AC04Briefing(props: AC04BriefingProps) {
	const layout = ac04BriefingLayout(props.size.X, props.size.Y, props.input);
	const mission = AC04MissionData.Get(props.missionId);
	const map = useBriefingMap(props.missionId);
	const objective = ac04ObjectiveText(mission);
	const forces = map ? ac04ForceCount(map) : undefined;
	const strategic = props.step === "strategic";
	const advance = () => { if (strategic) props.onStep("detail"); else props.onDone(); };
	const back = () => { if (strategic) props.onDone(); else props.onStep("strategic"); };
	useAC04MenuKeys(true, (intent) => {
		if (intent === "confirm" || intent === "right") { props.onConfirmSound(); advance(); }
		else if (intent === "back" || intent === "left") { props.onConfirmSound(); back(); }
	});
	const commands: AC04Command[] = [
		{ id: "back", label: strategic ? "HUB" : "BACK", enabled: !props.busy },
		{ id: "next", label: strategic ? "DETAIL MAP" : "CONTINUE", enabled: !props.busy },
	];
	const typography = layout.typography, labelSize = math.max(11, typography.small - 1);
	const metaWidth = layout.metaLeft.width;
	return (
		<frame BackgroundColor3={AC04Color.Base} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)}>
			<AC04NavHints rect={layout.hints} input={props.input} sideways={true} textSize={typography.small} />
			<AC04BriefingMapView rect={layout.map} map={map} window={strategic ? map?.area ?? { x: 0, y: 0, size: 1 } : map?.detail ?? { x: 0, y: 0, size: 1 }} labelSize={labelSize} />
			<frame BackgroundTransparency={1} {...at(layout.metaLeft)}>
				<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 6)} />
				<AC04Field label={strategic ? "STRATEGIC VIEW" : "OPERATION AREA"} value={`MISSION ${ac04Pad(mission.id, 2)}`} labelSize={typography.small} valueSize={typography.body} width={metaWidth} order={1} numeric={true} />
				<AC04Field label="TITLE" value={mission.title} labelSize={typography.small} valueSize={typography.body} width={metaWidth} order={2} wrap={true} />
				<AC04Field label="OPERATION" value={string.upper(mission.operation)} labelSize={typography.small} valueSize={typography.body} width={metaWidth} order={3} wrap={true} />
				<AC04Field label="TIME LIMIT" value={objective.timeLimit} labelSize={typography.small} valueSize={typography.body} width={metaWidth} order={4} numeric={true} />
			</frame>
			<frame BackgroundTransparency={1} {...at(layout.metaRight)}>
				<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 6)} />
				<AC04Field label="OBJECTIVE" value={objective.headline} labelSize={typography.small} valueSize={typography.body} width={layout.metaRight.width} order={1} wrap={true} />
				{forces && <AC04Field label="INITIAL CONTACTS" value={`AIR ${ac04Pad(forces.air, 3)}   GRND ${ac04Pad(forces.ground, 3)}\nNAVAL ${ac04Pad(forces.naval, 3)}   TGT ${ac04Pad(forces.targets, 3)}`} labelSize={typography.small} valueSize={typography.small + 1} width={layout.metaRight.width} order={2} wrap={true} numeric={false} valueColor={AC04Color.White} />}
				<textlabel BackgroundTransparency={1} FontFace={AC04_BODY_FONT} RichText={true} LayoutOrder={3} Text={`<font color="#D66D83">■</font> Hostile   <font color="#63BDD9">■</font> Friendly   <font color="#63BDD9">━</font> Return line`} TextColor3={AC04Color.Muted} TextSize={typography.small} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} Size={new UDim2(1, 0, 0, typography.small * 2 + 6)} />
			</frame>
			<AC04CaptionLane rect={layout.caption} text={strategic ? props.narrative.strategic : props.narrative.briefing} textSize={typography.caption} />
			<AC04CommandBar rect={layout.commands} commands={commands} focus={1} textSize={typography.small + 1} onActivate={(index) => (index === 0 ? back() : advance())} />
		</frame>
	);
}

export interface AC04ObjectiveProps {
	size: Vector2; input: AC04InputMode;
	missionId: number; aircraft: string; busy: boolean;
	/** Launch or story-acknowledgement failure that returned the player here. */
	errorText: string;
	onLaunch: () => void; onBack: () => void; onConfirmSound: () => void;
}

/** Explicit launch confirmation: number, title, first objective, loss conditions and the chosen aircraft. */
export function AC04ObjectiveScreen(props: AC04ObjectiveProps) {
	const { size, input } = props;
	const layout = ac04ObjectiveLayout(size.X, size.Y, input);
	const mission = AC04MissionData.Get(props.missionId), objective = ac04ObjectiveText(mission);
	useAC04MenuKeys(true, (intent) => {
		if (props.busy) return;
		if (intent === "confirm") { props.onConfirmSound(); props.onLaunch(); }
		else if (intent === "back") { props.onConfirmSound(); props.onBack(); }
	});
	const typography = layout.typography, width = layout.panel.width - 32;
	const commands: AC04Command[] = [
		{ id: "back", label: "BACK", enabled: !props.busy },
		{ id: "launch", label: props.busy ? "PREPARING SORTIE" : "CONFIRM LAUNCH", enabled: !props.busy },
	];
	return (
		<frame BackgroundColor3={AC04Color.Base} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)}>
			<AC04NavHints rect={layout.hints} input={input} textSize={typography.small} />
			<scrollingframe BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={new UDim2()} AutomaticCanvasSize={Enum.AutomaticSize.Y} ScrollBarThickness={4} Selectable={false} {...at(layout.panel)}>
				<uipadding PaddingLeft={new UDim(0, 16)} PaddingTop={new UDim(0, 12)} />
				<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 10)} />
				<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={ac04Pad(mission.id, 2)} TextColor3={AC04Color.Ink} TextSize={typography.title} TextXAlignment={Enum.TextXAlignment.Left} Size={new UDim2(1, 0, 0, typography.title + 4)} LayoutOrder={1} />
				<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={`"${string.upper(mission.title)}"`} TextColor3={AC04Color.White} TextSize={typography.command} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} Size={new UDim2(1, -16, 0, 0)} AutomaticSize={Enum.AutomaticSize.Y} LayoutOrder={2} />
				<AC04Field label="MISSION OBJECTIVE" value={objective.condition} labelSize={typography.small} valueSize={typography.body} width={width} order={3} wrap={true} />
				<AC04Field label="MISSION FAILS IF" value={objective.failures.join("\n")} labelSize={typography.small} valueSize={typography.body} width={width} order={4} wrap={true} valueColor={AC04Color.Muted} />
				<AC04Field label="AIRCRAFT" value={props.aircraft} labelSize={typography.small} valueSize={typography.body} width={width} order={5} numeric={true} />
			</scrollingframe>
			{props.errorText !== "" && <AC04Line rect={layout.status} text={props.errorText} textSize={typography.small} color={AC04Color.Warning} font={AC04_COMMAND_FONT} />}
			<AC04CommandBar rect={layout.commands} commands={commands} focus={1} textSize={typography.small + 1} onActivate={(index) => (index === 0 ? props.onBack() : props.onLaunch())} />
		</frame>
	);
}
