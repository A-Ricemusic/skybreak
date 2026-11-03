// Broken Relay chapter cutscene: the React caption panel, controls, beat clock and voice playback, driven over
// the stage built by CinematicStage (sceneFor/stageLighting/stageEffects). Camera, Lighting and stage are
// restored on unmount through one teardown.
import { cinematicClockStep } from "../shared/VoiceReadiness";
import React, { useEffect, useMemo, useRef, useState } from "@rbxts/react";
import { GuiService, RunService, TextService, UserInputService, Workspace } from "@rbxts/services";
import { CinematicAction, CinematicControl, routeCinematicInput } from "../shared/CinematicInput";
import { Rect, getCinematicFrame, getCinematicLayout, progressSegments } from "../shared/CinematicLayout";
import {
	boardShowsTeal,
	cardVignette,
	isCard,
	isTyped,
	recorderLightOn,
	recorderOpen,
	reelsSpin,
	shotPose,
	typedGraphemes,
} from "../shared/CinematicStaging";
import { SpeakerTone, StoryBeat, speakerStyle, storyFor } from "../shared/RelayStory";
import { MotionPreference } from "./MotionPreference";
import { Voice, cinematicBeatSeconds, storyLineId } from "../shared/VoiceLines";
import { VoiceHandle, VoicePlayer } from "./VoicePlayer";
import { NO_DEPTH, shotDepth } from "../shared/CinematicSet";
import { createTeardown } from "../shared/Teardown";
import { ORIGIN, beatDuration, sceneFor, stageEffects, stageLighting, vec } from "./CinematicStage";
import { C } from "../shared/Theme";

// Caption palette: the shared menu colours, plus two cinematic-only shades that intentionally differ from Theme.
/** Deeper than Theme.C.Ink (6, 13, 22): the caption panel sits over a black fade and must read as black. */
const INK = Color3.fromRGB(4, 9, 14);
const IVORY = C.Ivory;
const MUTED = C.Muted;
const FAINT = C.Faint;
const ACCENT = C.Accent;
const ORANGE = C.Orange;
const DANGER = C.Danger;
/** Wingman tone: a warmer, dimmer gold than Theme.HUD.Amber (255, 196, 84). */
const AMBER = Color3.fromRGB(242, 196, 78);
const TONE_COLOR: Record<SpeakerTone, Color3> = {
	teal: ACCENT,
	control: ORANGE,
	log: MUTED,
	marshal: DANGER,
	trainee: IVORY,
	wing: AMBER,
};
const bodyFont = (beat: StoryBeat) =>
	speakerStyle(beat.speaker).tone === "log" ? Enum.Font.RobotoMono : Enum.Font.GothamMedium;
/** Accessibility choices persist for the rest of the session; camera motion is shared with flight (MotionPreference). */
const prefs = { large: false };
const TEXT_FADE_IN = 0.25,
	TEXT_FADE_OUT = 0.2,
	CUT_DIP = 0.3,
	CUT_BLACK = 0.85,
	ENTER_FADE = 0.5,
	EXIT_FADE = 0.5,
	SCROLL_GUTTER = 6;
type HintMode = "touch" | "keyboard" | "gamepad";
function hintModeFor(input: Enum.UserInputType): HintMode {
	if (input === Enum.UserInputType.Touch) return "touch";
	return input.Name.sub(1, 7) === "Gamepad" ? "gamepad" : "keyboard";
}
const HINT: Record<HintMode, string> = { touch: "TAP FOR NEXT", keyboard: "CLICK FOR NEXT", gamepad: "R1 NEXT" };
const graphemes = (text: string) => {
	const [count] = utf8.len(text);
	return typeIs(count, "number") ? count : text.size();
};

