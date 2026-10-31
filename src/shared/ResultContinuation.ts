import { MissionCatalog, MISSION_COUNT } from "./MissionCatalog";

/** A confirmed result chooses the next mission; stale client slot snapshots are not authority. */
export function nextResultMission(won: boolean, missionId: number): number | undefined {
	return won && missionId >= 0 && missionId < MISSION_COUNT && MissionCatalog.Available(missionId + 1)
		? missionId + 1 : undefined;
}

export function activateResultNext(won: boolean, missionId: number, launch: (id: number) => void): void {
	const mission = nextResultMission(won, missionId);
	if (mission !== undefined) launch(mission);
}

/** Settlement commits progression before notifying, then releases the combat session.
 * Queue an early results click until that release; never tear down a saving session.
 * Cloud writes may continue afterwards: authoritative in-memory progression permits launch.
 */
export function awaitResultSettlement(env: {
	completing: () => boolean;
	present: () => boolean;
	now: () => number;
	wait: () => void;
}, limitSeconds = 10): boolean {
	const deadline = env.now() + limitSeconds;
	while (env.completing() && env.present() && env.now() < deadline) env.wait();
	return env.present() && !env.completing();
}
