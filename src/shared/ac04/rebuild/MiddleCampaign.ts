import type { AC04Domain, AC04Mission, AC04UnitGroup } from "../../AC04MissionData";
import type { FlightPoint } from "../../WorldTypes";

/**
 * Middle-campaign (M6-M12) roster/staging refinements, applied once to the
 * base mission manifest. Pure: clones, never mutates its input, and returns
 * out-of-range missions unchanged. Idempotent (rosters are authored absolutely).
 *
 * Evidence policy: counts copied only from sources that state them; every
 * count, split, trigger or timing a source does not state for Normal remains
 * `provisional` with a note. Mitoro maps are Ace difficulty and used only for
 * topology and qualitative arrival behaviour.
 */
const WIKI = "https://acecombat.wiki.gg/wiki/";
const MITORO = "https://mitoro.sakura.ne.jp/ac04/data/";
const SHOTGUNNOVA = "https://gamefaqs.gamespot.com/ps2/452838-ace-combat-04-shattered-skies/faqs/48109";
const G = (id: string, unitType: string, domain: AC04Domain, count: number, points: number, site: string, required = false, phase = 0, extra: Partial<AC04UnitGroup> = {}): AC04UnitGroup => ({ id, type: unitType, domain, count, points, site, required, phase, ...extra });
const P = (x: number, y: number, z: number): FlightPoint => ({ x, y, z });

/** Site prefix for weapons mounted on a ship hull: the world must not add a land pad. */
export const MIDDLE_DECK_PREFIX = "deck-";
export function middleDeckMounted(group: AC04UnitGroup): boolean { return group.site.find(MIDDLE_DECK_PREFIX, 1, true)[0] === 1; }
/** Hull group carrying a deck-mounted weapon group (site "deck-<hull id>"). */
export function middleDeckHull(group: AC04UnitGroup): string | undefined {
	return middleDeckMounted(group) ? group.site.sub(MIDDLE_DECK_PREFIX.size() + 1) : undefined;
}
export const MIDDLE_FIRST = 6;
export const MIDDLE_LAST = 12;

