import React, { useBinding, useEffect, useMemo, useRef, useState } from "@rbxts/react";
import { TweenService } from "@rbxts/services";
import type { LaunchPhase } from "./LaunchLoading";
import {
	briefingExcerpt,
	excerptBudget,
	formatElapsed,
	getLoadingLayout,
	LOADING_SEGMENT_COUNT,
	LOADING_SEGMENTS,
	LoadingProgress,
	loadingStage,
	loadingTips,
	missionEyebrow,
	tipIndex,
	BRIEF_LINE_HEIGHT,
	HEADER_ROW_GAP,
} from "./LoadingScreenModel";
import { ACT_NAMES, ACT_NUMERALS, environmentName, MissionCatalog, REGION_NAMES } from "./MissionCatalog";
import type { InputMode } from "./UILayout";
import { createJetRig, Fader, whenJetTemplate, type JetRig } from "./LoadingRig";
import { C, HEX, HUD_FONT } from "./Theme";

export interface LoadingScreenProps {
	visible: boolean;
	/** True when the screen is leaving because the mission started (fill completes, then fades into flight). */
	launched: boolean;
	missionId: number;
	/** 0..1 replication/preload progress. */
	progress: number;
	/** Safe-area size (the same CoreUISafeInsets root the menus use). */
	viewport: Vector2;
	phase: LaunchPhase;
	buildFolder?: Instance;
	inputMode: InputMode;
	/** Comfort setting: false holds the jet, scan line and pulse still. */
	motion: boolean;
}

/** Above every SKYBREAK ScreenGui (menus 20, flight overlay 8). */
export const LOADING_DISPLAY_ORDER = 40;
const FADE_IN = 0.35;
const FADE_OUT = 0.5;
const FADE_FAIL = 0.25;
const FILL_TWEEN = new TweenInfo(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
const TICK = 0.2;

function hasRearm(missionId: number): boolean {
	if (!MissionCatalog.IsValidId(missionId)) return false;
	return MissionCatalog.ExpandedPhases(MissionCatalog.Get(missionId)).some((phase) => phase.rearm !== undefined);
}

function range(count: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < count; i++) out.push(i);
	return out;
}

type Binding<T> = React.Binding<T>;
/** Transparency for an element whose resting transparency is `base`, at fade `alpha`. */
const faded = (alpha: Binding<number>, base: number) => alpha.map((a) => 1 - (1 - base) * a);

function LoadText(props: {
	name: string;
	text: string | Binding<string>;
	rect: { x: number; y: number; width: number; height: number };
	size: number;
	color: Color3;
	alpha: Binding<number>;
	font?: Enum.Font;
	fontFace?: Font;
	align?: Enum.TextXAlignment;
	yAlign?: Enum.TextYAlignment;
	wrapped?: boolean;
	scaled?: boolean;
	rich?: boolean;
	base?: number;
	lineHeight?: number;
	zIndex?: number;
}) {
	return (
		<textlabel
			key={props.name}
			BackgroundTransparency={1}
			Font={props.fontFace ? undefined : props.font ?? Enum.Font.GothamBold}
			FontFace={props.fontFace}
			Position={UDim2.fromOffset(props.rect.x, props.rect.y)}
			Size={UDim2.fromOffset(props.rect.width, props.rect.height)}
			Text={props.text}
			TextColor3={props.color}
			TextSize={props.size}
			TextScaled={props.scaled === true}
			TextWrapped={props.wrapped === true || props.scaled === true}
			TextTruncate={Enum.TextTruncate.AtEnd}
			RichText={props.rich === true}
			LineHeight={props.lineHeight ?? 1}
			TextTransparency={faded(props.alpha, props.base ?? 0)}
			TextXAlignment={props.align ?? Enum.TextXAlignment.Left}
			TextYAlignment={props.yAlign ?? Enum.TextYAlignment.Center}
			ZIndex={props.zIndex ?? 2}
		>
			{props.scaled === true && <uitextsizeconstraint MaxTextSize={props.size} MinTextSize={math.min(props.size, 14)} />}
		</textlabel>
	);
}

