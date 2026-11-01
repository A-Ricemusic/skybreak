import { NAVAL_ASSETS } from "../shared/NavalKit";
// Instance assembly regressions; compiled offline, executed only by the Studio Jest runner.
import { afterEach, beforeEach, describe, expect, it, jest } from "@rbxts/jest-globals";
import { UploadedAssets } from "../shared/UploadedAssets";
import { RobloxAssetIds } from "../shared/RobloxAssetIds";
import { MILITARY_GROUND_ASSETS } from "../shared/MilitaryGroundKit";
import type { UploadedAssetName } from "../shared/UploadedAssetSpecs";
import { TerrainWriter } from "../server/TerrainWriter";
import { WorldEnvironment } from "../server/WorldEnvironment";
import { assertWorldInstanceBudget, worldInstanceCounts, GROUND_KIT_INSTANCE_ALLOWANCE } from "../server/WorldInstanceBudget";
import { createGroundTarget } from "../server/GroundTargetFactory";
import { buildM03Plan, m03Counts } from "../shared/M03WorldPlan";
import { M01World } from "../server/M01World";
import { M01 } from "../shared/M01WorldPlan";
import { M02World } from "../server/M02World";
import { M02 } from "../shared/M02WorldPlan";
import { M03World } from "../server/M03World";
import { M03 } from "../shared/M03WorldPlan";
import { M04World } from "../server/M04World";
import { M04_BUILD_LIMITS } from "../shared/M04Limits";
import { M05World } from "../server/M05World";
import { M05_BUILD_LIMITS } from "../shared/M05Limits";
import { M06World } from "../server/M06World";
import { M06_BUILD_LIMITS } from "../shared/M06Limits";
import { M07World } from "../server/M07World";
import { M07_BUILD_LIMITS } from "../shared/M07Limits";
import { M08World } from "../server/M08World";
import { M08_BUILD_LIMITS } from "../shared/M08Limits";
import { M09World } from "../server/M09World";
import { M09_BUILD_LIMITS } from "../shared/M09Limits";
import { M10World } from "../server/M10World";
import { M10_BUILD_LIMITS } from "../shared/M10Limits";
import { M11World } from "../server/M11World";
import { M11_BUILD_LIMITS } from "../shared/M11Limits";
import { M12World } from "../server/M12World";
import { M12_BUILD_LIMITS } from "../shared/M12Limits";
import { M13World } from "../server/M13World";
import { M13_BUILD_LIMITS } from "../shared/M13Limits";
import { M14World } from "../server/M14World";
import { M14_BUILD_LIMITS } from "../shared/M14Limits";
import { M15World } from "../server/M15World";
import { M15_BUILD_LIMITS } from "../shared/M15Limits";
import { M16World } from "../server/M16World";
import { M16_BUILD_LIMITS } from "../shared/M16Limits";
import { M17World } from "../server/M17World";
import { M17_BUILD_LIMITS } from "../shared/M17Limits";
import { M18World } from "../server/M18World";
import { M18_BUILD_LIMITS } from "../shared/M18Limits";

let parent: Folder;
let meshCount = 2, attachmentCount = 1;
beforeEach(() => {
 parent = new Instance("Folder");
 meshCount = 2; attachmentCount = 1;
 // No terrain writes, environment mutations or network requests in these assembly tests.
 jest.spyOn(TerrainWriter, "Write").mockImplementation(() => ({ jobs: 0, yields: 0, longest: 0, total: 0 }));
 jest.spyOn(WorldEnvironment, "ApplySpec").mockImplementation(() => undefined);
 const ids: Partial<Record<UploadedAssetName, number>> = {};
 for (const name of MILITARY_GROUND_ASSETS) ids[name] = RobloxAssetIds[name];
 for (const name of NAVAL_ASSETS) ids[name] = 1; // synthetic local loader, no network
 UploadedAssets.Configure({ ids, probe: () => true, loader: () => {
  const container = new Instance("Model");
  for (let i = 0; i < meshCount; i++) {
   const mesh = new Instance("MeshPart"); mesh.Size = new Vector3(8, 8, 8); mesh.Parent = container;
   new Instance("SurfaceAppearance").Parent = mesh;
   for (let j = 0; j < attachmentCount; j++) new Instance("Attachment").Parent = mesh;
  }
  return container;
 } });
});
afterEach(() => {
 jest.restoreAllMocks();
 UploadedAssets.Configure(); parent.Destroy();
});

