import { takeArrival, FighterArrival, StandaloneAce } from "../shared/CampaignEncounters";
import type { AceLivery } from "../shared/AssetSelection";
import { BomberRules, BomberSlotPose } from "../shared/BomberRules";
import { bomberEscortPose, compileBomberEncounter, laterEscortsDue, reinforcementFraction } from "../shared/BomberEncounter";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionPhaseBlueprint } from "../shared/MissionCatalog";
import { WavePlan, AirRequest } from "../shared/WavePlan";
import { Difficulty } from "../shared/Difficulty";
import { AceRules } from "../shared/AceRules";
import { MissionAssets } from "../shared/MissionAssets";
import { JetFactory } from "../shared/JetFactory";
import { AircraftCollision } from "./AircraftCollision";
import { ActorGrounding } from "./ActorGrounding";
import type { CombatSession, AirRole, Enemy } from "./CombatSession";
import { fixedRaiders } from "./PhaseDirectorRules";

export interface SpawnOptions {
	arrival?: FighterArrival | StandaloneAce;
	livery?: AceLivery;
	friendly?: boolean;
	pose?: BomberSlotPose;
	bomberSlot?: number;
	escortSlot?: number;
	name?: string;
	optional?: boolean;
	behind?: boolean;
	aceHealth?: number;
	escape?: Vector3;
}

/** Combat owns simulation and lifecycle; the director only requests their effects. */
export interface PhaseCombat {
	spawnAllies: (session: CombatSession) => void;
	spawnAir: (session: CombatSession, count: number, role: AirRole, options?: SpawnOptions) => void;
	activateGround: (session: CombatSession, start?: number, count?: number) => void;
	withdrawAirborne: (session: CombatSession) => void;
	liveAircraft: (session: CombatSession) => number;
	radio: (session: CombatSession, text: string, seconds?: number, priority?: boolean) => void;
	acquireTarget: (session: CombatSession) => void;
	publishDamageable: (session: CombatSession) => void;
	isCurrent: (session: CombatSession) => boolean;
}

