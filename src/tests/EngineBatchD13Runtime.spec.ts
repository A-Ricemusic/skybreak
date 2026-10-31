import { describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { stepBatchD13, d13TargetAllowed, duelActive } from "../server/EngineBatchD13Runtime";
import type { CombatSession, Enemy, Projectile } from "../server/CombatSession";
import { BlueprintRunner } from "../shared/BlueprintRunner";
import { MissionCatalog } from "../shared/MissionCatalog";
import { SortieArmament } from "../shared/SortieArmament";
function fixture() {
 const folder=new Instance("Folder");folder.Parent=Workspace;
 const bp={...MissionCatalog.Get(18),phases:[{kind:"ace" as const,label:"Rusk",update:{objective:"Duel",radio:[],countdownSeconds:300},batchD13:{duel:{center:{x:0,y:1000,z:0},radius:2000,minY:800,maxY:2400}}}]};
 const actor=(kind:Enemy["kind"],required:boolean,phaseOwner:number)=>{
  const model=new Instance("Model");model.Parent=folder;
  return {kind,required,phaseOwner,model,enabled:true,health:100,windup:2,position:new Vector3(0,1000,0),direction:new Vector3(0,0,-1)} as Enemy;
 };
 const rusk=actor("ace",true,0),other=actor("air",false,-1),gun=actor("ground",false,-1),ally=actor("air",false,-1);
 const special=SortieArmament.NewSpecial("salvo",undefined);
 const s={folder,blueprint:bp,blueprintState:BlueprintRunner.NewState(bp,0),airQueue:[{count:2,role:"raider",behind:false}],enemies:[other,gun,rusk],allies:[ally],projectiles:[],missiles:2,regen:1.25,special,health:37,lockProgress:1,target:other} as unknown as CombatSession;
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
   stepBatchD13(f.s,l=>{lines.push(l);});
   expect(duelActive(f.s)).toBe(true);expect(f.s.airQueue.size()).toBe(0);expect(f.s.projectiles.size()).toBe(0);
   expect(f.other.model.Parent).toBeUndefined();expect(f.other.health).toBe(0);
   expect(f.rusk.enabled).toBe(true);expect(f.rusk.health).toBe(100);expect(f.rusk.model.Parent).toBe(f.folder);
   expect(f.gun.enabled).toBe(false);expect(f.gun.windup).toBe(0);expect(f.ally.windup).toBe(0);
   expect(d13TargetAllowed(f.s,f.rusk)).toBe(true);expect(d13TargetAllowed(f.s,f.other)).toBe(false);
   expect(f.s.missiles).toBe(2);expect(f.s.regen).toBe(1.25);expect(f.s.special).toBe(f.special);expect(f.s.health).toBe(37);
   expect(f.s.lockProgress).toBe(0);expect(f.s.target).toBeUndefined();
   const liveMissile=new Instance("Part");liveMissile.Parent=f.folder;
   f.s.projectiles.push({hostile:true,part:liveMissile} as Projectile);
   stepBatchD13(f.s,l=>{lines.push(l);});
   expect(lines.size()).toBe(1);expect(f.s.projectiles.size()).toBe(1);
  } finally {f.folder.Destroy();}
 });
 it("bounds Rusk above the works and gives retry a fresh cleanup owner",()=>{
  const f=fixture();
  try {
   f.rusk.position=new Vector3(4000,100,0);
   stepBatchD13(f.s,()=>{});
   expect(f.rusk.position.X).toBe(2000);expect(f.rusk.position.Y).toBe(800);
   expect(f.rusk.frame).toBeDefined();
   f.s.d13Phase=undefined;f.gun.enabled=true;
   stepBatchD13(f.s,()=>{});expect(f.gun.enabled).toBe(false);
  } finally {f.folder.Destroy();}
 });
});
