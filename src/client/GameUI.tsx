import { VoiceDisclosureNotice } from "./VoiceDisclosureNotice";
import { chapterBeforeMission, shouldPlayChapter } from "../shared/RelayStory";
import { canLaunchMission, highestUnlocked } from "../shared/CampaignProgress";
import { isMissionReason } from "../shared/OutcomeReason";
import { DeletionObservation } from "../shared/DeletionObservation";
import { stickVector, TouchSticks } from "../shared/TouchSticks";
import { initialTelemetry } from "../shared/InitialTelemetry";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "@rbxts/react";
import { flightWarning } from "../shared/FlightWarnings";
import { RadioQueue, type RadioLine } from "../shared/RadioQueue";
import { Voice } from "../shared/VoiceLines";
import { type VoiceHandle, VoicePlayer } from "./VoicePlayer";
import { effectiveHudScale, type PlayerSettings, type SettingKey } from "../shared/PlayerSettings";
import { PauseOverlay, SettingsSheet } from "./HudControls";
import { SettingsStore, useSettings } from "./SettingsStore";
import type { FlightTrend } from "./FlightController";
import ReactRoblox from "@rbxts/react-roblox";
import { GuiService, RunService, UserInputService, Workspace } from "@rbxts/services";
import type { CampaignResponse, MissionFinished, MissionLoading, MissionMessage, MissionStarted, Persistence, Remotes, SaveSlot, Telemetry } from "../shared/Types";
import { MissionCatalog, MISSION_COUNT } from "../shared/MissionCatalog";
import { MissionScore } from "../shared/MissionScore";
import { WeaponRules } from "../shared/WeaponRules";
import { SpecialKind, SpecialWeapons } from "../shared/SpecialWeapons";
import { C, HUD } from "./Theme";
import { Difficulty, DifficultyKind } from "../shared/Difficulty";
import { RelayCinematic } from "./RelayCinematic";
import { FlightController } from "./FlightController";
import { CameraShake } from "./CameraShake";
import type { KillFlash } from "./KillMarker";
import { ImpactFeedback } from "../shared/ImpactFeedback";
import { LoadingScreen } from "./LoadingScreen";
import { preloadMission } from "./MissionPreload";
import { getMenuHintsLayout, getMenuLayout, getToastLayout, inputModeFromInputType, JOYSTICK_SIZE, type HudOptions, shouldAcceptInputModeChange, type ControlHint, type InputMode, type Rectangle } from "../shared/UILayout";
import { BriefingScreen } from "./screens/BriefingScreen";
import { CampaignScreen } from "./screens/CampaignScreen";
import { MenuBackdrop, setMenuCamera } from "./screens/MenuBackdrop";
import { MissionHud, type Callout } from "./screens/MissionHud";
import { OutcomeScreen, type OutcomeState } from "./screens/OutcomeScreen";
import { HintRow } from "./screens/Primitives";
import { finite, killedTargetPoint, killSnapshot, normalizePersistence, normalizeSlots, RADIO_SECONDS, resumeMission, safeString, sanitizeTelemetry, scaleRectangle } from "./screens/UIFormat";
import { glyphCache, readInputMode } from "./screens/UIInput";
import { TitleScreen } from "./screens/TitleScreen";
import { StatusToast } from "./screens/StatusToast";
import { FIRE_DENIED_SECONDS, FIRE_DENIED_TEXT, LOADING_CLIENT_TIMEOUT, MENU_SCREEN_FRAMES, MISSION_END_HOLD, NO_MENU_CAMERA, type GameUIProps, type KillNotice, type RadioNotice, type Screen, type ToastState } from "./screens/UIState";
import { InputModeContext } from "./Highlight";
export function GameUI({ remotes, controller }: GameUIProps) {
	const [cinematicId,setCinematicId]=useState(0);
	const cinematicNext=useRef<()=>void>(()=>undefined);
	const [screen, setScreen] = useState<Screen>("title");
	const [viewport, setViewport] = useState(new Vector2(568, 320));
	const [slots, setSlots] = useState<SaveSlot[] | undefined>();
	const [persistence, setPersistence] = useState<Persistence>("unavailable");
	const [selectedSlot, setSelectedSlot] = useState(1);
	const [selectedMission, setSelectedMission] = useState(1);
	const [selectedSpecial, setSelectedSpecial] = useState<SpecialKind>(SpecialWeapons.Default);
	const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyKind>(Difficulty.Default);
	const [busy, setBusy] = useState(false);
	const [toast, setToast] = useState<ToastState | undefined>();
	const [telemetry, setTelemetry] = useState(() => initialTelemetry(1));
	const [outcome, setOutcome] = useState<OutcomeState>(() => ({
		won: true, missionId: 1, airKills: 0, optionalKills: 0, groundKills: 0, elapsed: 0, par: MissionScore.ParSeconds(MissionCatalog.Get(1)),
		completedPhases: 0, missilesFired: 0, missileHits: 0, damageTaken: 0, lowestHealth: 100, evades: 0,
		score: 0, rank: "D", newBestScore: false, newBestRank: false, saveText: "", saveColor: C.Muted,
	}));
	const [inputMode, setInputMode] = useState<InputMode>(readInputMode);
	const [hintUntil, setHintUntil] = useState(0);
	const [killNotice, setKillNotice] = useState<KillNotice | undefined>();
	// Radio lines queue (2.5 s minimum each, 3 waiting) instead of overwriting each other.
	const radioQueue = useMemo(() => new RadioQueue(), []);
	// The radio runs on its own clock that stops while the sortie is paused, so a line (and its voice) resumes where it was.
	const radioClockRef = useRef<{ offset: number; pausedAt?: number }>({ offset: 0 });
	const radioNow = () => (radioClockRef.current.pausedAt ?? os.clock()) - radioClockRef.current.offset;
	// The voice of the visible radio line (silent until its bank is uploaded).
	const radioVoiceRef = useRef<VoiceHandle>();
	const radioVoiceLineRef = useRef<RadioLine>();
	const [, setRadioSerial] = useState(0);
	const [fireNotice, setFireNotice] = useState<RadioNotice | undefined>();
	const settings = useSettings();
	const [paused, setPausedState] = useState(false);
	const pausedRef = useRef(false);
	const [settingsOpen, setSettingsOpenState] = useState(false);
	const settingsOpenRef = useRef(false);
	/** The app lost focus (and has not regained it) — remembered across loading/cutscene so a sortie that starts behind it pauses. */
	const focusLostRef = useRef(false);
	const pauseSortieRef = useRef<() => void>(() => undefined);
	// Client flight trend (airspeed bleed, time to terrain); only re-renders when the warning it implies changes.
	const [trend, setTrend] = useState<FlightTrend>({ acceleration: 0 });
	const trendRef = useRef<FlightTrend>({ acceleration: 0 });
	const hudScaleRef = useRef(1);
	const hudScale = effectiveHudScale(settings.hudScale, inputMode === "touch", viewport.X, viewport.Y);
	hudScaleRef.current = hudScale;
	// The layout knows its UIScale so it can keep every HUD label at MIN_PHYSICAL_TEXT px or larger.
	const hudOptions = useMemo<HudOptions>(() => ({ stickSize: JOYSTICK_SIZE * settings.stickScale, scale: hudScale }), [settings.stickScale, hudScale]);
	const [damageUntil, setDamageUntil] = useState(0);
	const [killFlash, setKillFlash] = useState<KillFlash | undefined>();
	const killSerialRef = useRef(0);
	/** The selection before the latest target change: a kill's HudState can retarget before its telemetry lands. */
	const priorTargetRef = useRef<Model>();
	const [loadingProgress, setLoadingProgress] = useState(0);
	const mountedRef = useRef(true);
	const screenRef = useRef<Screen>("title");
	const inMissionRef = useRef(false);
	const requestRef = useRef(0);
	const busyRef = useRef(false);
	const toastRef = useRef(0);
	const selectedSlotRef = useRef(1);
	const [confirmSlot, setConfirmSlot] = useState<number>();
	const confirmSlotRef = useRef<number>();
	const slotFocusRef = useRef<number>();
	const selectDefaultRef = useRef<() => void>(() => undefined);
	const selectedMissionRef = useRef(1);
	const selectedSpecialRef = useRef<SpecialKind>(SpecialWeapons.Default);
	const selectedDifficultyRef = useRef<DifficultyKind>(Difficulty.Default);
	const persistenceRef = useRef<Persistence>("unavailable");
	const telemetryRef = useRef(initialTelemetry(1));
	const inputModeRef = useRef<InputMode>(inputMode);
	const outcomeWonRef = useRef(true);
	const outcomeMissionRef = useRef(1);
	const rootFrameRef = useRef<Frame>();
	const joystickRef = useRef<Frame>();
	const knobRef = useRef<Frame>();
	const touches = useMemo(() => new TouchSticks<InputObject>(), []);
	const touchEndConnections = useMemo(() => new Map<InputObject, RBXScriptConnection>(), []);
	const throttleJoystickRef = useRef<Frame>();
	const throttleKnobRef = useRef<Frame>();
	const loadingSerialRef = useRef(0);
	const slotsRef = useRef<SaveSlot[] | undefined>();
	const deletionObservation = useMemo(() => new DeletionObservation(), []);
	const changeScreen = useCallback((destination: Screen) => {
		deletionObservation.cancel();
		screenRef.current = destination;
		inMissionRef.current = destination === "mission";
		if (destination !== "mission" && pausedRef.current) { pausedRef.current = false; setPausedState(false); }
		setScreen(destination);
	}, []);
	const releaseJoystick = useCallback(() => {
		for (const [, connection] of touchEndConnections) connection.Disconnect();
		touchEndConnections.clear();
		touches.Clear();
		controller.SetTouchThrottleAxis(0);
		if (throttleKnobRef.current) throttleKnobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		if (knobRef.current) knobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		controller.SetInput(0, 0);
	}, [controller]);
	const applyInputMode = useCallback((nextMode: InputMode) => {
		const current = inputModeRef.current;
		if (!shouldAcceptInputModeChange(current, nextMode, touches.Held())) return;
		if (current === "touch") releaseJoystick();
		inputModeRef.current = nextMode;
		glyphCache.clear();
		if (!mountedRef.current) return;
		setInputMode(nextMode);
		setHintUntil(os.clock() + 6);
	}, [releaseJoystick]);
	const endJoystickTouch = useCallback(() => {
		releaseJoystick();
		applyInputMode(readInputMode());
	}, [applyInputMode, releaseJoystick]);
	// Gamepad focus follows the delete confirmation: KEEP while it is open, then back to that slot's row.
	const setDeleteConfirm = useCallback((slot: number | undefined) => {
		if (slot !== undefined) slotFocusRef.current = slot;
		confirmSlotRef.current = slot;
		setConfirmSlot(slot);
		task.defer(() => selectDefaultRef.current());
	}, []);
	const askDelete = useCallback((slot: number) => setDeleteConfirm(slot), [setDeleteConfirm]);
	const cancelDelete = useCallback(() => setDeleteConfirm(undefined), [setDeleteConfirm]);
	const selectDefault = useCallback(() => {
		const root = rootFrameRef.current;
		if (!root || !mountedRef.current) return;
		const current = screenRef.current;
		const selected = GuiService.SelectedObject;
		// Overlays (pause card, settings sheet) take gamepad focus over whatever screen is under them.
		if (inputModeRef.current === "gamepad" && (settingsOpenRef.current || (current === "mission" && pausedRef.current))) {
			const overlay = root.FindFirstChild(settingsOpenRef.current ? "SettingsSheet" : "PauseOverlay", true);
			if (!overlay) return;
			if (selected && selected.IsDescendantOf(overlay)) return;
			const first = overlay.FindFirstChild(settingsOpenRef.current ? "SettinginvertYToggle" : "PauseResumeButton", true);
			if (first?.IsA("GuiObject")) GuiService.SelectedObject = first;
			return;
		}
		if (current === "mission" || current === "loading" || inputModeRef.current !== "gamepad") {
			if (selected && selected.IsDescendantOf(root)) GuiService.SelectedObject = undefined;
			return;
		}
		const screenFrame = root.FindFirstChild(MENU_SCREEN_FRAMES[current]);
		if (!screenFrame) return;
		if (selected && selected.IsDescendantOf(screenFrame)) return;
		const defaultName = current === "cinematic" ? "CinematicSkipButton" : current === "title"
			? "CampaignButton"
			: current === "slots"
				? confirmSlotRef.current !== undefined ? "KeepButton" : `Slot${slotFocusRef.current ?? selectedSlotRef.current}Button`
				: current === "briefing"
					? "LaunchButton"
					: outcomeWonRef.current && outcomeMissionRef.current < MISSION_COUNT && MissionCatalog.Available(outcomeMissionRef.current+1) ? "Mission1NextMissionButton" : outcomeWonRef.current ? "ReturnToMenuButton" : "RetryButton";
		const target = screenFrame.FindFirstChild(defaultName, true);
		if (target && target.IsA("GuiObject")) GuiService.SelectedObject = target;
	}, []);
	selectDefaultRef.current = selectDefault;
	const goBack = useCallback(() => {
		if (settingsOpenRef.current) { settingsOpenRef.current = false; setSettingsOpenState(false); task.defer(() => selectDefaultRef.current()); return; }
		if (busyRef.current) return;
		if (screenRef.current === "slots" && confirmSlotRef.current !== undefined) setDeleteConfirm(undefined);
		else if (screenRef.current === "slots") changeScreen("title");
		else if (screenRef.current === "briefing") changeScreen("slots");
	}, [changeScreen]);
	/** `sticky` keeps the toast until another toast or the Loading screen replaces it (a queued launch). */
	const showToast = useCallback((message: string, isError: boolean, sticky = false) => {
		if (!mountedRef.current) return;
		const serial = ++toastRef.current;
		setToast({ message, isError });
		if (sticky) return;
		task.delay(4, () => {
			if (mountedRef.current && toastRef.current === serial) setToast(undefined);
		});
	}, []);
	const applyResponseSlots = useCallback((response: CampaignResponse): boolean => {
		const parsed = normalizeSlots(response);
		if (!parsed) return false;
		slotsRef.current = parsed;
		setSlots(parsed);
		const responsePersistence = normalizePersistence(response.persistence);
		persistenceRef.current = responsePersistence;
		setPersistence(responsePersistence);
		return true;
	}, []);
	const invoke = useCallback((action: string, payload?: unknown): LuaTuple<[CampaignResponse | undefined, string | undefined]> => {
		const [ok, raw] = pcall(() => remotes.CampaignRequest.InvokeServer(action, payload));
		if (!ok) return $tuple(undefined, "Command link interrupted. Try again.");
		if (!typeIs(raw, "table")) return $tuple(undefined, "Command rejected the request.");
		const response = raw as CampaignResponse;
		if (response.ok !== true) return $tuple(undefined, safeString(response.error, "Command rejected the request."));
		return $tuple(response, undefined);
	}, [remotes]);
	const beginRequest = useCallback((work: (requestId: number) => void) => {
		if (busyRef.current || !mountedRef.current) return;
		busyRef.current = true;
		setBusy(true);
		const requestId = ++requestRef.current;
		task.spawn(() => {
			const [ok, problem] = pcall(() => work(requestId));
			if (!ok && mountedRef.current && requestRef.current === requestId) {
				warn("SKYBREAK UI request failed:", problem);
				showToast("Command link error. Try again.", true);
			}
			if (mountedRef.current && requestRef.current === requestId) {
				busyRef.current = false;
				setBusy(false);
			}
		});
	}, [showToast]);
	const cancelRequests = useCallback(() => {
		requestRef.current++;
		busyRef.current = false;
		if (mountedRef.current) setBusy(false);
	}, []);
	const loadSlots = useCallback(() => {
		slotsRef.current = undefined;
		setSlots(undefined);
		beginRequest((requestId) => {
			const [response, problem] = invoke("ListSlots");
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!response) {
				persistenceRef.current = "unavailable";
				setPersistence("unavailable");
				showToast(problem ?? "Command link interrupted. Try again.", true);
			} else if (!applyResponseSlots(response)) {
				showToast("Flight records returned an invalid response.", true);
			}
		});
	}, [applyResponseSlots, beginRequest, invoke, showToast]);
	const launchMission = useCallback(() => {
		beginRequest((requestId) => {
			const [response, problem] = invoke("StartMission", { slot: selectedSlot, missionId: selectedMission, special: selectedSpecialRef.current, difficulty: selectedDifficultyRef.current });
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!response) showToast(problem ?? "Command rejected the request.", true);
			else {
				if (response.slots) applyResponseSlots(response);
				if (screenRef.current !== "mission") showToast("Clearance received. Preparing aircraft...", false);
			}
		});
	}, [applyResponseSlots, beginRequest, invoke, selectedMission, selectedSlot, showToast]);
	const startMission=useCallback(()=>{
		if(busyRef.current || !canLaunchMission(selectedMissionRef.current, slots?.[selectedSlotRef.current-1]))return;
		const chapter=chapterBeforeMission(selectedMissionRef.current);
		// A chapter already seen on this slot (retry or replay) goes straight to launch.
		const seen=slots?.[selectedSlotRef.current-1]?.cutscenesSeen;
		const completed=slots?.[selectedSlotRef.current-1]?.missions?.[selectedMissionRef.current]?.completed===true;
		if(!shouldPlayChapter(selectedMissionRef.current,seen,completed)){launchMission();return;}
		cinematicNext.current=launchMission;
		setCinematicId(chapter);
		changeScreen("cinematic");
	},[launchMission,changeScreen,slots]);
	const returnToMenu = useCallback(() => {
		cancelRequests();
		releaseJoystick();
		controller.Stop();
		changeScreen("title");
		setMenuCamera();
		beginRequest((requestId) => {
			const [response, problem] = invoke("ReturnToMenu");
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!response) showToast(problem ?? "Command link interrupted. Try again.", true);
			else if (response.slots) applyResponseSlots(response);
		});
	}, [applyResponseSlots, beginRequest, cancelRequests, changeScreen, controller, invoke, releaseJoystick, showToast]);
	const restartMission = useCallback((missionId: number) => {
		beginRequest((requestId) => {
			const [returned, returnError] = invoke("ReturnToMenu");
			if (!mountedRef.current || requestRef.current !== requestId) return;
			if (!returned) {
				showToast(returnError ?? "Command link interrupted. Try again.", true);
				return;
			}
			if (returned.slots) applyResponseSlots(returned);
			task.wait(0.16);
			if (!mountedRef.current || requestRef.current !== requestId) return;
			selectedMissionRef.current = missionId;
			setSelectedMission(missionId);
			changeScreen("briefing");
		});
	}, [applyResponseSlots, beginRequest, changeScreen, invoke, showToast]);
	const retryMission = useCallback(() => restartMission(selectedMissionRef.current), [restartMission]);
	const nextMission = useCallback(() => { const id = selectedMissionRef.current+1; if(canLaunchMission(id,slots?.[selectedSlotRef.current-1])) restartMission(id); }, [restartMission, slots]);
	// Stable handlers so the memoised menu screens bail out of mission-time re-renders.
	const openCampaign = useCallback(() => { if (!busyRef.current) { changeScreen("slots"); loadSlots(); } }, [changeScreen, loadSlots]);
	const chooseSlot = useCallback((slot: number) => {
		const current = slotsRef.current;
		if (busyRef.current || !current?.[slot - 1]) return;
		const missionId = highestUnlocked(current[slot - 1]);
		selectedSlotRef.current = slot; selectedMissionRef.current = missionId;
		setSelectedSlot(slot); setSelectedMission(missionId);
		// The slot remembers its last loadout; a fresh slot starts on the default special.
		const remembered = current[slot - 1].special;
		const special: SpecialKind = SpecialWeapons.IsKind(remembered) ? remembered : SpecialWeapons.Default;
		selectedSpecialRef.current = special; setSelectedSpecial(special);
		const rememberedDifficulty = current[slot - 1].difficulty;
		const difficulty: DifficultyKind = Difficulty.IsKind(rememberedDifficulty) ? rememberedDifficulty : Difficulty.Default;
		selectedDifficultyRef.current = difficulty; setSelectedDifficulty(difficulty);
		changeScreen("briefing");
	}, [changeScreen]);
	const deleteSlot = useCallback((slot: number) => {
		deletionObservation.cancel();
		const observationToken = deletionObservation.capture();
		setDeleteConfirm(undefined);
		beginRequest((requestId) => {
			const [response, problem] = invoke("DeleteSlot", { slot });
			if (!mountedRef.current || requestRef.current !== requestId || !deletionObservation.current(observationToken)) return;
			if (!response) showToast(problem ?? "Command rejected the request.", true);
			else if (!applyResponseSlots(response)) showToast("Flight records returned an invalid response.", true);
			else {
				const deletion = response.deletions?.find((entry) => entry.slot === slot);
				const report = (status?: string) => {
					const name = `Save ${string.format("%02d", slot)}`;
					if (status === "confirmed") showToast(`${name} deletion confirmed in cloud.`, false);
					else if (status === "session-only") showToast(`${name} deleted for this session only. Cloud saves are disabled.`, true);
					else if (status === "failed") showToast(`${name} deleted here; cloud deletion is unconfirmed after saving. It may return next session.`, true);
					else showToast(`${name} deleted here; cloud confirmation pending. It may return next session.`, true);
				};
				report(deletion?.status);
				if (deletion?.status === "pending") task.spawn(() => {
					// Observe the original generation. Never resend a destructive command.
					for (let attempt = 0; attempt < 10; attempt++) {
						task.wait(3);
						if (!mountedRef.current || requestRef.current !== requestId || !deletionObservation.current(observationToken)) return;
						let finished = false;
						deletionObservation.read(observationToken,
							() => mountedRef.current && requestRef.current === requestId,
							() => { const [latest] = invoke("DeletionStatus"); return { latest }; }, ({ latest }) => {
								const current = latest?.deletions?.find((entry) => entry.slot === slot && entry.generation === deletion.generation);
								if (current && current.status !== "pending") { report(current.status); finished = true; }
							});
						if (finished) return;
					}
				});
			}
		});
	}, [applyResponseSlots, beginRequest, invoke, setDeleteConfirm, showToast]);
	const chooseMission = useCallback((missionId: number) => { selectedMissionRef.current = missionId; setSelectedMission(missionId); }, []);
	const chooseSpecial = useCallback((kind: SpecialKind) => { selectedSpecialRef.current = kind; setSelectedSpecial(kind); }, []);
	const chooseDifficulty = useCallback((kind: DifficultyKind) => { selectedDifficultyRef.current = kind; setSelectedDifficulty(kind); }, []);
	// Always send: the server either launches (guided or blind) or answers with `fireDenied`, so a press is never silent.
	const fireMissile = useCallback(() => controller.FireMissile(), [controller]);
	const cycleTarget = useCallback(() => controller.CycleTarget(), [controller]);
	const fireSpecial = useCallback(() => controller.Special(), [controller]);
	const evadeNow = useCallback(() => controller.Evade(), [controller]);
	const setSettingsOpen = useCallback((open: boolean) => {
		settingsOpenRef.current = open;
		setSettingsOpenState(open);
		task.defer(() => selectDefaultRef.current());
	}, []);
	/** Pause: the server stops stepping and holds the clock; the server resumes when the pause budget expires. */
	const pauseSortie = useCallback(() => {
		if (pausedRef.current || screenRef.current !== "mission" || !controller.active) return;
		if (telemetryRef.current.pauseRemaining === 0) {
			setFireNotice({ text: "PAUSE SPENT · FLIGHT CONTINUES", until: os.clock() + 5 });
			return;
		}
		pausedRef.current = true;
		setPausedState(true);
		releaseJoystick();
		controller.SetPaused(true);
		task.defer(() => selectDefaultRef.current());
	}, [controller, releaseJoystick]);
	pauseSortieRef.current = pauseSortie;
	const resumeSortie = useCallback(() => {
		if (!pausedRef.current) return;
		pausedRef.current = false;
		setPausedState(false);
		setSettingsOpen(false);
		controller.SetPaused(false);
	}, [controller, setSettingsOpen]);
	const changeSetting = useCallback(<K extends SettingKey>(key: K, value: PlayerSettings[K]) => SettingsStore.Set(key, value), []);
	const openSettings = useCallback(() => { if (!busyRef.current) setSettingsOpen(true); }, [setSettingsOpen]);
	// Settings that live outside React: pitch inversion and level assist in the controller (shake is read by CameraShake).
	useEffect(() => controller.SetInvertY(settings.invertY), [controller, settings.invertY]);
	useEffect(() => controller.SetLevelAssist(settings.levelAssist), [controller, settings.levelAssist]);
	// Auto-pause when the Roblox menu opens (Esc, the menu button, the gamepad Start menu) or the app loses focus.
	useEffect(() => {
		const menuOpened = GuiService.MenuOpened.Connect(pauseSortie);
		// Studio playtests (scripted pilots) lose window focus constantly; there, focus-loss pausing
		// is opt-in with Workspace attribute SkybreakAutoPause = true. Live clients always pause.
		const focusLost = UserInputService.WindowFocusReleased.Connect(() => {
			if (!RunService.IsStudio() || Workspace.GetAttribute("SkybreakAutoPause") === true) { focusLostRef.current = true; pauseSortie(); }
		});
		const focusGained = UserInputService.WindowFocused.Connect(() => { focusLostRef.current = false; });
		// P pauses and resumes on a keyboard (a deliberate press, like the RESUME button).
		const key = UserInputService.InputBegan.Connect((input, processed) => {
			if (processed || input.KeyCode !== Enum.KeyCode.P || screenRef.current !== "mission" || UserInputService.GetFocusedTextBox()) return;
			if (pausedRef.current) { if (!settingsOpenRef.current) resumeSortie(); } else pauseSortie();
		});
		return () => { menuOpened.Disconnect(); focusLost.Disconnect(); focusGained.Disconnect(); key.Disconnect(); };
	}, [pauseSortie, resumeSortie]);
	const moveJoystick = useCallback((input: InputObject) => {
		const joystick = joystickRef.current;
		const knob = knobRef.current;
		if (!joystick || !knob || !inMissionRef.current) return;
		const stick = stickVector(input.Position.X, input.Position.Y, joystick.AbsolutePosition.X, joystick.AbsolutePosition.Y, joystick.AbsoluteSize.X);
		// The knob sits inside the (possibly HUD-scaled) frame: convert screen pixels back to its units.
		const unit = joystick.AbsoluteSize.X / math.max(1, joystick.Size.X.Offset);
		knob.Position = new UDim2(0.5, stick.offsetX / unit, 0.5, stick.offsetY / unit);
		controller.SetInput(stick.x, stick.y);
	}, [controller]);
	const releaseTouch = useCallback((input: InputObject) => {
		if (touches.steering === input) {
			controller.SetInput(0, 0);
			if (knobRef.current) knobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		}
		if (touches.throttle === input) {
			controller.SetTouchThrottleAxis(0);
			if (throttleKnobRef.current) throttleKnobRef.current.Position = UDim2.fromScale(0.5, 0.5);
		}
		touchEndConnections.get(input)?.Disconnect();
		touchEndConnections.delete(input);
		touches.End(input);
		applyInputMode(readInputMode());
	}, [controller, touches, applyInputMode]);
	const trackTouchEnd = useCallback((input: InputObject) => {
		touchEndConnections.set(input, input.GetPropertyChangedSignal("UserInputState").Connect(() => {
			if (input.UserInputState === Enum.UserInputState.End || input.UserInputState === Enum.UserInputState.Cancel) releaseTouch(input);
		}));
	}, [releaseTouch, touchEndConnections]);
	const joystickBegan = useCallback((input: InputObject) => {
		if (!inMissionRef.current || GuiService.MenuIsOpen || UserInputService.GetFocusedTextBox() || inputModeRef.current !== "touch" || input.UserInputType !== Enum.UserInputType.Touch) return;
		if (!touches.Begin("steering", input)) return;
		trackTouchEnd(input);
		moveJoystick(input);
	}, [moveJoystick, trackTouchEnd]);
	const moveThrottle = useCallback((input: InputObject) => {
		const stick = throttleJoystickRef.current;
		const knob = throttleKnobRef.current;
		if (!stick || !knob || !inMissionRef.current) return;
		const radius = math.max(1, stick.AbsoluteSize.Y * 0.34);
		const offset = math.clamp(input.Position.Y - stick.AbsolutePosition.Y - stick.AbsoluteSize.Y / 2, -radius, radius);
		const unit = stick.AbsoluteSize.Y / math.max(1, stick.Size.Y.Offset);
		knob.Position = new UDim2(0.5, 0, 0.5, offset / unit);
		controller.SetTouchThrottleAxis(-offset / radius);
	}, [controller]);
	const throttleBegan = useCallback((input: InputObject) => {
		if (!inMissionRef.current || GuiService.MenuIsOpen || UserInputService.GetFocusedTextBox() || inputModeRef.current !== "touch" || input.UserInputType !== Enum.UserInputType.Touch) return;
		if (!touches.Begin("throttle", input)) return;
		trackTouchEnd(input);
		moveThrottle(input);
	}, [moveThrottle, trackTouchEnd]);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			requestRef.current++;
			toastRef.current++;
			for (const [, connection] of touchEndConnections) connection.Disconnect();
			touchEndConnections.clear();
			touches.Clear();
			controller.SetTouchThrottleAxis(0);
			controller.SetInput(0, 0);
			controller.Stop();
		};
	}, [controller]);
	useEffect(() => {
		const refresh = () => applyInputMode(readInputMode());
		const connections = [UserInputService.LastInputTypeChanged.Connect(refresh)];
		const [hasPreferred, signal] = pcall(() => UserInputService.GetPropertyChangedSignal("PreferredInput"));
		if (hasPreferred) connections.push(signal.Connect(refresh));
		refresh();
		return () => {
			for (const connection of connections) connection.Disconnect();
		};
	}, [applyInputMode]);
	useEffect(() => {
		const changed = UserInputService.InputChanged.Connect((input) => {
			const active = touches.steering;
			if (input.UserInputState === Enum.UserInputState.Cancel || input.UserInputState === Enum.UserInputState.End) { releaseTouch(input); return; }
			if (active && input === active) moveJoystick(input);
			if (input === touches.throttle) moveThrottle(input);
		});
		const ended = UserInputService.InputEnded.Connect(releaseTouch);
		const focus = UserInputService.WindowFocusReleased.Connect(endJoystickTouch);
		const menu = GuiService.MenuOpened.Connect(endJoystickTouch);
		const textFocus = UserInputService.TextBoxFocused.Connect(endJoystickTouch);
		return () => {
			changed.Disconnect();
			ended.Disconnect();
			focus.Disconnect(); menu.Disconnect(); textFocus.Disconnect();
		};
	}, [endJoystickTouch, moveJoystick, moveThrottle, releaseTouch]);
	useEffect(() => {
		if (screen !== "mission") releaseJoystick();
	}, [releaseJoystick, screen]);
	useEffect(() => releaseJoystick(), [releaseJoystick, viewport, hudOptions, settings.hudScale]);
	useEffect(() => {
		task.defer(selectDefault);
	}, [busy, inputMode, screen, paused, settingsOpen, selectDefault]);
	// Leaving the slot list drops any half-finished delete confirmation.
	useEffect(() => {
		slotFocusRef.current = undefined;
		if (screen !== "slots" && confirmSlotRef.current !== undefined) setDeleteConfirm(undefined);
	}, [screen, setDeleteConfirm]);
	useEffect(() => {
		const began = UserInputService.InputBegan.Connect((input) => {
			if (screenRef.current === "mission" || GuiService.MenuIsOpen) return;
			if (inputModeFromInputType(input.UserInputType.Name) !== "gamepad") return;
			if (input.KeyCode === Enum.KeyCode.ButtonB) goBack();
			task.defer(selectDefault);
		});
		const changed = UserInputService.InputChanged.Connect((input) => {
			if (screenRef.current === "mission" || input.KeyCode !== Enum.KeyCode.Thumbstick1) return;
			if (GuiService.SelectedObject === undefined && input.Position.Magnitude > 0.5) task.defer(selectDefault);
		});
		return () => {
			began.Disconnect();
			changed.Disconnect();
		};
	}, [goBack, selectDefault]);
	useEffect(() => {
		const onMissionState = (raw: unknown, held = false): void => {
			if (!mountedRef.current || !typeIs(raw, "table")) return;
			const payload = raw as MissionMessage;
			if (payload.kind === "Queued") {
				// The last sortie's world is still being cleared; the launch request stays open and proceeds by itself.
				showToast("Clearing the last sortie. Your launch is queued...", false, true);
				return;
			}
			if (payload.kind === "Loading") {
				const loading = payload as MissionLoading;
				const slot = math.clamp(math.floor(finite(loading.slot, selectedSlotRef.current)), 1, 4);
				const missionId = MissionCatalog.IsValidId(loading.missionId) ? loading.missionId : 1;
				selectedSlotRef.current = slot; setSelectedSlot(slot);
				selectedMissionRef.current = missionId; setSelectedMission(missionId);
				toastRef.current++; setToast(undefined);
				setLoadingProgress(0);
				changeScreen("loading");
				const serial = ++loadingSerialRef.current;
				const alive = () => mountedRef.current && loadingSerialRef.current === serial && screenRef.current === "loading";
				task.spawn(() => {
					const expected = finite(loading.expectedParts, 0) > 0 ? loading.expectedParts : undefined;
					const ready = preloadMission(loading.aircraft, expected, alive, (fraction) => { if (alive()) setLoadingProgress(fraction); });
					if (ready) remotes.CombatAction.FireServer({ action: "Ready" });
				});
				task.delay(LOADING_CLIENT_TIMEOUT, () => {
					if (!alive()) return;
					loadingSerialRef.current++;
					changeScreen("briefing");
					showToast("The aircraft never reported ready. Request another launch.", true);
					beginRequest((requestId) => {
						const [response] = invoke("ReturnToMenu");
						if (!mountedRef.current || requestRef.current !== requestId) return;
						if (response?.slots) applyResponseSlots(response);
					});
				});
			} else if (payload.kind === "Started") {
				loadingSerialRef.current++;
				const started = payload as MissionStarted;
				const slot = math.clamp(math.floor(finite(started.slot, selectedSlotRef.current)), 1, 4);
				const missionId = MissionCatalog.IsValidId(started.missionId) ? started.missionId : 1;
				selectedSlotRef.current = slot;
				setSelectedSlot(slot);
				selectedMissionRef.current = missionId;
				setSelectedMission(missionId);
				toastRef.current++;
				setToast(undefined);
				setKillNotice(undefined);
				setKillFlash(undefined);
				radioQueue.Clear();
				setFireNotice(undefined);
				priorTargetRef.current = undefined;
				setDamageUntil(0);
				const resetTelemetry = initialTelemetry(missionId);
				telemetryRef.current = resetTelemetry;
				setTelemetry(resetTelemetry);
				if (!controller.Start(started)) {
					cancelRequests();
					changeScreen("briefing");
					showToast("Aircraft link failed. Request another launch.", true);
					beginRequest((requestId) => {
						const [response] = invoke("ReturnToMenu");
						if (!mountedRef.current || requestRef.current !== requestId) return;
						if (response?.slots) applyResponseSlots(response);
					});
					return;
				}
				changeScreen("mission");
				// A menu opened or focus lost during loading/cutscene fires no new event once flight starts: pause now.
				task.defer(() => { if (GuiService.MenuIsOpen || focusLostRef.current) pauseSortieRef.current(); });
				const [ok, initial] = pcall(() => controller.GetTelemetry());
				if (ok && typeIs(initial, "table")) {
					const sanitized = sanitizeTelemetry(initial as Telemetry, telemetryRef.current);
					telemetryRef.current = sanitized;
					setTelemetry(sanitized);
				}
			} else if (payload.kind === "Completed" || payload.kind === "Failed") {
				if (!inMissionRef.current) return;
				if (!held) {
					// Hold the flight view so the last kill callout, the ace hit-stop or the player's own explosion plays out first.
					const serial = loadingSerialRef.current;
					task.delay(MISSION_END_HOLD, () => { if (loadingSerialRef.current === serial) onMissionState(raw, true); });
					return;
				}
				const finished = payload as MissionFinished;
				releaseJoystick();
				controller.Stop();
				setMenuCamera();
				const current = telemetryRef.current;
				const won = finished.kind === "Completed";
				controller.ResultAudio(won);
				const missionId = MissionCatalog.IsValidId(finished.missionId) ? finished.missionId : current.missionId ?? 1;
				selectedMissionRef.current = missionId;
				setSelectedMission(missionId);
				outcomeWonRef.current = won;
				outcomeMissionRef.current = missionId;
				if(won && missionId===MISSION_COUNT) {
					setCinematicId(MISSION_COUNT);cinematicNext.current=()=>changeScreen("outcome");changeScreen("cinematic");
				} else changeScreen("outcome");
				const resultPersistence = normalizePersistence(finished.persistence ?? persistenceRef.current);
				const saveText = won && finished.saved === true && resultPersistence === "cloud"
					? "FLIGHT RECORD SAVED TO CLOUD"
					: resultPersistence === "session"
						? "RESULT HELD FOR THIS SESSION ONLY"
						: resultPersistence === "unavailable"
							? "SAVE SERVICE UNAVAILABLE — RESULT MAY NOT PERSIST"
							: won ? "RESULT RECEIVED — SAVE NOT CONFIRMED" : "";
				const count = (value: unknown, fallback = 0) => math.max(0, math.floor(finite(value, fallback)));
				const kills = count(finished.kills, current.kills);
				const groundKills = math.min(kills, count(finished.groundKills, current.groundKills ?? 0));
				const elapsed = math.max(0, finite(finished.elapsed, current.elapsed));
				const par = finite(finished.par, 0) > 0 ? finished.par! : MissionScore.ParSeconds(MissionCatalog.Get(missionId));
				const missilesFired = count(finished.missilesFired);
				const missileHits = math.min(missilesFired, count(finished.missileHits));
				const damageTaken = math.clamp(finite(finished.damageTaken, 100 - current.health), 0, 100);
				// The server scores the run; an older or fallback message is scored here for display only.
				const fallback = MissionScore.Compute({ won, airKills: kills - groundKills, groundKills, elapsed, par, missilesFired, missileHits, damageTaken, difficulty: finished.difficulty, targetPoints: finished.targetScore?.total }, MissionCatalog.Scoring(missionId));
				setOutcome({
					won,
					missionId,
					targetScore: MissionCatalog.Scoring(missionId).basis === "points" ? finished.targetScore : undefined,
					airKills: kills - groundKills,
					optionalKills: count(finished.optionalKills),
					groundKills,
					elapsed,
					par,
					completedPhases: count(finished.completedPhases, won ? MissionCatalog.TotalPhases(MissionCatalog.Get(missionId)) : 0),
					missilesFired,
					missileHits,
					damageTaken,
					lowestHealth: math.clamp(finite(finished.lowestHealth, current.health), 0, 100),
					evades: count(finished.evades),
					score: finite(finished.score, -1) >= 0 ? math.floor(finished.score!) : fallback.score,
					rank: MissionScore.IsRank(finished.rank) ? finished.rank : fallback.rank,
					newBestScore: finished.newBestScore === true,
					newBestRank: finished.newBestRank === true,
					bestScore: finite(finished.bestScore, -1) >= 0 ? math.floor(finished.bestScore!) : undefined,
					bestRank: MissionScore.IsRank(finished.bestRank) ? finished.bestRank : undefined,
					reason: isMissionReason(finished.reason) ? finished.reason : undefined,
					difficulty: Difficulty.IsKind(finished.difficulty) ? finished.difficulty : undefined,
					saveText,
					saveColor: won && finished.saved === true && resultPersistence === "cloud" ? C.Accent : resultPersistence === "cloud" ? C.Muted : C.Orange,
				});
			}
		};
		const connection = remotes.MissionState.OnClientEvent.Connect((raw: unknown) => onMissionState(raw));
		// HUD numbers (10 Hz, unreliable) and text/target changes (reliable HudState) are
		// merged by the controller, which already folds in its locally predicted
		// boundary warning; the HUD re-renders once per merged update.
		const unsubscribe = controller.OnTelemetry((merged) => {
			if (!mountedRef.current || !inMissionRef.current) return;
			// The server owns the pause (5-minute budget, refused pauses): when the controller un-freezes, drop the PAUSED card too.
			if (pausedRef.current && !controller.IsPaused()) {
				pausedRef.current = false;
				setPausedState(false);
				settingsOpenRef.current = false;
				setSettingsOpenState(false);
			}
			const previous = telemetryRef.current;
			const sanitized = sanitizeTelemetry(merged, previous);
			if (sanitized.pauseRemaining === 0 && previous.pauseRemaining !== 0) setFireNotice({ text: "PAUSE SPENT · FLIGHT CONTINUES", until: os.clock() + 5 });
			if (sanitized.kills > previous.kills) setKillNotice({ kills: sanitized.kills, total: sanitized.total, until: os.clock() + 3 });
			if (sanitized.radio !== undefined && sanitized.radioSerial !== undefined && sanitized.radioSerial !== previous.radioSerial) {
				// Voiced lines are matched by exact catalog text (table generated at build time) and hold until the voice ends.
				radioQueue.Push(sanitized.radio, sanitized.radioSeconds ?? RADIO_SECONDS, radioNow(), Voice.Radio(sanitized.radio)?.seconds, sanitized.radioPriority);
				// Cut even a loading voice immediately; Stop disconnects its pending playback heartbeat.
				if (sanitized.radioPriority) { radioVoiceRef.current?.Stop(); radioVoiceRef.current = undefined; }
				setRadioSerial(sanitized.radioSerial);
			}
			if (sanitized.fireDenied !== undefined && sanitized.fireDeniedSerial !== undefined && sanitized.fireDeniedSerial !== previous.fireDeniedSerial) setFireNotice({ text: FIRE_DENIED_TEXT[sanitized.fireDenied], until: os.clock() + FIRE_DENIED_SECONDS });
			if (sanitized.health < previous.health) {
				setDamageUntil(os.clock() + 0.45);
				CameraShake.Damage(previous.health - sanitized.health);
			}
			const kill = ImpactFeedback.DetectKill(killSnapshot(previous), killSnapshot(sanitized));
			if (kill) {
				killSerialRef.current += 1;
				const killed = previous.target && previous.target.Parent === undefined ? previous.target : priorTargetRef.current;
				priorTargetRef.current = undefined;
				const point = killedTargetPoint(killed, rootFrameRef.current);
				// The kill marker lives in the HUD-scaled frame.
				setKillFlash({ serial: killSerialRef.current, kind: kill.kind, text: kill.text, bracket: point ? point.div(hudScaleRef.current) : undefined });
				if (kill.kind === "ace") CameraShake.HitStop();
			}
			if (previous.target !== sanitized.target && previous.target !== undefined) priorTargetRef.current = previous.target;
			telemetryRef.current = sanitized;
			setTelemetry(sanitized);
		});
		return () => { connection.Disconnect(); unsubscribe(); };
	}, [applyResponseSlots, beginRequest, cancelRequests, changeScreen, controller, invoke, releaseJoystick, remotes, showToast]);
	useEffect(() => {
		let sampleClock = 0;
		const connection = RunService.RenderStepped.Connect((deltaTime) => {
			if (!mountedRef.current) return;
			// Radio voice: the radio clock and the voice pause with the sortie; a new visible line (or none) replaces the voice.
			const radioClock = radioClockRef.current;
			if (pausedRef.current && radioClock.pausedAt === undefined) {
				radioClock.pausedAt = os.clock();
				radioVoiceRef.current?.Pause();
			} else if (!pausedRef.current && radioClock.pausedAt !== undefined) {
				radioClock.offset += os.clock() - radioClock.pausedAt;
				radioClock.pausedAt = undefined;
				radioVoiceRef.current?.Resume();
			}
			const shownLine = screenRef.current === "mission" ? radioQueue.Current(radioNow()) : undefined;
			if (shownLine !== radioVoiceLineRef.current) {
				radioVoiceLineRef.current = shownLine;
				radioVoiceRef.current?.Stop(0.15);
				radioVoiceRef.current = shownLine?.voice !== undefined ? VoicePlayer.Play(Voice.Radio(shownLine.text), "radio") : undefined;
				if (pausedRef.current) radioVoiceRef.current?.Pause();
			}
			if (!NO_MENU_CAMERA.has(screenRef.current)) setMenuCamera();
			else if (screenRef.current === "mission") {
				// Server telemetry already refreshes the HUD at 10 Hz. This resample only
				// exists so the airspace warning reacts between packets, so it re-renders
				// solely when that flag flips rather than on every sample.
				sampleClock += deltaTime;
				if (sampleClock >= 0.1) {
					sampleClock = 0;
					// A plain boolean read on the predicted state: no table copy, no pcall closure.
					const warning = controller.GetBoundaryWarning();
					const current = telemetryRef.current;
					if (warning !== (current.boundaryWarning === true)) {
						const sampled = { ...current, boundaryWarning: warning };
						telemetryRef.current = sampled;
						setTelemetry(sampled);
					}
					// Stall trend and terrain probe: re-render only when the fresh trend changes the warning the HUD shows.
					const flight = controller.GetFlightTrend();
					const warningsEnabled = controller.FlightWarningsEnabled();
					const shown = flightWarning({ ...telemetryRef.current, acceleration: trendRef.current.acceleration, terrainSeconds: trendRef.current.terrainSeconds }, false, warningsEnabled);
					const implied = flightWarning({ ...telemetryRef.current, acceleration: flight.acceleration, terrainSeconds: flight.terrainSeconds }, false, warningsEnabled);
					if (implied !== shown) {
						trendRef.current = { acceleration: flight.acceleration, terrainSeconds: flight.terrainSeconds };
						setTrend(trendRef.current);
					}
				}
			}
		});
		return () => {
			connection.Disconnect();
			radioVoiceRef.current?.Stop();
			radioVoiceRef.current = undefined;
		};
	}, [controller]);
	useEffect(() => {
		task.defer(() => {
			const root = rootFrameRef.current;
			if (mountedRef.current && root) setViewport(root.AbsoluteSize);
		});
	}, []);
	const menu = useMemo(() => getMenuLayout(viewport.X, viewport.Y), [viewport]);
	const selectedSave = slots?.[selectedSlot - 1];
	const rootChange = useMemo(() => ({ AbsoluteSize: (root: Frame) => mountedRef.current && setViewport(root.AbsoluteSize) }), []);
	const now = os.clock();
	let callout: Callout | undefined;
	const radioLine = screen === "mission" ? radioQueue.Current(radioNow()) : undefined;
	if (killNotice && now < killNotice.until) {
		// Progress is the phase objective's own count; raw kills include optional fighters and ground.
		const total = telemetry.objectiveTotal ?? 0;
		callout = { text: total > 0 ? `Hostile down  ${telemetry.objectiveProgress ?? 0}/${total}` : "Hostile down", color: HUD.White };
	}
	// In a mission the toast follows the HUD's own (scaled) layout for this input mode.
	const inMission = screen === "mission";
	const toastRectangle = useMemo(() => inMission
		? scaleRectangle(getToastLayout(math.floor(viewport.X / hudScale), math.floor(viewport.Y / hudScale), undefined, inputMode, hudOptions), hudScale)
		: getToastLayout(viewport.X, viewport.Y, menu), [inMission, viewport, hudScale, inputMode, hudOptions, menu]);
	const activeFireNotice = fireNotice && now < fireNotice.until ? fireNotice.text : undefined;
	const menuHints = useMemo(() => {
		const hints: ControlHint[] = [{ keyCode: "ButtonA", label: "A", action: "SELECT" }];
		if (screen === "slots" || screen === "briefing") hints.push({ keyCode: "ButtonB", label: "B", action: "BACK" });
		return hints;
	}, [screen]);
	const menuHintsRectangle = useMemo(() => getMenuHintsLayout(viewport.X, viewport.Y, menu), [viewport, menu]);
	const openPauseSettings = useCallback(() => setSettingsOpen(true), [setSettingsOpen]);
	const closeSettings = useCallback(() => setSettingsOpen(false), [setSettingsOpen]);
	return (
		<InputModeContext.Provider value={inputMode}>
			<screengui key="SkybreakBackdrop" DisplayOrder={19} IgnoreGuiInset={true} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.None}>
				<MenuBackdrop visible={!NO_MENU_CAMERA.has(screen)} menu={menu} viewport={viewport} />
			</screengui>
			<screengui key="SkybreakUI" DisplayOrder={20} IgnoreGuiInset={false} ResetOnSpawn={false} ScreenInsets={Enum.ScreenInsets.CoreUISafeInsets} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
				<frame ref={rootFrameRef} key="Root" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Change={rootChange}>
					{screen === "cinematic" && <RelayCinematic id={cinematicId} viewport={viewport} onFinish={()=>{const continueStory=cinematicNext.current;changeScreen(cinematicId===MISSION_COUNT ? "outcome" : "briefing");continueStory();}} onCancel={()=>changeScreen(cinematicId===MISSION_COUNT ? "outcome" : "briefing")}/>}
					<VoiceDisclosureNotice />
					<TitleScreen visible={screen === "title"} menu={menu} onCampaign={openCampaign} onSettings={openSettings} />
					<CampaignScreen visible={screen === "slots"} menu={menu} slots={slots} busy={busy} persistence={persistence} onBack={goBack} onSlot={chooseSlot} confirmSlot={confirmSlot} onAskDelete={askDelete} onCancelDelete={cancelDelete} onDeleteSlot={deleteSlot} />
					<BriefingScreen visible={screen === "briefing"} menu={menu} selectedSlot={selectedSlot} selectedMission={selectedMission} slot={selectedSave} busy={busy} special={selectedSpecial} difficulty={selectedDifficulty} onBack={goBack} onLaunch={startMission} onMission={chooseMission} onSpecial={chooseSpecial} onDifficulty={chooseDifficulty} />
					<LoadingScreen visible={screen === "loading"} missionId={selectedMission} progress={loadingProgress} viewport={viewport} />
					<MissionHud
						visible={screen === "mission"}
						viewport={viewport}
						inputMode={inputMode}
						telemetry={telemetry}
						callout={callout}
						introduction={telemetry.elapsed < 10 || now < hintUntil}
						damageFlash={now < damageUntil}
						killFlash={killFlash}
						scale={hudScale}
						options={hudOptions}
						trend={trend}
						fireNotice={activeFireNotice}
						radio={radioLine?.text}
						controller={controller}
						joystickRef={joystickRef}
						knobRef={knobRef}
						onJoystickBegan={joystickBegan}
						throttleJoystickRef={throttleJoystickRef}
						throttleKnobRef={throttleKnobRef}
						onThrottleBegan={throttleBegan}
						onMissile={fireMissile}
						onTarget={cycleTarget}
						onSpecial={fireSpecial}
						onEvade={evadeNow}
						onPause={pauseSortie}
					/>
					{screen === "mission" && paused && !settingsOpen && (
						<PauseOverlay remaining={telemetry.pauseRemaining} viewport={viewport} onResume={resumeSortie} onSettings={openPauseSettings} onMenu={returnToMenu} />
					)}
					{settingsOpen && <SettingsSheet viewport={viewport} settings={settings} onChange={changeSetting} onClose={closeSettings} />}
					<OutcomeScreen visible={screen === "outcome"} menu={menu} outcome={outcome} busy={busy} onRetry={retryMission} onReturn={returnToMenu} onNext={nextMission} />
					<HintRow
						name="MenuHints"
						hints={menuHints}
						rectangle={menuHintsRectangle}
						alignment={menu.mode === "side" ? Enum.HorizontalAlignment.Right : Enum.HorizontalAlignment.Left}
						visible={inputMode === "gamepad" && !NO_MENU_CAMERA.has(screen)}
					/>
					<StatusToast toast={toast} toastRectangle={toastRectangle} />
				</frame>
			</screengui>
		</InputModeContext.Provider>
	);
}
export interface GameUIMount {
	unmount: () => void;
}
export function mountGameUI(parent: Instance, remotes: Remotes, controller: FlightController): GameUIMount {
	const root = ReactRoblox.createRoot(parent);
	root.render(<GameUI remotes={remotes} controller={controller} />);
	return {
		unmount: () => root.unmount(),
	};
}
