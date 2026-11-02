import { describe, expect, it } from "@rbxts/jest-globals";
import { NAVAL_ASSETS, navalVisual } from "../shared/NavalKit";
import { RobloxAssetIds } from "../shared/RobloxAssetIds";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { m06TargetLayout } from "../shared/M06WorldPlan";
import { M06_TARGET_TYPES, m06MountParent } from "../shared/missions/m06";
import { M17_TARGETS } from "../shared/missions/m17";

describe("dormant naval kit", () => {
 it("keeps all exports unavailable until independent review and upload", () => {
  expect(NAVAL_ASSETS.size()).toBe(12);
  for (const name of NAVAL_ASSETS) {
   expect(RobloxAssetIds[name]).toBeUndefined();
   expect(UploadedAssetSpecs[name].kind).toBe("world");
   expect(UploadedAssetSpecs[name].groundOffset).toBe(0);
  }
 });
 it("covers every M06 hull and separate defence mount without changing ownership", () => {
  let hulls=0, mounts=0;
  for (const t of m06TargetLayout()) {
   if (t.y===32) { expect(navalVisual(M06_TARGET_TYPES[t.type], t.type,t.group)).toBeDefined(); hulls++; }
   if (t.group.find("_defence")[0] !== undefined) {
    expect(navalVisual(M06_TARGET_TYPES[t.type], t.type,t.group)).toBeDefined();
    const parent=m06MountParent(t)!;
    expect(t.x-parent.x).toBe(180); expect(t.z).toBe(parent.z); mounts++;
   }
  }
  expect(hulls).toBe(36);expect(mounts).toBe(18);
  expect(navalVisual("destroyer","frigate","west")).toBe("NavalFrigate");
 });
 it("covers M17 hulls and seven parent-owned guns without replacing land batteries", () => {
  let hulls=0, mounts=0;
  for(const t of M17_TARGETS) {
   if(t.naval) {expect(navalVisual(t.type)).toBeDefined();hulls++;}
   if(t.parentId !== undefined) {expect(navalVisual(t.type,undefined,"naval_mount")).toBe("NavalGun");mounts++;}
  }
  expect(hulls).toBe(4);expect(mounts).toBe(7);
  expect(navalVisual("sam", "sam", "west_yard")).toBeUndefined();
  expect(navalVisual("gun_mount")).toBeUndefined();
 });
});