describe("world caps with uploaded military model structure", () => {
 it("builds M01 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M01World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M01.budget.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());

 }, 120000);
 it("builds M02 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M02World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M02.budget.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("keeps M03 procedural even when military templates are already cached", () => {
  UploadedAssets.Preload(["MilitaryRadar", "MilitaryAa"], 30);
  M03World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M03.budget.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBe(0);
 }, 120000);
 it("builds M04 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M04World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M04_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());

 }, 120000);
 it("builds M05 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M05World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M05_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("builds M06 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M06World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M06_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("builds M07 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M07World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M07_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("builds M08 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M08World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M08_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());

 }, 120000);
 it("builds M09 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M09World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M09_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("builds M10 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M10World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M10_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("builds M11 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M11World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M11_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());

 }, 120000);
 it("builds M12 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M12World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M12_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("builds M13 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M13World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M13_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());

 }, 120000);
 it("builds M14 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M14World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M14_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());

 }, 120000);
 it("builds M15 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M15World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M15_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("builds M16 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M16World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M16_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("builds M17 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M17World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M17_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());
  expect(counts.models).toBeGreaterThan(0);
 }, 120000);
 it("builds M18 within its base cap with separately bounded mesh/appearance/attachment instances", () => {
  M18World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  // M04-M18 check their base composition before adoption; the kit itself is bounded at placement.
  expect(scene.GetAttribute("WorldBaseInstances") as number).toBeLessThanOrEqual(M18_BUILD_LIMITS.descendants);
  expect(counts.kit).toBe(counts.models * 7);
  expect(counts.kit <= counts.models * GROUND_KIT_INSTANCE_ALLOWANCE).toBe(true);
  expect(counts.base + counts.kit).toBe(scene.GetDescendants().size());

 }, 120000);
 it("avoids M03 military mesh replication while preserving every target and aim", () => {
  meshCount = 1; attachmentCount = 0;
  const built = M03World.Build(parent);
  const scene = parent.GetChildren().find(child => child.IsA("Folder"))!;
  const counts = worldInstanceCounts(scene);
  expect(counts.base).toBe(m03Counts(buildM03Plan()).descendants - 1);
  expect(counts.models).toBe(0);
  expect(counts.kit).toBe(0);
  expect(scene.GetDescendants().size()).toBeLessThanOrEqual(M03.budget.descendants);
  expect(() => assertWorldInstanceBudget(scene, M03.budget.descendants)).never.toThrow();
  expect(built.targetVisuals.size()).toBe(14);
  for (const [id, model] of built.targetVisuals) {
   expect(model.GetAttribute("TargetId")).toBe(id);
   expect(model.PrimaryPart?.Name).toBe("Aim");
   expect(model.PrimaryPart?.CanQuery).toBe(false);
   for (const child of model.GetDescendants()) if (child.IsA("MeshPart")) {
    expect(child.CanQuery).toBe(false); expect(child.CanCollide).toBe(false);
   }
  }
 });
 it("keeps the original hard cap for non-kit descendants", () => {
  new Instance("Part").Parent = parent;
  expect(() => assertWorldInstanceBudget(parent, 0)).toThrow();
 });
 it("rejects oversized decorations before hiding the collision proxy", () => {
  attachmentCount = 24;
  UploadedAssets.Preload(["MilitaryTank"], 30);
  const model = createGroundTarget({ id: "budget-tank", type: "tank", position: { x: 0, y: 0, z: 0 }, yaw: 0, required: true, scoreRole: "primary" });
  model.Parent = parent;
  expect(model.GetAttribute("UploadedAsset")).toBeUndefined();
  expect(worldInstanceCounts(model).kit).toBe(0);
  expect(model.GetDescendants().some(child => child.IsA("BasePart") && child.Transparency === 0)).toBe(true);
 });
});
