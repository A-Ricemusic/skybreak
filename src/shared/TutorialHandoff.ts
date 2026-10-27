import { FlightMath, FlightState } from "./FlightMath";
import { MissionRuleState } from "./MissionRules";
import { FlightInput } from "./Types";

export interface HandoffState { checked: boolean; recovered: boolean; blocked: boolean }
export const TutorialHandoff = {
	New(): HandoffState { return { checked: false, recovered: false, blocked: false }; },
	Notice: "Safety recovery: upright; progress/speed saved. Release ALL turn/pitch holds or center sticks, then TGT.",
	/** One decision at the movement -> target boundary, never a recurring flight assist. */
	Begin(handoff: HandoffState, rules: MissionRuleState, flight: FlightState): boolean {
		if (handoff.checked || rules.missionId !== 1 || rules.outcome !== undefined || rules.phase !== "tutorial_target") return false;
		handoff.checked = true;
		FlightMath.Sync(flight);
		// Gentle flight keeps its pose. 20 degrees pitch / 45 bank allow small corrections;
		// 225 studs clears the 125-stud rim hills; descending flight also needs two seconds of headroom.
		const [, vertical] = FlightMath.ForwardOf(flight);
		const floor = 225 + math.max(0, -vertical) * flight.speed * 2;
		if (flight.y >= floor && math.abs(flight.pitch) <= math.rad(20) && math.abs(flight.roll) <= math.rad(45)
			&& math.abs(flight.x) < 3000 && math.abs(flight.z) < 3000) return false;
		flight.x = 0; flight.y = 800; flight.z = 500; flight.lean = 0;
		FlightMath.SetAttitude(flight, 0, 0);
		handoff.recovered = true; handoff.blocked = true;
		return true;
	},
	/** Release latch, not timed immunity: stale holds never become a fresh steering command.
	 * Raw input still travels upstream, so the server can observe the same neutral sample. */
	Filter(gate: { blocked: boolean }, input: FlightInput): FlightInput {
		if (gate.blocked && math.abs(input.x) < 0.15 && math.abs(input.y) < 0.15) gate.blocked = false;
		return gate.blocked ? { x: 0, y: 0, throttle: input.throttle, assist: input.assist } : input;
	},
	/** No release latch survives the protected targeting/missile lessons. */
	Practice(rules: MissionRuleState): boolean {
		return rules.missionId === 1 && rules.outcome === undefined && (rules.phase === "tutorial_target" || rules.phase === "tutorial_missile");
	},
};
