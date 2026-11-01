import { describe, expect, it } from "@rbxts/jest-globals";
import { LogService, Players, Workspace } from "@rbxts/services";
import { CombatService, installCampaignSmokeCombat } from "../server/CombatService";
import { CampaignService, installCampaignSmokePlayer } from "../server/CampaignService";
import { CampaignCoordinator } from "../server/CampaignRepository";
import { worldLifecycle } from "../server/WorldLifecycleRuntime";
import { stepCruise } from "../server/EngineBatchD10Runtime";
import { newVent } from "../shared/EngineBatchD13";
import { WorldAssets } from "../server/WorldAssets";
import { MissionCatalog } from "../shared/MissionCatalog";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { BomberRules } from "../shared/BomberRules";
import { WavePlan } from "../shared/WavePlan";
import { takeArrival } from "../shared/CampaignEncounters";
import { canLaunchMission } from "../shared/CampaignProgress";
import { nextResultMission } from "../shared/ResultContinuation";
import { MissionFinished, Remotes } from "../shared/Types";
import { assertSmokeAdoption, assertSmokeSpawn, forceSmokeVictory } from "./helpers/CampaignSmoke";

// One sequential save, one actual world lease, no client, no DataStore, no Heartbeat.
// Full terrain stays enabled: this is a world integration test, not a plan/fixture test.
describe("campaign production launch → world → settlement → Next (Studio)", () => {
 it("flies a bounded smoke window for Practice and all 18 missions on one legitimate save", () => {
  const started = os.clock(), errors: string[] = [], results: MissionFinished[] = [];
  const log = LogService.MessageOut.Connect((message, kind) => {
   if (kind === Enum.MessageType.MessageError || (kind === Enum.MessageType.MessageWarning && (string.find(message,"SKYBREAK world lifecycle") !== undefined || string.find(message,"settlement:") !== undefined || string.find(message,"SKYBREAK mission construction failed") !== undefined))) errors.push(message);
  });
  const root = new Instance("Folder"); root.Name = "CampaignSmoke"; root.Parent = Workspace;
  // Roblox cannot construct Player instances without a client. Only identity and outbound transport are substituted.
  const player = { Name: "CampaignSmoke", UserId: -202, Parent: Players } as unknown as Player;
  const sink = { FireClient(_player: Player, packet: unknown) {
   if (typeIs(packet,"table") && ((packet as {kind?: string}).kind === "Completed" || (packet as {kind?: string}).kind === "Failed")) results.push(packet as MissionFinished);
  } };
  // Only outbound delivery is replaced; incoming calls use the real remote handler.
  const remotes = { MissionState: sink, FlightState: sink, Telemetry: sink, CombatEffect: sink } as unknown as Remotes;
  const coordinator = new CampaignCoordinator("campaign_smoke"); coordinator.load();
  const combat = installCampaignSmokeCombat(player, root, remotes, CampaignService.OnFinished);
  const campaign = installCampaignSmokePlayer(player, coordinator, remotes, CombatService);
  WorldAssets.SetPreloadTimeout(0); // existing test hook: do not wait on optional uploaded dressing
  print("CAMPAIGN_SMOKE | mission | build ms | targets | errors");
  try {
   expect(canLaunchMission(2,coordinator.getSlots()[0])).toBe(false);
   let buildStart = os.clock();
   expect(campaign.request("StartMission", {slot:1,missionId:0,launchId:1}).ok).toBe(true);
   for (let id = 0; id <= 18; id++) {
    const before = id===0 ? 0 : errors.size();
    const s = CombatService.GetSession(player)!;
    const buildMs = math.floor((os.clock()-buildStart)*1000);
    const [ok, problem] = pcall(() => {
     expect(s).toBeDefined(); expect(s.missionId).toBe(id); expect(s.folder.Parent).toBe(root);
     expect(buildMs).toBeLessThan(20000);
     const count = assertSmokeAdoption(s);
     assertSmokeSpawn(s);
     expect(s.blueprintState!.phaseIndex).toBe(0);
     expect(s.appliedBlueprintPhaseIndex).toBe(0);
     combat.begin(s);
     // Complete the authored fly-off before checking combat roles.
     for (let n=0; n<100 && s.launch; n++) combat.step(s,1/30);
     expect(s.launch).toBeUndefined();
     const phase = BlueprintRunner.ActivePhase(s.blueprintState!)!;
     combat.direct(s);
     if(phase.cruiseIntercept) for(const target of phase.cruiseIntercept.targets.filter(t=>t.parentId===undefined && (t.arrivalSeconds ?? 0)<=1/30)) {
      const contact=s.enemies.find(e=>e.id===target.id)!;
      expect(contact).toBeDefined(); expect(contact.cruiseTarget).toBe(true);
      expect(contact.model.Parent).toBe(s.folder); expect(combat.damageable(s,contact)).toBe(true);
     }
     if (phase.bombers) {
      const due = phase.bombers.arrivalSeconds?.filter(t=>t<=0).size() ?? phase.bombers.count;
      expect(s.enemies.filter(e=>e.enabled && e.role===BomberRules.Role.role && e.required).size()).toBe(due);
     } else if (phase.kind==="required_air" && !phase.cruiseIntercept && !phase.fighterWaves?.some(w=>w.required) && phase.execution?.launchDelay===undefined) {
      const due=phase.execution?.directSpawn ? phase.count ?? 0 : WavePlan.Groups(phase.count ?? 0,phase.groups ?? 1)[0] ?? 0;
      expect(s.enemies.filter(e=>e.enabled && e.required && e.role==="bandit").size()+s.airQueue.filter(w=>w.role==="bandit").reduce((n,w)=>n+w.count,0)).toBe(due);
     }
     const fired = new Set<string>();
     for (const arrival of [...(phase.fighterWaves ?? []), ...(phase.standaloneAce ? [phase.standaloneAce] : [])]) {
      if (takeArrival(arrival.id,arrival.trigger,{elapsed:0,phase:0,requiredKills:0,destroyed:new Set(),targets:s.arrivalTargets ?? [],player:{x:s.state.x,z:s.state.z}},fired)) expect(s.arrivalsFired?.has(arrival.id)).toBe(true);
     }
     // A deterministic holding pilot prevents unattended straight flight into mountains.
     // Movement, collision, directors, weapons and timers still execute at production dt.
     const pose = {...s.state};
     for (let n=0;n<900;n++) {
      expect(s.crashReason).never.toBe("internal_error");
      expect(s.active).toBe(true);
      s.state={...pose}; s.health=100; s.lastInput=os.clock();
      s.blueprintState!.startedAt=os.clock()-n/30;
      combat.step(s,1/30); combat.flush(s);
     }
     expect(s.crashReason).never.toBe("internal_error");
     expect(s.stepCount).toBeGreaterThanOrEqual(900);
     // Later contacts are intentionally hidden until their owning phase. Apply each phase
     // through the production director, then check every enabled required contact's ownership.
     const phases = MissionCatalog.ExpandedPhases(s.blueprint!);
     s.blueprintState!.phases = phases;
     for(let index=0;index<phases.size();index++) {
      s.blueprintState!.phaseIndex=index; s.blueprintState!.phaseProgress=0;
      s.blueprintState!.outcome=undefined; s.elapsed=0; combat.apply(s);
      // Staggered bombers are materialized by the same generalized arrival director.
      const b=phases[index].bombers;
      if(b) {
       s.elapsed=math.max(0,...(b.arrivalSeconds ?? [0]));
       if(s.bomberEncounter) s.bomberEncounter.startedAt=0;
       combat.direct(s);
       for(const targetId of b.targetIds ?? []) {
        const contact=s.enemies.find(e=>e.id===targetId)!;
        expect(contact).toBeDefined(); expect(combat.owns(s,contact)).toBe(true);
        expect(contact.model.PrimaryPart).toBeDefined(); expect(contact.role).toBe(BomberRules.Role.role);
       }
      }
      const cruise=phases[index].cruiseIntercept;
      if(cruise) {
       stepCruise(s,1/30);
       for(let t=0;t<cruise.targets.size();t++) {
        const spec=cruise.targets[t];
        const runtime=s.cruise!;
        if(spec.parentId===undefined) { runtime.elapsed=math.max(runtime.elapsed,spec.arrivalSeconds ?? 0); stepCruise(s,1/30); }
        const contact=runtime.actors.get(t)!;
        expect(contact).toBeDefined(); expect(contact.id).toBe(spec.id);
        expect(contact.model.Parent).toBe(s.folder); expect(combat.damageable(s,contact)).toBe(true);
        // Carrier separation also uses its live director; child identities must be adopted.
        if(spec.separateSeconds!==undefined) { runtime.states[t].elapsed=spec.separateSeconds; stepCruise(s,1/30); }
       }
      }
      if(phases[index].kind==="tutorial_missile") {
       const practiceTargets=s.enemies.filter(e=>e.kind==="ground" && e.required && e.enabled);
       expect(practiceTargets.size()).toBe(1);
       expect(combat.damageable(s,practiceTargets[0])).toBe(true);
      }
      const vent=phases[index].batchD13?.vent;
      if(vent) {
       const core=s.enemies.find(e=>e.id===vent.core)!;
       expect(core).toBeDefined(); expect(combat.owns(s,core)).toBe(false);
       s.blueprintState!.vent={...newVent(),elapsed:vent.openingSeconds,checkpoint:vent.checkpoints.size()};
       expect(combat.owns(s,core)).toBe(true); expect(combat.damageable(s,core)).toBe(true);
      }
      for(const e of s.enemies.filter(e=>e.required && e.enabled && e.health>0 && e.withdrawUntil===undefined)) {
       expect(combat.owns(s,e)).toBe(true);
       if(e.kind==="ground" && e.phaseOwner===index ) expect(combat.damageable(s,e)).toBe(true);
      }
     }
     forceSmokeVictory(s); combat.finish(s);
     expect(CombatService.IsCompleting(player)).toBe(true);
     // Issue Next while the result is still settling: the real request must wait,
     // commit fresh progression, release the old session and build the next world.
     buildStart=os.clock();
     const nextMission=nextResultMission(true,id);
     if(nextMission!==undefined) expect(campaign.request("StartMission",{slot:1,missionId:nextMission,launchId:id+2}).ok).toBe(true);
     else {
      const deadline=os.clock()+10;
      while(CombatService.IsCompleting(player) && os.clock()<deadline) task.wait();
      expect(CombatService.GetSession(player)).toBeUndefined();
      expect(coordinator.getSlots()[0].missions?.[18]?.completed).toBe(true);
      expect(coordinator.getSlots()[0].completed).toBe(true);
     }
     expect(s.cleaned).toBe(true); expect(s.folder.Parent).toBeUndefined();
     expect(root.GetChildren().size()).toBe(nextMission===undefined ? 0 : 1);
     expect(results[id].kind).toBe("Completed"); expect(results[id].missionId).toBe(id);
     expect(errors.size()).toBe(before);
     print(`CAMPAIGN_SMOKE | ${id} | ${buildMs} | ${count} | ${errors.size()-before}`);
    });
    if(!ok) { print(`CAMPAIGN_SMOKE | ${id} | ${buildMs} | ${s?.enemies.size() ?? 0} | FAIL ${tostring(problem)}; ${errors.join("; ")}`); error(problem); }
   }
   expect(os.clock()-started).toBeLessThan(290);
  } finally {
   CombatService.EndMission(player);
   expect(worldLifecycle.AwaitIdle(45)).toBe(true);
   WorldAssets.SetPreloadTimeout(); campaign.restore(); combat.restore();
   root.Destroy(); log.Disconnect();
  }
 }, 300000);
});
