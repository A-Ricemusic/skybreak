import { ac04ScheduleCapturedCompletion } from "../server/AC04Settlement";
import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04Persistence } from "../server/AC04Persistence";
import { AC04CompletionState, ac04CaptureCompletion } from "../server/AC04Completion";
import { AC04Profile, ac04BlankProfile, ac04Readable } from "../shared/AC04Progress";
import { MissionStats } from "../shared/Types";
import { Settlement } from "../shared/SessionGuard";

function fixture() {
 const records = new Map<number, unknown>();
 const states = new Map<number, AC04CompletionState>();
 let clock = 0, failGet = false, failWrite = false, writes = 0;
 let duringWrite: (() => void) | undefined;
 let duringWait: (() => void) | undefined;
 const warnings: string[] = [];
 const persistence = new AC04Persistence<number>({
  get(id) { if (failGet) error("load unavailable"); return records.get(id); },
  update(id, transform) {
   writes++;
   if (failWrite) error("write unavailable");
   const hook = duringWrite; duringWrite = undefined; hook?.();
   // Like UpdateAsync, do not commit if the transform throws.
   const result = transform(records.get(id)); records.set(id, result); return result;
  },
  present(id, state) { return states.get(id) === state; },
  now() { return clock; },
  wait(seconds) { clock += seconds; const hook = duringWait; duringWait = undefined; hook?.(); },
  warn(message) { warnings.push(message); },
 });
 function state(id: number): AC04CompletionState {
  const value: AC04CompletionState = { profile: ac04BlankProfile(), loaded: false, loading: false, saving: false, dirty: false, closing: false, persistence: "unavailable" };
  states.set(id, value); return value;
 }
 return { records, states, persistence, state, warnings, writes: () => writes,
  failGet: (value: boolean) => { failGet = value; }, failWrite: (value: boolean) => { failWrite = value; },
  duringWrite: (hook: () => void) => { duringWrite = hook; }, duringWait: (hook: () => void) => { duringWait = hook; },
 };
}
const result: MissionStats = { campaignId: "ac04", slot: 1, missionId: 1, score: 300, elapsed: 20, kills: 1 };
function finish(state: AC04CompletionState) { state.active = { slot: 1, mission: 1 }; return ac04CaptureCompletion(state, true, result, 10); }

