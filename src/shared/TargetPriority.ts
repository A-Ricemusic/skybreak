/** Plain targeting metrics: no Roblox Instances or vectors. */
export interface TargetCandidate { id: number; distance: number; dot: number }

export const TargetPriority = {
	/** Existing auto-acquire score (lower wins); required-target precedence stays with the caller. */
	AcquireScore(distance: number, dot: number): number {
		return distance + (dot < 0 ? 5000 : (1 - dot) * 700);
	},
	/** Nose alignment dominates; bounded distance bias can break close angles (at most 0.01 dot). */
	CycleScore(candidate: TargetCandidate): number {
		return candidate.dot - 0.01 * candidate.distance / (candidate.distance + 1000);
	},
	/** Returns a new ordered list, with stable id ties independent of sort implementation. */
	Order(candidates: readonly TargetCandidate[]): TargetCandidate[] {
		return [...candidates].sort((a, b) => {
			const left = TargetPriority.CycleScore(a), right = TargetPriority.CycleScore(b);
			return left !== right ? left > right : a.id < b.id;
		});
	},
	Next(candidates: readonly TargetCandidate[], current?: number): number | undefined {
		const ordered = TargetPriority.Order(candidates);
		if (ordered.size() === 0) return undefined;
		const index = ordered.findIndex((candidate) => candidate.id === current);
		return ordered[(index + 1) % ordered.size()].id;
	},
};
