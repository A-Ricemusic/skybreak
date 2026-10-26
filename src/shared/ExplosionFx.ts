// Cosmetic explosion sizing and mobile caps. The server only says what blew up
// where; every client draws it locally (src/client/CombatEffects.ts).
export type ExplosionKind = "air" | "ace" | "ground" | "player" | "missile" | "hit" | "wreck";
export interface ExplosionProfile {
	/** Fireball diameter in studs; also the scale reported to OnExplosion listeners. */
	size: number;
	fire: number; smoke: number; sparks: number;
	/** Seconds the smoke lingers, and the flash light's range. */
	smokeLife: number; light: number;
}
const KINDS: ExplosionKind[] = ["air", "ace", "ground", "player", "missile", "hit", "wreck"];
const BASE: Record<ExplosionKind, ExplosionProfile> = {
	hit: { size: 7, fire: 6, smoke: 2, sparks: 6, smokeLife: 1.5, light: 30 },
	missile: { size: 5, fire: 5, smoke: 2, sparks: 4, smokeLife: 1.5, light: 22 },
	wreck: { size: 14, fire: 10, smoke: 5, sparks: 8, smokeLife: 3, light: 50 },
	air: { size: 26, fire: 16, smoke: 8, sparks: 12, smokeLife: 3.5, light: 90 },
	player: { size: 30, fire: 18, smoke: 9, sparks: 14, smokeLife: 4, light: 100 },
	ground: { size: 40, fire: 20, smoke: 12, sparks: 14, smokeLife: 4.5, light: 120 },
	ace: { size: 44, fire: 24, smoke: 12, sparks: 18, smokeLife: 4.5, light: 140 },
};
export const ExplosionFx = {
	MaxExplosions: 8,
	MaxWrecks: 4,
	MaxScorches: 4,
	/** A wreck falls at most this long before its final pop. */
	WreckSeconds: 3.2,
	WreckGravity: 110,
	ScorchSeconds: 7,
	IsKind(value: unknown): value is ExplosionKind {
		return typeIs(value, "string") && KINDS.includes(value as ExplosionKind);
	},
	/** Air kills leave a falling wreck; ground kills leave a smouldering scorch. */
	Leaves(kind: ExplosionKind): "wreck" | "scorch" | undefined {
		return kind === "air" || kind === "ace" ? "wreck" : kind === "ground" ? "scorch" : undefined;
	},
	/** `scale` (clamped 0.5-2.5) grows a profile, e.g. for a big ground target; particle counts stay capped. */
	Profile(kind: ExplosionKind, scale = 1): ExplosionProfile {
		const base = BASE[kind];
		const s = math.clamp(scale, 0.5, 2.5);
		const count = (value: number) => math.min(30, math.round(value * math.sqrt(s)));
		return { size: base.size * s, fire: count(base.fire), smoke: count(base.smoke), sparks: count(base.sparks), smokeLife: base.smokeLife, light: base.light * s };
	},
	/** How many of the oldest entries to drop so one more fits under `cap`. */
	Overflow(active: number, cap: number): number {
		return math.max(0, active - cap + 1);
	},
};
