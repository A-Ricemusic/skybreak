import type { Point } from "./ThreatRules";
const add=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a:Point,n:number):Point=>({x:a.x*n,y:a.y*n,z:a.z*n});
const sub=(a:Point,b:Point)=>add(a,mul(b,-1));
const length=(a:Point)=>math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
const unit=(a:Point,fallback:Point):Point=>length(a)>0.01?mul(a,1/length(a)):fallback;
/** Pure authoritative steering shared by CombatService and encounter regressions. */
export function dampedSteer(direction:Point,desired:Point,rate:number,dt:number):Point {
 const alpha=1-math.exp(-rate*dt);
 return unit(add(mul(direction,1-alpha),mul(desired,alpha)),direction);
}
export function pursuitDestination(target:Point,velocity:Point,lateral:Point,range:number,playerSpeed:number,now:number,index:number,side:number,ace:boolean):Point {
 const lead=math.clamp(range/(350+playerSpeed),0.35,1.8);
 const weave=math.sin(now*(ace?1.7:0.65)+index*1.8)*(ace?125:45);
 let destination=add(add(target,mul(velocity,lead)),add(mul(lateral,weave),{x:0,y:ace?math.sin(now*1.4)*65:25,z:0}));
 if(range>1100) destination=add(destination,mul(lateral,side*500));
 return destination;
}
export function guidedDirection(position:Point,direction:Point,target:Point,velocity:Point,speed:number,leadLimit:number,turn:number,dt:number):Point {
 const lead=math.clamp(length(sub(target,position))/speed,0,leadLimit);
 return dampedSteer(direction,unit(sub(add(target,mul(velocity,lead)),position),direction),turn,dt);
}
