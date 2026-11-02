import { testCheckpoint } from "./TestPacing";
import {describe,expect,it} from "@rbxts/jest-globals";
import {NavigationPilot} from "../shared/NavigationPilot";
import {FlightMath} from "../shared/FlightMath";
import {BlueprintRunner} from "../shared/BlueprintRunner";
import {MissionCatalog,MISSIONS,FlightPoint,MissionPhaseBlueprint} from "./LegacyCatalog";
import {MissionPacing} from "../shared/MissionPacing";
import {MissionScore} from "../shared/MissionScore";
import {AirRequest,WavePlan} from "../shared/WavePlan";
import {GameConfig} from "../shared/GameConfig";
import {LEVEL_LAYOUTS} from "../shared/MissionLayouts";
import {LOG,MARSHAL,RECORDER,RUSK,SERA,STORY,TEAL,TRAINEE,VULTURE_TWO} from "./legacy/LegacyStory";
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
/**
 * One phase flown second by second under the server's spawn rules (CombatService): staggered or
 * authored groups (WavePlan.Due, the next held while one still waits), reinforcements by phase
 * fraction, both ace calls at once, every wave `extra` larger, all through the live-aircraft budget
 * (WavePlan.Admit). The pilot kills one required target every `killEvery` s (0: never) and never a
 * raider. Returns the most aircraft up at once, the bandits that flew, and whether the phase cleared.
 */
