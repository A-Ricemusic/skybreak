import { FlightMath } from "./FlightMath";

/** Shared by every input-mode HUD: combat threats must never be hidden by flight advice. */
export function flightWarning(state: { speed: number; altitude: number; incoming: boolean; lockWarning?: boolean; boundaryWarning?: boolean }, narrow = false): string {
	const flight = state.speed < FlightMath.StallSpeed ? "STALL" : state.speed < FlightMath.WarningSpeed ? "LOW SPEED" : state.altitude < 100 ? "LOW ALTITUDE" : state.boundaryWarning ? "AIRSPACE LIMIT" : "";
	const combat = state.incoming ? "MISSILE INBOUND" : state.lockWarning ? "MISSILE LOCK" : "";
	if (combat !== "") return !narrow && flight !== "" ? `${combat} · ${flight}` : combat;
	return flight === "STALL" ? narrow ? "STALL: POWER↑ NOSE↓" : "STALL · ACCELERATE + NOSE DOWN" : flight;
}
