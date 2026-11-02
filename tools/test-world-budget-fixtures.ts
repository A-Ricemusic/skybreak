// Source contract only: keep expensive world generation and detached work out of the budget fixture.
import assert from "node:assert/strict";
import ts from "typescript";
const text = await Bun.file(new URL("../src/tests/WorldInstanceBudget.spec.ts", import.meta.url)).text();
const source = ts.createSourceFile("WorldInstanceBudget.spec.ts", text, ts.ScriptTarget.Latest, true);
for (const node of source.statements) {
 if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
 if (/server\/M\d+World$/.test(node.moduleSpecifier.text)) {
  assert(node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings));
  assert.deepEqual(node.importClause.namedBindings.elements.map(e => e.name.text), ["buildM03TargetVisuals"]);
 }
}
assert.doesNotMatch(text, /\bbuildM\d+(?:Scene)?Plan\s*\(|\bM\d+World\.Build\s*\(|TerrainWriter|WorldBuildScheduler|WorldEnvironment|UploadedAssets\.Preload\s*\(|task\.(?:spawn|defer)\s*\(/);
assert.match(text, /UploadedAssets\.Template\(\[name\]\)/);
assert.match(text, /coroutine\.resume\(worker\)/);
assert.match(text, /task\.cancel\(worker\)/);
assert.match(text, /afterEach\(\(\) => \{ stopWork\(\); parent\?\.Destroy\(\); UploadedAssets\.Configure\(\); \}\)/);
assert.match(text, /SUITE_LIMIT = 90/);
assert.match(text, /expect\(coroutine\.status\(suspended!\)\)\.toBe\("dead"\)/);
console.log("WORLD_BUDGET_FIXTURES passed=1 failed=0; source contract only, Studio timing unverified");
