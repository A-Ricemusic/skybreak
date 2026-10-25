// Client-only stage bounds are isolated from menu terrain (which stays near Y=0)
// and every camera/actor uses the same translation.
export const CUTSCENE_STAGE_ORIGIN = new Vector3(0, 5000, 0);
export const CUTSCENE_SKIP_SIZE = new Vector2(112, 44);

export function offsetCutscenePoint(point: readonly [number, number, number]): Vector3 {
	return new Vector3(point[0], point[1], point[2]).add(CUTSCENE_STAGE_ORIGIN);
}

