import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, ReplicatedStorage, RunService, TextService, UserInputService, Workspace } from "@rbxts/services";
import { CinematicAction, CinematicControl, routeCinematicInput } from "../shared/CinematicInput";
import { cinematicBandHeight, getCinematicLayout } from "../shared/CinematicLayout";
import { SpeakerTone, StoryBeat, speakerStyle, storyFor } from "../shared/RelayStory";

const ORIGIN=new Vector3(0,6000,0);
/** Seconds a cinematic beat stays on screen: clamp(characters/14, 5, 9). */
export function beatDuration(text:string): number { return math.clamp(text.size()/14,5,9); }
function prop(parent:Instance,name:string,size:Vector3,pos:Vector3,color:Color3,material:Enum.Material=Enum.Material.Metal): Part {
	const p=new Instance("Part"); p.Name=name; p.Size=size; p.Position=ORIGIN.add(pos); p.Color=color; p.Material=material;
	p.Anchored=true; p.CanCollide=false; p.CanTouch=false; p.CanQuery=false; p.Parent=parent; return p;
}
function sceneFor(id:number): Folder {
	const chapter=storyFor(id),scene=new Instance("Folder"); scene.Name="BrokenRelayCinematic"; scene.Parent=Workspace;
	prop(scene,"Stage",new Vector3(700,4,700),new Vector3(0,-4,0),Color3.fromRGB(40,57,64),Enum.Material.Slate);
	prop(scene,"Radio desk",new Vector3(16,2,9),new Vector3(0,4,0),Color3.fromRGB(93,63,47),Enum.Material.Wood);
	const radio=prop(scene,"Teal's receiver",new Vector3(7,4,3),new Vector3(0,7,0),Color3.fromRGB(44,68,75));
	prop(scene,"Frequency window",new Vector3(4.5,.7,.2),new Vector3(0,7.6,-1.6),Color3.fromRGB(76,234,208),Enum.Material.Neon);
	for(const x of [-2.4,2.4]) {const reel=prop(scene,"Tape reel",new Vector3(1.7,1.7,.4),new Vector3(x,6.4,-1.7),Color3.fromRGB(197,178,132));reel.Shape=Enum.PartType.Ball;}
	prop(scene,"Flight chart",new Vector3(5,.15,5),new Vector3(6,5.2,0),Color3.fromRGB(213,207,176),Enum.Material.SmoothPlastic);
	const lamp=new Instance("PointLight");lamp.Brightness=3;lamp.Range=60;lamp.Color=Color3.fromRGB(255,218,171);lamp.Parent=radio;
	const models=ReplicatedStorage.FindFirstChild("RelayStoryModels");
	const subject=chapter.scene==="farm" ? "RelayTruck" : chapter.scene==="harbor" ? "HarborLaunch" : "CommsRelay";
	const template=models?.FindFirstChild(subject);
	if(template?.IsA("Model")) {const model=template.Clone(); model.Name="Story subject"; model.PivotTo(new CFrame(ORIGIN.add(new Vector3(45,chapter.scene==="harbor" ? 19 : subject==="CommsRelay" ? 45 : 18,-65))));model.Parent=scene;}
	const jet=Workspace.FindFirstChild("World")?.FindFirstChild("DisplayJet",true);
	if(jet?.IsA("Model")) {const model=jet.Clone();model.PivotTo(new CFrame(ORIGIN.add(new Vector3(-40,7,-60))).mul(CFrame.Angles(0,.7,0)));model.Parent=scene;}
	const color=chapter.scene==="farm" ? Color3.fromRGB(82,113,63) : chapter.scene==="canyon" ? Color3.fromRGB(152,102,67) : Color3.fromRGB(90,115,129);
	for(let i=0;i<7;i++) {
		const h=chapter.scene==="city" ? 65+(i%3)*24 : chapter.scene==="canyon" ? 100+(i%3)*28 : 20+(i%3)*8;
		prop(scene,chapter.scene,new Vector3(50,h,65),new Vector3(-180+i*60,h/2,-180-(i%2)*60),color,chapter.scene==="farm" ? Enum.Material.Grass : Enum.Material.Concrete);
	}
	// Evidence path illuminates as the camera advances through this chapter.
	for(let i=0;i<5;i++) prop(scene,"Evidence chain",new Vector3(5,1,5),new Vector3(-10+i*7,.3,-25),Color3.fromRGB(68,218,196),Enum.Material.Neon);
	return scene;
}
const INK=Color3.fromRGB(4,9,14),IVORY=Color3.fromRGB(242,238,226),MUTED=Color3.fromRGB(152,168,176),FAINT=Color3.fromRGB(104,122,132);
const ACCENT=Color3.fromRGB(64,224,206),ORANGE=Color3.fromRGB(255,150,84),DANGER=Color3.fromRGB(255,84,76);
const TONE_COLOR:Record<SpeakerTone,Color3>={teal:ACCENT,control:ORANGE,log:MUTED,marshal:DANGER,trainee:IVORY};
const bodyFont=(beat:StoryBeat)=>speakerStyle(beat.speaker).tone==="log" ? Enum.Font.RobotoMono : Enum.Font.GothamMedium;
/** Accessibility choices persist for the rest of the session. */
const prefs={still:false,large:false};
const TEXT_FADE_IN=.25,TEXT_FADE_OUT=.2,CUT_DIP=.3,ENTER_FADE=.5,EXIT_FADE=.5;
type HintMode="touch" | "keyboard" | "gamepad";
function hintModeFor(input:Enum.UserInputType): HintMode {
	if(input===Enum.UserInputType.Touch)return "touch";
	return input.Name.sub(1,7)==="Gamepad" ? "gamepad" : "keyboard";
}
const HINT:Record<HintMode,string>={touch:"TAP FOR NEXT",keyboard:"CLICK OR → NEXT",gamepad:"R1 NEXT"};

