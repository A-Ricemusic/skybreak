import { describe, expect, it } from "@rbxts/jest-globals";
import {
	CampaignCoordinator,
	CampaignStore,
	DELETION_EPOCH_CONFLICTS,
	EPOCH_SAVE_VERSION,
	StoredProfile,
	StoredSlot,
	mergeProfiles,
	normalizeProfile,
	profileReadError,
	serializeProfile,
} from "../server/CampaignRepository";

// Coordinators for one user sharing a synthetic store: departing servers' retained writers, the user's new server
// and an older-version server that drops unknown fields. All data is synthetic; no DataStore access, deterministic
// epochs, a frozen clock and hand-driven deferral.

interface Shared {
	data: unknown;
}

/** Slot 1 has old progress (missions 1 and 2) the user is about to delete. */
function seeded(): Shared {
	return {
		data: {
			version: 3,
			slots: {
				"1": { occupied: true, kills: 4, missions: { "1": { completed: true }, "2": { completed: true } } },
			},
		},
	};
}

interface NodeOptions {
	/** Phase-2 conflict rules (off by default, like production). */
	conflicts?: boolean;
	maxAttempts?: number;
}

function node(shared: Shared, label: string, options: NodeOptions = {}) {
	const deferred: (() => void)[] = [];
	let hold: (() => void) | undefined;
	let betweenTransforms: (() => void) | undefined;
	let beforeRetry: (() => void) | undefined;
	let ambiguous = 0;
	let rerunTransform = false;
	let updates = 0;
	const issued: string[] = [];
	const store: CampaignStore = {
		load() {
			return shared.data;
		},
		update(_key, transform) {
			updates++;
			// The held write's UpdateAsync is in flight: its transform runs only after `hold` returns.
			const held = hold;
			hold = undefined;
			held?.();
			// UpdateAsync may invoke the transform more than once; only the last result commits, against whatever
			// the key holds by then.
			if (rerunTransform || betweenTransforms !== undefined) {
				transform(shared.data);
				const between = betweenTransforms;
				betweenTransforms = undefined;
				between?.();
			}
			shared.data = transform(shared.data);
			if (ambiguous > 0) {
				ambiguous--;
				error("synthetic ambiguous failure after the write committed");
			}
			return shared.data;
		},
	};
	const coordinator = new CampaignCoordinator("player_7", store, {
		defer: (callback) => {
			deferred.push(callback);
		},
		writeSpacing: 0,
		maxAttempts: options.maxAttempts ?? 1,
		retryWait: () => {
			const hook = beforeRetry;
			beforeRetry = undefined;
			hook?.();
		},
		warn: () => undefined,
		now: () => 500,
		epochConflicts: options.conflicts,
		newEpoch: () => {
			const id = `${label}${issued.size() + 1}`;
			issued.push(id);
			return id;
		},
	});
	return {
		coordinator,
		issued,
		run: () => {
			while (deferred.size() > 0) deferred.shift()!();
		},
		holdNextWrite: (callback: () => void) => {
			hold = callback;
		},
		changeBetweenTransforms: (callback: () => void) => {
			betweenTransforms = callback;
		},
		beforeRetry: (callback: () => void) => {
			beforeRetry = callback;
		},
		failAmbiguously: (count: number) => {
			ambiguous = count;
		},
		rerunTransforms: () => {
			rerunTransform = true;
		},
		updates: () => updates,
		receipt: (slot = 1) => coordinator.getDeletions().find((deletion) => deletion.slot === slot)?.status,
	};
}

/** An older-version server's ordinary rewrite: it keeps generations and progress but drops the unknown `epoch`. */
function oldServerRewrite(shared: Shared): void {
	// Fault injection for pre-refusal writers: deliberately bypass coordinator read guards.
	const profile = normalizeProfile(shared.data);
	profile.version = 3; // The historical serializer always wrote v3, including on a rewrite.
	for (const slot of profile.slots) slot.epoch = undefined;
	shared.data = serializeProfile(profile);
}

