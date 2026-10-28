import React from "@rbxts/react";
import { MissionCatalog } from "../shared/MissionCatalog";

const INK = Color3.fromRGB(6, 13, 22);
const IVORY = Color3.fromRGB(242, 238, 226);
const MUTED = Color3.fromRGB(152, 168, 176);
const ACCENT = Color3.fromRGB(64, 224, 206);
const ORANGE = Color3.fromRGB(255, 150, 84);

export interface LoadingScreenProps {
	visible: boolean;
	missionId: number;
	/** 0..1 replication/preload progress. */
	progress: number;
	viewport: Vector2;
}

// Full-screen opaque overlay shown between "Loading" and "Started". It hides
// meshes popping in while the world replicates. Everything sits in a centred
// column so it survives 320x240 compact phones and notch insets (44 px safe).
function LoadingScreenComponent({ visible, missionId, progress, viewport }: LoadingScreenProps) {
	const compact = viewport.Y < 300;
	const title = MissionCatalog.IsValidId(missionId) ? MissionCatalog.Get(missionId).title : "SORTIE";
	const columnWidth = math.min(360, math.max(200, viewport.X - 88));
	const barWidth = math.min(240, columnWidth);
	const percent = math.clamp(math.floor(progress * 100 + 0.5), 0, 100);
	return (
		<frame key="LoadingScreen" BackgroundColor3={INK} BackgroundTransparency={0} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} Visible={visible} ZIndex={30}>
			<frame key="Column" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundTransparency={1} Position={UDim2.fromScale(0.5, 0.5)} Size={UDim2.fromOffset(columnWidth, compact ? 120 : 160)} ZIndex={31}>
				<uilistlayout Padding={new UDim(0, compact ? 6 : 10)} SortOrder={Enum.SortOrder.LayoutOrder} HorizontalAlignment={Enum.HorizontalAlignment.Center} VerticalAlignment={Enum.VerticalAlignment.Center} />
				<textlabel
					key="Eyebrow"
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					LayoutOrder={1}
					Size={new UDim2(1, 0, 0, 14)}
					Text={`MISSION ${string.format("%02d", missionId)}`}
					TextColor3={ORANGE}
					TextSize={compact ? 10 : 11}
					ZIndex={31}
				/>
				<textlabel
					key="Title"
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBlack}
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, compact ? 26 : 36)}
					Text={title}
					TextColor3={IVORY}
					TextScaled={true}
					TextWrapped={true}
					ZIndex={31}
				>
					<uitextsizeconstraint MaxTextSize={compact ? 22 : 30} MinTextSize={14} />
				</textlabel>
				<frame key="BarTrack" BackgroundColor3={Color3.fromRGB(26, 54, 72)} BorderSizePixel={0} LayoutOrder={3} Size={UDim2.fromOffset(barWidth, 4)} ZIndex={31}>
					<frame key="BarFill" BackgroundColor3={ACCENT} BorderSizePixel={0} Size={new UDim2(progress, 0, 1, 0)} ZIndex={32} />
				</frame>
				<textlabel
					key="Status"
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					LayoutOrder={4}
					Size={new UDim2(1, 0, 0, 16)}
					Text={progress >= 1 ? "AWAITING TOWER CLEARANCE" : `PREPARING SORTIE  ·  ${percent}%`}
					TextColor3={MUTED}
					TextSize={compact ? 10 : 12}
					ZIndex={31}
				/>
			</frame>
		</frame>
	);
}

export const LoadingScreen = React.memo(LoadingScreenComponent);
