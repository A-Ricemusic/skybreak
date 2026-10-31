// Source contracts complement pure Luau behavior tests; no DOM/React harness or Studio.
import { strict as assert } from "node:assert";
const read = (path: string) => Bun.file(path).text();
const [ui, outcome, primitives, service, combat] = await Promise.all([
  read("src/client/GameUI.tsx"), read("src/client/screens/OutcomeScreen.tsx"),
  read("src/client/screens/Primitives.tsx"), read("src/server/CampaignService.ts"),
  read("src/server/CombatService.ts"),
]);
const handler = ui.slice(ui.indexOf("const nextMission ="), ui.indexOf("// Stable handlers"));
assert(handler.includes("activateResultNext(outcomeWonRef.current, outcomeMissionRef.current, (id) => startWithChapter(id, true))"));
assert(!handler.includes("canLaunchMission"));
assert(ui.includes("onNext={nextMission}"));
const chapterStart = ui.slice(ui.indexOf("const startWithChapter ="), ui.indexOf("const startMission="));
assert(chapterStart.includes("launchWithChapter(missionId"));
assert(!chapterStart.includes("canLaunchMission"));
assert(chapterStart.includes("launchMission(missionId, fromResult, playedChapter)"));
assert(ui.includes('continueStory();'));
assert(service.includes('acknowledgeChapter(slot, missionId, playedChapter)'));
assert(!service.includes('recordCutsceneSeen('));
const cinematic = await read("src/client/RelayCinematic.tsx");
assert(cinematic.includes('action==="skip"'));
assert(cinematic.includes('finishRef.current();'));
assert(ui.includes("restartMission(outcomeMissionRef.current)"));
assert(outcome.includes("onPrimary={onNext}"));
assert(outcome.includes("nextResultMission(outcome.won, outcome.missionId) !== undefined"));
assert(outcome.includes('campaignComplete ? "CAMPAIGN COMPLETE"'));
assert(outcome.includes('busy ? "PREPARING SORTIE..."'));
assert(primitives.includes("if (enabled) onActivated()"));
assert(primitives.includes("Activated: () =>"));
assert(primitives.includes("onActivated={onPrimary}"));
const launch = ui.slice(ui.indexOf("const launchMission ="), ui.indexOf("const startMission="));
assert(launch.indexOf("changeScreen(launchLoading.Screen())") < launch.indexOf('invoke("StartMission"'));
assert(launch.includes("missionId, playedChapter, special:"));
assert(launch.match(/changeScreen\(fromResult \? "outcome" : launchLoading.Screen\(\)\)/g)?.length === 2);
assert(launch.includes('showToast(problem ?? "Command rejected the request.", true)'));
const start = service.slice(service.indexOf("function startMission("), service.indexOf("function deleteSlot("));
assert(start.indexOf("awaitResultSettlement(") < start.indexOf("resolveMissionRequest("));
assert(start.indexOf("awaitResultSettlement(") < start.indexOf("GetSession("));
assert(start.includes("IsCompleting(state.player)"));
assert(combat.includes("return completing.has(player)"));
console.log("RESULTS_WIRING passed=1 failed=0; source contracts only, input devices not exercised");