function slot(shared: Shared, index = 1) {
	return normalizeProfile(shared.data).slots[index - 1];
}

function rawEpoch(shared: Shared): unknown {
	const slots = (shared.data as StoredProfile).slots as unknown as Record<string, StoredSlot>;
	return slots["1"].epoch;
}

describe("deletion epoch rollout", () => {
	it("ships phase 1: conflict rules are off by default and equal generations merge as before epochs", () => {
		expect(DELETION_EPOCH_CONFLICTS).toBe(false);
		const shared = seeded();
		const a = node(shared, "A");
		const b = node(shared, "B");
		a.coordinator.load();
		a.coordinator.deleteSlot(1);
		a.coordinator.recordMissionResult(1, 1, true, 6, 90);
		a.holdNextWrite(() => {
			b.coordinator.load();
			b.coordinator.deleteSlot(1);
			b.run();
		});
		a.run();
		// Pre-epoch behaviour (the known F1 case, deferred to phase 2): A's post-deletion progress merges into gen 1.
		// The deleted gen-0 progress (mission 2) never returns, and the stored epoch is kept, not reassigned.
		expect(slot(shared).generation).toBe(1);
		expect(slot(shared).missions?.[1]?.bestTime).toBe(90);
		expect(slot(shared).missions?.[2]).toBeUndefined();
		expect(slot(shared).epoch).toBe("B1");
	});
});

describe("reviewer's mixed-version sequence (independent review of PR #270)", () => {
	for (const conflicts of [false, true])
		it(`never empties a slot holding a durable completion without a newer deletion (phase ${conflicts ? 2 : 1})`, () => {
			const shared: Shared = { data: undefined };
			const a = node(shared, "A", { conflicts });
			const b = node(shared, "B", { conflicts });
			const c = node(shared, "C", { conflicts });
			// 1. A and B load generation 0. A deletes slot 1 and commits gen 1 / A1. C loads that record.
			a.coordinator.load();
			b.coordinator.load();
			a.coordinator.deleteSlot(1);
			a.run();
			expect(slot(shared).epoch).toBe("A1");
			c.coordinator.load();
			// 2. B deletes its still-gen-0 slot (gen 1 / B1), unsaved.
			b.coordinator.deleteSlot(1);
			// 3. An old server rewrites without deleting, dropping A1.
			oldServerRewrite(shared);
			expect(rawEpoch(shared)).toBeUndefined();
			// 4. B saves.
			b.run();
			// 5. A saves an unrelated slot-2 update.
			a.coordinator.recordMissionStarted(2);
			a.run();
			// 6. The old server rewrites again.
			oldServerRewrite(shared);
			// 7. C completes mission 1 in slot 1 and saves: the completion is durable.
			c.coordinator.recordMissionResult(1, 1, true, 6, 88);
			c.run();
			expect(slot(shared).missions?.[1]?.completed).toBe(true);
			// 8. A saves another unrelated slot-2 update. Nobody deleted slot 1 after C completed it.
			a.coordinator.recordMissionStarted(2, 1, "uav");
			a.run();
			const saved = slot(shared);
			expect(saved.occupied).toBe(true);
			expect(saved.missions?.[1]?.completed).toBe(true);
			expect(saved.missions?.[1]?.bestTime).toBe(88);
			expect(slot(shared, 2).occupied).toBe(true);
			expect(a.coordinator.getSlots()[0].missions?.[1]?.completed).toBe(true);
		});

	for (const conflicts of [false, true])
		it(`an epoch this coordinator issued long ago never authorises replacing it later (phase ${conflicts ? 2 : 1})`, () => {
			const shared: Shared = { data: undefined };
			const a = node(shared, "A", { conflicts });
			a.coordinator.load();
			a.coordinator.deleteSlot(1);
			a.run();
			expect(a.receipt()).toBe("confirmed");
			// Another writer's completion lands in A's own old epoch while A holds an unrelated slot-2 change.
			const durable = normalizeProfile(shared.data);
			durable.slots[0].occupied = true;
			durable.slots[0].missions = { 1: { completed: true, bestTime: 61 } };
			shared.data = serializeProfile(durable);
			a.coordinator.recordMissionStarted(2);
			a.run();
			expect(slot(shared).missions?.[1]?.bestTime).toBe(61);
			expect(slot(shared).epoch).toBe("A1");
		});
});

