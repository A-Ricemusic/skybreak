import React from "@rbxts/react";
import type { Persistence, SaveSlot } from "../../shared/Types";
import { MISSION_COUNT, MissionCatalog } from "../../shared/MissionCatalog";
import {
	CAMPAIGN_HEADER_GAP,
	CAMPAIGN_HEADER_HEIGHT,
	getSaveSlotLayout,
	getSlotListCanvasHeight,
	getSlotListHeight,
	SAVE_SLOT_GAP,
	SAVE_SLOT_SCROLLBAR_LANE,
	type SaveSlotLayout,
} from "../../shared/SaveSlotLayout";
import { MIN_TOUCH_TARGET, type MenuLayout } from "../../shared/UILayout";
import { C } from "../Theme";
import { SELECTION_NONE, useHighlight } from "../Highlight";
import { ActionButton, Corner, Label, ScreenHeader, Stroke } from "./Primitives";
import { completedCount, missionNumber, panelPosition } from "./UIFormat";

const SLOT_NUMBERS = [1, 2, 3, 4];

function SaveSlotRow({
	number,
	slot,
	busy,
	confirming,
	layout,
	onSlot,
	onAskDelete,
	onConfirmDelete,
	onCancelDelete,
}: {
	number: number;
	slot?: SaveSlot;
	busy: boolean;
	confirming: boolean;
	layout: SaveSlotLayout;
	onSlot: (slot: number) => void;
	onAskDelete: (slot: number) => void;
	onConfirmDelete: (slot: number) => void;
	onCancelDelete: () => void;
}) {
	const enabled = !busy && slot !== undefined && !confirming;
	const deletable = !busy && slot?.occupied === true;
	const { hot, events, clearHover } = useHighlight(enabled);
	const deleteHighlight = useHighlight(deletable && !confirming);
	const completed = completedCount(slot);
	const status = busy ? "READING FILE..." : !slot ? "LINK UNAVAILABLE" : slot.completed ? "COMPLETE · REPLAY" : slot.occupied ? `CONTINUE MISSION ${missionNumber(slot.currentMission ?? 1)}` : "NEW CAMPAIGN";
	const detail = busy ? "Please stand by" : !slot ? "Return and try again" : `${completed}/${MISSION_COUNT} complete · ${MissionCatalog.Get(slot.currentMission ?? 1).title}`;
	const statusColor = confirming ? C.Danger : slot?.completed ? C.Accent : slot && !slot.occupied && !busy ? C.Accent : C.Ivory;
	const accent = confirming ? C.Danger : hot ? C.Accent : C.Faint;
	// Label uses fixed-size text: the copy frame clips, and SaveSlotLayout sizes
	// its lanes from real font metrics (see SaveSlotLayout.spec).
	const copy = (
		<frame key="Copy" BackgroundTransparency={1} ClipsDescendants={true} Position={UDim2.fromOffset(layout.copyLeft, 0)} Size={UDim2.fromOffset(layout.copyWidth, layout.rowHeight)}>
			<Label name="Status" text={confirming ? `DELETE FILE ${missionNumber(number)}?` : status} color={statusColor} textSize={13} font={Enum.Font.GothamBold} position={UDim2.fromOffset(0, layout.statusTop)} size={new UDim2(1, 0, 0, layout.statusHeight)} textWrapped={true} />
			<Label name="Detail" text={confirming ? "All progress in this file is lost." : detail} color={C.Muted} textSize={12} position={UDim2.fromOffset(0, layout.detailTop)} size={new UDim2(1, 0, 0, layout.detailHeight)} textWrapped={true} />
			{slot?.occupied === true && !confirming && (
				<frame key="Progress" BackgroundColor3={C.Ivory} BackgroundTransparency={0.88} BorderSizePixel={0} Position={UDim2.fromOffset(0, layout.progressTop)} Size={new UDim2(1, 0, 0, 3)}>
					<Corner scale={1} />
					<frame key="Fill" BackgroundColor3={C.Accent} BorderSizePixel={0} Size={new UDim2(completed / MISSION_COUNT, 0, 1, 0)} Visible={completed > 0}>
						<Corner scale={1} />
					</frame>
				</frame>
			)}
		</frame>
	);
	const numberLabel = <Label name="SlotNumber" text={missionNumber(number)} color={accent} textSize={13} font={Enum.Font.RobotoMono} position={UDim2.fromOffset(12, 0)} size={UDim2.fromOffset(28, layout.rowHeight)} />;
	const rightLane = MIN_TOUCH_TARGET + 16;
	return (
		<frame key={`Slot${number}Row`} BackgroundColor3={hot ? C.PanelHot : C.Panel} BackgroundTransparency={hot ? 0.04 : 0.28} BorderSizePixel={0} LayoutOrder={number} Size={new UDim2(1, -SAVE_SLOT_SCROLLBAR_LANE, 0, confirming ? layout.confirmHeight : layout.rowHeight)}>
			<Corner radius={8} />
			<Stroke color={confirming ? C.Danger : hot ? C.Accent : C.Ivory} transparency={confirming || hot ? 0.15 : 0.88} thickness={confirming || hot ? 2 : 1} />
			{confirming ? (
				<frame key="Confirmation" BackgroundTransparency={1} Size={new UDim2(1, 0, 0, layout.rowHeight)}>
					{numberLabel}
					{copy}
				</frame>
			) : (
				<textbutton key={`Slot${number}Button`} Active={enabled} Selectable={enabled} AutoButtonColor={false} BackgroundTransparency={1} BorderSizePixel={0} SelectionImageObject={SELECTION_NONE} Size={new UDim2(1, deletable ? -rightLane : 0, 0, layout.rowHeight)} Text="" Event={{...events, Activated: () => { clearHover(); if (enabled) onSlot(number); }}}>
					{numberLabel}
					{copy}
					{!deletable && <Label name="Arrow" text="›" color={hot ? C.Accent : C.Faint} textSize={22} anchorPoint={new Vector2(1, 0.5)} position={new UDim2(1, -20, 0, layout.rowHeight / 2)} size={UDim2.fromOffset(16, 28)} textXAlignment={Enum.TextXAlignment.Center} visible={enabled} />}
				</textbutton>
			)}
			{confirming ? (
				<frame key="DeleteActions" BackgroundTransparency={1} Position={UDim2.fromOffset(8, layout.rowHeight)} Size={new UDim2(1, -16, 0, MIN_TOUCH_TARGET)}>
					<ActionButton name="KeepButton" text="KEEP" size={new UDim2(0.5, -4, 1, 0)} enabled={!busy} textSize={12} onActivated={onCancelDelete} />
					<ActionButton name="ConfirmDeleteButton" text="DELETE" primary={true} position={new UDim2(0.5, 4, 0, 0)} size={new UDim2(0.5, -4, 1, 0)} enabled={!busy} textSize={12} onActivated={() => onConfirmDelete(number)} />
				</frame>
			) : deletable && (
				<textbutton
					key="DeleteButton"
					AnchorPoint={new Vector2(1, 0.5)}
					AutoButtonColor={false}
					BackgroundColor3={deleteHighlight.hot ? C.PanelHot : C.Ink}
					BackgroundTransparency={deleteHighlight.hot ? 0.05 : 0.5}
					BorderSizePixel={0}
					Font={Enum.Font.GothamBold}
					Position={new UDim2(1, -8, 0, layout.rowHeight / 2)}
					SelectionImageObject={SELECTION_NONE}
					Size={UDim2.fromOffset(MIN_TOUCH_TARGET, MIN_TOUCH_TARGET)}
					Text="✕"
					TextColor3={deleteHighlight.hot ? C.Danger : C.Muted}
					TextSize={15}
					Event={{ ...deleteHighlight.events, Activated: () => { deleteHighlight.clearHover(); onAskDelete(number); } }}
				>
					<Corner />
					<Stroke color={deleteHighlight.hot ? C.Danger : C.Ivory} transparency={deleteHighlight.hot ? 0.2 : 0.88} thickness={deleteHighlight.hot ? 2 : 1} />
				</textbutton>
			)}
		</frame>
	);
}

