import React from "@rbxts/react";
import type { AC04Slot } from "../../../shared/AC04Progress";
import { SpecialWeapons } from "../../../shared/SpecialWeapons";
import { type AC04InputMode, ac04AircraftLayout } from "../../../shared/ac04/ui/AC04MenuLayout";
import { ac04AircraftRows, ac04CycleAircraft } from "../../../shared/ac04/ui/AC04RecordSummary";
import { type AC04AircraftPurpose, ac04ScrollTop } from "../../../shared/ac04/ui/AC04Routing";
import { ac04Pad } from "../../../shared/ac04/ui/AC04UIFormat";
import { useAC04MenuKeys } from "./AC04Input";
import { type AC04Command, AC04CommandBar, AC04Field, AC04NavHints, at } from "./AC04Primitives";
import { AC04_BODY_FONT, AC04_COMMAND_FONT, AC04_NUMBER_FONT, AC04Color } from "./AC04Theme";

/** The special weapon every AC04 sortie carries (CombatService equips the salvo for AC04 sorties). */
const SPECIAL = SpecialWeapons.Get("salvo");

/**
 * Original plan-view schematic drawn from rectangles: a generic jet outline, not a model of the selected
 * typography. Shown because no client-side preview model exists before a sortie loads.
 */
function Schematic({ width, height }: { width: number; height: number }) {
	const s = math.min(width, height) * 0.8;
	const cx = width / 2, cy = height / 2;
	const part = (key: string, x: number, y: number, w: number, h: number, rotation = 0) => (
		<frame key={key} AnchorPoint={new Vector2(0.5, 0.5)} BackgroundTransparency={1} Rotation={rotation} Position={UDim2.fromOffset(cx + x * s, cy + y * s)} Size={UDim2.fromOffset(w * s, h * s)}>
			<uistroke Color={AC04Color.Ink} Transparency={0.35} Thickness={1} />
		</frame>
	);
	return (
		<frame BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
			{part("Fuselage", 0, 0, 0.09, 0.78)}
			{part("WingL", -0.17, 0.06, 0.34, 0.1, -18)}
			{part("WingR", 0.17, 0.06, 0.34, 0.1, 18)}
			{part("TailL", -0.08, 0.34, 0.14, 0.05, -12)}
			{part("TailR", 0.08, 0.34, 0.14, 0.05, 12)}
			{part("Canopy", 0, -0.22, 0.04, 0.1)}
		</frame>
	);
}

export interface AC04AircraftSelectProps {
	size: Vector2; input: AC04InputMode;
	slot: AC04Slot; selected: string; purpose: AC04AircraftPurpose; busy: boolean;
	onPreview: (id: string) => void;
	onConfirm: () => void;
	onBack: () => void;
	onConfirmSound: () => void;
}

