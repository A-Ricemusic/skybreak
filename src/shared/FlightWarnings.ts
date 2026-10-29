import { FlightMath } from "./FlightMath";

/** LOW SPEED shows while the airspeed is within this many studs/s above the stall speed. */
export const STALL_MARGIN = 5;
/** Seconds of airspeed trend projected ahead: a fast bleed toward the stall warns early. */
export const STALL_TREND_SECONDS = 2;
/** The client's forward terrain probe looks this many seconds ahead along the flight path. */
export const TERRAIN_LOOKAHEAD = 2;
/** Shortest probe (studs), so a slow jet still sees a ridge it is about to sink into. */
export const TERRAIN_MIN_PROBE = 160;
/** Absolute altitude (studs) under which LOW ALTITUDE shows, whatever the terrain ahead. */
export const LOW_ALTITUDE = 100;

export interface FlightWarningState {
	terrainClearance?: number;
	speed: number;
	altitude: number;
	incoming: boolean;
	lockWarning?: boolean;
	boundaryWarning?: boolean;
	/** Airspeed change in studs/s per second (client trend); negative while bleeding speed. */
	acceleration?: number;
	/** Seconds until the flight path meets scenery (client forward ray); undefined when clear. */
	terrainSeconds?: number;
}

export type FlightAdvice = "" | "PULL UP" | "STALL" | "LOW SPEED" | "LOW ALTITUDE" | "AIRSPACE LIMIT";

/** Length of the forward terrain probe for the current airspeed. */
export function terrainProbeLength(speed: number): number {
	return math.max(TERRAIN_MIN_PROBE, (FlightMath.IsFinite(speed) ? math.max(0, speed) : 0) * TERRAIN_LOOKAHEAD);
}

/** Seconds until impact from a probe hit `distance` studs ahead, or undefined when nothing is close enough. */
export function terrainSeconds(distance: number | undefined, speed: number): number | undefined {
	if (distance === undefined || !FlightMath.IsFinite(distance) || !FlightMath.IsFinite(speed)) return undefined;
	const seconds = math.max(0, distance) / math.max(1, speed);
	return seconds <= TERRAIN_LOOKAHEAD ? seconds : undefined;
}

/** True when speed is under the stall + margin band, or the current bleed reaches stall within the trend window. */
export function lowSpeed(speed: number, acceleration = 0): boolean {
	if (speed < FlightMath.StallSpeed + STALL_MARGIN) return true;
	const trend = FlightMath.IsFinite(acceleration) ? math.min(0, acceleration) : 0;
	return speed + trend * STALL_TREND_SECONDS < FlightMath.StallSpeed;
}

/** Shared warning/ALT tint metric; missing or invalid terrain probes retain absolute altitude. */
export function warningAltitude(state: Pick<FlightWarningState, "terrainClearance" | "altitude">): number {
	return FlightMath.IsFinite(state.terrainClearance) ? state.terrainClearance : state.altitude;
}

/** The single most urgent flight warning: terrain first, then the stall band, low altitude and the airspace edge. */
export function flightAdvice(state: FlightWarningState): FlightAdvice {
	if (state.terrainSeconds !== undefined && state.terrainSeconds <= TERRAIN_LOOKAHEAD) return "PULL UP";
	if (state.speed <= FlightMath.StallSpeed + 0.01) return "STALL";
	if (lowSpeed(state.speed, state.acceleration)) return "LOW SPEED";
	if (warningAltitude(state) < LOW_ALTITUDE) return "LOW ALTITUDE";
	if (state.boundaryWarning) return "AIRSPACE LIMIT";
	return "";
}

/** Shared by every input-mode HUD: combat threats must never be hidden by flight advice. */
export function flightWarning(state: FlightWarningState, narrow = false, flightWarningsEnabled = true): string {
	const flight = flightWarningsEnabled ? flightAdvice(state) : "";
	const combat = state.incoming ? "MISSILE INBOUND" : state.lockWarning ? "MISSILE LOCK" : "";
	if (combat !== "") return !narrow && flight !== "" ? `${combat} · ${flight === "PULL UP" ? "TERRAIN" : flight}` : combat;
	if (flight === "STALL") return narrow ? "STALL: POWER↑ NOSE↓" : "STALL · ACCELERATE + NOSE DOWN";
	if (flight === "PULL UP") return narrow ? "TERRAIN · PULL UP" : "TERRAIN AHEAD · PULL UP";
	return flight;
}
