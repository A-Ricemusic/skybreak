import React from "@rbxts/react";
import { SpecialKind, SpecialWeapons } from "../shared/SpecialWeapons";
import { SELECTION_NONE, useHighlight } from "./Highlight";
import { C } from "./Theme";

// Briefing-screen block for the second weapon slot: a section heading, one
// 44px row that cycles through the specials, and a wrapping description.
// Self-contained so GameUI only has to mount it; the chosen kind travels with
// the StartMission request.
export function LoadoutPicker({ kind, enabled, layoutOrder, onChange }: {
	kind: SpecialKind;
	enabled: boolean;
	layoutOrder: number;
	onChange: (kind: SpecialKind) => void;
}) {
	const { hot, events, clearHover } = useHighlight(enabled);
	const definition = SpecialWeapons.Get(kind);
	const index = SpecialWeapons.Order.indexOf(kind) + 1;
	const count = SpecialWeapons.Order.size();
	return (
		<frame key="LoadoutPicker" AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} LayoutOrder={layoutOrder} Size={new UDim2(1, -12, 0, 0)}>
			<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
			<textlabel
				key="LoadoutHeading"
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 12)}
				Text="SPECIAL WEAPON"
				TextColor3={C.Orange}
				TextSize={10}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>
			<textbutton
				key="SpecialWeaponButton"
				Active={enabled}
				Selectable={enabled}
				LayoutOrder={2}
				AutoButtonColor={false}
				BackgroundColor3={hot ? C.PanelHot : C.Panel}
				BackgroundTransparency={enabled ? (hot ? 0.05 : 0.3) : 0.6}
				BorderSizePixel={0}
				Size={new UDim2(1, 0, 0, 44)}
				SelectionImageObject={SELECTION_NONE}
				Text=""
				Event={{
					...events,
					Activated: () => {
						clearHover();
						if (enabled) onChange(SpecialWeapons.Next(kind));
					},
				}}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={hot ? C.Ivory : C.Accent} Thickness={hot ? 2 : 1} Transparency={hot ? 0.1 : 0.55} />
				<textlabel
					key="Short"
					BackgroundTransparency={1}
					Font={Enum.Font.RobotoMono}
					Position={UDim2.fromOffset(12, 0)}
					Size={new UDim2(0, 44, 1, 0)}
					Text={definition.short}
					TextColor3={C.Accent}
					TextSize={12}
					TextTransparency={enabled ? 0 : 0.45}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
				<textlabel
					key="Name"
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					Position={UDim2.fromOffset(60, 0)}
					Size={new UDim2(1, -150, 1, 0)}
					Text={definition.name}
					TextColor3={C.Ivory}
					TextSize={13}
					TextTransparency={enabled ? 0 : 0.45}
					TextTruncate={Enum.TextTruncate.AtEnd}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
				<textlabel
					key="Cycle"
					AnchorPoint={new Vector2(1, 0)}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					Position={new UDim2(1, -12, 0, 0)}
					Size={new UDim2(0, 80, 1, 0)}
					Text={`${index}/${count}  ›`}
					TextColor3={hot ? C.Ivory : C.Muted}
					TextSize={12}
					TextTransparency={enabled ? 0 : 0.45}
					TextXAlignment={Enum.TextXAlignment.Right}
				/>
			</textbutton>
			<textlabel
				key="SpecialWeaponDescription"
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
				Font={Enum.Font.Gotham}
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 0)}
				Text={`${definition.description} ${definition.charges} charge${definition.charges === 1 ? "" : "s"}${definition.rechargeSeconds !== undefined ? ", recharging" : ""}.`}
				TextColor3={C.Muted}
				TextSize={12}
				TextWrapped={true}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextYAlignment={Enum.TextYAlignment.Top}
			/>
		</frame>
	);
}
