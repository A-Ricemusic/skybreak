// Shared child-process runner for the offline tools: every spawn gets a deadline.
// A hung Luau script (or any sub-command) is killed and reported with the exact
// command, instead of stalling the gate until the CI job timeout.
// OFFLINE_SPAWN_TIMEOUT_MS overrides the default deadline for every call site that
// does not pass its own timeoutMs.

type Stdio = "pipe" | "inherit" | "ignore";

export interface SpawnOptions {
	cwd?: string;
	env?: Record<string, string | undefined>;
	stdout?: Stdio;
	stderr?: Stdio;
	/** Deadline in milliseconds; defaults to OFFLINE_SPAWN_TIMEOUT_MS or 10 minutes. */
	timeoutMs?: number;
}

export interface SpawnResult {
	/** Captured stdout when stdout is "pipe"; otherwise "". */
	stdout: string;
	/** Captured stderr when stderr is "pipe"; otherwise "". */
	stderr: string;
	code: number;
}

export const DEFAULT_SPAWN_TIMEOUT_MS = positiveEnv("OFFLINE_SPAWN_TIMEOUT_MS") ?? 600_000;

/** Reads a positive integer from the environment, or undefined when unset or invalid. */
export function positiveEnv(name: string): number | undefined {
	const raw = process.env[name];
	if (raw === undefined || raw === "") return undefined;
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer, got ${raw}`);
	return value;
}

/**
 * Spawns a command and waits for it to exit within the deadline. Throws
 * `"<command> timed out after N ms"` after killing the child; otherwise returns
 * stdout, stderr and the exit code without interpreting them, so callers keep
 * their existing summary handling.
 */
export async function spawnWithTimeout(command: string[], options: SpawnOptions = {}): Promise<SpawnResult> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_SPAWN_TIMEOUT_MS;
	const proc = Bun.spawn(command, {
		cwd: options.cwd,
		env: options.env,
		stdout: options.stdout ?? "pipe",
		stderr: options.stderr ?? "pipe",
	});
	const finished = Promise.all([text(proc.stdout), text(proc.stderr), proc.exited]).then(
		([stdout, stderr, code]) => ({ stdout, stderr, code }),
	);
	// The deadline rejects on its own, without waiting for the pipes to close: a
	// grandchild that inherited stdout could otherwise hold the stream open after
	// the child is killed. Bun.spawn offers no detached/process-group option, so
	// only the direct child is killed; a grandchild that survives is orphaned, not
	// awaited, and the caller still fails at the deadline.
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			proc.kill("SIGKILL");
			reject(new Error(`${command.join(" ")} timed out after ${timeoutMs} ms`));
		}, timeoutMs);
	});
	// Once the deadline wins, the abandoned stream promise must not surface as unhandled.
	finished.catch(() => {});
	try {
		return await Promise.race([finished, deadline]);
	} finally {
		clearTimeout(timer);
	}
}

async function text(stream: unknown): Promise<string> {
	return stream instanceof ReadableStream ? new Response(stream).text() : "";
}