// --- M06 Invincible Fleet ------------------------------------------------------
const M06_HARBOR_GROUND = ["comberth-containers", "comberth-cranes", "comberth-storage", "comberth-aa", "comberth-sam"];
const M06_NEW_HARBOR_GROUND = ["newcomberth-containers", "newcomberth-storage", "newcomberth-fuel", "newcomberth-aa", "newcomberth-sam"];
const M06_SHIPYARD_GROUND = ["shipyard-cranes", "shipyard-storage", "shipyard-aa", "shipyard-sam"];
const M06_FLEET = ["raven", "geofon", "tanager", "missile-boats", "raven-sam", "tanager-gun"];
const M06_HARBOR_SHIPS = ["cruiser-beluga", "cruiser-fenris", "cruiser-kolga", "cruiser-lazuli", "beowulf-nu", "beowulf-pi", "cruiser-sam", "cruiser-aa"];
const M06_NEW_HARBOR_SHIPS = ["container-ships", "supply"];
const M06_SHIPYARD_SHIPS = ["destroyer-herne", "destroyer-taisch", "destroyer-thiassi", "landing-ships", "submarines-shipyard", "destroyer-aa"];
const M06_STAGE = "Mitoro M06 (Ace) describes cluster-local reinforcements and ~6-minute respawns after surrounding targets are cleared; Normal splits, kill thresholds and delays are adaptations.";
function m06(base: AC04Mission): AC04Mission {
	const air = (id: string, t: string, n: number, pts: number, site: string, extra: Partial<AC04UnitGroup> = {}) => G(id, t, "air", n, pts, site, false, 0, { provisional: true, note: M06_STAGE, ...extra });
	const respawn = (after: string, kills: string[], killCount: number): Partial<AC04UnitGroup> => ({ afterGroup: after, triggerAt: 360, triggerMode: "both", afterKills: { groups: kills, count: killCount } });
	const named = (id: string, t: string, pts: number, site: string) => G(id, t, "naval", 1, pts, site);
	const deck = (id: string, t: string, n: number, pts: number, hull: string, note: string) => G(id, t, "ground", n, pts, MIDDLE_DECK_PREFIX + hull, false, 0, { note });
	const port = (id: string, t: string, n: number, pts: number, site: string) => G(id, t, "ground", n, pts, site, false, 0, { provisional: true, note: "Type and points per wiki; Normal count blank in source. Cluster split adapted to the Shotgunnova 40-ground header." });
	const roster: AC04UnitGroup[] = [
		// Initial air: 10 fighters + Ka-25 = 11, the Shotgunnova Normal header's air figure.
		air("f14-fleet", "F-14", 2, 60, "fleet-air"), air("f18-fleet", "F/A-18", 2, 60, "fleet-air"),
		air("f18-harbor", "F/A-18", 2, 60, "harbor-air"), air("f14-shipyard", "F-14", 2, 60, "shipyard-air"),
		air("tornado-north", "TND-IDS", 2, 60, "new-harbor-air"),
		G("ka25", "Ka-25", "air", 1, 50, "geofon-deck", false, 0, { note: "Wiki: a single KA-25 is launched from CARRIER GEOFON." }),
		// Cluster reinforcements (Mitoro qualitative): attacking the fleet, nearly clearing each port.
		air("f14-fleet-2", "F-14", 4, 60, "fleet-reinforce", { afterKills: { groups: M06_FLEET, count: 1 } }),
		air("f18-fleet-2", "F/A-18", 2, 60, "fleet-reinforce", { afterKills: { groups: M06_FLEET, count: 1 } }),
		air("f14-harbor-last", "F-14", 1, 60, "harbor-air", { afterKills: { groups: [...M06_HARBOR_GROUND, ...M06_HARBOR_SHIPS], count: 22 } }),
		air("f14-shipyard-last", "F-14", 1, 60, "shipyard-reinforce", { afterKills: { groups: [...M06_SHIPYARD_GROUND, ...M06_SHIPYARD_SHIPS], count: 14 } }),
		air("f18-new-harbor", "F/A-18", 2, 60, "new-harbor-air", { afterKills: { groups: [...M06_NEW_HARBOR_GROUND, ...M06_NEW_HARBOR_SHIPS], count: 4 } }),
		air("tornado-new-harbor-last", "TND-IDS", 1, 60, "new-harbor-air", { afterKills: { groups: [...M06_NEW_HARBOR_GROUND, ...M06_NEW_HARBOR_SHIPS], count: 11 } }),
		// ~6-minute respawns (Mitoro, Ace) gated on the cluster's last reinforcement and local clearance.
		air("f14-fleet-return", "F-14", 1, 60, "fleet-reinforce", respawn("f14-fleet-2", M06_FLEET, 9)),
		air("f18-fleet-return", "F/A-18", 1, 60, "fleet-reinforce", respawn("f14-fleet-2", M06_FLEET, 9)),
		air("f14-harbor-return", "F-14", 1, 60, "harbor-air", respawn("f14-harbor-last", [...M06_HARBOR_GROUND, ...M06_HARBOR_SHIPS], 22)),
		air("f18-harbor-return", "F/A-18", 1, 60, "harbor-air", respawn("f14-harbor-last", [...M06_HARBOR_GROUND, ...M06_HARBOR_SHIPS], 22)),
		air("f14-shipyard-return", "F-14", 1, 60, "shipyard-reinforce", respawn("f14-shipyard-last", [...M06_SHIPYARD_GROUND, ...M06_SHIPYARD_SHIPS], 14)),
		air("tornado-shipyard-return", "TND-IDS", 1, 60, "shipyard-reinforce", respawn("f14-shipyard-last", [...M06_SHIPYARD_GROUND, ...M06_SHIPYARD_SHIPS], 14)),
		air("tornado-new-harbor-return", "TND-IDS", 1, 60, "new-harbor-air", respawn("tornado-new-harbor-last", [...M06_NEW_HARBOR_GROUND, ...M06_NEW_HARBOR_SHIPS], 11)),
		// Aegir Fleet anchorage (southern channel). Wiki named hulls and points.
		named("raven", "AEGIS RAVEN", 150, "fleet"), named("geofon", "CARRIER GEOFON", 220, "fleet"), named("tanager", "BATTLESHIP TANAGER", 200, "fleet"),
		G("missile-boats", "MSSL. BOAT", "naval", 2, 60, "fleet"),
		deck("raven-sam", "SAM", 2, 30, "raven", "Wiki: AEGIS RAVEN carries 2 SAM (30 each); hull kills do not destroy weapons."),
		deck("tanager-gun", "GUN", 3, 30, "tanager", "Wiki: BATTLESHIP TANAGER carries 3 GUN (30 each)."),
		// Comberth Harbor (west).
		named("cruiser-beluga", "CRUISER BELUGA", 100, "harbor"), named("cruiser-fenris", "CRUISER FENRIS", 100, "harbor"),
		named("cruiser-kolga", "CRUISER KOLGA", 100, "harbor"), named("cruiser-lazuli", "CRUISER LAZULI", 100, "harbor"),
		named("beowulf-nu", "SUBMARINE BEOWULF-NU", 120, "harbor"), named("beowulf-pi", "SUBMARINE BEOWULF-PI", 120, "harbor"),
		deck("cruiser-sam", "SAM", 4, 30, "cruisers", "Wiki: each named cruiser has 1 SAM (30); index i maps to cruiser i."),
		deck("cruiser-aa", "AA GUN", 4, 20, "cruisers", "Wiki lists AA GUN (20) on cruisers; one per named cruiser is the roster-review minimum, exact Normal count unconfirmed."),
		port("comberth-containers", "CONTAINERS", 6, 40, "harbor"), port("comberth-cranes", "CRANE", 3, 40, "harbor"), port("comberth-storage", "STORAGE", 2, 40, "harbor"),
		port("comberth-aa", "AA GUN", 2, 20, "harbor"), port("comberth-sam", "SAM", 1, 50, "harbor"),
		// New Comberth Harbor (north tip).
		G("container-ships", "CONT. SHIP", "naval", 2, 100, "new-harbor"), G("supply", "SUPPLY SHIP", "naval", 1, 100, "new-harbor"),
		port("newcomberth-containers", "CONTAINERS", 2, 40, "new-harbor"), port("newcomberth-storage", "STORAGE", 3, 40, "new-harbor"), port("newcomberth-fuel", "FUEL TANK", 3, 40, "new-harbor"),
		port("newcomberth-aa", "AA GUN", 1, 20, "new-harbor"), port("newcomberth-sam", "SAM", 1, 50, "new-harbor"),
		// Shipyard (east spur): destroyers, landing ships, sheltered submarines.
		named("destroyer-herne", "DESTROYER HERNE", 100, "shipyard"), named("destroyer-taisch", "DESTROYER TAISCH", 100, "shipyard"), named("destroyer-thiassi", "DESTROYER THIASSI", 100, "shipyard"),
		G("landing-ships", "LNDG. SHIP", "naval", 2, 100, "shipyard"),
		G("submarines-shipyard", "SUBMARINE", "naval", 3, 120, "shipyard", false, 0, { provisional: true, note: "Wiki total 5 generic submarines; 3/2 shipyard/east-shore split adapted from Shotgunnova's sheltered/upriver submarine notes." }),
		deck("destroyer-aa", "AA GUN", 2, 20, "herne-taisch", "Roster review: HERNE and TAISCH carry AA GUN (20); index 0 HERNE, 1 TAISCH."),
		port("shipyard-cranes", "CRANE", 4, 40, "shipyard"), port("shipyard-storage", "STORAGE", 1, 40, "shipyard"),
		port("shipyard-aa", "AA GUN", 1, 20, "shipyard"), port("shipyard-sam", "SAM", 1, 50, "shipyard"),
		// East shore of the peninsula (Mitoro line of ground dots; Shotgunnova's upriver gas tanks/SAMs).
		G("submarines-east", "SUBMARINE", "naval", 2, 120, "east-shore", false, 0, { provisional: true, note: "Remaining 2 of the wiki's 5 generic submarines." }),
		port("east-gas", "GAS TANK", 3, 40, "east-shore"), port("east-fuel", "FUEL TANK", 2, 40, "east-shore"), port("east-cranes", "CRANE", 1, 40, "east-shore"),
		port("east-aa", "AA GUN", 2, 20, "east-shore"), port("east-sam", "SAM", 1, 50, "east-shore"),
	];
	return { ...base, roster, gaps: withGaps(base.gaps, [
		"AC04-M06-REBUILD: wiki named hulls (12) and listed ship weapons are separate targets; ground restructured to the Shotgunnova 40-ground header with FUEL/GAS categories, per-type counts provisional. Air totals 13/10/5/1 retained; 11 initial air matches the header, reinforcement/respawn chain is a Mitoro(Ace)-based adaptation. " + WIKI + "Invincible_Fleet " + MITORO + "m06.htm " + SHOTGUNNOVA,
		"AC04-M06-REBUILD: whether the 36 naval header counts ship weapons, unnamed cruiser/destroyer rows, and the harbour-mouth bridge score remain unresolved.",
	]) };
}

