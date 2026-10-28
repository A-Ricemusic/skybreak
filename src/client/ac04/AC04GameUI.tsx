import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, RunService, UserInputService } from "@rbxts/services";
import { AC04MissionData } from "../../shared/AC04MissionData";
import { ac04Aircraft } from "../../shared/AC04Aircraft";
import { AC04_RELEASE_MISSION_CEILING, AC04Response, AC04Slot, ac04BlankProfile, ac04ReleaseDestination, ac04Unlocked } from "../../shared/AC04Progress";
import { AC04MissionNarrative } from "../../shared/ac04/AC04Story";
import { MissionFinished, MissionLoading, MissionStarted, Remotes, Telemetry } from "../../shared/Types";
import { initialTelemetry } from "../../shared/InitialTelemetry";
import { FlightController } from "../FlightController";
import { preloadMission } from "../MissionPreload";
import { AC04Cinematic } from "./AC04Cinematic";
import { AC04Voice } from "../../shared/ac04/AC04Voice";
import { RadioQueue, RadioLine } from "../../shared/RadioQueue";
import { VoicePlayer, VoiceHandle } from "../VoicePlayer";
import { ac04HudLayout, ac04HudKeepouts } from "../../shared/ac04/ui/AC04HudLayout";
import { type AC04AircraftPurpose, type AC04BriefingStep, type AC04NavState, type AC04Route, ac04Back, ac04FocusOf, ac04Go, ac04InitialNav, ac04WithFocus } from "../../shared/ac04/ui/AC04Routing";
import { ac04ChaptersAfterSuccess, ac04PendingChapters } from "../../shared/ac04/ui/AC04RecordSummary";
import { AC04_CONNECTION_FAILURE, AC04_GENERIC_FAILURE, ac04RequestErrorText } from "../../shared/ac04/ui/AC04RequestErrors";
import { useAC04InputMode, useAC04Size } from "./ui/AC04Input";
import type { AC04Status } from "./ui/AC04ListScreen";
import { type AC04RecordsState, AC04ControlsScreen, AC04RecordsScreen, AC04TitleScreen } from "./ui/AC04TitleScreens";
import { AC04HubScreen, AC04MissionArchiveScreen, AC04StoryArchiveScreen } from "./ui/AC04HubScreens";
import { AC04Briefing, AC04ObjectiveScreen } from "./ui/AC04Briefing";
import { AC04AircraftSelect } from "./ui/AC04AircraftSelect";
import { AC04FlightHud } from "./ui/AC04FlightHud";
import { AC04DebriefScreen, AC04LoadingScreen, AC04PauseMenu } from "./ui/AC04SortieScreens";

/**
 * AC04 campaign interface. Owns the request/settlement lifecycle (unchanged: paced requests, one
 * operation at a time with a queue, mandatory unseen chapters before launch and after success, voice
 * and radio cleanup) and routes between the command screens. Routing state is the pure AC04Routing
 * model; screens are presentational and never launch a sortie without the objective confirmation.
 */
