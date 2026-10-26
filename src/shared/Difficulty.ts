// Pure difficulty rules: the level chosen on the briefing screen and how it scales
// combat threat. The server owns every gameplay effect; the client only renders names.

export type DifficultyKind = "easy" | "normal" | "ace";

/** Threat knobs the server multiplies by difficulty. Every value is relative to Normal (1). */
export type DifficultyKnob =
	| "hostileDamage"
	| "hostileGate"
	| "windup"
	| "missileTurn"
	| "aceHealth"
	| "banditHealth"
	| "breakChance"
	| "protectDrain"
	| "score";

/**
 * What a level adds beyond multipliers. Ace changes how enemies fight, not just how long
 * they take to die: every bandit breaks locks and carries a flare, aces launch pairs, and
 * every raider wave brings one more.
 */
export interface DifficultyBehaviour {
	/** Flares every bandit carries at minimum (Act III bandits always carry one on Normal). */
	banditFlares: number;
	/** Every bandit breaks a close lock (once per 12 s), in every act. */
	banditsAlwaysBreak: boolean;
	/** Missiles an ace launches per windup at minimum. */
	aceSalvo: number;
	/** Extra raiders in every raider wave (phase start, mid-phase reinforcement, ace call). */
	extraRaiders: number;
}

export interface DifficultyDefinition {
	kind: DifficultyKind;
	/** Briefing name. */
	name: string;
	/** Three letters for compact labels. */
	short: string;
	/** One line for the briefing picker. */
	description: string;
}

const DEFINITIONS: { [K in DifficultyKind]: DifficultyDefinition } = {
	easy: {
		kind: "easy", name: "EASY", short: "ESY",
		description: "Lighter hits, slower fire, lazier missiles, softer bandits. Scores count for 85%.",
	},
	normal: {
		kind: "normal", name: "NORMAL", short: "NRM",
		description: "The campaign as tuned. Full score.",
	},
	ace: {
		kind: "ace", name: "ACE", short: "ACE",
		description: "Every bandit breaks and flares, aces fire pairs, more raiders. Scores count for 120%.",
	},
};
const ORDER: DifficultyKind[] = ["easy", "normal", "ace"];

/** Multipliers indexed by level; Normal is always 1 so the tuned tables stay authoritative. */
const MULTIPLIERS: { [K in DifficultyKnob]: { [D in DifficultyKind]: number } } = {
	hostileDamage: { easy: 0.6, normal: 1, ace: 1.4 },
	hostileGate: { easy: 1.25, normal: 1, ace: 0.7 },
	windup: { easy: 1.3, normal: 1, ace: 0.8 },
	missileTurn: { easy: 0.8, normal: 1, ace: 1.2 },
	aceHealth: { easy: 0.8, normal: 1, ace: 1.3 },
	// Ace adds behaviour instead of bandit health (see BEHAVIOURS); Easy makes Act II bandits two-missile kills.
	banditHealth: { easy: 0.75, normal: 1, ace: 1 },
	breakChance: { easy: 0.5, normal: 1, ace: 1.3 },
	/** Hull a protected convoy or site loses per raider near it. */
	protectDrain: { easy: 0.75, normal: 1, ace: 1.25 },
	score: { easy: 0.85, normal: 1, ace: 1.2 },
};
const KNOBS: DifficultyKnob[] = ["hostileDamage", "hostileGate", "windup", "missileTurn", "aceHealth", "banditHealth", "breakChance", "protectDrain", "score"];
const BEHAVIOURS: { [K in DifficultyKind]: DifficultyBehaviour } = {
	easy: { banditFlares: 0, banditsAlwaysBreak: false, aceSalvo: 1, extraRaiders: 0 },
	normal: { banditFlares: 0, banditsAlwaysBreak: false, aceSalvo: 1, extraRaiders: 0 },
	ace: { banditFlares: 1, banditsAlwaysBreak: true, aceSalvo: 2, extraRaiders: 1 },
};

function finite(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

export const Difficulty = {
	Default: "normal" as DifficultyKind,
	Order: ORDER,
	Knobs: KNOBS,
	IsKind(value: unknown): value is DifficultyKind {
		return typeIs(value, "string") && ORDER.includes(value as DifficultyKind);
	},
	/** The level itself when valid, otherwise Normal; for anything read off the wire or a save. */
	Coerce(value: unknown): DifficultyKind {
		return Difficulty.IsKind(value) ? value : Difficulty.Default;
	},
	Get(kind: DifficultyKind): DifficultyDefinition { return DEFINITIONS[kind]; },
	All(): DifficultyDefinition[] { return ORDER.map((kind) => DEFINITIONS[kind]); },
	Multiplier(kind: DifficultyKind, knob: DifficultyKnob): number { return MULTIPLIERS[knob][kind]; },
	/** Behaviour switches for this level (see DifficultyBehaviour). */
	Behaviour(kind: DifficultyKind): DifficultyBehaviour { return BEHAVIOURS[Difficulty.Coerce(kind)]; },
	/** `value` scaled for this level; a non-finite value passes through untouched. */
	Scale(kind: DifficultyKind, knob: DifficultyKnob, value: number): number {
		if (!finite(value)) return value;
		return value * MULTIPLIERS[knob][kind];
	},
};
