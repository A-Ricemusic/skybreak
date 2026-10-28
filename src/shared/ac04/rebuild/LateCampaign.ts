import type { AC04Mission, AC04Phase, AC04UnitGroup } from "../../AC04MissionData";
import type { FlightPoint } from "../../WorldTypes";
import { LateM13U2Path, LateM14XB70Path, LateM15BomberPath, lateInRange } from "./LatePlacement";
import { LateEvidence } from "./LateSources";

/**
 * Late-campaign (M13-M18) mission refinement, composed once into
 * AC04MissionData's mission list after baseline manual tweaks.
 * Returns a new mission object; never mutates the input. Objective counts,
 * phase timers, S thresholds and mission identities are preserved. Points and
 * group splits change only where cited below; every adaptation stays labelled.
 */
export const LATE_REBUILD_MARK = "LATE-REBUILD-v1";

const path = (points: FlightPoint[]): FlightPoint[] => points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
const note = (g: AC04UnitGroup, text: string): string => (g.note !== undefined ? `${g.note} ` : "") + text;
function clone(m: AC04Mission): AC04Mission {
	return {
		...m,
		phases: m.phases.map((p): AC04Phase => ({ ...p, requiredGroupIds: [...p.requiredGroupIds] })),
		roster: m.roster.map((g): AC04UnitGroup => ({ ...g, path: g.path ? path(g.path) : undefined, afterKills: g.afterKills ? { groups: [...g.afterKills.groups], count: g.afterKills.count } : undefined })),
		gaps: [...m.gaps],
	};
}
function find(m: AC04Mission, id: string): AC04UnitGroup | undefined { return m.roster.find((g) => g.id === id); }
/** Replaces one roster entry by several, preserving roster order. */
function split(m: AC04Mission, id: string, parts: AC04UnitGroup[], expectedTotal?: number): void {
	const index = m.roster.findIndex((g) => g.id === id);
	if (index < 0) return;
	const total = parts.reduce((n, g) => n + g.count, 0);
	assert(total === (expectedTotal ?? m.roster[index].count), `late split must preserve ${id} count`);
	const out: AC04UnitGroup[] = [];
	for (let i = 0; i < m.roster.size(); i++) if (i === index) for (const g of parts) out.push(g); else out.push(m.roster[i]);
	m.roster = out;
}
function staged(base: AC04UnitGroup, id: string, count: number, site: string, extra: Partial<AC04UnitGroup> = {}): AC04UnitGroup {
	return { ...base, id, count, site, path: undefined, afterGroup: undefined, afterKills: undefined, triggerAt: undefined, triggerMode: undefined, ...extra };
}

