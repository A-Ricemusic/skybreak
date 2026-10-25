import { describe, expect, it } from "@rbxts/jest-globals";
import { LoadingGate } from "../shared/LoadingGate";

describe("LoadingGate", () => {
	it("holds until the client is ready, then releases exactly once", () => {
		const gate = LoadingGate.New(100);
		expect(LoadingGate.ShouldRelease(gate, 100)).toBe(false);
		expect(LoadingGate.ShouldRelease(gate, 107.9)).toBe(false);
		LoadingGate.MarkReady(gate);
		expect(LoadingGate.ShouldRelease(gate, 101)).toBe(true);
		expect(LoadingGate.Release(gate, 101)).toBe(true);
		expect(LoadingGate.Release(gate, 102)).toBe(false);
		expect(gate.released).toBe(true);
	});
	it("releases on the timeout when the client never answers", () => {
		const gate = LoadingGate.New(50);
		expect(LoadingGate.Release(gate, 50 + LoadingGate.Timeout - 0.01)).toBe(false);
		expect(LoadingGate.Release(gate, 50 + LoadingGate.Timeout)).toBe(true);
		expect(LoadingGate.Release(gate, 60)).toBe(false);
	});
	it("honours a custom timeout and rejects a bad clock", () => {
		const gate = LoadingGate.New(10, 2);
		expect(gate.deadline).toBe(12);
		expect(() => LoadingGate.New(math.huge)).toThrow();
		expect(() => LoadingGate.New(1, -1)).toThrow();
	});
	it("reports replication progress as a clamped fraction", () => {
		expect(LoadingGate.Progress(0, 400)).toBe(0);
		expect(LoadingGate.Progress(100, 400)).toBeCloseTo(0.25, 6);
		expect(LoadingGate.Progress(900, 400)).toBe(1);
		expect(LoadingGate.Progress(12, undefined)).toBe(1);
		expect(LoadingGate.Progress(12, 0)).toBe(1);
		expect(LoadingGate.Progress(-3, 10)).toBe(0);
	});
});
