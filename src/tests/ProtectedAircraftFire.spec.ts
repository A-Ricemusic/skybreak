import { describe, expect, it } from "@rbxts/jest-globals";
import { ThreatRules } from "../shared/ThreatRules";

// CombatService passes true only when protectedTarget selected an actual protected aircraft,
// never merely because combatTarget is an ordinary armed wingman such as LANTERN.
describe("Protected aircraft enemy fire overrides", () => {
 const gate = { separation: 900, aimDot: 0.9, fireTimer: 0, globalReady: true,
  evading: false, playerStraight: false, minRange: 450, maxRange: 1700,
  aimThreshold: 0.65, straightRelax: 0.2 };
 it("holds fire at an ordinary wingman or player throughout the player's evade window", () => {
  expect(ThreatRules.MayFire({ ...gate, evading: true }, false)).toBe(false);
  expect(ThreatRules.MayFire({ ...gate, evading: true, playerStraight: true }, false)).toBe(false);
  expect(ThreatRules.MayFire({ ...gate, evading: true })).toBe(false);
 });
 it("keeps the exact old aim threshold at ordinary wingmen and the player", () => {
  expect(ThreatRules.MayFire({ ...gate, aimDot: 0.5 }, false)).toBe(false);
  expect(ThreatRules.MayFire({ ...gate, aimDot: 0.65 }, false)).toBe(false);
  expect(ThreatRules.MayFire({ ...gate, aimDot: 0.651 }, false)).toBe(true);
  expect(ThreatRules.MayFire({ ...gate, aimDot: 0.5, playerStraight: true }, false)).toBe(true);
  expect(ThreatRules.MayFire({ ...gate, aimDot: gate.aimThreshold - gate.straightRelax, playerStraight: true }, false)).toBe(false);
 });
 it("lets protected-aircraft attackers fire through player evasion and turning with relaxed aim", () => {
  expect(ThreatRules.MayFire({ ...gate, evading: true }, true)).toBe(true);
  expect(ThreatRules.MayFire({ ...gate, aimDot: 0.5 }, true)).toBe(true);
  expect(ThreatRules.MayFire({ ...gate, aimDot: 0.5, evading: true }, true)).toBe(true);
  expect(ThreatRules.MayFire({ ...gate, aimDot: gate.aimThreshold - gate.straightRelax }, true)).toBe(false);
 });
 it("still enforces reload, global readiness and range for protected-aircraft attackers", () => {
  expect(ThreatRules.MayFire({ ...gate, fireTimer: 0.1 }, true)).toBe(false);
  expect(ThreatRules.MayFire({ ...gate, globalReady: false }, true)).toBe(false);
  expect(ThreatRules.MayFire({ ...gate, separation: gate.minRange }, true)).toBe(false);
  expect(ThreatRules.MayFire({ ...gate, separation: gate.maxRange }, true)).toBe(false);
 });
});
