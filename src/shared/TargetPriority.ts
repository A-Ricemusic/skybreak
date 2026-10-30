// Pure nose-first targeting order shared by automatic acquisition and the TGT cycle.
// Plain records only: no Roblox Instances or vectors, so the offline runner and Jest can check it.

/** One targetable contact as seen from the jet. */
export interface TargetCandidate {
	/** Caller's handle (the session enemy index); also the stable tie-break. */
	id: number;
	/** Studs from the jet. */
	distance: number;
	/** Nose alignment: 1 dead ahead, 0 abeam, -1 behind. */
	dot: number;
	/** Counts toward the objective (an ace that has broken off to call its wing does not, see CombatService). */
	required?: boolean;
	/** Inside the lock envelope range for its kind; undefined means unknown and is treated as in range. */
	inRange?: boolean;
	/** Terrain or flight-solid scenery between the jet and the contact (only the leading few are checked). */
	blocked?: boolean;
	/** The server will not let a shot land right now (a retreating ace). */
	held?: boolean;
}

/** Where a TGT press lands and the cursor a quick follow-up press continues from. */
export interface CycleStep { id: number; cursor: number }

/** A required target wins over an optional one within about 18 degrees of the same bearing, never over a clearly nose-aligned optional. */
const REQUIRED_BONUS = 0.05;
/** Of two contacts at the same bearing the nearer wins; the bias never exceeds 0.01 dot. */
const DISTANCE_BIAS = 0.01;
const DISTANCE_SCALE = 1000;
/** Line of sight is checked for this many leading candidates, at most every LOS_INTERVAL seconds per contact. */
const LOS_CANDIDATES = 4;
const LOS_INTERVAL = 0.1;
/** TGT presses this close together walk on through the order instead of snapping back to the nose-best. */
const CYCLE_CHAIN_SECONDS = 2.5;

function finite(value: number): boolean { return value === value && value !== math.huge && value !== -math.huge; }

/** 0: ahead, in range, clear. 1: ahead and in range but blocked or held. 2: ahead but out of range. 3: behind the jet. */
function tier(candidate: TargetCandidate): number {
	const dot = finite(candidate.dot) ? candidate.dot : -1;
	if (dot < 0) return 3;
	if (candidate.inRange === false) return 2;
	return candidate.blocked === true || candidate.held === true ? 1 : 0;
}

/** Higher is better within a tier: nose alignment, a bounded required bonus, a bounded nearness bias. */
function score(candidate: TargetCandidate): number {
	const dot = finite(candidate.dot) ? math.clamp(candidate.dot, -1, 1) : -1;
	const distance = finite(candidate.distance) && candidate.distance >= 0 ? candidate.distance : math.huge;
	const bias = distance === math.huge ? DISTANCE_BIAS : DISTANCE_BIAS * distance / (distance + DISTANCE_SCALE);
	return dot + (candidate.required === true ? REQUIRED_BONUS : 0) - bias;
}

export const TargetPriority = {
	RequiredBonus: REQUIRED_BONUS,
	LosCandidates: LOS_CANDIDATES,
	LosInterval: LOS_INTERVAL,
	CycleChainSeconds: CYCLE_CHAIN_SECONDS,
	Tier: tier,
	Score: score,
	/** A new list, nose-best first. Tiers first, then score, then id, so the order is total and stable. */
	Order<T extends TargetCandidate>(candidates: readonly T[]): T[] {
		return [...candidates].sort((a, b) => {
			const ta = tier(a), tb = tier(b);
			if (ta !== tb) return ta < tb;
			const sa = score(a), sb = score(b);
			return sa !== sb ? sa > sb : a.id < b.id;
		});
	},
	/** The leading candidates that are worth a line-of-sight check: ahead and in range. */
	LosChecks<T extends TargetCandidate>(candidates: readonly T[], limit = LOS_CANDIDATES): T[] {
		const leading: T[] = [];
		for (const candidate of TargetPriority.Order(candidates)) {
			if (leading.size() >= limit || tier(candidate) > 1) break;
			leading.push(candidate);
		}
		return leading;
	},
	/** Automatic acquisition: the nose-best, or undefined with nothing to target. */
	Best(candidates: readonly TargetCandidate[]): number | undefined {
		return TargetPriority.Order(candidates)[0]?.id;
	},
	/**
	 * A TGT press. Off the nose-best it snaps there first; on it, it advances to the next in order.
	 * `cursor` continues a quick chain of presses (see CycleChainSeconds) so every contact stays reachable.
	 */
	Next(candidates: readonly TargetCandidate[], current?: number, cursor?: number): CycleStep | undefined {
		const ordered = TargetPriority.Order(candidates);
		const count = ordered.size();
		if (count === 0) return undefined;
		let index: number;
		if (cursor !== undefined) index = (math.floor(cursor) + 1) % count;
		else if (ordered[0].id !== current) index = 0;
		else index = 1 % count;
		return { id: ordered[index].id, cursor: index };
	},
};
