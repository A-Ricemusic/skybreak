// Server -> client remotes for sorties, bound once by CombatService.Init.
// Kept apart from CombatService so SessionTelemetry can send without a cycle.
export const CombatRemotes: {
	missionState?: RemoteEvent;
	flightState?: UnreliableRemoteEvent;
	telemetry?: UnreliableRemoteEvent;
	combatEffect?: RemoteEvent;
} = {};
