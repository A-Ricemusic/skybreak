import {FlightInput} from "./Types";
import {FlightMath,FlightState} from "./FlightMath";
import {FlightPoint} from "./MissionCatalog";
/** The attitude fields Steer reads (a FlightState, or one rebuilt from a CFrame). */
export interface PilotAttitude { yaw:number; pitch:number; roll:number }
/** Pure normal-control guidance reused by the Studio pilot and offline tests.
 * This computes stick/throttle only; it cannot mutate flight/objective state. */
export const NavigationPilot = {
	/**
	 * Stick that flies the nose toward a heading and climb angle. The stick
	 * commands rates (the jet holds its attitude when centred), so this closes
	 * the loop on the current nose: turn stick in proportion to the heading
	 * error, pitch stick in proportion to the climb-angle error. Both flip when
	 * inverted, matching the screen-relative controls.
	 */
	Steer(state:PilotAttitude,desiredYaw:number,desiredPitch:number): LuaTuple<[number,number]> {
		const inverted=math.abs(state.roll)>math.pi/2 ? -1 : 1;
		const turn=FlightMath.WrapAngle(desiredYaw-state.yaw);
		const climb=math.clamp(desiredPitch,-1.2,1.2)-state.pitch;
		return $tuple(math.clamp(-turn*2.6*inverted,-1,1),math.clamp(climb*3*inverted,-1,1));
	},
	Controls(state:FlightState,point:FlightPoint,radius:number,orbit:boolean,ceiling?:number): FlightInput {
		let tx=point.x,tz=point.z;
		const dx=state.x-point.x,dz=state.z-point.z,distance=math.sqrt(dx*dx+dz*dz);
		if(orbit && distance<radius*.85){
			const angle=math.atan2(dz,dx)+.85;
			const orbitRadius=math.min(400,radius*.48);
			tx=point.x+math.cos(angle)*orbitRadius;tz=point.z+math.sin(angle)*orbitRadius;
		}
		const desiredYaw=math.atan2(state.x-tx,state.z-tz);
		const altitude=math.clamp(point.y,210,ceiling ? ceiling-55 : 850);
		const [x,y]=NavigationPilot.Steer(state,desiredYaw,math.clamp((altitude-state.y)/400,-.4,.4));
		// Preserve the pilot’s established 195/240 studs/s route and orbit timing.
		return {x,y,throttle:FlightMath.ThrottleForSpeed(orbit || distance<700 ? 195 : 240)};
	},
};
