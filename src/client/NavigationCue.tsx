import React, {useEffect,useRef} from "@rbxts/react";
import {RunService,Workspace} from "@rbxts/services";
import {Telemetry} from "../shared/Types";
import {FlightController} from "./FlightController";
/** Independent from combat brackets: route and signal targets remain findable
 * when a raider is selected. Projection clamps above touch control lanes. */
export function NavigationCue({telemetry,visible}:{telemetry:Telemetry;visible:boolean}) {
	const label=useRef<TextLabel>(),data=useRef(telemetry);data.current=telemetry;
	useEffect(()=>{
		if(!visible)return;
		const connection=RunService.RenderStepped.Connect(()=>{
			const gui=label.current,camera=Workspace.CurrentCamera,nav=data.current.navigation;
			if(!gui || !camera)return;
			gui.Visible=nav!==undefined;
			if(!nav)return;
			const [point,onScreen]=camera.WorldToViewportPoint(nav);
			const viewport=camera.ViewportSize;
			const localPos=camera.CFrame.PointToObjectSpace(nav);
			const x=point.Z>0 ? point.X : (localPos.X>0 ? viewport.X-70 : 70);
			const y=point.Z>0 ? point.Y : viewport.Y*.45;
			gui.Position=UDim2.fromOffset(math.clamp(x,75,viewport.X-75),math.clamp(y,math.min(132,viewport.Y*.52),math.max(132,viewport.Y-155)));
			const aircraft=FlightController.GetActive()?.aircraft;
			const distance=aircraft ? nav.sub(aircraft.GetPivot().Position).Magnitude : nav.sub(camera.CFrame.Position).Magnitude;
			const radius=data.current.navigationRadius ?? 210;
			const ceiling=data.current.navigationCeiling;
			const protectedHull=data.current.protectedHealth;
			const direction=onScreen ? "◇" : localPos.X>0 ? "›" : "‹";
			gui.Text=`${direction} ${math.floor(distance)}m · ${distance<=radius ? "IN VOLUME" : "BEACON"}${ceiling ? `\nALT ≤ ${ceiling}` : ""}${protectedHull !== undefined ? `\nPROTECTED ${math.ceil(protectedHull)}%` : ""}`;
		});
		return ()=>connection.Disconnect();
	},[visible]);
	return <textlabel ref={label} key="NavigationCue" Visible={false} AnchorPoint={new Vector2(.5,.5)} Size={UDim2.fromOffset(148,62)} BackgroundColor3={Color3.fromRGB(5,24,30)} BackgroundTransparency={.2} BorderSizePixel={0} TextColor3={Color3.fromRGB(100,249,218)} Font={Enum.Font.GothamBold} TextSize={11} TextWrapped={true} ZIndex={5}/>;
}
