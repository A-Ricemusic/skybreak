// Pure per-target scoring. The server wiring owns target identity and decides
// when a kill happened; this ledger only deduplicates and totals those facts.
import { MissionScoringPolicy } from "./MissionPolicy";

export interface TargetScoreSnapshot {
	total: number;
	kills: { [role: string]: number };
	points: { [role: string]: number };
}

function finiteNonnegative(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value >= 0 && value < math.huge;
}

export class TargetScore {
	private total = 0;
	private readonly targetIds = new Set<string>();
	private readonly kills: { [role: string]: number } = {};
	private readonly points: { [role: string]: number } = {};

	public constructor(private readonly policy: MissionScoringPolicy) {}

	/** Records one unique, non-empty target id. Missing/invalid role values award zero points. */
	public RecordKill(targetId: string, role: string, breakdownRole = role): boolean {
		if (!typeIs(targetId, "string") || !typeIs(role, "string") || targetId.size() === 0 || this.targetIds.has(targetId)) return false;
		this.targetIds.add(targetId);

		const key = breakdownRole;
		this.kills[key] = (this.kills[key] ?? 0) + 1;
		const configured = this.policy.points[role];
		const awarded = finiteNonnegative(configured) ? configured : 0;
		this.points[key] = (this.points[key] ?? 0) + awarded;
		this.total += awarded;
		return true;
	}

	public Total(): number { return this.total; }
	public RoleKills(role: string): number { return this.kills[role] ?? 0; }
	public RolePoints(role: string): number { return this.points[role] ?? 0; }

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
export function targetScoreStats(ledger: TargetScore, policy: MissionScoringPolicy): { targetScore?: TargetScoreSnapshot } {
	return policy.basis === "points" ? { targetScore: ledger.Snapshot() } : {};
}

/** Defensive copy for optional persisted breakdowns. Invalid/old fields are ignored. */
export function readTargetScore(value: unknown, expectedTotal?: number): TargetScoreSnapshot | undefined {
	if (!typeIs(value, "table")) return undefined;
	const raw = value as Partial<TargetScoreSnapshot>;
	if (!finiteNonnegative(raw.total) || (expectedTotal !== undefined && raw.total !== expectedTotal)
		|| !typeIs(raw.kills, "table") || !typeIs(raw.points, "table")) return undefined;
	const kills: { [role: string]: number } = {};
	const points: { [role: string]: number } = {};
	let total = 0;
	for (const [role, count] of pairs(raw.kills)) {
		if (!typeIs(role, "string") || role.size() === 0 || role.size() > 32 || !finiteNonnegative(count) || count % 1 !== 0) return undefined;
		const awarded = raw.points[role];
		if (!finiteNonnegative(awarded)) return undefined;
		kills[role] = count;
		points[role] = awarded;
		total += awarded;
	}
	for (const [role] of pairs(raw.points)) if (kills[role] === undefined) return undefined;
	return total === raw.total ? { total, kills, points } : undefined;
}
