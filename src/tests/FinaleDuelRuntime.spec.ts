import { createCombatSession } from "../server/CombatSessionFactory";
import { describe, expect, it } from "@rbxts/jest-globals";
import { stepEnemies, stepMissiles } from "../server/CombatService";
import { FlightMath } from "../shared/FlightMath";
import { Workspace } from "@rbxts/services";
import { stepFinaleDuel, finaleTargetAllowed, duelActive } from "../server/FinaleDuelRuntime";
import type { Enemy, Projectile } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog, MissionBlueprint } from "../shared/MissionCatalog";
import { SortieArmament } from "../shared/SortieArmament";
function fixture() {
 const folder=new Instance("Folder");folder.Parent=Workspace;
 const bp={...MissionCatalog.Get(18),phases:[{kind:"ace" as const,label:"Rusk",update:{objective:"Duel",radio:[],countdownSeconds:300},finale:{duel:{center:{x:0,y:1000,z:0},radius:2000,minY:800,maxY:2400}}}]};
 const actor=(kind:Enemy["kind"],required:boolean,phaseOwner:number)=>{
  const model=new Instance("Model");model.Parent=folder;
  const enemy: Enemy = {id:kind,name:kind,hiddenParts:[],lockBreakChance:0,flareUntil:0,kind,required,phaseOwner,model,enabled:true,health:100,windup:2,position:new Vector3(0,1000,0),direction:new Vector3(0,0,-1),velocity:Vector3.zero,maxHealth:100,fireTimer:100,mode:"attack",modeTimer:0,side:1,passDirection:new Vector3(0,0,-1),flares:0,flareTimer:0,speedBonus:0,lockBreakTimer:100,breakTimer:100,breakUntil:0};
  return enemy;
 };
 const rusk=actor("ace",true,0),other=actor("air",false,-1),gun=actor("ground",false,-1),ally=actor("air",false,-1);
 const special=SortieArmament.NewSpecial("salvo",undefined);
 // Player identity is unused: cleaned sessions suppress remotes, and no launch/world setup runs.
 const player={} as Player,aircraft=new Instance("Model");aircraft.Parent=folder;
 const s=createCombatSession(player,1,folder,aircraft,FlightMath.FromPose(0,1000,-2000,0,0,300),18,"salvo","normal",os.clock());
 s.blueprint=bp;s.blueprintState=BlueprintRunner.NewState(bp,os.clock());
 s.airQueue=[{count:2,role:"raider",behind:false}];s.enemies=[other,gun,rusk];s.allies=[ally];
 s.missiles=2;s.regen=1.25;s.special=special;s.health=37;s.elapsed=10;s.stepCount=1;s.lastWindupAt=10;
 // Suppress effect delivery while exercising the real movement/projectile steps without remotes.
 s.cleaned=true;s.lockProgress=1;s.target=other;
 return {folder,s,rusk,other,gun,ally,special};
}
describe("D13 Roblox runtime contracts (compiled; execution pending)",()=>{
 it("cleans every prior missile and other fighter, silences guns/allies, and preserves sortie resources once",()=>{
  const f=fixture();
  try {
   for(const flags of [{hostile:true},{hostile:false,allied:true},{hostile:false,special:true},{hostile:false}]) {
    const part=new Instance("Part");part.Parent=f.folder;
    f.s.projectiles.push({...flags,part} as Projectile);
   }
   const lines:string[]=[];
   stepFinaleDuel(f.s,l=>{lines.push(l);});
   expect(duelActive(f.s)).toBe(true);expect(f.s.airQueue.size()).toBe(0);expect(f.s.projectiles.size()).toBe(0);
   expect(f.other.model.Parent).toBeUndefined();expect(f.other.health).toBe(0);
   expect(f.rusk.enabled).toBe(true);expect(f.rusk.health).toBe(100);expect(f.rusk.model.Parent).toBe(f.folder);
   expect(f.gun.enabled).toBe(false);expect(f.gun.windup).toBe(0);expect(f.ally.windup).toBe(0);
   expect(finaleTargetAllowed(f.s,f.rusk)).toBe(true);expect(finaleTargetAllowed(f.s,f.other)).toBe(false);
   expect(f.s.missiles).toBe(2);expect(f.s.regen).toBe(1.25);expect(f.s.special).toBe(f.special);expect(f.s.health).toBe(37);
   expect(f.s.lockProgress).toBe(0);expect(f.s.target).toBeUndefined();
   const liveMissile=new Instance("Part");liveMissile.Parent=f.folder;
   f.s.projectiles.push({hostile:true,part:liveMissile} as Projectile);
   stepFinaleDuel(f.s,l=>{lines.push(l);});
   expect(lines.size()).toBe(1);expect(f.s.projectiles.size()).toBe(1);
  } finally {f.folder.Destroy();}
 });
 it("clears an existing D10 director and its in-flight missiles without credits or refunds",()=>{
  const f=fixture();try {
   f.other.cruiseTarget=true;
   f.s.cruise={phase:-1,elapsed:10,states:[],routes:[],actors:new Map([[0,f.other]])};
   const part=new Instance("Part");part.Parent=f.folder;
   f.s.projectiles.push({part,target:f.other,hostile:false} as Projectile);
   stepFinaleDuel(f.s,()=>{});
   expect(f.s.cruise).toBeUndefined();expect(f.other.model.Parent).toBeUndefined();
   expect(f.s.projectiles.size()).toBe(0);expect(f.s.missiles).toBe(2);
   expect(f.s.blueprintState!.killedIds.size()).toBe(0);
  } finally {f.folder.Destroy();}
 });
 it("bounds Rusk above the works and gives retry a fresh cleanup owner",()=>{
  const f=fixture();
  try {
   f.rusk.position=new Vector3(4000,100,0);
   stepFinaleDuel(f.s,()=>{});
   stepEnemies(f.s,1/60);
   expect(f.rusk.position.X).toBeLessThanOrEqual(2000);expect(f.rusk.position.Y).toBe(800);
   expect(f.rusk.frame).toBeDefined();
   f.s.d13Phase=undefined;f.gun.enabled=true;
   stepFinaleDuel(f.s,()=>{});expect(f.gun.enabled).toBe(false);
  } finally {f.folder.Destroy();}
 });
});