// --- M08 Shattered Skies -------------------------------------------------------
const M08_TYPE1 = ["f18-island", "mig-island"];
const M08_FIGHTERS = ["mig-headon", "f15-island-west", "f14-awacs-escort", "f18-island", "mig-island", "wave-west-1", "wave-north-2", "wave-southwest-3", "wave-west-4", "wave-converge-5a", "wave-converge-5b"];
const M08_NOTE = "Fighter type counts are blank in the wiki. Initial picture (5 head-on, 2+1 west, 4 AWACS escorts, 6 'type-1' over the island) and the 6/4/2/6/5 reinforcement chain follow Mitoro M08 (Ace); Normal totals unverified.";
function m08(base: AC04Mission): AC04Mission {
	const f = (id: string, t: string, n: number, site: string, extra: Partial<AC04UnitGroup> = {}) => G(id, t, "air", n, 60, site, false, 0, { provisional: true, note: M08_NOTE, ...extra });
	const chain = (count: number): Partial<AC04UnitGroup> => ({ afterKills: { groups: M08_FIGHTERS, count } });
	const roster: AC04UnitGroup[] = [
		f("mig-headon", "MiG-29", 5, "headon"), f("f15-island-west", "F-15C", 3, "island-west"), f("f14-awacs-escort", "F-14", 4, "awacs-escort"),
		f("f18-island", "F/A-18", 3, "island-air"), f("mig-island", "MiG-29", 3, "island-air"),
		f("wave-west-1", "F-15C", 6, "wave-west", { afterKills: { groups: M08_TYPE1, count: 6 } }),
		f("wave-north-2", "F-14", 4, "wave-north", chain(12)), f("wave-southwest-3", "F/A-18", 2, "wave-southwest", chain(16)),
		f("wave-west-4", "MiG-29", 6, "wave-west", chain(18)),
		f("wave-converge-5a", "F-15C", 3, "wave-north", chain(23)), f("wave-converge-5b", "F/A-18", 2, "wave-southwest", chain(23)),
		G("sr71", "SR-71", "air", 1, 200, "sr71-start", false, 0, { speed: 220, note: "Wiki: spawns above the player, circles the area twice, escapes west. Path is an adaptation within the 3600-stud ceiling.",
			path: [P(1500, 3400, -300), P(0, 3400, -1800), P(-1500, 3400, -300), P(0, 3400, 1200), P(1500, 3400, -300), P(0, 3400, -1800), P(-1500, 3400, -300), P(-3700, 3400, -300)] }),
		G("e767", "E-767", "air", 1, 140, "awacs"), G("kc10", "KC-10", "air", 1, 150, "awacs"),
		G("yellow", "Su-37 YELLOW", "air", 5, 150, "yellow-island", false, 0, { invulnerable: true, note: "First damage triggers squadron retreat; no kills." }),
		G("b2", "B-2", "air", 6, 150, "west", true, 1, { health: 130, speed: 90, note: "Wiki: approach the Comona rocket base from the west. Path ends in a holding pattern over the launch complex.",
			path: [P(-1800, 1100, -300), P(-400, 1000, -300), P(500, 1000, -900), P(800, 1000, -300), P(0, 1000, 300), P(-600, 1000, -300), P(500, 1000, -900)] }),
	];
	return { ...base, roster, gaps: withGaps(base.gaps, [
		"AC04-M08-REBUILD: 41 provisional fighters staged as Mitoro(Ace) initial picture plus kill-count reinforcement chain (type-1 x6, then cumulative 12/16/18/23); Ace-only infinite update respawns not modelled. Yellow/SR-71/E-767/KC-10/B-2 counts and points per " + WIKI + "Shattered_Skies; topology " + MITORO + "m08.htm",
	]) };
}

