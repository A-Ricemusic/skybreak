import { GROUND_TYPES } from "./CampaignEncounters";
// Pure presentation of the reliable result packet. Zero-kill roles are omitted;
// stable role order keeps debriefs comparable across sorties.
import { TargetScoreSnapshot } from "./TargetScore";

const ROLES = ["bandit", "raider", "courier", "ace", "ground", "bomber", "escort", ...GROUND_TYPES];
export function targetScoreLines(snapshot?: TargetScoreSnapshot): { key: string; label: string; value: string }[] {
	if (snapshot === undefined) return [];
	const rows: { key: string; label: string; value: string }[] = [];
	const roles=[...ROLES];
	const extra: string[]=[];
	for(const [role] of pairs(snapshot.kills)) if(typeIs(role,"string") && !roles.includes(role)) extra.push(role);
	table.sort(extra);
	for (const role of [...roles,...extra]) {
		const count = snapshot.kills[role] ?? 0;
		if (count > 0) rows.push({ key: `Target_${role}`, label: `${string.upper(role)} ×${count}`, value: `${snapshot.points[role] ?? 0}` });
	}
	return rows;
}
