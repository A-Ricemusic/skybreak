import { describe, expect, it } from "@rbxts/jest-globals";
import { INPUT_STAMP_RESET_WINDOW, InputStamp } from "../shared/InputStamp";

// Pure staleness rule for unreliable FlightInput stamps; also runs in the offline Luau VM.
describe("InputStamp.Decide", () => {
	it("treats missing, non-finite and non-positive stamps as unstamped", () => {
		for (const value of [undefined, "1", 0, -1, 0 / 0, math.huge, -math.huge]) {
			expect(InputStamp.Decide(5, value).kind).toBe("unstamped");
		}
	});
	it("accepts in-order stamps and advances the floor, dropping reordered older packets", () => {
		let floor = 0;
		for (const stamp of [0.025, 0.05, 0.075]) {
			const decision = InputStamp.Decide(floor, stamp);
			expect(decision.kind).toBe("accept");
			if (decision.kind === "accept") {
				expect(decision.reset).toBe(false);
				expect(decision.floor).toBe(stamp);
				floor = decision.floor;
			}
		}
		expect(InputStamp.Decide(floor, 0.05).kind).toBe("stale");
		expect(InputStamp.Decide(floor, 0.0749).kind).toBe("stale");
	});
	it("accepts an equal stamp so the first send after a resume reuses the frozen one", () => {
		const decision = InputStamp.Decide(12.5, 12.5);
		expect(decision.kind).toBe("accept");
		if (decision.kind === "accept") {
			expect(decision.floor).toBe(12.5);
			expect(decision.reset).toBe(false);
		}
	});
	it("does not let one huge stamp freeze later packets", () => {
		const poisoned = InputStamp.Decide(3, 1e300);
		expect(poisoned.kind).toBe("accept");
		const floor = poisoned.kind === "accept" ? poisoned.floor : 0;
		// The next honest stamp is far behind the poisoned floor: a clock reset, not a stale packet.
		const recovered = InputStamp.Decide(floor, 3.025);
		expect(recovered.kind).toBe("accept");
		if (recovered.kind === "accept") {
			expect(recovered.reset).toBe(true);
			expect(recovered.floor).toBe(3.025);
		}
		// Ordering resumes normally from the re-based floor.
		expect(InputStamp.Decide(3.025, 3.05).kind).toBe("accept");
		expect(InputStamp.Decide(3.05, 3.025).kind).toBe("stale");
	});
	it("re-bases on a forward jump beyond the window but keeps staleness inside it", () => {
		const jump = InputStamp.Decide(10, 10 + INPUT_STAMP_RESET_WINDOW + 0.001);
		expect(jump.kind).toBe("accept");
		if (jump.kind === "accept") expect(jump.reset).toBe(true);
		const inside = InputStamp.Decide(10, 10 + INPUT_STAMP_RESET_WINDOW);
		expect(inside.kind).toBe("accept");
		if (inside.kind === "accept") expect(inside.reset).toBe(false);
		// Backward within the window is still a reordered packet.
		expect(InputStamp.Decide(200, 200 - INPUT_STAMP_RESET_WINDOW).kind).toBe("stale");
		expect(InputStamp.Decide(200, 200 - INPUT_STAMP_RESET_WINDOW - 0.001).kind).toBe("accept");
	});
	it("accepts the first stamp of a sortie whatever its value", () => {
		for (const stamp of [0.001, 5000, 1e12]) {
			const decision = InputStamp.Decide(0, stamp);
			expect(decision.kind).toBe("accept");
			if (decision.kind === "accept") expect(decision.reset).toBe(false);
		}
	});
});
