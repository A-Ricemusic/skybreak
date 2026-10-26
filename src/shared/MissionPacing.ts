import { Act, MissionBlueprint, MissionCatalog, MissionPhaseBlueprint } from "./MissionCatalog";

// Design estimates for an average phone pilot on Normal, NOT live measurements.
// Two standard hits per bandit; later acts retain stronger defensive maneuvers.
const PER_BANDIT: { [A in Act]: number } = { 1: 13, 2: 15, 3: 16 };
function estimate(phase: MissionPhaseBlueprint, act: Act, aceHealth: number): number {
	const count = phase.count ?? 0, points = phase.points?.size() ?? 0, seconds = phase.seconds ?? 0;
	const hazards = (phase.hazard?.count ?? 0) * 10;
	switch (phase.kind) {
		case "tutorial_move": return 20;
		case "tutorial_target": return 10;
		case "tutorial_missile": return 20;
		case "required_air": return 10 + count * PER_BANDIT[act];
		case "required_ground": return count * 10;
		case "route": return points * 12;
		case "recon": return points * (seconds * 1.25 + 10);
		case "escort": case "defend": return seconds * 1.05 + 10 + hazards;
		case "signal": return seconds * 1.25 + 10 + hazards;
		case "chase": return 45;
		case "ace": return aceHealth * 0.36;
	}
}
export const MissionPacing = {
	/** Transit, objective work, drift while fighting, and four seconds per phase change. */
	EstimateSeconds(blueprint: MissionBlueprint): number {
		let seconds = 20;
		for (const phase of MissionCatalog.ExpandedPhases(blueprint)) {
			const share = phase.twist?.mode === "now" ? phase.twist.at : 1;
			seconds += estimate(phase, blueprint.act, blueprint.aceHealth ?? 165) * share + 4;
		}
		return seconds;
	},
};
