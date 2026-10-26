// Pure placement rule for protected escort/defend actors (trucks, launches, towers).
// The server samples the surface under the actor with a raycast (src/server/ActorGrounding.ts);
// this module turns that sample into a pivot height so the model's bounding box rests on it.
const DRAUGHT = 3;
export const ActorPlacement = {
	/** Studs a boat's hull sits below the water surface. */
	Draught: DRAUGHT,
	/**
	 * Pivot height that puts the bottom of a model's bounds on `surfaceY`. `pivotAboveBottom`
	 * is the model's pivot height above its own bounding-box bottom; a boat afloat sinks by Draught.
	 */
	PivotY(surfaceY: number, pivotAboveBottom: number, afloat: boolean): number {
		return surfaceY + pivotAboveBottom - (afloat ? DRAUGHT : 0);
	},
	/** Whether a raycast hit is water: terrain water, or the authored sea/river/shallows sheets. */
	IsWater(material: string, instanceName: string): boolean {
		return material === "Water" || instanceName === "Sea" || instanceName === "River" || instanceName === "Shallows";
	},
};
