import { ContentProvider, Players, RunService, SoundService, TweenService } from "@rbxts/services";
import { voiceLoadAction } from "../shared/VoiceReadiness";
import { VOICE_BANK_ASSETS } from "../shared/VoiceBanks";
import type { VoiceClip } from "../shared/VoiceLines";

/** One playing line. Every method is safe to call after the line has ended. */
export interface VoiceHandle {
	readonly clip: VoiceClip;
	/** Fades out over `fade` seconds (0 cuts at once) and releases the Sound. */
	Stop(fade?: number): void;
	Pause(): void;
	Resume(): void;
	IsPlaying(): boolean;
	/** True until playback starts or loading definitively fails. */
	IsLoading(): boolean;
	/** A bounded load failure, distinct from normal completion or an explicit stop. */
	HasFailed(): boolean;
}

export type VoiceChannel = "cutscene" | "radio";
type SpeakingListener = (speaking: boolean) => void;

// Client voice-over output only. Never embeds provider credentials or calls
// generation APIs; clips come from the generated cue table (VoiceLines) and
// play nothing until their bank has an approved Roblox asset id.
let master: SoundGroup | undefined;
const channels = new Map<VoiceChannel, SoundGroup>();
const active = new Set<VoiceHandle>();
const listeners = new Set<SpeakingListener>();
let speaking = false;
let preloaded = false;
const unavailableUntil = new Map<string, number>();

function voiceVolume(gui: Instance | undefined): number {
	const value = gui?.GetAttribute("VoiceVolume");
	return typeIs(value, "number") && value === value ? math.clamp(value, 0, 1) : 1;
}

function setup(): void {
	if (master) return;
	master = new Instance("SoundGroup");
	master.Name = "SkybreakVoice";
	master.Parent = SoundService;
	const group = master;
	const gui = Players.LocalPlayer?.FindFirstChildOfClass("PlayerGui");
	const apply = () => (group.Volume = voiceVolume(gui));
	apply();
	gui?.GetAttributeChangedSignal("VoiceVolume").Connect(apply);
	// Cutscenes play clean; radio gets a narrow handset band and a little grit in the engine,
	// so the same files would also work in either place.
	const cutscene = new Instance("SoundGroup");
	cutscene.Name = "VoiceCutscene";
	cutscene.Volume = 1;
	cutscene.Parent = master;
	const radio = new Instance("SoundGroup");
	radio.Name = "VoiceRadio";
	radio.Volume = 1.1;
	radio.Parent = master;
	const equalizer = new Instance("EqualizerSoundEffect");
	equalizer.LowGain = -24; equalizer.MidGain = 3; equalizer.HighGain = -14; equalizer.Priority = 2;
	equalizer.Parent = radio;
	const distortion = new Instance("DistortionSoundEffect");
	distortion.Level = 0.12; distortion.Priority = 1;
	distortion.Parent = radio;
	const compressor = new Instance("CompressorSoundEffect");
	compressor.Threshold = -18; compressor.Ratio = 3; compressor.Attack = 0.005; compressor.Release = 0.12; compressor.Priority = 0;
	compressor.Parent = radio;
	channels.set("cutscene", cutscene);
	channels.set("radio", radio);
}

/** Starts loading every uploaded bank in the background; never blocks a cutscene or a sortie. */
function preload(): void {
	if (preloaded) return;
	preloaded = true;
	const probes: Sound[] = [];
	for (const [, assetId] of pairs(VOICE_BANK_ASSETS)) {
		if (assetId === "") continue;
		const probe = new Instance("Sound");
		probe.SoundId = assetId;
		probes.push(probe);
	}
	if (probes.size() === 0) return;
	task.spawn(() => {
		const [ok, problem] = pcall(() => ContentProvider.PreloadAsync(probes, (id, status) => {
			if (status !== Enum.AssetFetchStatus.Success) warn(`SKYBREAK voice fetch ${id}: ${status.Name}; universe=${game.GameId} place=${game.PlaceId} version=${game.PlaceVersion}`);
		}));
		if (!ok) warn(`SKYBREAK voice preload failed: ${tostring(problem)}; universe=${game.GameId} place=${game.PlaceId} version=${game.PlaceVersion}`);
		for (const probe of probes) probe.Destroy();
	});
}

function refreshSpeaking(): void {
	const now = active.size() > 0;
	if (now === speaking) return;
	speaking = now;
	for (const listener of listeners) {
		const [ok, problem] = pcall(listener, now);
		if (!ok) warn(`SKYBREAK voice listener: ${tostring(problem)}`);
	}
}

