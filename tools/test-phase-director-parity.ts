// Token-level extraction parity, not an engine simulation. The baseline was captured
// from main b17fb9ee10224579602c74679cbcdcc85488a74f before extracting PhaseDirector.
import ts from "typescript";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = resolve(import.meta.dir, "..");
function functions(source: string) {
	const result = new Map<string, string>();
	const file = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
	function visit(node: ts.Node) {
		if (ts.isFunctionDeclaration(node) && node.name && node.body) result.set(node.name.text, node.body.getText(file));
		ts.forEachChild(node, visit);
	}
	visit(file);
	return result;
}
function digest(source: string) {
	const file = ts.createSourceFile("body.ts", source, ts.ScriptTarget.Latest, true);
	const tokens: string[] = [];
	function visit(node: ts.Node) {
		const children = node.getChildren(file);
		if (children.length === 0) tokens.push(node.getText(file));
		else children.forEach(visit);
	}
	visit(file);
	return createHash("sha256").update(JSON.stringify(tokens)).digest("hex");
}
const baseline = await Bun.file(resolve(root, "tools/fixtures/phase-director.before.json")).json();
const combat = await Bun.file(resolve(root, "src/server/CombatService.ts")).text();
const director = await Bun.file(resolve(root, "src/server/PhaseDirector.ts")).text();
const current = new Map([...functions(combat), ...functions(director)]);
// Normalize only the three intentional substitutions inside moved functions.
for (const [name, body] of current) current.set(name, body
	.replaceAll("phaseDirector.Apply(", "applyPhase(")
	.replaceAll("phaseDirector.AceCall(", "aceCall(")
	.replaceAll("phaseDirector.TutorialHint(", "stepTutorialHint(")
	.replaceAll("isCurrent(session)", "sessions.get(session.player) === session")
	.replaceAll("fixedRaiders(session.blueprint)", "session.blueprint?.phases[0].execution?.fixedRaiders"));
// Restore the two extracted inline blocks in stepSession before comparison.
let step = current.get("stepSession")!;
const launch = functions(director).get("launchDue")!;
const midStep = functions(director).get("step")!;
step = step.replace("phaseDirector.LaunchDue(session);", launch.slice(1, -1))
	.replace("phaseDirector.Step(session);", midStep.slice(1, -1).replace("const bs = session.blueprintState!;", ""));
current.set("stepSession", step);
let passed = 0;
for (const [name, expected] of Object.entries(baseline.functions)) {
	if (digest(current.get(name) ?? "MISSING") !== expected) throw new Error(`Phase extraction parity failed: ${name}`);
	passed++;
}
// TGT's only intentional difference: teaching event/application are tutorial-only.
const cycle = functions(combat).get("cycleTarget")!;
if (!cycle.includes('BlueprintRunner.ActivePhase(session.blueprintState)?.kind === "tutorial_target"')) throw new Error("Missing TGT tutorial guard");
console.log(`PHASE_DIRECTOR_SOURCE_PARITY passed=${passed + 1} failed=0; token parity plus TGT guard, not Player verification`);
