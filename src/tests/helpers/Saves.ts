// Shared campaign-save fixtures: an in-memory CampaignCoordinator with a frozen clock and no-op
// deferral, plus a full-credit mission completion driven through the production settlement path
// (`completeMission`). Pure Luau: CampaignRepository is itself staged offline.
import { CampaignCoordinator, completeMission } from "../../server/CampaignRepository";
import { MissionCatalog } from "../../shared/MissionCatalog";
import type { TargetScore, TargetScoreSnapshot } from "../../shared/TargetScore";
import type { MissionFinished } from "../../shared/Types";

/** A loaded coordinator keyed by `key`, with `now` pinned to 1000 and deferred work dropped. */
export function freshCoordinator(key: string): CampaignCoordinator {
	const c = new CampaignCoordinator(key, undefined, { now: () => 1000, defer: () => undefined });
	c.load();
	return c;
}

export interface FinishOptions {
	/** Completed phases; defaults to every phase of the mission. */
	phases?: number;
	/** Elapsed seconds; defaults to 100. */
	elapsed?: number;
	/** Ledger whose snapshot is submitted as the target score. */
	score?: TargetScore;
	/** Pre-built snapshot submitted as the target score; wins over `score`. */
	snapshot?: TargetScoreSnapshot;
}

/** Settles `missionId` on slot 1 with every required kill credited; returns completeMission's result. */
export function finishMission(
	c: CampaignCoordinator,
	missionId: number,
	extra: FinishOptions = {},
	notify: (m: MissionFinished) => void = () => undefined,
): boolean {
	const m = MissionCatalog.Get(missionId);
	return completeMission(
		c,
		1,
		missionId,
		true,
		{
			slot: 1,
			missionId,
			kills: MissionCatalog.RequiredAirKills(m) + MissionCatalog.RequiredGroundKills(m),
			groundKills: MissionCatalog.RequiredGroundKills(m),
			completedPhases: extra.phases ?? MissionCatalog.TotalPhases(m),
			elapsed: extra.elapsed ?? 100,
			targetScore: extra.snapshot ?? extra.score?.Snapshot(),
		},
		notify,
		0,
	);
}
