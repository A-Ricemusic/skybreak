import { FlightMath } from "./FlightMath";

// Pure heading-up radar projection shared by the HUD radar and Roblox Jest.
// The player sits at the centre; their nose points at the top of the disc.

export type RadarContactKind = "required" | "optional" | "ground" | "groundOptional" | "objective" | "protected" | "missile";

export interface RadarContact {
	kind: RadarContactKind;
	/** World X/Z of the contact (the radar ignores height). */
	x: number;
	z: number;
	/** The currently selected target: drawn larger. */
	selected?: boolean;
}

export interface RadarBlip {
	/** Pixels from the disc centre: +x right, +y down (GUI axes). */
	x: number;
	y: number;
	/** Beyond the radar range: pinned to the rim in the contact's direction. */
	edge: boolean;
}

/**
 * Studs from the centre to the rim. Bandits spawn 2600–3200 from the player; anything farther (the mission's
 * objectives seen from the far side of the ±6000 flyable square) is pinned to the rim in its direction.
 */
export const RADAR_RANGE = 3200;
/** Close-in range used while every required contact is inside it (dogfights read better zoomed). */
export const RADAR_NEAR_RANGE = 1600;
/** Pixels kept free between a pinned rim blip and the disc edge. */
export const RADAR_RIM_INSET = 5;

/** Glyph drawn for each contact kind (text glyphs: no images to upload). */
export const RADAR_GLYPHS: { [kind in RadarContactKind]: string } = {
	required: "▲",
	optional: "△",
	ground: "◆",
	groundOptional: "◇",
	objective: "◎",
	protected: "■",
	missile: "•",
};

/** Draw order, lowest first: threats always end on top. */
export const RADAR_LAYER: { [kind in RadarContactKind]: number } = {
	objective: 1, protected: 2, groundOptional: 3, ground: 4, optional: 5, required: 6, missile: 7,
};

/**
 * Projects a world X/Z offset into heading-up radar pixels. `yaw` is the
 * FlightMath yaw (forward = (-sin yaw, 0, -cos yaw)); `radius` is the disc radius.
 */
export function radarProject(dx: number, dz: number, yaw: number, range: number, radius: number): RadarBlip {
	const right = dx * math.cos(yaw) - dz * math.sin(yaw);
	const forward = -dx * math.sin(yaw) - dz * math.cos(yaw);
	const scale = math.max(1, radius - RADAR_RIM_INSET) / math.max(1, range);
	let x = right * scale;
	let y = -forward * scale;
	const limit = math.max(1, radius - RADAR_RIM_INSET);
	const length = math.sqrt(x * x + y * y);
	const edge = length > limit;
	if (edge) { x = (x / length) * limit; y = (y / length) * limit; }
	return { x, y, edge };
}

/** Heading of the player's nose from a FlightMath yaw, in degrees clockwise from world -Z ("north"). */
export function radarHeadingDegrees(yaw: number): number {
	const degrees = -math.deg(FlightMath.WrapAngle(yaw));
	return degrees < 0 ? degrees + 360 : degrees;
}

/** Zooms in while every required contact (and the objective) sits inside the near range. */
export function radarRange(playerX: number, playerZ: number, contacts: RadarContact[]): number {
	let farthest = 0;
	let any = false;
	for (const contact of contacts) {
		if (contact.kind === "missile" || contact.kind === "optional" || contact.kind === "groundOptional") continue;
		any = true;
		const dx = contact.x - playerX, dz = contact.z - playerZ;
		farthest = math.max(farthest, math.sqrt(dx * dx + dz * dz));
	}
	return any && farthest <= RADAR_NEAR_RANGE * 0.9 ? RADAR_NEAR_RANGE : RADAR_RANGE;
}
