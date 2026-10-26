/** Pure audio decisions: warnings never compete with one another. */
export type AudioWarning = "incoming" | "lowHull" | "boundary" | "lockSearch";
export const AudioRules = {
	MaxOneShots: 18,
	MaxMotors: 12,
	MaxEngines: 8,
	Warning(incoming: boolean, health: number, boundary: boolean, lock: number, hasTarget: boolean): AudioWarning | undefined {
		if (incoming) return "incoming";
		if (health > 0 && health <= 25) return "lowHull";
		if (boundary) return "boundary";
		if (hasTarget && lock > 0.05 && lock < 0.99) return "lockSearch";
		return undefined;
	},
	EngineMix(throttle: number, speed: number, dt: number): { cruise: number; burn: number; wind: number; pitch: number; alpha: number } {
		const power = math.clamp(throttle, 0, 1);
		const burn = math.clamp((power - 0.65) / 0.35, 0, 1);
		return { cruise: 0.24 + power * 0.12 - burn * 0.1, burn: burn * 0.32, wind: math.clamp(speed / 320, 0, 1) * 0.12,
			pitch: 0.8 + power * 0.28, alpha: 1 - math.exp(-3 * math.clamp(dt, 0, 0.1)) };
	},
};