describe("phase-2 conflict rules across two coordinators", () => {
	it("a held delete+progress write cannot resurrect anything over another server's confirmed deletion", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		const b = node(shared, "B", { conflicts: true });
		expect(a.coordinator.load()).toBe(true);
		a.coordinator.deleteSlot(1);
		a.coordinator.recordMissionResult(1, 1, true, 6, 90);
		a.holdNextWrite(() => {
			// The user rejoins elsewhere: B loads the still-persisted generation 0 and deletes slot 1.
			expect(b.coordinator.load()).toBe(true);
			expect(b.coordinator.getSlots()[0].missions?.[2]?.completed).toBe(true);
			b.coordinator.deleteSlot(1);
			b.run();
			expect(b.receipt()).toBe("confirmed");
		});
		a.run();
		const saved = slot(shared);
		expect(saved.generation).toBe(1);
		expect(saved.epoch).toBe("B1");
		expect(saved.occupied).toBe(false);
		expect(saved.kills).toBe(0);
		expect(saved.missions?.[1]).toBeUndefined();
		expect(saved.missions?.[2]).toBeUndefined();
		// A's own tombstone never committed, so it is not reported as confirmed; A adopts the winning record.
		expect(a.receipt()).toBe("failed");
		expect(a.coordinator.hasPendingSave()).toBe(false);
		expect(a.coordinator.getSlots()[0].occupied).toBe(false);
		expect(b.receipt()).toBe("confirmed");
	});

	it("reversed order: a stale-base deletion is refused rather than merged, then a re-delete from what it saw wins", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		const b = node(shared, "B", { conflicts: true });
		expect(b.coordinator.load()).toBe(true);
		expect(a.coordinator.load()).toBe(true);
		a.coordinator.deleteSlot(1);
		a.coordinator.recordMissionResult(1, 1, true, 6, 90);
		a.run();
		expect(slot(shared).epoch).toBe("A1");

		b.coordinator.deleteSlot(1);
		b.run();
		const saved = slot(shared);
		expect(saved.epoch).toBe("A1");
		expect(saved.missions?.[1]?.bestTime).toBe(90);
		expect(saved.missions?.[2]).toBeUndefined();
		expect(b.receipt()).toBe("failed");
		expect(b.coordinator.getSlots()[0].missions?.[1]?.bestTime).toBe(90);

		b.coordinator.deleteSlot(1);
		b.run();
		expect(b.receipt()).toBe("confirmed");
		expect(slot(shared).generation).toBe(2);
		expect(slot(shared).epoch).toBe("B2");
		expect(slot(shared).occupied).toBe(false);
	});

	it("a writer that deleted twice locally cannot outrank another server's confirmed deletion by generation", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		const b = node(shared, "B", { conflicts: true });
		a.coordinator.load();
		a.coordinator.deleteSlot(1);
		a.coordinator.deleteSlot(1);
		a.coordinator.recordMissionResult(1, 1, true, 6, 90);
		expect(a.coordinator.getSlots()[0].generation).toBe(2);
		a.holdNextWrite(() => {
			b.coordinator.load();
			b.coordinator.deleteSlot(1);
			b.run();
		});
		a.run();
		expect(slot(shared).generation).toBe(1);
		expect(slot(shared).epoch).toBe("B1");
		expect(slot(shared).occupied).toBe(false);
		expect(b.receipt()).toBe("confirmed");
	});

	it("a double delete on one server still replaces its own base", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		a.coordinator.load();
		a.coordinator.deleteSlot(1);
		a.coordinator.deleteSlot(1);
		a.run();
		expect(a.receipt()).toBe("confirmed");
		expect(slot(shared).generation).toBe(2);
		expect(slot(shared).epoch).toBe("A2");
		expect(slot(shared).missions?.[2]).toBeUndefined();
	});

	it("progress recorded after the winning deletion survives a late competing write", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		const b = node(shared, "B", { conflicts: true });
		a.coordinator.load();
		b.coordinator.load();
		b.coordinator.deleteSlot(1);
		b.run();
		b.coordinator.recordMissionResult(1, 1, true, 6, 120);
		b.run();
		a.coordinator.deleteSlot(1);
		a.coordinator.recordMissionResult(1, 1, true, 6, 80);
		a.run();
		let saved = slot(shared);
		expect(saved.epoch).toBe("B1");
		expect(saved.missions?.[1]?.bestTime).toBe(120);
		expect(saved.missions?.[2]).toBeUndefined();
		expect(a.coordinator.getSlots()[0].missions?.[1]?.bestTime).toBe(120);
		b.coordinator.recordMissionResult(1, 2, true, 6, 150);
		b.run();
		saved = slot(shared);
		expect(saved.epoch).toBe("B1");
		expect(saved.missions?.[1]?.bestTime).toBe(120);
		expect(saved.missions?.[2]?.bestTime).toBe(150);
		expect(b.receipt()).toBe("confirmed");
	});

	it("a coordinator that never deleted adopts another server's committed deletion over its stale progress", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		const b = node(shared, "B", { conflicts: true });
		a.coordinator.load();
		b.coordinator.load();
		b.coordinator.deleteSlot(1);
		b.run();
		a.coordinator.recordMissionResult(1, 3, true, 6, 70);
		a.run();
		expect(slot(shared).epoch).toBe("B1");
		expect(slot(shared).occupied).toBe(false);
		expect(slot(shared).missions?.[3]).toBeUndefined();
	});

	it("progress over an epoch-less rewrite of the same generation merges and keeps the record epoch-less", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		a.coordinator.load();
		a.coordinator.deleteSlot(1);
		a.run();
		oldServerRewrite(shared);
		const older = normalizeProfile(shared.data);
		older.slots[0].missions = { 1: { completed: true, bestTime: 77 } };
		older.slots[0].occupied = true;
		shared.data = serializeProfile(older);
		a.coordinator.recordMissionResult(1, 2, true, 6, 95);
		a.run();
		const saved = slot(shared);
		expect(saved.epoch).toBeUndefined();
		expect(saved.missions?.[1]?.bestTime).toBe(77);
		expect(saved.missions?.[2]?.bestTime).toBe(95);
	});

	it("a deletion whose base was stripped by an old server is refused, then succeeds from the record it adopted", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		a.coordinator.load();
		a.coordinator.deleteSlot(1);
		a.run();
		a.coordinator.recordMissionResult(1, 1, true, 6, 90);
		a.run();
		oldServerRewrite(shared);
		a.coordinator.deleteSlot(1);
		a.run();
		expect(a.receipt()).toBe("failed");
		expect(slot(shared).missions?.[1]?.bestTime).toBe(90);
		a.coordinator.deleteSlot(1);
		a.run();
		expect(a.receipt()).toBe("confirmed");
		expect(slot(shared).occupied).toBe(false);
		expect(slot(shared).generation).toBe(2);
	});
});

