import type { AC04Mission, AC04UnitGroup } from "../../AC04MissionData";
import type { AC04Layout } from "../../AC04WorldData";
import type { WorldPlan } from "../../WorldPlan";
import type { FlightPoint } from "../../WorldTypes";
import { lateAuthoredPosition, lateInRange, lateLayoutPatch } from "./LatePlacement";
import { lateBuildWorld, type LateBuildReport } from "./LateWorldBuild";

/**
 * Late-campaign (M13-M18) world hooks, composed in AC04WorldData.
 * Original proposed wiring is preserved in docs/reviews/ac04-late-rebuild.json:
 *   - refineLateLayout: once per layout, after AC04WorldData's own post-push
 *     tweaks (layouts[17].escape etc.), so the M18 escape here wins;
 *   - refineLateWorld: inside build(), after base geometry and BEFORE the
 *     per-target pad/air/berth clearance loop;
 *   - refineLateUnitPosition: wraps unitPosition's result for every caller
 *     (world build, AC04World target placement, CombatService air spawns).
 * All three return/modify only M13-M18 and are idempotent for layouts.
 */
export function refineLateLayout(id: number, layout: AC04Layout): AC04Layout {
	const patch = lateLayoutPatch(id);
	if (patch === undefined) return layout;
	const sites: { [name: string]: FlightPoint } = {};
	for (const [name, p] of pairs(layout.sites)) sites[name as string] = { x: p.x, y: p.y, z: p.z };
	for (const [name, p] of pairs(patch.sites)) sites[name as string] = { x: p.x, y: p.y, z: p.z };
	const out: AC04Layout = {
		...layout, sites,
		spawn: patch.spawn ? { ...patch.spawn } : { ...layout.spawn },
		returnZ: patch.returnZ ?? layout.returnZ,
		evidence: { ...layout.evidence, use: patch.use },
	};
	if (patch.escape) { out.escape = { ...patch.escape }; out.escapeRadius = patch.escapeRadius; }
	return out;
}

/** Applies the authored world after base geometry, before target clearance. Returns a report (also used by tests). */
export function refineLateWorld(mission: AC04Mission, layout: AC04Layout, plan: WorldPlan): LateBuildReport | undefined {
	if (!lateInRange(mission.id)) return undefined;
	return lateBuildWorld(mission, layout, plan);
}

/** Pure placement override; returns `current` unchanged for unauthored units and other missions. */
export function refineLateUnitPosition(mission: AC04Mission, layout: AC04Layout, group: AC04UnitGroup, index: number, current: FlightPoint): FlightPoint {
	if (!lateInRange(mission.id)) return current;
	const authored = lateAuthoredPosition(mission, layout, group, index);
	return authored !== undefined ? { x: authored.x, y: authored.y, z: authored.z } : current;
}
