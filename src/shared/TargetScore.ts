// Pure per-target scoring. The server wiring owns target identity and decides
// when a kill happened; this ledger only deduplicates and totals those facts.
import { isFiniteNumber } from "./Finite";
import { MissionScoringPolicy } from "./MissionPolicy";

export interface TargetScoreSnapshot {
	total: number;
	kills: { [role: string]: number };
	points: { [role: string]: number };
}

function finiteNonnegative(value: unknown): value is number {
	return isFiniteNumber(value) && value >= 0;
}

function finiteMap(map: unknown): boolean {
	if (!typeIs(map, "table")) return false;
	for (const [, value] of pairs(map as Map<string, unknown>)) if (!isFiniteNumber(value)) return false;
	return true;
}

/** Wire-side check for a result packet's `targetScore`: finite total and numeric per-role maps. */
export function isTargetScoreSnapshot(value: unknown): value is TargetScoreSnapshot {
	if (!typeIs(value, "table")) return false;
	const snapshot = value as Partial<TargetScoreSnapshot>;
	return isFiniteNumber(snapshot.total) && finiteMap(snapshot.kills) && finiteMap(snapshot.points);
}

export class TargetScore {
	private total = 0;
	private readonly targetIds = new Set<string>();
	private readonly kills: { [role: string]: number } = {};
	private readonly points: { [role: string]: number } = {};

	public constructor(private readonly policy: MissionScoringPolicy) {}

	/** Records one unique, non-empty target id. Missing/invalid role values award zero points. */
	public RecordKill(targetId: string, role: string, breakdownRole = role): boolean {
		if (
			!typeIs(targetId, "string") ||
			!typeIs(role, "string") ||
			targetId.size() === 0 ||
			this.targetIds.has(targetId)
		)
			return false;
		this.targetIds.add(targetId);

		const key = breakdownRole;
		this.kills[key] = (this.kills[key] ?? 0) + 1;
		const configured = this.policy.points[role];
		const awarded = finiteNonnegative(configured) ? configured : 0;
		this.points[key] = (this.points[key] ?? 0) + awarded;
		this.total += awarded;
		return true;
	}

	public Total(): number {
		return this.total;
	}
	public RoleKills(role: string): number {
		return this.kills[role] ?? 0;
	}
	public RolePoints(role: string): number {
		return this.points[role] ?? 0;
	}

	/** Returns detached plain tables suitable for result packets and persistence. */
	public Snapshot(): TargetScoreSnapshot {
		const kills: { [role: string]: number } = {};
		const points: { [role: string]: number } = {};
		for (const [role, count] of pairs(this.kills)) kills[role] = count;
		for (const [role, value] of pairs(this.points)) points[role] = value;
		return { total: this.total, kills, points };
	}
}

/** Rating sorties omit the field entirely to preserve legacy result packets. */
export function targetScoreStats(
	ledger: TargetScore,
	policy: MissionScoringPolicy,
): { targetScore?: TargetScoreSnapshot } {
	return policy.basis === "points" ? { targetScore: ledger.Snapshot() } : {};
}

// The largest authored scoring policy (M10) has 22 roles; 32 leaves room for extensions.
// Bound both maps and a conservative JSON byte estimate, including repeated keys and numbers.
export const MAX_TARGET_SCORE_ROLES = 32;
export const MAX_TARGET_SCORE_BYTES = 4096;

/** Defensive copy for optional persisted breakdowns. Invalid/old fields are ignored. */
export function readTargetScore(value: unknown, expectedTotal?: number): TargetScoreSnapshot | undefined {
	if (!typeIs(value, "table")) return undefined;
	const raw = value as Partial<TargetScoreSnapshot>;
	if (
		!finiteNonnegative(raw.total) ||
		(expectedTotal !== undefined && raw.total !== expectedTotal) ||
		!typeIs(raw.kills, "table") ||
		!typeIs(raw.points, "table")
	)
		return undefined;
	const kills: { [role: string]: number } = {};
	const points: { [role: string]: number } = {};
	let total = 0;
	let roles = 0;
	let bytes = 64;
	for (const [role, count] of pairs(raw.kills)) {
		roles++;
		if (
			roles > MAX_TARGET_SCORE_ROLES ||
			!typeIs(role, "string") ||
			role.size() === 0 ||
			role.size() > 32 ||
			!finiteNonnegative(count) ||
			count % 1 !== 0
		)
			return undefined;
		const awarded = raw.points[role];
		if (!finiteNonnegative(awarded)) return undefined;
		// JSON escapes may expand each role byte to six bytes; charge both repeated map keys.
		bytes += role.size() * 12 + tostring(count).size() + tostring(awarded).size() + 16;
		if (bytes > MAX_TARGET_SCORE_BYTES) return undefined;
		kills[role] = count;
		points[role] = awarded;
		total += awarded;
	}
	let pointRoles = 0;
	for (const [role] of pairs(raw.points)) {
		pointRoles++;
		if (pointRoles > MAX_TARGET_SCORE_ROLES || kills[role] === undefined) return undefined;
	}
	return total === raw.total ? { total, kills, points } : undefined;
}
