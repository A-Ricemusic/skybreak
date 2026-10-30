import { UploadedAssets } from "../shared/UploadedAssets";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { Lighting } from "@rbxts/services";
import { PauseRules } from "../shared/SessionGuard";
import { Enemy } from "../server/CombatSession";
import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { announceJammerKill, answerRearmMenu, skipCutIn, skipRearm, stepCutIn, stepRearm, liveJammers, lockAllowed } from "../server/EngineBatchCRuntime";
import { landingDuration, landingPose } from "../shared/EngineBatchB";
import { CombatSession } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { TargetScore } from "../shared/TargetScore";
import { FlightMath } from "../shared/FlightMath";
import { SpecialWeapons } from "../shared/SpecialWeapons";
import { createGroundTarget } from "../server/GroundTargetFactory";
import { buildNightLighting } from "../server/NightLighting";
const lighting={clock:Lighting.ClockTime,brightness:Lighting.Brightness,ambient:Lighting.Ambient};
afterEach(()=>{UploadedAssets.Configure();Lighting.ClockTime=lighting.clock;Lighting.Brightness=lighting.brightness;Lighting.Ambient=lighting.ambient;});
describe("Batch C runtime paths (Studio lease required to execute)",()=>{
	it("pauses the main epoch, refills once, launches, and requires zone departure before another rearm",()=>{
		const plan={zone:{x:0,y:145.7786702793,z:2400},radius:2000,landing:{touchdown:{x:0,y:20,z:0},headingDegrees:0,approachDistance:2400,rolloutDistance:400,approachSeconds:30,rolloutSeconds:10,glideDegrees:3},takeoffSeconds:10,missiles:true,special:true,health:false};
		const bp={...MissionCatalog.Get(1),phases:[{kind:"score_threshold" as const,label:"Strike",scoreThreshold:{points:2000,seconds:600,waitForExpiry:true},rearm:plan}]};
		const state=BlueprintRunner.NewState(bp,os.clock());
		const s={active:true,blueprintState:state,state:FlightMath.FromPose(0,145.7786702793,2400,0,0,160),targetScore:new TargetScore(MissionCatalog.Scoring(1)),enemies:[],projectiles:[],special:SpecialWeapons.New("salvo"),missiles:0,health:10,stateSequence:1} as unknown as CombatSession;
		s.state=FlightMath.FromPose(0,100,0,0,0,160);expect(stepRearm(s,1,52,()=>{})).toBe(false);
		s.state=FlightMath.FromPose(0,145.7786702793,2400,0,0,160);
		s.projectiles=[{hostile:true} as CombatSession["projectiles"][number]];expect(stepRearm(s,1,52,()=>{})).toBe(false);expect(s.projectiles.size()).toBe(1);s.projectiles=[];
		s.enemies=[{enabled:true,health:100,windup:1} as Enemy];expect(stepRearm(s,1,52,()=>{})).toBe(false);s.enemies=[];
		s.special.charges=0;const messages:defined[]=[];const epoch=state.startedAt;
		expect(stepRearm(s,25,52,m=>messages.push(m as defined))).toBe(true);expect(s.missiles).toBe(0);expect(state.startedAt).toBe(epoch);expect(state.rearmActive).toBe(true); BlueprintRunner.Tick(state,epoch+200);expect(state.elapsed).toBeLessThan(1);
		s.pause=PauseRules.New();PauseRules.Pause(s.pause,os.clock());const elapsed=s.rearmElapsed;
		expect(stepRearm(s,10,52,()=>{})).toBe(true);expect(s.rearmElapsed).toBe(elapsed);PauseRules.Resume(s.pause,os.clock());
		expect(stepRearm(s,25,52,m=>messages.push(m as defined))).toBe(true);expect(s.missiles).toBe(52);expect(s.health).toBe(10);expect(s.special.charges).toBe(3);expect(s.rearmElapsed).toBeUndefined();expect(messages.size()).toBe(2);expect(stepRearm(s,0.1,52,()=>{})).toBe(false);
	});
	it("counts only living enabled jammers and preserves unconfigured missions",()=>{
		const s={enemies:[{enabled:true,health:100,routeActor:{jammer:true}},{enabled:true,health:0,routeActor:{jammer:true}},{enabled:false,health:100,routeActor:{jammer:true}}]} as unknown as CombatSession;
		expect(liveJammers(s)).toBe(1);expect(lockAllowed(s,5000)).toBe(true);
	});
	it("builds ship target roots on authored water coordinates and bounded procedural night fields",()=>{
		const ship=createGroundTarget({id:"ship",type:"ship",position:{x:100,y:32,z:200},yaw:0,required:false,scoreRole:"ship"});expect(ship.PrimaryPart).toBeDefined();expect(ship.GetPivot().Position.X).toBe(100);ship.Destroy();
		const folder=new Instance("Folder");buildNightLighting(folder,{fields:[{origin:{x:0,y:10,z:0},rows:2,columns:2,spacing:20,realLights:1}],searchlights:[{position:{x:0,y:10,z:0},heading:0,sweep:30,period:8,length:400}]});expect(folder.GetChildren().size()).toBe(5);expect(Lighting.ClockTime).toBe(lighting.clock);expect(Lighting.Ambient).toBe(lighting.ambient);folder.Destroy();
	});
	it("announces each jammer kill once and never announces withdrawal",()=>{
		const a={enabled:true,health:100,routeActor:{jammer:true}} as Enemy,b={enabled:true,health:100,routeActor:{jammer:true}} as Enemy;
		const bp={...MissionCatalog.Get(1),phases:[{kind:"required_air" as const,label:"Jammers",count:1,jamming:{visualLockRange:1200,remainingCall:"One remains",clearCall:"Clear"}}]};
		const s={enemies:[a,b],blueprintState:BlueprintRunner.NewState(bp,os.clock())} as CombatSession;
		const calls:string[]=[];const send=(line:string)=>calls.push(line);
		a.withdrawUntil=10;announceJammerKill(s,a,send);expect(calls.size()).toBe(0);a.withdrawUntil=undefined;
		a.health=0;announceJammerKill(s,a,send);announceJammerKill(s,a,send);expect(calls).toEqual(["One remains"]);
		b.health=0;announceJammerKill(s,b,send);expect(calls).toEqual(["One remains","Clear"]);
	});

	it("places the uploaded ship hull at the waterline and centres its aim root",()=>{
		UploadedAssets.Configure({ids:{FuelTanker:1},probe:()=>true,loader:()=>{
			const container=new Instance("Model"), inner=new Instance("Model"), hull=new Instance("MeshPart");
			inner.Parent=container;hull.Name=UploadedAssetSpecs.FuelTanker.folder;hull.Size=UploadedAssetSpecs.FuelTanker.authoredSize;
			hull.Parent=inner;const surface=new Instance("SurfaceAppearance");surface.Parent=hull;return container;
		}});
		let ship:Model | undefined;
		try {
			ship=createGroundTarget({id:"waterline",type:"ship",position:{x:100,y:32,z:200},yaw:90,required:false,scoreRole:"ship"});
			const visual=ship.GetChildren().find(p=>p.IsA("BasePart") && p.Name!=="Aim") as BasePart;
			expect(visual.Position.Y-visual.Size.Y/2).toBeCloseTo(32-16);
			expect(ship.PrimaryPart!.Position.Y).toBeCloseTo(visual.Position.Y);
			expect(ship.PrimaryPart!.Position.X).toBeCloseTo(100);expect(ship.PrimaryPart!.Position.Z).toBeCloseTo(200);
			expect(ship.GetAttribute("TargetId")).toBe("waterline");
		} finally { ship?.Destroy();UploadedAssets.Configure(); }
	});

	it("holds mission 5's rearm for TAKEOFF / CHANGE WEAPON, swaps and refills the special, keeps damage, and blocks a repeat in the zone",()=>{
		const bp=MissionCatalog.Get(5),plan=bp.phases[0].rearm!,landed=landingDuration(plan.landing),gate=landingPose(plan.landing,0);
		const make=()=>{
			const state=BlueprintRunner.NewState(bp,os.clock());
			return {active:true,blueprintState:state,state:FlightMath.FromPose(gate.x,gate.y,gate.z,0,0,160),targetScore:new TargetScore(MissionCatalog.Scoring(5)),enemies:[],projectiles:[],special:SpecialWeapons.New("uav"),missiles:0,health:40,stateSequence:1} as unknown as CombatSession;
		};
		const s=make(),messages:{kind:string}[]=[],send=(m:unknown)=>messages.push(m as {kind:string}),said:string[]=[];
		expect(stepRearm(s,1,52,send,l=>said.push(l))).toBe(true);expect(messages[0].kind).toBe("RearmStarted");expect(said).toEqual([plan.radio![0].text]);
		expect(stepRearm(s,landed,52,send,l=>said.push(l))).toBe(true);expect(s.rearmElapsed).toBe(landed);expect(s.rearmMenu).toBe(0);expect(messages[1].kind).toBe("RearmMenu");expect(s.missiles).toBe(0);
		expect(stepRearm(s,10,52,send)).toBe(true);expect(s.rearmElapsed).toBe(landed);
		const epoch=s.blueprintState!.startedAt;BlueprintRunner.Tick(s.blueprintState!,epoch+500);expect(s.blueprintState!.elapsed).toBeLessThan(1);
		expect(answerRearmMenu(s,"lance",send)).toBe(true);expect(s.special.kind).toBe("lance");expect(messages[2].kind).toBe("RearmTakeoff");expect(answerRearmMenu(s,"salvo",send)).toBe(false);
		expect(stepRearm(s,plan.takeoffSeconds,52,send)).toBe(true);
		expect(s.rearmElapsed).toBeUndefined();expect(s.missiles).toBe(52);expect(s.special.kind).toBe("lance");expect(s.special.charges).toBe(SpecialWeapons.Get("lance").charges);expect(s.health).toBe(40);
		expect(messages[messages.size()-1].kind).toBe("RearmComplete");expect(stepRearm(s,0.1,52,send)).toBe(false);
		// An unanswered menu takes off with the current weapon; SKIP jumps the approach to the menu, then takes off.
		const idle=make();stepRearm(idle,1,52,()=>{});stepRearm(idle,landed,52,()=>{});expect(stepRearm(idle,31,52,()=>{})).toBe(true);expect(idle.rearmMenu).toBeUndefined();expect(idle.special.kind).toBe("uav");
		const skip=make();stepRearm(skip,1,52,()=>{});skipRearm(skip,plan,()=>{});expect(skip.rearmElapsed).toBe(landed);stepRearm(skip,0.1,52,()=>{});expect(skip.rearmMenu).toBe(0);
		skipRearm(skip,plan,()=>{});expect(skip.rearmMenu).toBeUndefined();expect(skip.rearmAnswered).toBe(true);
		answerRearmMenu(skip,"bogus",()=>{});expect(skip.special.kind).toBe("uav");
	});
	it("holds the escape clock through the elite cut-in, plays it once and radios the clearance after",()=>{
		const bp=MissionCatalog.Get(5),start=os.clock()-612,state=BlueprintRunner.NewState(bp,start);state.score=2000;
		BlueprintRunner.Tick(state,start+600);expect(state.phaseIndex).toBe(1);BlueprintRunner.Tick(state,start+612);
		const subject=(role:string)=>({enabled:true,health:100,scoreRole:role,model:new Instance("Model")} as unknown as Enemy);
		const s={active:true,blueprintState:state,enemies:[subject("elite"),subject("ace")],state:FlightMath.FromPose(0,500,0,0,0,160),stateSequence:3} as unknown as CombatSession;
		const messages:{kind:string;subjects?:Model[]}[]=[],said:string[]=[];
		expect(stepCutIn(s,0.5,m=>messages.push(m as {kind:string}),l=>said.push(l))).toBe(true);
		expect(messages[0].kind).toBe("CutInStarted");expect(messages[0].subjects![0]).toBe(s.enemies[1].model);expect(state.cutInActive).toBe(true);
		const remaining=BlueprintRunner.TimeRemaining(state);BlueprintRunner.Tick(state,os.clock()+100);expect(BlueprintRunner.TimeRemaining(state)).toBe(remaining);
		skipCutIn(s);expect(s.cutInElapsed).toBe(0.5);
		expect(stepCutIn(s,0.5,m=>messages.push(m as {kind:string}),l=>said.push(l))).toBe(true);skipCutIn(s);
		expect(stepCutIn(s,0.1,m=>messages.push(m as {kind:string}),l=>said.push(l))).toBe(true);
		expect(messages[1].kind).toBe("CutInComplete");expect(said).toEqual(bp.phases[1].cutIn!.after!);expect(state.cutInActive).toBeUndefined();
		BlueprintRunner.Tick(state,os.clock());expect(BlueprintRunner.TimeRemaining(state)).toBeCloseTo(remaining,0);
		expect(stepCutIn(s,0.1,()=>{},()=>{})).toBe(false);
		for(const e of s.enemies) e.model.Destroy();
	});

});