export function AC04GameUI({ remotes, requestRemote, controller }: { remotes: Remotes; requestRemote: RemoteFunction; controller: FlightController }) {
	const [nav, setNavState] = useState<AC04NavState>(ac04InitialNav);
	const navRef = useRef(nav);
	const [slots, setSlots] = useState<AC04Slot[]>(ac04BlankProfile().slots), [slotId, setSlotId] = useState(1), [missionId, setMissionId] = useState(1);
	const [aircraft, setAircraft] = useState("F-4E"), [previewAircraft, setPreviewAircraft] = useState("F-4E");
	const [busy, setBusy] = useState(false), [errorMessage, setError] = useState("");
	const [persistence, setPersistence] = useState("loading"), [recordsState, setRecordsState] = useState<AC04RecordsState>("loading");
	const [telemetry, setTelemetry] = useState<Telemetry>(() => initialTelemetry(1));
	const [score, setScore] = useState(0), [gun, setGun] = useState(650), [paused, setPaused] = useState(false), [result, setResult] = useState<MissionFinished>();
	const [returnZ, setReturnZ] = useState<number>(), [rearmSeconds, setRearmSeconds] = useState<number>();
	const [chapter, setChapter] = useState("ac04-i01"), [highContrast, setHighContrast] = useState(false);
	const alive = useRef(true), loadingSerial = useRef(0), slotRef = useRef(slotId), missionRef = useRef(missionId), aircraftRef = useRef(aircraft);
	const nextStory = useRef<() => void>(() => undefined), storyFallback = useRef<AC04Route>("hub");
	const chapters = useRef<string[]>([]), afterStory = useRef<() => void>(() => undefined), gunHeld = useRef(false);
	const busyRef = useRef(false), slotsRef = useRef(slots), gunPointer = useRef<InputObject>(), lastRequest = useRef(-math.huge);
	const voice = useRef<VoiceHandle>(), radioQueue = useRef(new RadioQueue()), radioLine = useRef<RadioLine>();
	const radioClock = useRef(0), lastRadioSerial = useRef<number>(), lastRadioText = useRef(""), audioPaused = useRef(false);
	const [radioText, setRadioText] = useState("");
	const pendingOperations = useRef<Array<() => void>>([]);
	const rootRef = useRef<Frame>(), [root, setRoot] = useState<Frame>();
	const size = useAC04Size(root), input = useAC04InputMode();
	slotRef.current = slotId; missionRef.current = missionId; aircraftRef.current = aircraft;

	const setNav = (destination: AC04NavState) => { navRef.current = destination; setNavState(destination); };
	/** Lifecycle-driven route change (keeps any error that caused it visible). */
	const changeRoute = (route: AC04Route, patch?: { briefingStep?: AC04BriefingStep; aircraftPurpose?: AC04AircraftPurpose }) => setNav(ac04Go(navRef.current, route, patch));
	/** Player-driven navigation: clears stale command feedback. */
	const go = (route: AC04Route, patch?: { briefingStep?: AC04BriefingStep; aircraftPurpose?: AC04AircraftPurpose }) => { if (busyRef.current) return; setError(""); changeRoute(route, patch); };
	const back = () => { if (busyRef.current) return; const previous = ac04Back(navRef.current); if (previous) { setError(""); setNav(previous); } };
	const focusFor = (route: AC04Route) => ({ focus: ac04FocusOf(nav, route), top: nav.scroll[route] ?? 0, onFocus: (index: number, top?: number) => setNav(ac04WithFocus(navRef.current, route, index, top)) });
	const confirmSound = () => controller.ConfirmAudio();

	const request = (action: string, payload?: object): AC04Response | undefined => {
		const delay = .16 - (os.clock() - lastRequest.current);
		if (delay > 0) task.wait(delay);
		if (!alive.current) return undefined;
		lastRequest.current = os.clock();
		const [ok, value] = pcall(() => requestRemote.InvokeServer(action, payload) as AC04Response);
		if (!alive.current) return undefined;
		const listFailed = () => { if (action === "ListSlots") setRecordsState((previous) => (previous === "ready" ? "ready" : "failed")); };
		if (!ok || !typeIs(value, "table")) { setError(AC04_CONNECTION_FAILURE); listFailed(); return undefined; }
		if (!value.ok) { setError(ac04RequestErrorText(value.error)); listFailed(); return undefined; }
		if (value.slots) { slotsRef.current = value.slots; setSlots(value.slots); setRecordsState("ready"); }
		if (value.persistence) setPersistence(value.persistence);
		// ListSlots only succeeds after any dirty cloud profile has saved (server contract).
		if (action === "ListSlots" && value.persistence) setResult((previous) => previous?.kind === "Completed"
			? { ...previous, saved: value.persistence === "cloud", persistence: value.persistence } : previous);
		return value;
	};
	function operate(callback: () => void, queueIfBusy = false): void {
		if (!alive.current) return;
		if (busyRef.current) { if (queueIfBusy) pendingOperations.current.push(callback); return; }
		busyRef.current = true; setBusy(true); setError("");
		task.spawn(() => {
			let operation: (() => void) | undefined = callback;
			while (operation && alive.current) {
				const [ok, message] = pcall(operation);
				// Diagnostics go to the developer console; players see a generic retry line, never the raw error.
				if (!ok && alive.current) { warn(`AC04 interface operation failed: ${tostring(message)}`); setError(AC04_GENERIC_FAILURE); }
				operation = pendingOperations.current.shift();
			}
			busyRef.current = false;
			if (alive.current) setBusy(false);
		});
	}
	/** Plays chapters in order, acknowledging each with the server; a refused acknowledgement stops at `fallback`. */
	const playChapters = (ids: string[], onComplete: () => void, fallback: AC04Route) => {
		chapters.current = ids; afterStory.current = onComplete; storyFallback.current = fallback;
		const advance = () => {
			const id = chapters.current.shift();
			if (!alive.current) return;
			if (id === undefined) { task.defer(() => { if (alive.current) afterStory.current(); }); return; }
			setChapter(id); changeRoute("story");
			nextStory.current = () => { operate(() => { if (request("StorySeen", {slot: slotRef.current, chapterId: id})) task.defer(advance); else changeRoute(storyFallback.current); }, true); };
		}; advance();
	};
	const launch = () => operate(() => {
		// Set loading before yielding: a fast Started event must never be overwritten by the response.
		changeRoute("loading"); setScore(0); setGun(ac04Aircraft(aircraftRef.current).gun);
		if (!request("StartMission", {slot: slotRef.current, missionId: missionRef.current, aircraft: aircraftRef.current}) && alive.current && navRef.current.route === "loading") changeRoute("objective");
	}, true);
	const prepareLaunch = () => {
		if (busyRef.current) return;
		// A result may have been left before its chapter played. Unlocked unseen chapters always play before launch.
		const ids = ac04PendingChapters(slotsRef.current[slotRef.current - 1]);
		if (ids.size() > 0) playChapters(ids, launch, "objective"); else launch();
	};
	const refreshRecords = () => operate(() => { request("ListSlots"); });
	const openRecords = () => {
		if (busyRef.current) return;
		go("records");
		refreshRecords();
	};
	const menu = () => operate(() => {
		// Keep the live controller and pause state intact until the server accepts exit.
		if (!request("ReturnToMenu")) return;
		loadingSerial.current++; gunHeld.current = false; controller.Stop(); setPaused(false); changeRoute("hub");
	});
	const pause = (value: boolean) => {
		if (!controller.active) return;
		if (value) gunHeld.current = false;
		controller.SetPaused(value); setPaused(controller.IsPaused());
		if (value) setNav(ac04WithFocus(navRef.current, "flight", 0));
	};
	const selectRecord = (index: number, route: AC04Route) => {
		if (busyRef.current) return;
		const record = slotsRef.current[index - 1];
		setSlotId(index); setMissionId(ac04ReleaseDestination(record)); setAircraft(record.aircraft);
		go(route, route === "briefing" ? { briefingStep: "strategic" } : undefined);
	};
	useEffect(() => { setRoot(rootRef.current); }, []);
	useEffect(() => {
		alive.current = true;
		operate(() => { request("ListSlots"); });
		let gunClock = 0;
		const frame = RunService.RenderStepped.Connect((dt) => {
			if (navRef.current.route === "flight") {
				const isPaused = controller.IsPaused();
				if (isPaused !== audioPaused.current) { audioPaused.current = isPaused; if (isPaused) voice.current?.Pause(); else voice.current?.Resume(); }
				if (!isPaused && !voice.current?.IsLoading()) radioClock.current += dt;
				const shown = radioQueue.current.Current(radioClock.current);
				if (shown !== radioLine.current) {
					radioLine.current = shown; voice.current?.Stop(0);
					voice.current = shown?.voice !== undefined ? VoicePlayer.Play(AC04Voice.Radio(shown.text), "radio") : undefined;
					if (isPaused) voice.current?.Pause();
					setRadioText(shown?.text ?? "");
				}
			}
			gunClock += dt; if (gunHeld.current && gunClock >= .12 && controller.active && !controller.IsPaused()) { gunClock = 0; controller.FireGun(); }
		});
		const telemetryOff = controller.OnTelemetry((t) => {
			if (!alive.current) return;
			setTelemetry({...t}); setPaused(controller.IsPaused());
			const freshRadio = t.radioSerial !== undefined ? t.radioSerial !== lastRadioSerial.current : t.radio !== lastRadioText.current;
			if (navRef.current.route === "flight" && t.radio !== undefined && freshRadio) {
				lastRadioSerial.current = t.radioSerial; lastRadioText.current = t.radio;
				radioQueue.current.Push(t.radio, t.radioSeconds, radioClock.current, AC04Voice.Radio(t.radio)?.seconds, t.radioPriority);
				if (t.radioPriority) { voice.current?.Stop(0); voice.current = undefined; }
			}
		});
		const event = remotes.MissionState.OnClientEvent.Connect((raw: unknown) => {
			if (!typeIs(raw, "table")) return;
			const data = raw as { kind?: string; campaignId?: string; score?: number; gunAmmo?: number; returnZ?: unknown; rearmSeconds?: unknown };
			if (data.kind === "AC04State") {
				if (data.campaignId === "ac04") {
					setScore(data.score ?? 0); setGun(data.gunAmmo ?? 0);
					if (typeIs(data.returnZ, "number") && data.returnZ === data.returnZ) setReturnZ(data.returnZ);
					setRearmSeconds(typeIs(data.rearmSeconds, "number") && data.rearmSeconds === data.rearmSeconds ? data.rearmSeconds : undefined);
				}
				return;
			}
			if (data.campaignId !== "ac04") return;
			if (data.kind === "Loading") {
				const message = raw as MissionLoading, serial = ++loadingSerial.current; changeRoute("loading");
				task.spawn(() => { if (preloadMission(message.aircraft, message.expectedParts, () => alive.current && serial === loadingSerial.current, () => undefined) && alive.current && serial === loadingSerial.current) remotes.CombatAction.FireServer({action:"Ready"}); });
			} else if (data.kind === "Started") {
				loadingSerial.current++; setPaused(false); setReturnZ(undefined); setRearmSeconds(undefined);
				if (controller.Start(raw as MissionStarted)) changeRoute("flight"); else { setError("Aircraft link failed. Return to the hub and retry."); changeRoute("loading"); }
			} else if (data.kind === "Completed" || data.kind === "Failed") {
				loadingSerial.current++; gunHeld.current = false; controller.Stop(); const finished = raw as MissionFinished; setResult(finished);
				setNav(ac04WithFocus(ac04Go(navRef.current, "result"), "result", 0));
				operate(() => { request("ListSlots"); }, true);
			}
		});
		const focus = UserInputService.WindowFocusReleased.Connect(() => { gunHeld.current = false; if (controller.active) { controller.SetPaused(true); setPaused(true); } });
		const coreMenu = GuiService.MenuOpened.Connect(() => { gunHeld.current = false; if (controller.active) { controller.SetPaused(true); setPaused(true); } });
		const key = UserInputService.InputBegan.Connect((input, processed) => { if (!processed && !busyRef.current && input.KeyCode === Enum.KeyCode.P && controller.active) { gunHeld.current = false; controller.SetPaused(!controller.IsPaused()); setPaused(controller.IsPaused()); } });
		const released = UserInputService.InputEnded.Connect((input) => { if (input === gunPointer.current) { gunHeld.current = false; gunPointer.current = undefined; } });
		return () => { voice.current?.Stop(0); radioQueue.current.Clear(); alive.current = false; pendingOperations.current.clear(); loadingSerial.current++; gunHeld.current = false; controller.Stop(); frame.Disconnect(); telemetryOff(); event.Disconnect(); focus.Disconnect(); coreMenu.Disconnect(); key.Disconnect(); released.Disconnect(); };
	}, [remotes, requestRemote, controller]);
	const route = nav.route;
	useEffect(() => {
		if (route !== "flight" || !root) return;
		controller.SetTargetRectKeepouts(ac04HudKeepouts(ac04HudLayout(size.X, size.Y, input)), root, size);
		return () => controller.SetTargetRectKeepouts(undefined);
	}, [route, root, size.X, size.Y, input, controller]);

	useEffect(() => {
		voice.current?.Stop(0); voice.current = undefined;
		radioQueue.current.Clear(); radioLine.current = undefined; radioClock.current = 0;
		lastRadioSerial.current = undefined; lastRadioText.current = ""; audioPaused.current = false; setRadioText("");
		if (route === "briefing") voice.current = VoicePlayer.Play(AC04Voice.Clip(`ac04.briefing.m${string.format("%02d", missionId)}`, AC04MissionNarrative[missionId].briefing), "cutscene");
		if (route === "result" && result?.kind === "Completed") {
			const completedId = result.missionId ?? missionId;
			voice.current = VoicePlayer.Play(AC04Voice.Clip(`ac04.debriefing.m${string.format("%02d", completedId)}`, AC04MissionNarrative[completedId].debriefing), "cutscene");
		}
		return () => { voice.current?.Stop(0); voice.current = undefined; };
	}, [route, missionId, result]);

	const slot = slots[slotId - 1];
	const afterResult = () => {
		if (!result || busyRef.current) return;
		const id = result.missionId ?? missionId;
		operate(() => {
			if (!request("ListSlots")) return;
			const advanceMission = () => {
				if (id >= AC04_RELEASE_MISSION_CEILING) { setMissionId(AC04_RELEASE_MISSION_CEILING); changeRoute("hub"); }
				else { setMissionId(id + 1); changeRoute("briefing", { briefingStep: "strategic" }); }
			};
			const ids = ac04ChaptersAfterSuccess(id, slotsRef.current[slotRef.current - 1].seen);
			task.defer(() => playChapters(ids, advanceMission, "hub"));
		});
	};
	const retry = () => {
		if (!result || busyRef.current) return;
		setMissionId(result.missionId ?? missionId); setPreviewAircraft(aircraft);
		go("objective", { aircraftPurpose: "sortie" });
	};
	const status = (): AC04Status | undefined => {
		if (errorMessage !== "") return { text: errorMessage, warning: true };
		if (recordsState === "loading") return { text: "RETRIEVING FLIGHT RECORDS" };
		if (recordsState === "failed") return { text: "FLIGHT RECORDS UNAVAILABLE", warning: true };
		if (persistence === "session") return { text: "PROGRESS KEPT THIS SESSION ONLY" };
		return undefined;
	};
	const common = { size, input, status: status(), onConfirmSound: confirmSound };
	const recordsReady = recordsState === "ready" && (persistence === "cloud" || persistence === "session");

	let screen: React.Element | undefined;
	if (route === "title") screen = <AC04TitleScreen {...common} {...focusFor("title")} slots={slots} recordsState={recordsReady ? "ready" : recordsState === "ready" ? "failed" : recordsState} busy={busy}
		onContinue={(index) => selectRecord(index, "briefing")} onRecords={openRecords} onControls={() => go("controls")} onRetry={() => operate(() => { setRecordsState("loading"); request("ListSlots"); })} />;
	else if (route === "records") screen = <AC04RecordsScreen {...common} {...focusFor("records")} slots={slots} enabled={recordsReady && !busy} busy={busy} onRefresh={refreshRecords} onSelect={(index) => selectRecord(index, "hub")} onBack={back} />;
	else if (route === "controls") screen = <AC04ControlsScreen {...common} {...focusFor("controls")} focus={nav.focus.controls ?? (input === "gamepad" ? 1 : input === "touch" ? 2 : 0)} onBack={back} />;
	else if (route === "hub") screen = <AC04HubScreen {...common} {...focusFor("hub")} slot={slot} missionId={missionId} aircraft={aircraft} busy={busy}
		onStart={() => { setPreviewAircraft(aircraft); go("aircraft", { aircraftPurpose: "sortie" }); }} onBriefing={() => go("briefing", { briefingStep: "strategic" })}
		onAircraft={() => { setPreviewAircraft(aircraft); go("aircraft", { aircraftPurpose: "review" }); }} onMissions={() => go("missionArchive")} onStory={() => go("storyArchive")} onRecords={openRecords} onBack={back} />;
	else if (route === "missionArchive") screen = <AC04MissionArchiveScreen {...common} {...focusFor("missionArchive")} focus={nav.focus.missionArchive ?? missionId - 1} slot={slot} busy={busy}
		onSelect={(id) => { if (id > AC04_RELEASE_MISSION_CEILING || id > ac04Unlocked(slotsRef.current[slotRef.current - 1])) return; setMissionId(id); go("briefing", { briefingStep: "strategic" }); }} onBack={back} />;
	else if (route === "storyArchive") screen = <AC04StoryArchiveScreen {...common} {...focusFor("storyArchive")} slot={slot} busy={busy}
		onPlay={(id) => { if (!busyRef.current) playChapters([id], () => changeRoute("storyArchive"), "storyArchive"); }} onBack={back} />;
	else if (route === "briefing") screen = <AC04Briefing size={size} input={input} missionId={missionId} narrative={AC04MissionNarrative[missionId]} step={nav.briefingStep} busy={busy}
		onStep={(step) => setNav({ ...navRef.current, briefingStep: step })} onDone={() => go("hub")} onConfirmSound={confirmSound} />;
	else if (route === "aircraft") screen = <AC04AircraftSelect size={size} input={input} slot={slot} selected={previewAircraft} purpose={nav.aircraftPurpose} busy={busy}
		onPreview={setPreviewAircraft} onBack={back} onConfirmSound={confirmSound}
		onConfirm={() => { setAircraft(previewAircraft); go(nav.aircraftPurpose === "sortie" ? "objective" : "hub"); }} />;
	else if (route === "objective") screen = <AC04ObjectiveScreen size={size} input={input} missionId={missionId} aircraft={aircraft} busy={busy} errorText={errorMessage} onLaunch={prepareLaunch} onBack={back} onConfirmSound={confirmSound} />;
	else if (route === "loading") screen = <AC04LoadingScreen size={size} input={input} missionId={missionId} busy={busy} errorText={errorMessage} onReturn={menu} onConfirmSound={confirmSound} />;
	else if (route === "result" && result) screen = <AC04DebriefScreen size={size} input={input} result={result} fallbackMissionId={missionId} record={slot.missions[result.missionId ?? missionId]} busy={busy} errorText={errorMessage}
		focus={ac04FocusOf(nav, "result")} onFocus={(index) => setNav(ac04WithFocus(navRef.current, "result", index))} onContinue={afterResult} onRetry={retry} onRecords={openRecords} onConfirmSound={confirmSound} />;
	else if (route === "flight") screen = (
		<>
			<AC04FlightHud layout={ac04HudLayout(size.X, size.Y, input)} input={input} telemetry={telemetry} score={score} gun={gun} radioText={radioText} mission={AC04MissionData.Get(missionId)} controller={controller}
				returnZ={returnZ} rearmSeconds={rearmSeconds} highContrast={highContrast} onPause={() => pause(true)}
				onGunDown={(pointer) => { gunHeld.current = true; gunPointer.current = pointer; }} onGunUp={() => { gunHeld.current = false; }} />
			{paused && <AC04PauseMenu size={size} input={input} telemetry={telemetry} missionTitle={AC04MissionData.Get(missionId).title} busy={busy} errorText={errorMessage} highContrast={highContrast}
				focus={ac04FocusOf(nav, "flight")} onFocus={(index) => setNav(ac04WithFocus(navRef.current, "flight", index))}
				onResume={() => { if (!busyRef.current) pause(false); }} onReturn={menu} onContrast={() => setHighContrast((value) => !value)} onConfirmSound={confirmSound} />}
		</>
	);
	return (
		<screengui key="AC04Campaign" IgnoreGuiInset={false} ScreenInsets={Enum.ScreenInsets.CoreUISafeInsets} ResetOnSpawn={false} DisplayOrder={10} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			<frame ref={rootRef} BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
				{route === "story" ? <AC04Cinematic chapterId={chapter} onFinish={() => nextStory.current()} onCancel={() => nextStory.current()} /> : screen}
			</frame>
		</screengui>
	);
}
