import React, { useEffect, useRef, useState } from "@rbxts/react";
import { Difficulty, type DifficultyKind } from "../../shared/Difficulty";
import { GameConfig } from "../../shared/GameConfig";
import { MissionCatalog, MISSION_COUNT } from "../../shared/MissionCatalog";
import type { MissionRank } from "../../shared/MissionScore";
import { targetScoreLines } from "../../shared/OutcomePoints";
import type { TargetScoreSnapshot } from "../../shared/TargetScore";
import type { MenuLayout } from "../../shared/UILayout";
import { C } from "../Theme";
import { FooterButtons, Label } from "./Primitives";
import { formatTime, panelPosition } from "./UIFormat";

interface OutcomeState {
	targetScore?: TargetScoreSnapshot;
	won: boolean;
	missionId: number;
	airKills: number;
	optionalKills: number;
	groundKills: number;
	elapsed: number;
	par: number;
	completedPhases: number;
	missilesFired: number;
	missileHits: number;
	damageTaken: number;
	lowestHealth: number;
	evades: number;
	score: number;
	rank: MissionRank;
	newBestScore: boolean;
	newBestRank: boolean;
	bestScore?: number;
	bestRank?: MissionRank;
	reason?: string;
	/** Level the sortie was flown on, when the server said. */
	difficulty?: DifficultyKind;
	saveText: string;
	saveColor: Color3;
}

const RANK_COLORS: { [rank: string]: Color3 } = { S: C.AccentHot, A: C.Accent, B: C.Ivory, C: C.Muted, D: C.Danger };
/** Seconds between debrief rows appearing. */
const DEBRIEF_ROW_STEP = 0.07;

/** Readable failure cause for the debrief. */
function failureCause(reason?: string): string {
	if (reason === "crash_water") return "Your aircraft crashed into the water.";
	if (reason === "crash_terrain") return "Your aircraft crashed into terrain or scenery.";
	if (reason === "timeout") return `The ${math.floor(GameConfig.Campaign.MissionTimeLimit / 60)}-minute operation window closed.`;
	if (reason === "escaped") return "The courier got away.";
	if (reason === "internal_error") return "The sortie was stopped by a server error. Fly it again from the campaign menu.";
	if (reason === "protected_lost") return "The protected vehicle or site was lost.";
	if (reason === "destroyed") return "Your aircraft was shot down.";
	if (reason === "not_recorded") return "The server could not record this sortie. Fly it again from the campaign menu.";
	return "The sortie ended before the objective was complete.";
}

function formatScore(value: number): string {
	const digits = tostring(math.max(0, math.floor(value)));
	let result = "";
	for (let index = digits.size(); index >= 1; index -= 3) {
		const chunk = digits.sub(math.max(1, index - 2), index);
		result = result === "" ? chunk : `${chunk},${result}`;
	}
	return result;
}

interface DebriefLine {
	key: string;
	label: string;
	value?: string;
	color?: Color3;
	valueColor?: Color3;
}

/** One debrief row: a mono label with an optional right-aligned value, hidden until its reveal step. */
function DebriefRow({ line, order, shown, compact }: { line: DebriefLine; order: number; shown: boolean; compact: boolean }) {
	const height = compact ? 18 : 22;
	const textSize = compact ? 11 : 13;
	const transparency = shown ? 0 : 1;
	return (
		<frame key={line.key} BackgroundTransparency={1} LayoutOrder={order} Size={new UDim2(1, -8, 0, height)}>
			<textlabel
				key="Label" BackgroundTransparency={1} Size={new UDim2(line.value !== undefined ? 0.62 : 1, 0, 1, 0)}
				Font={Enum.Font.GothamMedium} Text={line.label} TextColor3={line.color ?? C.Muted} TextSize={textSize}
				TextTransparency={transparency} TextXAlignment={Enum.TextXAlignment.Left} TextTruncate={Enum.TextTruncate.AtEnd}
			/>
			{line.value !== undefined && (
				<textlabel
					key="Value" BackgroundTransparency={1} AnchorPoint={new Vector2(1, 0)} Position={UDim2.fromScale(1, 0)} Size={new UDim2(0.38, 0, 1, 0)}
					Font={Enum.Font.RobotoMono} Text={line.value} TextColor3={line.valueColor ?? C.Ivory} TextSize={textSize}
					TextTransparency={transparency} TextXAlignment={Enum.TextXAlignment.Right}
				/>
			)}
		</frame>
	);
}