describe("deletion epoch idempotency", () => {
	for (const conflicts of [false, true])
		it(`repeated transform invocation reuses one epoch and one generation (phase ${conflicts ? 2 : 1})`, () => {
			const shared = seeded();
			const a = node(shared, "A", { conflicts });
			a.rerunTransforms();
			a.coordinator.load();
			a.coordinator.deleteSlot(1);
			a.run();
			expect(a.issued.size()).toBe(1);
			expect(slot(shared).generation).toBe(1);
			expect(slot(shared).epoch).toBe("A1");
			expect(a.receipt()).toBe("confirmed");
			a.coordinator.recordMissionResult(1, 1, true, 6, 90);
			a.run();
			expect(a.issued.size()).toBe(1);
			expect(slot(shared).generation).toBe(1);
			expect(slot(shared).missions?.[1]?.bestTime).toBe(90);
			const committed = normalizeProfile(shared.data);
			expect(mergeProfiles(committed, committed)).toEqual(committed);
		});

	it("a transform re-run that sees another server's deletion committed in between resolves against it", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		const b = node(shared, "B", { conflicts: true });
		a.coordinator.load();
		b.coordinator.load();
		a.coordinator.deleteSlot(1);
		a.coordinator.recordMissionResult(1, 1, true, 6, 90);
		a.changeBetweenTransforms(() => {
			b.coordinator.deleteSlot(1);
			b.run();
		});
		a.run();
		expect(a.issued.size()).toBe(1);
		expect(b.receipt()).toBe("confirmed");
		expect(a.receipt()).toBe("failed");
		const saved = slot(shared);
		expect(saved.epoch).toBe("B1");
		expect(saved.occupied).toBe(false);
		expect(saved.missions?.[2]).toBeUndefined();
	});

	for (const conflicts of [false, true])
		it(`an automatic retry after an ambiguous write confirms the same tombstone (phase ${conflicts ? 2 : 1})`, () => {
			const shared = seeded();
			const a = node(shared, "A", { conflicts, maxAttempts: 2 });
			a.coordinator.load();
			a.coordinator.deleteSlot(1);
			a.failAmbiguously(1);
			a.run();
			expect(a.updates()).toBe(2);
			expect(a.issued.size()).toBe(1);
			expect(slot(shared).generation).toBe(1);
			expect(slot(shared).epoch).toBe("A1");
			expect(slot(shared).occupied).toBe(false);
			expect(a.receipt()).toBe("confirmed");
		});

	for (const conflicts of [false, true])
		it(`an ambiguous write followed by another server's deletion never resurrects (phase ${conflicts ? 2 : 1})`, () => {
			const shared = seeded();
			const a = node(shared, "A", { conflicts, maxAttempts: 2 });
			const b = node(shared, "B", { conflicts });
			a.coordinator.load();
			a.coordinator.deleteSlot(1);
			a.coordinator.recordMissionResult(1, 1, true, 6, 90);
			a.failAmbiguously(1);
			a.beforeRetry(() => {
				// A's write committed but reported failure; before its retry B loads that record, deletes, and records.
				b.coordinator.load();
				expect(b.coordinator.getSlots()[0].missions?.[1]?.bestTime).toBe(90);
				b.coordinator.deleteSlot(1);
				b.run();
				b.coordinator.recordMissionResult(1, 1, true, 6, 130);
				b.run();
			});
			a.run();
			expect(a.issued.size()).toBe(1);
			const saved = slot(shared);
			expect(saved.generation).toBe(2);
			expect(saved.epoch).toBe("B1");
			expect(saved.missions?.[1]?.bestTime).toBe(130);
			expect(saved.missions?.[2]).toBeUndefined();
			expect(b.receipt()).toBe("confirmed");
		});

	it("a recovery retry after an ambiguous write keeps the epoch and the progress recorded after it", () => {
		const shared = seeded();
		const a = node(shared, "A", { conflicts: true });
		a.coordinator.load();
		a.coordinator.deleteSlot(1);
		a.coordinator.recordMissionResult(1, 1, true, 6, 90);
		a.failAmbiguously(1);
		a.run();
		expect(a.coordinator.hasPendingSave()).toBe(true);
		expect(a.coordinator.recover()).toBe(true);
		expect(a.issued.size()).toBe(1);
		const saved = slot(shared);
		expect(saved.generation).toBe(1);
		expect(saved.epoch).toBe("A1");
		expect(saved.missions?.[1]?.bestTime).toBe(90);
		expect(saved.missions?.[2]).toBeUndefined();
	});
});

