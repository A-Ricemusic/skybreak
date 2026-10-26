// Pure post-mission scoring shared by the server (authoritative score, saved bests)
// and the debrief screen. Nothing here reads instances or the clock.
import { Difficulty, DifficultyKind } from "./Difficulty";
import { MissionBlueprint, MissionCatalog, MissionPhaseBlueprint } from "./MissionCatalog";

export type MissionRank = "S" | "A" | "B" | "C" | "D";

/** Best first; index 0 is the highest rank. */
export const RANK_ORDER: readonly MissionRank[] = ["S", "A", "B", "C", "D"];

export interface ScoreInput {
	won: boolean;
	airKills: number;
	groundKills: number;
	elapsed: number;
	/** Par time in seconds for this mission (see `MissionScore.ParSeconds`). */
	par: number;
	missilesFired: number;
	missileHits: number;
	/** Hull points lost (the hull starts at 100). */
	damageTaken: number;
	/** Level the sortie was flown on; scales the score (not the rank). Absent or unknown means Normal. */
	difficulty?: DifficultyKind | string;
}

export interface ScoreResult {
	score: number;
	rank: MissionRank;
	/** 0-100 performance rating the rank is cut from. */
	rating: number;
	/** 0-1 component ratings, for display. */
	time: number;
	accuracy: number;
	survival: number;
}

const AIR_POINTS = 100;
const GROUND_POINTS = 150;
/** Points per rating point on a win, so a perfect sortie adds 5000. */
const RATING_POINTS = 50;
/** Time rating reaches 0 at this multiple of par. */
const SLOW_LIMIT = 2.5;
const WEIGHT_TIME = 40;
const WEIGHT_ACCURACY = 30;
const WEIGHT_SURVIVAL = 30;
const RANK_CUTS: { rank: MissionRank; rating: number }[] = [
	{ rank: "S", rating: 90 },
	{ rank: "A", rating: 75 },
	{ rank: "B", rating: 55 },
	{ rank: "C", rating: 35 },
];

function finite(value: number, fallback = 0): number {
	return typeIs(value, "number") && value === value && math.abs(value) !== math.huge ? value : fallback;
}

/** Seconds a clean, direct run of one phase should take. */
function phasePar(phase: MissionPhaseBlueprint): number {
	const count = phase.count ?? 0;
	const points = phase.points?.size() ?? 0;
	const seconds = phase.seconds ?? 0;
	switch (phase.kind) {
		case "tutorial_move": return 10;
		case "tutorial_target": return 10;
		case "tutorial_missile": return 20;
		case "required_air": return count * 22;
		case "required_ground": return count * 15;
		case "ace": return 75;
		case "route": return points * 15;
		case "recon": return points * (seconds + 15);
		default: return seconds + 15; // signal, escort, defend: the hold plus getting on station
	}
}

export const MissionScore = {
	/** Par time for a mission: transit plus each phase's clean-run estimate, rounded up to 5 s. */
	ParSeconds(blueprint: MissionBlueprint): number {
		let total = 20;
		for (const phase of MissionCatalog.ExpandedPhases(blueprint)) total += phasePar(phase);
		return math.ceil(total / 5) * 5;
	},

	Compute(input: ScoreInput): ScoreResult {
		const airKills = math.max(0, math.floor(finite(input.airKills)));
		const groundKills = math.max(0, math.floor(finite(input.groundKills)));
		const fired = math.max(0, math.floor(finite(input.missilesFired)));
		const hits = math.clamp(math.floor(finite(input.missileHits)), 0, fired);
		const elapsed = math.max(0, finite(input.elapsed));
		const par = math.max(1, finite(input.par, 1));
		const damage = math.clamp(finite(input.damageTaken), 0, 100);

		const time = elapsed <= par ? 1 : math.clamp(1 - (elapsed - par) / (par * (SLOW_LIMIT - 1)), 0, 1);
		// A sortie with no shots fired (pure flying objectives) is not penalised for accuracy.
		const accuracy = fired > 0 ? hits / fired : 1;
		const survival = 1 - damage / 100;
		const killPoints = airKills * AIR_POINTS + groundKills * GROUND_POINTS;
		// Ace earns a modest bonus and Easy a small penalty on points only; the rank still reads the flying.
		const difficulty = Difficulty.Coerce(input.difficulty);
		const scaled = (points: number) => math.floor(Difficulty.Scale(difficulty, "score", points) + 1e-6);
		if (!input.won) return { score: scaled(killPoints), rank: "D", rating: 0, time, accuracy, survival };

		const rating = math.floor(WEIGHT_TIME * time + WEIGHT_ACCURACY * accuracy + WEIGHT_SURVIVAL * survival + 1e-6);
		let rank: MissionRank = "D";
		for (const cut of RANK_CUTS) {
			if (rating >= cut.rating) { rank = cut.rank; break; }
		}
		return { score: scaled(killPoints + rating * RATING_POINTS), rank, rating, time, accuracy, survival };
	},

	IsRank(value: unknown): value is MissionRank {
		return value === "S" || value === "A" || value === "B" || value === "C" || value === "D";
	},

	/** The better of two ranks; undefined only when both are. */
	BetterRank(left?: MissionRank, right?: MissionRank): MissionRank | undefined {
		if (left === undefined) return right;
		if (right === undefined) return left;
		return RANK_ORDER.indexOf(left) <= RANK_ORDER.indexOf(right) ? left : right;
	},
};
