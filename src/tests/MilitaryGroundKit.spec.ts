import { describe, expect, it } from "@rbxts/jest-globals";
import { MILITARY_GROUND_ASSETS, MILITARY_GROUND_KIT } from "../shared/MilitaryGroundKit";
import { RobloxAssetIds } from "../shared/RobloxAssetIds";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { MissionCatalog } from "../shared/MissionCatalog";

describe("military ground kit contracts", () => {
 it("keeps all ten kit assets dormant and bottom-centred world meshes", () => {
  expect(MILITARY_GROUND_ASSETS.size()).toBe(10);
  for (const name of MILITARY_GROUND_ASSETS) {
   expect(RobloxAssetIds[name]).toBeUndefined();
   expect(UploadedAssetSpecs[name].kind).toBe("world");
   expect(UploadedAssetSpecs[name].groundOffset).toBe(0);
  }
 });
 it("covers the M16 armour inventory without mapping specialist mission structures", () => {
  const counts: Partial<Record<string,number>> = {};
  for (const t of MissionCatalog.Get(16).phases[0].groundTargets!) {
   expect(MILITARY_GROUND_KIT[t.type]).toBeDefined();
   counts[t.type]=(counts[t.type] ?? 0)+1;
  }
  expect(counts).toEqual({tank:100,aa_gun:14,artillery:10,bunker:8,vehicle:6});
  expect(MILITARY_GROUND_KIT.core).toBeUndefined();
  expect(MILITARY_GROUND_KIT.railgun_emplacement).toBeUndefined();
 });
});