describe("deletion epoch storage compatibility", () => {
	it("persists the epoch as one optional string field and keeps it off the client slots", () => {
		const shared = seeded();
		const a = node(shared, "A");
		a.coordinator.load();
		a.coordinator.deleteSlot(1);
		a.run();
		expect(rawEpoch(shared)).toBe("A1");
		expect(a.coordinator.getSlots()[0].epoch).toBeUndefined();
		expect(a.coordinator.getSlots()[0].generation).toBe(1);
	});

	it("phase 1 preserves the epoch through later progress and never assigns one to an epoch-less record", () => {
		const shared = seeded();
		const a = node(shared, "A");
		a.coordinator.load();
		a.coordinator.deleteSlot(1);
		a.run();
		a.coordinator.recordMissionResult(1, 1, true, 6, 90);
		a.run();
		expect(rawEpoch(shared)).toBe("A1");
		oldServerRewrite(shared);
		a.coordinator.recordMissionResult(1, 2, true, 6, 95);
		a.run();
		expect(rawEpoch(shared)).toBeUndefined();
		expect(slot(shared).missions?.[1]?.bestTime).toBe(90);
		expect(slot(shared).missions?.[2]?.bestTime).toBe(95);
	});

	it("loads pre-epoch saves unchanged and ignores a malformed epoch field", () => {
		const legacy = normalizeProfile({ version: 3, slots: { "1": { occupied: true, generation: 2 } } });
		expect(legacy.slots[0].generation).toBe(2);
		expect(legacy.slots[0].epoch).toBeUndefined();
		for (const epoch of [42, "", "x".rep(65), { id: "nested" }]) {
			const profile = normalizeProfile({ version: 3, slots: { "1": { occupied: true, generation: 2, epoch } } });
			expect(profile.slots[0].generation).toBe(2);
			expect(profile.slots[0].epoch).toBeUndefined();
		}
	});

	it("pure merges keep the pre-epoch rules: higher generation replaces, equal generation merges", () => {
		const left = { version: 3, slots: { "1": { generation: 1, epoch: "left", occupied: true, kills: 3 } } };
		const right = { version: 3, slots: { "1": { generation: 1, epoch: "right" } } };
		expect(mergeProfiles(left, right).slots[0].epoch).toBe("left");
		expect(mergeProfiles(left, right).slots[0].kills).toBe(3);
		expect(mergeProfiles(right, left).slots[0].epoch).toBe("right");
		expect(mergeProfiles(right, left).slots[0].kills).toBe(3);
		const newer = { version: 3, slots: { "1": { generation: 2, epoch: "newer" } } };
		expect(mergeProfiles(left, newer).slots[0].epoch).toBe("newer");
		expect(mergeProfiles(left, newer).slots[0].occupied).toBe(false);
		expect(mergeProfiles(newer, left).slots[0].epoch).toBe("newer");
	});
});

