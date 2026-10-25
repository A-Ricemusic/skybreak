import React, {useEffect,useRef} from "@rbxts/react";
import {RunService,Workspace} from "@rbxts/services";
import {navigationObstacles,placeNavigationCaption} from "../shared/NavigationLayout";
import {getHudLayout,HudLayout,InputMode,Rectangle} from "../shared/UILayout";
import {Telemetry} from "../shared/Types";
import {FlightController} from "./FlightController";
const PLACEMENT_INTERVAL=4,PLACEMENT_MOVE=8;
/** Independent from combat brackets: route and signal targets remain findable
 * when a raider is selected. Projection clamps above touch control lanes. */
export function NavigationCue({telemetry,visible,inputMode}:{telemetry:Telemetry;visible:boolean;inputMode:InputMode}) {
	const label=useRef<TextLabel>(),data=useRef(telemetry);data.current=telemetry;
	useEffect(()=>{
		if(!visible)return;
		// placeNavigationCaption scores a few hundred candidate rectangles, so it
		// only re-runs every PLACEMENT_INTERVAL frames, when the projected marker
		// moves more than PLACEMENT_MOVE px, or when the viewport changes. The
		// obstacle list depends only on (viewport, inputMode) and is cached.
		let cachedViewport:Vector2|undefined,hud:HudLayout|undefined,obstacles:Rectangle[]=[];
		let placement:Rectangle|undefined,placedX=0,placedY=0,placed=false,frame=0;
		const connection=RunService.RenderStepped.Connect(()=>{
			const gui=label.current,camera=Workspace.CurrentCamera,nav=data.current.navigation;
			if(!gui || !camera)return;
			gui.Visible=nav!==undefined;
			if(!nav){placed=false;return;}
			const [point,onScreen]=camera.WorldToScreenPoint(nav);
			const parent=gui.Parent;
			if(!parent?.IsA("GuiObject"))return;
			const viewport=parent.AbsoluteSize,origin=parent.AbsolutePosition;
			const localPos=camera.CFrame.PointToObjectSpace(nav);
			const x=point.Z>0 ? point.X : (origin.X+(localPos.X>0 ? viewport.X-70 : 70));
			const y=point.Z>0 ? point.Y : origin.Y+viewport.Y*.45;
			if(cachedViewport!==viewport || !hud) {
				cachedViewport=viewport;
				hud=getHudLayout(viewport.X,viewport.Y,inputMode);
				obstacles=navigationObstacles(hud);
				placed=false;
			}
			frame+=1;
			if(!placed || frame%PLACEMENT_INTERVAL===0 || (x-placedX)**2+(y-placedY)**2>PLACEMENT_MOVE**2) {
				placement=placeNavigationCaption(x,y,origin.X,origin.Y,viewport.X,viewport.Y,hud,obstacles);
				placedX=x;placedY=y;placed=true;
				if(placement)gui.Position=UDim2.fromOffset(placement.x+placement.width/2,placement.y+placement.height);
			}
			gui.Visible=placement!==undefined;
			if(!placement)return;
			const aircraft=FlightController.GetActive()?.aircraft;
			const distance=aircraft ? nav.sub(aircraft.GetPivot().Position).Magnitude : nav.sub(camera.CFrame.Position).Magnitude;
			const radius=data.current.navigationRadius ?? 210;
			const ceiling=data.current.navigationCeiling;
			const protectedHull=data.current.protectedHealth;
			const direction=onScreen ? "◇" : localPos.X>0 ? "›" : "‹";
			gui.Text=`${direction} ${math.floor(distance)}m · ${distance<=radius ? "IN VOLUME" : "BEACON"}${ceiling ? `\nALT ≤ ${ceiling}` : ""}${protectedHull !== undefined ? `\nPROTECTED ${math.ceil(protectedHull)}%` : ""}`;
		});
		return ()=>connection.Disconnect();
	},[visible,inputMode]);
	return <textlabel ref={label} key="NavigationCue" Visible={false} AnchorPoint={new Vector2(.5,1)} Size={UDim2.fromOffset(148,48)} BackgroundColor3={Color3.fromRGB(5,24,30)} BackgroundTransparency={.45} BorderSizePixel={0} TextColor3={Color3.fromRGB(100,249,218)} Font={Enum.Font.GothamBold} TextSize={11} TextWrapped={true} ZIndex={5}/>;
}