function flyPhase(p: MissionPhaseBlueprint,extra: number,killEvery: number): {peak: number;flown: number;cleared: boolean}{
	const budget=WavePlan.Budget(extra),queue: AirRequest[]=[],wave=(n: number)=>n>0 ? n+extra : 0;
	const count=p.count ?? 0,air=p.kind==="required_air",kills=air || p.kind==="required_ground";
	const plan=air ? WavePlan.Groups(count,p.groups ?? 1) : [];
	const fixed=p.kind==="ace" || p.kind==="chase" ? 1 : 0;
	let bandits=0,raiders=0,flown=0,killed=0,group=1,lastAt=0,reinforced=0,peak=fixed;
	const drain=()=>{
		for(const batch of WavePlan.Admit(queue,budget-bandits-raiders-fixed)){if(batch.role==="bandit"){bandits+=batch.count;flown+=batch.count;}else raiders+=batch.count;}
		peak=math.max(peak,bandits+raiders+fixed);
	};
	const ask=(role: AirRequest["role"],n: number)=>{if(n>0){queue.push({role,count:n,behind:false});drain();}};
	if(air)ask("bandit",plan[0]);
	ask("raider",wave(MissionCatalog.InitialRaiders(p)));
	if(p.kind==="ace"){const r=p.optionalRaiders ?? 0;ask("raider",wave(math.ceil(r/2)));ask("raider",wave(r-math.ceil(r/2)));}
	for(let t=1;t<=600;t++){
		testCheckpoint();
		drain();
		if(kills && killEvery>0 && t%killEvery===0 && (!air || bandits>0)){killed+=1;if(air)bandits-=1;}
		if(kills && killed>=count)return {peak,flown,cleared:true};
		const fraction=kills ? killed/count : p.seconds!==undefined && p.seconds>0 ? math.min(1,t/p.seconds) : 1;
		const waves=p.reinforce ?? [];
		while(reinforced<waves.size() && fraction>=waves[reinforced].at){ask("raider",wave(waves[reinforced].count));reinforced+=1;}
		if(air && WavePlan.Queued(queue,"bandit")===0 && WavePlan.Due({next:group,plan,sinceLast:t-lastAt,stagger:p.stagger ?? WavePlan.DefaultStagger,killed,groupAt:p.groupAt})){ask("bandit",plan[group]);group+=1;lastAt=t;}
	}
	return {peak,flown,cleared:!kills};
}
describe("Broken Relay campaign contracts",()=>{
	it("authors 27 unique compositions, ordered missions and 28 story chapters",()=>{
		expect(MISSIONS.size()).toBe(27);expect(LEVEL_LAYOUTS.size()).toBe(27);expect(STORY.size()).toBe(28);
		const compositions=new Set<string>(),names=new Set<string>(),signatures=new Set<string>();
		for(const bp of MISSIONS){
			testCheckpoint();
			expect(bp.id).toBe(names.size()+1);names.add(bp.title);compositions.add(LEVEL_LAYOUTS[bp.id-1].name);
			expect(bp.act).toBe(math.ceil(bp.id/9));
			expect(MissionCatalog.RequiredGroundKills(bp)).toBe(bp.ground.size());
			// Twist inserts are real objectives: every authoring rule applies to the expanded list.
			for(const p of MissionCatalog.ExpandedPhases(bp)){
				testCheckpoint();
				if(p.points){
					expect(p.points.size()>0).toBe(true);
					for(const point of p.points){expect(math.abs(point.x)<2300 && math.abs(point.z)<2300 && point.y>=40 && point.y<=900).toBe(true);}
					expect(p.radius!>0).toBe(true);
					if(p.kind!=="route")expect(p.seconds!>0).toBe(true);
					if(p.ceiling!==undefined)expect(p.ceiling>=230).toBe(true);
				}
				// Every phase carries a radio beat the HUD can show when it starts.
				if(p.parkedEscort){expect(["recon","signal","route"].includes(p.kind)).toBe(true);expect(p.parkedEscort.y>=40).toBe(true);}
				expect(p.beat!==undefined && p.beat.size()>0 && p.beat.size()<=72).toBe(true);
				for(const line of p.chatter ?? []){expect(line.at>=0 && line.at<=1).toBe(true);expect(line.text.size()>0 && line.text.size()<=72).toBe(true);}
				if(p.reinforce){
					// Mid-phase raider waves: increasing fractions strictly inside the phase, all within the raider budget.
					let previous=0,sum=0;
					for(const wave of p.reinforce){expect(wave.at>previous && wave.at<1).toBe(true);expect(wave.count>=1).toBe(true);previous=wave.at;sum+=wave.count;}
					expect(sum<=(p.optionalRaiders ?? 0)).toBe(true);
				}
				// Short handoffs complement the longer opening holds; none exceeds two minutes.
				if(p.kind==="escort" || p.kind==="defend")expect(p.seconds!>=30 && p.seconds!<=120).toBe(true);
				if(p.groups!==undefined){expect(p.kind).toBe("required_air");expect(p.groups>=1 && p.groups<=(p.count ?? 0)).toBe(true);}
				if(p.hazard){expect(p.hazard.at>=0 && p.hazard.at<1).toBe(true);expect(p.hazard.text.size()<=72).toBe(true);expect(p.twist?.mode==="now").toBe(false);}
				if(p.twist){
					expect(p.twist.at>0 && p.twist.at<=1).toBe(true);
					expect(p.twist.text.size()>0 && p.twist.text.size()<=72).toBe(true);
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
			const ace=bp.phases.find((p)=>p.kind==="ace");
			if(ace && bp.id>=3){
				expect(bp.aceName!==undefined).toBe(true);expect(bp.aceStages?.size()).toBe(2);expect(bp.aceReturns?.size()).toBe(2);
				expect((bp.aceHealth ?? 0)>=200).toBe(true);expect((ace.optionalRaiders ?? 0)>=2).toBe(true);
			}
			if(bp.id>=3)expect(bp.phases.some((p)=>p.points!==undefined)).toBe(true);
			signatures.add(bp.phases.map((p)=>`${p.kind}:${p.count ?? p.seconds ?? 0}`).join("/"));
		}
		expect(compositions.size()).toBe(27);expect(names.size()).toBe(27);expect(signatures.size()>=18).toBe(true);
		// Ace tuning (round 2: three-stage fights) and mid-phase reinforcements on every hold.
		expect(MissionCatalog.Get(9).aceHealth).toBe(200);expect(MissionCatalog.Get(18).aceHealth).toBe(260);expect(MissionCatalog.Get(27).aceHealth).toBe(320);
		for(const [id,kind] of [[5,"escort"],[8,"defend"],[12,"escort"],[20,"escort"],[23,"defend"],[25,"escort"]] as [number,string][]){
			testCheckpoint();
			const phase=MissionCatalog.Get(id).phases.find((p)=>p.kind===kind)!;
			expect((phase.optionalRaiders ?? 0)>=4).toBe(true);expect((phase.reinforce?.size() ?? 0)>=1).toBe(true);
		}
		expect(MissionCatalog.MaxOptionalRaiders(MissionCatalog.Get(23))).toBe(11);
		// Missions 1-2 keep their legacy flows untouched.
		expect(MissionCatalog.Get(1).phases.size()).toBe(4);expect(MissionCatalog.Get(2).phases.size()).toBe(3);
		expect(MissionCatalog.TotalPhases(MissionCatalog.Get(1))).toBe(4);expect(MissionCatalog.TotalPhases(MissionCatalog.Get(2))).toBe(3);
		const speakers=new Set<string>([TEAL,SERA,MARSHAL,RUSK,TRAINEE,LOG,RECORDER,VULTURE_TWO]);
		for(let i=0;i<STORY.size();i++){
			testCheckpoint();
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
	it("never flies more than seven hostile aircraft at once on Normal and Ace, and every phase still clears",()=>{
		for(const bp of MISSIONS){
			testCheckpoint();
			if(bp.id<=2)continue; // the legacy missions spawn directly and stay under five
			for(const p of MissionCatalog.ExpandedPhases(bp)){
				testCheckpoint();
				for(const extra of [0,1]){
					testCheckpoint();
					const budget=WavePlan.Budget(extra);
					// A pilot who never scores: every timer fires, every group is due, and the budget still holds.
					const idle=flyPhase(p,extra,0);
					expect(idle.peak<=budget).toBe(true);
					// The true demand without the budget is at least what flew.
					expect(MissionCatalog.PeakAircraft(p,extra)>=idle.peak).toBe(true);
					// A slow pilot (a kill every 9 s, raiders ignored): nothing deadlocks, every bandit flies.
					const slow=flyPhase(p,extra,9);
					expect(slow.peak<=budget).toBe(true);
					expect(slow.cleared).toBe(true);
					if(p.kind==="required_air")expect(slow.flown).toBe(p.count);
				}
			}
		}
		// M20's eastern wing: 3 at entry, 6 at 18 s and, with no kills, 9 at 36 s. The budget holds it to 7.
		const eastern=MissionCatalog.Get(20).phases[0];
		expect(MissionCatalog.PeakAircraft(eastern)).toBe(9);
		expect(flyPhase(eastern,0,0).peak).toBe(7);
		// M26: the rear flight waits for half the wing, so a pilot who scores nothing faces four.
		const wing=MissionCatalog.Get(26).phases[0];
		expect(flyPhase(wing,0,0).flown).toBe(4);
		expect(WavePlan.Due({next:1,plan:WavePlan.Groups(wing.count!,wing.groups),sinceLast:999,stagger:WavePlan.DefaultStagger,killed:2,groupAt:wing.groupAt})).toBe(false);
		expect(WavePlan.Due({next:1,plan:WavePlan.Groups(wing.count!,wing.groups),sinceLast:0,stagger:WavePlan.DefaultStagger,killed:4,groupAt:wing.groupAt})).toBe(true);
		// Its warning is the rear flight's spawn call, not a progress chatter line that could run early or late.
		expect(wing.groupCalls?.[0]).toBe("SERA: Second flight on your six! Turn!");
		expect(wing.chatter).toBeUndefined();
	});
	it("reinforces every multi-target combat phase mid-phase, except where the exceptions in docs/broken-relay.md say why not",()=>{
		// Single targets (count 1) never take one: a kill-fraction wave could only arrive with the completing kill.
		// These phases fill the live-aircraft budget with bandits alone, so a raider wave would only be held back.
		const budgetFull=new Set<string>(["20:Shatter the eastern wing"]);
		// Phases whose own demand (timer overlap with no kills) passes the budget: the server holds the excess back.
		const overNormal=new Set<string>(["20:Shatter the eastern wing"]);
		const overAce=new Set<string>(["8:Protect Varda's control tower","20:Shatter the eastern wing","23:Defend the command frigate"]);
		const seen=new Set<string>();
		for(const bp of MISSIONS){
			testCheckpoint();
			if(bp.id<=2)continue; // the legacy missions keep their original flows
			for(const p of MissionCatalog.ExpandedPhases(bp)){
				testCheckpoint();
				const key=`${bp.id}:${p.label}`;
				if(p.kind==="required_air" || p.kind==="required_ground"){
					if(p.count===1)expect(p.reinforce).toBeUndefined();
					else if(budgetFull.has(key)){
						seen.add(key);
						expect(p.reinforce).toBeUndefined();
						const reinforced={...p,optionalRaiders:(p.optionalRaiders ?? 0)+1,reinforce:[{at:0.5,count:1}]};
						expect(MissionCatalog.PeakAircraft(reinforced)>WavePlan.Budget()).toBe(true);
					}else expect((p.reinforce?.size() ?? 0)>=1).toBe(true);
				}
				expect(MissionCatalog.PeakAircraft(p)>WavePlan.Budget()).toBe(overNormal.has(key));
				expect(MissionCatalog.PeakAircraft(p,1)>WavePlan.Budget(1)).toBe(overAce.has(key));
			}
		}
		expect(seen.size()).toBe(budgetFull.size());
	});
	it("authors 4-7 alternating beats within the trimmed design-estimate bands, with act finales",()=>{
		// Par rewards a good run; the average-phone estimate also accounts for acquisition and drift.
		const par=(id: number)=>MissionScore.ParSeconds(MissionCatalog.Get(id));
		const average=(act: 1 | 2 | 3)=>{let sum=0,n=0;for(const bp of MissionCatalog.ByAct(act))if(bp.id>=3){sum+=par(bp.id);n+=1;}return sum/n;};
		let twists=0;const twistTexts=new Set<string>();
		for(const bp of MissionCatalog.All()){
			testCheckpoint();
			const value=par(bp.id);
			if(bp.id<=2)continue;
			expect(value >= 180 && value <= 450).toBe(true);
			const estimate=MissionPacing.EstimateSeconds(bp);
			expect(estimate >= (bp.act+2)*60 && estimate <= (bp.act+4)*60).toBe(true);
			const flow=MissionCatalog.ExpandedPhases(bp);
			expect(flow.size()>=4 && flow.size()<=7).toBe(true);
			const kinds=new Set<string>(),labels=new Set<string>();
			for(let beat=0;beat<flow.size();beat++){
				testCheckpoint();
				kinds.add(flow[beat].kind);labels.add(flow[beat].label);
				if(beat>0)expect(flow[beat].kind!==flow[beat-1].kind).toBe(true);
			}
			expect(kinds.size()>=4).toBe(true);expect(labels.size()).toBe(flow.size());
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
		// Later sorties add work without doubling the combat target count.
		let actOne=0,actThree=0;
		for(const bp of MissionCatalog.ByAct(1))if(bp.id>=3)actOne+=MissionCatalog.RequiredAirKills(bp);
		for(const bp of MissionCatalog.ByAct(3))actThree+=MissionCatalog.RequiredAirKills(bp);
		expect(actThree < actOne*2).toBe(true);
		// Twists change the objective in distinct ways across the act; M15's jammers are now ground targets that freeze the link.
		expect(MissionCatalog.Get(10).phases[0].twist?.mode).toBe("now");expect(MissionCatalog.Get(10).phases[0].twist?.insert[0].kind).toBe("required_air");
		expect(MissionCatalog.Get(12).phases[0].twist?.insert[0].kind).toBe("recon");
		expect(MissionCatalog.Get(15).phases[0].hazard?.effect).toBe("jam");
		expect(MissionCatalog.Get(18).phases.find((p)=>p.kind==="ace")!.twist?.insert[0].kind).toBe("defend");
		// Second objectives on the formerly single-phase sorties (round-2 backlog item 9).
		expect(MissionCatalog.Get(3).phases.filter((p)=>p.kind==="route").size()).toBe(2);
		expect(MissionCatalog.Get(3).phases.find((p)=>p.kind==="route" && p.ceiling!==undefined)!.ceiling).toBe(320);
		expect(MissionCatalog.ExpandedPhases(MissionCatalog.Get(7)).some((p)=>p.kind==="chase" && p.seconds===90)).toBe(true);
		expect(MissionCatalog.Get(8).phases[2].kind).toBe("required_ground");expect(MissionCatalog.Get(8).phases[2].count).toBe(2);
		expect(MissionCatalog.ExpandedPhases(MissionCatalog.Get(10)).some((p)=>p.directed===true && p.kind==="required_ground")).toBe(true);
		expect(MissionCatalog.Get(20).phases.find((p)=>p.kind==="escort")!.hazard?.effect).toBe("guns");expect(MissionCatalog.Get(20).phases.find((p)=>p.kind==="escort")!.hazard?.count).toBe(2);
		expect(MissionCatalog.Get(23).phases[0].kind).toBe("defend");
		expect(MissionCatalog.Get(26).phases[0].flank).toBe(true);expect(MissionCatalog.Get(26).phases[0].groups).toBe(2);
	});
	it("inserts a twist's phases, queues its radio call and keeps the objective totals honest",()=>{
		// M10: the recon is cut short the moment the camp spots you (mode "now").
		const recon=BlueprintRunner.NewState(MissionCatalog.Get(10),0);
		const authored=MissionCatalog.Get(10).phases.size();
		recon.phaseIndex=0;const scan=BlueprintRunner.ActivePhase(recon)!;expect(scan.kind).toBe("recon");
		const point=BlueprintRunner.NavigationPoint(recon)!;let clock=0;
		while(recon.phaseIndex===0 && clock<60){clock+=.1;BlueprintRunner.ObserveFlight(recon,point,point,.1,clock);}
		expect(recon.phaseIndex).toBe(1);
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
		expect(MissionCatalog.MaxOptionalRaiders(MissionCatalog.Get(12))).toBe(4+4+2+1);
		// A twist that fires on completion (at: 1) hands over to the inserted phase, never to the one after it.
		const finale=BlueprintRunner.NewState(MissionCatalog.Get(27),0);finale.phaseIndex=1;
		BlueprintRunner.RecordKill(finale,"relay","ground",true,1);
		expect(BlueprintRunner.ActivePhase(finale)!.label).toBe("Break the Marshal's personal escort");
		expect(BlueprintRunner.TakeRadio(finale)).toBe(MissionCatalog.Get(27).phases[1].twist!.text);
	});
	it("ends every mission on a terminal phase whose completion wins the sortie",()=>{
		for(const bp of MISSIONS){
			testCheckpoint();
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
						testCheckpoint();
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
			testCheckpoint();
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
			testCheckpoint();
			const phase=expanded[index];if(!phase.points)continue;
			const run=BlueprintRunner.NewState(bp,0);run.phases=expanded;run.phaseIndex=index;
			const flight=FlightMath.NewState();let clock=0;
			while(run.phaseIndex===index && run.outcome===undefined && clock<240){
				testCheckpoint();
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
	it("requires the landing scan, ace fight, climb and final broadcast in that order",()=>{
		const bp=MissionCatalog.Get(27),state=BlueprintRunner.NewState(bp,0);
		for(let i=0;i<2;i++)BlueprintRunner.RecordKill(state,`wing${i}`,"air",true,1+i);
		BlueprintRunner.RecordKill(state,"relay","ground",true,5);
		expect(BlueprintRunner.RecordKill(state,"marshal","ace",true,6)).toBe(false);
		for(let i=0;i<2;i++)BlueprintRunner.RecordKill(state,`escort${i}`,"air",true,7+i);
		expect(BlueprintRunner.ActivePhase(state)?.kind).toBe("recon");
		expect(BlueprintRunner.RecordKill(state,"marshal","ace",true,10)).toBe(false);
		let now=10;
		while(BlueprintRunner.ActivePhase(state)?.kind==="recon"){
			testCheckpoint();
			const point=BlueprintRunner.NavigationPoint(state)!;now+=.1;
			BlueprintRunner.ObserveFlight(state,point,point,.1,now);
		}
		expect(BlueprintRunner.RecordKill(state,"marshal","ace",true,now)).toBe(true);
		expect(state.outcome).toBeUndefined();expect(BlueprintRunner.ActivePhase(state)?.kind).toBe("route");
		while(BlueprintRunner.ActivePhase(state)?.kind==="route"){
			testCheckpoint();
			const point=BlueprintRunner.NavigationPoint(state)!;now+=.1;
			BlueprintRunner.ObserveFlight(state,point,point,.1,now);
		}
		expect(BlueprintRunner.ActivePhase(state)?.kind).toBe("signal");
		expect(BlueprintRunner.ActivePhase(state)?.seconds).toBe(60);
		expect(state.outcome).toBeUndefined();
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
			testCheckpoint();
			const state=BlueprintRunner.NewState(bp,10);BlueprintRunner.Tick(state,30);BlueprintRunner.Tick(state,20);
			expect(state.elapsed).toBe(20);BlueprintRunner.Tick(state,limit+9);expect(state.outcome).toBeUndefined();
			BlueprintRunner.Tick(state,limit+10);expect(state.reason).toBe("timeout");
			expect(BlueprintRunner.RecordKill(state,"late","air",true,limit+11)).toBe(false);
			BlueprintRunner.Tick(state,20,0);expect(state.reason).toBe("timeout");
			const destroyed=BlueprintRunner.NewState(bp,0);BlueprintRunner.Tick(destroyed,1,0);expect(destroyed.reason).toBe("destroyed");
		}
	});



});

describe("Mission structure review contracts", () => {
	it("keeps quiet holds short and flies to fresh garrison and fuel-hose positions", () => {
		for (const bp of MISSIONS) for (const phase of MissionCatalog.ExpandedPhases(bp)) {
			testCheckpoint();
			if (phase.kind === "signal" && (phase.optionalRaiders ?? 0) === 0 && !phase.hazard) expect(phase.seconds! <= 20).toBe(true);
		}
		for (const id of [15, 22]) {
			testCheckpoint();
			const phases = MissionCatalog.ExpandedPhases(MissionCatalog.Get(id));
			const lastScan = phases.filter((p) => p.kind === "recon").pop()!;
			const previous = phases.filter((p) => p !== lastScan && (id === 15 ? p.kind === "route" : p.kind === "recon"))[0];
			for (const point of lastScan.points!) expect(previous.points!.some((other) => math.abs(point.x - other.x) < 200 && math.abs(point.z - other.z) < 200)).toBe(false);
		}
	});

});