export function RelayCinematic({id,viewport,onFinish,onCancel}:{id:number;viewport:Vector2;onFinish:()=>void;onCancel:()=>void}) {
	const chapter=storyFor(id);
	const [beat,setBeat]=useState(0),[paused,setPaused]=useState(false),[still,setStill]=useState(prefs.still),[large,setLarge]=useState(prefs.large);
	const [settingsOpen,setSettingsOpen]=useState(false),[hintMode,setHintMode]=useState<HintMode>(hintModeFor(UserInputService.GetLastInputType()));
	const layout=getCinematicLayout(viewport.X,viewport.Y,large);
	const viewportRef=useRef(viewport);viewportRef.current=viewport;
	const current=chapter.beats[beat],speaker=speakerStyle(current.speaker),tone=TONE_COLOR[speaker.tone];
	// AutomaticSize underreports wrapped text after accessibility-size changes
	// (TextFits=false). Measure the real font so the band fits the chapter's
	// longest line and the scroller has an explicit canvas for any overflow.
	const measure=(b:StoryBeat)=>TextService.GetTextSize(b.text,layout.bodySize,bodyFont(b),new Vector2(math.max(1,layout.textWidth),10000)).Y+4;
	const textHeight=measure(current);
	const bandHeight=cinematicBandHeight(layout,math.max(measure(chapter.beats[0]),measure(chapter.beats[1]),measure(chapter.beats[2])));
	const textAreaHeight=math.min(textHeight,layout.maxTextHeight),overflow=textHeight>layout.maxTextHeight;
	const textY=bandHeight-layout.padBottom-textAreaHeight,chipY=textY-layout.chipGap-layout.chipHeight;
	const subtitleRef=useRef<ScrollingFrame>(),bodyRef=useRef<TextLabel>(),nameRef=useRef<TextLabel>(),roleRef=useRef<TextLabel>();
	const progressRef=useRef<Frame>(),fadeRef=useRef<Frame>(),eyebrowRef=useRef<TextLabel>();
	useEffect(()=>{if(subtitleRef.current)subtitleRef.current.CanvasPosition=Vector2.zero;},[beat]);
	const pausedRef=useRef(false),stillRef=useRef(prefs.still),finishRef=useRef(onFinish),cancelRef=useRef(onCancel),done=useRef(false);
	const indexRef=useRef(0),beatTimeRef=useRef(0);
	finishRef.current=onFinish;cancelRef.current=onCancel;
	const finish=()=>{if(done.current)return;done.current=true;finishRef.current();};
	const setTextAlpha=(alpha:number)=>{for(const label of [bodyRef.current,nameRef.current,roleRef.current])if(label)label.TextTransparency=alpha;};
	const goTo=(index:number)=>{
		// Hide the outgoing line before React swaps text so it can fade in cleanly.
		if(!stillRef.current)setTextAlpha(1);
		indexRef.current=index;beatTimeRef.current=0;setBeat(index);
	};
	const advance=()=>{if(indexRef.current<chapter.beats.size()-1)goTo(indexRef.current+1);else finish();};
	const dispatch=(action:CinematicAction | undefined)=>{
		if(done.current)return;
		if(action==="skip")finish();
		else if(action==="cancel"){done.current=true;cancelRef.current();}
		else if(action==="pause"){pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);}
		else if(action==="next"){if(pausedRef.current){pausedRef.current=false;setPaused(false);}else advance();}
		else if(action==="motion"){stillRef.current=!stillRef.current;prefs.still=stillRef.current;setStill(stillRef.current);}
		else if(action==="text"){prefs.large=!prefs.large;setLarge(prefs.large);}
	};
	useEffect(()=>{
		const camera=Workspace.CurrentCamera;if(!camera)return;
		const oldType=camera.CameraType,oldFov=camera.FieldOfView,oldFrame=camera.CFrame;
		const scene=sceneFor(id);let clock=0;
		// Longer lines stay on screen longer: 5-9 s per beat, scaled by text length.
		const durations=chapter.beats.map((b)=>beatDuration(b.text));
		const last=chapter.beats.size()-1;
		const move=RunService.RenderStepped.Connect((dt)=>{
			if(done.current)return;
			const step=math.min(dt,.1);
			clock+=step;if(!pausedRef.current)beatTimeRef.current+=step;
			if(beatTimeRef.current>=durations[indexRef.current]){advance();if(done.current)return;}
			const index=indexRef.current,t=beatTimeRef.current,duration=durations[index],calm=stillRef.current;
			// Text: short fade in/out per beat unless reduced motion asks for instant swaps.
			setTextAlpha(calm ? 0 : 1-math.min(math.clamp(t/TEXT_FADE_IN,0,1),index===last ? 1 : math.clamp((duration-t)/TEXT_FADE_OUT,0,1)));
			if(progressRef.current)progressRef.current.Size=new UDim2(math.clamp(t/duration,0,1),0,1,0);
			if(eyebrowRef.current)eyebrowRef.current.TextColor3=ACCENT.Lerp(MUTED,math.clamp((clock-2.5)/1,0,1));
			// Black overlay: fade up from black, dip on camera cuts, fade out at the natural end.
			const enter=1-math.clamp(clock/ENTER_FADE,0,1);
			const cut=calm || index===0 ? 0 : (1-math.clamp(t/CUT_DIP,0,1))*.7;
			const exit=index===last ? math.clamp((t-(duration-EXIT_FADE))/EXIT_FADE,0,1) : 0;
			if(fadeRef.current)fadeRef.current.BackgroundTransparency=1-math.max(enter,cut,exit);
			// Camera framing follows the beat's shot: radio desk, wide establishing, evidence chain.
			const shot=chapter.beats[index].shot;
			const alpha=calm ? .5 : math.clamp(t/duration,0,1);
			const short=viewportRef.current.Y<240;
			const vehicle=chapter.scene==="farm" || chapter.scene==="harbor";
			const eye=shot==="radio" ? short ? new Vector3(-8+alpha*2,12,-27) : new Vector3(-10+alpha*4,12,-19)
				: shot==="wide" ? short ? vehicle ? new Vector3(230-alpha*4,80,150) : new Vector3(430-alpha*8,300,380)
				: new Vector3(220-alpha*12,160,150-alpha*10) : short ? new Vector3(21-alpha*2,20,-40) : new Vector3(21-alpha*5,20,-25);
			const focus=shot==="radio" ? new Vector3(0,short ? 5 : 7,0) : shot==="wide" ? short && vehicle ? new Vector3(45,-6,-65) : new Vector3(20,short ? -5 : 0,-85) : new Vector3(4,short ? 4 : 6,-2);
			camera.CameraType=Enum.CameraType.Scriptable;camera.FieldOfView=55;camera.CFrame=CFrame.lookAt(ORIGIN.add(eye),ORIGIN.add(focus));
		});
		const input=UserInputService.InputBegan.Connect((key,processed)=>{
			dispatch(routeCinematicInput({kind:"shortcut",key:key.KeyCode.Name,
				processed:processed || GuiService.MenuIsOpen,guiSelected:GuiService.SelectedObject!==undefined}));
		});
		const inputType=UserInputService.LastInputTypeChanged.Connect((kind)=>{
			if(kind===Enum.UserInputType.MouseMovement || kind===Enum.UserInputType.Focus || kind===Enum.UserInputType.TextInput)return;
			setHintMode(hintModeFor(kind));
		});
		return ()=>{move.Disconnect();input.Disconnect();inputType.Disconnect();scene.Destroy();camera.CameraType=oldType;camera.FieldOfView=oldFov;camera.CFrame=oldFrame;};
	},[id]);

	const activate=(control:CinematicControl)=>()=>dispatch(routeCinematicInput({kind:"activated",control}));
	const {tiny,barHeight,margin,controlSize,chipHeight,chipTextSize}=layout;
	// Each control keeps a 44 px hit box; the visible pill sits inside it.
	const pill=(name:string,text:string,width:number,order:number,control:CinematicControl | undefined,highlight:boolean,onClick?:()=>void)=>
		<textbutton key={name} LayoutOrder={order} Size={UDim2.fromOffset(width,controlSize)} BackgroundTransparency={1} Text="" AutoButtonColor={false}
			Event={{Activated:onClick ?? (control ? activate(control) : undefined)}}>
			<frame key="Pill" AnchorPoint={new Vector2(.5,.5)} Position={UDim2.fromScale(.5,.5)} Size={new UDim2(1,-6,0,tiny ? 28 : 32)} BackgroundColor3={highlight ? ACCENT : INK} BackgroundTransparency={highlight ? .82 : .35} BorderSizePixel={0}>
				<uicorner CornerRadius={new UDim(1,0)}/>
				<uistroke Color={highlight ? ACCENT : IVORY} Transparency={highlight ? .25 : .7} Thickness={1}/>
				<textlabel key="Label" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1} Text={text} TextSize={tiny ? 12 : 13} Font={Enum.Font.GothamBold} TextColor3={highlight ? ACCENT : IVORY}/>
			</frame>
		</textbutton>;
	const toggle=(name:string,label:string,value:string,order:number,control:CinematicControl)=>
		<textbutton key={name} LayoutOrder={order} Size={new UDim2(1,0,0,controlSize)} BackgroundColor3={Color3.fromRGB(16,30,40)} BackgroundTransparency={.1} BorderSizePixel={0} Text="" AutoButtonColor={true} Event={{Activated:activate(control)}}>
			<uicorner CornerRadius={new UDim(0,8)}/>
			<textlabel key="Label" Position={UDim2.fromOffset(12,0)} Size={new UDim2(1,-70,1,0)} BackgroundTransparency={1} Text={label} TextXAlignment={Enum.TextXAlignment.Left} TextSize={13} Font={Enum.Font.GothamMedium} TextColor3={IVORY}/>
			<textlabel key="Value" AnchorPoint={new Vector2(1,0)} Position={new UDim2(1,-12,0,0)} Size={new UDim2(0,56,1,0)} BackgroundTransparency={1} Text={value} TextXAlignment={Enum.TextXAlignment.Right} TextSize={13} Font={Enum.Font.GothamBold} TextColor3={ACCENT}/>
		</textbutton>;
	// Lines mount hidden and RenderStepped fades them in (instant with reduced motion).
	const hidden=still ? 0 : 1;
	const controlsWidth=layout.skipWidth+controlSize*2;
	const eyebrow=tiny ? `${string.format("%02d",id)} — ${chapter.title}` : `BROKEN RELAY  ·  ${string.format("%02d",id)} — ${chapter.title}`;
	const dots=chapter.beats.map((_,i)=><frame key={`Dot${i}`} LayoutOrder={i} Size={UDim2.fromOffset(i===beat ? 14 : 6,6)} BackgroundColor3={i<=beat ? tone : FAINT} BackgroundTransparency={i<=beat ? 0 : .3} BorderSizePixel={0}><uicorner CornerRadius={new UDim(1,0)}/></frame>);
	return <frame key="CinematicScreen" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1}>
		{/* Tap or click anywhere on the scene for the next line. */}
		<textbutton key="CinematicAdvanceButton" ZIndex={1} Size={UDim2.fromScale(1,1)} BackgroundTransparency={1} Text="" AutoButtonColor={false} Selectable={false} Event={{Activated:activate("next")}}/>
		<frame key="CinematicTopBar" ZIndex={2} Size={new UDim2(1,0,0,barHeight)} BackgroundColor3={INK} BorderSizePixel={0}>
			<textlabel ref={eyebrowRef} key="CinematicTitle" Position={UDim2.fromOffset(margin,0)} Size={new UDim2(1,-margin*2-controlsWidth-8,1,0)} BackgroundTransparency={1} Text={eyebrow} TextXAlignment={Enum.TextXAlignment.Left} TextTruncate={Enum.TextTruncate.AtEnd} TextSize={layout.eyebrowSize} Font={Enum.Font.GothamBold} TextColor3={ACCENT}/>
			<frame key="CinematicActions" AnchorPoint={new Vector2(1,0)} Position={new UDim2(1,-margin+3,0,(barHeight-controlSize)/2)} Size={UDim2.fromOffset(controlsWidth,controlSize)} BackgroundTransparency={1}>
				<uilistlayout FillDirection={Enum.FillDirection.Horizontal} HorizontalAlignment={Enum.HorizontalAlignment.Right} SortOrder={Enum.SortOrder.LayoutOrder}/>
				{pill("CinematicSettingsButton","Aa",controlSize,1,undefined,settingsOpen,()=>setSettingsOpen((open)=>!open))}
				{pill("CinematicPauseButton",paused ? "▶" : "II",controlSize,2,"pause",paused)}
				{pill("CinematicSkipButton","SKIP  ›",layout.skipWidth,3,"skip",false)}
			</frame>
		</frame>
		{settingsOpen && <frame key="CinematicSettings" ZIndex={3} AnchorPoint={new Vector2(1,0)} Position={new UDim2(1,-margin,0,barHeight+4)} Size={UDim2.fromOffset(tiny ? 200 : 228,controlSize*2+12)} BackgroundColor3={INK} BackgroundTransparency={.15} BorderSizePixel={0}>
			<uicorner CornerRadius={new UDim(0,10)}/>
			<uipadding PaddingTop={new UDim(0,4)} PaddingBottom={new UDim(0,4)} PaddingLeft={new UDim(0,4)} PaddingRight={new UDim(0,4)}/>
			<uilistlayout Padding={new UDim(0,4)} SortOrder={Enum.SortOrder.LayoutOrder}/>
			{toggle("CinematicMotionButton","Camera motion",still ? "OFF" : "ON",1,"motion")}
			{toggle("CinematicTextButton","Large text",large ? "ON" : "OFF",2,"text")}
		</frame>}
		{paused && <frame key="CinematicPaused" ZIndex={2} AnchorPoint={new Vector2(.5,.5)} Position={new UDim2(.5,0,0,barHeight+(viewport.Y-barHeight-bandHeight)/2)} Size={UDim2.fromOffset(tiny ? 96 : 120,tiny ? 26 : 32)} BackgroundColor3={INK} BackgroundTransparency={.25} BorderSizePixel={0}>
			<uicorner CornerRadius={new UDim(1,0)}/>
			<textlabel key="Label" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1} Text="PAUSED" TextSize={tiny ? 11 : 13} Font={Enum.Font.GothamBlack} TextColor3={IVORY}/>
		</frame>}
		<frame key="CinematicDialogue" ZIndex={2} AnchorPoint={new Vector2(0,1)} Position={UDim2.fromScale(0,1)} Size={new UDim2(1,0,0,bandHeight)} BackgroundColor3={INK} BorderSizePixel={0}>
			{/* Soft edge so the letterbox reads as part of the shot, not a slab. */}
			<frame key="Feather" AnchorPoint={new Vector2(0,1)} Size={new UDim2(1,0,0,tiny ? 8 : 18)} BackgroundColor3={INK} BorderSizePixel={0}>
				<uigradient Rotation={90} Transparency={new NumberSequence(1,0)}/>
			</frame>
			<frame key="Column" AnchorPoint={new Vector2(.5,0)} Position={UDim2.fromScale(.5,0)} Size={new UDim2(0,layout.textWidth,1,0)} BackgroundTransparency={1}>
				<frame key="CinematicSpeaker" Position={UDim2.fromOffset(0,chipY)} Size={new UDim2(1,0,0,chipHeight)} BackgroundTransparency={1}>
					<frame key="Who" Size={new UDim2(1,-(tiny ? 44 : 200),1,0)} BackgroundTransparency={1}>
						<uilistlayout FillDirection={Enum.FillDirection.Horizontal} VerticalAlignment={Enum.VerticalAlignment.Center} Padding={new UDim(0,6)} SortOrder={Enum.SortOrder.LayoutOrder}/>
						<frame key="Swatch" LayoutOrder={1} Size={UDim2.fromOffset(3,chipHeight-6)} BackgroundColor3={tone} BorderSizePixel={0}/>
						<textlabel ref={nameRef} key="SpeakerName" TextTransparency={hidden} LayoutOrder={2} AutomaticSize={Enum.AutomaticSize.X} Size={new UDim2(0,0,1,0)} BackgroundTransparency={1} Text={speaker.name} TextSize={chipTextSize} Font={speaker.tone==="log" ? Enum.Font.RobotoMono : Enum.Font.GothamBlack} TextColor3={tone}/>
						{speaker.role !== undefined && <textlabel ref={roleRef} key="SpeakerRole" TextTransparency={hidden} LayoutOrder={3} AutomaticSize={Enum.AutomaticSize.X} Size={new UDim2(0,0,1,0)} BackgroundTransparency={1} Text={speaker.role} TextSize={chipTextSize-1} Font={Enum.Font.GothamMedium} TextColor3={MUTED}/>}
					</frame>
					<frame key="Progress" AnchorPoint={new Vector2(1,0)} Position={UDim2.fromScale(1,0)} Size={new UDim2(0,tiny ? 40 : 200,1,0)} BackgroundTransparency={1}>
						<uilistlayout FillDirection={Enum.FillDirection.Horizontal} HorizontalAlignment={Enum.HorizontalAlignment.Right} VerticalAlignment={Enum.VerticalAlignment.Center} Padding={new UDim(0,4)} SortOrder={Enum.SortOrder.LayoutOrder}/>
						{!tiny && <textlabel key="Hint" LayoutOrder={0} AutomaticSize={Enum.AutomaticSize.X} Size={new UDim2(0,0,1,0)} BackgroundTransparency={1} Text={`${HINT[hintMode]}   `} TextSize={chipTextSize-2} Font={Enum.Font.GothamMedium} TextColor3={FAINT}/>}
						{dots}
					</frame>
				</frame>
				<scrollingframe ref={subtitleRef} key="CinematicSubtitles" Position={UDim2.fromOffset(0,textY)} Size={new UDim2(1,0,0,textAreaHeight)} BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={UDim2.fromOffset(0,textHeight)} ScrollBarThickness={overflow ? 3 : 0} ScrollingEnabled={overflow} ScrollingDirection={Enum.ScrollingDirection.Y} Selectable={overflow} Active={overflow}>
					<textlabel ref={bodyRef} key="CinematicLine" TextTransparency={hidden} Size={new UDim2(1,overflow ? -6 : 0,0,textHeight)} BackgroundTransparency={1} Text={current.text} TextWrapped={true} TextSize={layout.bodySize} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top} TextColor3={speaker.tone==="log" ? Color3.fromRGB(214,222,214) : IVORY} Font={bodyFont(current)}/>
				</scrollingframe>
				<frame key="CinematicBeatTimer" AnchorPoint={new Vector2(0,.5)} Position={new UDim2(0,0,1,-layout.padBottom/2)} Size={new UDim2(1,0,0,layout.progressHeight)} BackgroundColor3={IVORY} BackgroundTransparency={.88} BorderSizePixel={0}>
					<frame ref={progressRef} key="Fill" Size={UDim2.fromScale(0,1)} BackgroundColor3={tone} BackgroundTransparency={.2} BorderSizePixel={0}/>
				</frame>
			</frame>
		</frame>
		<frame ref={fadeRef} key="CinematicFade" ZIndex={4} Size={UDim2.fromScale(1,1)} BackgroundColor3={Color3.fromRGB(0,0,0)} BackgroundTransparency={0} BorderSizePixel={0}/>
	</frame>;
}
