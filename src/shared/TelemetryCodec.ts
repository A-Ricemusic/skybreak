import { FlightMath } from "./FlightMath";
import { Telemetry } from "./Types";

// The 10 Hz HUD numbers travel as a flat number array on an UnreliableRemoteEvent:
// ~20 doubles is ~190 bytes, against ~600+ for the same fields as a keyed table
// with strings and an Instance reference. Text, the target Model and navigation
// travel separately (reliable `HudState`, only when they change).
//
// Layout: [sequence, health, speed, altitude, kills, total, missiles,
//          missileCooldown, evadeCooldown, lockProgress, flags, elapsed,
//          timeRemaining, objectiveProgress, objectiveTotal, groundKills,
//          targetDistance, targetHealth (-1 none), protectedHealth (-1 none),
//          specialCharges, specialCooldown, specialActive,
//          evadeCharges, optionalKills, incomingDistance (-1 none), pauseAck, pauseRemaining (-1 unknown),
//          turnObserved (-1 unknown), pitchObserved (-1 unknown)]
// Optional tail: clearance, update seconds, jam visual range (-1 absent), mission points.
// Flags 4096 = any jammer, 8192 = one jammer (partial radar). Legacy packet lengths are unchanged.
// flags: 1 incoming, 2 lockWarning, 4 boundaryWarning, 8 targetDamageable,
//        16 targetDamageable unknown (no target), 32 ace killed this sortie, 64 paused.
//        2048 evadeThreat (a missile is decoyable now); 128–1024 reserved for PR42 cues.
export type TelemetryPacket = number[];
export const TELEMETRY_FIELDS = 29;

export interface TelemetryNumbers {
	radarJammed?: boolean;
	radarPartial?: boolean;
	jamVisualRange?: number;
	missionPoints?: number;
	terrainClearance?: number;
	missionUpdateSeconds?: number;
	health: number; speed: number; altitude: number; kills: number; total: number; missiles: number;
	missileCooldown: number; evadeCooldown: number; lockProgress: number;
	evadeThreat?: boolean;
	incoming: boolean; lockWarning: boolean; boundaryWarning: boolean;
	elapsed: number; timeRemaining: number; objectiveProgress: number; objectiveTotal: number; groundKills: number;
	targetDistance: number; targetHealth?: number; protectedHealth?: number;
	targetDamageable?: boolean;
	specialCharges?: number; specialCooldown?: number; specialActive?: number;
	/** The sortie's ace is down (cumulative, so the HUD can tell an ace kill from a dropped packet). */
	aceKilled?: boolean;
	paused?: boolean;
	pauseAck?: number;
	/** Server-measured seconds left in this sortie’s shared pause budget; absent on older packets. */
	pauseRemaining?: number;
	/** Authoritative M1 movement seconds; absent outside the movement lesson/older packets. */
	turnObserved?: number;
	pitchObserved?: number;
	/** Evade charges in hand (EvadeRules), optional raider kills, and the nearest hostile missile's range. */
	evadeCharges?: number; optionalKills?: number; incomingDistance?: number;
}