/** Four L-shaped HUD corners framing the jet. */
function Brackets({ alpha }: { alpha: Binding<number> }) {
	const arm = 22, thick = 2;
	const corners: [string, number, number][] = [["TL", 0, 0], ["TR", 1, 0], ["BL", 0, 1], ["BR", 1, 1]];
	const transparency = faded(alpha, 0.35);
	return (
		<>
			{corners.map(([name, x, y]) => (
				<frame key={`Bracket${name}`} AnchorPoint={new Vector2(x, y)} BackgroundTransparency={1} Position={UDim2.fromScale(x, y)} Size={UDim2.fromOffset(arm, arm)} ZIndex={4}>
					<frame key="H" AnchorPoint={new Vector2(x, y)} BackgroundColor3={C.Accent} BackgroundTransparency={transparency} BorderSizePixel={0} Position={UDim2.fromScale(x, y)} Size={UDim2.fromOffset(arm, thick)} ZIndex={4} />
					<frame key="V" AnchorPoint={new Vector2(x, y)} BackgroundColor3={C.Accent} BackgroundTransparency={transparency} BorderSizePixel={0} Position={UDim2.fromScale(x, y)} Size={UDim2.fromOffset(thick, arm)} ZIndex={4} />
				</frame>
			))}
		</>
	);
}