/** Bound once by CombatService; no session registry or stepping clock is owned here. */
export function createPhaseDirector(combat: PhaseCombat) {
	const { spawnAir, activateGround, withdrawAirborne, liveAircraft, radio, acquireTarget, publishDamageable, isCurrent } = combat;
	/** Extra raiders per wave for the session's difficulty (Ace: one). */
	function extraRaiders(session: CombatSession): number { return Difficulty.Behaviour(session.difficulty).extraRaiders; }
	/** A raider wave of `count`, plus the difficulty's extra (Mission 2 keeps its fixed five). */
	function raiderWave(session: CombatSession, count: number): number {
		return count > 0 && !fixedRaiders(session.blueprint) ? count + extraRaiders(session) : count;
	}
	/** Spawns what the live-aircraft budget has room for now; the rest keeps waiting. */
	function drainAir(session: CombatSession): void {
		if (session.airQueue.size() === 0) return;
		const room = WavePlan.Budget(extraRaiders(session)) - liveAircraft(session);
		for (const batch of WavePlan.Admit(session.airQueue, room)) {
			if (batch.arrival) {
				const a=batch.arrival;
				spawnAir(session,batch.count,"aircraft" in a && a.aircraft ? "bomber" : batch.role,{ arrival:a, optional:true, name: "name" in a ? a.name : undefined, livery: "livery" in a ? a.livery : undefined, aceHealth: "health" in a ? a.health : undefined });
			} else if (session.bomberEncounter && (batch.role === "escort" || batch.role === "ace")) {
				const encounter = session.bomberEncounter;
				const leading = BomberRules.Sample(encounter.route, session.elapsed - encounter.startedAt).slots[0];
				for (let i = 0; i < batch.count; i++) {
					const slot = encounter.escortsSpawned++;
					spawnAir(session, 1, batch.role, { pose: bomberEscortPose(leading, slot), escortSlot: slot, optional: true, name: batch.role === "ace" ? BlueprintRunner.ActivePhase(session.blueprintState!)?.bombers?.escorts.aceName : undefined });
				}
			} else spawnAir(session, batch.count, batch.role, { behind: batch.behind });
			// A group's call goes out when it is really in the air, not when it was due.
			if (batch.call !== undefined) radio(session, batch.call);
		}
	}
	/** Bandits or raiders for missions 3-27: they spawn as the live-aircraft budget allows (WavePlan). */
	function requestAir(session: CombatSession, count: number, role: AirRequest["role"], behind = false, call?: string): void {
		if (count <= 0) return;
		session.airQueue.push({ role, count, behind, call });
		drainAir(session);
	}
	/** Names the escorted or defended actor for its HUD label. */
	function actorName(session: CombatSession, defend: boolean, coast: boolean): string {
		const names: { [id: number]: string } = { 5: "EVACUATION TRUCK", 8: "VARDA TOWER", 12: "TRANSMITTER TRUCK", 18: "MARINE PICKUP", 20: "EVIDENCE LAUNCH", 23: "COMMAND FRIGATE", 25: "LANDING CRAFT" };
		return names[session.missionId] ?? (coast ? "LOYALIST LAUNCH" : defend ? "LOYALIST TOWER" : "LOYALIST TRUCK");
	}

	// Blueprint-driven phase application for every mission.
	function applyBlueprintPhase(session: CombatSession): void {
		assert(session.blueprintState && session.blueprint, "blueprint phase application requires blueprint state");
		const state=session.blueprintState;
		if (state.outcome !== undefined || session.appliedBlueprintPhaseIndex === state.phaseIndex) return;
		session.appliedBlueprintPhaseIndex=state.phaseIndex;
		session.chatterIndex=0;
		session.reinforceIndex=0;
		session.wave=undefined;
		session.bomberEncounter=undefined;
		// Retire the old phase's pursuers: they visibly fly out instead of lingering, firing, or draining a convoy.
		if (!BlueprintRunner.ActivePhase(state)?.execution?.preservePursuers) withdrawAirborne(session);
		// Raiders still waiting belonged to the old phase (its bandits were all out, or it could not have ended).
		session.airQueue.clear();
		session.navigationMarker?.Destroy(); session.navigationMarker=undefined;
		session.navigationActor?.Destroy(); session.navigationActor=undefined; session.actorFooting=undefined;
		// The live list, not the catalog: twists splice new objectives in after the phase that fired them.
		const phases=BlueprintRunner.Phases(state);
		const phase: MissionPhaseBlueprint | undefined=phases[state.phaseIndex];
		if (!phase) return;
		for (const enemy of session.enemies) if (enemy.typedGround) {
			enemy.enabled=enemy.phaseOwner === state.phaseIndex && enemy.health>0;
			for(const item of enemy.model.GetDescendants()) if(item.IsA("BasePart")) {
				item.Transparency=enemy.enabled ? (item.GetAttribute("OriginalTransparency") as number ?? 0) : 1;
				item.CanQuery=enemy.enabled && item.GetAttribute("FlightSolid") === true;
			}
			enemy.model.SetAttribute("SkybreakEnemy",enemy.enabled);
			enemy.model.SetAttribute("RequiredTarget",enemy.enabled && enemy.required);
		}
		combat.spawnAllies(session);
		if (phase.execution?.activatePracticeTarget) activateGround(session);
		if (phase.kind === "required_ground" && phase.groundTargets === undefined) activateGround(session,MissionCatalog.GroundStart(phases,state.phaseIndex),phase.count ?? 0);
		else if (phase.bombers) {
			const b = phase.bombers;
			const route = compileBomberEncounter(b);
			session.bomberEncounter = { route, startedAt: session.elapsed, laterSpawned: false, escortsSpawned: 0 };
			const pose = BomberRules.Sample(route, 0);
			for (let i = 0; i < b.count; i++) spawnAir(session, 1, BomberRules.Role.role, { pose: pose.slots[i], bomberSlot: i });
			requestAir(session, b.escorts.initial, "escort");
		}
		else if (phase.kind === "required_air" && phase.execution?.launchDelay === undefined) {
			if (phase.execution?.directSpawn) spawnAir(session,phase.count ?? 0,"bandit");
			else {
			// Staggered groups: the first now, the rest by WavePlan.Due (stepSession).
			const plan=WavePlan.Groups(phase.count ?? 0,phase.groups ?? 1);
			session.wave={phaseIndex:state.phaseIndex,plan,next:1,lastAt:session.elapsed};
			requestAir(session,plan[0] ?? 0,"bandit");
			}
		}
		else if (phase.kind === "chase") spawnAir(session,phase.count ?? 1,"courier",{escape: phase.escape ? new Vector3(phase.escape.x,phase.escape.y,phase.escape.z) : undefined});
		else if (phase.kind === "ace") spawnAir(session,1,"ace",{aceHealth: session.blueprint.aceHealth ?? 165});
		// Ace phases hold their raiders back for the ace's stage calls; reinforced phases keep part of theirs for mid-phase.
		const initialRaiders=raiderWave(session,MissionCatalog.InitialRaiders(phase));
		if (phase.execution?.directSpawn) spawnAir(session,initialRaiders,"raider");
		else requestAir(session,initialRaiders,"raider");
		// A twist that changed the objective speaks first: radio() overwrites, so its call goes out now and
		// the new phase's beat follows a few seconds later (if the sortie is still on this phase). This runs
		// for both the tick path and the synchronous kill path (destroyEnemy -> advance -> applyPhase).
		let twisted=false;
		for (let line=BlueprintRunner.TakeRadio(state); line !== undefined; line=BlueprintRunner.TakeRadio(state)) { radio(session,line,7); twisted=true; }
		if (phase.beat !== undefined) {
			if (!twisted) radio(session, phase.beat, phase.execution?.launchDelay, phase.execution?.launchDelay !== undefined);
			else {
				const beat=phase.beat, index=state.phaseIndex;
				task.delay(4, () => { if (session.active && isCurrent(session) && state.phaseIndex === index && state.outcome === undefined) radio(session, beat); });
			}
		}
		const nav=BlueprintRunner.NavigationPoint(state);
		if (nav) {
			const marker=new Instance("Part"); marker.Name="Flight objective"; marker.Size=new Vector3(20,20,20); marker.Shape=Enum.PartType.Ball;
			marker.Anchored=true; marker.CanCollide=false; marker.CanTouch=false; marker.CanQuery=false;
			marker.Color=Color3.fromRGB(75,238,212); marker.Material=Enum.Material.Neon; marker.Transparency=.3;
			marker.Position=new Vector3(nav.x,nav.y,nav.z); marker.Parent=session.folder;
			marker.SetAttribute("ObjectiveRadius",phase.radius); marker.SetAttribute("ObjectiveCeiling",phase.ceiling);
			session.navigationMarker=marker;
			const gui=new Instance("BillboardGui"); gui.Size=UDim2.fromOffset(160,38); gui.AlwaysOnTop=true; gui.StudsOffsetWorldSpace=new Vector3(0,30,0); gui.Parent=marker;
			const label=new Instance("TextLabel"); label.Size=UDim2.fromScale(1,1); label.BackgroundTransparency=.25;
			label.BackgroundColor3=Color3.fromRGB(7,23,30); label.TextColor3=marker.Color; label.Text=phase.kind === "route" ? "FLIGHT BEACON" : phase.kind === "escort" ? "PROTECT CONVOY" : phase.kind === "defend" ? "PROTECT SITE" : "SIGNAL VOLUME";
			label.TextSize=13; label.Font=Enum.Font.GothamBold; label.Parent=gui;
			if (phase.kind === "escort" || phase.kind === "defend" || phase.parkedEscort !== undefined) {
				const actorPoint=phase.parkedEscort ?? nav;
				const coast=session.blueprint.region === "coastal_city" || session.blueprint.region === "coastal_harbor" || session.blueprint.region === "ocean_platform";
				const name=actorName(session,phase.kind === "defend",coast);
				const actor=coast ? MissionAssets.CreateHarborLaunch(name) : phase.kind === "defend" ? MissionAssets.CreateCommsRelay(name) : MissionAssets.CreateRelayTruck(name);
				if (!session.active || !session.folder.Parent) {actor.Destroy(); return;}
				// The escorted vehicle moves every step: weld it so one part replicates per move.
				JetFactory.WeldAssembly(actor);
				// Grounded from its own bounds and the surface under it: wheels on the road, a hull at the waterline.
				const footing=ActorGrounding.Footing(actor,coast);
				session.actorFooting=footing;
				const y=session.groundParams ? ActorGrounding.PivotY(footing,actorPoint.x,actorPoint.z,session.groundParams,actorPoint.y) : actorPoint.y;
				actor.SetAttribute("ProtectedObjective",true); actor.Parent=session.folder; session.navigationActor=actor;
				actor.PivotTo(new CFrame(actorPoint.x,y,actorPoint.z));
			}
		}
		// Refresh only at phase transitions: includes new protected actors and drops destroyed ones.
		session.collisionParams = AircraftCollision.Parameters(session.folder);
		acquireTarget(session);
	}

	function applyPhase(session: CombatSession): void {
		const before = session.appliedBlueprintPhaseIndex;
		applyBlueprintPhase(session);
		// A phase change flips which enemies are damageable; box them now, not at the next telemetry tick.
		if (session.appliedBlueprintPhaseIndex !== before) publishDamageable(session);
	}

	/** A retreated ace calls the raiders its phase holds for this stage. */
	function aceCall(session: CombatSession, enemy: Enemy): void {
		const phase = session.blueprintState ? BlueprintRunner.ActivePhase(session.blueprintState) : undefined;
		const total = phase?.kind === "ace" ? phase.optionalRaiders ?? 0 : 0;
		const count = raiderWave(session, AceRules.RaidersForStage(total, enemy.aceState?.stage ?? 0));
		if (count <= 0) return;
		radio(session, `SERA: ${enemy.name} pulled back to call his wing. ${count} inbound.`);
		if (session.blueprintState) requestAir(session, count, "raider", true);
		else spawnAir(session, count, "raider", { behind: true });
		// Hand the lock to the wing; the ace is out of reach until it turns back in.
		if (session.target === enemy) acquireTarget(session);
	}
	/** Mission 1 target step: after 8 s without a TGT press, say what the step wants. Auto-selection never skips it. */
	function stepTutorialHint(session: CombatSession): void {
		if (session.blueprintState && BlueprintRunner.ActivePhase(session.blueprintState)?.kind === "tutorial_move" && session.elapsed >= (session.practiceHintAt ?? 6)) {
			session.practiceHintAt = session.elapsed + 10;
			radio(session, "Release holds the nose. Tap opposite pitch to level; avoid long holds.");
		}
		if (!session.blueprintState || BlueprintRunner.ActivePhase(session.blueprintState)?.kind !== "tutorial_target") { session.targetStepSince = undefined; return; }
		if (session.targetStepSince === undefined) session.targetStepSince = session.elapsed;
		if (session.targetStepHinted || session.elapsed - session.targetStepSince < 8) return;
		session.targetStepHinted = true;
		radio(session, "Select the radar: TGT / Tab / Y");
	}
	function launchDue(session: CombatSession): void {
		// Mission 1: the bandits launch a radio beat after the training radar dies.
		if (session.blueprintState && !session.tutorialBanditsSpawned && BlueprintRunner.BanditsDue(session.blueprintState)) {
			session.tutorialBanditsSpawned = true;
			radio(session, BlueprintRunner.LiveWarning, 6, true);
			spawnAir(session, BlueprintRunner.ActivePhase(session.blueprintState)!.count ?? 0, "bandit");
			acquireTarget(session);
		}
	}

	function step(session: CombatSession): void {
		const bs = session.blueprintState!;
		// Mid-phase "after" twists do not change phase, so applyBlueprintPhase never sees their radio: drain it here.
		for (let line=BlueprintRunner.TakeRadio(bs); line !== undefined; line=BlueprintRunner.TakeRadio(bs)) radio(session,line,7);
		const active=BlueprintRunner.ActivePhase(bs);
  if(active?.jamming) { const count=session.enemies.filter(e=>e.enabled && e.health>0 && e.withdrawUntil===undefined && e.routeActor?.jammer).size(); if(session.jammerCount!==undefined && count<session.jammerCount) radio(session,count>0 ? active.jamming.remainingCall : active.jamming.clearCall); session.jammerCount=count; } else session.jammerCount=undefined;
		if (active && bs.outcome === undefined && ((active.fighterWaves?.size() ?? 0)>0 || active.standaloneAce !== undefined)) {
			if (!session.arrivalTargets) {
				session.arrivalTargets=[];
				for (const phase of MissionCatalog.ExpandedPhases(bs.blueprint)) for (const target of phase.groundTargets ?? []) session.arrivalTargets.push(target);
			}
			const fired=session.arrivalsFired ?? new Set<string>(); session.arrivalsFired=fired;
			const context={ elapsed:session.elapsed, phase:bs.phaseIndex, requiredKills:bs.requiredAirKills+bs.requiredGroundKills+(bs.aceKilled ? 1 : 0), destroyed:bs.killedIds, targets:session.arrivalTargets, player:{ x:session.state.x, z:session.state.z } };
			for(const arrival of [...(active.fighterWaves ?? []), ...(active.standaloneAce ? [active.standaloneAce] : [])]) {
				if(takeArrival(arrival.id,arrival.trigger,context,fired)) session.airQueue.push({ arrival, role: "name" in arrival ? "ace" : arrival.role, count: "name" in arrival ? 1 : arrival.count, behind:false, call: arrival.call });
			}
		}
		for(const enemy of session.enemies) if(enemy.routeActor && enemy.enabled && enemy.health>0 && enemy.withdrawUntil===undefined) {
   const pose=BomberRules.Sample(enemy.routeActor.route,session.elapsed-enemy.routeActor.startedAt).slots[0];
   enemy.position=new Vector3(pose.position.x,pose.position.y,pose.position.z); enemy.direction=new Vector3(pose.facing.x,pose.facing.y,pose.facing.z); enemy.velocity=enemy.direction.mul(enemy.routeActor.route.speed); enemy.frame=CFrame.lookAt(enemy.position,enemy.position.add(enemy.direction));
  }
		if (active) {
			const encounter = session.bomberEncounter;
			if (active.bombers && encounter) {
				const pose = BomberRules.Sample(encounter.route, session.elapsed - encounter.startedAt);
				if (pose.escaped) { BlueprintRunner.EscapeBombers(bs); radio(session, active.bombers.escapeCall ?? "The bombers are through."); return; }
				if (laterEscortsDue(active.bombers, encounter, session.elapsed)) {
					requestAir(session, 1, "ace");
					requestAir(session, active.bombers.escorts.count - active.bombers.escorts.initial - 1, "escort");
				}
				for (const enemy of session.enemies) {
					if (!enemy.enabled || enemy.health <= 0 || enemy.withdrawUntil !== undefined) continue;
					const slot = enemy.bomberSlot ?? enemy.escortSlot;
					if (slot === undefined) continue;
					if (enemy.escortSlot !== undefined) {
						const player = new Vector3(session.state.x, session.state.y, session.state.z);
						if (enemy.health < enemy.maxHealth || player.sub(enemy.position).Magnitude <= 2300 || session.projectiles.some((p) => !p.hostile && p.target === enemy)) enemy.escortEngaged = true;
						if (enemy.escortEngaged) continue;
					}
					const p = enemy.escortSlot !== undefined ? bomberEscortPose(pose.slots[0], enemy.escortSlot) : pose.slots[slot];
					enemy.position = new Vector3(p.position.x, p.position.y, p.position.z);
					enemy.direction = new Vector3(p.facing.x, p.facing.y, p.facing.z);
					enemy.velocity = enemy.direction.mul(encounter.route.speed);
					enemy.frame = CFrame.lookAt(enemy.position, enemy.position.add(enemy.direction));
				}
			}
			const fraction=BlueprintRunner.Fraction(bs);
			// Anything held back by the live-aircraft budget takes the slots kills have freed.
			drainAir(session);
			// Mid-phase raider waves, in authored order (each one larger on Ace).
			const waves=active.reinforce;
			const waveFraction = reinforcementFraction(fraction, session.elapsed - (encounter?.startedAt ?? 0), encounter?.route);
			while (waves && session.reinforceIndex < waves.size() && waveFraction >= waves[session.reinforceIndex].at) {
				requestAir(session,raiderWave(session,waves[session.reinforceIndex].count),"raider",true);
				session.reinforceIndex += 1;
			}
			// Staggered bandit groups: the next comes after `stagger` seconds, once half the last is down, or at its
			// authored share of the phase. A group still waiting for slots holds the next one back.
			const wave=session.wave;
			if (wave && wave.phaseIndex === bs.phaseIndex && WavePlan.Queued(session.airQueue,"bandit") === 0
				&& WavePlan.Due({next:wave.next,plan:wave.plan,sinceLast:session.elapsed-wave.lastAt,stagger:active.stagger ?? WavePlan.DefaultStagger,killed:bs.phaseProgress,groupAt:active.groupAt})) {
				requestAir(session,wave.plan[wave.next],"bandit",active.flank === true,active.groupCalls?.[wave.next-1]);
				wave.next += 1; wave.lastAt=session.elapsed;
			}
			// A hazard lit by the runner (jammers, bank guns): reveal its ground targets and make them strikeable.
			if (active.hazard && bs.hazardFired && session.hazardPhase !== bs.phaseIndex) {
				session.hazardPhase=bs.phaseIndex;
				activateGround(session,MissionCatalog.GroundStart(BlueprintRunner.Phases(bs),bs.phaseIndex),active.hazard.count);
				publishDamageable(session);
				acquireTarget(session);
			}
			const chatter=active.chatter;
			if (chatter) while (session.chatterIndex < chatter.size() && fraction >= chatter[session.chatterIndex].at) {
				radio(session,chatter[session.chatterIndex].text);
				session.chatterIndex += 1;
			}
		}
		const point=BlueprintRunner.NavigationPoint(bs);
		if (point && session.navigationMarker) {
			const pos=new Vector3(point.x,point.y,point.z);
			session.navigationMarker.Position=pos;
			const actor=session.navigationActor;
			// A defended site stays where it was grounded; an escorted vehicle re-grounds as it moves.
			if(actor && BlueprintRunner.ActivePhase(bs)!.kind === "escort") {
				const old=actor.GetPivot().Position;
				const direction=new Vector3(pos.X-old.X,0,pos.Z-old.Z);
				const y=session.actorFooting && session.groundParams ? ActorGrounding.PivotY(session.actorFooting,pos.X,pos.Z,session.groundParams,pos.Y) : pos.Y;
				const current=new Vector3(pos.X,y,pos.Z);
				session.actorFrame = direction.Magnitude>.01 ? CFrame.lookAt(current,current.add(direction)) : new CFrame(current);
			}
		}
	}
	return { Apply: applyPhase, Step: step, LaunchDue: launchDue, TutorialHint: stepTutorialHint, AceCall: aceCall };
}
