import type { DifficultyKind } from "./Difficulty";
import type { FlightPoint } from "./MissionCatalog";
import { m18TargetLayout } from "./M18WorldPlan";
export interface AscendingTarget { id:string; start:FlightPoint; end:FlightPoint; speed:number }
/** Exterior launches are optional; reaching the upper endpoint is departure, never impact. */
export const M18_ASCENDING:AscendingTarget[]=m18TargetLayout().filter(t=>t.type==="ascending_missile_slot").map(t=>({id:t.id,start:{x:t.x,y:t.y,z:t.z},end:{x:t.x,y:2000,z:t.z},speed:20}));
export function ascendingPose(t:AscendingTarget,elapsed:number):FlightPoint {
 const fraction=math.clamp(elapsed*t.speed/(t.end.y-t.start.y),0,1);
 return {x:t.start.x,y:t.start.y+(t.end.y-t.start.y)*fraction,z:t.start.z};
}

/** D-663: opt-in only for M18's required duel ace, never LAST ECHO or other missions. */
export function m18RuskTuning(missionId:number | undefined, duel:boolean, difficulty:DifficultyKind) {
 if(missionId!==18 || !duel)return undefined;
 return {reload:difficulty==="easy"?2:difficulty==="normal"?3:4, fireMin:100};
}
