import { worldCounts } from "../shared/WorldCompositionCounts";
import { M03_TERRAIN_BUDGET } from "../shared/M03WorldPlan";
import { M04_TERRAIN_BUDGET } from "../shared/M04WorldPlan";
import { M05_TERRAIN_BUDGET } from "../shared/M05WorldPlan";
import { describe, expect, it } from "@rbxts/jest-globals";
import { buildM01Plan, m01Counts } from "../shared/M01WorldPlan";
import { buildM02Plan, m02Counts } from "../shared/M02WorldPlan";
import { buildM03Plan, m03Counts } from "../shared/M03WorldPlan";
import { buildM04Plan, m04Counts } from "../shared/M04WorldPlan";
import { buildM05Plan, m05Counts } from "../shared/M05WorldPlan";
import { buildM06Plan, m06Counts } from "../shared/M06WorldPlan";
import { buildM07Plan, m07Counts } from "../shared/M07WorldPlan";
import { buildM08Plan, m08Counts } from "../shared/M08WorldPlan";
import { buildM09Plan, m09Counts } from "../shared/M09WorldPlan";
import { buildM10Plan, m10Counts } from "../shared/M10WorldPlan";
import { buildM11Plan, m11Counts } from "../shared/M11WorldPlan";
import { buildM12Plan, m12Counts } from "../shared/M12WorldPlan";
import { buildM13Plan, m13Counts } from "../shared/M13WorldPlan";
import { buildM14Plan, m14Counts } from "../shared/M14WorldPlan";
import { buildM15Plan, m15Counts } from "../shared/M15WorldPlan";
import { buildM16Plan, m16Counts } from "../shared/M16WorldPlan";
import { buildM17Plan, m17Counts } from "../shared/M17WorldPlan";
import { buildM18Plan, m18Counts } from "../shared/M18WorldPlan";

/** Pure estimator gate, also run offline. Actual build timing lives in RelayWorld.spec. */
describe("Campaign loading estimates", () => {
 it("keeps runtime slices within calibration and charges calibrated yields", () => {
  for (const budget of [M03_TERRAIN_BUDGET, M04_TERRAIN_BUDGET, M05_TERRAIN_BUDGET]) expect(budget).toBeLessThanOrEqual(0.25);
  // 64 water touches = .0128 s work, one .65 s yield, plus 3 s fixed.
  const c = worldCounts({ops: [{shape: "block", material: "Water", x: 512, y: 16, z: 512, sx: 1024, sy: 32, sz: 1024, yaw: 0}], parts: [], props: []}, 0);
  expect(c.estimatedSeconds).toBeCloseTo(3.6628, 6);
 });
 it("keeps M01 within the 16-second modeled build budget", () => {
  const counts = m01Counts(buildM01Plan());
  print(`MISSION_LOAD_ESTIMATE mission=01 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M02 within the 16-second modeled build budget", () => {
  const counts = m02Counts(buildM02Plan());
  print(`MISSION_LOAD_ESTIMATE mission=02 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M03 within the 16-second modeled build budget", () => {
  const counts = m03Counts(buildM03Plan());
  print(`MISSION_LOAD_ESTIMATE mission=03 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M04 within the 16-second modeled build budget", () => {
  const counts = m04Counts(buildM04Plan());
  print(`MISSION_LOAD_ESTIMATE mission=04 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M05 within the 16-second modeled build budget", () => {
  const counts = m05Counts(buildM05Plan());
  print(`MISSION_LOAD_ESTIMATE mission=05 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M06 within the 16-second modeled build budget", () => {
  const counts = m06Counts(buildM06Plan());
  print(`MISSION_LOAD_ESTIMATE mission=06 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M07 within the 16-second modeled build budget", () => {
  const counts = m07Counts(buildM07Plan());
  print(`MISSION_LOAD_ESTIMATE mission=07 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M08 within the 16-second modeled build budget", () => {
  const counts = m08Counts(buildM08Plan());
  print(`MISSION_LOAD_ESTIMATE mission=08 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M09 within the 16-second modeled build budget", () => {
  const counts = m09Counts(buildM09Plan());
  print(`MISSION_LOAD_ESTIMATE mission=09 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M10 within the 16-second modeled build budget", () => {
  const counts = m10Counts(buildM10Plan());
  print(`MISSION_LOAD_ESTIMATE mission=10 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M11 within the 16-second modeled build budget", () => {
  const counts = m11Counts(buildM11Plan());
  print(`MISSION_LOAD_ESTIMATE mission=11 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M12 within the 16-second modeled build budget", () => {
  const counts = m12Counts(buildM12Plan());
  print(`MISSION_LOAD_ESTIMATE mission=12 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M13 within the 16-second modeled build budget", () => {
  const counts = m13Counts(buildM13Plan());
  print(`MISSION_LOAD_ESTIMATE mission=13 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M14 within the 16-second modeled build budget", () => {
  const counts = m14Counts(buildM14Plan());
  print(`MISSION_LOAD_ESTIMATE mission=14 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M15 within the 16-second modeled build budget", () => {
  const counts = m15Counts(buildM15Plan());
  print(`MISSION_LOAD_ESTIMATE mission=15 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M16 within the 16-second modeled build budget", () => {
  const counts = m16Counts(buildM16Plan());
  print(`MISSION_LOAD_ESTIMATE mission=16 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M17 within the 16-second modeled build budget", () => {
  const counts = m17Counts(buildM17Plan());
  print(`MISSION_LOAD_ESTIMATE mission=17 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
 it("keeps M18 within the 16-second modeled build budget", () => {
  const counts = m18Counts(buildM18Plan());
  print(`MISSION_LOAD_ESTIMATE mission=18 seconds=${counts.estimatedSeconds} jobs=${counts.jobs}`);
  expect(counts.estimatedSeconds).toBeLessThanOrEqual(16);
 });
});