// Full-bleed mission loading screen (D-200). Lives in shared only so the Jest place can mount it
// (the client container is isolated); only the client renders it. Two ScreenGuis: decoration covers the whole
// screen, behind the top bar and notches; all text sits in a CoreUISafeInsets layer.
function LoadingScreenComponent({ visible, launched, missionId, progress, viewport, phase, buildFolder, inputMode, motion }: LoadingScreenProps) {
	const [mounted, setMounted] = useState(visible);
	const [curtain, setCurtain] = useBinding(visible ? 1 : 0);
	const [alpha, setAlpha] = useBinding(0);
	const [elapsedText, setElapsedText] = useBinding("0:00");
	const [tipText, setTipText] = useBinding("");
	const [active, setActive] = useState(0);
	const [worldPhase, setWorldPhase] = useState<unknown>();
	const holderRef = useRef<Frame>();
	const fillRef = useRef<Frame>();
	const glintRef = useRef<Frame>();
	const rigRef = useRef<JetRig>();
	const model = useMemo(() => new LoadingProgress(), []);
	const live = useRef({ phase, progress, worldPhase, world: buildFolder !== undefined, launched, inputMode, missionId, motion, shownAt: os.clock() });
	live.current = { ...live.current, phase, progress, worldPhase, world: buildFolder !== undefined, launched, inputMode, missionId, motion };

	// Fades: the ink curtain covers instantly on launch; content eases in over it.
	const faders = useMemo(() => ({
		curtain: new Fader(visible ? 1 : 0, setCurtain),
		content: new Fader(0, (value) => { setAlpha(value); rigRef.current?.SetAlpha(value); }),
	}), []);
	useEffect(() => () => { faders.curtain.Destroy(); faders.content.Destroy(); }, []);

	const fillTween = useRef<Tween>();
	const setFill = (value: number, animate: boolean) => {
		const fill = fillRef.current;
		if (!fill) return;
		fillTween.current?.Cancel();
		fillTween.current?.Destroy();
		fillTween.current = undefined;
		if (!animate) { fill.Size = UDim2.fromScale(value, 1); return; }
		const tween = TweenService.Create(fill, FILL_TWEEN, { Size: UDim2.fromScale(value, 1) });
		fillTween.current = tween;
		tween.Play();
	};
	useEffect(() => () => { fillTween.current?.Cancel(); fillTween.current?.Destroy(); }, []);

	useEffect(() => {
		setWorldPhase(buildFolder?.GetAttribute("WorldBuildPhase"));
		const connection = buildFolder?.GetAttributeChangedSignal("WorldBuildPhase").Connect(() => setWorldPhase(buildFolder.GetAttribute("WorldBuildPhase")));
		return () => connection?.Disconnect();
	}, [buildFolder]);

	// Show/hide. A fresh show resets the fill; leaving into flight completes it first.
	const showing = useRef(false);
	const hideSerial = useRef(0);
	useEffect(() => {
		const serial = ++hideSerial.current;
		if (visible) {
			if (!showing.current) {
				showing.current = true;
				model.Reset();
				live.current.shownAt = os.clock();
				setActive(0);
				setElapsedText(formatElapsed(0));
				setFill(0, false);
				faders.content.Set(0);
			}
			faders.curtain.Set(1);
			setMounted(true);
			faders.content.To(1, FADE_IN);
			return;
		}
		if (!showing.current) return;
		showing.current = false;
		const finish = () => { if (hideSerial.current === serial) setMounted(false); };
		if (live.current.launched) {
			model.Complete();
			setActive(LOADING_SEGMENT_COUNT - 1);
			setFill(1, true);
			faders.content.To(0, FADE_OUT);
			faders.curtain.To(0, FADE_OUT, finish);
		} else {
			faders.content.To(0, FADE_FAIL);
			faders.curtain.To(0, FADE_FAIL, finish);
		}
	}, [visible]);

	// The jet: cloned from the replicated, already-approved Kestrel only while the screen is up.
	useEffect(() => {
		if (!mounted) return;
		const holder = holderRef.current;
		if (!holder) return;
		let rig: JetRig | undefined;
		const build = (template: Model | undefined) => {
			rig?.Destroy();
			rig = createJetRig(holder, template, live.current.motion);
			rig.SetAlpha(faders.content.Get());
			rigRef.current = rig;
		};
		let found = false;
		const stop = whenJetTemplate((template) => { found = true; build(template); });
		// Until the server's cinematic models replicate, the HUD frame stands alone.
		if (!found) build(undefined);
		return () => {
			stop();
			if (rigRef.current === rig) rigRef.current = undefined;
			rig?.Destroy();
		};
	}, [mounted]);

	// The active segment breathes (orange while queued): one ping-pong tween on a rig-owned child.
	const queued = phase === "queued";
	useEffect(() => {
		const holder = glintRef.current;
		if (!mounted || !holder) return;
		const pulse = new Instance("Frame");
		pulse.Name = "Pulse";
		pulse.BorderSizePixel = 0;
		pulse.BackgroundColor3 = queued ? C.Orange : C.AccentHot;
		pulse.BackgroundTransparency = 0.85;
		pulse.Size = UDim2.fromScale(1, 1);
		pulse.ZIndex = 4;
		pulse.Parent = holder;
		const tween = TweenService.Create(pulse, new TweenInfo(0.9, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { BackgroundTransparency: 0.35 });
		if (live.current.motion) tween.Play();
		return () => { tween.Cancel(); tween.Destroy(); pulse.Destroy(); };
	}, [mounted, queued]);

	// One slow loop drives the fill target, elapsed clock and tip rotation (no per-frame work).
	useEffect(() => {
		if (!mounted) return;
		let running = true;
		let lastSecond = -1, lastTip = -1, lastFill = -1;
		const tips = loadingTips(live.current.inputMode, { rearm: hasRearm(live.current.missionId) });
		let tipsMode = live.current.inputMode;
		let current = tips;
		const step = () => {
			const state = live.current;
			const now = os.clock();
			const elapsed = now - state.shownAt;
			if (showing.current) {
				const value = model.Update(loadingStage({ phase: state.phase, worldPhase: state.worldPhase, world: state.world, preload: state.progress }), now);
				if (value - lastFill > 0.0005) { lastFill = value; setFill(value, true); }
				setActive(model.ActiveSegment());
			}
			const second = math.floor(elapsed);
			if (second !== lastSecond) { lastSecond = second; setElapsedText(formatElapsed(elapsed)); }
			if (state.inputMode !== tipsMode) { tipsMode = state.inputMode; current = loadingTips(tipsMode, { rearm: hasRearm(state.missionId) }); lastTip = -1; }
			const index = tipIndex(current.size(), elapsed);
			if (index !== lastTip) { lastTip = index; setTipText(`<font color="${HEX.Accent}">TIP</font>   ${current[index]}`); }
		};
		step();
		const thread = task.spawn(() => {
			while (running) {
				task.wait(TICK);
				if (running) step();
			}
		});
		return () => { running = false; if (coroutine.status(thread) === "suspended") task.cancel(thread); };
	}, [mounted]);

	const layout = useMemo(() => getLoadingLayout(viewport.X, viewport.Y), [viewport]);
	const mission = MissionCatalog.IsValidId(missionId) ? MissionCatalog.Get(missionId) : undefined;
	const title = mission?.title ?? "SORTIE";
	const codename = mission ? string.upper(mission.codename) : "";
	const meta = mission ? `${REGION_NAMES[mission.region] ?? ""}  ·  ${environmentName(mission.environment)}` : "";
	const actLine = mission === undefined ? "" : missionId === 0 ? "TRAINING SORTIE" : `ACT ${ACT_NUMERALS[mission.act] ?? ""}  ·  ${ACT_NAMES[mission.act] ?? ""}`;
	const stage = loadingStage({ phase, worldPhase, world: buildFolder !== undefined, preload: progress });
	const statusWords = launched && !visible ? "Cleared for launch" : stage.words;
	const excerpt = useMemo(() => {
		if (!mission || !layout.brief || layout.excerptLines === 0) return "";
		return briefingExcerpt(mission.briefing, excerptBudget(layout.brief.width, layout.bodySize, layout.excerptLines));
	}, [mission, layout]);

	const header = layout.header;
	let y = header.y;
	const row = (height: number) => { const r = { x: header.x, y, width: header.width, height }; y += height + HEADER_ROW_GAP; return r; };
	const eyebrowRect = row(layout.eyebrowSize + 4);
	const titleRect = row(layout.titleSize + 6);
	const codenameRect = row(layout.codenameSize + 4);
	const metaRect = row(layout.metaSize + 4);

	const brief = layout.brief;
	const line = math.ceil(layout.bodySize * BRIEF_LINE_HEIGHT);
	const labelRow = layout.smallSize + 4;
	const band = layout.progress;
	const barTop = band.y + layout.labelsHeight;
	const statusTop = barTop + layout.barHeight + 6;
	const jet = layout.jet;
	const gridX = 16, gridY = 9;

	return (
		<>
			<screengui key="SkybreakLoadingBackdrop" DisplayOrder={LOADING_DISPLAY_ORDER} Enabled={mounted} IgnoreGuiInset={true} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.None} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
				<frame key="LoadingBackdrop" BackgroundColor3={C.Ink} BackgroundTransparency={curtain.map((a) => 1 - a)} BorderSizePixel={0} Interactable={false} Size={UDim2.fromScale(1, 1)}>
					<frame key="SkyWash" BackgroundColor3={Color3.fromRGB(22, 46, 66)} BackgroundTransparency={faded(alpha, 0)} BorderSizePixel={0} Size={UDim2.fromScale(1, 0.7)} ZIndex={1}>
						<uigradient Rotation={90} Transparency={new NumberSequence([new NumberSequenceKeypoint(0, 0.35), new NumberSequenceKeypoint(1, 1)])} />
					</frame>
					<frame key="Grid" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} ZIndex={1}>
						{range(gridX - 1).map((i) => (
							<frame key={`V${i + 1}`} BackgroundColor3={C.Accent} BackgroundTransparency={faded(alpha, 0.94)} BorderSizePixel={0} Position={UDim2.fromScale((i + 1) / gridX, 0)} Size={new UDim2(0, 1, 1, 0)} ZIndex={1} />
						))}
						{range(gridY - 1).map((i) => (
							<frame key={`H${i + 1}`} BackgroundColor3={C.Accent} BackgroundTransparency={faded(alpha, 0.94)} BorderSizePixel={0} Position={UDim2.fromScale(0, (i + 1) / gridY)} Size={new UDim2(1, 0, 0, 1)} ZIndex={1} />
						))}
					</frame>
					{missionId > 0 && (
						<textlabel key="MissionNumber" AnchorPoint={new Vector2(1, 1)} BackgroundTransparency={1} Font={Enum.Font.GothamBlack} Position={UDim2.fromScale(0.98, layout.mode === "tall" ? 0.46 : 0.86)} Size={UDim2.fromScale(layout.mode === "tall" ? 0.4 : 0.3, layout.mode === "tall" ? 0.16 : 0.34)} Text={string.format("%02d", missionId)} TextColor3={C.Ivory} TextScaled={true} TextTransparency={faded(alpha, 0.95)} TextXAlignment={Enum.TextXAlignment.Right} ZIndex={1} />
					)}
					<frame key="JetFrame" ref={holderRef} BackgroundTransparency={1} ClipsDescendants={true} Position={UDim2.fromScale(jet.x, jet.y)} Size={UDim2.fromScale(jet.width, jet.height)} ZIndex={2}>
						<Brackets alpha={alpha} />
						<frame key="Horizon" AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={C.Accent} BackgroundTransparency={faded(alpha, 0.8)} BorderSizePixel={0} Position={UDim2.fromScale(0.5, 0.5)} Size={new UDim2(0.7, 0, 0, 1)} ZIndex={1} />
						{[-1, 1].map((side) => (
							<frame key={side < 0 ? "LadderUp" : "LadderDown"} AnchorPoint={new Vector2(0.5, 0.5)} BackgroundColor3={C.Accent} BackgroundTransparency={faded(alpha, 0.85)} BorderSizePixel={0} Position={UDim2.fromScale(0.5, 0.5 + side * 0.22)} Size={new UDim2(0.24, 0, 0, 1)} ZIndex={1} />
						))}
						<textlabel key="AircraftTag" AnchorPoint={new Vector2(1, 1)} BackgroundTransparency={1} FontFace={HUD_FONT} Position={new UDim2(1, -8, 1, -6)} Size={UDim2.fromOffset(160, 14)} Text="KESTREL // READY ROOM" TextColor3={C.Accent} TextSize={11} TextTransparency={faded(alpha, 0.45)} TextXAlignment={Enum.TextXAlignment.Right} ZIndex={4} />
					</frame>
					<frame key="LeftShade" BackgroundColor3={C.Ink} BackgroundTransparency={faded(alpha, 0)} BorderSizePixel={0} Size={UDim2.fromScale(layout.mode === "tall" ? 0 : 0.62, 1)} Visible={layout.mode !== "tall"} ZIndex={3}>
						<uigradient Transparency={new NumberSequence([new NumberSequenceKeypoint(0, 0.1), new NumberSequenceKeypoint(0.55, 0.45), new NumberSequenceKeypoint(1, 1)])} />
					</frame>
					<frame key="BottomShade" AnchorPoint={new Vector2(0, 1)} BackgroundColor3={C.Ink} BackgroundTransparency={faded(alpha, 0)} BorderSizePixel={0} Position={UDim2.fromScale(0, 1)} Size={UDim2.fromScale(1, layout.mode === "tall" ? 0.62 : 0.4)} ZIndex={3}>
						<uigradient Rotation={-90} Transparency={new NumberSequence([new NumberSequenceKeypoint(0, 0), new NumberSequenceKeypoint(0.6, 0.35), new NumberSequenceKeypoint(1, 1)])} />
					</frame>
				</frame>
			</screengui>
			<screengui key="SkybreakLoadingContent" DisplayOrder={LOADING_DISPLAY_ORDER + 1} Enabled={mounted} IgnoreGuiInset={false} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.CoreUISafeInsets} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
				<frame key="LoadingScreen" BackgroundTransparency={1} Interactable={false} Size={UDim2.fromScale(1, 1)}>
					<frame key="AccentBar" BackgroundColor3={C.Orange} BackgroundTransparency={faded(alpha, 0)} BorderSizePixel={0} Position={UDim2.fromOffset(math.max(2, header.x - 10), eyebrowRect.y + 2)} Size={UDim2.fromOffset(3, header.height - HEADER_ROW_GAP - 4)} />
					<LoadText name="Eyebrow" text={missionEyebrow(missionId)} rect={eyebrowRect} size={layout.eyebrowSize} color={C.Orange} alpha={alpha} />
					<LoadText name="Title" text={title} rect={titleRect} size={layout.titleSize} color={C.Ivory} alpha={alpha} font={Enum.Font.GothamBlack} scaled={true} />
					<LoadText name="Codename" text={codename} rect={codenameRect} size={layout.codenameSize} color={C.Accent} alpha={alpha} />
					<LoadText name="Meta" text={meta} rect={metaRect} size={layout.metaSize} color={C.Muted} alpha={alpha} font={Enum.Font.GothamMedium} />
					{layout.act && <LoadText name="Act" text={actLine} rect={layout.act} size={layout.smallSize} color={C.Faint} alpha={alpha} align={Enum.TextXAlignment.Right} />}
					{brief && mission && (
						<frame key="Brief" BackgroundTransparency={1} Position={UDim2.fromOffset(brief.x, brief.y)} Size={UDim2.fromOffset(brief.width, brief.height)}>
							<frame key="Rule" BackgroundColor3={C.Accent} BackgroundTransparency={faded(alpha, 0.4)} BorderSizePixel={0} Size={UDim2.fromOffset(48, 1)} />
							<LoadText name="ObjectiveLabel" text="OBJECTIVE" rect={{ x: 0, y: 2, width: brief.width, height: labelRow }} size={layout.smallSize} color={C.Faint} alpha={alpha} />
							<LoadText name="Objective" text={mission.primary} rect={{ x: 0, y: labelRow, width: brief.width, height: layout.objectiveLines * line }} size={layout.bodySize} color={C.Ivory} alpha={alpha} font={Enum.Font.GothamMedium} wrapped={true} yAlign={Enum.TextYAlignment.Top} lineHeight={1.15} />
							{layout.excerptLines > 0 && (
								<LoadText name="Excerpt" text={excerpt} rect={{ x: 0, y: labelRow + layout.objectiveLines * line + 6, width: brief.width, height: layout.excerptLines * line }} size={layout.bodySize} color={C.Muted} alpha={alpha} font={Enum.Font.Gotham} wrapped={true} yAlign={Enum.TextYAlignment.Top} lineHeight={1.15} />
							)}
						</frame>
					)}
					{layout.tip && <LoadText name="Tip" text={tipText} rect={layout.tip} size={layout.smallSize} color={C.Muted} alpha={alpha} font={Enum.Font.GothamMedium} rich={true} />}
					<frame key="Progress" BackgroundTransparency={1} Position={UDim2.fromOffset(band.x, band.y)} Size={UDim2.fromOffset(band.width, band.height)}>
						{layout.labelsHeight > 0 && LOADING_SEGMENTS.map((name, i) => (
							<LoadText
								name={`Segment${name}`}
								text={name}
								rect={{ x: i * (layout.segmentWidth + layout.segmentGap), y: 0, width: layout.segmentWidth, height: layout.labelsHeight - 4 }}
								size={layout.smallSize}
								color={i < active ? C.Accent : i === active ? C.Ivory : C.Faint}
								alpha={alpha}
								base={i <= active ? 0 : 0.2}
							/>
						))}
						<frame key="Track" BackgroundColor3={C.PanelHot} BackgroundTransparency={faded(alpha, 0.15)} BorderSizePixel={0} Position={UDim2.fromOffset(0, layout.labelsHeight)} Size={UDim2.fromOffset(band.width, layout.barHeight)}>
							<frame key="Fill" ref={fillRef} BackgroundColor3={C.Accent} BackgroundTransparency={faded(alpha, 0)} BorderSizePixel={0} ZIndex={2}>
								<uigradient Color={new ColorSequence(C.Accent, C.AccentHot)} />
							</frame>
							{range(LOADING_SEGMENT_COUNT - 1).map((i) => (
								<frame key={`Gap${i + 1}`} BackgroundColor3={C.Ink} BackgroundTransparency={faded(alpha, 0)} BorderSizePixel={0} Position={UDim2.fromOffset(math.floor((i + 1) * (layout.segmentWidth + layout.segmentGap) - layout.segmentGap), 0)} Size={new UDim2(0, layout.segmentGap, 1, 0)} ZIndex={3} />
							))}
							<frame
								key="ActiveGlint"
								ref={glintRef}
								BackgroundTransparency={1}
								Position={UDim2.fromOffset(math.floor(active * (layout.segmentWidth + layout.segmentGap)), 0)}
								Size={new UDim2(0, math.floor(layout.segmentWidth), 1, 0)}
								Visible={alpha.map((a) => a > 0.98)}
								ZIndex={4}
							/>
						</frame>
						<LoadText name="Status" text={statusWords} rect={{ x: 0, y: statusTop - band.y, width: band.width - 90, height: layout.statusHeight }} size={layout.smallSize + 1} color={stage.queued ? C.Orange : C.Ivory} alpha={alpha} />
						<LoadText name="Elapsed" text={elapsedText.map((t) => `T+ ${t}`)} rect={{ x: band.width - 90, y: statusTop - band.y, width: 90, height: layout.statusHeight }} size={layout.smallSize + 1} color={C.Muted} alpha={alpha} fontFace={HUD_FONT} align={Enum.TextXAlignment.Right} />
					</frame>
				</frame>
			</screengui>
		</>
	);
}

export const LoadingScreen = React.memo(LoadingScreenComponent);
