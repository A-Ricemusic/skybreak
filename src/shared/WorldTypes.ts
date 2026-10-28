/** Campaign-independent geometry and combat types. */
export type EnvironmentPreset =
	| "canyon_dawn"
	| "canyon_noon"
	| "canyon_dusk"
	| "canyon_night"
	| "farm_morning"
	| "farm_overcast"
	| "farm_storm"
	| "farm_sunset"
	| "relay_night"
	| "relay_aurora"
	| "city_evening"
	| "city_night"
	| "city_dawn"
	| "harbor_fog"
	| "harbor_sunset"
	| "ocean_storm"
	| "ocean_clear"
	| "ocean_night";

export interface FlightPoint { x: number; y: number; z: number }
export type GroundAsset = "radar" | "warehouse" | "comms_relay" | "grain_silo";
export type TargetKind = "air" | "ground" | "ace";
