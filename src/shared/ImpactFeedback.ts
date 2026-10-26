// Pure impact-feedback rules (camera shake, kill callouts, ace hit-stop), shared so
// Roblox Jest and the offline Luau runner can check them without a camera or GUI.
// Everything here is presentation only: no server state, input or prediction.

export type KillKind = "air" | "ground" | "ace";

/** The cumulative kill counters the HUD already receives in telemetry. */
export interface KillSnapshot {
	kills: number;
	groundKills: number;
	aceKilled: boolean;
}

export interface KillCallout {
	kind: KillKind;
	text: string;
	/** Air kills this sortie (air/ace) or ground kills (ground) after this kill. */
	count: number;
}

/** Per-frame camera offset, in radians and studs, applied in camera space. */
export interface ShakeOffset {
	pitch: number;
	yaw: number;
	roll: number;
	x: number;
	y: number;
}

/** Ace hit-stop camera state at a moment of the beat. */
export interface HitStopFrame {
	/** Multiplies the chase camera's follow rate: near 0 freezes, 1 is normal. */
	follow: number;
	/** Degrees added to the field of view (negative zooms in). */
	fov: number;
}

const NUMBER_WORDS = [
	"ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
	"ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN", "TWENTY",
];

/** Trauma lost per second; a full kick settles in well under a second. */
const DECAY_PER_SECOND = 1.6;
/** Rotation and translation at full trauma (intensity is trauma squared, so small hits stay tiny). */
const MAX_ANGLE = math.rad(2.4);
const MAX_ROLL = math.rad(3);
const MAX_SHIFT = 1.1;
/** Hull loss at or above this counts as a heavy hit (ace missiles and act III bandits). */
const HEAVY_HIT = 18;
/** Explosions shake within this many studs per unit of scale. */
const EXPLOSION_RADIUS = 650;

const HIT_STOP_HOLD = 0.16;
const HIT_STOP_RELEASE = 0.18;
const HIT_STOP_FOLLOW = 0.06;
const FOV_PUNCH = -9;
const FOV_PUNCH_SECONDS = 0.45;

export const ImpactFeedback = {
	HeavyHit: HEAVY_HIT,
	HitStopSeconds: HIT_STOP_HOLD,
	/** Callout hold time, including its pop-in and fade. */
	CalloutSeconds: 1.2,

	/** "SPLASH ONE" … "SPLASH TWENTY", then digits. */
	SplashText(count: number): string {
		const n = math.max(1, math.floor(count));
		return n <= NUMBER_WORDS.size() ? `SPLASH ${NUMBER_WORDS[n - 1]}` : `SPLASH ${n}`;
	},

	/**
	 * Compares two telemetry snapshots and names the kill they reveal. Counters are
	 * cumulative, so a dropped unreliable packet merges kills rather than losing one.
	 * A lower count (a new sortie) is not a kill.
	 */
	DetectKill(previous: KillSnapshot, current: KillSnapshot): KillCallout | undefined {
		if (current.kills <= previous.kills) return undefined;
		const air = math.max(0, current.kills - current.groundKills);
		if (current.aceKilled && !previous.aceKilled) return { kind: "ace", text: "ACE DOWN", count: air };
		if (air > math.max(0, previous.kills - previous.groundKills)) return { kind: "air", text: ImpactFeedback.SplashText(air), count: air };
		return { kind: "ground", text: "TARGET DESTROYED", count: current.groundKills };
	},

	AddTrauma(trauma: number, amount: number): number {
		return math.clamp(trauma + math.max(0, amount), 0, 1);
	},

	DecayTrauma(trauma: number, dt: number): number {
		return math.max(0, trauma - DECAY_PER_SECOND * math.max(0, dt));
	},

	/** Visible strength: trauma squared, so light hits barely move the view. */
	Intensity(trauma: number): number {
		const t = math.clamp(trauma, 0, 1);
		return t * t;
	},

	/** Trauma for a hull drop: a light tap for chip damage, a firmer kick on heavy hits. */
	DamageTrauma(hullLost: number): number {
		if (hullLost <= 0.5) return 0;
		return math.min(0.65, 0.18 + hullLost * 0.012 + (hullLost >= HEAVY_HIT ? 0.2 : 0));
	},

	/** Trauma from an explosion `distance` studs from the camera; quadratic falloff to zero at the radius. */
	ExplosionTrauma(distance: number, scale = 1): number {
		const s = math.clamp(scale, 0, 3);
		const radius = EXPLOSION_RADIUS * math.max(0.25, s);
		if (s <= 0 || distance >= radius) return 0;
		const falloff = 1 - math.max(0, distance) / radius;
		return math.min(0.7, 0.45 * s) * falloff * falloff;
	},

	/**
	 * Camera-space offset for `trauma` at time `t`. Incommensurate sines stand in for
	 * noise: smooth, deterministic, and bounded by the MAX_* constants.
	 */
	Offset(trauma: number, t: number): ShakeOffset {
		const k = ImpactFeedback.Intensity(trauma);
		const wave = (a: number, b: number, phase: number) => (math.sin(t * a + phase) * 0.6 + math.sin(t * b + phase * 1.7) * 0.4);
		return {
			pitch: MAX_ANGLE * k * wave(31, 47, 0.3),
			yaw: MAX_ANGLE * k * wave(37, 53, 1.9),
			roll: MAX_ROLL * k * wave(23, 41, 3.1),
			x: MAX_SHIFT * k * wave(29, 43, 4.4),
			y: MAX_SHIFT * k * wave(33, 59, 5.6),
		};
	},

	/** Hit-stop: hold the camera almost still, then ease follow back in; the FOV punches in and recovers. */
	HitStop(elapsed: number): HitStopFrame {
		if (elapsed < 0) return { follow: 1, fov: 0 };
		let follow = 1;
		if (elapsed < HIT_STOP_HOLD) follow = HIT_STOP_FOLLOW;
		else if (elapsed < HIT_STOP_HOLD + HIT_STOP_RELEASE) {
			const u = (elapsed - HIT_STOP_HOLD) / HIT_STOP_RELEASE;
			follow = HIT_STOP_FOLLOW + (1 - HIT_STOP_FOLLOW) * u * u;
		}
		const p = math.clamp(1 - elapsed / FOV_PUNCH_SECONDS, 0, 1);
		return { follow, fov: FOV_PUNCH * p * p };
	},

	/** True while the hit-stop still changes the camera. */
	HitStopActive(elapsed: number): boolean {
		return elapsed >= 0 && elapsed < math.max(HIT_STOP_HOLD + HIT_STOP_RELEASE, FOV_PUNCH_SECONDS);
	},
};
