// Pure staggered-wave rules for `required_air` phases. A phase with `groups` splits its
// count into that many groups (larger first). The next group spawns `stagger` seconds after
// the previous one, or sooner once half of the previous group is down.
export interface WaveDue {
	/** Index of the next group to spawn. */
	next: number;
	plan: number[];
	/** Seconds since the previous group spawned. */
	sinceLast: number;
	stagger: number;
	/** Required kills scored in this phase so far. */
	killed: number;
}
export const WavePlan = {
	DefaultStagger: 18,
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
		let spawned = 0;
		for (let index = 0; index < input.next; index++) spawned += input.plan[index];
		const last = input.plan[input.next - 1];
		const downInLast = input.killed - (spawned - last);
		return input.sinceLast >= input.stagger || downInLast >= math.ceil(last / 2);
	},
};
