// Opt in on the isolated Jest place only: Workspace attribute MilitaryKitDiagnostic = true.
// Read-only network diagnostic; no insertion into Workspace, uploads or credential access.
import { expect, it } from "@rbxts/jest-globals";
import { ContentProvider, InsertService, Workspace } from "@rbxts/services";
import { RobloxAssetIds } from "../shared/RobloxAssetIds";

function snapshot(container: Instance, phase: string): void {
 print(`[MilitaryKitDiagnostic] ${phase} ${container.ClassName} ${container.Name}`);
 if (container.IsA("Model")) {
  const [, size] = container.GetBoundingBox();
  print(`[MilitaryKitDiagnostic] bounds=${tostring(size)}`);
 }
 for (const item of container.GetDescendants()) {
  print(`[MilitaryKitDiagnostic] ${item.GetFullName()} class=${item.ClassName}`);
  if (!item.IsA("BasePart")) continue;
  print(`[MilitaryKitDiagnostic] Size=${tostring(item.Size)} CFrame=${tostring(item.CFrame)}`);
  if (!item.IsA("MeshPart")) continue;
  // Probe across engine versions/security contexts; missing/restricted fields are evidence too.
  for (const key of ["MeshId", "MeshContent", "MeshSize", "InitialSize", "HasMesh"]) {
   const [ok, value] = pcall(() => (item as unknown as Record<string, unknown>)[key]);
   print(`[MilitaryKitDiagnostic] ${key} ${ok ? "value" : "unavailable"}=${tostring(value)}`);
  }
 }
}

it("optionally inspects one real military upload before and after content preload (8s deadline)", () => {
 if (Workspace.GetAttribute("MilitaryKitDiagnostic") !== true) {
  print("[MilitaryKitDiagnostic] disabled; set Workspace.MilitaryKitDiagnostic=true in isolated Jest place to inspect real MilitaryTank");
  return;
 }
 let container: Model | undefined;
 let done = false;
 const started = os.clock();
 const worker = task.spawn(() => {
  const [ok, message] = pcall(() => {
   container = InsertService.LoadAsset(RobloxAssetIds.MilitaryTank!);
   snapshot(container, "LoadAsset returned");
   ContentProvider.PreloadAsync([container], (id, status) => print(`[MilitaryKitDiagnostic] fetch ${id} ${status.Name}`));
   snapshot(container, "PreloadAsync returned");
  });
  print(`[MilitaryKitDiagnostic] done=${ok} elapsed=${os.clock() - started} result=${tostring(message)}`);
  done = true;
 });
 while (!done && os.clock() - started < 8) task.wait();
 if (!done) {
  print("[MilitaryKitDiagnostic] deadline: engine load/preload still pending; no production readiness conclusion");
  if (container !== undefined) snapshot(container, "deadline");
  pcall(() => task.cancel(worker));
 }
 container?.Destroy();
 // Diagnostic reports evidence, not moderation/appearance acceptance.
 expect(os.clock() - started < 10).toBe(true);
}, 15000);