function safeReturn(m: AC04Mission): void {
	const balloons = find(m, "balloons"), frigate = find(m, "frigate"), u2 = find(m, "u2");
	if (balloons) balloons.note = note(balloons, "Placement: Mitoro Ace detail map (157 jammers, 0-2200 m) transcribed and evenly decimated to the provisional 100; altitudes adapted 0.36 studs/m. Mitoro reports jammers respawn under unknown conditions; not implemented.");
	if (frigate) frigate.note = "Wiki: hidden frigate on the eastern river, counted with jammers in the debriefing. Mitoro (Ace) calls it a destroyer, unlockable, off radar, with its 100 points excluded from the final total; this build scores it normally (divergence recorded).";
	if (u2) { u2.path = path(LateM13U2Path); u2.note = "U-2 enters from the north (Shotgunnova Normal) and follows the authored low ravine route to the south line; route geometry adapted."; }
	for (const id of ["f15e", "ef2000"]) {
		const g = find(m, id);
		if (g) { g.site = "recon-escort"; g.note = "Inbound toward the eastern canyon (Shotgunnova); Mitoro spawns them just north of the player's position, which this pure placement cannot follow."; }
	}
}
function breakingArrows(m: AC04Mission): void {
	const w2 = find(m, "missile-2"), final = find(m, "missile-final"), f22 = find(m, "f22"), xb70 = find(m, "xb70");
	if (w2) {
		w2.afterGroup = undefined;
		w2.afterKills = { groups: ["missile-1"], count: 3 };
		w2.provisional = true;
		w2.note = "Wiki: wave 2 appears after SOME wave-1 kills. Three of five is an explicit adaptation (previously full clearance); the exact Normal threshold is unknown.";
	}
	if (final) {
		final.afterKills = { groups: ["missile-1", "missile-2"], count: 15 };
		final.note = "Spawns only after all fifteen earlier missiles are destroyed (wiki). Evasive weave along the glacier's eastern edge uses the integrated LateRuntime steer; amplitudes/periods are adaptations.";
	}
	if (f22) {
		f22.afterGroup = "missile-2"; f22.afterKills = { groups: ["missile-1", "missile-2"], count: 15 };
		f22.triggerAt = 20; f22.triggerMode = "both"; f22.provisional = true;
		f22.note = "Two F-22 escorts near the final missile (wiki); Mitoro (Ace) delays them until the missile reaches a waypoint. The 20 s delay after wave-2 clearance is an adaptation.";
	}
	if (xb70) {
		xb70.path = path(LateM14XB70Path);
		xb70.note = "POINTS CONFLICT LABEL: wiki table 120 vs wiki prose 200. 200 is kept: Shotgunnova Normal and Mitoro tables say 200, and the Normal S rank 2020 equals 1500+200+120+200, unreachable with 120. Fixed northern west-to-east line (Mitoro); its flight north after wave 2 is not implemented.";
	}
}
function emancipation(m: AC04Mission): void {
	const ef = find(m, "ef2000"), su = find(m, "su35"), a10 = find(m, "a10");
	const respawn = "Mitoro (Ace) reports fighters respawning per cluster; Normal totals (wiki 15 EF-2000, 5 Su-35, 5 A-10) are preserved as initial groups plus clearance+30 s replacements. Split sizes and delays are adaptations.";
	if (ef) split(m, "ef2000", [
		staged(ef, "ef-gov", 2, "gov-air", { note: respawn }), staged(ef, "ef-gov-r1", 2, "gov-air", { afterGroup: "ef-gov", triggerAt: 30, triggerMode: "both", provisional: true }),
		staged(ef, "ef-gov-r2", 2, "gov-air", { afterGroup: "ef-gov-r1", triggerAt: 30, triggerMode: "both", provisional: true }),
		staged(ef, "ef-airport", 3, "airport-air", { note: respawn }), staged(ef, "ef-airport-r1", 3, "airport-air", { afterGroup: "ef-airport", triggerAt: 30, triggerMode: "both", provisional: true }),
		staged(ef, "ef-airport-r2", 3, "airport-air", { afterGroup: "ef-airport-r1", triggerAt: 30, triggerMode: "both", provisional: true }),
	]);
	if (su) split(m, "su35", [
		staged(su, "su35-airport", 2, "airport-air", { note: respawn }), staged(su, "su35-airport-r1", 2, "airport-air", { afterGroup: "su35-airport", triggerAt: 30, triggerMode: "both", provisional: true }),
		staged(su, "su35-old", 1, "old-air"),
	]);
	if (a10) split(m, "a10", [
		staged(a10, "a10-old", 2, "old-air", { note: respawn }), staged(a10, "a10-old-r1", 3, "old-air", { afterGroup: "a10-old", triggerAt: 30, triggerMode: "both", provisional: true }),
	]);
	const tu = find(m, "tu160"), ka = find(m, "ka50"), launchers = find(m, "launchers"), c17 = find(m, "c17"), yellow = find(m, "yellow");
	if (tu) { tu.path = path(LateM15BomberPath); tu.note = "Pairs from the west border's middle at ~7500 ft on a west-to-east plan over New City, the airport and Old Towne (Shotgunnova). Runtime retains spawn-relative offsets from an immutable authored formation anchor."; }
	if (ka) ka.note = "Hover between New City high-rises (Shotgunnova). Mitoro's Ace table lists Ka-50 at 80 points (4 units); Normal count/points unverified, 6 x 40 retained provisionally.";
	if (launchers) { launchers.site = "launchers-west"; launchers.note = "Two on the west coast SW of New City, two NE toward the airport (wiki + Shotgunnova); 2/2 split adapted."; }
	if (c17) c17.note = "Seven parked C-17 at 100 on the San Profetta apron (wiki S-rank section).";
	if (yellow) yellow.note = note(yellow, "Starts north-east of the triangle (Mitoro map).");
}
function whiskey(m: AC04Mission): void {
	const tanks = find(m, "tanks");
	const reveal = "Mitoro (Ace): annihilating one group reveals a nearby group; sector split follows Shotgunnova Normal point budgets. Per-sector counts are adaptations; the 74-tank total is the wiki value.";
	if (tanks) split(m, "tanks", [
		staged(tanks, "tanks-west", 8, "west-line", { note: reveal, provisional: true }), staged(tanks, "tanks-west-r", 4, "west-line", { afterGroup: "tanks-west", provisional: true }),
		staged(tanks, "tanks-center", 16, "defense-lines", { note: reveal, provisional: true }), staged(tanks, "tanks-center-r", 8, "defense-lines", { afterGroup: "tanks-center", provisional: true }),
		staged(tanks, "tanks-anchor", 12, "old-anchor", { note: reveal, provisional: true }), staged(tanks, "tanks-anchor-r", 6, "old-anchor", { afterGroup: "tanks-anchor", provisional: true }),
		staged(tanks, "tanks-north", 20, "headquarters", { provisional: true }),
	]);
	const tornado = find(m, "tornado");
	if (tornado) split(m, "tornado", [
		staged(tornado, "tornado", 2, "west-line", { provisional: true, note: "Mitoro (Ace): two Tornados at the defensive position, two more after they fall; Normal total 7 retained." }),
		staged(tornado, "tornado-r", 2, "west-line", { afterGroup: "tornado", provisional: true }),
		staged(tornado, "tornado-east", 3, "intercept", { provisional: true }),
	]);
	const f2 = find(m, "f2"), sr71 = find(m, "sr71"), flak = find(m, "flak"), tents = find(m, "tents");
	if (f2) { f2.site = "crater-air"; f2.note = "Over the crater (Mitoro route notes)."; }
	if (sr71) { sr71.site = "sr71-corner"; sr71.note = "South-west corner at 20,000 ft (wiki), adapted to y 2400."; }
	if (flak) { flak.site = "headquarters"; flak.note = "Northern line (Shotgunnova)."; }
	if (tents) tents.note = "Split 4 at the western position / 8 at the northern line (Shotgunnova mentions both; wiki lists 12). Split adapted.";
}
function farbanti(m: AC04Mission): void {
	const chain = "Mitoro (Ace): clearing initial formations 1/2/3 brings F-22+EF-2000, F-22+EF-2000 and F-15 ACTIVE. Normal totals (wiki 6/6/3) preserved; formation composition adapted.";
	const f22 = find(m, "f22"), ef = find(m, "ef2000"), active = find(m, "active");
	if (f22) split(m, "f22", [staged(f22, "f22", 2, "north", { note: chain }), staged(f22, "f22-r1", 2, "north", { afterGroup: "f22", triggerAt: 10, triggerMode: "both", provisional: true }), staged(f22, "f22-r2", 2, "intercept", { afterGroup: "ef2000", triggerAt: 10, triggerMode: "both", provisional: true })]);
	if (ef) split(m, "ef2000", [staged(ef, "ef2000", 2, "intercept"), staged(ef, "ef2000-west", 2, "intercept"), staged(ef, "ef2000-r1", 1, "north", { afterGroup: "f22", triggerAt: 10, triggerMode: "both", provisional: true }), staged(ef, "ef2000-r2", 1, "intercept", { afterGroup: "ef2000", triggerAt: 10, triggerMode: "both", provisional: true })]);
	if (active) { active.afterGroup = "ef2000-west"; active.triggerAt = 10; active.triggerMode = "both"; active.provisional = true; active.note = chain; }
	const armor = find(m, "armor");
	if (armor) split(m, "armor", [
		staged(armor, "armor", 23, "bridges", { provisional: true, note: "Ground total corrected to 55 including the scored bridge (wiki 55/2530 and Mitoro 55 agree; Shotgunnova header says 34). North column, city streets, GHQ perimeter split adapted." }),
		staged(armor, "armor-reinforce", 6, "city", { afterKills: { groups: ["armor", "aa", "sam", "subs"], count: 12 }, provisional: true, note: "Mitoro (Ace): ground reinforcements appear in the centre after defenders fall; the 12-kill trigger is an adaptation." }),
	], 29);
	const apache = find(m, "apache"), bridge = find(m, "bridge"), destroyer = find(m, "destroyer");
	if (apache) { apache.site = "flooded"; apache.note = "Helicopters over the submerged district (Shotgunnova)."; }
	if (bridge) bridge.note = "Johnson Memorial Bridge is the scored bridge target (one of the 55 ground units); Mitoro notes two tanks on it die with it, not modelled. 100 points provisional.";
	if (destroyer) destroyer.note = note(destroyer, "In the river beside Johnson Bridge (Mitoro).");
}
function megalith(m: AC04Mission): void {
	const secondary = find(m, "secondary-missiles"), ports = find(m, "ports"), yellow = find(m, "yellow");
	if (secondary) {
		secondary.points = 300;
		secondary.note = "POINTS CORRECTED 500->300: Shotgunnova Normal legend and Mitoro table say 300; the wiki's own S-rank prose (generators+core 2490, rest from these missiles AND at least half the Yellows) only holds with 300. Launch-if-ignored behaviour not implemented.";
	}
	if (ports) ports.note = "Six zero-point launch ports, three per southern arm roof (Mitoro structure diagram).";
	if (yellow) yellow.note = "Fifteen Yellow defenders in three five-ship formations meeting the sortie head-on (Mitoro start diagram); new pilots, not Thirteen's squadron.";
}

export function refineLateMission(mission: AC04Mission): AC04Mission {
	if (!lateInRange(mission.id) || mission.gaps.includes(LATE_REBUILD_MARK)) return mission;
	const m = clone(mission);
	if (m.id === 13) safeReturn(m);
	else if (m.id === 14) breakingArrows(m);
	else if (m.id === 15) emancipation(m);
	else if (m.id === 16) whiskey(m);
	else if (m.id === 17) farbanti(m);
	else if (m.id === 18) megalith(m);
	const evidence = [LateEvidence.m13, LateEvidence.m14, LateEvidence.m15, LateEvidence.m16, LateEvidence.m17, LateEvidence.m18][m.id - 13];
	m.gaps.push(LATE_REBUILD_MARK, `Late rebuild evidence: ${evidence}`);
	return m;
}
