import { engineRuntimeFixture } from "./EngineRuntimeFixture";
import { MissionBlueprint } from "../shared/MissionCatalog";
export function interceptHoldFixture(): MissionBlueprint {
	return {...engineRuntimeFixture(),ground:[], start:{kind:"airborne",x:0,y:800,z:0,headingDegrees:315}, phases:[
		{kind:"score_threshold",label:"Air superiority",concurrentFighters:7,scoreThreshold:{points:800,seconds:420,waitForExpiry:true},fighterWaves:[{id:"battle",count:27,role:"raider",scoreRole:"escort",trigger:{kind:"phase_start",phase:0}}]},
		{kind:"required_air",label:"Protect broadcast",count:6,update:{objective:"Intercept western bombers",radio:["Bombers approaching from the west."],countdownSeconds:360},
			interceptHold:{site:{x:0,y:80,z:0},siteName:"VARDA TOWER",ignitionSecondsRemaining:35,ignitionCall:"Transmitter ignition. Hold the broadcast window."},
			bombers:{count:6,targetIds:["west-1","west-2","west-3","west-4","west-5","west-6"],arrivalSeconds:[0,10,20,30,40,50],waypoints:[{x:-12000,y:700,z:0}],escape:{x:0,y:700,z:0},speed:50,escorts:{count:0,initial:0,role:"escort",aceName:"NONE",aceAt:0}}}
	]};
}
