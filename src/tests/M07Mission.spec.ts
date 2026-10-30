import { describe, expect, it } from "@rbxts/jest-globals";
import { MissionCatalog, MISSIONS } from "../shared/MissionCatalog";
import { M07_TARGETS, M07_SCENERY_ID } from "../shared/missions/m07";
import { M07, m07TargetLayout, m07Height } from "../shared/M07WorldPlan";
import { canyonSampleSafe, artilleryExposed, newArtillery, stepArtillery } from "../shared/EngineBatchD3";
import { BlueprintRunner as Runner } from "../shared/BlueprintRunner";
import { TargetScore } from "../shared/TargetScore";
import { recordScoredKill } from "../server/SortieScore";
import { CampaignCoordinator, completeMission, normalizeProfile, serializeProfile } from "../server/CampaignRepository";
import { canLaunchMission } from "../shared/CampaignProgress";
import { MISSION_STORY_TEXT } from "../shared/StoryMissionText";
const bp = MissionCatalog.Get(7), strike = bp.phases[0], escape = bp.phases[1], plan = escape.canyonEscape!;
const required = M07_TARGETS.filter(t => t.required);
function clear(s: ReturnType<typeof Runner.NewState>, ledger: TargetScore, time = 400) {
 for (const t of required) recordScoredKill(s, ledger, t.id, "ground", true, time, t.scoreRole);
}
function earlier(fn: () => void) {
 const before = MISSIONS.map(m => m.available);
 for (let i = 0; i < 6; i++) MISSIONS[i].available = true;
 const [ok, err] = pcall(fn);
 for (let i = 0; i < MISSIONS.size(); i++) MISSIONS[i].available = before[i];
 if (!ok) error(err, 0);
}
function finish(c: CampaignCoordinator, id: number, phases = MissionCatalog.TotalPhases(MissionCatalog.Get(id)), elapsed = 100, ledger?: TargetScore) {
 return completeMission(c, 1, id, true, { slot: 1, missionId: id, kills: MissionCatalog.RequiredAirKills(MissionCatalog.Get(id)) + MissionCatalog.RequiredGroundKills(MissionCatalog.Get(id)), groundKills: MissionCatalog.RequiredGroundKills(MissionCatalog.Get(id)), completedPhases: phases, elapsed, targetScore: ledger?.Snapshot() }, () => undefined, 0);
}
describe("Mission 7 array strike and canyon escape", () => {
 it("validates 51 unique adopted ground ids, all installation roles and original subtitle story", () => {
  MissionCatalog.ValidatePolicy(bp);
  expect(bp.available).toBe(true); expect(bp.worldKey).toBe("m07_two_ridges"); expect(bp.countdownSeconds).toBe(900);
  expect(M07_TARGETS.size()).toBe(51); expect(required.size()).toBe(3);
  expect(new Set(M07_TARGETS.map(t => t.id)).size()).toBe(51);
  expect(M07_TARGETS.some(t => t.id === M07_SCENERY_ID)).toBe(false);
  for (const t of M07_TARGETS) {
   const pose = m07TargetLayout().find(p => p.id === t.id)!;
   expect(t.position).toEqual({ x: pose.x, y: pose.y, z: pose.z });
  }
  expect(required.reduce((n,t) => n + bp.scoring!.points[t.scoreRole], 0)).toBe(340);
  expect(bp.briefing).toBe(MISSION_STORY_TEXT[7].briefing); expect(strike.beat).toBe(MISSION_STORY_TEXT[7].radio[0]);
  expect(escape.update!.radio[0]).toBe(MISSION_STORY_TEXT[7].radio[1]); expect(bp.allies!.mayKill).toBe(false);
  expect(bp.pressure!.playerPriority).toBe(0.8);
 });
 it("keeps the finite 11-air roster and every rank reachable below the 2,050-point maximum", () => {
  expect(strike.fighterWaves!.reduce((n,w) => n+w.count, 1)).toBe(11);
  const ground = M07_TARGETS.reduce((n,t) => n + bp.scoring!.points[t.scoreRole], 0);
  const air = strike.fighterWaves!.reduce((n,w) => n + w.count * bp.scoring!.points[w.scoreRole], 240);
  expect(ground).toBe(1240); expect(air).toBe(810); expect(ground+air).toBe(2050);
  expect(bp.scoring!.rank.S).toBe(1600); expect(ground+air >= bp.scoring!.rank.S).toBe(true);
 });
 it("requires every installation, resets only the phase clock and credits each id once", () => {
  const s = Runner.NewState(bp, 0), ledger = new TargetScore(bp.scoring!);
  recordScoredKill(s, ledger, M07_TARGETS[0].id, "ground", false, 100, "solar_panel");
  expect(s.phaseIndex).toBe(0); clear(s, ledger);
  expect(s.phaseIndex).toBe(1); expect(s.updateSerial).toBe(1); expect(s.elapsed).toBe(400); expect(Runner.TimeRemaining(s)).toBe(300);
  expect(ledger.Total()).toBe(355); clear(s, ledger); expect(ledger.Total()).toBe(355); expect(s.updateSerial).toBe(1);
  Runner.ObserveFlight(s, {x:0,y:700,z:11500}, {x:0,y:700,z:11540}, 0.1, 500); expect(s.outcome).toBeUndefined();
  Runner.ObserveFlight(s, {x:0,y:200,z:11540}, {x:0,y:200,z:11500}, 0.1, 501); expect(s.outcome).toBeUndefined();
  Runner.ObserveFlight(s, {x:0,y:200,z:11500}, {x:0,y:200,z:11540}, 0.1, 502); expect(s.outcome).toBe("won");
 });
 it("audits every centreline leg at 32-stud spacing below the world ceiling, with clearance", () => {
  expect(plan.ceiling).toBe(M07.artilleryCeiling);
  for (let i = 1; i < plan.channel.size(); i++) {
   const a=plan.channel[i-1], b=plan.channel[i], steps=math.ceil(math.sqrt((b.x-a.x)**2+(b.z-a.z)**2)/32);
   for (let j=0;j<=steps;j++) {
    const t=j/steps, p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
    expect(canyonSampleSafe(plan,p,m07Height(p.x,p.z))).toBe(true);
   }
  }
  expect(artilleryExposed(plan,200,false)).toBe(true); expect(artilleryExposed(plan,200,true)).toBe(false);
  expect(artilleryExposed(plan,plan.ceiling+1,true)).toBe(true);
  const battery=newArtillery(); expect(stepArtillery(battery,plan,1).warning).toBe(true);
  expect(stepArtillery(battery,plan,7).countdown).toBe(true); expect(stepArtillery(battery,plan,7).impact).toBe(true);
 });
 it("fails strike expiry, independent escape expiry and destruction in either phase", () => {
  const strikeTimeout=Runner.NewState(bp,0); Runner.Tick(strikeTimeout,900); expect(strikeTimeout.reason).toBe("timeout");
  const slow=Runner.NewState(bp,0); clear(slow,new TargetScore(bp.scoring!)); Runner.Tick(slow,699.9); expect(slow.outcome).toBeUndefined(); Runner.Tick(slow,700); expect(slow.reason).toBe("timeout");
  for (const escaping of [false,true]) { const s=Runner.NewState(bp,0); if(escaping)clear(s,new TargetScore(bp.scoring!)); Runner.Tick(s,escaping?401:1,0); expect(s.reason).toBe("destroyed"); }
 });
 it("unlocks after fixtures completing 1–6, settles only full wins and preserves score across save", () => earlier(() => {
  const c=new CampaignCoordinator("m07-unlock",undefined,{now:()=>1000,defer:()=>undefined}); c.load();
  for(let id=1;id<=5;id++) finish(c,id);
  expect(canLaunchMission(7,c.getSlots()[0])).toBe(false); finish(c,6); expect(canLaunchMission(7,c.getSlots()[0])).toBe(true);
  finish(c,7,1); expect(c.getSlots()[0].missions?.[7]?.completed === true).toBe(false);
  finish(c,7,2,1200); expect(c.getSlots()[0].missions?.[7]?.completed === true).toBe(false);
  const ledger=new TargetScore(bp.scoring!); for(const t of M07_TARGETS)ledger.RecordKill(t.id,t.scoreRole);
  finish(c,7,2,550,ledger);
  const saved=normalizeProfile(serializeProfile({version:3,slots:c.getSlots()})).slots[0].missions![7];
  expect(saved.completed).toBe(true); expect(saved.bestScore).toBe(1240); expect(saved.bestTargetScore?.total).toBe(1240);
  expect(canLaunchMission(8,c.getSlots()[0])).toBe(false);
 }));
});