export function RelayCinematic({
	id,
	viewport,
	onFinish,
	onCancel,
}: {
	id: number;
	viewport: Vector2;
	onFinish: () => void;
	onCancel: () => void;
}) {
	const chapter = storyFor(id);
	const [beat, setBeat] = useState(0),
		[paused, setPaused] = useState(false),
		[still, setStill] = useState(MotionPreference.reduced),
		[large, setLarge] = useState(prefs.large);
	const [settingsOpen, setSettingsOpen] = useState(false),
		[hintMode, setHintMode] = useState<HintMode>(hintModeFor(UserInputService.GetLastInputType()));
	const layout = getCinematicLayout(viewport.X, viewport.Y, large);
	const viewportRef = useRef(viewport);
	viewportRef.current = viewport;
	const current = chapter.beats[beat],
		speaker = speakerStyle(current.speaker),
		tone = TONE_COLOR[speaker.tone],
		card = isCard(current.shot);
	// AutomaticSize underreports wrapped text after accessibility-size changes
	// (TextFits=false). Measure the real font so the band fits the chapter's
	// longest line and the scroller has an explicit canvas for any overflow.
	// Measure and render at the same width; it always leaves room for the overflow scroll bar.
	const wrapWidth = math.max(1, layout.textWidth - SCROLL_GUTTER);
	const measure = (b: StoryBeat) =>
		TextService.GetTextSize(b.text, layout.bodySize, bodyFont(b), new Vector2(wrapWidth, 10000)).Y + 4;
	const textHeight = measure(current);
	// GetTextSize per beat is costly; the chapter's tallest line only changes with the chapter, text size or wrap width.
	const tallestLine = useMemo(() => {
		let max = 0;
		for (const b of chapter.beats) if (!isCard(b.shot)) max = math.max(max, measure(b));
		return max;
	}, [id, layout.bodySize, wrapWidth]);
	const tallest = tallestLine === 0 ? textHeight : tallestLine;
	// Every rectangle comes from the pure layout: no top bar, one caption panel at the bottom with the controls on the speaker row.
	const frame = getCinematicFrame(layout, viewport.X, viewport.Y, tallest),
		band = frame.band;
	const overflow = textHeight > frame.text.height;
	// The safe root starts below the Roblox top bar; cards and fades reach up through that inset so no sky shows above a black card.
	const inset = math.max(0, GuiService.GetGuiInset()[0].Y);
	const subtitleRef = useRef<ScrollingFrame>(),
		bodyRef = useRef<TextLabel>(),
		nameRef = useRef<TextLabel>(),
		roleRef = useRef<TextLabel>();
	const audioStatusRef = useRef<TextLabel>();
	const progressRef = useRef<Frame>(),
		fadeRef = useRef<Frame>(),
		cardBodyRef = useRef<TextLabel>(),
		cardNameRef = useRef<TextLabel>();
	useEffect(() => {
		if (subtitleRef.current) subtitleRef.current.CanvasPosition = Vector2.zero;
	}, [beat]);
	const pausedRef = useRef(false),
		stillRef = useRef(MotionPreference.reduced),
		finishRef = useRef(onFinish),
		cancelRef = useRef(onCancel),
		done = useRef(false);
	// Longer lines stay on screen longer: 5-9 s per beat, scaled by text length, or the voice plus a short tail when that is longer.
	const durations = useMemo(
		() =>
			chapter.beats.map((b, i) =>
				cinematicBeatSeconds(beatDuration(b.text), Voice.Story(id, i, b.text)?.seconds),
			),
		[id],
	);
	// Advancing, skipping or closing stops the voice; unavailable dialogue stays visible as a failure.
	const voiceRef = useRef<VoiceHandle>(),
		audioUnavailableRef = useRef(false);
	const speak = (index: number) => {
		voiceRef.current?.Stop(0.12);
		voiceRef.current = VoicePlayer.Play(Voice.Story(id, index, chapter.beats[index].text), "cutscene");
		audioUnavailableRef.current = voiceRef.current === undefined;
		if (audioUnavailableRef.current)
			warn(
				`SKYBREAK cinematic ${storyLineId(id, index)}: dialogue unavailable (missing/mismatched cue or unavailable bank); universe=${game.GameId} place=${game.PlaceId} version=${game.PlaceVersion}`,
			);
		if (pausedRef.current) voiceRef.current?.Pause();
	};
	const silence = (fade: number) => {
		voiceRef.current?.Stop(fade);
		voiceRef.current = undefined;
	};
	// endRef is when the current beat hands over; a manual "next" pulls it in to
	// start the outro (text fade + dip to black) instead of hard-cutting.
	const presentationTimeRef = useRef(0);
	const indexRef = useRef(0),
		beatTimeRef = useRef(0),
		endRef = useRef(durations[0]);
	finishRef.current = onFinish;
	cancelRef.current = onCancel;
	const finish = () => {
		if (done.current) return;
		done.current = true;
		finishRef.current();
	};
	// Runs every frame: read each ref fresh (cards and the role line mount and unmount) without allocating a label array.
	const setTextAlpha = (alpha: number) => {
		const body = bodyRef.current,
			name = nameRef.current,
			role = roleRef.current,
			cardBody = cardBodyRef.current,
			cardName = cardNameRef.current;
		if (body) body.TextTransparency = alpha;
		if (name) name.TextTransparency = alpha;
		if (role) role.TextTransparency = alpha;
		if (cardBody) cardBody.TextTransparency = alpha;
		if (cardName) cardName.TextTransparency = alpha;
	};
	const setVisible = (count: number) => {
		const body = bodyRef.current,
			cardBody = cardBodyRef.current;
		if (body) body.MaxVisibleGraphemes = count;
		if (cardBody) cardBody.MaxVisibleGraphemes = count;
	};
	const goTo = (index: number) => {
		// Hide the outgoing line before React swaps text so it can fade or type in cleanly.
		if (!stillRef.current) {
			setTextAlpha(1);
			setVisible(0);
		}
		indexRef.current = index;
		beatTimeRef.current = 0;
		presentationTimeRef.current = 0;
		endRef.current = durations[index];
		setBeat(index);
		speak(index);
	};
	const advance = () => {
		if (indexRef.current < chapter.beats.size() - 1) goTo(indexRef.current + 1);
		else finish();
	};
	const requestNext = () => {
		if (stillRef.current) {
			advance();
			return;
		}
		const t = beatTimeRef.current;
		if (endRef.current - t <= CUT_DIP) return; // outro already running; ignore repeat taps
		endRef.current = t + CUT_DIP;
		silence(CUT_DIP);
	};
	const dispatch = (action: CinematicAction | undefined) => {
		if (done.current) return;
		if (action === "skip") {
			silence(0.2);
			finish();
		} else if (action === "cancel") {
			silence(0.2);
			done.current = true;
			cancelRef.current();
		} else if (action === "pause") {
			pausedRef.current = !pausedRef.current;
			setPaused(pausedRef.current);
			if (pausedRef.current) voiceRef.current?.Pause();
			else voiceRef.current?.Resume();
		} else if (action === "next") {
			if (pausedRef.current) {
				pausedRef.current = false;
				setPaused(false);
				voiceRef.current?.Resume();
			}
			requestNext();
		} else if (action === "motion") {
			stillRef.current = !stillRef.current;
			MotionPreference.reduced = stillRef.current;
			setStill(stillRef.current);
		} else if (action === "text") {
			prefs.large = !prefs.large;
			setLarge(prefs.large);
		}
	};
	useEffect(() => {
		// Every resource registers its undo the moment it exists, so a setup that throws halfway leaks nothing;
		// teardown runs each undo once (newest first, each under its own pcall), whether a failed setup or React calls it.
		const teardown = createTeardown((problem) =>
			warn(`SKYBREAK cinematic ${id}: a cleanup step failed: ${problem}`),
		);
		const track = (undo: () => void) => teardown.add(undo);
		// Timeline and overlay run even without a camera so the fade can never stick on black.
		const camera = Workspace.CurrentCamera;
		// One terminal path for any failure, at setup or on a later frame or input: undo everything, then leave like Skip.
		const fail = (when: string, problem: unknown) => {
			if (teardown.ran()) return;
			warn(`SKYBREAK cinematic ${id}: ${when} failed; skipping the cutscene: ${tostring(problem)}`);
			teardown.run();
			finish();
		};
		const guarded =
			<A extends unknown[]>(when: string, callback: (...args: A) => void) =>
			(...args: A) => {
				const [ok, problem] = pcall(callback, ...args);
				if (!ok) fail(when, problem);
			};
		const [ready, problem] = pcall(() => {
			if (camera) {
				const oldType = camera.CameraType,
					oldFov = camera.FieldOfView,
					oldFrame = camera.CFrame;
				track(() => {
					camera.CameraType = oldType;
					camera.FieldOfView = oldFov;
					camera.CFrame = oldFrame;
				});
			}
			track(() => silence(0));
			const stage = sceneFor(chapter, track);
			stageLighting(chapter.mood, track);
			const effects = stageEffects(chapter.mood, track);
			let clock = 0,
				reelAngle = 0;
			const last = chapter.beats.size() - 1,
				steadyLamp = recorderOpen(id);
			const lengths = chapter.beats.map((b) => graphemes(b.text));
			speak(0);
			const move = RunService.RenderStepped.Connect(
				guarded("a frame", (dt: number) => {
					if (done.current) return;
					const step = math.min(dt, 0.1);
					clock += step;
					if (!pausedRef.current) presentationTimeRef.current += step;
					beatTimeRef.current += cinematicClockStep(
						step,
						pausedRef.current,
						voiceRef.current?.IsLoading() === true,
					);
					if (beatTimeRef.current >= endRef.current) {
						advance();
						if (done.current) return;
					}
					const index = indexRef.current,
						t = beatTimeRef.current,
						duration = durations[index],
						calm = stillRef.current;
					const loading = voiceRef.current?.IsLoading() === true,
						presentationT = presentationTimeRef.current;
					if (audioStatusRef.current) {
						const unavailable = audioUnavailableRef.current || voiceRef.current?.HasFailed() === true;
						audioStatusRef.current.Visible = loading || unavailable;
						audioStatusRef.current.Text = unavailable
							? "Dialogue unavailable · subtitles only"
							: "Loading dialogue…";
					}
					const left = endRef.current - t;
					const { shot, speaker: who } = chapter.beats[index],
						toneNow = speakerStyle(who).tone;
					// Text: tapes, the log and title cards type out over the first 40 % of the beat; everyone else fades in. All fade out over the outro unless reduced motion asks for instant swaps.
					const typed = isTyped(toneNow, shot);
					const fadeOut = index === last ? 1 : math.clamp(left / TEXT_FADE_OUT, 0, 1);
					setTextAlpha(
						calm || loading
							? 0
							: 1 - math.min(typed ? 1 : math.clamp(presentationT / TEXT_FADE_IN, 0, 1), fadeOut),
					);
					setVisible(typed ? typedGraphemes(presentationT, duration, lengths[index], calm) : -1);
					if (progressRef.current)
						progressRef.current.Size = new UDim2(math.clamp(t / duration, 0, 1), 0, 1, 0);
					// Black overlay: fade up from black, dip on camera cuts, fade out at the natural end.
					const enter = 1 - math.clamp(clock / ENTER_FADE, 0, 1);
					// Cut dip: darken over the outgoing beat's last CUT_DIP, then lift on the incoming shot.
					const dipOut = calm || index === last ? 0 : (1 - math.clamp(left / CUT_DIP, 0, 1)) * CUT_BLACK;
					const dipIn = calm || index === 0 ? 0 : (1 - math.clamp(presentationT / CUT_DIP, 0, 1)) * CUT_BLACK;
					const exitSpan = endRef.current < duration ? CUT_DIP : EXIT_FADE;
					const exit = index === last ? 1 - math.clamp(left / exitSpan, 0, 1) : 0;
					if (fadeRef.current)
						fadeRef.current.BackgroundTransparency = 1 - math.max(enter, dipOut, dipIn, exit);
					// Stage life: reels turn while a tape or the log speaks; the recorder lamp blinks in its close-up; Sera's board follows chapter 5.
					if (!pausedRef.current && reelsSpin(toneNow)) reelAngle += step * 2.4;
					for (const { part, base, axis } of stage.reels)
						part.CFrame = base.mul(
							axis === "x" ? CFrame.Angles(reelAngle, 0, 0) : CFrame.Angles(0, reelAngle, 0),
						);
					stage.recorderLight.Transparency = recorderLightOn(shot, clock, steadyLamp)
						? 0
						: shot === "recorder"
							? 0.85
							: 0.55;
					stage.tealStrip.Transparency = boardShowsTeal(id, index, last) ? 0 : 1;
					// Camera framing follows the beat's shot; camera motion OFF holds each shot's mid pose.
					const alpha = calm ? 0.5 : math.clamp(t / duration, 0, 1);
					const size = viewportRef.current,
						pose = shotPose(shot, chapter.scene, alpha, size.Y < 240, size.Y > size.X);
					effects.depth(shotDepth(shot, pose) ?? NO_DEPTH);
					if (!camera) return;
					camera.CameraType = Enum.CameraType.Scriptable;
					camera.FieldOfView = pose.fov;
					camera.CFrame = CFrame.lookAt(ORIGIN.add(vec(pose.eye)), ORIGIN.add(vec(pose.focus)));
				}),
			);
			track(() => move.Disconnect());
			const input = UserInputService.InputBegan.Connect(
				guarded("input", (key: InputObject, processed: boolean) => {
					dispatch(
						routeCinematicInput({
							kind: "shortcut",
							key: key.KeyCode.Name,
							processed: processed || GuiService.MenuIsOpen,
							guiSelected: GuiService.SelectedObject !== undefined,
						}),
					);
				}),
			);
			track(() => input.Disconnect());
			const inputType = UserInputService.LastInputTypeChanged.Connect(
				guarded("input", (kind: Enum.UserInputType) => {
					if (
						kind === Enum.UserInputType.MouseMovement ||
						kind === Enum.UserInputType.Focus ||
						kind === Enum.UserInputType.TextInput
					)
						return;
					setHintMode(hintModeFor(kind));
				}),
			);
			track(() => inputType.Disconnect());
		});
		// A stage that cannot be built is skipped like a tap on Skip, after everything created so far is undone.
		if (!ready) fail("stage setup", problem);
		// Unmount (finish, skip or cancel) puts the stage, lighting and camera back exactly as found; safe to call again.
		return () => teardown.run();
	}, [id]);

	const activate = (control: CinematicControl) => () => dispatch(routeCinematicInput({ kind: "activated", control }));
	const { tiny, controlSize, chipTextSize, pillHeight } = layout;
	// Children of the caption panel are placed relative to its top-left corner.
	const at = (r: Rect, origin: Rect = band) => ({
		Position: UDim2.fromOffset(r.x - origin.x, r.y - origin.y),
		Size: UDim2.fromOffset(r.width, r.height),
	});
	// Each control keeps its 44 px hit box; a thin outlined pill sits inside it.
	const control = (
		name: string,
		rect: Rect,
		control: CinematicControl | undefined,
		highlight: boolean,
		content: React.Element,
		onClick?: () => void,
	) => (
		<textbutton
			key={name}
			Position={at(rect).Position}
			Size={at(rect).Size}
			BackgroundTransparency={1}
			Text=""
			AutoButtonColor={false}
			Event={{ Activated: onClick ?? (control ? activate(control) : undefined) }}
		>
			<frame
				key="Pill"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={UDim2.fromScale(0.5, 0.5)}
				Size={new UDim2(1, -6, 0, pillHeight)}
				BackgroundColor3={highlight ? ACCENT : INK}
				BackgroundTransparency={highlight ? 0.82 : 0.6}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(1, 0)} />
				<uistroke Color={highlight ? ACCENT : IVORY} Transparency={highlight ? 0.3 : 0.72} Thickness={1} />
				{content}
			</frame>
		</textbutton>
	);
	// Stepped play triangle (1 px columns narrowing to the tip): no glyph or image asset to go missing.
	const triangle = (key: string, height: number, color: Color3, order = 0) => {
		const width = math.round(height * 0.85),
			columns: React.Element[] = [];
		for (let i = 0; i < width; i++) {
			const h = math.max(1, math.round(height * (1 - i / width)));
			columns.push(
				<frame
					key={`C${i}`}
					Position={UDim2.fromOffset(i, math.floor((height - h) / 2))}
					Size={UDim2.fromOffset(1, h)}
					BackgroundColor3={color}
					BorderSizePixel={0}
				/>,
			);
		}
		return (
			<frame
				key={key}
				LayoutOrder={order}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={UDim2.fromScale(0.5, 0.5)}
				Size={UDim2.fromOffset(width, height)}
				BackgroundTransparency={1}
			>
				{columns}
			</frame>
		);
	};
	const iconColor = paused ? ACCENT : IVORY;
	const pauseIcon = paused ? (
		triangle("Play", 12, iconColor)
	) : (
		<frame
			key="Pause"
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={UDim2.fromScale(0.5, 0.5)}
			Size={UDim2.fromOffset(9, 12)}
			BackgroundTransparency={1}
		>
			<frame key="L" Size={UDim2.fromOffset(3, 12)} BackgroundColor3={iconColor} BorderSizePixel={0} />
			<frame
				key="R"
				Position={UDim2.fromOffset(6, 0)}
				Size={UDim2.fromOffset(3, 12)}
				BackgroundColor3={iconColor}
				BorderSizePixel={0}
			/>
		</frame>
	);
	const skipContent = (
		<frame key="Skip" Size={UDim2.fromScale(1, 1)} BackgroundTransparency={1}>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<textlabel
				key="Label"
				LayoutOrder={1}
				AutomaticSize={Enum.AutomaticSize.X}
				Size={new UDim2(0, 0, 1, 0)}
				BackgroundTransparency={1}
				Text="SKIP"
				TextSize={tiny ? 11 : 12}
				Font={Enum.Font.GothamBold}
				TextColor3={IVORY}
			/>
			<frame key="Icon" LayoutOrder={2} Size={UDim2.fromOffset(15, 9)} BackgroundTransparency={1}>
				<frame key="A" Size={UDim2.fromOffset(8, 9)} BackgroundTransparency={1}>
					{triangle("T", 9, IVORY)}
				</frame>
				<frame
					key="B"
					Position={UDim2.fromOffset(7, 0)}
					Size={UDim2.fromOffset(8, 9)}
					BackgroundTransparency={1}
				>
					{triangle("T", 9, IVORY)}
				</frame>
			</frame>
		</frame>
	);
	const panel = frame.settingsPanel,
		horizontal = frame.horizontalSettings;
	const toggle = (name: string, label: string, value: string, order: number, control: CinematicControl) => (
		<textbutton
			key={name}
			LayoutOrder={order}
			Size={horizontal ? new UDim2(0.5, -2, 0, controlSize) : new UDim2(1, 0, 0, controlSize)}
			BackgroundColor3={Color3.fromRGB(16, 30, 40)}
			BackgroundTransparency={0.1}
			BorderSizePixel={0}
			Text=""
			AutoButtonColor={true}
			Event={{ Activated: activate(control) }}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<textlabel
				key="Label"
				Position={UDim2.fromOffset(12, 0)}
				Size={new UDim2(1, -60, 1, 0)}
				BackgroundTransparency={1}
				Text={label}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextTruncate={Enum.TextTruncate.AtEnd}
				TextSize={tiny ? 12 : 13}
				Font={Enum.Font.GothamMedium}
				TextColor3={IVORY}
			/>
			<textlabel
				key="Value"
				AnchorPoint={new Vector2(1, 0)}
				Position={new UDim2(1, -12, 0, 0)}
				Size={new UDim2(0, 40, 1, 0)}
				BackgroundTransparency={1}
				Text={value}
				TextXAlignment={Enum.TextXAlignment.Right}
				TextSize={tiny ? 12 : 13}
				Font={Enum.Font.GothamBold}
				TextColor3={ACCENT}
			/>
		</textbutton>
	);
	// Lines mount hidden and RenderStepped fades or types them in (instant with reduced motion).
	const hidden = still ? 0 : 1,
		typedLine = isTyped(speaker.tone, current.shot),
		startVisible = still || !typedLine ? -1 : 0;
	// Speaker: tone swatch, name, then the role truncated to whatever the controls leave.
	const nameFont = speaker.tone === "log" ? Enum.Font.RobotoMono : Enum.Font.GothamBlack;
	const nameWidth =
		math.ceil(TextService.GetTextSize(speaker.name, chipTextSize, nameFont, new Vector2(1000, 100)).X) + 2;
	const roleX = 3 + 8 + nameWidth + 8,
		roleWidth = math.max(0, frame.speaker.width - roleX);
	// One progress segment per beat: done ones solid, the current one fills over its beat.
	const segments = progressSegments(frame.progress.width, chapter.beats.size()).map((s, i) => (
		<frame
			key={`Segment${i}`}
			Position={UDim2.fromOffset(s.x, 0)}
			Size={new UDim2(0, s.width, 1, 0)}
			BackgroundColor3={i < beat ? tone : IVORY}
			BackgroundTransparency={i < beat ? 0.25 : 0.82}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(1, 0)} />
			{i === beat && (
				<frame
					ref={progressRef}
					key="Fill"
					Size={UDim2.fromScale(0, 1)}
					BackgroundColor3={tone}
					BackgroundTransparency={0.1}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(1, 0)} />
				</frame>
			)}
		</frame>
	));
	const cardFont = speaker.tone === "log" ? Enum.Font.RobotoMono : Enum.Font.GothamMedium;
	// Gradient behind the panel: clear at the feather, ~65 % ink at the speaker row (muted role text stays readable over white scenes), ~76 % behind the line.
	const backdrop = frame.backdrop,
		fade = (y: number) => math.clamp((y - backdrop.y) / math.max(1, backdrop.height), 0.01, 0.98);
	const rowKey = fade(band.y),
		textKey = math.max(rowKey + 0.01, fade(frame.text.y));
	// Layering: scene tap target 1, panel gradient 2, title card 3, caption panel and pause chip 4, settings 5, fade 6.
	// The panel sits above black cards so skip/pause/Aa stay reachable; the card shows its own speaker and line.
	return (
		<frame key="CinematicScreen" Size={UDim2.fromScale(1, 1)} BackgroundTransparency={1}>
			<textlabel
				ref={audioStatusRef}
				key="CinematicAudioStatus"
				ZIndex={4}
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 12)}
				Size={UDim2.fromOffset(280, 24)}
				BackgroundColor3={INK}
				BackgroundTransparency={0.25}
				BorderSizePixel={0}
				Text="Loading dialogue…"
				TextSize={12}
				Font={Enum.Font.GothamMedium}
				TextColor3={IVORY}
				Visible={false}
			/>
			{/* Tap or click anywhere on the scene for the next line. */}
			<textbutton
				key="CinematicAdvanceButton"
				ZIndex={1}
				Size={UDim2.fromScale(1, 1)}
				BackgroundTransparency={1}
				Text=""
				AutoButtonColor={false}
				Selectable={false}
				Event={{ Activated: activate("next") }}
			/>
			{settingsOpen && (
				<frame
					key="CinematicSettings"
					ZIndex={5}
					Position={UDim2.fromOffset(panel.x, panel.y)}
					Size={UDim2.fromOffset(panel.width, panel.height)}
					BackgroundColor3={INK}
					BackgroundTransparency={0.15}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
					<uistroke Color={IVORY} Transparency={0.85} Thickness={1} />
					<uipadding
						PaddingTop={new UDim(0, 4)}
						PaddingBottom={new UDim(0, 4)}
						PaddingLeft={new UDim(0, 4)}
						PaddingRight={new UDim(0, 4)}
					/>
					<uilistlayout
						FillDirection={horizontal ? Enum.FillDirection.Horizontal : Enum.FillDirection.Vertical}
						Padding={new UDim(0, 4)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{toggle(
						"CinematicMotionButton",
						horizontal ? "Motion" : "Camera motion",
						still ? "OFF" : "ON",
						1,
						"motion",
					)}
					{toggle("CinematicTextButton", "Large text", large ? "ON" : "OFF", 2, "text")}
				</frame>
			)}
			{paused && (
				<frame
					key="CinematicPaused"
					ZIndex={4}
					Position={UDim2.fromOffset(frame.pausedChip.x, frame.pausedChip.y)}
					Size={UDim2.fromOffset(frame.pausedChip.width, frame.pausedChip.height)}
					BackgroundColor3={INK}
					BackgroundTransparency={0.35}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(1, 0)} />
					<uistroke Color={IVORY} Transparency={0.8} Thickness={1} />
					<textlabel
						key="Label"
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Text="PAUSED"
						TextSize={tiny ? 11 : 13}
						Font={Enum.Font.GothamBold}
						TextColor3={IVORY}
					/>
				</frame>
			)}
			{/* Soft gradient only where the caption needs contrast; the scene keeps the rest of the screen. */}
			<frame
				key="CinematicBackdrop"
				ZIndex={2}
				AnchorPoint={new Vector2(0, 1)}
				Position={UDim2.fromScale(0, 1)}
				Size={new UDim2(1, 0, 0, backdrop.height)}
				BackgroundColor3={INK}
				BorderSizePixel={0}
			>
				<uigradient
					Rotation={90}
					Transparency={
						new NumberSequence([
							new NumberSequenceKeypoint(0, 1),
							new NumberSequenceKeypoint(rowKey, 0.35),
							new NumberSequenceKeypoint(textKey, 0.24),
							new NumberSequenceKeypoint(1, 0.18),
						])
					}
				/>
			</frame>
			<frame
				key="CinematicDialogue"
				ZIndex={4}
				AnchorPoint={new Vector2(0, 1)}
				Position={UDim2.fromScale(0, 1)}
				Size={new UDim2(1, 0, 0, band.height)}
				BackgroundTransparency={1}
			>
				<frame
					key="CinematicSpeaker"
					Visible={!card}
					Position={at(frame.speaker).Position}
					Size={at(frame.speaker).Size}
					BackgroundTransparency={1}
				>
					<frame
						key="Swatch"
						AnchorPoint={new Vector2(0, 0.5)}
						Position={UDim2.fromScale(0, 0.5)}
						Size={UDim2.fromOffset(3, chipTextSize + 4)}
						BackgroundColor3={tone}
						BorderSizePixel={0}
					/>
					<textlabel
						ref={nameRef}
						key="SpeakerName"
						TextTransparency={hidden}
						Position={UDim2.fromOffset(11, 0)}
						Size={new UDim2(0, nameWidth, 1, 0)}
						BackgroundTransparency={1}
						Text={speaker.name}
						TextXAlignment={Enum.TextXAlignment.Left}
						TextSize={chipTextSize}
						Font={nameFont}
						TextColor3={tone}
					/>
					{speaker.role !== undefined && (
						<textlabel
							ref={roleRef}
							key="SpeakerRole"
							TextTransparency={hidden}
							Position={UDim2.fromOffset(roleX, 0)}
							Size={new UDim2(0, roleWidth, 1, 0)}
							BackgroundTransparency={1}
							Text={speaker.role}
							TextXAlignment={Enum.TextXAlignment.Left}
							TextSize={chipTextSize - 1}
							Font={Enum.Font.GothamMedium}
							TextColor3={MUTED}
							TextTruncate={Enum.TextTruncate.AtEnd}
						/>
					)}
				</frame>
				{frame.hint && (
					<textlabel
						key="Hint"
						Position={at(frame.hint).Position}
						Size={at(frame.hint).Size}
						BackgroundTransparency={1}
						Text={HINT[hintMode]}
						TextXAlignment={Enum.TextXAlignment.Right}
						TextSize={chipTextSize - 2}
						Font={Enum.Font.GothamMedium}
						TextColor3={FAINT}
					/>
				)}
				{control(
					"CinematicSettingsButton",
					frame.settingsButton,
					undefined,
					settingsOpen,
					<textlabel
						key="Label"
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						Text="Aa"
						TextSize={tiny ? 12 : 13}
						Font={Enum.Font.GothamBold}
						TextColor3={settingsOpen ? ACCENT : IVORY}
					/>,
					() => setSettingsOpen((open) => !open),
				)}
				{control("CinematicPauseButton", frame.pauseButton, "pause", paused, pauseIcon)}
				{control("CinematicSkipButton", frame.skipButton, "skip", false, skipContent)}
				<scrollingframe
					ref={subtitleRef}
					key="CinematicSubtitles"
					Visible={!card}
					Position={at(frame.text).Position}
					Size={at(frame.text).Size}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					CanvasSize={UDim2.fromOffset(0, textHeight)}
					ScrollBarThickness={overflow ? 3 : 0}
					ScrollingEnabled={overflow}
					ScrollingDirection={Enum.ScrollingDirection.Y}
					Selectable={overflow}
					Active={overflow}
				>
					<textlabel
						ref={bodyRef}
						key="CinematicLine"
						TextTransparency={hidden}
						MaxVisibleGraphemes={startVisible}
						Size={new UDim2(0, wrapWidth, 0, textHeight)}
						BackgroundTransparency={1}
						Text={current.text}
						TextWrapped={true}
						TextSize={layout.bodySize}
						TextXAlignment={Enum.TextXAlignment.Left}
						TextYAlignment={Enum.TextYAlignment.Top}
						TextColor3={speaker.tone === "log" ? Color3.fromRGB(214, 222, 214) : IVORY}
						Font={bodyFont(current)}
					/>
				</scrollingframe>
				<frame
					key="CinematicBeatTimer"
					Position={at(frame.progress).Position}
					Size={at(frame.progress).Size}
					BackgroundTransparency={1}
				>
					{segments}
				</frame>
			</frame>
			{/* Title card: the `black` shot keeps the screen black (top inset included) and centres the line in large ivory above the caption panel, chip small above it. */}
			{card && (
				<frame
					key="CinematicCard"
					ZIndex={3}
					Position={UDim2.fromOffset(0, -inset)}
					Size={new UDim2(1, 0, 1, inset)}
					BackgroundColor3={Color3.fromRGB(0, 0, 0)}
					BorderSizePixel={0}
				>
					{/* The coup's voice: a faint red vignette closing in from every edge. */}
					{cardVignette(speaker.tone) && (
						<frame
							key="Vignette"
							Size={UDim2.fromScale(1, 1)}
							BackgroundColor3={DANGER}
							BorderSizePixel={0}
						>
							<uigradient
								Rotation={90}
								Transparency={
									new NumberSequence([
										new NumberSequenceKeypoint(0, 0.72),
										new NumberSequenceKeypoint(0.3, 1),
										new NumberSequenceKeypoint(0.7, 1),
										new NumberSequenceKeypoint(1, 0.72),
									])
								}
							/>
						</frame>
					)}
					{cardVignette(speaker.tone) && (
						<frame
							key="VignetteSides"
							Size={UDim2.fromScale(1, 1)}
							BackgroundColor3={DANGER}
							BorderSizePixel={0}
						>
							<uigradient
								Rotation={0}
								Transparency={
									new NumberSequence([
										new NumberSequenceKeypoint(0, 0.78),
										new NumberSequenceKeypoint(0.25, 1),
										new NumberSequenceKeypoint(0.75, 1),
										new NumberSequenceKeypoint(1, 0.78),
									])
								}
							/>
						</frame>
					)}
					<frame
						key="Column"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.5, (inset - band.height) / 2)}
						Size={new UDim2(0, layout.textWidth, 0, 0)}
						AutomaticSize={Enum.AutomaticSize.Y}
						BackgroundTransparency={1}
					>
						<uilistlayout
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							Padding={new UDim(0, tiny ? 6 : 14)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						<textlabel
							ref={cardNameRef}
							key="CardSpeaker"
							TextTransparency={hidden}
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, chipTextSize + 10)}
							BackgroundTransparency={1}
							Text={speaker.role !== undefined ? `${speaker.name}  ·  ${speaker.role}` : speaker.name}
							TextSize={chipTextSize}
							Font={nameFont}
							TextColor3={tone}
						/>
						<textlabel
							ref={cardBodyRef}
							key="CardLine"
							TextTransparency={hidden}
							MaxVisibleGraphemes={startVisible}
							LayoutOrder={2}
							Size={new UDim2(1, 0, 0, 0)}
							AutomaticSize={Enum.AutomaticSize.Y}
							BackgroundTransparency={1}
							Text={current.text}
							TextWrapped={true}
							TextSize={math.floor(layout.bodySize * (tiny ? 1.2 : 1.5))}
							TextXAlignment={Enum.TextXAlignment.Center}
							TextColor3={IVORY}
							Font={cardFont}
							LineHeight={1.15}
						/>
					</frame>
				</frame>
			)}
			<frame
				ref={fadeRef}
				key="CinematicFade"
				ZIndex={6}
				Position={UDim2.fromOffset(0, -inset)}
				Size={new UDim2(1, 0, 1, inset)}
				BackgroundColor3={Color3.fromRGB(0, 0, 0)}
				BackgroundTransparency={0}
				BorderSizePixel={0}
			/>
		</frame>
	);
}
