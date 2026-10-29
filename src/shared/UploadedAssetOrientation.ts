import type { UploadedAssetName } from "./UploadedAssetSpecs";

export interface OrientationOffsets {
	/** Degrees about model axes; applied with CFrame.Angles(pitch, yaw, roll) before bounds/scale fitting. */
	yaw: number;
	pitch: number;
	roll: number;
}

/** Import correction only. Keep identity until the orchestrator's Studio inspection.
 * Rotation is around the imported bounds centre; world pivots are then bottom-centred.
 * Corrections rotate the whole asset, including rotor parts, without changing approved files.
 */
export const UploadedAssetOrientation: Partial<Record<UploadedAssetName, OrientationOffsets>> = {
	HeavyTransport: { yaw: 0, pitch: 0, roll: 0 },
	RadarJammer: { yaw: 0, pitch: 0, roll: 0 },
	FuelTanker: { yaw: 0, pitch: 0, roll: 0 },
	AttackHelicopter: { yaw: 0, pitch: 0, roll: 0 },
	VantaV2Elite: { yaw: 0, pitch: 0, roll: 0 },
};
