import {FlightInput} from "./Types";
import {FlightMath,FlightState} from "./FlightMath";
import {FlightPoint} from "./MissionCatalog";
/** Pure normal-control guidance reused by the Studio pilot and offline tests.
 * This computes stick/throttle only; it cannot mutate flight/objective state. */
export const NavigationPilot = {
	Controls(state:FlightState,point:FlightPoint,radius:number,orbit:boolean,ceiling?:number): FlightInput {
		let tx=point.x,tz=point.z;
		const dx=state.x-point.x,dz=state.z-point.z,distance=math.sqrt(dx*dx+dz*dz);
		if(orbit && distance<radius*.85){
			const angle=math.atan2(dz,dx)+.85;
			const orbitRadius=math.min(400,radius*.48);
			tx=point.x+math.cos(angle)*orbitRadius;tz=point.z+math.sin(angle)*orbitRadius;
		}
		const desiredYaw=math.atan2(state.x-tx,state.z-tz);
		const turn=FlightMath.WrapAngle(desiredYaw-state.yaw);
		const altitude=math.clamp(point.y,210,ceiling ? ceiling-55 : 850);
		return {x:math.clamp(-turn*2.6,-1,1),y:math.clamp((altitude-state.y)/160,-.65,.65),throttle:orbit || distance<700 ? .05 : .45};
	},
};
