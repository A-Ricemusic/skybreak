import { describe, expect, it } from "@rbxts/jest-globals";
import { validateCruiseMissilePhases } from "../shared/CruiseMissileRules";
import { validateEncounterIdentities, validateCampaignEncounters } from "../shared/CampaignEncounters";
import { MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";

const intercept = (): MissionPhaseBlueprint => ({kind:"required_air",label:"Intercept",count:2,cruiseIntercept:{
 site:{x:1000,y:0,z:0},targets:["shared-threat","second-threat"].map(id=>({id,scoreRole:"cruise",speed:100,route:[{x:0,y:100,z:0},{x:1000,y:100,z:0}]})),
}});
const blueprint = (phases: MissionPhaseBlueprint[]) => ({...MissionCatalog.Get(1),ground:[],phases,
 scoring:{...MissionCatalog.Scoring(1),points:{...MissionCatalog.Scoring(1).points,air:60,cruise:100}},
});
function accepted(run: () => void): boolean { const [ok]=pcall(run); return ok; }
const sources = (id: string): MissionPhaseBlueprint[] => [
 {kind:"required_air",label:"Bombers",count:1,bombers:{count:1,targetIds:[id],speed:100,waypoints:[{x:0,y:200,z:0},{x:500,y:200,z:0}],escape:{x:1000,y:200,z:0},escorts:{count:0,initial:0,role:"escort",aceName:"Escort",aceAt:0}}},
 {kind:"required_ground",label:"Strike",count:1,groundTargets:[{id,type:"hangar",position:{x:0,y:0,z:0},yaw:0,required:true,scoreRole:"air"}]},
 {kind:"required_air",label:"Wave",count:1,fighterWaves:[{id,count:1,role:"raider",scoreRole:"air",trigger:{kind:"time",seconds:0}}]},
 {kind:"required_air",label:"Ace",count:1,standaloneAce:{id,name:"Ace",livery:"Rusk",health:100,trigger:{kind:"time",seconds:0},behaviour:"dogfight",scoreRole:"ace"}},
];
describe("D10 authoring admission regressions",()=>{
 it("rejects the two-missile halfway now twist that would skip a surviving threat",()=>{
  const p=intercept();
  MissionCatalog.ValidatePolicy(blueprint([p]));
  const state=BlueprintRunner.NewState(blueprint([p]),0);
  expect(BlueprintRunner.RecordKill(state,"shared-threat","air",true,1)).toBe(true);
  expect(state.phaseIndex).toBe(0);expect(state.outcome).toBeUndefined();
  for(const mode of ["now","after"] as const) {
   const bad={...p,twist:{at:0.5,mode,text:"New contacts",insert:[{kind:"required_air",label:"Next",count:1} as MissionPhaseBlueprint]}};
   expect(accepted(()=>validateCruiseMissilePhases([bad],15360))).toBe(false);
   expect(accepted(()=>MissionCatalog.ValidatePolicy(blueprint([bad])))).toBe(false);
  }
 });
 it("rejects cruise collisions with every authored credited-id source in both phase orders",()=>{
  for(const source of sources("shared-threat")) for(const phases of [[source,intercept()],[intercept(),source]]) {
   const b=blueprint(phases);
   expect(accepted(()=>validateCruiseMissilePhases(phases,15360))).toBe(false);
   expect(accepted(()=>validateCampaignEncounters(b,phases,MissionCatalog.Airspace(b),MissionCatalog.Scoring(b)))).toBe(false);
   expect(accepted(()=>MissionCatalog.ValidatePolicy(b))).toBe(false);
  }
  for(const source of sources("distinct")) for(const phases of [[source,intercept()],[intercept(),source]]) MissionCatalog.ValidatePolicy(blueprint(phases));
 });
 it("shares protected and spatial source identities with cruise and every encounter source",()=>{
  const protectedPhase: MissionPhaseBlueprint={kind:"required_air",label:"Protected",protection:{aircraft:[{id:"shared-threat"}]} as MissionPhaseBlueprint["protection"]};
  const spatialPhase: MissionPhaseBlueprint={kind:"required_air",label:"Spatial",spatialJamming:{airships:[{id:"shared-threat"}]} as MissionPhaseBlueprint["spatialJamming"]};
  for(const added of [protectedPhase,spatialPhase]) {
   for(const other of [...sources("shared-threat"),intercept()]) for(const phases of [[added,other],[other,added]]) {
    expect(accepted(()=>validateEncounterIdentities(phases))).toBe(false);
    expect(accepted(()=>validateCruiseMissilePhases(phases,15360))).toBe(false);
   }
   validateEncounterIdentities([added,...sources("distinct").filter((_,i)=>i===0)]);
  }
  expect(accepted(()=>validateEncounterIdentities([protectedPhase,spatialPhase]))).toBe(false);
 });
 it("rejects duplicate cruise identities across phases and inside twist inserts",()=>{
  expect(accepted(()=>MissionCatalog.ValidatePolicy(blueprint([intercept(),intercept()])))).toBe(false);
  const entry: MissionPhaseBlueprint={kind:"required_air",label:"Entry",count:2,twist:{at:0.5,text:"Intercept",insert:[intercept()]}};
  expect(accepted(()=>MissionCatalog.ValidatePolicy(blueprint([sources("shared-threat")[0],entry])))).toBe(false);
 });
});
