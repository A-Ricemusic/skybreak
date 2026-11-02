// Small engine assembly contracts only. Full plan/cap coverage lives in M01–M18 WorldPlan specs
// (also executed offline). Never generate full terrain plans or launch complete world builds here.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@rbxts/jest-globals";
import { UploadedAssets } from "../shared/UploadedAssets";
import { UploadedAssetSpecs, type UploadedAssetName } from "../shared/UploadedAssetSpecs";
import { MILITARY_GROUND_ASSETS, MILITARY_GROUND_KIT } from "../shared/MilitaryGroundKit";
import { assertWorldInstanceBudget, worldInstanceCounts, GROUND_KIT_INSTANCE_ALLOWANCE } from "../server/WorldInstanceBudget";
import { adoptGroundTarget, createGroundTarget } from "../server/GroundTargetFactory";
import { buildM03TargetVisuals } from "../server/M03World";
import { M03, m03TargetLayout } from "../shared/M03WorldPlan";
import { M16_TARGETS } from "../shared/missions/m16";
import type { GroundTargetType } from "../shared/CampaignEncounters";

let parent: Folder;
let loads = 0, suiteStarted = 0;
const active: thread[] = [];
const SUITE_LIMIT = 90; // Leave headroom below the requested 120-second whole-file budget.
const ids: Partial<Record<UploadedAssetName, number>> = {};
const names = new Map<number, UploadedAssetName>();
for (let i = 0; i < MILITARY_GROUND_ASSETS.size(); i++) {
 const name = MILITARY_GROUND_ASSETS[i];
 ids[name] = 900001 + i; names.set(900001 + i, name);
}
function stopWork(): void {
 for (const worker of active) if (coroutine.status(worker) === "suspended") task.cancel(worker);
 active.clear();
}
// Complete synchronously or cancel at the FIRST yield, before Jest can move to the next test.
// A future accidental async loader/build cannot leave task.wait resumptions or child builds running.
function synchronous(body: () => void): void {
 const worker = coroutine.create(body);
 active.push(worker);
 const [ok, err] = coroutine.resume(worker);
 if (coroutine.status(worker) !== "dead") {
  stopWork();
  error("WorldInstanceBudget fixture unexpectedly yielded; work cancelled");
 }
 if (!ok) error(tostring(err));
}
function budgetTest(name: string, body: () => void): void {
 it(name, () => {
  assert(os.clock() - suiteStarted < SUITE_LIMIT, "WorldInstanceBudget exceeded its whole-file budget");
  synchronous(body);
 }, 5000);
}
function configureFixtures(attachments = 1): void {
 UploadedAssets.Configure({ ids, probe: () => true, loader: (id) => {
  loads++;
  const name = names.get(id)!;
  const container = new Instance("Model");
  for (let i = 0; i < 2; i++) {
   const mesh = new Instance("MeshPart");
   mesh.Size = UploadedAssetSpecs[name].authoredSize; mesh.Parent = container;
   new Instance("SurfaceAppearance").Parent = mesh;
   for (let j = 0; j < attachments; j++) new Instance("Attachment").Parent = mesh;
  }
  return container;
 } });
 // Template loads directly through the synchronous fake loader. Preload spawns threads even
 // for fake IDs; avoiding it makes fixture completion and cleanup independent of scheduler timing.
 for (const name of MILITARY_GROUND_ASSETS) expect(UploadedAssets.Template([name])).toBeDefined();
}
function proxy(targetType: GroundTargetType, id: string): Model {
 const model = new Instance("Model"); model.Parent = parent;
 for (let i = 0; i < 2; i++) {
  const part = new Instance("Part"); part.Size = new Vector3(40, 24, 56); part.Anchored = true; part.Parent = model;
 }
 return adoptGroundTarget(model, id, targetType);
}
beforeAll(() => {
 suiteStarted = os.clock();
}, 5000);
beforeEach(() => {
 parent = new Instance("Folder"); loads = 0;
 synchronous(() => configureFixtures());
}, 5000);
afterEach(() => { stopWork(); parent?.Destroy(); UploadedAssets.Configure(); });
afterAll(() => {
 stopWork(); parent?.Destroy(); UploadedAssets.Configure();
 expect(os.clock() - suiteStarted).toBeLessThan(SUITE_LIMIT);
});

