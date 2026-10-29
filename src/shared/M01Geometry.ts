export const M01_WORLD_KEY = "m01_sea_island";
export const M01 = {
	half: 16384, scale: 0.96, waterY: 32, bottom: -32,
	islandWidth: 3840, islandLength: 9600, islandZ: -600,
	coarse: 256, detail: 64, corridorHalf: 768,
	city: { x: 1280, z: 256, hx: 448, hz: 768 },
	airbase: { x: -1280, z: -3200, hx: 448, hz: 1536 },
	start: { x: 0, z: 10000, y: 622 },
	carrier: { x: 0, z: 11200, hx: 512, hz: 768 },
	launch: { x: 0, z: 9600, hx: 384, hz: 1600 },
	// Shared encounter route and terrain reservation: city, airbase, then just past the north coast.
	route: [[0, 8200], [512, 4200], [1280, 256], [-1280, -3200], [-1280, -5600]],
	routeFloor: 622, routeCeiling: 832,
	budget: { props: 240, parts: 340, descendants: 1300, voxelWrites: 260e6, jobs: 30000 },
};
