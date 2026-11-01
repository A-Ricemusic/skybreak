import { engineRuntimeFixture } from "./EngineRuntimeFixture";
import { MissionBlueprint } from "../shared/MissionCatalog";
export function protectedAircraftFixture(): MissionBlueprint {
 return {...engineRuntimeFixture(),ground:[],allies:undefined,countdownSeconds:330,start:{kind:"airborne",x:0,y:735,z:6000,headingDegrees:315},phases:[{kind:"protected_air",label:"Protect both aircraft",protection:{altitudeCeiling:2800,aircraft:[
  {id:"high",callsign:"ORCHARD ONE",health:100,route:{speed:60,waypoints:[{x:1000,y:2800,z:6000},{x:1000,y:2800,z:-6000}]}},
  {id:"low",callsign:"ORCHARD TWO",health:120,route:{speed:60,waypoints:[{x:-1000,y:900,z:6000},{x:-1000,y:900,z:-6600}]}}
 ]},fighterWaves:[{id:"high-threat",count:4,role:"raider",scoreRole:"escort",attackProtected:"high",spawn:{x:1000,y:2800,z:3000},trigger:{kind:"phase_start",phase:0}}]}]};
}
