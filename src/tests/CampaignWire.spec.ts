import { describe, expect, it } from "@rbxts/jest-globals";
import { encodeCampaignSlot, normalizeMissionRecords } from "../shared/CampaignWire";
import type { SaveSlot } from "../shared/Types";

describe("campaign remote mission records", () => {
 it("round-trips practice and mission 1 using only string keys on the wire", () => {
  const slot: SaveSlot = { index: 1, occupied: true, completed: false, kills: 6,
   missions: { [0]: { completed: true, bestRank: "A" }, [1]: { completed: true, bestRank: "S" } } };
  const wire = encodeCampaignSlot(slot);
  const strings = wire.missions as { [id: string]: { bestRank?: string } };
  expect(strings["0"].bestRank).toBe("A");
  expect(strings["1"].bestRank).toBe("S");
  for (const [key] of pairs(wire.missions!)) expect(typeIs(key, "string")).toBe(true);
  const decoded = normalizeMissionRecords(wire.missions)!;
  expect(decoded[0].completed).toBe(true);
  expect(decoded[1].completed).toBe(true);
  expect(decoded[0].bestRank).toBe("A");
  expect(decoded[1].bestRank).toBe("S");
 });
 it("accepts old contiguous mission arrays without inventing practice", () => {
  const decoded = normalizeMissionRecords([{ completed: true, bestRank: "B" }, { completed: false }])!;
  expect(decoded[0]).toBeUndefined();
  expect(decoded[1].bestRank).toBe("B");
  expect(decoded[2].completed).toBe(false);
 });
});
