import React, { useEffect, useRef, useState } from "@rbxts/react";
import { RunService, StarterGui, TextService, UserInputService } from "@rbxts/services";
import { ac04Chapter } from "../../shared/ac04/AC04Story";
import { getAC04CaptionLayout } from "../../shared/ac04/AC04CaptionLayout";

import { createAC04StoryStage } from "./AC04StoryStage";
import { AC04Voice, ac04StoryLineId } from "../../shared/ac04/AC04Voice";
import { cinematicBeatSeconds } from "../../shared/VoiceLines";
import { VoicePlayer, VoiceHandle } from "../VoicePlayer";

interface Props { chapterId: string; onFinish: () => void; onCancel: () => void; }
const PAPER = Color3.fromRGB(230, 219, 191), INK = Color3.fromRGB(20, 29, 39);
const GOLD = Color3.fromRGB(219, 188, 112), BLUE = Color3.fromRGB(55, 85, 105);
const CAPTION_FONT = Enum.Font.Gotham;
/** Height the wrapped caption occupies at the exact width its label uses. */
export function measureAC04Caption(text: string, textSize: number, wrapWidth: number): number {
	return TextService.GetTextSize(text, textSize, CAPTION_FONT, new Vector2(wrapWidth, 100000)).Y;
}
/** Self-contained captioned interludes with keyboard, gamepad and touch playback controls. */
export function AC04Cinematic({ chapterId, onFinish, onCancel }: Props): React.Element {
	const chapter = ac04Chapter(chapterId);
	const root = useRef<Frame>();
	const viewport = useRef<ViewportFrame>();
	const stage = useRef<ReturnType<typeof createAC04StoryStage>>();
	const voice = useRef<VoiceHandle>();
	const [playbackKey, setPlaybackKey] = useState(0);
	const [index, setIndex] = useState(0), [paused, setPaused] = useState(false);
	const [controlsVisible, setControlsVisible] = useState(false), [introVisible, setIntroVisible] = useState(true);
	const [height, setHeight] = useState(720), [width, setWidth] = useState(1280);
	const caption = useRef<ScrollingFrame>();
	const [captionAtEnd, setCaptionAtEnd] = useState(true);
	const indexRef = useRef(0), elapsedRef = useRef(0), pausedRef = useRef(false), finished = useRef(false);
	const finishRef = useRef(onFinish), cancelRef = useRef(onCancel);
	const healthCoreGuiWasEnabled = useRef<boolean>();
	finishRef.current = onFinish; cancelRef.current = onCancel;
	const finish = () => { if (!finished.current) { finished.current = true; voice.current?.Stop(0); finishRef.current(); } };
	const go = (delta: number) => {
		if (!chapter) { finish(); return; }
		voice.current?.Stop(0);
		const nextBeat = indexRef.current + delta;
		if (nextBeat >= chapter.beats.size()) { finish(); return; }
		indexRef.current = math.max(0, nextBeat); elapsedRef.current = 0; setIndex(indexRef.current); setPlaybackKey((value) => value + 1);
	};
	const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); setControlsVisible(true); if (pausedRef.current) voice.current?.Pause(); else voice.current?.Resume(); };
	useEffect(() => {
		const [readOk, wasEnabled] = pcall(() => StarterGui.GetCoreGuiEnabled(Enum.CoreGuiType.Health));
		if (readOk) {
			healthCoreGuiWasEnabled.current = wasEnabled;
			pcall(() => StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Health, false));
		}
		if (root.current) { setHeight(root.current.AbsoluteSize.Y); setWidth(root.current.AbsoluteSize.X); }
		finished.current = false; indexRef.current = 0; elapsedRef.current = 0; pausedRef.current = false;
		setIndex(0); setPaused(false); setControlsVisible(false); setIntroVisible(true);
		if (chapter && viewport.current) stage.current = createAC04StoryStage(viewport.current, chapter);
		return () => {
			voice.current?.Stop(0); stage.current?.destroy(); stage.current = undefined;
			const restore = healthCoreGuiWasEnabled.current;
			if (restore !== undefined) pcall(() => StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Health, restore));
			healthCoreGuiWasEnabled.current = undefined;
		};
	}, [chapterId]);
	useEffect(() => {
		if (!chapter) return;
		stage.current?.show(index);
		voice.current?.Stop(0);
		const currentBeat = chapter.beats[index];
		voice.current = currentBeat ? VoicePlayer.Play(AC04Voice.Clip(ac04StoryLineId(chapter.id, index), currentBeat.text), "cutscene") : undefined;
		if (pausedRef.current) voice.current?.Pause();
		return () => { voice.current?.Stop(0); voice.current = undefined; };
	}, [chapterId, index, playbackKey]);
	useEffect(() => {
		const clock = RunService.Heartbeat.Connect((dt) => {
			if (!chapter || pausedRef.current || finished.current || voice.current?.IsLoading()) return;
			elapsedRef.current += dt;
			if (elapsedRef.current >= 2.5) setIntroVisible(false);
			const duration = cinematicBeatSeconds(chapter.beats[indexRef.current].durationSeconds, voice.current?.clip.seconds);
			if (elapsedRef.current >= duration && !voice.current?.IsPlaying()) go(1);
		});
		const keys = UserInputService.InputBegan.Connect((input, processed) => {
			if (processed || UserInputService.GetFocusedTextBox()) return;
			setControlsVisible(true); setIntroVisible(false);
			if (input.KeyCode === Enum.KeyCode.Space || input.KeyCode === Enum.KeyCode.Return || input.KeyCode === Enum.KeyCode.ButtonA || input.KeyCode === Enum.KeyCode.Right) go(1);
			else if (input.KeyCode === Enum.KeyCode.Left || input.KeyCode === Enum.KeyCode.ButtonL1) go(-1);
			else if (input.KeyCode === Enum.KeyCode.P || input.KeyCode === Enum.KeyCode.ButtonX) togglePause();
			else if ((input.KeyCode === Enum.KeyCode.Down || input.KeyCode === Enum.KeyCode.Up || input.KeyCode === Enum.KeyCode.DPadDown || input.KeyCode === Enum.KeyCode.DPadUp) && caption.current) {
				const frame = caption.current, down = input.KeyCode === Enum.KeyCode.Down || input.KeyCode === Enum.KeyCode.DPadDown;
				const limit = math.max(0, frame.AbsoluteCanvasSize.Y - frame.AbsoluteWindowSize.Y);
				frame.CanvasPosition = new Vector2(0, math.clamp(frame.CanvasPosition.Y + (down ? 40 : -40), 0, limit));
			}
			else if ((input.KeyCode === Enum.KeyCode.Escape || input.KeyCode === Enum.KeyCode.ButtonB) && !finished.current) { finished.current = true; voice.current?.Stop(0); cancelRef.current(); }
		});
		return () => { clock.Disconnect(); keys.Disconnect(); };
	}, [chapterId]);
	const current = chapter?.beats[index], count = chapter?.beats.size() ?? 1;
	const captionText = current?.text ?? "This chapter could not be found. Continue to return to the campaign.";
	const layout = getAC04CaptionLayout(width, height, chapter ? chapter.beats.map((entry) => entry.text) : [captionText], chapter ? index : 0, measureAC04Caption);
	const titleHeight = layout.titleHeight, bandHeight = layout.bandHeight;
	useEffect(() => { stage.current?.reframe(); }, [width, height]);
	useEffect(() => { setCaptionAtEnd(!layout.scrollable); if (caption.current) caption.current.CanvasPosition = Vector2.zero; }, [index, chapterId, layout.scrollable]);
	return <frame key="AC04Cinematic" ref={root} Size={UDim2.fromScale(1, 1)} BackgroundColor3={INK} BorderSizePixel={0} ZIndex={80} Change={{AbsoluteSize: (frame) => { setHeight(frame.AbsoluteSize.Y); setWidth(frame.AbsoluteSize.X); }}}>
		<viewportframe ref={viewport} Position={new UDim2()} Size={new UDim2(1, 0, 1, -bandHeight)} BorderSizePixel={0} ZIndex={81}/>
		{introVisible && <frame Size={new UDim2(1, 0, 0, math.min(titleHeight, height - bandHeight))} BackgroundColor3={INK} BackgroundTransparency={.08} BorderSizePixel={0} ZIndex={82}>
			<textlabel Position={new UDim2(.05, 0, 0, 8)} Size={new UDim2(.9, 0, 0, 18)} Text="A MEMORY OF SAN SALVACION" Font={Enum.Font.GothamMedium} TextSize={height < 300 ? 9 : 12} TextColor3={GOLD} TextXAlignment={Enum.TextXAlignment.Left} BackgroundTransparency={1} ZIndex={83}/>
			<textlabel Position={new UDim2(.05, 0, 0, height < 300 ? 19 : 28)} Size={new UDim2(.9, 0, 0, height < 300 ? 16 : 30)} Text={chapter?.title ?? "Chapter unavailable"} Font={Enum.Font.GothamBold} TextScaled TextColor3={PAPER} TextXAlignment={Enum.TextXAlignment.Left} BackgroundTransparency={1} ZIndex={83}><uitextsizeconstraint MaxTextSize={24} MinTextSize={12}/></textlabel>
		</frame>}
		<frame Position={new UDim2(0, 0, 1, -bandHeight)} Size={new UDim2(1, 0, 0, bandHeight)} BackgroundColor3={INK} BorderSizePixel={0} ZIndex={82}>
			<scrollingframe key={`caption-${index}`} ref={caption} Position={new UDim2(0, layout.captionX, 0, layout.captionY)} Size={new UDim2(0, layout.captionWidth, 0, layout.captionHeight)} BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={new UDim2(0, 0, 0, layout.textHeight)} AutomaticCanvasSize={Enum.AutomaticSize.None} ScrollingDirection={Enum.ScrollingDirection.Y} ScrollingEnabled={layout.scrollable} ScrollBarThickness={layout.scrollBarThickness} ScrollBarImageColor3={GOLD} VerticalScrollBarInset={Enum.ScrollBarInset.None} ElasticBehavior={Enum.ElasticBehavior.Never} ZIndex={83}
				Change={{CanvasPosition: (frame) => setCaptionAtEnd(frame.CanvasPosition.Y >= frame.AbsoluteCanvasSize.Y - frame.AbsoluteWindowSize.Y - 2)}}>
				<textlabel Size={new UDim2(0, layout.wrapWidth, 0, layout.textHeight)} Text={captionText} Font={CAPTION_FONT} TextColor3={PAPER} TextSize={layout.textSize} TextWrapped TextXAlignment={Enum.TextXAlignment.Center} TextYAlignment={Enum.TextYAlignment.Top} BackgroundTransparency={1} ZIndex={83}/>
			</scrollingframe>
			{layout.scrollable && !captionAtEnd && <textlabel AnchorPoint={new Vector2(1, 1)} Position={new UDim2(0, layout.captionX + layout.captionWidth, 0, layout.captionY + layout.captionHeight)} Size={new UDim2(0, 64, 0, 16)} Text="MORE ▼" TextSize={11} Font={Enum.Font.GothamMedium} TextColor3={GOLD} TextXAlignment={Enum.TextXAlignment.Right} BackgroundColor3={INK} BackgroundTransparency={.15} BorderSizePixel={0} ZIndex={85}/>}
			{(controlsVisible || paused) && <frame Position={new UDim2(.05, 0, 1, -57)} Size={new UDim2(.9, 0, 0, 44)} BackgroundTransparency={1} ZIndex={83}>
				<textbutton Size={new UDim2(.18, -4, 1, 0)} Text="BACK" TextSize={12} Font={Enum.Font.GothamMedium} TextColor3={PAPER} BackgroundColor3={BLUE} BorderSizePixel={0} ZIndex={84} Event={{Activated: () => go(-1)}}/>
				<textbutton Position={UDim2.fromScale(.18, 0)} Size={new UDim2(.25, -4, 1, 0)} Text={paused ? "RESUME" : "PAUSE"} TextSize={12} Font={Enum.Font.GothamMedium} TextColor3={PAPER} BackgroundColor3={BLUE} BorderSizePixel={0} ZIndex={84} Event={{Activated: togglePause}}/>
				<textbutton Position={UDim2.fromScale(.43, 0)} Size={new UDim2(.25, -4, 1, 0)} Text="SKIP CHAPTER" TextSize={11} Font={Enum.Font.GothamMedium} TextColor3={PAPER} BackgroundColor3={BLUE} BorderSizePixel={0} ZIndex={84} Event={{Activated: finish}}/>
				<textbutton Position={UDim2.fromScale(.68, 0)} Size={new UDim2(.32, 0, 1, 0)} Text={index + 1 === count ? "CONTINUE" : "NEXT"} TextSize={13} Font={Enum.Font.GothamBold} TextColor3={INK} BackgroundColor3={GOLD} BorderSizePixel={0} ZIndex={84} Event={{Activated: () => go(1)}}/>
			</frame>}
		</frame>
	</frame>;
}
