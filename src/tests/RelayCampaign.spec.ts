import {describe,expect,it} from "@rbxts/jest-globals";
import {NavigationPilot} from "../shared/NavigationPilot";
import {FlightMath} from "../shared/FlightMath";
import {BlueprintRunner} from "../shared/BlueprintRunner";
import {MissionCatalog,MISSIONS,FlightPoint,MissionPhaseBlueprint} from "../shared/MissionCatalog";
import {MissionScore} from "../shared/MissionScore";
import {WavePlan} from "../shared/WavePlan";
import {GameConfig} from "../shared/GameConfig";
import {LEVEL_LAYOUTS} from "../shared/MissionLayouts";
import {LOG,MARSHAL,RECORDER,RUSK,SERA,STORY,TEAL,TRAINEE,VULTURE_TWO} from "../shared/RelayStory";
import {CampaignCoordinator,completeMission,highestUnlocked,normalizeProfile,mergeProfiles,resolveMissionRequest,serializeProfile} from "../server/CampaignRepository";

function coordinator(): CampaignCoordinator {
	const c=new CampaignCoordinator("offline-domain",undefined,{now:()=>1000,defer:()=>undefined});c.load();return c;
}
const origin={x:0,y:250,z:500};
/** A runner sortie strikes any lit hazard target (jammers, bank guns) so its phase can finish. */
let hazardSerial=0;
function clearHazards(state: ReturnType<typeof BlueprintRunner.NewState>,now: number): void {
	while(BlueprintRunner.HazardLive(state))BlueprintRunner.RecordKill(state,`hazard_${hazardSerial++}`,"ground",true,now);
}
function killKind(kind: string): "air" | "ground" | "ace" | undefined {
	return kind==="required_air" || kind==="chase" ? "air" : kind==="required_ground" ? "ground" : kind==="ace" ? "ace" : undefined;
}
describe("Broken Relay campaign contracts",()=>{
	it("authors 27 unique compositions, ordered missions and 28 story chapters",()=>{
		expect(MISSIONS.size()).toBe(27);expect(LEVEL_LAYOUTS.size()).toBe(27);expect(STORY.size()).toBe(28);
		const compositions=new Set<string>(),names=new Set<string>(),signatures=new Set<string>();
		for(const bp of MISSIONS){
			expect(bp.id).toBe(names.size()+1);names.add(bp.title);compositions.add(LEVEL_LAYOUTS[bp.id-1].name);
			expect(bp.act).toBe(math.ceil(bp.id/9));
			expect(MissionCatalog.RequiredGroundKills(bp)).toBe(bp.ground.size());
			// Most hostiles a phase can put up at once: its largest group (or the ace/courier) plus every raider.
			let activeBound=0;
			// Twist inserts are real objectives: every authoring rule applies to the expanded list.
			for(const p of MissionCatalog.ExpandedPhases(bp)){
				let largest=0;for(const size of WavePlan.Groups(p.count ?? 0,p.groups ?? 1))largest=math.max(largest,size);
				activeBound=math.max(activeBound,(p.kind==="required_air" ? largest : p.kind==="ace" || p.kind==="chase" ? 1 : 0)+(p.optionalRaiders ?? 0));
				if(p.points){
					expect(p.points.size()>0).toBe(true);
					for(const point of p.points){expect(math.abs(point.x)<2300 && math.abs(point.z)<2300 && point.y>=40 && point.y<=900).toBe(true);}
					expect(p.radius!>0).toBe(true);
					if(p.kind!=="route")expect(p.seconds!>0).toBe(true);
					if(p.ceiling!==undefined)expect(p.ceiling>=230).toBe(true);
				}
				// Every phase carries a radio beat the HUD can show when it starts.
				expect(p.beat!==undefined && p.beat.size()>0 && p.beat.size()<=80).toBe(true);
				for(const line of p.chatter ?? []){expect(line.at>=0 && line.at<=1).toBe(true);expect(line.text.size()>0 && line.text.size()<=80).toBe(true);}
				if(p.reinforce){
					// Mid-phase raider waves: increasing fractions strictly inside the phase, all within the raider budget.
					let previous=0,sum=0;
					for(const wave of p.reinforce){expect(wave.at>previous && wave.at<1).toBe(true);expect(wave.count>=1).toBe(true);previous=wave.at;sum+=wave.count;}
					expect(sum<=(p.optionalRaiders ?? 0)).toBe(true);
				}
				// Holds are the sortie's long objectives: escorts and defends run 90-150 s.
				if(p.kind==="escort" || p.kind==="defend")expect(p.seconds!>=90 && p.seconds!<=150).toBe(true);
				if(p.groups!==undefined){expect(p.kind).toBe("required_air");expect(p.groups>=1 && p.groups<=(p.count ?? 0)).toBe(true);}
				if(p.hazard){expect(p.hazard.at>=0 && p.hazard.at<1).toBe(true);expect(p.hazard.text.size()<=100).toBe(true);expect(p.twist?.mode==="now").toBe(false);}
				if(p.twist){
					expect(p.twist.at>0 && p.twist.at<=1).toBe(true);
					expect(p.twist.text.size()>0 && p.twist.text.size()<=100).toBe(true);
					expect(p.twist.insert.size()>=1).toBe(true);
					for(const inserted of p.twist.insert)expect(inserted.twist).toBeUndefined();
					// A "now" twist that fires as the phase completes would be a no-op surprise; cut phases must have room left.
					if(p.twist.mode==="now")expect(p.twist.at<1).toBe(true);
					// Kill phases step in whole increments: a "now" twist must leave at least one kill undone when it fires.
					if(p.twist.mode==="now" && (p.kind==="required_air" || p.kind==="required_ground" || p.kind==="ace")){
						const span=p.kind==="ace" ? 1 : p.count ?? 0;
						expect(math.ceil(p.twist.at*span-1e-5)<span).toBe(true);
					}
				}
				if(p.kind!=="route" && p.points)expect((p.chatter ?? []).size()>=1).toBe(true);
			}
			expect(activeBound<=7).toBe(true);
			const ace=bp.phases.find((p)=>p.kind==="ace");
			if(ace && bp.id>=3){
				expect(bp.aceName!==undefined).toBe(true);expect(bp.aceStages?.size()).toBe(2);expect(bp.aceReturns?.size()).toBe(2);
				expect((bp.aceHealth ?? 0)>=220).toBe(true);expect((ace.optionalRaiders ?? 0)>=2).toBe(true);
			}
			if(bp.id>=3)expect(bp.phases.some((p)=>p.points!==undefined)).toBe(true);
			signatures.add(bp.phases.map((p)=>`${p.kind}:${p.count ?? p.seconds ?? 0}`).join("/"));
		}
		expect(compositions.size()).toBe(27);expect(names.size()).toBe(27);expect(signatures.size()>=18).toBe(true);
		// Ace tuning (round 2: three-stage fights) and mid-phase reinforcements on every hold.
		expect(MissionCatalog.Get(9).aceHealth).toBe(300);expect(MissionCatalog.Get(18).aceHealth).toBe(400);expect(MissionCatalog.Get(27).aceHealth).toBe(500);
		for(const [id,kind] of [[5,"escort"],[8,"defend"],[12,"escort"],[20,"escort"],[23,"defend"],[25,"escort"]] as [number,string][]){
			const phase=MissionCatalog.Get(id).phases.find((p)=>p.kind===kind)!;
			expect((phase.optionalRaiders ?? 0)>=4).toBe(true);expect((phase.reinforce?.size() ?? 0)>=1).toBe(true);
		}
		expect(MissionCatalog.MaxOptionalRaiders(MissionCatalog.Get(23))).toBe(6);
		// Missions 1-2 keep their legacy flows untouched.
		expect(MissionCatalog.Get(1).phases.size()).toBe(4);expect(MissionCatalog.Get(2).phases.size()).toBe(3);
		expect(MissionCatalog.TotalPhases(MissionCatalog.Get(1))).toBe(4);expect(MissionCatalog.TotalPhases(MissionCatalog.Get(2))).toBe(3);
		const speakers=new Set<string>([TEAL,SERA,MARSHAL,RUSK,TRAINEE,LOG,RECORDER,VULTURE_TWO]);
		for(let i=0;i<STORY.size();i++){
			const c=STORY[i];expect(c.id).toBe(i);expect(c.beats.size()>=3 && c.beats.size()<=8).toBe(true);
			for(const beat of c.beats){expect(beat.text.size()>=12 && beat.text.size()<=160).toBe(true);expect(speakers.has(beat.speaker)).toBe(true);}
			// Every bridge ends with the trainee answering in their own voice; the finale ends on the roster card.
			expect(c.beats[c.beats.size()-1].speaker).toBe(i===27 ? LOG : TRAINEE);
		}
		expect(STORY[8].title).toBe("Vulture Lead");expect(STORY[17].title).toBe("Vulture Two");
		// The coup's voice is anonymous until the aurora archive names Rusk in chapter 17.
		for(const c of STORY)for(const beat of c.beats){if(beat.speaker===RUSK)expect(c.id>=17).toBe(true);if(beat.speaker===MARSHAL)expect(c.id<17).toBe(true);}
		// Teal's death is shown, not reported: his last recording plays in chapter 25 and the record is amended on screen.
		expect(STORY[25].beats.filter((b)=>b.speaker===TEAL && b.shot==="black").size()).toBe(3);
		expect(STORY[25].beats.some((b)=>b.text.find("KILLED, NOT DESERTED")[0]!==undefined)).toBe(true);
		// The opening line comes back as the last thing Teal says.
		expect(STORY[0].beats.some((b)=>b.text.find("The sky will still be there")[0]!==undefined)).toBe(true);
		expect(STORY[27].beats.some((b)=>b.speaker===TEAL && b.text.find("sky will still be there")[0]!==undefined)).toBe(true);
	});
	it("paces the campaign: a gentle rim, a rising plateau with twists, a long coast and finales that close their acts",()=>{
		// Par is a good human run (about 1.3x the scripted pilot); an average phone pilot takes ~1.2-1.4x par.
		const par=(id: number)=>MissionScore.ParSeconds(MissionCatalog.Get(id));
		const average=(act: 1 | 2 | 3)=>{let sum=0,n=0;for(const bp of MissionCatalog.ByAct(act))if(bp.id>=3){sum+=par(bp.id);n+=1;}return sum/n;};
		let twists=0;const twistTexts=new Set<string>();
		for(const bp of MissionCatalog.All()){
			const value=par(bp.id);
			if(bp.id<=2)continue;
			if(bp.act===1)expect(value>=120 && value<=260).toBe(true);
			else expect(value>=200 && value<=380).toBe(true);
			if(bp.act===2){
				for(const p of bp.phases)if(p.twist){twists+=1;twistTexts.add(p.twist.text);}
				// Every plateau sortie springs a surprise: a twist, a hazard or a mid-phase reinforcement wave.
				expect(bp.phases.some((p)=>p.twist!==undefined) || MissionCatalog.ExpandedPhases(bp).some((p)=>p.reinforce!==undefined || p.hazard!==undefined)).toBe(true);
			}
			// Every sortie from M3 on splits a bandit wave into groups or brings raiders mid-phase.
			expect(MissionCatalog.ExpandedPhases(bp).some((p)=>(p.groups ?? 1)>1 || (p.reinforce?.size() ?? 0)>0)).toBe(true);
		}
		expect(twists>=4).toBe(true);expect(twistTexts.size()).toBe(twists);
		// The curve rises act over act, and each act finale runs longer than its act's average sortie.
		expect(average(2)>average(1)).toBe(true);expect(average(3)>=average(2)-15).toBe(true);
		expect(par(9)>=average(1)).toBe(true);expect(par(18)>=average(2)).toBe(true);expect(par(27)>=average(3)).toBe(true);
		// Required air grows by act: Act III asks for far more bandits than Act I.
		let actOne=0,actThree=0;
		for(const bp of MissionCatalog.ByAct(1))if(bp.id>=3)actOne+=MissionCatalog.RequiredAirKills(bp);
		for(const bp of MissionCatalog.ByAct(3))actThree+=MissionCatalog.RequiredAirKills(bp);
		expect(actThree>=actOne*2).toBe(true);
		// Twists change the objective in distinct ways across the act; M15's jammers are now ground targets that freeze the link.
		expect(MissionCatalog.Get(10).phases[1].twist?.mode).toBe("now");expect(MissionCatalog.Get(10).phases[1].twist?.insert[0].kind).toBe("required_air");
		expect(MissionCatalog.Get(12).phases[0].twist?.insert[0].kind).toBe("escort");
		expect(MissionCatalog.Get(15).phases[0].hazard?.effect).toBe("jam");
		expect(MissionCatalog.Get(18).phases[2].twist?.insert[0].kind).toBe("defend");
		// Second objectives on the formerly single-phase sorties (round-2 backlog item 9).
		expect(MissionCatalog.Get(3).phases.filter((p)=>p.kind==="route").size()).toBe(2);
		expect(MissionCatalog.Get(3).phases[2].ceiling).toBe(320);
		expect(MissionCatalog.ExpandedPhases(MissionCatalog.Get(7)).some((p)=>p.kind==="chase" && p.seconds===90)).toBe(true);
		expect(MissionCatalog.Get(8).phases[1].kind).toBe("required_ground");expect(MissionCatalog.Get(8).phases[1].count).toBe(2);
		expect(MissionCatalog.ExpandedPhases(MissionCatalog.Get(10)).some((p)=>p.directed===true && p.kind==="required_ground")).toBe(true);
		expect(MissionCatalog.Get(20).phases[1].hazard?.effect).toBe("guns");expect(MissionCatalog.Get(20).phases[1].hazard?.count).toBe(2);
		expect(MissionCatalog.Get(23).phases[0].kind).toBe("defend");
		expect(MissionCatalog.Get(26).phases[0].flank).toBe(true);expect(MissionCatalog.Get(26).phases[0].groups).toBe(2);
	});
	it("inserts a twist's phases, queues its radio call and keeps the objective totals honest",()=>{
		// M10: the recon is cut short the moment the camp spots you (mode "now").
		const recon=BlueprintRunner.NewState(MissionCatalog.Get(10),0);
		const authored=MissionCatalog.Get(10).phases.size();
		recon.phaseIndex=1;const scan=BlueprintRunner.ActivePhase(recon)!;expect(scan.kind).toBe("recon");
		const point=BlueprintRunner.NavigationPoint(recon)!;let clock=0;
		while(recon.phaseIndex===1 && clock<60){clock+=.1;BlueprintRunner.ObserveFlight(recon,point,point,.1,clock);}
		expect(recon.phaseIndex).toBe(2);
		expect(math.abs(clock-scan.seconds!*scan.twist!.at)<.2).toBe(true);
		expect(BlueprintRunner.Phases(recon).size()).toBe(authored+scan.twist!.insert.size());
		expect(BlueprintRunner.ActivePhase(recon)!.label).toBe("Break the camp's intercept");
		// Radio ordering: the twist line is already queued at the instant the phase changes, so the server's
		// phase application (which drains TakeRadio before it radios the new beat) speaks the call first.
		expect(recon.radioQueue.size()).toBe(1);
		expect(BlueprintRunner.Objective(recon).objective).toBe("Break the camp's intercept");
		expect(BlueprintRunner.TakeRadio(recon)).toBe(scan.twist!.text);expect(BlueprintRunner.TakeRadio(recon)).toBeUndefined();
		// The catalog itself is untouched: another sortie starts from the authored list.
		expect(MissionCatalog.Get(10).phases.size()).toBe(authored);
		expect(BlueprintRunner.Phases(BlueprintRunner.NewState(MissionCatalog.Get(10),0)).size()).toBe(authored);
		// M13: the silo strike continues after the call (mode "after"); the intercept follows it, and only once.
		const strike=BlueprintRunner.NewState(MissionCatalog.Get(13),0);strike.phaseIndex=2;
		const silos=BlueprintRunner.ActivePhase(strike)!;expect(silos.kind).toBe("required_ground");expect(silos.count).toBe(4);
		BlueprintRunner.RecordKill(strike,"silo1","ground",true,1);expect(BlueprintRunner.TakeRadio(strike)).toBeUndefined();
		BlueprintRunner.RecordKill(strike,"silo2","ground",true,2);
		expect(strike.phaseIndex).toBe(2);expect(BlueprintRunner.TakeRadio(strike)).toBe(silos.twist!.text);
		expect(BlueprintRunner.Phases(strike)[3].label).toBe("Break the plateau reinforcements");
		BlueprintRunner.RecordKill(strike,"silo3","ground",true,3);BlueprintRunner.RecordKill(strike,"silo4","ground",true,4);
		expect(strike.phaseIndex).toBe(3);expect(BlueprintRunner.ActivePhase(strike)!.kind).toBe("required_air");
		expect(BlueprintRunner.TakeRadio(strike)).toBeUndefined();
		expect(BlueprintRunner.Phases(strike).size()).toBe(MissionCatalog.TotalPhases(MissionCatalog.Get(13)));
		// Totals the server and save layer use include the inserted objectives.
		expect(MissionCatalog.RequiredAirKills(MissionCatalog.Get(13))).toBe(4+3);
		expect(MissionCatalog.RequiredAirKills(MissionCatalog.Get(10))).toBe(4+3);
		expect(MissionCatalog.RequiredGroundKills(MissionCatalog.Get(17))).toBe(2);
		expect(MissionCatalog.RequiredGroundKills(MissionCatalog.Get(17))).toBe(MissionCatalog.Get(17).ground.size());
		expect(MissionCatalog.MaxOptionalRaiders(MissionCatalog.Get(12))).toBe(4+4+2);
		// A twist that fires on completion (at: 1) hands over to the inserted phase, never to the one after it.
		const finale=BlueprintRunner.NewState(MissionCatalog.Get(27),0);finale.phaseIndex=1;
		BlueprintRunner.RecordKill(finale,"relay","ground",true,1);
		expect(BlueprintRunner.ActivePhase(finale)!.label).toBe("Break the Marshal's personal escort");
		expect(BlueprintRunner.TakeRadio(finale)).toBe(MissionCatalog.Get(27).phases[1].twist!.text);
	});
	it("ends every mission on a terminal phase whose completion wins the sortie",()=>{
		for(const bp of MISSIONS){
			const expanded=MissionCatalog.ExpandedPhases(bp);
			expect(expanded.size()).toBe(MissionCatalog.TotalPhases(bp));
			expect(expanded.size()>=bp.phases.size()).toBe(true);
			const last=expanded[expanded.size()-1];
			expect(last!==undefined).toBe(true);
			// Nothing after the last authored phase can be inserted: the mission has a definite end.
			expect(last.twist).toBeUndefined();
			if(bp.id>=3){
				const state=BlueprintRunner.NewState(bp,0);state.phaseIndex=expanded.size()-1;state.phases=expanded;
				const kind=killKind(last.kind);
				if(kind!==undefined){
					for(let i=0;i<(BlueprintRunner.Total(last));i++)BlueprintRunner.RecordKill(state,`t${i}`,kind,true,1+i);
				}else{
					for(let i=0;i<4000 && state.outcome===undefined;i++){
						const point=BlueprintRunner.NavigationPoint(state)!;const observed={...point,y:math.max(250,point.y)};
						BlueprintRunner.ObserveFlight(state,observed,observed,.1,1+i*.1);
						clearHazards(state,1+i*.1);
					}
				}
				expect(state.outcome).toBe("won");expect(state.phaseIndex).toBe(expanded.size());
			}
		}
	});
	for(const bp of MISSIONS.filter((b)=>b.id>=3)) it(`completes every authoritative phase of M${bp.id} in order`,()=>{
		const state=BlueprintRunner.NewState(bp,100);let now=100,serial=0;
		const expanded=MissionCatalog.ExpandedPhases(bp);let radios=0;
		while(state.outcome===undefined && now<90+GameConfig.Campaign.MissionTimeLimit){
			const phase=BlueprintRunner.ActivePhase(state)!;
			const previous=state.phaseIndex;
			// Whatever the sortie does, the live list never deviates from the expanded catalog flow.
			expect(phase).toBe(expanded[state.phaseIndex]);
			while(BlueprintRunner.TakeRadio(state)!==undefined)radios+=1;
			const kind=killKind(phase.kind);
			if(kind!==undefined){
				const id=`target_${serial++}`;expect(BlueprintRunner.RecordKill(state,id,kind,true,++now)).toBe(true);
				expect(BlueprintRunner.RecordKill(state,id,kind,true,now)).toBe(false);
			}else{
				const point=BlueprintRunner.NavigationPoint(state)!;
				const observed={...point,y:math.max(phase.kind==="escort" ? 250 : 130,point.y)};
				now+=.1;BlueprintRunner.ObserveFlight(state,observed,observed,.1,now);
				// Lit jammers and bank guns are required kills; the phase waits for them.
				if(BlueprintRunner.HazardLive(state)){const id=`hazard_${serial++}`;expect(BlueprintRunner.RecordKill(state,id,"ground",true,now)).toBe(true);}
			}
			if(state.phaseIndex!==previous)expect(state.phaseIndex).toBe(previous+1);
		}
		while(BlueprintRunner.TakeRadio(state)!==undefined)radios+=1;
		// One queued call per twist and per hazard.
		expect(radios).toBe(bp.phases.filter((p)=>p.twist!==undefined).size()+expanded.filter((p)=>p.hazard!==undefined).size());
		expect(state.outcome).toBe("won");expect(state.phaseIndex).toBe(MissionCatalog.TotalPhases(bp));
		expect(BlueprintRunner.Phases(state).size()).toBe(MissionCatalog.TotalPhases(bp));
		expect(state.requiredGroundKills).toBe(bp.ground.size());
		expect(state.requiredAirKills+(state.aceKilled ? 1 : 0)).toBe(MissionCatalog.RequiredAirKills(bp));
	});
	for(const bp of MISSIONS.filter((b)=>b.id>=3)) it(`flies M${bp.id} navigation volumes with legal stick and throttle`,()=>{
		const expanded: MissionPhaseBlueprint[]=MissionCatalog.ExpandedPhases(bp);
		for(let index=0;index<expanded.size();index++){
			const phase=expanded[index];if(!phase.points)continue;
			const run=BlueprintRunner.NewState(bp,0);run.phases=expanded;run.phaseIndex=index;
			const flight=FlightMath.NewState();let clock=0;
			while(run.phaseIndex===index && run.outcome===undefined && clock<240){
				const point=BlueprintRunner.NavigationPoint(run)!;
				const input=NavigationPilot.Controls(flight,point,phase.radius!,phase.kind!=="route",phase.ceiling);
				expect(math.abs(input.x)<=1 && math.abs(input.y)<=1 && input.throttle>=0 && input.throttle<=1).toBe(true);
				const from={x:flight.x,y:flight.y,z:flight.z};FlightMath.Step(flight,input,1/30);clock+=1/30;
				BlueprintRunner.ObserveFlight(run,from,{x:flight.x,y:flight.y,z:flight.z},1/30,clock);
				clearHazards(run,clock);
			}
			expect(run.phaseIndex).toBe(index+1);
		}
	});
	it("requires final broadcast after defeating the Marshal",()=>{
		const bp=MissionCatalog.Get(27),state=BlueprintRunner.NewState(bp,0);
		for(let i=0;i<3;i++)BlueprintRunner.RecordKill(state,`wing${i}`,"air",true,1+i);
		BlueprintRunner.RecordKill(state,"relay","ground",true,5);
		expect(BlueprintRunner.RecordKill(state,"marshal","ace",true,6)).toBe(false);
		for(let i=0;i<3;i++)BlueprintRunner.RecordKill(state,`escort${i}`,"air",true,7+i);
		BlueprintRunner.RecordKill(state,"marshal","ace",true,10);
		expect(state.outcome).toBeUndefined();expect(BlueprintRunner.ActivePhase(state)?.kind).toBe("signal");
	});
	it("ignores out-of-volume, above-ceiling and invalid observations, but detects swept gate crossing",()=>{
		const scan=BlueprintRunner.NewState(MissionCatalog.Get(4),0);
		for(let i=0;i<50;i++)BlueprintRunner.ObserveFlight(scan,origin,origin,.1,1);
		expect(scan.phaseProgress).toBe(0);
		const high={x:-400,y:900,z:-600};BlueprintRunner.ObserveFlight(scan,high,high,.1,1);
		expect(scan.phaseProgress).toBe(0);
		const point=BlueprintRunner.NavigationPoint(scan)!;BlueprintRunner.ObserveFlight(scan,point,point,10,1);
		expect(scan.phaseProgress).toBe(0);
		const gate=BlueprintRunner.NewState(MissionCatalog.Get(3),0),nav=BlueprintRunner.NavigationPoint(gate)!;
		const a:FlightPoint={...nav,x:nav.x-250},b:FlightPoint={...nav,x:nav.x+250};
		BlueprintRunner.ObserveFlight(gate,a,b,.1,1);expect(gate.phaseProgress).toBe(1);
	});
	it("does not let optional kills advance escort progress; protected loss fails the sortie",()=>{
		const state=BlueprintRunner.NewState(MissionCatalog.Get(5),0);
		expect(BlueprintRunner.RecordKill(state,"not-required","air",true,1)).toBe(false);
		expect(BlueprintRunner.RecordKill(state,"raider","air",false,1)).toBe(true);
		expect(state.phaseProgress).toBe(0);
		// Five raiders drain 5 x 0.55 hull/s on Normal: the convoy is lost inside 40 s.
		for(let i=0;i<400;i++)BlueprintRunner.ObserveFlight(state,origin,origin,.1,1+i*.1,5);
		expect(state.outcome).toBe("failed");expect(state.reason).toBe("protected_lost");
		// The difficulty scale reaches the drain: on Easy the same raid leaves the convoy standing.
		const easy=BlueprintRunner.NewState(MissionCatalog.Get(5),0);
		for(let i=0;i<300;i++)BlueprintRunner.ObserveFlight(easy,origin,origin,.1,1+i*.1,5,0.75);
		expect(easy.outcome).toBeUndefined();
	});
	it("enforces deadline, monotonic time, destroyed health and immutable outcomes in all 25 new missions",()=>{
		const limit=GameConfig.Campaign.MissionTimeLimit;
		expect(BlueprintRunner.Duration).toBe(limit);
		for(const bp of MISSIONS.filter((b)=>b.id>=3)){
			const state=BlueprintRunner.NewState(bp,10);BlueprintRunner.Tick(state,30);BlueprintRunner.Tick(state,20);
			expect(state.elapsed).toBe(20);BlueprintRunner.Tick(state,limit+9);expect(state.outcome).toBeUndefined();
			BlueprintRunner.Tick(state,limit+10);expect(state.reason).toBe("timeout");
			expect(BlueprintRunner.RecordKill(state,"late","air",true,limit+11)).toBe(false);
			BlueprintRunner.Tick(state,20,0);expect(state.reason).toBe("timeout");
			const destroyed=BlueprintRunner.NewState(bp,0);BlueprintRunner.Tick(destroyed,1,0);expect(destroyed.reason).toBe("destroyed");
		}
	});
	it("migrates all four completed v2 slots to M3, preserving best times and replay",()=>{
		const slots=new Map<string,object>();for(let i=1;i<=4;i++)slots.set(tostring(i),{occupied:true,completed:true,mission1Completed:true,mission2Completed:true,mission1BestTime:50+i,mission2BestTime:90+i});
		const p=normalizeProfile({version:2,slots});
		for(let i=0;i<4;i++){const s=p.slots[i];expect(s.currentMission).toBe(3);expect(s.completed).toBe(false);expect(s.missions?.[1]?.bestTime).toBe(51+i);expect(s.missions?.[2]?.bestTime).toBe(91+i);expect(resolveMissionRequest(s,3)[0]).toBe(3);expect(resolveMissionRequest(s,4)[0]).toBeUndefined();}
		const roundTrip=normalizeProfile(serializeProfile(p));expect(roundTrip.slots[3].missions?.[2]?.bestTime).toBe(94);
	});
	it("unlocks every mission sequentially, isolates slots and preserves replay and merged records",()=>{
		const c=coordinator();
		for(let id=1;id<=27;id++){
			const slot=c.getSlots()[0];expect(highestUnlocked(slot)).toBe(id);expect(resolveMissionRequest(slot,undefined)[0]).toBe(id);
			if(id<27)expect(resolveMissionRequest(slot,id+1)[0]).toBeUndefined();
			const bp=MissionCatalog.Get(id);let kind="";
			completeMission(c,1,id,true,{slot:1,missionId:id,kills:MissionCatalog.RequiredAirKills(bp),groundKills:MissionCatalog.RequiredGroundKills(bp),completedPhases:MissionCatalog.TotalPhases(bp),elapsed:100},(m)=>kind=m.kind);
			expect(kind).toBe("Completed");expect(c.getSlots()[0].completed).toBe(id===27);
		}
		c.recordMissionResult(1,5,false,0,80);c.recordMissionResult(1,5,true,3,110);c.recordMissionResult(1,5,true,3,90);
		const slot=c.getSlots()[0];expect(slot.missions?.[5]?.bestTime).toBe(90);expect(slot.completed).toBe(true);
		for(let id=1;id<=27;id++)expect(resolveMissionRequest(slot,id)[0]).toBe(id);
		for(let i=1;i<4;i++)expect(c.getSlots()[i].occupied).toBe(false);
		const merged=mergeProfiles({version:3,slots:c.getSlots()},undefined);
		expect(normalizeProfile(serializeProfile(merged)).slots[0].completed).toBe(true);
	});
	it("rejects forged phase proof, wrong sessions, invalid mission ids and late completion",()=>{
		const c=coordinator(),bp=MissionCatalog.Get(3);let result="";
		const stats={slot:1,missionId:3,kills:MissionCatalog.RequiredAirKills(bp),groundKills:0,elapsed:40};
		completeMission(c,1,3,true,stats,(m)=>result=m.kind);expect(result).toBe("Failed");
		expect(completeMission(c,1,4,true,stats,()=>undefined)).toBe(false);
		completeMission(c,1,3,true,{...stats,completedPhases:bp.phases.size(),elapsed:GameConfig.Campaign.MissionTimeLimit},(m)=>result=m.kind);
		expect(result).toBe("Failed");
		// Proof must cover the twist-inserted phases too: the authored count alone is not a win.
		const twisted=MissionCatalog.Get(13);
		completeMission(c,1,13,true,{slot:1,missionId:13,kills:MissionCatalog.RequiredAirKills(twisted),groundKills:MissionCatalog.RequiredGroundKills(twisted),completedPhases:twisted.phases.size(),elapsed:200},(m)=>result=m.kind);
		expect(result).toBe("Failed");
		for(const id of [0,28,1.5,math.huge])expect(resolveMissionRequest(c.getSlots()[0],id)[0]).toBeUndefined();
	});
});
