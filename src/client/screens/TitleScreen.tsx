import React from "@rbxts/react";
import { MISSION_COUNT } from "../../shared/MissionCatalog";
import type { MenuLayout } from "../../shared/UILayout";
import { C } from "../Theme";
import { ActionButton, Label } from "./Primitives";

function TitleScreenImpl({ visible, menu, onCampaign, onSettings }: { visible: boolean; menu: MenuLayout; onCampaign: () => void; onSettings: () => void }) {
	const compact = menu.compact;
	const tiny = menu.panel.height < 220;
	// The hero copy reads best as a short column, even when the panel is wide.
	const contentWidth = math.min(menu.panel.width, 420);
	return (
		<frame key="TitleScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="TitleContent" BackgroundTransparency={1} Position={UDim2.fromOffset(menu.panel.x, menu.panel.y)} Size={UDim2.fromOffset(contentWidth, menu.panel.height)}>
				<uilistlayout
					Padding={new UDim(0, tiny ? 4 : 8)}
					SortOrder={Enum.SortOrder.LayoutOrder}
					VerticalAlignment={menu.mode === "sheet" ? Enum.VerticalAlignment.Bottom : Enum.VerticalAlignment.Center}
				/>
				<frame key="Accent" BackgroundColor3={C.Accent} BorderSizePixel={0} LayoutOrder={1} Size={UDim2.fromOffset(32, 2)} />
				<textlabel
					key="Title"
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBlack}
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, tiny ? 36 : compact ? 52 : 76)}
					Text="SKYBREAK"
					TextColor3={C.Ivory}
					TextScaled={true}
					TextXAlignment={Enum.TextXAlignment.Left}
				>
					<uitextsizeconstraint MaxTextSize={compact ? 48 : 70} MinTextSize={28} />
				</textlabel>
				<Label name="Subtitle" text="BROKEN RELAY" color={C.Orange} textSize={compact ? 11 : 13} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, 16)} layoutOrder={3} />
				<Label
					name="Blurb"
					visible={!tiny}
					text={`Follow a missing mentor’s recordings through ${MISSION_COUNT} sorties. Uncover the coup. Bring the coast home.`}
					color={C.Muted}
					textSize={compact ? 13 : 15}
					size={new UDim2(1, 0, 0, 0)}
					automaticSize={Enum.AutomaticSize.Y}
					textWrapped={true}
					layoutOrder={4}
				/>
				<Label name="TitleMeta" visible={!tiny} text={`3 ACTS  ·  ${MISSION_COUNT} SORTIES  ·  4 FLIGHT RECORDS`} color={C.Faint} textSize={10} font={Enum.Font.GothamBold} size={new UDim2(1, 0, 0, 14)} layoutOrder={5} />
				<frame key="Spacer" BackgroundTransparency={1} LayoutOrder={6} Size={UDim2.fromOffset(1, tiny ? 2 : compact ? 6 : 14)} />
				<ActionButton name="CampaignButton" text="CAMPAIGN  ›" primary={true} layoutOrder={7} size={UDim2.fromOffset(math.min(260, contentWidth), tiny ? 44 : compact ? 48 : 52)} textSize={15} onActivated={onCampaign} />
				<ActionButton name="SettingsButton" text="SETTINGS" layoutOrder={8} size={UDim2.fromOffset(math.min(260, contentWidth), 44)} textSize={12} onActivated={onSettings} />
			</frame>
		</frame>
	);
}
const TitleScreen = React.memo(TitleScreenImpl);

export { TitleScreen };
