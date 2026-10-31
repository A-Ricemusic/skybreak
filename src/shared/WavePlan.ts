import type { FighterArrival, StandaloneAce } from "./CampaignEncounters";
// Pure staggered-wave rules for `required_air` phases. A phase with `groups` splits its
// count into that many groups (larger first). The next group spawns `stagger` seconds after
// the previous one, or sooner once half of the previous group is down. A group with an
// authored `groupAt` trigger instead waits for that share of the whole phase to be down.
//
// Fighter aircraft go through the live-aircraft budget (route bombers have a separate six-slot budget):
// at most AIR_BUDGET up at once on every difficulty, including Ace's extra raiders.
// What does not fit waits in a queue, required bandits first, until kills free a slot.
export interface WaveDue {
	/** Index of the next group to spawn. */
	next: number;
	plan: number[];
	/** Seconds since the previous group spawned. */
	sinceLast: number;
	stagger: number;
	/** Required kills scored in this phase so far. */
	killed: number;
	/** Authored triggers for groups 1.. (share of the whole phase down); a group without one uses the stagger rules. */
	groupAt?: number[];
}
/** Aircraft waiting for a slot under the live-aircraft budget. */
export interface AirRequest {
	arrival?: FighterArrival | StandaloneAce;
	role: "bandit" | "raider" | "escort" | "ace";
	count: number;
	/** Arrive from the rear quarter. */
	behind: boolean;
	/** Radio line said when the first of these actually spawns. */
	call?: string;
}
/** Most hostile aircraft alive at once on Normal. */
const AIR_BUDGET = 7;
const ROLES: AirRequest["role"][] = ["bandit", "ace", "escort", "raider"];
export const WavePlan = {
	DefaultStagger: 18,
	AirBudget: AIR_BUDGET,
	/** Group sizes for `count` bandits split into `groups`, as even as possible with the larger groups first. */
	Groups(count: number, groups = 1): number[] {
		const total = math.max(0, math.floor(count));
		if (total <= 0) return [];
		const n = math.clamp(math.floor(groups), 1, total);
		const plan: number[] = [];
		const base = math.floor(total / n);
		const extra = total % n;
		for (let index = 0; index < n; index++) plan.push(base + (index < extra ? 1 : 0));
		return plan;
	},
	/**
	 * Bracket sides (+1 or -1) for `count` aircraft spawned together, the first being the sortie's
	 * `firstSerial`-th air spawn: neighbours alternate, within a group and across groups.
	 */
	BracketSides(firstSerial: number, count: number): number[] {
		const sides: number[] = [];
		for (let index = 0; index < count; index++) sides.push((firstSerial + index) % 2 === 0 ? 1 : -1);
		return sides;
	},
	/** Whether group `next` should spawn now. */
	Due(input: WaveDue): boolean {
		if (input.next <= 0 || input.next >= input.plan.size()) return false;
		let spawned = 0, total = 0;
		for (let index = 0; index < input.plan.size(); index++) {
			if (index < input.next) spawned += input.plan[index];
			total += input.plan[index];
		}
		const at = input.groupAt?.[input.next - 1];
		if (at !== undefined) return input.killed + 1e-5 >= at * total;
		const last = input.plan[input.next - 1];
		const downInLast = input.killed - (spawned - last);
		return input.sinceLast >= input.stagger || downInLast >= math.ceil(last / 2);
	},
	/** Live-aircraft budget; difficulty-added raiders queue within the same seven slots. */
	Budget(_extraRaiders = 0): number {
		return AIR_BUDGET;
	},
	/**
	 * Takes what may spawn now from `queue` given `room` free slots: bandits first (the phase needs
	 * them), then raiders, each in the order asked. The rest stays queued; drained requests are removed.
	 * Optional `routeRoom` caps routed arrivals within the same total slots; blocked routes are skipped.
	 * A request's `call` goes with its first batch.
	 */
	Admit(queue: AirRequest[], room: number, routeRoom = room): AirRequest[] {
		const batches: AirRequest[] = [];
		let free = math.max(0, math.floor(room));
		let routes = math.max(0, math.floor(routeRoom));
		for (const role of ROLES) {
			for (const request of queue) {
				if (free <= 0) break;
				if (request.role !== role || request.count <= 0) continue;
				const routed = request.arrival !== undefined && "route" in request.arrival && request.arrival.route !== undefined;
				const count = math.min(free, request.count, routed ? routes : free);
				if (count <= 0) continue; // Skip a blocked patrol so pursuing fighters can still launch.
				if (routed) routes -= count;
				batches.push({ arrival: request.arrival, role, count, behind: request.behind, call: request.call });
				request.count -= count; request.call = undefined; free -= count;
			}
		}
		for (let index = queue.size() - 1; index >= 0; index--) if (queue[index].count <= 0) queue.remove(index);
		return batches;
	},
	/** Aircraft of `role` still waiting for a slot. */
	Queued(queue: AirRequest[], role: AirRequest["role"]): number {
		let total = 0;
		for (const request of queue) if (request.role === role) total += request.count;
		return total;
	},
};