function CampaignScreenImpl({
	visible,
	menu,
	slots,
	busy,
	persistence,
	onBack,
	onSlot,
	confirmSlot,
	onAskDelete,
	onCancelDelete,
	onDeleteSlot,
}: {
	visible: boolean;
	menu: MenuLayout;
	slots?: SaveSlot[];
	busy: boolean;
	persistence: Persistence;
	onBack: () => void;
	onSlot: (slot: number) => void;
	confirmSlot?: number;
	onAskDelete: (slot: number) => void;
	onCancelDelete: () => void;
	onDeleteSlot: (slot: number) => void;
}) {
	// Narrow panels (under 400px) get short copy so the one-line status never clips.
	const short = menu.panel.width < 400;
	const persistenceText = busy
		? short ? "CONNECTING..." : "CONNECTING TO FLIGHT RECORDS..."
		: persistence === "cloud"
			? short ? "CLOUD SAVES ONLINE" : "CLOUD SAVES ONLINE · SELECT A FLIGHT RECORD"
			: persistence === "session"
				? short ? "SESSION-ONLY SAVES" : "SAVES KEPT FOR THIS SESSION ONLY"
				: short ? "OFFLINE · MAY NOT SAVE" : "SAVE SERVICE OFFLINE · PROGRESS MAY NOT PERSIST";
	const layout = getSaveSlotLayout(menu.panel.width);
	const canvasHeight = getSlotListCanvasHeight(layout, SLOT_NUMBERS.map((number) => confirmSlot === number));
	return (
		<frame key="CampaignScreen" BackgroundTransparency={1} Visible={visible} {...panelPosition(menu)}>
			<ScreenHeader
				name="CampaignHeader"
				backName="CampaignBackButton"
				enabled={!busy}
				title="CAMPAIGN FILES"
				subtitle={persistenceText}
				subtitleColor={persistence === "unavailable" && !busy ? C.Orange : persistence === "cloud" && !busy ? C.Accent : C.Muted}
				compact={menu.compact}
				onBack={onBack}
			/>
			<scrollingframe key="SlotGrid" BackgroundTransparency={1} BorderSizePixel={0} ScrollBarThickness={3} ScrollBarImageColor3={C.Ivory} ScrollBarImageTransparency={0.6} ScrollingDirection={Enum.ScrollingDirection.Y} CanvasSize={UDim2.fromOffset(0, canvasHeight)} Position={UDim2.fromOffset(0, CAMPAIGN_HEADER_HEIGHT + CAMPAIGN_HEADER_GAP)} Size={new UDim2(1, 0, 0, getSlotListHeight(menu.panel.height))}>
				<uilistlayout Padding={new UDim(0, SAVE_SLOT_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} />
				{SLOT_NUMBERS.map((number) => (
					<SaveSlotRow
						key={`Slot${number}Row`}
						number={number}
						slot={slots?.[number - 1]}
						busy={busy}
						confirming={confirmSlot === number}
						layout={layout}
						onSlot={onSlot}
						onAskDelete={onAskDelete}
						onConfirmDelete={onDeleteSlot}
						onCancelDelete={onCancelDelete}
					/>
				))}
			</scrollingframe>
		</frame>
	);
}
const CampaignScreen = React.memo(CampaignScreenImpl);

export { CampaignScreen };