describe("world instance budgets with bounded uploaded military fixtures", () => {
 budgetTest("accounts for every military target type separately from its original proxies", () => {
  let expectedModels = 0;
  for (const [targetType] of pairs(MILITARY_GROUND_KIT)) {
   const model = proxy(targetType as GroundTargetType, `budget-${targetType}`);
   expect(model.GetAttribute("UploadedAsset")).toBe(MILITARY_GROUND_KIT[targetType as GroundTargetType]);
   expectedModels++;
  }
  const counts = worldInstanceCounts(parent);
  expect(counts.models).toBe(expectedModels);
  expect(counts.kit).toBe(expectedModels * 7);
  expect(counts.base).toBe(expectedModels * 4); // owner, two original proxies, stationary aim
  assertWorldInstanceBudget(parent, counts.base);
  expect(parent.GetAttribute("WorldKitInstances")).toBe(counts.kit);
  expect(counts.base + counts.kit).toBe(parent.GetDescendants().size());
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
 });
 budgetTest("accounts for the complete M16 ground roster without generating its terrain surface", () => {
  for (const target of M16_TARGETS) proxy(target.type, target.id);
  const counts = worldInstanceCounts(parent);
  expect(M16_TARGETS.size()).toBe(138);
  expect(counts.models).toBe(M16_TARGETS.filter(t => MILITARY_GROUND_KIT[t.type] !== undefined).size());
  expect(counts.base).toBe(M16_TARGETS.size() * 4);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.base + counts.kit).toBe(parent.GetDescendants().size());
 });
 budgetTest("avoids M03 military mesh replication while preserving every target and aim", () => {
  const targets = m03TargetLayout(); // Fourteen supports only, no mountain shell/dressing plan.
  const visuals = buildM03TargetVisuals(parent, targets);
  expect(visuals.size()).toBe(14);
  const counts = worldInstanceCounts(parent);
  expect(counts.models).toBe(0); expect(counts.kit).toBe(0);
  expect(parent.GetDescendants().size()).toBeLessThanOrEqual(M03.budget.descendants);
  for (const target of targets) {
   const model = visuals.get(target.id)!;
   expect(model.GetAttribute("TargetId")).toBe(target.id);
   expect(model.PrimaryPart?.Name).toBe("Aim");
   expect(model.PrimaryPart?.CanQuery).toBe(false);
   expect(model.GetDescendants().some(child => child.IsA("MeshPart"))).toBe(false);
  }
 });
 budgetTest("keeps the original hard cap and reserve for non-kit descendants", () => {
  new Instance("Part").Parent = parent;
  expect(() => assertWorldInstanceBudget(parent, 0)).toThrow();
  expect(() => assertWorldInstanceBudget(parent, 1, 1)).toThrow();
  assertWorldInstanceBudget(parent, 2, 1);
 });
 budgetTest("reuses one template load per kit ID across all placements", () => {
  proxy("tank", "reuse-a"); proxy("tank", "reuse-b");
  expect(loads).toBe(MILITARY_GROUND_ASSETS.size());
 });
 budgetTest("cancels an unexpected yield before its continuation can run", () => {
  let suspended: thread | undefined;
  let continued = false;
  const [ok] = pcall(() => synchronous(() => {
   suspended = coroutine.running();
   task.wait(60);
   continued = true;
  }));
  expect(ok).toBe(false);
  expect(suspended).toBeDefined();
  expect(coroutine.status(suspended!)).toBe("dead");
  expect(continued).toBe(false);
 });
 budgetTest("rejects oversized decorations before hiding the collision proxy", () => {
  configureFixtures(24);
  const model = createGroundTarget({ id: "budget-tank", type: "tank", position: { x: 0, y: 0, z: 0 }, yaw: 0, required: true, scoreRole: "primary" });
  model.Parent = parent;
  expect(model.GetAttribute("UploadedAsset")).toBeUndefined();
  expect(worldInstanceCounts(model).kit).toBe(0);
  expect(model.GetDescendants().some(child => child.IsA("BasePart") && child.Transparency === 0)).toBe(true);
 });
});
