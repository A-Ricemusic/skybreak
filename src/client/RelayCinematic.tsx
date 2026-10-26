import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, Lighting, ReplicatedStorage, RunService, TextService, UserInputService, Workspace } from "@rbxts/services";
import { CinematicAction, CinematicControl, routeCinematicInput } from "../shared/CinematicInput";
import { cinematicBandHeight, getCinematicLayout } from "../shared/CinematicLayout";
import { CHAIR, RECORDER, Rgb, Vec, isCard, moodLighting, recorderLightOn, reelsSpin, sceneTint, shotPose } from "../shared/CinematicStaging";
import { SpeakerTone, StoryBeat, StoryChapter, speakerStyle, storyFor } from "../shared/RelayStory";

const ORIGIN=new Vector3(0,6000,0);
const vec=(p:Vec)=>new Vector3(p.x,p.y,p.z),col=(c:Rgb)=>Color3.fromRGB(c.r,c.g,c.b),rgb=(c:Color3):Rgb=>({r:c.R*255,g:c.G*255,b:c.B*255});
/** Seconds a cinematic beat stays on screen: clamp(characters/14, 5, 9). */
export function beatDuration(text:string): number { return math.clamp(text.size()/14,5,9); }
function prop(parent:Instance,name:string,size:Vector3,pos:Vector3,color:Color3,material:Enum.Material=Enum.Material.Metal): Part {
	const p=new Instance("Part"); p.Name=name; p.Size=size; p.Position=ORIGIN.add(pos); p.Color=color; p.Material=material;
	p.Anchored=true; p.CanCollide=false; p.CanTouch=false; p.CanQuery=false; p.Parent=parent; return p;
}
interface Stage { scene:Folder; reels:{part:Part;base:CFrame}[]; recorderLight:Part; }
const SUBJECT_Y:Record<string,number>={RelayTruck:18,HarborLaunch:19,CommsRelay:45};
function cloneModel(template:Instance | undefined,parent:Instance,name:string,cf:CFrame): void {
	if(!template?.IsA("Model"))return;
	const model=template.Clone();model.Name=name;model.PivotTo(cf);model.Parent=parent;
}
/** One stage per chapter: the radio desk is always there; the surroundings follow `scene`, props tint to `mood`. */
function sceneFor(chapter:StoryChapter): Stage {
	const {scene:kind,mood}=chapter,scene=new Instance("Folder"); scene.Name="BrokenRelayCinematic"; scene.Parent=Workspace;
	const tint=(c:Color3)=>col(sceneTint(rgb(c),mood));
	const sea=kind==="sea";
	if(sea) prop(scene,"Stage",new Vector3(700,4,700),new Vector3(0,-4,0),tint(Color3.fromRGB(16,38,70)),Enum.Material.Glass).Reflectance=.25;
	else prop(scene,"Stage",new Vector3(700,4,700),new Vector3(0,-4,0),tint(Color3.fromRGB(40,57,64)),Enum.Material.Slate);
	prop(scene,"Radio desk",new Vector3(16,2,9),new Vector3(0,4,0),Color3.fromRGB(93,63,47),Enum.Material.Wood);
	const radio=prop(scene,"Teal's receiver",new Vector3(7,4,3),new Vector3(0,7,0),Color3.fromRGB(44,68,75));
	prop(scene,"Frequency window",new Vector3(4.5,.7,.2),new Vector3(0,7.6,-1.6),Color3.fromRGB(76,234,208),Enum.Material.Neon);
	// Reels are cylinders (axis along X, turned to face the camera) with a spoke so the spin reads.
	const reels:Stage["reels"]=[];
	for(const x of [-2.4,2.4]) {
		const base=new CFrame(ORIGIN.add(new Vector3(x,6.4,-1.7))).mul(CFrame.Angles(0,math.pi/2,0));
		const reel=prop(scene,"Tape reel",new Vector3(.4,1.7,1.7),Vector3.zero,Color3.fromRGB(197,178,132));reel.Shape=Enum.PartType.Cylinder;reel.CFrame=base;
		const spoke=prop(scene,"Tape reel",new Vector3(.5,.18,1.4),Vector3.zero,Color3.fromRGB(70,58,40));spoke.CFrame=base;
		reels.push({part:reel,base},{part:spoke,base});
	}
	prop(scene,"Flight chart",new Vector3(5,.15,5),new Vector3(6,5.2,0),Color3.fromRGB(213,207,176),Enum.Material.SmoothPlastic);
	// Teal's handheld recorder: a dented grey box with a red tally lamp that blinks in recorder shots.
	const rec=prop(scene,"Recorder",new Vector3(2,1,3),vec(RECORDER),Color3.fromRGB(96,99,102),Enum.Material.DiamondPlate);
	rec.CFrame=rec.CFrame.mul(CFrame.Angles(0,-.35,.04));
	prop(scene,"Recorder dent",new Vector3(.7,.3,.9),vec(RECORDER).add(new Vector3(.5,.4,-.8)),Color3.fromRGB(70,72,74),Enum.Material.Metal);
	const recorderLight=prop(scene,"Recorder light",new Vector3(.3,.2,.3),vec(RECORDER).add(new Vector3(-.6,.55,1.1)),Color3.fromRGB(255,40,40),Enum.Material.Neon);
	const lighting=moodLighting(mood);
	const lamp=new Instance("PointLight");lamp.Brightness=lighting.lamp;lamp.Range=mood==="night" ? 80 : 60;lamp.Color=Color3.fromRGB(255,218,171);lamp.Parent=radio;
	const models=ReplicatedStorage.FindFirstChild("RelayStoryModels");
	const subject=kind==="farm" ? "RelayTruck" : kind==="harbor" || sea ? "HarborLaunch" : "CommsRelay";
	cloneModel(models?.FindFirstChild(subject),scene,"Story subject",new CFrame(ORIGIN.add(new Vector3(45,SUBJECT_Y[subject],-65))));
	const jet=Workspace.FindFirstChild("World")?.FindFirstChild("DisplayJet",true);
	cloneModel(jet,scene,"Kestrel",new CFrame(ORIGIN.add(new Vector3(-40,7,-60))).mul(CFrame.Angles(0,.7,0)));
	if(kind==="hangar") {
		// The empty instructor's chair beside the desk, worn leather; the `chair` shot pushes in on it.
		const leather=Color3.fromRGB(96,60,42),c=vec(CHAIR);
		prop(scene,"Instructor's chair",new Vector3(4,.6,4),c,leather,Enum.Material.Fabric);
		prop(scene,"Instructor's chair",new Vector3(4,4.2,.6),c.add(new Vector3(0,2.4,1.9)),leather,Enum.Material.Fabric);
		for(const [dx,dz] of [[-1.6,-1.6],[1.6,-1.6],[-1.6,1.6],[1.6,1.6]]) prop(scene,"Chair leg",new Vector3(.3,c.Y+2,.3),new Vector3(c.X+dx,(c.Y-2)/2-.3,c.Z+dz),Color3.fromRGB(52,54,58));
		// A second parked airframe far back and hangar wall slabs close the room in.
		cloneModel(jet,scene,"Parked jet",new CFrame(ORIGIN.add(new Vector3(70,7,-150))).mul(CFrame.Angles(0,2.3,0)));
		const wall=tint(Color3.fromRGB(58,62,68));
		prop(scene,"Hangar wall",new Vector3(520,120,6),new Vector3(0,58,-230),wall,Enum.Material.Concrete);
		for(const x of [-260,260]) prop(scene,"Hangar wall",new Vector3(6,120,460),new Vector3(x,58,0),wall,Enum.Material.Concrete);
		prop(scene,"Hangar beam",new Vector3(520,4,4),new Vector3(0,118,-120),Color3.fromRGB(40,42,46));
	}
	if(sea) prop(scene,"Sea platform",new Vector3(70,12,70),new Vector3(45,4,-65),tint(Color3.fromRGB(70,76,82)),Enum.Material.Concrete);
	if(kind==="relay") for(let i=0;i<6;i++) {
		const ang=i/6*math.pi*2,r=75;
		prop(scene,"Antenna mast",new Vector3(2,40+(i%2)*14,2),new Vector3(45+math.cos(ang)*r,20+(i%2)*7,-65+math.sin(ang)*r),tint(Color3.fromRGB(150,156,160)));
	}
	if(!sea && kind!=="hangar") {
		const color=tint(kind==="farm" ? Color3.fromRGB(82,113,63) : kind==="canyon" ? Color3.fromRGB(152,102,67) : kind==="city" ? Color3.fromRGB(44,52,66) : Color3.fromRGB(90,115,129));
		for(let i=0;i<7;i++) {
			const h=kind==="city" ? 110+(i%3)*40 : kind==="canyon" ? 100+(i%3)*28 : 20+(i%3)*8,x=-180+i*60,z=-180-(i%2)*60;
			prop(scene,kind,new Vector3(50,h,65),new Vector3(x,h/2,z),color,kind==="farm" ? Enum.Material.Grass : Enum.Material.Concrete);
			// A few lit window strips so the city reads as inhabited at any mood.
			if(kind==="city") for(let w=0;w<3;w++) prop(scene,"Window strip",new Vector3(30,1.2,.4),new Vector3(x,h*(.35+w*.22),z+32.7),(i+w)%3===0 ? Color3.fromRGB(255,120,200) : Color3.fromRGB(120,230,255),Enum.Material.Neon);
		}
	}
	// Evidence path illuminates as the camera advances through this chapter.
	for(let i=0;i<5;i++) prop(scene,"Evidence chain",new Vector3(5,1,5),new Vector3(-10+i*7,.3,-25),Color3.fromRGB(68,218,196),Enum.Material.Neon);
	return {scene,reels,recorderLight};
}
type LightingKeys="ClockTime" | "Brightness" | "Ambient" | "OutdoorAmbient" | "FogColor" | "FogEnd" | "FogStart" | "ExposureCompensation";
const LIGHTING_KEYS:LightingKeys[]=["ClockTime","Brightness","Ambient","OutdoorAmbient","FogColor","FogEnd","FogStart","ExposureCompensation"];
/** Applies the mood to Lighting (service properties only; the server owns Sky/Atmosphere) and returns the restore function. */
function stageLighting(mood:StoryChapter["mood"]): ()=>void {
	const saved:Partial<Record<LightingKeys,unknown>>={};
	for(const key of LIGHTING_KEYS)saved[key]=Lighting[key];
	const l=moodLighting(mood);
	Lighting.ClockTime=l.clockTime;Lighting.Brightness=l.brightness;Lighting.ExposureCompensation=l.exposure;
	Lighting.Ambient=col(l.ambient);Lighting.OutdoorAmbient=col(l.outdoorAmbient);Lighting.FogColor=col(l.fogColor);Lighting.FogStart=l.fogStart;Lighting.FogEnd=l.fogEnd;
	return ()=>{for(const key of LIGHTING_KEYS)(Lighting as unknown as Record<LightingKeys,unknown>)[key]=saved[key];};
}
const INK=Color3.fromRGB(4,9,14),IVORY=Color3.fromRGB(242,238,226),MUTED=Color3.fromRGB(152,168,176),FAINT=Color3.fromRGB(104,122,132);
const ACCENT=Color3.fromRGB(64,224,206),ORANGE=Color3.fromRGB(255,150,84),DANGER=Color3.fromRGB(255,84,76),AMBER=Color3.fromRGB(242,196,78);
const TONE_COLOR:Record<SpeakerTone,Color3>={teal:ACCENT,control:ORANGE,log:MUTED,marshal:DANGER,trainee:IVORY,wing:AMBER};
const bodyFont=(beat:StoryBeat)=>speakerStyle(beat.speaker).tone==="log" ? Enum.Font.RobotoMono : Enum.Font.GothamMedium;
/** Accessibility choices persist for the rest of the session. */
const prefs={still:false,large:false};
const TEXT_FADE_IN=.25,TEXT_FADE_OUT=.2,CUT_DIP=.3,CUT_BLACK=.85,ENTER_FADE=.5,EXIT_FADE=.5,SCROLL_GUTTER=6;
type HintMode="touch" | "keyboard" | "gamepad";
function hintModeFor(input:Enum.UserInputType): HintMode {
	if(input===Enum.UserInputType.Touch)return "touch";
	return input.Name.sub(1,7)==="Gamepad" ? "gamepad" : "keyboard";
}
const HINT:Record<HintMode,string>={touch:"TAP FOR NEXT",keyboard:"CLICK FOR NEXT",gamepad:"R1 NEXT"};