/** Aircraft choice with honest loadout data. Locked aircraft are listed with their unlock rule and cannot be confirmed. */
export function AC04AircraftSelect(props: AC04AircraftSelectProps) {
	const layout = ac04AircraftLayout(props.size.X, props.size.Y, props.input);
	const rows = ac04AircraftRows(props.slot);
	const available = rows.filter((row) => row.available);
	const index = rows.findIndex((row) => row.spec.id === props.selected);
	const current = rows[math.max(0, index)];
	const position = available.findIndex((row) => row.spec.id === props.selected) + 1;
	const canConfirm = !props.busy && current.available;
	const cycle = (delta: number) => { if (!props.busy) props.onPreview(ac04CycleAircraft(rows, props.selected, delta)); };
	useAC04MenuKeys(true, (intent) => {
		if (intent === "left" || intent === "up") cycle(-1);
		else if (intent === "right" || intent === "down") cycle(1);
		else if (intent === "confirm" && canConfirm) { props.onConfirmSound(); props.onConfirm(); }
		else if (intent === "back") { props.onConfirmSound(); props.onBack(); }
	});
	const typography = layout.typography;
	const visible = math.max(1, math.floor(layout.roster.height / layout.rowPitch));
	const top = ac04ScrollTop(math.max(0, index), rows.size(), visible, 0);
	const commands: AC04Command[] = [
		{ id: "back", label: "BACK", enabled: !props.busy },
		{ id: "prev", label: "◀", enabled: !props.busy && available.size() > 1 },
		{ id: "next", label: "▶", enabled: !props.busy && available.size() > 1 },
		{ id: "confirm", label: "CONFIRM", enabled: canConfirm },
	];
	const rosterRows: React.Element[] = [];
	for (let i = top; i < math.min(rows.size(), top + visible); i++) {
		const row = rows[i], selected = row.spec.id === props.selected;
		rosterRows.push(
			<textbutton key={row.spec.id} AutoButtonColor={false} Selectable={false} Active={row.available && !props.busy} BackgroundColor3={AC04Color.Ink} BackgroundTransparency={selected ? 0.82 : 1} BorderSizePixel={0} Text="" Position={UDim2.fromOffset(0, (i - top) * layout.rowPitch)} Size={new UDim2(1, 0, 0, layout.rowPitch)}
				Event={{ Activated: () => { if (row.available && !props.busy) props.onPreview(row.spec.id); } }}>
				<frame BackgroundColor3={AC04Color.Focus} BorderSizePixel={0} Visible={selected} Size={new UDim2(0, 3, 1, -8)} Position={UDim2.fromOffset(0, 4)} />
				<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={row.spec.id} TextColor3={row.available ? (selected ? AC04Color.Focus : AC04Color.Ink) : AC04Color.Disabled} TextSize={typography.small} TextXAlignment={Enum.TextXAlignment.Left} Position={UDim2.fromOffset(10, 0)} Size={new UDim2(1, -60, 1, 0)} />
				{!row.available && <textlabel BackgroundTransparency={1} FontFace={AC04_NUMBER_FONT} Text="LOCKED" TextColor3={AC04Color.Disabled} TextSize={math.max(10, typography.small - 2)} TextXAlignment={Enum.TextXAlignment.Right} Position={new UDim2(1, -56, 0, 0)} Size={new UDim2(0, 52, 1, 0)} />}
			</textbutton>,
		);
	}
	return (
		<frame BackgroundColor3={AC04Color.Base} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)}>
			<AC04NavHints rect={layout.hints} input={props.input} sideways={true} textSize={typography.small} />
			<frame BackgroundTransparency={1} {...at(layout.name)}>
				<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={current.spec.id} TextColor3={AC04Color.White} TextSize={typography.title} TextXAlignment={Enum.TextXAlignment.Left} Size={new UDim2(1, 0, 0, typography.title + 4)} />
				<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={current.available ? `AVAILABLE ${ac04Pad(position, 2)} / ${ac04Pad(available.size(), 2)}` : "LOCKED"} TextColor3={AC04Color.Muted} TextSize={typography.small} TextXAlignment={Enum.TextXAlignment.Left} Position={UDim2.fromOffset(0, typography.title + 6)} Size={new UDim2(1, 0, 0, typography.small + 4)} />
			</frame>
			<frame BackgroundTransparency={1} ClipsDescendants={true} {...at(layout.roster)}>{rosterRows}</frame>
			<frame BackgroundColor3={AC04Color.Map} BackgroundTransparency={0.2} BorderSizePixel={0} {...at(layout.preview)}>
				<uistroke Color={AC04Color.Ink} Transparency={0.4} Thickness={1} />
				<Schematic width={layout.preview.width} height={layout.preview.height} />
				<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text={current.spec.id} TextColor3={AC04Color.Ink} TextTransparency={0.6} TextSize={math.floor(typography.title * 1.6)} AnchorPoint={new Vector2(1, 1)} Position={new UDim2(1, -10, 1, -6)} Size={new UDim2(1, -20, 0, math.floor(typography.title * 1.6) + 4)} TextXAlignment={Enum.TextXAlignment.Right} />
			</frame>
			<frame BackgroundColor3={AC04Color.Base} BackgroundTransparency={0.25} BorderSizePixel={0} {...at(layout.equipment)}>
				<uistroke Color={AC04Color.Ink} Transparency={0.3} Thickness={1} />
				<uipadding PaddingLeft={new UDim(0, 8)} PaddingTop={new UDim(0, 6)} />
				<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 4)} FillDirection={layout.form === "narrow" ? Enum.FillDirection.Horizontal : Enum.FillDirection.Vertical} />
				<AC04Field label="GUN" value={ac04Pad(current.spec.gun, 4)} labelSize={typography.small} valueSize={typography.body} width={layout.form === "narrow" ? math.floor((layout.equipment.width - 16) / 3) : layout.equipment.width - 16} order={1} numeric={true} />
				<AC04Field label="MSL" value={`*${ac04Pad(current.spec.missiles, 3)}`} labelSize={typography.small} valueSize={typography.body} width={layout.form === "narrow" ? math.floor((layout.equipment.width - 16) / 3) : layout.equipment.width - 16} order={2} numeric={true} />
				<AC04Field label="SP.W" value={`${SPECIAL.short} ×${SPECIAL.charges}`} labelSize={typography.small} valueSize={typography.body} width={layout.form === "narrow" ? math.floor((layout.equipment.width - 16) / 3) : layout.equipment.width - 16} order={3} numeric={true} />
			</frame>
			<textlabel BackgroundTransparency={1} FontFace={AC04_BODY_FONT} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top} TextSize={typography.body} TextColor3={current.available ? AC04Color.White : AC04Color.Warning} {...at(layout.description)}
				Text={current.available
					? `${SPECIAL.name}: ${SPECIAL.description} Gun and missile loads come from the campaign aircraft catalogue.`
					: `${current.lockedReason ?? "Not available"}. Locked aircraft cannot be flown.`} />
			<AC04CommandBar rect={layout.commands} commands={commands} focus={3} textSize={typography.small + 1}
				onActivate={(i) => { if (i === 0) props.onBack(); else if (i === 1) cycle(-1); else if (i === 2) cycle(1); else if (canConfirm) props.onConfirm(); }} />
		</frame>
	);
}
