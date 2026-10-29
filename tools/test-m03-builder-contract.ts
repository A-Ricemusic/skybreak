// Static builder contract: run without Studio or Roblox service mocks.
import assert from "node:assert/strict";
import ts from "typescript";

const source = ts.createSourceFile("M03World.ts", await Bun.file(new URL("../src/server/M03World.ts", import.meta.url)).text(), ts.ScriptTarget.Latest, true);
let builds = 0;
function visit(node: ts.Node) {
 if (ts.isMethodDeclaration(node) && node.name.getText(source) === "Build") {
  builds++;
  let returns = 0;
  function check(n: ts.Node) {
   if (ts.isReturnStatement(n)) {
    returns++;
    assert(n.expression && ts.isObjectLiteralExpression(n.expression), "Build must return its explicit contract");
    const targets = n.expression.properties.find((p) => p.name?.getText(source) === "groundTargets");
    assert(targets && ts.isPropertyAssignment(targets) && ts.isArrayLiteralExpression(targets.initializer) && targets.initializer.elements.length === 0,
     "Scenery builder must return no gameplay targets; GroundTargetFactory owns them");
   }
   ts.forEachChild(n, check);
  }
  check(node);
  assert.equal(returns, 1);
  assert.match(node.getText(source), /placeM03Target\(scene, t\)/, "Target-id visuals must remain scenery");
 }
 ts.forEachChild(node, visit);
}
visit(source);
assert.equal(builds, 1);
console.log("M03_BUILDER_CONTRACT passed=1 failed=0 (static source contract)");