// --- M09 Operation Bunker Shot --------------------------------------------------
type Beach = "west" | "center" | "east";
export const M09_BEACH_NAME: { [k in Beach]: string } = { west: "HALLE", center: "CROWNE", east: "CARANDA" };
const M09_GROUND_NOTE = "Taxonomy only: RADAR, LAUNCHER and BATTERY(80) are named by the Shotgunnova Normal guide/Mitoro/Asahi; per-type and per-beach counts are provisional. Authored aggregate stays 60 of the Normal guide's 83 (missing 23 not fabricated).";
function m09Beach(beach: Beach, tanks: number, launchers: number): AC04UnitGroup[] {
	const site = `beach-${beach}`, g = (kind: string, t: string, n: number, pts: number) => G(`${beach}-${kind}`, t, "ground", n, pts, site, false, 0, { provisional: true, note: M09_GROUND_NOTE });
	const out = [g("pillbox", "PILLBOX", 3, 60), g("batteries", "BATTERY", 3, 80), g("aa", "AA GUN", 4, 20), g("sam", "SAM", 2, 30), g("radar", "RADAR", 1, 80), g("tanks", "TANK", tanks, 50)];
	if (launchers > 0) out.push(g("launchers", "LAUNCHER", launchers, 70));
	return out;
}
function m09(base: AC04Mission): AC04Mission {
	const crowneGround = m09Beach("center", 6, 0).map((g) => g.id);
	const air = (id: string, t: string, n: number, pts: number, site: string, extra: Partial<AC04UnitGroup> = {}) => G(id, t, "air", n, pts, site, false, 0, { provisional: true, note: "Mitoro M09 (Ace) placement/arrival; Normal type counts unverified.", ...extra });
	const roster: AC04UnitGroup[] = [
		...m09Beach("west", 6, 2), ...m09Beach("center", 6, 0), ...m09Beach("east", 6, 1),
		air("mig-caranda", "MiG-29", 2, 60, "caranda-air"), air("tornado-caranda", "TND-IDS", 1, 60, "caranda-air"),
		air("hind", "Mi-24", 3, 50, "beach-helos"),
		air("mig-crowne", "MiG-29", 2, 60, "crowne-air", { afterKills: { groups: crowneGround, count: 8 } }),
		air("tornado-crowne", "TND-IDS", 2, 60, "crowne-air", { afterKills: { groups: crowneGround, count: 8 } }),
		air("f15-halle", "F-15C", 3, 60, "halle-air", { afterKills: { groups: ["west-tanks", "west-launchers"], count: 8 } }),
		G("a10", "A-10", "air", 6, 100, "a10-entry", true, 1, { speed: 60, note: "Six aircraft at 100 points each (Shotgunnova Normal). Wiki: they head for the central beach with fighter escort; path/speed are adaptations.",
			path: [P(-400, 650, -900), P(150, 450, -50), P(250, 380, 300), P(900, 380, 520), P(250, 380, 700), P(-400, 380, 520), P(250, 380, 300)] }),
		G("update-escorts", "F-15C", "air", 4, 60, "a10-entry", false, 1, { provisional: true, note: "Fighter escort presence verified; 4 aircraft from Mitoro Ace description, F-15C type inferred, awaiting Normal comparison." }),
	];
	return { ...base, roster, gaps: withGaps(base.gaps, [
		"AC04-M09-REBUILD: per-beach groups (Halle west, Crowne centre, Caranda east per Mitoro labels) with source-named RADAR/LAUNCHER categories; counts still provisional, aggregate 60 vs Normal 83 unresolved. Crowne/Halle reinforcements follow Mitoro(Ace) descriptions with adapted kill thresholds. " + MITORO + "m09.htm " + SHOTGUNNOVA,
	]) };
}

