import { describe, expect, it } from "@rbxts/jest-globals";
import { ac04BarrageState } from "../shared/AC04Barrage";
describe("AC04 approximate Stonehenge firing windows",()=>{
	it("warns thirty seconds before each Tango Line volley and damages for ten seconds",()=>{
		for(const fire of [300,705,1125]){
			expect(ac04BarrageState(fire-30.01,false).warning).toBeUndefined();
			expect(ac04BarrageState(fire-30,false).warning).toBe(fire);
			expect(ac04BarrageState(fire-.01,false).damaging).toBe(false);
			expect(ac04BarrageState(fire,false).damaging).toBe(true);
			expect(ac04BarrageState(fire+9.99,false).damaging).toBe(true);
			expect(ac04BarrageState(fire+10,false).damaging).toBe(false);
		}
	});
	it("keeps Deep Strike's first barrage harmless without disabling the next volley",()=>{
		expect(ac04BarrageState(10,true).warning).toBe(20);
		expect(ac04BarrageState(20,true).damaging).toBe(false);
		expect(ac04BarrageState(65,true).damaging).toBe(true);
	});
});
