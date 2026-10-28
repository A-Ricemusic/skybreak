/**
 * Debrief rows from the authoritative AC04 result and the refreshed flight record. Pure.
 *
 * Only data the server actually sent is shown. AC04 results carry no authoritative rank yet: a generic
 * `rank` field on MissionFinished is deliberately ignored, and no reward, credit, per-typography tally or
 * flight trail is synthesized.
 */
import type { AC04Record } from "../../AC04Progress";
import type { MissionFinished } from "../../Types";
import { ac04Clock, ac04Pad, ac04Thousands } from "./AC04UIFormat";

export interface AC04DebriefRow { label: string; value: string }
export interface AC04Debrief {
	accomplished: boolean;
	missionId: number;
	outcome: string;
	/** Mission, outcome, points and time; record bests once the record confirms the mission complete. */
	summary: AC04DebriefRow[];
	/** Sortie statistics present in the result. */
	statistics: AC04DebriefRow[];
	/** Truthful persistence note. */
	saveNote: string;
	/** True when the save note needs attention (not saved). */
	saveWarning: boolean;
}

function finiteCount(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value >= 0 && value < 1e9;
}

const STATISTICS: [keyof MissionFinished, string][] = [
	["kills", "TARGETS DESTROYED"],
	["groundKills", "GROUND TARGETS"],
	["optionalKills", "OPTIONAL TARGETS"],
	["missilesFired", "MISSILES FIRED"],
	["missileHits", "MISSILE HITS"],
	["evades", "EVADES"],
];

export function ac04Debrief(result: MissionFinished, fallbackMissionId: number, title: string, record?: AC04Record): AC04Debrief {
	const accomplished = result.kind === "Completed";
	const missionId = result.missionId ?? fallbackMissionId;
	const score = finiteCount(result.score) ? result.score : 0;
	const summary: AC04DebriefRow[] = [
		{ label: "MISSION", value: `${ac04Pad(missionId, 2)}  ${string.upper(title)}` },
		{ label: "RESULT", value: accomplished ? "ACCOMPLISHED" : "FAILED" },
		{ label: "POINTS", value: ac04Thousands(score) },
		{ label: "TIME", value: ac04Clock(finiteCount(result.elapsed) ? result.elapsed : 0) },
	];
	if (record?.completed === true) {
		summary.push({ label: "RECORD POINTS", value: ac04Thousands(record.bestScore) });
		summary.push({ label: "RECORD TIME", value: ac04Clock(record.bestTime) });
	}
	const statistics: AC04DebriefRow[] = [];
	for (const [key, label] of STATISTICS) {
		const value = result[key];
		if (finiteCount(value)) statistics.push({ label, value: ac04Thousands(value) });
	}
	let saveNote: string, saveWarning = false;
	if (!accomplished) saveNote = "Failed sorties do not change the flight record.";
	else if (result.persistence === "session") saveNote = "Result kept for this session only.";
	else if (result.saved === true) saveNote = "Flight record saved.";
	else { saveNote = "Save not yet confirmed. Open Flight Records to retry."; saveWarning = true; }
	return { accomplished, missionId, outcome: accomplished ? "MISSION ACCOMPLISHED" : "MISSION FAILED", summary, statistics, saveNote, saveWarning };
}
