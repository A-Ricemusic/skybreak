import { describe, expect, it } from "@rbxts/jest-globals";
import { MILITARY_GROUND_ASSETS, MILITARY_GROUND_KIT } from "../shared/MilitaryGroundKit";
import { RobloxAssetIds } from "../shared/RobloxAssetIds";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { MissionCatalog } from "../shared/MissionCatalog";

describe("military ground kit contracts", () => {
 it("pins all ten approved upload IDs and bottom-centred world meshes", () => {
  expect(MILITARY_GROUND_ASSETS.size()).toBe(10);
  const approvedIds = {
   MilitaryAa: 101616884598832,
   MilitaryArtillery: 95847143971617,
   MilitaryBarracks: 132667525903898,
   MilitaryBunker: 99767408434768,
   MilitaryContainers: 135400126796799,
   MilitaryFuel: 96014055896534,
   MilitaryRadar: 124278667774667,
   MilitarySam: 73161839960138,
   MilitaryTank: 133660866420591,
   MilitaryTruck: 137019773488099,
  };
  for (const name of MILITARY_GROUND_ASSETS) {
   expect(RobloxAssetIds[name]).toBe(approvedIds[name]);
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
