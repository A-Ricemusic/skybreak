import { lstat, readdir, realpath, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const root = await realpath(resolve(import.meta.dir, ".."));
const dryRun = process.argv.includes("--dry-run");
const removed: string[] = [];
let reclaimedBytes = 0;

// Read the index before deleting anything, and fail closed outside a Git repo.
const index = Bun.spawnSync(["git", "-C", root, "ls-files", "--cached", "-z"]);
if (index.exitCode !== 0) throw new Error("Cannot read tracked files; refusing cleanup.");
const tracked = index.stdout.toString().split("\0").filter(Boolean).map((path) => resolve(root, path));
const trackedFolded = tracked.map((path) => path.toLowerCase());

function contains(parent: string, child: string): boolean {
	const path = relative(parent, child);
	return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}

async function safePath(path: string): Promise<boolean> {
	if (path === root || !contains(root, path)) throw new Error(`Refusing cleanup outside repository: ${path}`);
	let current = root;
	for (const part of relative(root, path).split(sep)) {
		current = resolve(current, part);
		try {
			if ((await lstat(current)).isSymbolicLink()) {
				console.warn(`Preserved symlink path: ${relative(root, path)}`);
				return false;
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
			throw error;
		}
	}
	return true;
}

async function sizeOf(path: string): Promise<number> {
	const stat = await lstat(path);
	// rm does not traverse directory symlinks; count just the link itself too.
	if (!stat.isDirectory()) return stat.size;

	let total = 0;
	for (const entry of await readdir(path)) {
		total += await sizeOf(resolve(path, entry));
	}
	return total;
}

async function removePath(path: string): Promise<void> {
	if (!(await safePath(path))) return;
	// Compare case-insensitively: macOS/Windows volumes usually are, and
	// over-preserving is the safe failure mode for this guard.
	const folded = path.toLowerCase();
	if (trackedFolded.some((file) => contains(folded, file) || contains(file, folded))) {
		console.warn(`Preserved path containing tracked files: ${relative(root, path)}`);
		return;
	}
	try {
		reclaimedBytes += await sizeOf(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}

	removed.push(relative(root, path));
	if (!dryRun) await rm(path, { recursive: true, force: true });
}

// roblox-ts recreates both directories during the next build.
await removePath(resolve(root, "out"));
await removePath(resolve(root, "include"));

// These exports are generated entirely by the Blender Python sources. Keep the
// mesh JSON because tools/package-aircraft.ts consumes it during every build.
// Also preserve .blend and .blend1 files in case someone makes manual edits
// after generation; those require an explicit human review before deletion.
for (const aircraft of ["kestrel", "vanta"]) {
	for (const suffix of [".fbx", ".glb", ".stats.json", "-three-quarter.png", "-top.png"]) {
		await removePath(resolve(root, `assets/aircraft/${aircraft}${suffix}`));
	}
}

const build = resolve(root, "build");
try {
	const entries = (await safePath(build)) ? await readdir(build, { withFileTypes: true }) : [];
	const entryNames = new Set(entries.map((entry) => entry.name));
	for (const entry of entries) {
		if (entry.name === "screenshots") continue;
		if (entry.name === "skybreak.rbxlx" || entry.name.endsWith(".lock")) continue;

		const isPlaceBuild = entry.name === "skybreak-tests.rbxlx" || entry.name === "test-game.rbxlx";
		if (isPlaceBuild && entryNames.has(`${entry.name}.lock`)) continue;

		const isDisposable =
			entry.name === "KestrelGeometry.txt" ||
			entry.name === "VantaGeometry.txt" ||
			entry.name === "skybreak-tests.rbxlx" ||
			entry.name === "test-game.rbxlx" ||
			entry.name.endsWith(".log") ||
			entry.name.endsWith(".tmp") ||
			entry.name.endsWith(".temp") ||
			entry.name.startsWith("jest-");
		if (isDisposable) await removePath(resolve(build, entry.name));
	}
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const screenshots = resolve(build, "screenshots");
try {
	const legacyQaArtifacts = new Set(["menu.jpg", "slots.jpg", "flight.jpg", "vanta.jpg", "temp.b64"]);
	const entries = (await safePath(screenshots)) ? await readdir(screenshots, { withFileTypes: true }) : [];
	for (const entry of entries) {
		if (entry.isFile() && legacyQaArtifacts.has(entry.name)) {
			await removePath(resolve(screenshots, entry.name));
		}
	}
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const action = dryRun ? "Would remove" : "Removed";
console.log(`${action} ${removed.length} artifact path(s), ${reclaimedBytes} byte(s).`);
for (const path of removed) console.log(`- ${path}`);
console.log("Preserved all lock files, locked place builds, build/skybreak.rbxlx, and unlisted screenshots.");
