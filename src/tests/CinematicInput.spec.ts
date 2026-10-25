import {describe,expect,it} from "@rbxts/jest-globals";
import {CinematicAction,CinematicControl,routeCinematicInput} from "../shared/CinematicInput";

// Shared production routing, not physical controller/engine GUI evidence.
describe("Cinematic GUI activation and shortcuts",()=>{
	for(const control of ["skip","motion","text","pause"] as CinematicControl[]) {
		for(const processed of [false,true]) it(`A activates only selected ${control}, processed=${processed}`,()=>{
			// Roblox emits InputBegan and the selected GuiButton's Activated.
			// Neither event order may skip/toggle twice or steal accessibility A.
			for(const activationFirst of [false,true]){
				const actions:CinematicAction[]=[];
				const events=[
					routeCinematicInput({kind:"shortcut",key:"ButtonA",processed,guiSelected:true}),
					routeCinematicInput({kind:"activated",control}),
				];
				const ordered=activationFirst ? [events[1],events[0]] : events;
				for(const action of ordered)if(action!==undefined)actions.push(action);
				expect(actions.size()).toBe(1);expect(actions[0]).toBe(control);
			}
		});
	}
	it("A without GUI focus has no blanket skip shortcut",()=>{
		expect(routeCinematicInput({kind:"shortcut",key:"ButtonA",processed:false,guiSelected:false})).toBeUndefined();
	});
	it("ignores every consumed shortcut, including gamepad X/B and keyboard Space/P",()=>{
		for(const key of ["ButtonA","ButtonX","ButtonB","Space","P"]){
			for(const guiSelected of [false,true])expect(routeCinematicInput({kind:"shortcut",key,processed:true,guiSelected})).toBeUndefined();
		}
	});
	it("routes unconsumed B cancel and X/P pause once regardless of selection",()=>{
		for(const guiSelected of [false,true]){
			expect(routeCinematicInput({kind:"shortcut",key:"ButtonB",processed:false,guiSelected})).toBe("cancel");
			for(const key of ["ButtonX","P"])expect(routeCinematicInput({kind:"shortcut",key,processed:false,guiSelected})).toBe("pause");
		}
	});
	it("reserves focused Space for GUI activation and allows background Space skip",()=>{
		expect(routeCinematicInput({kind:"shortcut",key:"Space",processed:false,guiSelected:false})).toBe("skip");
		for(const control of ["skip","motion","text","pause"] as CinematicControl[]){
			expect(routeCinematicInput({kind:"shortcut",key:"Space",processed:false,guiSelected:true})).toBeUndefined();
			expect(routeCinematicInput({kind:"activated",control})).toBe(control);
		}
	});
});