describe("production AC04 persistence coordinator", () => {
 it("loads absence fresh but rejects existing malformed values without writing", () => {
  const f = fixture(), state = f.state(1);
  expect(f.persistence.load(1, state)).toBe(true);
  expect(ac04Readable(state.profile)).toBe(true);
  for (const malformed of [{}, {version: 1}, {version: 1, slots: false}, {version: 2, slots: []}]) {
   f.records.set(2, malformed); const other = f.state(2);
   expect(f.persistence.load(2, other)).toBe(false); expect(other.loaded).toBe(false);
   expect(f.persistence.save(2, other)).toBe(false); expect(f.records.get(2)).toBe(malformed);
  }
  expect(f.writes()).toBe(0);
 });
 it("retries load errors without a blank cloud fallback", () => {
  const f = fixture(), state = f.state(1); f.failGet(true);
  expect(f.persistence.load(1, state)).toBe(false); expect(state.loading).toBe(false);
  f.failGet(false); const stored = ac04BlankProfile(); stored.slots[0].seen.push("ac04-i01"); f.records.set(1, stored);
  expect(f.persistence.load(1, state)).toBe(true); expect(state.profile.slots[0].seen).toEqual(["ac04-i01"]);
 });
 it("does not install a load after player presence changed", () => {
  const f = fixture(), state = f.state(1); f.states.delete(1);
  expect(f.persistence.load(1, state)).toBe(false); expect(state.loaded).toBe(false);
 });
 it("aborts when current cloud value became malformed between Get and Update", () => {
  const f = fixture(), state = f.state(1); f.persistence.load(1, state); finish(state);
  const malformed = { version: 1, slots: [] }; f.records.set(1, malformed);
  expect(f.persistence.save(1, state)).toBe(false); expect(f.records.get(1)).toBe(malformed);
  expect(state.dirty).toBe(true); expect(state.saving).toBe(false);
  f.records.delete(1); expect(f.persistence.save(1, state)).toBe(true);
  expect((f.records.get(1) as AC04Profile).slots[0].missions[1].completed).toBe(true);
 });
 it("retains newer dirty changes while a snapshot write is in flight and drains them", () => {
  const f = fixture(), state = f.state(1); f.persistence.load(1, state);
  state.profile.slots[0].seen.push("ac04-i01"); state.dirty = true;
  f.duringWrite(() => {
   expect(state.saving).toBe(true); state.profile.slots[0].seen.push("ac04-i02"); state.dirty = true;
   expect(f.persistence.save(1, state)).toBe(false);
  });
  expect(f.persistence.save(1, state)).toBe(true); expect(state.dirty).toBe(true);
  expect((f.records.get(1) as AC04Profile).slots[0].seen).toEqual(["ac04-i01"]);
  state.closing = true; f.persistence.drain(1, state, 20);
  expect((f.records.get(1) as AC04Profile).slots[0].seen).toEqual(["ac04-i01", "ac04-i02"]);
  expect(state.dirty).toBe(false); expect(f.writes()).toBe(2);
 });
 it("captures a completion during an in-flight write and saves it on closing drain", () => {
  const f = fixture(), state = f.state(1); f.persistence.load(1, state); state.dirty = true;
  f.duringWrite(() => { expect(finish(state)).toBe(true); expect(f.persistence.save(1, state)).toBe(false); });
  f.persistence.save(1, state); state.closing = true; f.persistence.drain(1, state, 20);
  expect((f.records.get(1) as AC04Profile).slots[0].missions[1].bestScore).toBe(300);
  expect(ac04CaptureCompletion(state, true, result, 99)).toBeUndefined();
  expect(state.profile.slots[0].updatedAt).toBe(10);
 });
 it("waits for the in-flight writer before draining the latest shutdown state", () => {
  const f = fixture(), state = f.state(1); f.persistence.load(1, state); finish(state);
  state.closing = true; state.saving = true;
  f.duringWait(() => { state.saving = false; });
  f.persistence.drain(1, state, 20);
  expect(state.dirty).toBe(false); expect(f.writes()).toBe(1);
 });
 it("bounds shutdown retries and preserves dirty progress after failure", () => {
  const f = fixture(), state = f.state(1); f.persistence.load(1, state); finish(state); f.failWrite(true);
  state.closing = true; f.persistence.drain(1, state, 20);
  expect(f.writes()).toBe(3); expect(state.dirty).toBe(true); expect(f.warnings.size() > 0).toBe(true);
 });
 it("keeps cross-player cloud records and completions isolated", () => {
  const f = fixture(), a = f.state(1), b = f.state(2); f.persistence.load(1, a); f.persistence.load(2, b);
  finish(a); f.persistence.drain(1, a, 20);
  expect(b.profile.slots[0].missions[1]).toBeUndefined(); expect(f.records.get(2)).toBeUndefined();
  b.profile.slots[1].seen.push("ac04-i01"); b.dirty = true; f.persistence.drain(2, b, 20);
  expect((f.records.get(1) as AC04Profile).slots[1].seen.size()).toBe(0);
 });
 it("captures a win before deferred settlement and removal, exactly once", () => {
  const f = fixture(), state = f.state(1); f.persistence.load(1, state); state.active = {slot: 1, mission: 1};
  const settlement = Settlement.New(); let deferred: (() => void) | undefined; let releases = 0;
  const hooks = {
   announce: () => {},
   schedule: (complete: () => void) => ac04ScheduleCapturedCompletion(() => { ac04CaptureCompletion(state, true, result, 10); }, complete, (work) => { deferred = work; }),
   save: () => {}, unsaved: () => {}, teardown: () => {}, release: () => { releases++; }, warn: () => {},
  };
  Settlement.Begin(settlement, hooks);
  state.closing = true; f.persistence.drain(1, state, 20); f.states.delete(1);
  deferred!(); deferred!();
  expect((f.records.get(1) as AC04Profile).slots[0].missions[1].completed).toBe(true);
  expect(releases).toBe(1); expect(f.writes()).toBe(1);
 });
 it("retains a completion across an actually yielded DataStore update", () => {
  const state: AC04CompletionState = {profile: ac04BlankProfile(), loaded: true, loading: false, saving: false, dirty: true, closing: false, persistence: "cloud"};
  const gate = new Instance("BindableEvent"); let entered = false, done = false; let stored: unknown;
  const persistence = new AC04Persistence<number>({
   get() { return stored; },
   update(_id, transform) { entered = true; gate.Event.Wait(); stored = transform(stored); return stored; },
   present() { return true; }, now() { return os.clock(); }, wait(seconds) { task.wait(seconds); }, warn() {},
  });
  task.spawn(() => { persistence.save(1, state); done = true; });
  expect(entered).toBe(true); expect(state.saving).toBe(true);
  finish(state); state.closing = true; gate.Fire();
  const deadline = os.clock() + 2; while (!done && os.clock() < deadline) task.wait();
  expect(done).toBe(true); expect(state.dirty).toBe(true);
  gate.Destroy();
  // A non-yielding writer drains the later revision after the first snapshot returned.
  const drain = new AC04Persistence<number>({get() { return stored; }, update(_id, transform) {stored = transform(stored); return stored;}, present() { return true; }, now() { return os.clock(); }, wait(seconds) {task.wait(seconds);}, warn() {}});
  drain.drain(1, state, os.clock() + 2);
  expect((stored as AC04Profile).slots[0].missions[1].completed).toBe(true);
  expect(state.dirty).toBe(false);
 });

 it("holds settlement admission until a yielding save and result delivery finish", () => {
  const f = fixture(), state = f.state(1); f.persistence.load(1, state);
  const gate = new Instance("BindableEvent"), settlement = Settlement.New();
  const order: string[] = []; let writing = false;
  f.duringWrite(() => { writing = true; gate.Event.Wait(); });
  const hooks = {
   announce: () => {},
   schedule: (complete: () => void) => ac04ScheduleCapturedCompletion(() => { finish(state); order.push("captured"); }, complete, (work) => { task.defer(work); }),
   save: () => { expect(f.persistence.save(1, state)).toBe(true); order.push("saved", "reported"); },
   unsaved: () => { order.push("unsaved"); },
   teardown: () => { order.push("teardown"); },
   release: () => { order.push("released"); }, warn: () => {},
  };
  Settlement.Begin(settlement, hooks);
  const deadline = os.clock() + 2;
  while (!writing && os.clock() < deadline) task.wait();
  expect(writing).toBe(true); expect(settlement.entered).toBe(true);
  expect(settlement.settled).toBe(false); expect(order).toEqual(["captured"]);
  gate.Fire();
  while (!settlement.settled && os.clock() < deadline) task.wait();
  gate.Destroy();
  expect(settlement.settled).toBe(true);
  expect(order).toEqual(["captured", "saved", "reported", "teardown", "released"]);
 });

});
