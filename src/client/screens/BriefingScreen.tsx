import React, { useContext, useEffect, useRef, useState } from "@rbxts/react";
import { GuiService } from "@rbxts/services";
import { highestUnlocked } from "../../shared/CampaignProgress";
import type { SaveSlot } from "../../shared/Types";
import { ACT_NAMES, ACT_NUMERALS, ACTS, environmentName, MissionCatalog, MISSION_COUNT, REGION_NAMES } from "../../shared/MissionCatalog";
import { MissionScore } from "../../shared/MissionScore";
import { type SpecialKind } from "../../shared/SpecialWeapons";
import { type DifficultyKind } from "../../shared/Difficulty";
import {
	ARCHIVE_GAP,
	ARCHIVE_HEADER_HEIGHT,
	ARCHIVE_TAB_HEIGHT,
	BRIEFING_GAP,
	BRIEFING_HEADER_SPACING,
	BRIEFING_LINE_HEIGHT,
	BRIEFING_STORY_LINE_HEIGHT,
	getArchiveCanvasHeight,
	getArchiveGrid,
	getBriefingLayout,
} from "../../shared/BriefingLayout";
import type { MenuLayout } from "../../shared/UILayout";
import { C, HEX } from "../Theme";
import { LoadoutPicker } from "../LoadoutPicker";
import { DifficultyPicker } from "../DifficultyPicker";
import { InputModeContext, SELECTION_NONE, useHighlight } from "../Highlight";
import { ActionButton, Corner, Label, ScreenHeader, SectionHeading, Stroke } from "./Primitives";
import { actLabel, completedCount, formatTime, missionNumber, panelPosition } from "./UIFormat";

/** Short mission rules, mentioning beacons and escorts only when this sortie has them. */
function missionRules(phases: { kind: string }[]): string {
	const lines = ["10-minute window · Retry any time"];
	if (phases.some((phase) => phase.kind === "route" || phase.kind === "recon" || phase.kind === "signal" || phase.kind === "defend")) {
		lines.push("Green beacon: fly inside its volume. Scans need the shown altitude.");
	}
	if (phases.some((phase) => phase.kind === "escort")) lines.push("Escort: stay near the vehicle; down raiders before they close.");
	return lines.join("\n");
}

type TileState = "complete" | "next" | "open" | "locked";

function MissionTile({ id, state, selected, enabled, width, height, onChoose }: {
	id: number;
	state: TileState;
	selected: boolean;
	enabled: boolean;
	width: number;
	height: number;
	onChoose: (id: number) => void;
}) {
	const { hot, events, clearHover } = useHighlight(enabled);
	const blueprint = MissionCatalog.Get(id);
	const locked = state === "locked";
	const lit = selected || hot;
	const name = `Mission${missionNumber(id)}SelectButton`;
	const stateText = state === "complete" ? "✓ CLEAR" : state === "next" ? "NEXT" : state === "locked" ? "LOCKED" : "";
	const stateColor = state === "complete" ? C.Accent : state === "next" ? C.Orange : C.Faint;
	return (
		<textbutton
			key={name}
			Active={enabled}
			Selectable={enabled}
			AutoButtonColor={false}
			BackgroundColor3={lit ? C.PanelHot : C.Panel}
			BackgroundTransparency={locked ? 0.7 : hot ? 0.04 : selected ? 0.1 : 0.28}
			BorderSizePixel={0}
			LayoutOrder={id}
			SelectionImageObject={SELECTION_NONE}
			Size={UDim2.fromOffset(width, height)}
			Text=""
			Event={{ ...events, Activated: () => { clearHover(); if (enabled) onChoose(id); } }}
		>
			<Corner radius={8} />
			<Stroke color={hot ? C.Ivory : selected ? C.Accent : C.Ivory} transparency={lit ? 0.1 : 0.88} thickness={lit ? 2 : 1} />
			<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} PaddingTop={new UDim(0, 7)} PaddingBottom={new UDim(0, 7)} />
			<Label name="Number" text={missionNumber(id)} color={selected ? C.Accent : C.Faint} textSize={12} font={Enum.Font.RobotoMono} size={new UDim2(0.4, 0, 0, 14)} />
			<Label name="State" text={stateText} color={stateColor} textSize={9} minTextSize={7} font={Enum.Font.GothamBold} anchorPoint={new Vector2(1, 0)} position={UDim2.fromScale(1, 0)} size={new UDim2(0.6, 0, 0, 14)} textXAlignment={Enum.TextXAlignment.Right} />
			<textlabel key="MissionTitle" BackgroundTransparency={1} Font={Enum.Font.GothamBold} Position={UDim2.fromOffset(0, 17)} Size={new UDim2(1, 0, 0, 16)} Text={blueprint.title} TextColor3={locked ? C.Faint : C.Ivory} TextScaled={true} TextXAlignment={Enum.TextXAlignment.Left}>
				{/* Long titles shrink to 10pt rather than truncating on phone-width tiles. */}
				<uitextsizeconstraint MaxTextSize={12} MinTextSize={10} />
			</textlabel>
			<textlabel key="MissionMeta" BackgroundTransparency={1} Font={Enum.Font.GothamMedium} Position={UDim2.fromOffset(0, 34)} Size={new UDim2(1, 0, 0, 12)} Text={REGION_NAMES[blueprint.region] ?? ""} TextColor3={C.Faint} TextSize={10} TextTransparency={locked ? 0.4 : 0} TextTruncate={Enum.TextTruncate.AtEnd} TextXAlignment={Enum.TextXAlignment.Left} />
		</textbutton>
	);
}

