/**
 * Undo steps for resources created one at a time (the cutscene's stage, Lighting overrides,
 * post effects, connections). Register each step the moment its resource exists, so a setup
 * that throws halfway leaves nothing behind. `run` is idempotent: it calls every step once,
 * newest first, each under its own pcall so one failing restore cannot skip the rest. A step
 * added after `run` runs at once. No engine types, so the offline Luau runner checks it.
 */
export interface Teardown {
	add: (step: () => void) => void;
	run: () => void;
	/** True once `run` has started. */
	ran: () => boolean;
}

export function createTeardown(report: (message: string) => void = () => undefined): Teardown {
	let steps: (() => void)[] = [];
	let done = false;
	const attempt = (step: () => void) => {
		const [ok, problem] = pcall(step);
		if (!ok) report(tostring(problem));
	};
	return {
		add: (step) => {
			if (done) attempt(step);
			else steps.push(step);
		},
		run: () => {
			if (done) return;
			done = true;
			const pending = steps;
			steps = [];
			for (let i = pending.size() - 1; i >= 0; i--) attempt(pending[i]);
		},
		ran: () => done,
	};
}
