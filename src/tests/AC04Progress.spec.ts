import { describe, expect, it } from "@rbxts/jest-globals";
import { AC04_RELEASE_MISSION_CEILING, ac04BlankProfile, ac04InitialReleaseComplete, ac04Merge, ac04MissionAvailable, ac04Normalize, ac04Readable, ac04ReleaseDestination, ac04Unlocked } from "../shared/AC04Progress";
import { AC04MissionData } from "../shared/AC04MissionData";
describe("AC04 independent flight records",()=>{
	it("fresh records have no legacy completion or seen state",()=>{
		const profile=ac04BlankProfile();expect(profile.slots.size()).toBe(4);
		for(const slot of profile.slots){expect(ac04Unlocked(slot)).toBe(1);expect(slot.seen.size()).toBe(0);}
	});
	it("progress is sequential and records are isolated",()=>{
		const p=ac04BlankProfile();p.slots[0].missions[2]={completed:true,bestScore:100,bestTime:20};expect(ac04Unlocked(p.slots[0])).toBe(1);
		p.slots[0].missions[1]={completed:true,bestScore:100,bestTime:20};expect(ac04Unlocked(p.slots[0])).toBe(3);expect(ac04Unlocked(p.slots[1])).toBe(1);
	});
	it("caps the initial release at M5 while keeping completed missions replayable",()=>{
		const slot=ac04BlankProfile().slots[0];
		for(let id=1;id<=5;id++){
			expect(ac04MissionAvailable(id)).toBe(true);
			slot.missions[id]={completed:true,bestScore:id*100,bestTime:20};
		}
		expect(AC04_RELEASE_MISSION_CEILING).toBe(5);expect(ac04InitialReleaseComplete(slot)).toBe(true);
		expect(ac04Unlocked(slot)).toBe(6);expect(ac04ReleaseDestination(slot)).toBe(5);
		for(let id=1;id<=5;id++)expect(ac04MissionAvailable(id)).toBe(true);
	});
	it("rejects forged M6-M18 launch ids without discarding future records",()=>{
		const profile=ac04BlankProfile(),slot=profile.slots[0];
		for(let id=6;id<=18;id++)expect(ac04MissionAvailable(id)).toBe(false);
		slot.missions[6]={completed:true,bestScore:900,bestTime:40};
		const normalized=ac04Normalize(profile);
		expect(normalized.slots[0].missions[6].completed).toBe(true);
		expect(ac04Merge(normalized,ac04BlankProfile()).slots[0].missions[6].bestScore).toBe(900);
	});
	it("cloud merge preserves both concurrent servers' completions and the best result",()=>{
		const a=ac04BlankProfile(),b=ac04BlankProfile();a.slots[0].missions[1]={completed:true,bestScore:600,bestTime:200};b.slots[0].missions[1]={completed:true,bestScore:700,bestTime:210};b.slots[0].missions[2]={completed:true,bestScore:1000,bestTime:90};
		a.slots[0].seen=["ac04-i01"];b.slots[0].seen=["ac04-i02"];
		const merged=ac04Merge(a,b).slots[0];expect(merged.missions[1].bestScore).toBe(700);expect(merged.missions[1].bestTime).toBe(200);expect(merged.missions[2].completed).toBe(true);expect(merged.seen.size()).toBe(2);
	});
	it("invalid and foreign chapter identifiers are discarded",()=>{
		const p=ac04BlankProfile();p.slots[0].seen=["ac04-i00","ac04-i99","ac04-i01","ac04-i01","relay-1"];
		const out=ac04Normalize(p);expect(out.slots[0].seen).toEqual(["ac04-i01"]);
	});
	it("long AC04 mission results are not clamped to Broken Relay's 900 seconds",()=>{
		const p=ac04BlankProfile();p.slots[0].missions[18]={completed:true,bestScore:4290,bestTime:2500};
		expect(ac04Normalize(p).slots[0].missions[18].bestTime).toBe(2500);expect(AC04MissionData.MaximumSeconds(18)).toBe(3000);
	});
	it("each saved result is bounded by that mission's own phase clocks",()=>{
		const p=ac04BlankProfile();p.slots[0].missions[1]={completed:true,bestScore:840,bestTime:900};
		expect(ac04Normalize(p).slots[0].missions[1]).toBeUndefined();
	});
	it("a newer cloud schema cannot be silently overwritten",()=>{
		const future={version:2,slots:[]};expect(ac04Readable(future)).toBe(false);
		expect(()=>ac04Merge(future,ac04BlankProfile())).toThrow();
	});
	it("requires all four complete slots and never sanitizes malformed persisted progress",()=>{
		expect(ac04Readable(undefined)).toBe(true); expect(ac04Readable(ac04BlankProfile())).toBe(true);
		for (const raw of [{}, {version:1}, {version:1,slots:false}, {version:1,slots:[ac04BlankProfile().slots[0]]}]) expect(ac04Readable(raw)).toBe(false);
		const bad: object[] = [];
		let p=ac04BlankProfile();p.slots.push(p.slots[0]);bad.push(p);
		p=ac04BlankProfile();p.slots[0].index=2;bad.push(p);
		p=ac04BlankProfile();p.slots[0].aircraft="unknown";bad.push(p);
		p=ac04BlankProfile();p.slots[0].updatedAt=-1;bad.push(p);
		p=ac04BlankProfile();p.slots[0].seen=["ac04-i99"];bad.push(p);
		p=ac04BlankProfile();p.slots[0].seen=["ac04-i01","ac04-i01"];bad.push(p);
		p=ac04BlankProfile();p.slots[0].missions[19]={completed:true,bestScore:1,bestTime:1};bad.push(p);
		p=ac04BlankProfile();p.slots[0].missions[1]={completed:false,bestScore:1,bestTime:1};bad.push(p);
		p=ac04BlankProfile();p.slots[0].missions[1]={completed:true,bestScore:1,bestTime:900};bad.push(p);
		p=ac04BlankProfile();p.slots[0].missions[1]={completed:true,bestScore:0/0,bestTime:1};bad.push(p);
		bad.push({version:1,slots:ac04BlankProfile().slots, futureProgress:{mission:2}});
		for(const raw of bad){expect(ac04Readable(raw)).toBe(false);expect(()=>ac04Merge(raw,ac04BlankProfile())).toThrow();}
	});
	it("accepts DataStore numeric mission keys encoded as canonical strings without losing them",()=>{
		const p=ac04BlankProfile();
		(p.slots[0].missions as unknown as {[key:string]:unknown})["1"]={completed:true,bestScore:300,bestTime:20};
		expect(ac04Readable(p)).toBe(true);expect(ac04Merge(p,ac04BlankProfile()).slots[0].missions[1].bestScore).toBe(300);
		p.slots[0].missions[1]={completed:true,bestScore:400,bestTime:10};
		expect(ac04Readable(p)).toBe(false); // Ambiguous mixed numeric/string keys must not drop either result.
	});

});
