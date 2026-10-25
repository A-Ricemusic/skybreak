import React, { useState } from "@rbxts/react";
import { SpecialKind, SpecialWeapons } from "../shared/SpecialWeapons";

// Briefing-screen row for the second weapon slot: tap to cycle through the
// specials, one line of description underneath. Self-contained so GameUI only
// has to mount it; the chosen kind travels with the StartMission request.
const INK = Color3.fromRGB(6, 13, 22);
const PANEL = Color3.fromRGB(14, 30, 44);
const PANEL_HOT = Color3.fromRGB(26, 54, 72);
const IVORY = Color3.fromRGB(242, 238, 226);
const MUTED = Color3.fromRGB(152, 168, 176);
const ACCENT = Color3.fromRGB(64, 224, 206);

export function LoadoutPicker({ kind, enabled, layoutOrder, compact, onChange }: {
	kind: SpecialKind;
	enabled: boolean;
	layoutOrder: number;
	compact: boolean;
	onChange: (kind: SpecialKind) => void;
}) {
	const [hot, setHot] = useState(false);
	const definition = SpecialWeapons.Get(kind);
	const index = SpecialWeapons.Order.indexOf(kind) + 1;
	const buttonHeight = compact ? 40 : 44;
	return (
		<frame key="LoadoutPicker" AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} LayoutOrder={layoutOrder} Size={new UDim2(1, -12, 0, 0)}>
			<textbutton
				key="SpecialWeaponButton"
				Active={enabled}
				AutoButtonColor={false}
				BackgroundColor3={hot ? PANEL_HOT : PANEL}
				BackgroundTransparency={enabled ? (hot ? 0.05 : 0.22) : 0.6}
				BorderSizePixel={0}
				Font={Enum.Font.GothamBold}
				Size={new UDim2(1, 0, 0, buttonHeight)}
				Text={`SPECIAL ${index}/${SpecialWeapons.Order.size()} · ${definition.name}  ›`}
				TextColor3={IVORY}
				TextScaled={true}
				TextTransparency={enabled ? 0 : 0.45}
				TextXAlignment={Enum.TextXAlignment.Left}
				Event={{
					MouseEnter: () => setHot(true),
					MouseLeave: () => setHot(false),
					SelectionGained: () => setHot(true),
					SelectionLost: () => setHot(false),
					Activated: () => { if (enabled) onChange(SpecialWeapons.Next(kind)); },
				}}
			>
				<uicorner CornerRadius={new UDim(0, 6)} />
				<uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={hot ? IVORY : ACCENT} Thickness={hot ? 2 : 1} Transparency={hot ? 0.1 : 0.5} />
				<uipadding PaddingLeft={new UDim(0, 14)} PaddingRight={new UDim(0, 14)} PaddingTop={new UDim(0, 12)} PaddingBottom={new UDim(0, 12)} />
				<uitextsizeconstraint MaxTextSize={13} MinTextSize={8} />
			</textbutton>
			<textlabel
				key="SpecialWeaponDescription"
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
				Font={Enum.Font.Gotham}
				Position={UDim2.fromOffset(0, buttonHeight + 4)}
				Size={new UDim2(1, 0, 0, 0)}
				Text={`${definition.description} ${definition.charges} charge${definition.charges === 1 ? "" : "s"}${definition.rechargeSeconds !== undefined ? ", recharging" : ""}.`}
				TextColor3={MUTED}
				TextSize={12}
				TextStrokeColor3={INK}
				TextStrokeTransparency={1}
				TextWrapped={true}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextYAlignment={Enum.TextYAlignment.Top}
			/>
		</frame>
	);
}
