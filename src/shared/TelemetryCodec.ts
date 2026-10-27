import { FlightMath } from "./FlightMath";
import { BreakCueState, Telemetry } from "./Types";

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
//          evadeCharges, optionalKills, incomingDistance (-1 none), pauseAck,
//          incomingSeconds (-1 none), incomingBearing (999 none)]
// flags: 1 incoming, 2 lockWarning, 4 boundaryWarning, 8 targetDamageable,
//        16 targetDamageable unknown (no target), 32 ace killed this sortie,
//        64 the server holds the sortie paused (pauseAck is field 25),
//        128 / 512 / 1024 the break cue (MissileRules.CueTick; at most one is set): 128 BREAK, a hard
//        break now makes the most urgent missile miss; 512 HOLD, keep pulling, letting go is not yet
//        safe; 1024 CLEAR, the missile can no longer reach the jet. 256 the BREAK / HOLD turn is to
//        the right (else left).
export type TelemetryPacket = number[];
export const TELEMETRY_FIELDS = 28;

export interface TelemetryNumbers {
	health: number; speed: number; altitude: number; kills: number; total: number; missiles: number;
	missileCooldown: number; evadeCooldown: number; lockProgress: number;
	incoming: boolean; lockWarning: boolean; boundaryWarning: boolean;
	elapsed: number; timeRemaining: number; objectiveProgress: number; objectiveTotal: number; groundKills: number;
	targetDistance: number; targetHealth?: number; protectedHealth?: number;
	targetDamageable?: boolean;
	specialCharges?: number; specialCooldown?: number; specialActive?: number;
	/** The sortie's ace is down (cumulative, so the HUD can tell an ace kill from a dropped packet). */
	aceKilled?: boolean;
	paused?: boolean;
	pauseAck?: number;
	/** Evade charges in hand (EvadeRules), optional raider kills, and the nearest hostile missile's range. */
	evadeCharges?: number; optionalKills?: number; incomingDistance?: number;
	/** The most urgent locked hostile missile: seconds to impact (absent when not closing), bearing from the nose in degrees, and the break cue. */
	incomingSeconds?: number; incomingBearing?: number; breakCue?: BreakCueState; breakRight?: boolean;
}

export const TelemetryCodec = {
	Encode(sequence: number, t: TelemetryNumbers): TelemetryPacket {
		const flags = (t.incoming ? 1 : 0) + (t.lockWarning ? 2 : 0) + (t.boundaryWarning ? 4 : 0)
			+ (t.targetDamageable === true ? 8 : 0) + (t.targetDamageable === undefined ? 16 : 0) + (t.aceKilled === true ? 32 : 0) + (t.paused === true ? 64 : 0)
			+ (t.breakCue === "break" ? 128 : t.breakCue === "hold" ? 512 : t.breakCue === "clear" ? 1024 : 0)
			+ ((t.breakCue === "break" || t.breakCue === "hold") && t.breakRight === true ? 256 : 0);
		return [
			sequence, t.health, t.speed, t.altitude, t.kills, t.total, t.missiles,
			t.missileCooldown, t.evadeCooldown, t.lockProgress, flags, t.elapsed,
			t.timeRemaining, t.objectiveProgress, t.objectiveTotal, t.groundKills,
			t.targetDistance, t.targetHealth ?? -1, t.protectedHealth ?? -1,
			t.specialCharges ?? 0, t.specialCooldown ?? 0, t.specialActive ?? 0,
			t.evadeCharges ?? 0, t.optionalKills ?? 0, t.incomingDistance ?? -1, t.pauseAck ?? 0,
			t.incomingSeconds ?? -1, t.incomingBearing ?? 999,
		];
	},
	/**
	 * Writes a received packet into `into` (no allocation). Returns the packet's
	 * sequence, or undefined when it is malformed; the caller drops stale sequences.
	 */
	Decode(packet: unknown, into: Telemetry): number | undefined {
		if (!typeIs(packet, "table")) return undefined;
		const values = packet as unknown[];
		for (let index = 0; index < TELEMETRY_FIELDS; index++) if (!FlightMath.IsFinite(values[index])) return undefined;
		const n = values as number[];
		into.health = n[1]; into.speed = n[2]; into.altitude = n[3]; into.kills = n[4]; into.total = n[5]; into.missiles = n[6];
		into.missileCooldown = n[7]; into.evadeCooldown = n[8]; into.lockProgress = n[9];
		const flags = n[10];
		into.incoming = flags % 2 >= 1;
		into.lockWarning = flags % 4 >= 2;
		into.boundaryWarning = flags % 8 >= 4;
		into.targetDamageable = flags % 32 >= 16 ? undefined : flags % 16 >= 8;
		into.aceKilled = flags % 64 >= 32;
		into.paused = flags % 128 >= 64;
		into.breakCue = flags % 256 >= 128 ? "break" : flags % 1024 >= 512 ? "hold" : flags % 2048 >= 1024 ? "clear" : undefined;
		into.breakRight = (into.breakCue === "break" || into.breakCue === "hold") && flags % 512 >= 256;
		into.elapsed = n[11]; into.timeRemaining = n[12]; into.objectiveProgress = n[13]; into.objectiveTotal = n[14]; into.groundKills = n[15];
		into.targetDistance = n[16];
		into.targetHealth = n[17] >= 0 ? n[17] : undefined;
		into.protectedHealth = n[18] >= 0 ? n[18] : undefined;
		into.specialCharges = math.max(0, n[19]); into.specialCooldown = math.max(0, n[20]); into.specialActive = math.max(0, n[21]);
		into.evadeCharges = math.max(0, n[22]); into.optionalKills = math.max(0, n[23]);
		into.incomingDistance = n[24] >= 0 ? n[24] : undefined;
		into.pauseAck = math.max(0, n[25]);
		into.incomingSeconds = n[26] >= 0 ? n[26] : undefined;
		into.incomingBearing = math.abs(n[27]) <= 180 ? n[27] : undefined;
		return n[0];
	},
};
