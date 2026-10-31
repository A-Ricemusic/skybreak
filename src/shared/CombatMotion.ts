import { dampedSteer, pursuitDestination } from "./EncounterKinematics";
import { Point } from "./ThreatRules";
/** Numeric motion used by CombatService and the deterministic finale scenario. */
export const CombatMotion = {
 Add(a:Point,b:Point):Point{return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z};},
 Mul(a:Point,n:number):Point{return {x:a.x*n,y:a.y*n,z:a.z*n};},
 Sub(a:Point,b:Point):Point{return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};},
 Dot(a:Point,b:Point):number{return a.x*b.x+a.y*b.y+a.z*b.z;},
 Length(a:Point):number{return math.sqrt(CombatMotion.Dot(a,a));},
 Unit(a:Point,fallback:Point={x:0,y:0,z:-1}):Point{const n=CombatMotion.Length(a);return n>0.01?CombatMotion.Mul(a,1/n):fallback;},
 Steer(a:Point,b:Point,turn:number,dt:number):Point{return dampedSteer(a,b,turn,dt);},
 AceSpeed(playerSpeed:number,bonus:number):number{return math.clamp(playerSpeed+48,320,380)+bonus;},
 Pursuit(enemy:Point,player:Point,velocity:Point,forward:Point,lateral:Point,speed:number,separation:number,now:number,index:number,ace:boolean,side:number,fallback:Point):Point{
  let destination=pursuitDestination(player,velocity,lateral,separation,speed,now,index,side,ace);
  if(ace && separation>600) destination=CombatMotion.Sub(destination,CombatMotion.Mul(forward,250));
  return CombatMotion.Unit(CombatMotion.Sub(destination,enemy),fallback);
 },
};