describe("phase-2 schema fence (staged; production flag remains off)", () => {
	it("leaves flag-off saves at v3 and stamps v4 on the first ordinary conflict-on write", () => {
		const shared = seeded();
		const off = node(shared, "off");
		off.coordinator.load();
		off.coordinator.recordMissionStarted(2);
		off.run();
		expect((shared.data as StoredProfile).version).toBe(3);
		const on = node(shared, "on", { conflicts: true });
		on.coordinator.load();
		on.coordinator.recordMissionStarted(2);
		on.run();
		expect((shared.data as StoredProfile).version).toBe(EPOCH_SAVE_VERSION);
		expect(slot(shared).missions?.[2]?.completed).toBe(true);
	});

	it("fences the reviewer's retained flag-off double-delete before it can empty durable on-writer progress", () => {
		const shared = seeded();
		const off = node(shared, "off", { maxAttempts: 3 });
		const on = node(shared, "on", { conflicts: true });
		off.coordinator.load();
		off.coordinator.deleteSlot(1);
		off.coordinator.deleteSlot(1);
		on.coordinator.load();
		on.coordinator.deleteSlot(1);
		on.run();
		on.coordinator.recordMissionResult(1, 1, true, 6, 91);
		on.run();
		const durable = shared.data;
		off.run();
		expect(shared.data).toBe(durable);
		expect(slot(shared).missions?.[1]?.bestTime).toBe(91);
		expect(off.updates()).toBe(1); // schema refusal is never automatically retried
		expect(off.receipt()).toBe("failed");
		expect(off.coordinator.hasCloudLoaded()).toBe(false);
		expect(off.coordinator.getPersistence()).toBe("unavailable");
		expect(off.coordinator.recover()).toBe(false);
		expect(off.coordinator.flush(0)).toBe(false);
		expect(shared.data).toBe(durable);
	});

	it("a flag-off transform rerun refuses a v4 fence committed after its first invocation", () => {
		const shared = seeded();
		const off = node(shared, "off");
		const on = node(shared, "on", { conflicts: true });
		off.coordinator.load();
		on.coordinator.load();
		off.coordinator.deleteSlot(1);
		off.coordinator.deleteSlot(1);
		off.changeBetweenTransforms(() => {
			on.coordinator.deleteSlot(1);
			on.coordinator.recordMissionResult(1, 1, true, 6, 92);
			on.run();
		});
		off.run();
		expect(off.coordinator.hasCloudLoaded()).toBe(false);
		expect(slot(shared).epoch).toBe("on1");
		expect(slot(shared).missions?.[1]?.bestTime).toBe(92);
	});

	it("an off writer that commits first is respected by the on writer's stale pending deletion", () => {
		const shared = seeded();
		const off = node(shared, "off");
		const on = node(shared, "on", { conflicts: true });
		off.coordinator.load();
		on.coordinator.load();
		on.coordinator.deleteSlot(1);
		off.coordinator.deleteSlot(1);
		off.coordinator.recordMissionResult(1, 1, true, 6, 93);
		off.run();
		on.run();
		expect(on.receipt()).toBe("failed");
		expect(slot(shared).epoch).toBe("off1");
		expect(slot(shared).missions?.[1]?.bestTime).toBe(93);
		expect((shared.data as StoredProfile).version).toBe(EPOCH_SAVE_VERSION);
		// Its next unrelated write cannot downgrade the fenced profile.
		off.coordinator.recordMissionStarted(2);
		off.run();
		expect(off.coordinator.hasCloudLoaded()).toBe(false);
		expect(slot(shared).missions?.[1]?.bestTime).toBe(93);
	});

	it("on rejoin resumes v4 progress while off rejoin is unavailable and cannot write a blank", () => {
		const shared = seeded();
		const on = node(shared, "on", { conflicts: true });
		on.coordinator.load();
		on.coordinator.deleteSlot(1);
		on.run();
		on.coordinator.recordMissionResult(1, 1, true, 6, 94);
		on.run();
		const durable = shared.data;
		const offRejoin = node(shared, "off-rejoin");
		expect(offRejoin.coordinator.load()).toBe(false);
		offRejoin.coordinator.deleteSlot(1);
		offRejoin.coordinator.recordMissionStarted(1);
		offRejoin.run();
		expect(offRejoin.updates()).toBe(0);
		expect(shared.data).toBe(durable);
		const rejoin = node(shared, "rejoin", { conflicts: true });
		expect(rejoin.coordinator.load()).toBe(true);
		expect(rejoin.coordinator.getSlots()[0].missions?.[1]?.bestTime).toBe(94);
		rejoin.coordinator.recordMissionResult(1, 2, true, 6, 95);
		rejoin.run();
		expect(slot(shared).epoch).toBe("on1");
		expect(slot(shared).missions?.[1]?.bestTime).toBe(94);
		expect(slot(shared).missions?.[2]?.bestTime).toBe(95);
	});

	it("an ambiguous first v4 write retries idempotently without weakening the fence", () => {
		const shared = seeded();
		const on = node(shared, "on", { conflicts: true, maxAttempts: 2 });
		const off = node(shared, "off");
		off.coordinator.load();
		off.coordinator.deleteSlot(1);
		off.coordinator.deleteSlot(1);
		on.coordinator.load();
		on.coordinator.deleteSlot(1);
		on.failAmbiguously(1);
		on.beforeRetry(() => off.run());
		on.run();
		expect(on.issued.size()).toBe(1);
		expect(on.receipt()).toBe("confirmed");
		expect(off.receipt()).toBe("failed");
		expect(slot(shared).epoch).toBe("on1");
		expect((shared.data as StoredProfile).version).toBe(EPOCH_SAVE_VERSION);
	});

	it("does not claim safety against a legacy writer that ignores schema refusals; drain stays mandatory", () => {
		const shared = seeded();
		const stale = normalizeProfile(shared.data);
		stale.slots[0] = normalizeProfile({ version: 3, slots: { "1": { generation: 2 } } }).slots[0];
		const on = node(shared, "on", { conflicts: true });
		on.coordinator.load();
		on.coordinator.deleteSlot(1);
		on.coordinator.recordMissionResult(1, 1, true, 6, 96);
		on.run();
		expect(slot(shared).missions?.[1]?.bestTime).toBe(96);
		// Deliberate model of pre-refusal code, NOT a permitted CampaignCoordinator write: generation-only
		// replacement followed by its historical v3 serializer can still destroy this record and its fence.
		const unsafe = mergeProfiles(shared.data, stale);
		unsafe.version = 3;
		shared.data = serializeProfile(unsafe);
		expect(slot(shared).missions?.[1]).toBeUndefined();
		expect((shared.data as StoredProfile).version).toBe(3);
		expect(DELETION_EPOCH_CONFLICTS).toBe(false);
	});

	it("does not let conflict support bypass v4 structure validation", () => {
		for (const data of [
			{ version: EPOCH_SAVE_VERSION },
			{ version: EPOCH_SAVE_VERSION, slots: "broken" },
			{ version: EPOCH_SAVE_VERSION, slots: { "1": { missions: "broken" } } },
		]) {
			const shared: Shared = { data };
			const on = node(shared, "on", { conflicts: true });
			expect(on.coordinator.load()).toBe(false);
			on.coordinator.recordMissionStarted(1);
			on.run();
			expect(on.updates()).toBe(0);
			expect(shared.data).toBe(data);
		}
	});

	it("preserves the schema fence through normalize, serialize and both pure merge directions", () => {
		const shared = seeded();
		const legacy = shared.data;
		const on = node(shared, "on", { conflicts: true });
		on.coordinator.load();
		on.coordinator.recordMissionStarted(2);
		on.run();
		expect(profileReadError(shared.data)).toBeDefined();
		expect(profileReadError(shared.data, true)).toBeUndefined();
		expect(serializeProfile(normalizeProfile(shared.data)).version).toBe(EPOCH_SAVE_VERSION);
		expect(serializeProfile(mergeProfiles(legacy, shared.data)).version).toBe(EPOCH_SAVE_VERSION);
		expect(serializeProfile(mergeProfiles(shared.data, legacy)).version).toBe(EPOCH_SAVE_VERSION);
		expect(profileReadError({ version: 5, slots: {} }, true)).toBeDefined();
	});
});
