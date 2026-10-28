/** Offline-only export of literal AC04 adaptation scripts; never executes game code.
 * bun tools/ac04-voice-lines.ts [--check]
 * Deliberately fails on nonliteral content instead of silently omitting dialogue.
 */
import ts from "typescript";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = resolve(import.meta.dir, ".."), sourcePath = "src/shared/ac04/AC04Story.ts";
const source = await Bun.file(resolve(root, sourcePath)).text();
const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
const casting = await Bun.file(resolve(root, "assets/ac04-voice/casting.json")).json();
interface Line { id: string; kind: "story" | "radio" | "briefing" | "debriefing"; speaker: string; voice: string; tape: boolean; text: string; spoken: string }
const lines: Line[] = [], ids = new Set<string>();
const two = (n: number) => String(n).padStart(2, "0");
function literal(node: ts.Node | undefined): string {
 if (!node || !ts.isStringLiteral(node)) throw new Error("Expected a literal script string");
 return node.text;
}
function array(node: ts.Node | undefined): ts.NodeArray<ts.Expression> {
 if (!node || !ts.isArrayLiteralExpression(node)) throw new Error("Expected a literal script array");
 return node.elements;
}
function emit(id: string, kind: Line["kind"], text: string, speaker: string) {
 if (ids.has(id) || !text.trim()) throw new Error(`Duplicate/empty script: ${id}`);
 ids.add(id);
 let spoken = text;
 if (kind === "radio") {
  const match = /^([^:]+): (.+)$/.exec(text);
  if (!match) throw new Error(`Missing explicit radio speaker: ${id}`);
  speaker = match[1]; spoken = match[2];
 }
 const role = casting.speakers[speaker];
 if (!role) throw new Error(`No stock casting for ${speaker}`);
 lines.push({ id, kind, speaker, voice: role.voice, tape: false, text, spoken });
}
let chapters = 0, missions = 0;
function walk(node: ts.Node) {
 if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
  if (node.name.text === "AC04Story") {
   for (const entry of array(node.initializer)) {
    if (!ts.isCallExpression(entry) || entry.expression.getText(ast) !== "chapter") throw new Error("Unsupported chapter expression");
    const number = Number(entry.arguments[0].getText(ast)); chapters++;
    for (const [index, item] of entry.arguments.slice(5).entries()) {
     if (!ts.isCallExpression(item) || item.expression.getText(ast) !== "beat") throw new Error("Unsupported beat expression");
     emit(`ac04.story.i${two(number)}.b${two(index)}`, "story", literal(item.arguments[0]), "THE STORYTELLER");
    }
   }
  }
  if (node.name.text === "AC04MissionNarrative") {
   if (!node.initializer || !ts.isObjectLiteralExpression(node.initializer)) throw new Error("Expected mission object");
   for (const property of node.initializer.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isCallExpression(property.initializer)) throw new Error("Unsupported mission expression");
    const number = Number(property.name.getText(ast)), args = property.initializer.arguments, prefix = `ac04.radio.m${two(number)}`; missions++;
    emit(`ac04.briefing.m${two(number)}`, "briefing", literal(args[0]), "BRIEFING");
    emit(`ac04.debriefing.m${two(number)}`, "debriefing", literal(args[1]), "BRIEFING");
    for (const [arg, phase] of [[3, "primary"], [4, "update"]] as const) {
     if (args[arg]) for (const [index, item] of array(args[arg]).entries()) emit(`${prefix}.${phase}.${two(index)}`, "radio", literal(item), "");
    }
    if (args[5]) {
     if (!ts.isObjectLiteralExpression(args[5])) throw new Error("Expected event object");
     for (const event of args[5].properties) {
      if (!ts.isPropertyAssignment(event)) throw new Error("Unsupported event");
      const eventId = ts.isStringLiteral(event.name) ? event.name.text : event.name.getText(ast);
      for (const [index, item] of array(event.initializer).entries()) emit(`${prefix}.event.${eventId}.${two(index)}`, "radio", literal(item), "");
     }
    }
   }
  }
 }
 if (ts.isFunctionDeclaration(node) && node.name?.text === "mission") {
  const statuses = new Set<string>();
  function defaults(child: ts.Node) {
   if (ts.isPropertyAssignment(child) && ["complete", "failure"].includes(child.name.getText(ast))) {
    const tag = child.name.getText(ast); statuses.add(tag);
    for (const [index, item] of array(child.initializer).entries()) emit(`ac04.radio.${tag}.${two(index)}`, "radio", literal(item), "");
   }
   ts.forEachChild(child, defaults);
  }
  defaults(node);
  if (statuses.size !== 2) throw new Error("Outcome radio defaults missing");
 }
 ts.forEachChild(node, walk);
}
walk(ast);
if (chapters !== 12 || missions !== 18) throw new Error(`Unexpected content coverage ${chapters}/${missions}`);
const characters = lines.reduce((n, line) => n + line.spoken.length, 0);
const manifest = JSON.stringify({ generatedBy: "bun tools/ac04-voice-lines.ts", source: sourcePath, sourceSha256: createHash("sha256").update(source).digest("hex"), lines }, null, 1) + "\n";
const output = resolve(root, "assets/ac04-voice/lines.json");
if (process.argv.includes("--check")) {
 if (!await Bun.file(output).exists() || await Bun.file(output).text() !== manifest) throw new Error("AC04 voice manifest is stale; run bun tools/ac04-voice-lines.ts");
} else await Bun.write(output, manifest);
const speakers: Record<string, number> = {}, kinds: Record<string, number> = {};
for (const line of lines) { speakers[line.speaker] = (speakers[line.speaker] ?? 0) + 1; kinds[line.kind] = (kinds[line.kind] ?? 0) + 1; }
console.log(JSON.stringify({ lines: lines.length, spokenCharacters: characters, speakers, kinds }, null, 2));