function ActTab({ act, active, done, total, showName, onSelect }: { act: number; active: boolean; done: number; total: number; showName: boolean; onSelect: (act: number) => void }) {
	const { hot, events, clearHover } = useHighlight(true);
	return (
		<textbutton
			key={`Act${act}`}
			AutoButtonColor={false}
			BackgroundColor3={active ? C.Accent : hot ? C.PanelHot : C.Panel}
			BackgroundTransparency={active ? 0 : hot ? 0.05 : 0.28}
			BorderSizePixel={0}
			LayoutOrder={act}
			SelectionImageObject={SELECTION_NONE}
			Size={new UDim2(1 / 3, -4, 1, 0)}
			Text=""
			Event={{ ...events, Activated: () => { clearHover(); onSelect(act); } }}
		>
			<Corner />
			<Stroke color={hot ? C.Ivory : active ? C.Accent : C.Ivory} transparency={hot ? 0.1 : active ? 0.4 : 0.88} thickness={hot ? 2 : 1} />
			<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} PaddingTop={new UDim(0, 6)} PaddingBottom={new UDim(0, 6)} />
			<Label name="ActNumber" text={`ACT ${ACT_NUMERALS[act]}`} color={active ? C.Ink : C.Ivory} textSize={12} font={Enum.Font.GothamBlack} position={UDim2.fromOffset(0, showName ? 0 : 8)} size={new UDim2(0.6, 0, 0, 16)} />
			<Label name="ActCount" text={`${done}/${total}`} color={active ? C.Ink : done === total ? C.Accent : C.Muted} textSize={10} font={Enum.Font.RobotoMono} anchorPoint={new Vector2(1, 0)} position={new UDim2(1, 0, 0, showName ? 0 : 8)} size={new UDim2(0.4, 0, 0, 16)} textXAlignment={Enum.TextXAlignment.Right} />
			<Label name="ActName" visible={showName} text={ACT_NAMES[act] ?? ""} color={active ? C.Ink : C.Faint} textSize={9} minTextSize={8} font={Enum.Font.GothamBold} anchorPoint={new Vector2(0, 1)} position={UDim2.fromScale(0, 1)} size={new UDim2(1, 0, 0, 12)} />
		</textbutton>
	);
}

