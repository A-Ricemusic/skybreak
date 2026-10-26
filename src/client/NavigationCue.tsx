import React, {useEffect,useRef} from "@rbxts/react";
import {RunService,TextService,Workspace} from "@rbxts/services";
import {NAVIGATION_CAPTION_PADDING,navigationCaption,navigationCaptionRect,navigationCaptionSize,navigationDetails,navigationObstacles,wrapNavigationDetails} from "../shared/NavigationLayout";
import {getHudLayout,HudLayout,HudOptions,InputMode,NAVIGATION_CAPTION_HEIGHT,NAVIGATION_CAPTION_MAX_WIDTH,NAVIGATION_CAPTION_WIDTH,NAVIGATION_ROW_HEIGHT,Rectangle} from "../shared/UILayout";
import {Telemetry} from "../shared/Types";
import {FlightController} from "./FlightController";
const PLACEMENT_INTERVAL=4,PLACEMENT_MOVE=8,TEXT_SIZE=10,FONT=Enum.Font.GothamBold;
const widths=new Map<string,number>();
/** Real rendered width of a caption row (cached; the strings repeat every frame). */
function measure(text:string):number {
	const cached=widths.get(text);
	if(cached!==undefined)return cached;
	const [ok,size]=pcall(()=>TextService.GetTextSize(text,TEXT_SIZE,FONT,new Vector2(2000,100)));
	const width=ok ? size.X : text.size()*6.5;
	if(widths.size()>256)widths.clear();
	widths.set(text,width);
	return width;
}
/** Independent from combat brackets: route and signal targets remain findable
 * when a raider is selected. Text only: a bearing glyph and the distance, plus
 * detail rows (volume, ceiling, protected unit) wrapped between parts so they
 * never truncate. The cue lives in the HUD-scaled frame, so screen points are
 * converted into its units. */
