import { protectedDuration } from "./EngineBatchD7";
import { Act, MissionBlueprint, MissionCatalog, MissionPhaseBlueprint } from "./MissionCatalog";

// Design estimates for an average phone pilot on Normal, NOT live measurements.
// Two standard hits per bandit; later acts retain stronger defensive maneuvers.
const PER_BANDIT: { [A in Act]: number } = { 1: 13, 2: 15, 3: 16 };
function estimate(phase: MissionPhaseBlueprint, act: Act, aceHealth: number): number {
	const count = phase.count ?? 0, points = phase.points?.size() ?? 0, seconds = phase.seconds ?? 0;
	const hazards = (phase.hazard?.count ?? 0) * 10;
	switch (phase.kind) {
		case "protected_air": return math.max(0,...(phase.protection?.aircraft ?? []).map(protectedDuration));
		case "score_threshold": return phase.scoreThreshold?.seconds ?? 0;
		case "tutorial_move": return 20;
		case "tutorial_target": return 10;
		case "tutorial_missile": return 20;
		case "required_air": return 10 + count * PER_BANDIT[act];
		case "required_ground": return count * 10;
		case "return_line": return 70;
		case "landing": return 0;
		case "route": return points * 12;
		case "recon": return points * (seconds * 1.25 + 10);
		case "escort": case "defend": return seconds * 1.05 + 10 + hazards;
		case "signal": return seconds * 1.25 + 10 + hazards;
		case "chase": return 45;
		case "ace": return aceHealth * 0.36;
	}
}
export interface ContactWindow { seconds: number; live: number; directed: boolean; ace: boolean }
export const MissionPacing = {
	/**
	 * Design model, not missile simulation or measured player telemetry. Uses the same
	 * phase durations as EstimateSeconds, authored wave shares and a per-bandit clear
	 * time. Kill phases taper their contact; optional raiders are cleared in parallel
	 * with navigation. Ace calls start at thirds of the fight. One-second windows let
	 * balance specs apply the real gate/divisor without assuming seven permanent foes.
	 */
	ContactWindows(blueprint: MissionBlueprint): ContactWindow[] {
		const windows: ContactWindow[] = [];
		for (const phase of MissionCatalog.ExpandedPhases(blueprint)) {
			const duration = estimate(phase, blueprint.act, blueprint.aceHealth ?? 165);
			const contactEnd = duration * (phase.twist?.mode === "now" ? phase.twist.at : 1);
			const waves: { at: number; count: number }[] = [];
			const initial = MissionCatalog.InitialRaiders(phase);
			if (initial > 0) waves.push({ at: 0, count: initial });
			for (const wave of phase.reinforce ?? []) waves.push({ at: wave.at * duration, count: wave.count });
			if (phase.kind === "ace") {
				const count = phase.optionalRaiders ?? 0;
				waves.push({ at: duration / 3, count: math.ceil(count / 2) }, { at: duration * 2 / 3, count: math.floor(count / 2) });
			}
			for (let time = 0; time < contactEnd; time++) {
				let live = phase.kind === "required_air" ? math.ceil((phase.count ?? 0) * (1 - time / duration)) : 0;
				for (const wave of waves) {
					const elapsed = time - wave.at;
					if (elapsed >= 0) live += math.clamp(wave.count - math.floor(math.max(0, elapsed - 10) / PER_BANDIT[blueprint.act]), 0, wave.count);
				}
				windows.push({ seconds: math.min(1, contactEnd - time), live: math.min(7, live), directed: phase.directed === true, ace: phase.kind === "ace" });
			}
		}
		return windows;
	},
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
