// Source contracts complement pure Luau behavior tests; no DOM/React harness or Studio.
import { strict as assert } from "node:assert";
// Source contracts ignore line wrapping introduced by Prettier.
// RESULTS_WIRING_MUTANT is set only by the mutation regression at the bottom of this file:
// it deletes one anchor from one source so the contract below must fail.
const mutantSpec = process.env.RESULTS_WIRING_MUTANT;
const mutant = mutantSpec === undefined ? undefined : (JSON.parse(mutantSpec) as [path: string, remove: string]);
const read = async (path: string) => {
	const text = (await Bun.file(path).text()).replace(/\s+/g, " ").replace(/\(\s+/g, "(");
	if (mutant?.[0] !== path) return text;
	assert(text.includes(mutant[1]), `Mutation anchor not found in ${path}: ${mutant[1]}`);
	return text.replaceAll(mutant[1], "");
};
/** Text from `start` up to `end`; both anchors must exist and appear in that order. */
function between(source: string, start: string, end: string): string {
	const from = source.indexOf(start);
	const to = source.indexOf(end);
	assert(from >= 0, `Missing slice start: ${start}`);
	assert(to > from, `Missing or misplaced slice end: ${end}`);
	return source.slice(from, to);
}
/** Both operations exist in `source`, and `first` comes before `second`. */
function assertBefore(source: string, first: string, second: string): void {
	const a = source.indexOf(first);
	const b = source.indexOf(second);
	assert(a >= 0, `Missing ordered operation: ${first}`);
	assert(b >= 0, `Missing ordered operation: ${second}`);
	assert(a < b, `${first} must precede ${second}`);
}
const [ui, outcome, primitives, service, combat] = await Promise.all([
	read("src/client/GameUI.tsx"),
	read("src/client/screens/OutcomeScreen.tsx"),
	read("src/client/screens/Primitives.tsx"),
	read("src/server/CampaignService.ts"),
	read("src/server/CombatService.ts"),
]);
const handler = between(ui, "const nextMission =", "// Stable handlers");
assert(
	handler.includes(
		"activateResultNext(outcomeWonRef.current, outcomeMissionRef.current, (id) => startWithChapter(id, true))",
	),
);
assert(!handler.includes("canLaunchMission"));
assert(ui.includes("onNext={nextMission}"));
const chapterStart = between(ui, "const startWithChapter =", "const startMission =");
assert(chapterStart.includes("launchWithChapter(missionId"));
assert(!chapterStart.includes("canLaunchMission"));
assert(chapterStart.includes("launchMission(missionId, fromResult, playedChapter)"));
assert(ui.includes("continueStory();"));
assert(service.includes("acknowledgeChapter(slot, missionId, playedChapter)"));
assert(!service.includes("recordCutsceneSeen("));
const cinematic = await read("src/client/RelayCinematic.tsx");
assert(cinematic.includes('action === "skip"'));
assert(cinematic.includes("finishRef.current();"));
assert(ui.includes("restartMission(outcomeMissionRef.current)"));
assert(outcome.includes("onPrimary={onNext}"));
assert(outcome.includes("nextResultMission(outcome.won, outcome.missionId) !== undefined"));
assert(outcome.includes('campaignComplete ? "CAMPAIGN COMPLETE"'));
assert(outcome.includes('busy ? "PREPARING SORTIE..."'));
assert(primitives.includes("if (enabled) onActivated()"));
assert(primitives.includes("Activated: () =>"));
assert(primitives.includes("onActivated={onPrimary}"));
const launch = between(ui, "const launchMission =", "const startMission =");
assertBefore(launch, "changeScreen(launchLoading.Screen())", 'invoke("StartMission"');
assert(launch.includes("missionId, playedChapter, special:"));
assert(launch.match(/changeScreen\(fromResult === true \? "outcome" : launchLoading.Screen\(\)\)/g)?.length === 2);
assert(launch.includes('showToast(problem ?? "Command rejected the request.", true)'));
const start = between(service, "function startMission(", "function deleteSlot(");
assertBefore(start, "awaitResultSettlement(", "resolveMissionRequest(");
assertBefore(start, "awaitResultSettlement(", "GetSession(");
assert(start.includes("IsCompleting(state.player)"));
assert(combat.includes("return completing.has(player)"));
if (mutant) process.exit(0);

// Mutation regressions: re-run this contract with one ordered operation or slice anchor
// deleted. Every mutant must fail, so ordering checks cannot silently go back to
// comparing a missing operand's -1 position.
const MUTATIONS: Array<[path: string, remove: string]> = [
	["src/client/GameUI.tsx", "changeScreen(launchLoading.Screen());"],
	["src/client/GameUI.tsx", 'invoke("StartMission"'],
	["src/client/GameUI.tsx", "const nextMission ="],
	["src/client/GameUI.tsx", "// Stable handlers"],
	["src/client/GameUI.tsx", "const startWithChapter ="],
	["src/client/GameUI.tsx", "const launchMission ="],
	["src/client/GameUI.tsx", "const startMission ="],
	["src/server/CampaignService.ts", "awaitResultSettlement("],
	["src/server/CampaignService.ts", "resolveMissionRequest("],
	["src/server/CampaignService.ts", "GetSession("],
	["src/server/CampaignService.ts", "function startMission("],
	["src/server/CampaignService.ts", "function deleteSlot("],
];
for (const [path, remove] of MUTATIONS) {
	const proc = Bun.spawnSync(["bun", import.meta.path], {
		env: { ...process.env, RESULTS_WIRING_MUTANT: JSON.stringify([path, remove]) },
		stdout: "pipe",
		stderr: "pipe",
	});
	const output = proc.stdout.toString() + proc.stderr.toString();
	// Only an assertion from the contract counts; a missing anchor means the mutation is stale.
	if (proc.exitCode === 0 || output.includes("Mutation anchor not found") || !output.includes("AssertionError"))
		throw new Error(`Results-wiring mutant was not rejected (${path} without ${remove}):\n${output}`);
}
console.log(`RESULTS_WIRING_MUTATIONS passed=${MUTATIONS.length} failed=0`);
console.log("RESULTS_WIRING passed=1 failed=0; source contracts only, input devices not exercised");