describe("D13 complete combat movement and projectile steps (execution pending)",()=>{
 it("keeps the vent exit and every arena edge inside the authored cylinder across combat steps",()=>{
  const f=fixture(); try {
   const arena={center:{x:0,y:1000,z:-2880},radius:5760,minY:800,maxY:2400};
   f.s.blueprint!.phases[0].finale={duel:arena};f.rusk.windup=0;
   stepFinaleDuel(f.s,()=>{});
   for(const position of [new Vector3(0,174,-7000),new Vector3(0,1800,-7000),new Vector3(5760,2400,-2880),new Vector3(-5760,800,-2880),new Vector3(0,2400,2880),new Vector3(0,800,-8640)]) {
    f.rusk.position=position;
    for(let i=0;i<60;i++) {
     stepEnemies(f.s,1/60);
     expect(new Vector3(f.rusk.position.X,0,f.rusk.position.Z+2880).Magnitude).toBeLessThanOrEqual(5760.001);
     expect(f.rusk.position.Y).toBeGreaterThanOrEqual(800);expect(f.rusk.position.Y).toBeLessThanOrEqual(2400);
    }
    if(position.Z===-7000) expect(f.rusk.position.Z).toBeLessThan(-6000);
   }
   f.s.blueprint!.phases[0].finale=undefined;
   f.rusk.position=new Vector3(4000,2000,-7000);stepEnemies(f.s,1/60);
   expect(f.rusk.position.X).toBe(2700);expect(f.rusk.position.Y).toBe(1000);expect(f.rusk.position.Z).toBe(-2700);
  } finally {f.folder.Destroy();}
 });
 for(const guided of [true,false]) for(const mode of ["wall","cover","legacy"]) it(`${guided ? "guided" : "blind"} missile: ${mode}`,()=>{
  const wall=mode!=="cover";
  const f=fixture();try {
   const core=f.rusk;core.kind="ground";core.id="core";core.position=new Vector3(0,1200,0);core.windup=0;core.flareUntil=0;
   f.s.enemies=[core];f.s.allies=[];f.s.state=FlightMath.FromPose(200,1200,100,0,0,300);
   const volume={center:{x:0,y:1200,z:0},half:{x:50,y:50,z:50}};
   const vent={generators:[],core:"core",checkpoints:[],openingSeconds:3,gate:volume,exit:volume};
   const bp: MissionBlueprint={...MissionCatalog.Get(18),phases:[{kind:"required_ground" as const,label:"Core",count:1,finale:{vent}}]};
   if(mode==="legacy") bp.phases[0].finale=undefined;
   f.s.blueprint=bp;f.s.blueprintState=BlueprintRunner.NewState(bp,os.clock());f.s.blueprintState.vent={elapsed:4,checkpoint:0,exited:false};
   const scenery=new Instance("Part");scenery.Anchored=true;scenery.Size=wall ? new Vector3(40,40,4) : new Vector3(4,40,400);
   scenery.Position=wall ? new Vector3(0,1200,60) : new Vector3(100,1200,0);scenery.Parent=f.folder;
   const params=new RaycastParams();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances=[scenery];f.s.collisionParams=params;
   const part=new Instance("Part");part.Parent=f.folder;
   f.s.projectiles=[{part,position:new Vector3(0,1200,120),direction:new Vector3(0,0,-1),target:guided ? core : undefined,hostile:false,age:0,ace:false,damage:10,speed:1200}];
   stepMissiles(f.s,0.1);
   expect(core.health).toBe(mode==="wall" ? 100 : 90);expect(f.s.missileHits).toBe(mode==="wall" ? 0 : 1);expect(f.s.projectiles.size()).toBe(0);
  } finally {f.folder.Destroy();}
 });
});
