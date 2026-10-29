// Pure presentation of the reliable result packet. Zero-kill roles are omitted;
// stable role order keeps debriefs comparable across sorties.
import { TargetScoreSnapshot } from "./TargetScore";

const ROLES = ["bandit", "raider", "courier", "ace", "ground", "bomber", "escort"];
export function targetScoreLines(snapshot?: TargetScoreSnapshot): { key: string; label: string; value: string }[] {
	if (snapshot === undefined) return [];
	const rows: { key: string; label: string; value: string }[] = [];
	for (const role of ROLES) {
		const count = snapshot.kills[role] ?? 0;
		if (count > 0) rows.push({ key: `Target_${role}`, label: `${string.upper(role)} ×${count}`, value: `${snapshot.points[role] ?? 0}` });
	}
	return rows;
}