export const TelemetryCodec = {
	Encode(sequence: number, t: TelemetryNumbers): TelemetryPacket {
		const flags = (t.incoming ? 1 : 0) + (t.lockWarning ? 2 : 0) + (t.boundaryWarning ? 4 : 0)
			+ (t.targetDamageable === true ? 8 : 0) + (t.targetDamageable === undefined ? 16 : 0) + (t.aceKilled === true ? 32 : 0) + (t.paused === true ? 64 : 0) + (t.evadeThreat === true ? 2048 : 0) + (t.radarJammed === true ? 4096 : 0) + (t.radarPartial === true ? 8192 : 0);
		const packet: number[] = [
			sequence, t.health, t.speed, t.altitude, t.kills, t.total, t.missiles,
			t.missileCooldown, t.evadeCooldown, t.lockProgress, flags, t.elapsed,
			t.timeRemaining, t.objectiveProgress, t.objectiveTotal, t.groundKills,
			t.targetDistance, t.targetHealth ?? -1, t.protectedHealth ?? -1,
			t.specialCharges ?? 0, t.specialCooldown ?? 0, t.specialActive ?? 0,
			t.evadeCharges ?? 0, t.optionalKills ?? 0, t.incomingDistance ?? -1, t.pauseAck ?? 0,
			t.pauseRemaining ?? -1,
			t.turnObserved ?? -1, t.pitchObserved ?? -1,
		];
		if (t.terrainClearance !== undefined || t.missionUpdateSeconds !== undefined || t.jamVisualRange !== undefined || t.missionPoints !== undefined) packet.push(t.terrainClearance ?? -1,t.missionUpdateSeconds ?? 0);
		if(t.jamVisualRange!==undefined || t.missionPoints!==undefined) packet.push(t.jamVisualRange ?? -1);
		if(t.missionPoints!==undefined) packet.push(t.missionPoints);
		return packet;
	},
	/**
	 * Writes a received packet into `into` (no allocation). Returns the packet's
	 * sequence, or undefined when it is malformed; the caller drops stale sequences.
	 */
	Decode(packet: unknown, into: Telemetry): number | undefined {
		if (!typeIs(packet, "table")) return undefined;
		const values = packet as unknown[];
		// Original 26-field packets remain valid; absent optional fields clear stale values.
		for (let index = 0; index < 26; index++) if (!FlightMath.IsFinite(values[index])) return undefined;
		const n = values as number[];
		into.health = n[1]; into.speed = n[2]; into.altitude = n[3]; into.kills = n[4]; into.total = n[5]; into.missiles = n[6];
		into.missileCooldown = n[7]; into.evadeCooldown = n[8]; into.lockProgress = n[9];
		const flags = n[10];
		into.missionPoints=FlightMath.IsFinite(n[32]) && n[32]>=0 ? n[32] : undefined;
		into.radarPartial=flags % 16384 >= 8192;
		into.jamVisualRange=FlightMath.IsFinite(n[31]) && n[31]>0 ? n[31] : undefined;
		into.radarJammed = flags % 8192 >= 4096;
		into.incoming = flags % 2 >= 1;
		into.evadeThreat = flags % 4096 >= 2048;
		into.lockWarning = flags % 4 >= 2;
		into.boundaryWarning = flags % 8 >= 4;
		into.targetDamageable = flags % 32 >= 16 ? undefined : flags % 16 >= 8;
		into.aceKilled = flags % 64 >= 32;
		into.paused = flags % 128 >= 64;
		into.elapsed = n[11]; into.timeRemaining = n[12]; into.objectiveProgress = n[13]; into.objectiveTotal = n[14]; into.groundKills = n[15];
		into.targetDistance = n[16];
		into.targetHealth = n[17] >= 0 ? n[17] : undefined;
		into.protectedHealth = n[18] >= 0 ? n[18] : undefined;
		into.specialCharges = math.max(0, n[19]); into.specialCooldown = math.max(0, n[20]); into.specialActive = math.max(0, n[21]);
		into.evadeCharges = math.max(0, n[22]); into.optionalKills = math.max(0, n[23]);
		into.incomingDistance = n[24] >= 0 ? n[24] : undefined;
		into.pauseAck = math.max(0, n[25]);
		into.pauseRemaining = FlightMath.IsFinite(n[26]) && n[26] >= 0 ? math.clamp(n[26], 0, 300) : undefined;
		into.turnObserved = FlightMath.IsFinite(n[27]) && n[27] >= 0 ? math.clamp(n[27], 0, 3) : undefined;
		into.pitchObserved = FlightMath.IsFinite(n[28]) && n[28] >= 0 ? math.clamp(n[28], 0, 3) : undefined;
		into.terrainClearance = FlightMath.IsFinite(n[29]) && n[29]>=0 ? n[29] : undefined;
		into.missionUpdateSeconds = FlightMath.IsFinite(n[30]) ? math.clamp(n[30],0,8) : undefined;
		return n[0];
	},
};
