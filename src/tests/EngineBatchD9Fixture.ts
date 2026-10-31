import { d7Fixture } from "./EngineBatchD7Fixture";
import type { MissionBlueprint } from "../shared/MissionCatalog";
export function d9Fixture(): MissionBlueprint {
 const b=d7Fixture();b.armament={gun:{rounds:800}};b.scoring={basis:"points",points:{jammer:100},rank:{S:2800,A:2100,B:1900,C:1300}};
 b.phases[0].execution={raiderKillCap:32};
 b.phases[0].jamming={visualLockRange:700,remainingCall:"Local interference remains.",clearCall:"Local radar clear."};
 b.phases[0].spatialJamming={navigationHoldSeconds:20,airships:[{id:"balloon",position:{x:1000,y:900,z:4000},health:60,scoreRole:"jammer"}],corridors:[{sourceId:"balloon",a:{x:1000,y:900,z:3000},b:{x:1000,y:900,z:6000},radius:300}]};
 return b;
}