// --- M07 / M10 / M11 / M12: placement-site refinements only -----------------------
function resite(base: AC04Mission, sites: { [id: string]: string }, gap: string): AC04Mission {
	const roster = base.roster.map((g) => sites[g.id] !== undefined ? { ...g, site: sites[g.id] } : { ...g });
	return { ...base, roster, gaps: withGaps(base.gaps, [gap]) };
}
function withGaps(existing: string[], added: string[]): string[] {
	const out = [...existing];
	for (const gap of added) if (!out.includes(gap)) out.push(gap);
	return out;
}

/** Applies the middle-campaign refinements to one mission; out-of-range ids pass through unchanged. */
export function refineMiddleMission(mission: AC04Mission): AC04Mission {
	switch (mission.id) {
		case 6: return m06(mission);
		case 7: return resite(mission, {}, "AC04-M07-REBUILD: world raised to a Faith Park plateau above the 400-stud barrage ceiling with Mitoro-routed ravines; roster unchanged. Mitoro(Ace) shows later fighters/helicopters racing south through the valleys; Normal arrival timing unverified.");
		case 8: return m08(mission);
		case 9: return m09(mission);
		case 10: return resite(mission, { rafale: "sub-air", f14: "sub-air", ef2000: "airbase-air", c130: "airbase-air", f18: "center-air", hind: "vtol-air", harrier: "vtol-air", chinook: "vtol-air" },
			"AC04-M10-REBUILD: air and defence placement follows Mitoro M10 sectors (south Scion airfield, west resupply, north submarine dock, east VTOL; F/A-18 pairs over the central rivers, R-M01/F-14 at the dock). Counts unchanged and still conflicting (72/20, 100/24, 81/24).");
		case 11: return resite(mission, {}, "AC04-M11-REBUILD: attacker spawn offsets/altitudes per Mitoro M11 wave diagrams (relative to the airliners); runtime should spawn relative to the live airliner (see docs/reviews/ac04-middle-rebuild.json).");
		case 12: return resite(mission, { rafale: "runway-ne", f15c: "nw-patrol", su35: "nw-patrol", f15e: "se-patrol", f2: "se-patrol", yellow: "yellow-north" },
			"AC04-M12-REBUILD: seven guns at N/NE/E/S/SW/W/NW with the ruined eighth at SE, jammer at the hub, 7 inner SAM + 9 outer AA set off the barrel azimuths, three R-M01 on the NE runway (Mitoro M12 close-up, Ace). Yellow 4 single-kill update unchanged.");
		default: return mission;
	}
}
