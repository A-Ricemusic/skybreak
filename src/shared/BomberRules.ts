/** Pure, absolute-time formation motion. No instances, services, targeting or weapon state. */
export interface BomberPoint { x: number; y: number; z: number }
export interface BomberSlotPose { position: BomberPoint; facing: BomberPoint }
export interface BomberFormationPose {
	slots: BomberSlotPose[];
	/** Zero-based leg; at an interior waypoint the outgoing leg owns the boundary. */
	leg: number;
	distanceRemaining: number;
	escaped: boolean;
}
interface Curve { a: BomberPoint; b: BomberPoint; m: BomberPoint; n: BomberPoint; distances: number[]; length: number }
export interface BomberRoute {
	readonly curves: readonly Curve[];
	readonly slots: readonly BomberPoint[];
	readonly speed: number;
	readonly length: number;
	readonly duration: number;
}
const add = (a: BomberPoint, b: BomberPoint): BomberPoint => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a: BomberPoint, s: number): BomberPoint => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const sub = (a: BomberPoint, b: BomberPoint) => add(a, mul(b, -1));
const dot = (a: BomberPoint, b: BomberPoint) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: BomberPoint) => math.sqrt(dot(a, a));
const unit = (a: BomberPoint) => mul(a, 1 / length(a));
const cross = (a: BomberPoint, b: BomberPoint): BomberPoint => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const finite = (n: number) => n === n && math.abs(n) < math.huge;
function checkPoint(p: BomberPoint): void { assert(finite(p.x) && finite(p.y) && finite(p.z), "BomberRules: nonfinite point"); }
function curveAt(c: Curve, t: number, derivative = false): BomberPoint {
	const t2 = t * t, t3 = t2 * t;
	const a = derivative ? 6 * t2 - 6 * t : 2 * t3 - 3 * t2 + 1;
	const b = derivative ? -6 * t2 + 6 * t : -2 * t3 + 3 * t2;
	const m = derivative ? 3 * t2 - 4 * t + 1 : t3 - 2 * t2 + t;
	const n = derivative ? 3 * t2 - 2 * t : t3 - t2;
	return add(add(mul(c.a, a), mul(c.b, b)), add(mul(c.m, m), mul(c.n, n)));
}
const SAMPLES = 256;
const DEFAULT_SPEED = 200;
const DEFAULT_SLOTS: readonly BomberPoint[] = [
	{ x: -180, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 180, y: 0, z: 0 },
	{ x: -90, y: 0, z: 220 }, { x: 90, y: 0, z: 220 }, { x: 270, y: 0, z: 220 },
];
export const BomberRules = {
	/** World spec m01 §2: 173–266 m/s × 0.96 ≈ 166–255 studs/s; above player cruise 160. */
	DefaultSpeed: DEFAULT_SPEED,
	Role: { role: "bomber", movement: "route", canFire: false, canDogfight: false } as const,
	/** Two staggered three-ship rows. Local x = right, y = up, z = aft (Roblox nose -Z).
	 * 180 lateral / 220 longitudinal studs leave generous clearance for a 72-stud span.
	 * Authored assumption, not a measured reference formation. */
	DefaultSlots: DEFAULT_SLOTS,
	/** Compile once, sample many times. C1 cubic Hermite curves pass through every waypoint.
	 * Arc length uses a fixed 256-chord table per leg: deterministic approximate constant speed
	 * on curves, independent of caller frame rate. Gentle aircraft
	 * routes only: no duplicate points, vertical legs or reversing horizontal headings.
	 * Curves can bow outside the waypoint envelope; E2/world authors must audit clearance. */
	Create(waypoints: readonly BomberPoint[], speed = DEFAULT_SPEED, slots: readonly BomberPoint[] = DEFAULT_SLOTS): BomberRoute {
		assert(waypoints.size() >= 2 && slots.size() > 0, "BomberRules: route needs two points and a slot");
		assert(finite(speed) && speed > 0, "BomberRules: invalid speed");
		for (const p of waypoints) checkPoint(p);
		for (const p of slots) checkPoint(p);
		const deltas: BomberPoint[] = [], lengths: number[] = [];
		for (let i = 0; i < waypoints.size() - 1; i++) {
			const d = sub(waypoints[i + 1], waypoints[i]);
			assert(d.x * d.x + d.z * d.z > 0.000001, "BomberRules: duplicate/vertical leg");
			deltas.push(d); lengths.push(length(d));
		}
		const tangents = [deltas[0]];
		for (let i = 1; i < waypoints.size() - 1; i++) {
			const a = deltas[i - 1], b = deltas[i];
			assert(a.x * b.x + a.z * b.z >= 0, "BomberRules: turn exceeds 90 degrees; add waypoints");
			tangents.push(mul(unit(add(unit(a), unit(b))), math.min(lengths[i - 1], lengths[i])));
		}
		tangents.push(deltas[deltas.size() - 1]);
		const curves: Curve[] = [];
		let total = 0;
		for (let i = 0; i < deltas.size(); i++) {
			const c: Curve = { a: { ...waypoints[i] }, b: { ...waypoints[i + 1] }, m: tangents[i], n: tangents[i + 1], distances: [0], length: 0 };
			let previous = c.a;
			for (let j = 1; j <= SAMPLES; j++) {
				const p = curveAt(c, j / SAMPLES);
				c.length += length(sub(p, previous)); c.distances.push(c.length); previous = p;
			}
			curves.push(c); total += c.length;
		}
		return { curves, slots: slots.map((p) => ({ ...p })), speed, length: total, duration: total / speed };
	},
	/** t <= 0 holds the start. At t >= duration escape is true and poses hold the endpoint.
	 * Escape refers to the formation origin, not each trailing slot: E2 supplies the north-end
	 * endpoint and decides mission failure (D-024 provisional). Slot spacing is rigid through turns;
	 * individual outer slots therefore have different instantaneous speeds from the origin. */
	Sample(route: BomberRoute, time: number): BomberFormationPose {
		assert(finite(time), "BomberRules: invalid time");
		const escaped = time >= route.duration;
		const traveled = escaped ? route.length : math.clamp(time * route.speed, 0, route.length);
		let distance = traveled, leg = 0;
		while (leg < route.curves.size() - 1 && distance >= route.curves[leg].length) {
			distance -= route.curves[leg].length; leg++;
		}
		const c = route.curves[leg];
		let low = 0, high = SAMPLES;
		while (high - low > 1) {
			const mid = math.floor((low + high) / 2);
			if (c.distances[mid] <= distance) low = mid; else high = mid;
		}
		const t = (low + math.clamp((distance - c.distances[low]) / (c.distances[high] - c.distances[low]), 0, 1)) / SAMPLES;
		const position = curveAt(c, t), facing = unit(curveAt(c, t, true));
		const right = unit(cross(facing, { x: 0, y: 1, z: 0 })), up = cross(right, facing);
		return {
			slots: route.slots.map((s) => ({ position: add(position, add(add(mul(right, s.x), mul(up, s.y)), mul(facing, -s.z))), facing: { ...facing } })),
			leg, distanceRemaining: route.length - traveled, escaped,
		};
	},
};
