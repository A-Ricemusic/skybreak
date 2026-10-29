import { describe, expect, it } from "@rbxts/jest-globals";
import { FlightMath } from "../shared/FlightMath";
import { M01_AIRSPACE } from "../shared/M01Limits";
import {
	M01_CARRIER_MODEL, M01_CARRIER_PLACEMENT, M01_FLYOFF_AHEAD, m01CarrierFlyoffStart, m01CarrierPoint,
} from "../shared/M01CarrierPlan";
import { M01, m01Height } from "../shared/M01WorldPlan";

describe("Dormant M01 carrier placement and fly-off", () => {
	const start = m01CarrierFlyoffStart();
	const catapultEnd = m01CarrierPoint(M01_CARRIER_MODEL.catapultEnd);
	const flight = FlightMath.FromPose(start.x, start.y, start.z, math.rad(start.headingDegrees), 0, start.speed!);
	const [forwardX, , forwardZ] = FlightMath.ForwardOf(flight);

	it("places the carrier at its reserved berth with the waterline at sea level", () => {
		expect(M01_CARRIER_PLACEMENT.x).toBe(M01.carrier.x);
		expect(M01_CARRIER_PLACEMENT.y).toBe(M01.waterY);
		expect(M01_CARRIER_PLACEMENT.z).toBe(M01.carrier.z);
		expect(M01_CARRIER_PLACEMENT.y - M01_CARRIER_MODEL.waterlineAboveKeel).toBe(12);
		expect(m01CarrierPoint({ x: 0, y: M01_CARRIER_MODEL.deckAboveKeel, z: 0 }).y).toBe(66);
	});

	it("starts ahead of the bow catapult, above deck, at the carrier heading", () => {
		const ahead = (start.x - catapultEnd.x) * forwardX + (start.z - catapultEnd.z) * forwardZ;
		expect(start.kind).toBe("carrier_flyoff");
		expect(ahead).toBe(M01_FLYOFF_AHEAD);
		expect(start.y).toBeGreaterThan(catapultEnd.y);
		expect(start.headingDegrees).toBe(M01_CARRIER_PLACEMENT.headingDegrees);
		expect(start.speed).toBe(180);
		expect(flight.yaw).toBe(math.rad(M01_CARRIER_PLACEMENT.headingDegrees));
	});

	it("is inside M01 airspace and clear of terrain for the first four seconds", () => {
		expect(math.abs(start.x)).toBeLessThan(M01_AIRSPACE.hardHalfWidth);
		expect(math.abs(start.z)).toBeLessThan(M01_AIRSPACE.hardHalfWidth);
		for (let seconds = 0; seconds <= 4; seconds += 0.25) {
			const x = start.x + forwardX * start.speed! * seconds;
			const z = start.z + forwardZ * start.speed! * seconds;
			expect(m01Height(x, z)).toBeLessThan(M01.waterY);
			expect(m01Height(x, z) + 48).toBeLessThan(start.y);
		}
	});
});