function OutcomeScreenImpl({
	visible,
	menu,
	outcome,
	busy,
	onRetry,
	onReturn,
	onNext,
}: {
	visible: boolean;
	menu: MenuLayout;
	outcome: OutcomeState;
	busy: boolean;
	onRetry: () => void;
	onReturn: () => void;
	onNext: () => void;
}) {
	const compact = menu.compact;
	const ultra = menu.panel.height < 260;
	const mission = MissionCatalog.Get(outcome.missionId);
	const retryText = busy ? "RESETTING SORTIE..." : outcome.won ? `REPLAY MISSION ${string.format("%02d",outcome.missionId)}` : "RETRY SORTIE";
	const campaignComplete = outcome.won && outcome.missionId === MISSION_COUNT;
	const rankColor = RANK_COLORS[outcome.rank] ?? C.Ivory;
	const newBest = outcome.newBestScore || outcome.newBestRank;
	const bestText = outcome.bestScore !== undefined ? `BEST ${outcome.bestRank ?? "-"} · ${formatScore(outcome.bestScore)}` : "";

	// Objective breakdown: phases before `completedPhases` are done; on a failure the next one is where it ended.
	const objectives: DebriefLine[] = MissionCatalog.ExpandedPhases(mission).map((phase, index) => {
		const done = outcome.won || index < outcome.completedPhases;
		const failedHere = !done && index === outcome.completedPhases;
		return {
			key: `Objective${index + 1}`,
			label: `${done ? "✓" : "✕"}  ${phase.label}`,
			color: done ? C.Accent : failedHere ? C.Danger : C.Faint,
		};
	});
	const accuracy = outcome.missilesFired > 0 ? math.floor((outcome.missileHits / outcome.missilesFired) * 100 + 0.5) : undefined;
	const stats: DebriefLine[] = [
		...targetScoreLines(outcome.targetScore),
		{ key: "StatAir", label: "AIR KILLS", value: outcome.optionalKills > 0 ? `${outcome.airKills}  (+${outcome.optionalKills} RAIDERS)` : `${outcome.airKills}` },
		{ key: "StatGround", label: "GROUND KILLS", value: `${outcome.groundKills}` },
		{ key: "StatTime", label: `TIME  ·  PAR ${formatTime(outcome.par)}`, value: formatTime(outcome.elapsed), valueColor: outcome.won && outcome.elapsed <= outcome.par ? C.Accent : C.Ivory },
		{ key: "StatMissiles", label: "MISSILES FIRED", value: `${outcome.missilesFired}` },
		{ key: "StatAccuracy", label: "HIT ACCURACY", value: accuracy !== undefined ? `${accuracy}%` : "--" },
		{ key: "StatHull", label: `LOWEST HULL  ·  DAMAGE ${math.floor(outcome.damageTaken)}`, value: `${math.floor(outcome.lowestHealth)}%`, valueColor: outcome.lowestHealth < 35 ? C.Orange : C.Ivory },
		{ key: "StatEvades", label: "EVADES USED", value: `${outcome.evades}` },
		...(outcome.difficulty !== undefined ? [{ key: "StatDifficulty", label: "DIFFICULTY", value: Difficulty.Get(outcome.difficulty).name, valueColor: outcome.difficulty === "ace" ? C.Orange : C.Ivory }] : []),
	];
	const rows = [...objectives, ...stats];

	// Short staggered reveal each time a result is shown.
	const [shown, setShown] = useState(0);
	const revealRef = useRef(0);
	useEffect(() => {
		const serial = ++revealRef.current;
		setShown(0);
		if (!visible) return;
		task.spawn(() => {
			for (let count = 1; count <= rows.size(); count++) {
				task.wait(DEBRIEF_ROW_STEP);
				if (revealRef.current !== serial) return;
				setShown(count);
			}
		});
		return () => { revealRef.current++; };
	}, [visible, outcome]);

	const story = outcome.won ? mission.debrief : `${failureCause(outcome.reason)} ${mission.failure}`;
	const headerSize = ultra ? 22 : compact ? 26 : 34;
	const rankSize = ultra ? 40 : compact ? 48 : 62;
	// Score sits between the 12px caption and the 14px best line, without overlapping either.
	const scoreHeight = math.min(rankSize * 0.48, rankSize - 26);
	return (
		<frame key="OutcomeScreen" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Visible={visible}>
			<frame key="VictoryPanel" BackgroundTransparency={1} {...panelPosition(menu)}>
				<scrollingframe key="OutcomeDetails" BackgroundTransparency={1} BorderSizePixel={0} Size={new UDim2(1,0,1,compact ? -50 : -56)} CanvasSize={UDim2.fromOffset(0,0)} AutomaticCanvasSize={Enum.AutomaticSize.Y} ScrollBarThickness={3} ScrollingDirection={Enum.ScrollingDirection.Y}>
					<uilistlayout Padding={new UDim(0,compact ? 4 : 6)} SortOrder={Enum.SortOrder.LayoutOrder}/>
					<frame key="Accent" LayoutOrder={1} BackgroundColor3={outcome.won ? C.Accent : C.Danger} BorderSizePixel={0} Size={UDim2.fromOffset(32, 2)} />
					<Label name="OutcomeEyebrow" layoutOrder={2} text={`MISSION ${string.format("%02d",outcome.missionId)}/${MISSION_COUNT} · ${mission.title}`} color={C.Orange} textSize={compact ? 10 : 11} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 14)} />
					<Label name="OutcomeTitle" layoutOrder={3} text={outcome.won ? "MISSION ACCOMPLISHED" : "MISSION FAILED"} color={outcome.won ? C.Ivory : C.Danger} textSize={headerSize} minTextSize={14} font={Enum.Font.GothamBlack} size={new UDim2(1, -8, 0, headerSize + 4)} />
					<frame key="RankBlock" LayoutOrder={4} BackgroundTransparency={1} Size={new UDim2(1, -8, 0, rankSize)}>
						<textlabel key="RankLetter" BackgroundTransparency={1} Size={UDim2.fromOffset(rankSize, rankSize)} Font={Enum.Font.GothamBlack} Text={outcome.rank} TextColor3={rankColor} TextSize={rankSize} TextXAlignment={Enum.TextXAlignment.Left} />
						<textlabel key="RankCaption" BackgroundTransparency={1} Position={UDim2.fromOffset(rankSize + 6, 0)} Size={new UDim2(1, -rankSize - 6, 0, 12)} Font={Enum.Font.GothamBold} Text={outcome.targetScore ? "RANK  ·  POINTS" : "RANK  ·  SCORE"} TextColor3={C.Faint} TextSize={10} TextXAlignment={Enum.TextXAlignment.Left} />
						<textlabel key="ScoreValue" BackgroundTransparency={1} Position={UDim2.fromOffset(rankSize + 6, 12)} Size={new UDim2(1, -rankSize - 6, 0, scoreHeight)} Font={Enum.Font.GothamBlack} Text={formatScore(outcome.score)} TextColor3={C.Ivory} TextSize={math.floor(scoreHeight * 0.96)} TextXAlignment={Enum.TextXAlignment.Left} />
						<textlabel key="BestLine" BackgroundTransparency={1} AnchorPoint={new Vector2(0, 1)} Position={new UDim2(0, rankSize + 6, 1, 0)} Size={new UDim2(1, -rankSize - 6, 0, 14)} Font={Enum.Font.GothamBold} Text={newBest ? (outcome.newBestRank ? "NEW BEST RANK" : "NEW BEST SCORE") : bestText} TextColor3={newBest ? C.Orange : C.Muted} TextSize={compact ? 10 : 11} TextXAlignment={Enum.TextXAlignment.Left} />
					</frame>
					<Label name="OutcomeGoal" layoutOrder={5} text={`OBJECTIVE · ${string.upper(mission.primary)}`} color={C.Faint} textSize={compact ? 10 : 11} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} />
					<Label name="OutcomeSummary" layoutOrder={6} text={story} color={outcome.won ? C.Ivory : C.Muted} textSize={compact ? 12 : 14} size={new UDim2(1, -8, 0, 0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} textYAlignment={Enum.TextYAlignment.Top} />
					<Label name="ObjectivesHeading" layoutOrder={7} text="OBJECTIVES" color={C.Orange} textSize={10} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 14)} />
					{objectives.map((line, index) => <DebriefRow key={line.key} line={line} order={10 + index} shown={index < shown} compact={compact} />)}
					<Label name="StatsHeading" layoutOrder={40} text={outcome.targetScore ? "TARGETS · COUNT / POINTS" : "FLIGHT RECORD"} color={C.Orange} textSize={10} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 14)} />
					{stats.map((line, index) => <DebriefRow key={line.key} line={line} order={41 + index} shown={objectives.size() + index < shown} compact={compact} />)}
					<Label name="SaveStatus" layoutOrder={60} text={outcome.saveText} visible={outcome.saveText !== ""} color={outcome.saveColor} textSize={compact ? 10 : 11} font={Enum.Font.GothamBold} size={new UDim2(1, -8, 0, 0)} automaticSize={Enum.AutomaticSize.Y} textWrapped={true} />
				</scrollingframe>
				{outcome.won ? !campaignComplete ? (
					<FooterButtons compact={compact} primaryName="Mission1NextMissionButton" primaryText={`NEXT: MISSION ${string.format("%02d",outcome.missionId+1)}`} secondaryName="ReturnToMenuButton" secondaryText="MAIN MENU" busy={busy} onPrimary={onNext} onSecondary={onReturn} />
				) : (
					<FooterButtons compact={compact} primaryName="ReturnToMenuButton" primaryText="RETURN TO MENU" secondaryName="RetryButton" secondaryText={retryText} busy={busy} onPrimary={onReturn} onSecondary={onRetry} />
				) : (
					<FooterButtons compact={compact} primaryName="RetryButton" primaryText={retryText} secondaryName="ReturnToMenuButton" secondaryText="MAIN MENU" busy={busy} onPrimary={onRetry} onSecondary={onReturn} />
				)}
			</frame>
		</frame>
	);
}
const OutcomeScreen = React.memo(OutcomeScreenImpl);

export { OutcomeScreen };
export type { OutcomeState };