export function RelayCinematic({id,viewport,onFinish,onCancel}:{id:number;viewport:Vector2;onFinish:()=>void;onCancel:()=>void}) {
	const chapter=storyFor(id);
	const [beat,setBeat]=useState(0),[paused,setPaused]=useState(false),[still,setStill]=useState(prefs.still),[large,setLarge]=useState(prefs.large);
	const [settingsOpen,setSettingsOpen]=useState(false),[hintMode,setHintMode]=useState<HintMode>(hintModeFor(UserInputService.GetLastInputType()));
	const layout=getCinematicLayout(viewport.X,viewport.Y,large);
	const viewportRef=useRef(viewport);viewportRef.current=viewport;
	const current=chapter.beats[beat],speaker=speakerStyle(current.speaker),tone=TONE_COLOR[speaker.tone],card=isCard(current.shot);
	// AutomaticSize underreports wrapped text after accessibility-size changes
	// (TextFits=false). Measure the real font so the band fits the chapter's
	// longest line and the scroller has an explicit canvas for any overflow.
	// Measure and render at the same width; it always leaves room for the overflow scroll bar.
	const wrapWidth=math.max(1,layout.textWidth-SCROLL_GUTTER);
	const measure=(b:StoryBeat)=>TextService.GetTextSize(b.text,layout.bodySize,bodyFont(b),new Vector2(wrapWidth,10000)).Y+4;
	const textHeight=measure(current);
	let tallest=0;
	for(const b of chapter.beats)tallest=math.max(tallest,measure(b));
	const bandHeight=cinematicBandHeight(layout,tallest);
	const textAreaHeight=math.min(textHeight,layout.maxTextHeight),overflow=textHeight>layout.maxTextHeight;
	const textY=bandHeight-layout.padBottom-textAreaHeight,chipY=textY-layout.chipGap-layout.chipHeight;
	const subtitleRef=useRef<ScrollingFrame>(),bodyRef=useRef<TextLabel>(),nameRef=useRef<TextLabel>(),roleRef=useRef<TextLabel>();
	const progressRef=useRef<Frame>(),fadeRef=useRef<Frame>(),eyebrowRef=useRef<TextLabel>(),cardBodyRef=useRef<TextLabel>(),cardNameRef=useRef<TextLabel>();
	useEffect(()=>{if(subtitleRef.current)subtitleRef.current.CanvasPosition=Vector2.zero;},[beat]);
	const pausedRef=useRef(false),stillRef=useRef(prefs.still),finishRef=useRef(onFinish),cancelRef=useRef(onCancel),done=useRef(false);
	// Longer lines stay on screen longer: 5-9 s per beat, scaled by text length.
	const durations=chapter.beats.map((b)=>beatDuration(b.text));
	// endRef is when the current beat hands over; a manual "next" pulls it in to
	// start the outro (text fade + dip to black) instead of hard-cutting.
	const indexRef=useRef(0),beatTimeRef=useRef(0),endRef=useRef(durations[0]);
	finishRef.current=onFinish;cancelRef.current=onCancel;
	const finish=()=>{if(done.current)return;done.current=true;finishRef.current();};
	const setTextAlpha=(alpha:number)=>{for(const label of [bodyRef.current,nameRef.current,roleRef.current,cardBodyRef.current,cardNameRef.current])if(label)label.TextTransparency=alpha;};
	const goTo=(index:number)=>{
		// Hide the outgoing line before React swaps text so it can fade in cleanly.
		if(!stillRef.current)setTextAlpha(1);
		indexRef.current=index;beatTimeRef.current=0;endRef.current=durations[index];setBeat(index);
	};
	const advance=()=>{if(indexRef.current<chapter.beats.size()-1)goTo(indexRef.current+1);else finish();};
	const requestNext=()=>{
		if(stillRef.current){advance();return;}
		const t=beatTimeRef.current;
		if(endRef.current-t<=CUT_DIP)return; // outro already running; ignore repeat taps
		endRef.current=t+CUT_DIP;
	};
	const dispatch=(action:CinematicAction | undefined)=>{
		if(done.current)return;
		if(action==="skip")finish();
		else if(action==="cancel"){done.current=true;cancelRef.current();}
		else if(action==="pause"){pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);}
		else if(action==="next"){if(pausedRef.current){pausedRef.current=false;setPaused(false);}requestNext();}
		else if(action==="motion"){stillRef.current=!stillRef.current;prefs.still=stillRef.current;setStill(stillRef.current);}
		else if(action==="text"){prefs.large=!prefs.large;setLarge(prefs.large);}
	};
	useEffect(()=>{
		// Timeline and overlay run even without a camera so the fade can never stick on black.
		const camera=Workspace.CurrentCamera;
		const oldType=camera?.CameraType,oldFov=camera?.FieldOfView,oldFrame=camera?.CFrame;
		const stage=sceneFor(chapter),restoreLighting=stageLighting(chapter.mood);let clock=0,reelAngle=0;
		const last=chapter.beats.size()-1;
		const move=RunService.RenderStepped.Connect((dt)=>{
			if(done.current)return;
			const step=math.min(dt,.1);
			clock+=step;if(!pausedRef.current)beatTimeRef.current+=step;
			if(beatTimeRef.current>=endRef.current){advance();if(done.current)return;}
			const index=indexRef.current,t=beatTimeRef.current,duration=durations[index],calm=stillRef.current;
			const left=endRef.current-t;
			// Text: short fade in, and fade out over the outro, unless reduced motion asks for instant swaps.
			setTextAlpha(calm ? 0 : 1-math.min(math.clamp(t/TEXT_FADE_IN,0,1),index===last ? 1 : math.clamp(left/TEXT_FADE_OUT,0,1)));
			if(progressRef.current)progressRef.current.Size=new UDim2(math.clamp(t/duration,0,1),0,1,0);
			if(eyebrowRef.current)eyebrowRef.current.TextColor3=ACCENT.Lerp(MUTED,math.clamp((clock-2.5)/1,0,1));
			// Black overlay: fade up from black, dip on camera cuts, fade out at the natural end.
			const enter=1-math.clamp(clock/ENTER_FADE,0,1);
			// Cut dip: darken over the outgoing beat's last CUT_DIP, then lift on the incoming shot.
			const dipOut=calm || index===last ? 0 : (1-math.clamp(left/CUT_DIP,0,1))*CUT_BLACK;
			const dipIn=calm || index===0 ? 0 : (1-math.clamp(t/CUT_DIP,0,1))*CUT_BLACK;
			const exitSpan=endRef.current<duration ? CUT_DIP : EXIT_FADE;
			const exit=index===last ? 1-math.clamp(left/exitSpan,0,1) : 0;
			if(fadeRef.current)fadeRef.current.BackgroundTransparency=1-math.max(enter,dipOut,dipIn,exit);
			// Stage life: reels turn while a tape or the log speaks; the recorder lamp blinks in its close-up.
			const {shot,speaker:who}=chapter.beats[index];
			if(!pausedRef.current && reelsSpin(speakerStyle(who).tone))reelAngle+=step*2.4;
			for(const {part,base} of stage.reels)part.CFrame=base.mul(CFrame.Angles(reelAngle,0,0));
			stage.recorderLight.Transparency=recorderLightOn(shot,clock) ? 0 : shot==="recorder" ? .85 : .55;
			// Camera framing follows the beat's shot; camera motion OFF holds each shot's mid pose.
			const alpha=calm ? .5 : math.clamp(t/duration,0,1);
			const pose=shotPose(shot,chapter.scene,alpha,viewportRef.current.Y<240);
			if(!camera)return;
			camera.CameraType=Enum.CameraType.Scriptable;camera.FieldOfView=pose.fov;camera.CFrame=CFrame.lookAt(ORIGIN.add(vec(pose.eye)),ORIGIN.add(vec(pose.focus)));
		});
		const input=UserInputService.InputBegan.Connect((key,processed)=>{
			dispatch(routeCinematicInput({kind:"shortcut",key:key.KeyCode.Name,
				processed:processed || GuiService.MenuIsOpen,guiSelected:GuiService.SelectedObject!==undefined}));
		});
		const inputType=UserInputService.LastInputTypeChanged.Connect((kind)=>{
			if(kind===Enum.UserInputType.MouseMovement || kind===Enum.UserInputType.Focus || kind===Enum.UserInputType.TextInput)return;
			setHintMode(hintModeFor(kind));
		});
		// Unmount (finish, skip or cancel) puts the stage, lighting and camera back exactly as found.
		return ()=>{move.Disconnect();input.Disconnect();inputType.Disconnect();stage.scene.Destroy();restoreLighting();if(camera && oldType && oldFov!==undefined && oldFrame){camera.CameraType=oldType;camera.FieldOfView=oldFov;camera.CFrame=oldFrame;}};
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
	// Dots for 1-8 beats; on tiny roots the strip grows to fit instead of spilling into the chip.
	const dots=chapter.beats.map((_,i)=><frame key={`Dot${i}`} LayoutOrder={i} Size={UDim2.fromOffset(i===beat ? 14 : 6,6)} BackgroundColor3={i<=beat ? tone : FAINT} BackgroundTransparency={i<=beat ? 0 : .3} BorderSizePixel={0}><uicorner CornerRadius={new UDim(1,0)}/></frame>);
	const dotsWidth=tiny ? math.max(40,chapter.beats.size()*10+8) : 200;
	// Layering: scene tap target 1, lower third 2, title card 3, top bar and pause chip 4, settings 5, fade 6.
	return <frame key="CinematicScreen" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1}>
		{/* Tap or click anywhere on the scene for the next line. */}
		<textbutton key="CinematicAdvanceButton" ZIndex={1} Size={UDim2.fromScale(1,1)} BackgroundTransparency={1} Text="" AutoButtonColor={false} Selectable={false} Event={{Activated:activate("next")}}/>
		<frame key="CinematicTopBar" ZIndex={4} Size={new UDim2(1,0,0,barHeight)} BackgroundColor3={INK} BorderSizePixel={0}>
			<textlabel ref={eyebrowRef} key="CinematicTitle" Position={UDim2.fromOffset(margin,0)} Size={new UDim2(1,-margin*2-controlsWidth-8,1,0)} BackgroundTransparency={1} Text={eyebrow} TextXAlignment={Enum.TextXAlignment.Left} TextTruncate={Enum.TextTruncate.AtEnd} TextSize={layout.eyebrowSize} Font={Enum.Font.GothamBold} TextColor3={ACCENT}/>
			<frame key="CinematicActions" AnchorPoint={new Vector2(1,0)} Position={new UDim2(1,-margin+3,0,(barHeight-controlSize)/2)} Size={UDim2.fromOffset(controlsWidth,controlSize)} BackgroundTransparency={1}>
				<uilistlayout FillDirection={Enum.FillDirection.Horizontal} HorizontalAlignment={Enum.HorizontalAlignment.Right} SortOrder={Enum.SortOrder.LayoutOrder}/>
				{pill("CinematicSettingsButton","Aa",controlSize,1,undefined,settingsOpen,()=>setSettingsOpen((open)=>!open))}
				{pill("CinematicPauseButton",paused ? ">" : "II",controlSize,2,"pause",paused)}
				{pill("CinematicSkipButton","SKIP  >>",layout.skipWidth,3,"skip",false)}
			</frame>
		</frame>
		{settingsOpen && <frame key="CinematicSettings" ZIndex={5} AnchorPoint={new Vector2(1,0)} Position={new UDim2(1,-margin,0,barHeight+4)} Size={UDim2.fromOffset(tiny ? 200 : 228,controlSize*2+12)} BackgroundColor3={INK} BackgroundTransparency={.15} BorderSizePixel={0}>
			<uicorner CornerRadius={new UDim(0,10)}/>
			<uipadding PaddingTop={new UDim(0,4)} PaddingBottom={new UDim(0,4)} PaddingLeft={new UDim(0,4)} PaddingRight={new UDim(0,4)}/>
			<uilistlayout Padding={new UDim(0,4)} SortOrder={Enum.SortOrder.LayoutOrder}/>
			{toggle("CinematicMotionButton","Camera motion",still ? "OFF" : "ON",1,"motion")}
			{toggle("CinematicTextButton","Large text",large ? "ON" : "OFF",2,"text")}
		</frame>}
		{paused && <frame key="CinematicPaused" ZIndex={4} AnchorPoint={new Vector2(.5,.5)} Position={new UDim2(.5,0,0,barHeight+(viewport.Y-barHeight-bandHeight)/2)} Size={UDim2.fromOffset(tiny ? 96 : 120,tiny ? 26 : 32)} BackgroundColor3={INK} BackgroundTransparency={.25} BorderSizePixel={0}>
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
					<frame key="Who" Size={new UDim2(1,-dotsWidth-4,1,0)} BackgroundTransparency={1}>
						<uilistlayout FillDirection={Enum.FillDirection.Horizontal} VerticalAlignment={Enum.VerticalAlignment.Center} Padding={new UDim(0,6)} SortOrder={Enum.SortOrder.LayoutOrder}/>
						<frame key="Swatch" LayoutOrder={1} Size={UDim2.fromOffset(3,chipHeight-6)} BackgroundColor3={tone} BorderSizePixel={0}/>
						<textlabel ref={nameRef} key="SpeakerName" TextTransparency={hidden} LayoutOrder={2} AutomaticSize={Enum.AutomaticSize.X} Size={new UDim2(0,0,1,0)} BackgroundTransparency={1} Text={speaker.name} TextSize={chipTextSize} Font={speaker.tone==="log" ? Enum.Font.RobotoMono : Enum.Font.GothamBlack} TextColor3={tone}/>
						{speaker.role !== undefined && <textlabel ref={roleRef} key="SpeakerRole" TextTransparency={hidden} LayoutOrder={3} AutomaticSize={Enum.AutomaticSize.X} Size={new UDim2(0,0,1,0)} BackgroundTransparency={1} Text={speaker.role} TextSize={chipTextSize-1} Font={Enum.Font.GothamMedium} TextColor3={MUTED}/>}
					</frame>
					<frame key="Progress" AnchorPoint={new Vector2(1,0)} Position={UDim2.fromScale(1,0)} Size={new UDim2(0,dotsWidth,1,0)} BackgroundTransparency={1}>
						<uilistlayout FillDirection={Enum.FillDirection.Horizontal} HorizontalAlignment={Enum.HorizontalAlignment.Right} VerticalAlignment={Enum.VerticalAlignment.Center} Padding={new UDim(0,4)} SortOrder={Enum.SortOrder.LayoutOrder}/>
						{!tiny && <textlabel key="Hint" LayoutOrder={0} AutomaticSize={Enum.AutomaticSize.X} Size={new UDim2(0,0,1,0)} BackgroundTransparency={1} Text={`${HINT[hintMode]}   `} TextSize={chipTextSize-2} Font={Enum.Font.GothamMedium} TextColor3={FAINT}/>}
						{dots}
					</frame>
				</frame>
				<scrollingframe ref={subtitleRef} key="CinematicSubtitles" Position={UDim2.fromOffset(0,textY)} Size={new UDim2(1,0,0,textAreaHeight)} BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={UDim2.fromOffset(0,textHeight)} ScrollBarThickness={overflow ? 3 : 0} ScrollingEnabled={overflow} ScrollingDirection={Enum.ScrollingDirection.Y} Selectable={overflow} Active={overflow}>
					<textlabel ref={bodyRef} key="CinematicLine" TextTransparency={hidden} Size={new UDim2(0,wrapWidth,0,textHeight)} BackgroundTransparency={1} Text={current.text} TextWrapped={true} TextSize={layout.bodySize} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top} TextColor3={speaker.tone==="log" ? Color3.fromRGB(214,222,214) : IVORY} Font={bodyFont(current)}/>
				</scrollingframe>
				<frame key="CinematicBeatTimer" AnchorPoint={new Vector2(0,.5)} Position={new UDim2(0,0,1,-layout.padBottom/2)} Size={new UDim2(1,0,0,layout.progressHeight)} BackgroundColor3={IVORY} BackgroundTransparency={.88} BorderSizePixel={0}>
					<frame ref={progressRef} key="Fill" Size={UDim2.fromScale(0,1)} BackgroundColor3={tone} BackgroundTransparency={.2} BorderSizePixel={0}/>
				</frame>
			</frame>
		</frame>
		{/* Title card: the `black` shot keeps the screen black and centres the line in large ivory, chip small above it. */}
		{card && <frame key="CinematicCard" ZIndex={3} Size={UDim2.fromScale(1,1)} BackgroundColor3={Color3.fromRGB(0,0,0)} BorderSizePixel={0}>
			<frame key="Column" AnchorPoint={new Vector2(.5,.5)} Position={new UDim2(.5,0,.5,(barHeight-bandHeight)/2)} Size={new UDim2(0,layout.textWidth,0,0)} AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1}>
				<uilistlayout HorizontalAlignment={Enum.HorizontalAlignment.Center} Padding={new UDim(0,tiny ? 6 : 14)} SortOrder={Enum.SortOrder.LayoutOrder}/>
				<textlabel ref={cardNameRef} key="CardSpeaker" TextTransparency={hidden} LayoutOrder={1} Size={new UDim2(1,0,0,chipHeight)} BackgroundTransparency={1} Text={speaker.role !== undefined ? `${speaker.name}  ·  ${speaker.role}` : speaker.name} TextSize={chipTextSize} Font={speaker.tone==="log" ? Enum.Font.RobotoMono : Enum.Font.GothamBlack} TextColor3={tone}/>
				<textlabel ref={cardBodyRef} key="CardLine" TextTransparency={hidden} LayoutOrder={2} Size={new UDim2(1,0,0,0)} AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} Text={current.text} TextWrapped={true} TextSize={math.floor(layout.bodySize*(tiny ? 1.2 : 1.5))} TextXAlignment={Enum.TextXAlignment.Center} TextColor3={IVORY} Font={speaker.tone==="log" ? Enum.Font.RobotoMono : Enum.Font.GothamMedium} LineHeight={1.15}/>
			</frame>
		</frame>}
		<frame ref={fadeRef} key="CinematicFade" ZIndex={6} Size={UDim2.fromScale(1,1)} BackgroundColor3={Color3.fromRGB(0,0,0)} BackgroundTransparency={0} BorderSizePixel={0}/>
	</frame>;
}