export function NavigationCue({telemetry,visible,inputMode,scale=1,options}:{telemetry:Telemetry;visible:boolean;inputMode:InputMode;scale?:number;options?:HudOptions}) {
	const label=useRef<Frame>(),primary=useRef<TextLabel>(),secondary=useRef<TextLabel>(),data=useRef(telemetry);data.current=telemetry;
	useEffect(()=>{
		if(!visible)return;
		// placeNavigationCaption scores a few hundred candidate rectangles, so it
		// only re-runs every PLACEMENT_INTERVAL frames, when the projected marker
		// moves more than PLACEMENT_MOVE px, when the caption's size changes, or
		// when the viewport changes. The obstacle list depends only on (viewport, inputMode).
		let cachedViewport:Vector2|undefined,hud:HudLayout|undefined,obstacles:Rectangle[]=[];
		let placedX=0,placedY=0,placed=false,frame=0;
		let lastMeters=-1,lastSide=2,lastInside=false,lastCeiling:number|undefined,lastHull=-2;
		let distanceText="",details:string[]=[],size={width:NAVIGATION_CAPTION_WIDTH,height:NAVIGATION_CAPTION_HEIGHT};
		const layoutRows=(placement:Rectangle,fixed:boolean)=>{
			// The fixed slot may be narrower than the floating caption: re-wrap to its width.
			const lines=fixed ? wrapNavigationDetails(details,placement.width-NAVIGATION_CAPTION_PADDING,measure) : wrapNavigationDetails(details,NAVIGATION_CAPTION_MAX_WIDTH-NAVIGATION_CAPTION_PADDING,measure);
			const alignment=fixed ? Enum.TextXAlignment.Left : Enum.TextXAlignment.Center;
			const rows=math.max(1,math.floor((placement.height-2)/NAVIGATION_ROW_HEIGHT));
			if(primary.current) {
				primary.current.Text=distanceText;
				primary.current.Size=new UDim2(1,0,0,NAVIGATION_ROW_HEIGHT);
				primary.current.TextXAlignment=alignment;
			}
			if(secondary.current) {
				secondary.current.Text=lines.join("\n");
				secondary.current.Visible=lines.size()>0 && rows>1;
				secondary.current.Position=UDim2.fromOffset(0,NAVIGATION_ROW_HEIGHT);
				secondary.current.Size=new UDim2(1,0,0,math.max(1,rows-1)*NAVIGATION_ROW_HEIGHT);
				secondary.current.TextXAlignment=alignment;
			}
		};
		const connection=RunService.RenderStepped.Connect(()=>{
			const gui=label.current,camera=Workspace.CurrentCamera,nav=data.current.navigation;
			if(!gui || !camera)return;
			gui.Visible=nav!==undefined;
			if(!nav){placed=false;return;}
			const [point,onScreen]=camera.WorldToScreenPoint(nav);
			const parent=gui.Parent;
			if(!parent?.IsA("GuiObject"))return;
			// The parent is drawn through a UIScale: lay out in its own (virtual) units.
			const origin=parent.AbsolutePosition,viewport=parent.AbsoluteSize.div(scale);
			const localPos=camera.CFrame.PointToObjectSpace(nav);
			const screenX=point.Z>0 ? point.X : (origin.X+(localPos.X>0 ? parent.AbsoluteSize.X-70 : 70));
			const screenY=point.Z>0 ? point.Y : origin.Y+parent.AbsoluteSize.Y*.45;
			const x=origin.X+(screenX-origin.X)/scale,y=origin.Y+(screenY-origin.Y)/scale;
			if(cachedViewport!==viewport || !hud) {
				cachedViewport=viewport;
				hud=getHudLayout(math.floor(viewport.X),math.floor(viewport.Y),inputMode,options);
				obstacles=navigationObstacles(hud);
				placed=false;
			}
			// Predicted jet position (what the player sees), not the hidden replicated model.
			const position=FlightController.GetActive()?.GetPosition();
			const distance=position ? nav.sub(position).Magnitude : nav.sub(camera.CFrame.Position).Magnitude;
			const radius=data.current.navigationRadius ?? 210;
			const ceiling=data.current.navigationCeiling;
			const protectedHull=data.current.protectedHealth;
			const side=onScreen ? 0 : localPos.X>0 ? 1 : -1;
			const meters=math.floor(distance),inside=distance<=radius,hull=protectedHull!==undefined ? math.ceil(protectedHull) : -1;
			// Rebuild the text only when a visible value changed (most frames nothing has).
			let resized=false;
			if(meters!==lastMeters || side!==lastSide || inside!==lastInside || ceiling!==lastCeiling || hull!==lastHull){
				const detailsChanged=inside!==lastInside || ceiling!==lastCeiling || hull!==lastHull;
				lastMeters=meters;lastSide=side;lastInside=inside;lastCeiling=ceiling;lastHull=hull;
				distanceText=navigationCaption(distance,side,inside,ceiling,protectedHull)[0];
				if(detailsChanged || details.size()===0) {
					details=navigationDetails(inside,ceiling,protectedHull);
					const lines=wrapNavigationDetails(details,NAVIGATION_CAPTION_MAX_WIDTH-NAVIGATION_CAPTION_PADDING,measure);
					const nextSize=navigationCaptionSize([measure(distanceText),...lines.map(measure)]);
					resized=nextSize.width!==size.width || nextSize.height!==size.height;
					size=nextSize;
				}
				if(primary.current)primary.current.Text=distanceText;
			}
			frame+=1;
			if(resized || !placed || frame%PLACEMENT_INTERVAL===0 || (x-placedX)**2+(y-placedY)**2>PLACEMENT_MOVE**2) {
				const placement=navigationCaptionRect(x,y,origin.X,origin.Y,viewport.X,viewport.Y,hud,obstacles,size);
				placedX=x;placedY=y;placed=true;
				gui.Position=UDim2.fromOffset(placement.x,placement.y);
				gui.Size=UDim2.fromOffset(placement.width,placement.height);
				layoutRows(placement,placement===hud.navigation);
			}
		});
		return ()=>connection.Disconnect();
	},[visible,inputMode,scale,options]);
	const text=(name:string,ref:React.RefObject<TextLabel>,y:number,rows:number)=>(
		<textlabel ref={ref} key={name} BackgroundTransparency={1} Position={UDim2.fromOffset(0,y)} Size={new UDim2(1,0,0,rows*NAVIGATION_ROW_HEIGHT)} Font={FONT} LineHeight={1} Text="" TextColor3={Color3.fromRGB(100,249,218)} TextSize={TEXT_SIZE} TextStrokeColor3={Color3.fromRGB(6,13,22)} TextStrokeTransparency={.45} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top} ZIndex={5}/>
	);
	return (
		<frame ref={label} key="NavigationCue" Visible={false} BackgroundTransparency={1} ClipsDescendants={true} Size={UDim2.fromOffset(NAVIGATION_CAPTION_WIDTH,NAVIGATION_CAPTION_HEIGHT)} ZIndex={5}>
			{text("Distance",primary,0,1)}
			{text("Details",secondary,NAVIGATION_ROW_HEIGHT,2)}
		</frame>
	);
}
