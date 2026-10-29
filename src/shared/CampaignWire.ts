import type { MissionRecord, SaveSlot, WireSaveSlot } from "./Types";
import { MISSION_COUNT } from "./MissionCatalog";

/** Never send a sparse numeric table across a remote (practice uses key 0). */
export function encodeCampaignSlot(slot: SaveSlot): WireSaveSlot {
 const missions: { [id: string]: MissionRecord } = {};
 for (let id = 0; id <= MISSION_COUNT; id++) {
  const record = slot.missions?.[id];
  if (record !== undefined) missions[tostring(id)] = record;
 }
 return { ...slot, missions };
}

/** Decode current string dictionaries and old contiguous numeric arrays alike. */
export function normalizeMissionRecords(source: WireSaveSlot["missions"]): SaveSlot["missions"] {
 if (!typeIs(source, "table")) return undefined;
 const strings = source as { [id: string]: MissionRecord };
 const numbers = source as { [id: number]: MissionRecord };
 const missions: { [id: number]: MissionRecord } = {};
 for (let id = 0; id <= MISSION_COUNT; id++) {
  const record = strings[tostring(id)] ?? numbers[id];
  if (typeIs(record, "table")) missions[id] = record;
 }
 return missions;
}
