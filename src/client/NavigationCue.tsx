import React, {useEffect,useRef} from "@rbxts/react";
import {RunService,Workspace} from "@rbxts/services";
import {navigationCaption,navigationCaptionRect,navigationObstacles} from "../shared/NavigationLayout";
import {getHudLayout,HudLayout,InputMode,NAVIGATION_CAPTION_HEIGHT,NAVIGATION_CAPTION_WIDTH,Rectangle} from "../shared/UILayout";
import {Telemetry} from "../shared/Types";
import {FlightController} from "./FlightController";
const PLACEMENT_INTERVAL=4,PLACEMENT_MOVE=8;
/** Independent from combat brackets: route and signal targets remain findable
 * when a raider is selected. Text only: a bearing glyph and the distance, plus a
 * tiny second line when the volume, ceiling or protected unit applies. */
export function NavigationCue({telemetry,visible,inputMode}:{telemetry:Telemetry;visible:boolean;inputMode:InputMode}) {
	const label=useRef<Frame>(),primary=useRef<TextLabel>(),secondary=useRef<TextLabel>(),data=useRef(telemetry);data.current=telemetry;
	useEffect(()=>{
		if(!visible)return;
		// placeNavigationCaption scores a few hundred candidate rectangles, so it
		// only re-runs every PLACEMENT_INTERVAL frames, when the projected marker
		// moves more than PLACEMENT_MOVE px, or when the viewport changes. The
		// obstacle list depends only on (viewport, inputMode) and is cached.
		let cachedViewport:Vector2|undefined,hud:HudLayout|undefined,obstacles:Rectangle[]=[];
		let placedX=0,placedY=0,placed=false,frame=0;
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
				const placement=navigationCaptionRect(x,y,origin.X,origin.Y,viewport.X,viewport.Y,hud,obstacles);
				placedX=x;placedY=y;placed=true;
				gui.Position=UDim2.fromOffset(placement.x,placement.y);
				// Floating captions centre over the marker; the fixed slot reads
				// left-aligned under the objective line.
				const alignment=placement===hud.navigation ? Enum.TextXAlignment.Left : Enum.TextXAlignment.Center;
				if(primary.current)primary.current.TextXAlignment=alignment;
				if(secondary.current)secondary.current.TextXAlignment=alignment;
			}
			const aircraft=FlightController.GetActive()?.aircraft;
			const distance=aircraft ? nav.sub(aircraft.GetPivot().Position).Magnitude : nav.sub(camera.CFrame.Position).Magnitude;
			const radius=data.current.navigationRadius ?? 210;
			const ceiling=data.current.navigationCeiling;
			const protectedHull=data.current.protectedHealth;
			const side=onScreen ? 0 : localPos.X>0 ? 1 : -1;
			const [distanceText,detailText]=navigationCaption(distance,side,distance<=radius,ceiling,protectedHull);
			if(primary.current)primary.current.Text=distanceText;
			if(secondary.current){secondary.current.Text=detailText;secondary.current.Visible=detailText!=="";}
		});
		return ()=>connection.Disconnect();
	},[visible,inputMode]);
	const text=(name:string,ref:React.RefObject<TextLabel>,y:number,size:number,font:Enum.Font)=>(
		<textlabel ref={ref} key={name} BackgroundTransparency={1} Position={UDim2.fromOffset(0,y)} Size={new UDim2(1,0,0,size+3)} Font={font} Text="" TextColor3={Color3.fromRGB(100,249,218)} TextSize={size} TextStrokeColor3={Color3.fromRGB(6,13,22)} TextStrokeTransparency={.45} TextXAlignment={Enum.TextXAlignment.Left} TextTruncate={Enum.TextTruncate.AtEnd} ZIndex={5}/>
	);
	return (
		<frame ref={label} key="NavigationCue" Visible={false} BackgroundTransparency={1} Size={UDim2.fromOffset(NAVIGATION_CAPTION_WIDTH,NAVIGATION_CAPTION_HEIGHT)} ZIndex={5}>
			{text("Distance",primary,0,10,Enum.Font.GothamBold)}
			{text("Details",secondary,13,8,Enum.Font.GothamBold)}
		</frame>
	);
}
