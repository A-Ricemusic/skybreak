// Settlement's kill totals come from the runner ledger (audit F3). The debrief sends `kills` and `groundKills`
// and CampaignRepository treats `kills - groundKills` as air kills, so both must come from one source.
import { describe, expect, it } from "@rbxts/jest-globals";
import type { CombatSession } from "../server/CombatSession";
import { sessionRecordKill, sessionTick, syncElapsed } from "../server/SessionProgress";
import { recordAlliedKill, runnerAllKills, runnerGroundKills } from "../server/SortieScore";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionBlueprint, MissionCatalog } from "../shared/MissionCatalog";
import { MissionAllies } from "../shared/MissionPolicy";
import { TargetScore } from "../shared/TargetScore";

function sortie() {
	const base = MissionCatalog.Get(3);
	const blueprint = {
		...base,
		phases: [
			{ kind: "required_air", label: "Intercept", count: 2, optionalRaiders: 2 },
			{ kind: "required_ground", label: "Strike", count: 1, groundTargets: [] },
			{ kind: "ace", label: "Ace" },
		],
	} as unknown as MissionBlueprint;
	const blueprintState = BlueprintRunner.NewState(blueprint, 0);
	const targetScore = new TargetScore(base.scoring!);
	const session = { blueprintState, targetScore, elapsed: 0 } as unknown as CombatSession;
	const allies = { ...base.allies!, killBudget: 2 } as MissionAllies;
	return { blueprint, session, state: blueprintState, ledger: targetScore, allies, destroyed: [] as string[] };
}

describe("Settlement kill tally", () => {
	it("agrees with the runner after air, ground, optional and allied kills", () => {
		const { blueprint, session, state, ledger, allies, destroyed } = sortie();
		// Uncredited allied kill: accepted (the target dies) but never a player kill.
		expect(recordAlliedKill(state, ledger, destroyed, allies, "raider-ally", "air", false, 1, "raider")).toBe(true);
		expect(runnerAllKills(state)).toBe(0);
		// Optional air by the player, then a credited allied kill (a legacy credit policy).
		expect(sessionRecordKill(session, "raider-1", "air", false, 2, "raider")).toBe(true);
		const credited = { ...allies, creditPlayerKills: true };
		expect(recordAlliedKill(state, ledger, destroyed, credited, "raider-2", "air", false, 3, "raider")).toBe(true);
		expect(state.optionalAirKills).toBe(2);
		// Required air clears phase one.
		expect(sessionRecordKill(session, "bandit-1", "air", true, 4)).toBe(true);
		expect(sessionRecordKill(session, "bandit-2", "air", true, 5)).toBe(true);
		expect(state.phaseIndex).toBe(1);
		// Optional then required ground clears phase two; the required ace ends the sortie.
		expect(sessionRecordKill(session, "aa-1", "ground", false, 6, "aa_gun")).toBe(true);
		expect(sessionRecordKill(session, "dome-1", "ground", true, 7, "radar_dome")).toBe(true);
		expect(state.phaseIndex).toBe(2);
		expect(sessionRecordKill(session, "ace-1", "ace", true, 8, "ace")).toBe(true);
		expect(state.outcome).toBe("won");

		const kills = runnerAllKills(state);
		const groundKills = runnerGroundKills(state);
		// Independent tally of the player-credited destructions above (the uncredited allied kill excluded).
		expect(kills).toBe(7);
		expect(groundKills).toBe(2);
		expect(kills - groundKills).toBe(state.requiredAirKills + (state.aceKilled ? 1 : 0) + state.optionalAirKills);
		// The repository's objective check (CampaignRepository.recordMissionResult) passes on these totals.
		expect(groundKills <= kills).toBe(true);
		expect(kills - groundKills >= MissionCatalog.RequiredAirKills(blueprint)).toBe(true);
		expect(groundKills >= MissionCatalog.RequiredGroundKills(blueprint)).toBe(true);
	});

	it("keeps duplicate target ids idempotent across player and allied admission", () => {
		const { session, state, ledger, allies, destroyed } = sortie();
		expect(sessionRecordKill(session, "raider-1", "air", false, 1, "raider")).toBe(true);
		const points = ledger.Total();
		expect(sessionRecordKill(session, "raider-1", "air", false, 2, "raider")).toBe(false);
		expect(recordAlliedKill(state, ledger, destroyed, allies, "raider-1", "air", false, 3, "raider")).toBe(false);
		expect(recordAlliedKill(state, ledger, destroyed, allies, "raider-2", "air", false, 4, "raider")).toBe(true);
		expect(sessionRecordKill(session, "raider-2", "air", false, 5, "raider")).toBe(false);
		expect(sessionRecordKill(session, "bandit-1", "air", true, 6)).toBe(true);
		expect(sessionRecordKill(session, "bandit-1", "air", true, 7)).toBe(false);
		expect(runnerAllKills(state)).toBe(2);
		expect(runnerGroundKills(state)).toBe(0);
		expect(ledger.Total() >= points).toBe(true);
		expect(sessionRecordKill(session, "", "air", false, 8, "raider")).toBe(false);
		expect(runnerAllKills(state)).toBe(2);
	});

	it("reports zero without a runner and syncs the clock and score through SessionProgress", () => {
		expect(runnerAllKills(undefined)).toBe(0);
		expect(runnerGroundKills(undefined)).toBe(0);
		const { session, state, ledger } = sortie();
		expect(sessionRecordKill(session, "bandit-1", "air", true, 1)).toBe(true);
		sessionTick(session, 4, 100);
		syncElapsed(session);
		expect(state.score).toBe(ledger.Total());
		expect(session.elapsed).toBe(state.elapsed);
		expect(session.elapsed > 0).toBe(true);
	});
});