function BriefingScreenImpl({visible,menu,selectedSlot,selectedMission,slot,busy,special,difficulty,onBack,onLaunch,onMission,onSpecial,onDifficulty}: {
	visible:boolean;menu:MenuLayout;selectedSlot:number;selectedMission:number;slot?:SaveSlot;busy:boolean;special:SpecialKind;difficulty:DifficultyKind;
	onBack:()=>void;onLaunch:()=>void;onMission:(id:number)=>void;onSpecial:(kind:SpecialKind)=>void;onDifficulty:(kind:DifficultyKind)=>void;
}) {
	const [browse,setBrowse]=useState(false),[act,setAct]=useState(1);
	const [detailsCanvasHeight,setDetailsCanvasHeight]=useState(0);
	const [scrolledToEnd,setScrolledToEnd]=useState(false);
	const panelRef=useRef<Frame>();const inputMode=useContext(InputModeContext);
	// Whether the reading column is scrolled to its end, from the live canvas
	// position and the latest content height (the canvas may grow or remount).
	const detailsCanvasRef=useRef(0);
	const updateScrolledToEnd=(frame:ScrollingFrame)=>setScrolledToEnd(frame.CanvasPosition.Y>=detailsCanvasRef.current-frame.AbsoluteWindowSize.Y-4);
	useEffect(()=>setScrolledToEnd(false),[selectedMission,browse]);
	useEffect(()=>{if(!visible || inputMode!=="gamepad")return;task.defer(()=>{
		const panel=panelRef.current;if(!panel)return;
		let selected:Instance|undefined;
		if(browse) {
			// The archive opens on the selected mission's tile, else the act's first playable tile.
			const tile=panel.FindFirstChild(`Mission${missionNumber(selectedMission)}SelectButton`,true);
			if(tile?.IsA("GuiObject") && tile.Selectable) selected=tile;
			const archive=panel.FindFirstChild("MissionArchive",true);
			if(!selected && archive) {
				let first:GuiObject|undefined;
				for(const child of archive.GetChildren()) {
					if(child.IsA("GuiObject") && child.Selectable && (first===undefined || child.LayoutOrder<first.LayoutOrder)) first=child;
				}
				selected=first;
			}
		}
		if(!selected) selected=panel.FindFirstChild(browse ? "ArchiveBackButton" : "LaunchButton",true);
		if(selected?.IsA("GuiObject"))GuiService.SelectedObject=selected;
	});},[browse,act,inputMode,visible,selectedMission]);
	const mission=MissionCatalog.Get(selectedMission);
	const unlocked=highestUnlocked(slot);
	const record=slot?.missions?.[selectedMission];
	const completed=record?.completed===true;
	const layout=getBriefingLayout(menu.panel.width,menu.panel.height);
	const grid=getArchiveGrid(menu.panel.width,menu.panel.height);
	const choose=(id:number)=>{onMission(id);setBrowse(false);};
	const status=completed
		? `  <font color="${HEX.Accent}">✓ CLEARED${record?.bestRank!==undefined ? ` · RANK ${record.bestRank}` : ""}${record?.bestTime!==undefined ? ` · ${formatTime(record.bestTime)}` : ""}</font>`
		: selectedMission===unlocked ? `  <font color="${HEX.Orange}">NEW SORTIE</font>` : "";
	const overflow=detailsCanvasHeight-layout.detailsHeight;
	const actMissions=MissionCatalog.All().filter((bp)=>bp.act===act);
	return <frame key="BriefingScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1,1)} Visible={visible}>
		<frame ref={panelRef} key="BriefingPanel" BackgroundTransparency={1} {...panelPosition(menu)}>
			{browse ? <>
				<ScreenHeader name="ArchiveHeader" backName="ArchiveBackButton" title="MISSION ARCHIVE" subtitle={`FILE ${selectedSlot} · ${completedCount(slot)}/${MISSION_COUNT} COMPLETE`} compact={menu.compact} onBack={()=>setBrowse(false)}/>
				<frame key="ActTabs" BackgroundTransparency={1} Position={UDim2.fromOffset(0,ARCHIVE_HEADER_HEIGHT+ARCHIVE_GAP)} Size={new UDim2(1,4,0,ARCHIVE_TAB_HEIGHT)}>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0,4)} SortOrder={Enum.SortOrder.LayoutOrder}/>
					{ACTS.map((id)=><ActTab key={`Act${id}`} act={id} active={act===id} done={completedCount(slot,id)} total={MissionCatalog.ByAct(id).size()} showName={menu.panel.width>=400} onSelect={setAct}/>)}
				</frame>
				<scrollingframe key="MissionArchive" Position={UDim2.fromOffset(0,grid.top)} Size={new UDim2(1,0,0,grid.height)} CanvasSize={UDim2.fromOffset(0,getArchiveCanvasHeight(grid,actMissions.size()))} BackgroundTransparency={1} BorderSizePixel={0} ScrollBarThickness={3} ScrollBarImageColor3={C.Ivory} ScrollBarImageTransparency={0.6} ScrollingDirection={Enum.ScrollingDirection.Y}>
					<uigridlayout CellPadding={UDim2.fromOffset(grid.gap,grid.gap)} CellSize={UDim2.fromOffset(grid.tileWidth,grid.tileHeight)} FillDirectionMaxCells={grid.columns} SortOrder={Enum.SortOrder.LayoutOrder}/>
					{actMissions.map((bp)=>{
						const state:TileState=slot?.missions?.[bp.id]?.completed ? "complete" : bp.id===unlocked ? "next" : bp.id<unlocked ? "open" : "locked";
						return <MissionTile key={`Mission${missionNumber(bp.id)}SelectButton`} id={bp.id} state={state} selected={selectedMission===bp.id} enabled={!busy && bp.id<=unlocked} width={grid.tileWidth} height={grid.tileHeight} onChoose={choose}/>;
					})}
				</scrollingframe>
			</> : <>
				{/* The heading scrolls with the copy: short landscape roots spend the
				    entire height above the single action dock on reading. */}
				<scrollingframe key="BriefingDetails" Size={new UDim2(1,0,0,layout.detailsHeight)} CanvasSize={UDim2.fromOffset(0,detailsCanvasHeight)} Active={true} Selectable={true} ClipsDescendants={true} ScrollingDirection={Enum.ScrollingDirection.Y} VerticalScrollBarInset={Enum.ScrollBarInset.Always} BackgroundTransparency={1} BorderSizePixel={0} ScrollBarThickness={4} ScrollBarImageColor3={C.Ivory} ScrollBarImageTransparency={0.55} Change={{CanvasPosition:updateScrolledToEnd}}>
					<uilistlayout Padding={new UDim(0,BRIEFING_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} Change={{AbsoluteContentSize:(list)=>{
						detailsCanvasRef.current=list.AbsoluteContentSize.Y + 4;
						setDetailsCanvasHeight(detailsCanvasRef.current);
						const frame=list.Parent;
						if(frame?.IsA("ScrollingFrame"))updateScrolledToEnd(frame);
					}}}/>
					<frame key="BriefingHeader" AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} LayoutOrder={1} Size={new UDim2(1,-12,0,0)}>
						<uilistlayout Padding={new UDim(0,BRIEFING_HEADER_SPACING)} SortOrder={Enum.SortOrder.LayoutOrder}/>
						<Label name="BriefingEyebrow" text={`${actLabel(mission.act)}  ·  MISSION ${missionNumber(selectedMission)}/${MISSION_COUNT}`} color={C.Accent} textSize={11} minTextSize={8} font={Enum.Font.GothamBold} size={new UDim2(1,0,0,BRIEFING_LINE_HEIGHT)} layoutOrder={1}/>
						<Label name="BriefingTitle" text={mission.title} textSize={layout.titleSize} font={Enum.Font.GothamBlack} size={new UDim2(1,0,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={2}/>
						<Label name="BriefingMeta" text={`${REGION_NAMES[mission.region] ?? ""} · ${environmentName(mission.environment)}${status}`} richText={true} color={C.Muted} textSize={10} minTextSize={7} font={Enum.Font.GothamBold} size={new UDim2(1,0,0,BRIEFING_LINE_HEIGHT)} layoutOrder={3}/>
					</frame>
					<textlabel key="Story" AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} Font={Enum.Font.Gotham} LayoutOrder={2} LineHeight={BRIEFING_STORY_LINE_HEIGHT} Size={new UDim2(1,-12,0,0)} Text={mission.briefing} TextColor3={C.Ivory} TextSize={layout.bodySize} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top}/>
					<frame key="ObjectiveCard" AutomaticSize={Enum.AutomaticSize.Y} BackgroundColor3={C.Panel} BackgroundTransparency={0.4} BorderSizePixel={0} LayoutOrder={3} Size={new UDim2(1,-12,0,0)}>
						<Corner radius={8}/>
						<Stroke transparency={0.9}/>
						<uipadding PaddingLeft={new UDim(0,12)} PaddingRight={new UDim(0,12)} PaddingTop={new UDim(0,10)} PaddingBottom={new UDim(0,10)}/>
						<uilistlayout Padding={new UDim(0,4)} SortOrder={Enum.SortOrder.LayoutOrder}/>
						<SectionHeading name="ObjectiveHeading" text="OBJECTIVE" layoutOrder={1}/>
						<Label name="Primary" text={mission.primary} textSize={13} font={Enum.Font.GothamMedium} size={new UDim2(1,0,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={2}/>
						<Label name="PhasePlan" text={mission.phases.map((phase,index)=>`<font color="${HEX.Accent}">${missionNumber(index+1)}</font>   ${phase.label}`).join("\n")} richText={true} color={C.Muted} textSize={12} size={new UDim2(1,0,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={3}/>
						{/* Par is the time the debrief judges; show it before launch, with the slot's best when there is one. */}
						<Label name="ParTime" text={`PAR ${formatTime(MissionScore.ParSeconds(mission))}${record?.bestTime!==undefined ? `  ·  YOUR BEST ${formatTime(record.bestTime)}` : ""}`} color={C.Accent} textSize={11} minTextSize={8} font={Enum.Font.GothamBold} size={new UDim2(1,0,0,BRIEFING_LINE_HEIGHT)} layoutOrder={4}/>
						<Label name="MissionRules" text={missionRules(mission.phases)} color={C.Faint} textSize={11} size={new UDim2(1,0,0,0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} layoutOrder={5}/>
					</frame>
					<LoadoutPicker kind={special} enabled={!busy} layoutOrder={4} onChange={onSpecial}/>
					<DifficultyPicker kind={difficulty} enabled={!busy} layoutOrder={5} onChange={onDifficulty}/>
				</scrollingframe>
				{/* Fades the last visible line while more copy waits below. */}
				<frame key="MoreFade" Active={false} BackgroundColor3={C.Ink} BorderSizePixel={0} Position={UDim2.fromOffset(0,layout.detailsHeight-22)} Size={new UDim2(1,-6,0,22)} Visible={overflow>2 && !scrolledToEnd} ZIndex={2}>
					<uigradient Rotation={90} Transparency={new NumberSequence(1,0.15)}/>
				</frame>
				<frame key="BriefingDock" BackgroundTransparency={1} Position={UDim2.fromOffset(0,layout.dockTop)} Size={new UDim2(1,0,0,layout.dockHeight)}>
					<ActionButton name="BriefingBackButton" text={layout.dock.back<80 ? "‹" : "‹ FILES"} size={UDim2.fromOffset(layout.dock.back,layout.dockHeight)} enabled={!busy} textSize={13} onActivated={onBack}/>
					<ActionButton name="BrowseMissionsButton" text="MISSIONS" position={UDim2.fromOffset(layout.dock.back+layout.dock.gap,0)} size={UDim2.fromOffset(layout.dock.archive,layout.dockHeight)} enabled={!busy} textSize={13} onActivated={()=>{setAct(mission.act);setBrowse(true);}}/>
					<ActionButton name="LaunchButton" text={busy ? "PREPARING..." : completed ? "REPLAY  ›" : "LAUNCH  ›"} primary={true} position={UDim2.fromOffset(layout.dock.back+layout.dock.archive+layout.dock.gap*2,0)} size={UDim2.fromOffset(layout.dock.launch,layout.dockHeight)} enabled={!busy} textSize={15} onActivated={onLaunch}/>
				</frame>
			</>}
		</frame>
	</frame>;
}
const BriefingScreen = React.memo(BriefingScreenImpl);

export { BriefingScreen };
