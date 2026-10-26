import React, { useState } from "@rbxts/react";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { C } from "./Theme";

// Briefing-screen block for the difficulty: a section heading, one 44px row of
// three touch-sized segments and a wrapping description of the chosen level.
// Self-contained like LoadoutPicker; the chosen kind travels with StartMission.

function Segment({ kind, selected, enabled, first, last, onChange }: {
	kind: DifficultyKind;
	selected: boolean;
	enabled: boolean;
	first: boolean;
	last: boolean;
	onChange: (kind: DifficultyKind) => void;
}) {
	const [hot, setHot] = useState(false);
	const definition = Difficulty.Get(kind);
	const accent = kind === "ace" ? C.Orange : C.Accent;
	return (
		<textbutton
			key={`Difficulty${definition.name}Button`}
			Active={enabled}
			Selectable={enabled}
			LayoutOrder={Difficulty.Order.indexOf(kind)}
			AutoButtonColor={false}
			BackgroundColor3={selected ? accent : hot ? C.PanelHot : C.Panel}
			BackgroundTransparency={!enabled ? 0.6 : selected ? 0.1 : hot ? 0.05 : 0.3}
			BorderSizePixel={0}
			Size={new UDim2(1 / 3, first || last ? -1 : -2, 1, 0)}
			Text=""
			Event={{
				MouseEnter: () => setHot(true),
				MouseLeave: () => setHot(false),
				SelectionGained: () => setHot(true),
				SelectionLost: () => setHot(false),
				Activated: () => { if (enabled) onChange(kind); },
			}}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<uistroke ApplyStrokeMode={Enum.ApplyStrokeMode.Border} Color={selected ? accent : hot ? C.Ivory : C.Accent} Thickness={selected || hot ? 2 : 1} Transparency={selected ? 0 : hot ? 0.1 : 0.55} />
			<textlabel
				key="Name"
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				Size={UDim2.fromScale(1, 1)}
				Text={definition.name}
				TextColor3={selected ? C.Ink : C.Ivory}
				TextSize={13}
				TextTransparency={enabled ? 0 : 0.45}
			/>
		</textbutton>
	);
}

export function DifficultyPicker({ kind, enabled, layoutOrder, onChange }: {
	kind: DifficultyKind;
	enabled: boolean;
	layoutOrder: number;
	onChange: (kind: DifficultyKind) => void;
}) {
	const definition = Difficulty.Get(kind);
	const count = Difficulty.Order.size();
	return (
		<frame key="DifficultyPicker" AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} LayoutOrder={layoutOrder} Size={new UDim2(1, -12, 0, 0)}>
			<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
			<textlabel
				key="DifficultyHeading"
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 12)}
				Text="DIFFICULTY"
				TextColor3={C.Orange}
				TextSize={10}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>
			<frame key="DifficultySegments" BackgroundTransparency={1} LayoutOrder={2} Size={new UDim2(1, 0, 0, 44)}>
				<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 3)} SortOrder={Enum.SortOrder.LayoutOrder} />
				{Difficulty.Order.map((level, index) => (
					<Segment key={level} kind={level} selected={level === kind} enabled={enabled} first={index === 0} last={index === count - 1} onChange={onChange} />
				))}
			</frame>
			<textlabel
				key="DifficultyDescription"
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
				Font={Enum.Font.Gotham}
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 0)}
				Text={definition.description}
				TextColor3={C.Muted}
				TextSize={12}
				TextWrapped={true}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextYAlignment={Enum.TextYAlignment.Top}
			/>
		</frame>
	);
}
