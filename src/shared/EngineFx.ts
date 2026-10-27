// Pure curves for the cosmetic engine and vapor effects. The client drives the
// local visual jet from its predicted throttle; enemies hold a constant glow.
export interface EngineLook {
	flameRate: number;
	flameSpeed: number;
	flameSize: number;
	glowSize: number;
	lightBrightness: number;
	lightRange: number;
	trailLifetime: number;
}
const IDLE: EngineLook = { flameRate: 14, flameSpeed: 10, flameSize: 0.9, glowSize: 1.6, lightBrightness: 0.4, lightRange: 5, trailLifetime: 0.3 };
const MAX: EngineLook = { flameRate: 60, flameSpeed: 70, flameSize: 2.6, glowSize: 4.2, lightBrightness: 3, lightRange: 16, trailLifetime: 0.55 };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const EngineFx = {
	/** Below this throttle only the idle glow shows. */
	AfterburnerStart: 0.45,
	/** Enemy jets cruise with this constant, modest glow. */
	EnemyIntensity: 0.25,
	/** Afterburner intensity 0..1 from throttle: zero up to AfterburnerStart, smoothstep to 1 at full power. */
	Intensity(throttle: number): number {
		if (throttle !== throttle) return 0;
		const t = math.clamp((throttle - EngineFx.AfterburnerStart) / (1 - EngineFx.AfterburnerStart), 0, 1);
		return t * t * (3 - 2 * t);
	},
	/** Engine spool: lights fast (4/s), winds down slower (1.5/s). */
	Spool(current: number, target: number, dt: number): number {
		return current + math.clamp(target - current, -1.5 * dt, 4 * dt);
	},
	Look(intensity: number): EngineLook {
		const t = math.clamp(intensity, 0, 1);
		return {
			flameRate: lerp(IDLE.flameRate, MAX.flameRate, t),
			flameSpeed: lerp(IDLE.flameSpeed, MAX.flameSpeed, t),
			flameSize: lerp(IDLE.flameSize, MAX.flameSize, t),
			glowSize: lerp(IDLE.glowSize, MAX.glowSize, t),
			lightBrightness: lerp(IDLE.lightBrightness, MAX.lightBrightness, t),
			lightRange: lerp(IDLE.lightRange, MAX.lightRange, t),
			trailLifetime: lerp(IDLE.trailLifetime, MAX.trailLifetime, t),
		};
	},
	/** Wingtip vapor particles/s: only hard pulls (stick past 70%) at fighting speed (200+). */
	VaporRate(pull: number, speed: number): number {
		const g = math.clamp((math.abs(pull) - 0.7) / 0.3, 0, 1) * math.clamp((speed - 120) / 200, 0, 1);
		return g > 0 ? math.floor(10 + 26 * g) : 0;
	},
	/** 1/20 steps, so effect properties are only rewritten on a visible change. */
	Quantize(value: number): number {
		return math.round(math.clamp(value, 0, 1) * 20) / 20;
	},
};