export const VoicePlayer = {
	/** Warm banks during client boot, before the first cinematic requests a line. */
	Preload(): void { if (RunService.IsClient()) preload(); },
	/** Plays one line on a channel. Returns undefined (silently) when the clip has no asset yet. */
	Play(clip: VoiceClip | undefined, channel: VoiceChannel): VoiceHandle | undefined {
		if (!clip || clip.assetId === "" || !RunService.IsClient()) return undefined;
		// A denied bank must not impose a fresh twelve-second wait on every line.
		if (os.clock() < (unavailableUntil.get(clip.assetId) ?? 0)) return undefined;
		setup();
		preload();
		const sound = new Instance("Sound");
		sound.Name = `Voice_${clip.id}`;
		sound.SoundId = clip.assetId;
		sound.Volume = 1;
		sound.SetAttribute("VoiceState", "Loading");
		sound.PlaybackRegionsEnabled = true;
		sound.PlaybackRegion = new NumberRange(clip.start, clip.finish);
		sound.SoundGroup = channels.get(channel);
		sound.Parent = channels.get(channel);
		let alive = true;
		let failed = false;
		let paused = false;
		let started = false;
		let retried = false;
		// Our own clock, so a region end that never fires Ended (engine quirk) still releases the line.
		let remaining = clip.seconds + 0.25;
		let fading: Tween | undefined;
		const connections: RBXScriptConnection[] = [];
		const handle: VoiceHandle = {
			clip,
			Stop(fade = 0) {
				if (!alive) return;
				alive = false;
				for (const connection of connections) connection.Disconnect();
				active.delete(handle);
				refreshSpeaking();
				if (fade > 0 && sound.IsPlaying) {
					fading = TweenService.Create(sound, new TweenInfo(fade, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Volume: 0 });
					fading.Completed.Once(() => sound.Destroy());
					fading.Play();
				} else sound.Destroy();
			},
			Pause() {
				if (!alive || paused) return;
				paused = true;
				sound.Pause();
			},
			Resume() {
				if (!alive || !paused) return;
				paused = false;
				if (started) sound.Resume();
			},
			IsLoading() { return alive && !started; },
			HasFailed() { return failed; },
			IsPlaying() {
				return alive;
			},
		};
		connections.push(sound.Ended.Connect(() => handle.Stop()));
		let loading = 0;
		connections.push(RunService.Heartbeat.Connect((dt) => {
			if (paused) return;
			// The clock runs from when audio is really available; a bank that never loads releases the line (and the duck).
			if (!sound.IsLoaded) {
				loading += dt;
				const action = voiceLoadAction(loading, retried);
				if (action === "retry") {
					retried = true;
					warn(`SKYBREAK voice ${clip.id}: bank ${clip.assetId} still loading; retrying preload`);
					task.spawn(() => {
						const [ok, problem] = pcall(() => ContentProvider.PreloadAsync([clip.assetId], (id, status) => {
							if (status !== Enum.AssetFetchStatus.Success) warn(`SKYBREAK voice fetch ${id}: ${status.Name}`);
						}));
						if (!ok) warn(`SKYBREAK voice preload ${clip.id}: ${tostring(problem)}`);
					});
				}
				if (action === "fail") {
					failed = true;
					unavailableUntil.set(clip.assetId, os.clock() + 60);
					warn(`SKYBREAK voice ${clip.id} unavailable after 12s (${clip.assetId}); continuing with subtitles. universe=${game.GameId} place=${game.PlaceId} version=${game.PlaceVersion}. Check Output fetch errors and experience asset permissions.`);
					handle.Stop();
				}
				return;
			}
			if (!started) {
				started = true;
				sound.SetAttribute("VoiceState", "Playing");
				// Seek only after load: some clients discard a seek on an unloaded bank.
				sound.TimePosition = clip.start;
				sound.Play();
				return;
			}
			remaining -= dt;
			if (remaining <= 0) handle.Stop(0.05);
		}));
		active.add(handle);
		refreshSpeaking();
		return handle;
	},
	/** Stops every playing line (screen changes, teardown). */
	StopAll(fade = 0): void {
		for (const handle of [...active]) handle.Stop(fade);
	},
	/** True while any line is playing (paused lines count: they will resume). */
	IsSpeaking(): boolean {
		return speaking;
	},
	/** Called with true when the first line starts and false when the last one ends (effects ducking). */
	OnSpeaking(listener: SpeakingListener): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
};
