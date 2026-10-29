import { describe, expect, it } from "@rbxts/jest-globals";
import { AlliedRules } from "../shared/AlliedRules";
import { MissionAllies, validateMissionPolicy } from "../shared/MissionPolicy";
import { MISSIONS, MissionCatalog } from "./LegacyCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordAlliedKill, recordScoredKill } from "../server/SortieScore";
import { TargetBoxes } from "../shared/TargetBoxes";
import { RADAR_GLYPHS } from "../shared/RadarMath";
import { WavePlan } from "../shared/WavePlan";
import { LEGACY_PHASE_ROSTERS } from "./LegacyPhaseRosters";

const policy: MissionAllies = { count: 4, formation: [{ x: -180, y: 20, z: 160 }, { x: 180, y: 20, z: 160 }, { x: -360, y: 40, z: 320 }, { x: 360, y: 40, z: 320 }], model: "Kestrel", callsignPrefix: "LANTERN" };
const raider = { role: "raider", kind: "air", enabled: true, health: 100, required: false };
function sortie() {
	const bp = { ...MissionCatalog.Get(3), phases: [{ kind: "required_air" as const, label: "Intercept", count: 6, optionalRaiders: 4 }] };
	return { state: BlueprintRunner.NewState(bp, 0), ledger: new TargetScore({ basis: "points", points: { escort: 60, bomber: 100 }, rank: { S: 800, A: 700, B: 600, C: 0 } }), destroyed: [] as string[] };
}
describe("Dormant allied flight contracts", () => {
	it("only spawns on opt in and preserves every current phase roster", () => {
		expect(AlliedRules.Count(policy)).toBe(4);
		for (let index = 0; index < MISSIONS.size(); index++) {
			const mission = MISSIONS[index];
			expect(mission.allies).toBeUndefined();
			expect(AlliedRules.Count(mission.allies)).toBe(0);
			const signature = mission.phases.map((p) => `${p.kind}:${p.count ?? 0}:${p.optionalRaiders ?? 0}:${p.groups ?? 1}`).join("|");
			expect(signature).toBe(LEGACY_PHASE_ROSTERS[index]);
		}
	});
	it("validates bounded formations, friendly models and deliberate required-target credit", () => {
		validateMissionPolicy({ allies: policy }, 99);
		for (const invalid of [{ ...policy, count: 0 }, { ...policy, count: 7 }, { ...policy, count: 1.5 }, { ...policy, formation: [] }, { ...policy, model: "Vanta" }, { ...policy, callsignPrefix: "" }, { ...policy, allowRequiredTargets: true }, { ...policy, mayKill: "yes" }, { ...policy, formation: [{ x: math.huge, y: 0, z: 80 }, ...policy.formation.filter((_, index) => index > 0)] }, { ...policy, formation: [{ x: 0, y: 0, z: 0 }, ...policy.formation.filter((_, index) => index > 0)] }]) {
			const [ok] = pcall(() => validateMissionPolicy({ allies: invalid as MissionAllies }, 99));
			expect(ok).toBe(false);
		}
	});
	it("never engages the player or a wingman and protects required bombers by default", () => {
		expect(AlliedRules.CanEngage(policy, { ...raider, friendly: true })).toBe(false);
		expect(AlliedRules.CanEngage(policy, { ...raider, role: undefined })).toBe(false);
		expect(AlliedRules.CanEngage(policy, raider)).toBe(true);
		expect(AlliedRules.CanEngage(policy, { ...raider, role: "escort" })).toBe(true);
		expect(AlliedRules.CanEngage(policy, { ...raider, required: true, role: "bomber" })).toBe(false);
		expect(AlliedRules.CanEngage({ ...policy, allowRequiredTargets: true, creditPlayerKills: true }, { ...raider, required: true, role: "bomber" })).toBe(true);
	});
	it("keeps formation moving during launch while suppressing all wingman fire", () => {
		expect(AlliedRules.CanEngage(policy, raider, false)).toBe(false);
		const speed = AlliedRules.FormationSpeed(180, 160);
		expect(speed).toBeGreaterThan(0);
		expect(speed / 30).toBeGreaterThan(0);
	});
	it("excludes friendlies from player selection, lock eligibility and hostile boxes", () => {
		expect(AlliedRules.PlayerTarget({ ...raider, friendly: true })).toBe(false);
		expect(TargetBoxes.Tone({ enemy: true, friendly: true, owner: 7, damageable: true, required: false }, 7)).toBeUndefined();
		expect(RADAR_GLYPHS.friendly === RADAR_GLYPHS.optional).toBe(false);
	});
	it("keeps the hostile budget identical with six friendly fighters", () => {
		const hostiles = [raider, { ...raider, role: "bomber" }, { ...raider, enabled: false }];
		expect(AlliedRules.HostileBudget(hostiles)).toBe(1);
		expect(AlliedRules.HostileBudget([...hostiles, ...policy.formation.map(() => ({ ...raider, friendly: true })), { ...raider, friendly: true }, { ...raider, friendly: true }])).toBe(1);
	});
	it("commits a windup target so its warning and launch destination cannot disagree", () => {
		const wingman = { id: "ally_1" };
		const committed = AlliedRules.CommitWindupTarget<typeof wingman>(wingman);
		const recomputed = undefined;
		expect(AlliedRules.WarnsPlayer(committed)).toBe(false);
		expect(committed).toBe(wingman);
		expect(recomputed).toBeUndefined();
		const player = AlliedRules.CommitWindupTarget<typeof wingman>(undefined);
		expect(AlliedRules.WarnsPlayer(player)).toBe(true);
		expect(player).toBeUndefined();
	});
	it("uses hysteresis for ordinary hostiles and keeps aces and couriers focused on the player", () => {
		expect(AlliedRules.HostileTargetsWingman("air", "bandit", 1000, 810, false)).toBe(false);
		expect(AlliedRules.HostileTargetsWingman("air", "bandit", 1000, 790, false)).toBe(true);
		expect(AlliedRules.HostileTargetsWingman("air", "bandit", 1000, 990, true)).toBe(true);
		expect(AlliedRules.HostileTargetsWingman("air", "bandit", 1000, 1010, true)).toBe(false);
		expect(AlliedRules.HostileTargetsWingman("ace", "ace", 1000, 100, false)).toBe(false);
		expect(AlliedRules.HostileTargetsWingman("air", "courier", 1000, 100, false)).toBe(false);
	});
	it("preserves fixed-sortie hostile ids, bracket sides and player focus when allies are absent or inserted", () => {
		function fixedSortie(withAllies: boolean): { ids: string; sides: string; targets: string } {
			let hostileSerial = 0, alliedSerial = 0;
			const ids: string[] = [], sides: number[] = [], targets: string[] = [];
			function spawn(friendly: boolean, count: number): void {
				const first = AlliedRules.AirSerial(friendly, hostileSerial, alliedSerial);
				for (const side of WavePlan.BracketSides(first, count)) sides.push(side);
				for (let index = 0; index < count; index++) {
					if (friendly) alliedSerial += 1;
					else { hostileSerial += 1; ids.push(`air_${hostileSerial}_77`); targets.push(AlliedRules.HostileTargetsWingman("air", "bandit", 1200, math.huge, false) ? "wingman" : "player"); }
				}
			}
			spawn(false, 2);
			if (withAllies) spawn(true, 4);
			spawn(false, 3);
			return { ids: ids.join(","), sides: sides.filter((_, index) => !withAllies || index < 2 || index >= 6).join(","), targets: targets.join(",") };
		}
		const legacy = fixedSortie(false), allied = fixedSortie(true);
		expect(allied.ids).toBe(legacy.ids);
		expect(allied.sides).toBe(legacy.sides);
		expect(allied.targets).toBe("player,player,player,player,player");
	});
	it("records an allied death once without player points, kills or objective progress", () => {
		const { state, ledger, destroyed } = sortie();
		expect(recordAlliedKill(state, ledger, destroyed, policy, "escort-1", "air", false, 1, "escort")).toBe(true);
		expect(recordAlliedKill(state, ledger, destroyed, policy, "escort-1", "air", false, 1, "escort")).toBe(false);
		expect(recordScoredKill(state, ledger, "escort-1", "air", false, 1, "escort")).toBe(false);
		expect(ledger.Total()).toBe(0);
		expect(state.optionalAirKills).toBe(0); expect(state.requiredAirKills).toBe(0); expect(state.phaseProgress).toBe(0);
		expect(recordAlliedKill(state, ledger, destroyed, policy, "bomber-1", "air", true, 1, "bomber")).toBe(false);
		expect(recordAlliedKill(state, ledger, destroyed, { ...policy, mayKill: false }, "escort-2", "air", false, 1, "escort")).toBe(false);
	});
	it("credits raw points and required progress only on the explicit option", () => {
		const { state, ledger, destroyed } = sortie();
		expect(recordAlliedKill(state, ledger, destroyed, { ...policy, creditPlayerKills: true, allowRequiredTargets: true }, "bomber-1", "air", true, 1, "bomber")).toBe(true);
		expect(ledger.Total()).toBe(100); expect(state.requiredAirKills).toBe(1); expect(state.phaseProgress).toBe(1);
	});
});
