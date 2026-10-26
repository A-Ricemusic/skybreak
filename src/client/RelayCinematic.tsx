import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, Lighting, ReplicatedStorage, RunService, TextService, UserInputService, Workspace } from "@rbxts/services";
import { CinematicAction, CinematicControl, routeCinematicInput } from "../shared/CinematicInput";
import { Rect, getCinematicFrame, getCinematicLayout, progressSegments } from "../shared/CinematicLayout";
import { AURORA, BOARD, CHAIR, CHART, RECORDER, Rgb, SUBJECT, TIN, Vec, auroraVisible, boardShowsTeal, cardVignette, isCard, isTyped, moodLighting, orchardBurned, recorderLightOn, recorderOpen, reelsSpin, sceneTint, shotPose, stageSubject, tapesInTin, typedGraphemes } from "../shared/CinematicStaging";
import { SpeakerTone, StoryBeat, StoryChapter, speakerStyle, storyFor } from "../shared/RelayStory";
import { MotionPreference } from "./MotionPreference";
import { documentFor, documentLine } from "../shared/StoryDocuments";

const ORIGIN=new Vector3(0,6000,0);
const vec=(p:Vec)=>new Vector3(p.x,p.y,p.z),col=(c:Rgb)=>Color3.fromRGB(c.r,c.g,c.b),rgb=(c:Color3):Rgb=>({r:c.R*255,g:c.G*255,b:c.B*255});
/** Seconds a cinematic beat stays on screen: clamp(characters/14, 5, 9). */
export function beatDuration(text:string): number { return math.clamp(text.size()/14,5,9); }
function prop(parent:Instance,name:string,size:Vector3,pos:Vector3,color:Color3,material:Enum.Material=Enum.Material.Metal): Part {
	const p=new Instance("Part"); p.Name=name; p.Size=size; p.Position=ORIGIN.add(pos); p.Color=color; p.Material=material;
	p.Anchored=true; p.CanCollide=false; p.CanTouch=false; p.CanQuery=false; p.Parent=parent; return p;
}
interface Stage { scene:Folder; reels:{part:Part;base:CFrame}[]; recorderLight:Part; tealStrip:Part; }
const SUBJECT_Y:Record<string,number>={RelayTruck:18,HarborLaunch:19,CommsRelay:45};
function cloneModel(template:Instance | undefined,parent:Instance,name:string,cf:CFrame): void {
	if(!template?.IsA("Model"))return;
	const model=template.Clone();model.Name=name;model.PivotTo(cf);model.Parent=parent;
}
const PAPER=Color3.fromRGB(226,218,192),INK_BROWN=Color3.fromRGB(46,38,30),STAMP=Color3.fromRGB(172,42,36);
/** The chapter's document on the chart's top face: monospace ink on paper, lit flat so the lamp cannot blow it out. */
function dressChart(chart:Part,id:number): void {
	const lines=documentFor(id);
	if(!lines)return;
	const gui=new Instance("SurfaceGui");gui.Name="Document";gui.Face=Enum.NormalId.Top;gui.SizingMode=Enum.SurfaceGuiSizingMode.FixedSize;gui.CanvasSize=new Vector2(380,520);gui.LightInfluence=0;gui.Brightness=1;
	const paper=new Instance("Frame");paper.Name="Paper";paper.Size=UDim2.fromScale(1,1);paper.BackgroundColor3=PAPER;paper.BorderSizePixel=0;paper.Parent=gui;
	const pad=new Instance("UIPadding");pad.PaddingTop=new UDim(0,34);pad.PaddingLeft=new UDim(0,22);pad.PaddingRight=new UDim(0,22);pad.Parent=paper;
	const list=new Instance("UIListLayout");list.Padding=new UDim(0,10);list.SortOrder=Enum.SortOrder.LayoutOrder;list.Parent=paper;
	lines.forEach((raw,i)=>{
		const line=documentLine(raw);
		const label=new Instance("TextLabel");label.Name=`Line${i+1}`;label.LayoutOrder=i;label.Size=new UDim2(1,0,0,62);label.BackgroundTransparency=1;label.Font=Enum.Font.RobotoMono;label.TextSize=i===0 ? 24 : 22;
		label.TextXAlignment=Enum.TextXAlignment.Left;label.TextColor3=line.stamp ? STAMP : line.struck ? Color3.fromRGB(128,116,98) : INK_BROWN;label.RichText=line.struck;
		label.Text=line.struck ? `<s>${line.text}</s>` : line.text;label.Parent=paper;
		if(line.stamp){const box=new Instance("UIStroke");box.Color=STAMP;box.Thickness=2.5;box.Transparency=.15;box.ApplyStrokeMode=Enum.ApplyStrokeMode.Border;box.Parent=label;label.Rotation=-3;label.BackgroundTransparency=.92;label.BackgroundColor3=STAMP;label.TextXAlignment=Enum.TextXAlignment.Center;}
	});
	// A Top-face GUI reads with "up" along the part's +X; a quarter turn points that at the far edge of the desk (checked in-engine: 0 and pi both read sideways, -pi/2 upside down).
	chart.CFrame=chart.CFrame.mul(CFrame.Angles(0,math.pi/2,0));
	gui.Parent=chart;
}
/** One stage per chapter: the radio desk is always there; the surroundings follow `scene`, props tint to `mood`, and a few props follow the story. */
function sceneFor(chapter:StoryChapter): Stage {
	const {scene:kind,mood,id}=chapter,scene=new Instance("Folder"); scene.Name="BrokenRelayCinematic"; scene.Parent=Workspace;
	const tint=(c:Color3)=>col(sceneTint(rgb(c),mood));
	const sea=kind==="sea";
	if(sea) prop(scene,"Stage",new Vector3(700,4,700),new Vector3(0,-4,0),tint(Color3.fromRGB(16,38,70)),Enum.Material.Glass).Reflectance=.25;
	else prop(scene,"Stage",new Vector3(700,4,700),new Vector3(0,-4,0),tint(Color3.fromRGB(40,57,64)),Enum.Material.Slate);
	prop(scene,"Radio desk",new Vector3(16,2,9),new Vector3(0,4,0),Color3.fromRGB(93,63,47),Enum.Material.Wood);
	// The desk floated five studs off the floor in the low chair shot; four legs reach the stage.
	for(const [dx,dz] of [[-7.4,-4],[7.4,-4],[-7.4,4],[7.4,4]]) prop(scene,"Desk leg",new Vector3(.6,5,.6),new Vector3(dx,.5,dz),Color3.fromRGB(70,48,36),Enum.Material.Wood);
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
	// The flight chart is a sheet of paper; the chapter's document is printed on it for the evidence shot.
	dressChart(prop(scene,"Flight chart",new Vector3(5.2,.15,3.8),vec(CHART),Color3.fromRGB(196,188,160),Enum.Material.SmoothPlastic),id);
	// The coffee tin of tapes, found under Teal's bunk in chapter 1; one cassette leaves it for every chapter he has spoken in since.
	const tapes=tapesInTin(id);
	if(tapes!==undefined) {
		const tin=prop(scene,"Coffee tin",new Vector3(1.7,1.8,1.8),vec(TIN),Color3.fromRGB(118,46,34));tin.Shape=Enum.PartType.Cylinder;tin.CFrame=tin.CFrame.mul(CFrame.Angles(0,0,math.pi/2));
		for(let i=0;i<tapes;i++) prop(scene,"Tape cassette",new Vector3(.2,1,.7),vec(TIN).add(new Vector3(-.42+(i%4)*.28,.55,-.36+math.floor(i/4)*.36)),i%3===0 ? Color3.fromRGB(58,54,50) : Color3.fromRGB(40,38,36),Enum.Material.SmoothPlastic);
	}
	// Teal's handheld recorder: a dented grey box with a grille, a tape window and a red tally lamp that blinks in recorder shots.
	const open=recorderOpen(id),r=vec(RECORDER),tilt=CFrame.Angles(0,-.35,.04);
	const rec=prop(scene,"Recorder",new Vector3(2,1,3),r,Color3.fromRGB(96,99,102),Enum.Material.DiamondPlate);rec.CFrame=rec.CFrame.mul(tilt);
	const detail=(name:string,size:Vector3,offset:Vector3,color:Color3,material:Enum.Material)=>{const p=prop(scene,name,size,Vector3.zero,color,material);p.CFrame=rec.CFrame.mul(new CFrame(offset));return p;};
	detail("Recorder grille",new Vector3(.9,.06,.6),new Vector3(.3,.53,-.9),Color3.fromRGB(40,42,44),Enum.Material.Metal);
	detail("Recorder window",new Vector3(1.2,.06,.7),new Vector3(0,.53,.2),Color3.fromRGB(150,160,150),Enum.Material.Glass).Transparency=.3;
	detail("Recorder key",new Vector3(.22,.16,.22),new Vector3(-.6,.56,-1.1),Color3.fromRGB(200,200,196),Enum.Material.SmoothPlastic);
	detail("Recorder dent",new Vector3(.7,.3,.9),new Vector3(.5,.4,-.8),Color3.fromRGB(70,72,74),Enum.Material.Metal);
	if(open) {
		// Recovered from the seat: a second dent in the side, and the lid up on its hinge.
		detail("Recorder dent",new Vector3(.5,.6,.8),new Vector3(-1,-.1,.4),Color3.fromRGB(64,66,68),Enum.Material.Metal);
		const lid=prop(scene,"Recorder lid",new Vector3(2,.1,1.5),Vector3.zero,Color3.fromRGB(88,91,94),Enum.Material.DiamondPlate);
		lid.CFrame=rec.CFrame.mul(new CFrame(0,.5,-.55)).mul(CFrame.Angles(-1.2,0,0)).mul(new CFrame(0,0,-.75));
	}
	const recorderLight=detail("Recorder light",new Vector3(.3,.2,.3),new Vector3(-.6,.55,1.1),Color3.fromRGB(255,40,40),Enum.Material.Neon);
	// Sera's board by the desk: dark slate on a post, three name strips; Teal's is the bright one, and chapter 9 wipes it for a while.
	const b=vec(BOARD);
	prop(scene,"Board post",new Vector3(.3,8,.3),new Vector3(b.X,2,b.Z),Color3.fromRGB(52,54,58));
	prop(scene,"Sera's board",new Vector3(5,3.2,.25),b,Color3.fromRGB(30,50,46),Enum.Material.Slate);
	for(const [dy,name] of [[.9,"Teal strip smear"],[.2,"Name strip"],[-.5,"Name strip"]] as [number,string][]) prop(scene,name,new Vector3(3.4,.3,.05),b.add(new Vector3(0,dy,-.15)),name==="Name strip" ? Color3.fromRGB(200,196,180) : Color3.fromRGB(44,66,62),Enum.Material.SmoothPlastic);
	const tealStrip=prop(scene,"Teal strip",new Vector3(3.4,.3,.05),b.add(new Vector3(0,.9,-.17)),Color3.fromRGB(76,234,208),Enum.Material.Neon);
	const lighting=moodLighting(mood);
	const lamp=new Instance("PointLight");lamp.Brightness=lighting.lamp;lamp.Range=mood==="night" ? 80 : 60;lamp.Color=Color3.fromRGB(255,218,171);lamp.Parent=radio;
	const models=ReplicatedStorage.FindFirstChild("RelayStoryModels");
	const subject=stageSubject(kind);
	if(subject) cloneModel(models?.FindFirstChild(subject),scene,"Story subject",new CFrame(ORIGIN.add(new Vector3(SUBJECT.x,SUBJECT_Y[subject],SUBJECT.z))));
	const jet=Workspace.FindFirstChild("World")?.FindFirstChild("DisplayJet",true);
	cloneModel(jet,scene,"Kestrel",new CFrame(ORIGIN.add(new Vector3(-40,7,-60))).mul(CFrame.Angles(0,.7,0)));
	// The empty instructor's chair beside the desk, worn leather; the `chair` shot pushes in on it in every scene.
	const leather=Color3.fromRGB(96,60,42),c=vec(CHAIR);
	prop(scene,"Instructor's chair",new Vector3(4,.6,4),c,leather,Enum.Material.Fabric);
	prop(scene,"Instructor's chair",new Vector3(4,4.2,.6),c.add(new Vector3(0,2.4,1.9)),leather,Enum.Material.Fabric);
	for(const [dx,dz] of [[-1.6,-1.6],[1.6,-1.6],[-1.6,1.6],[1.6,1.6]]) prop(scene,"Chair leg",new Vector3(.3,c.Y+2,.3),new Vector3(c.X+dx,(c.Y-2)/2-.3,c.Z+dz),Color3.fromRGB(52,54,58));
	if(kind==="hangar") {
		// A second parked airframe far back and hangar wall slabs close the room in.
		cloneModel(jet,scene,"Parked jet",new CFrame(ORIGIN.add(new Vector3(70,7,-150))).mul(CFrame.Angles(0,2.3,0)));
		const wall=tint(Color3.fromRGB(58,62,68));
		prop(scene,"Hangar wall",new Vector3(520,120,6),new Vector3(0,58,-230),wall,Enum.Material.Concrete);
		for(const x of [-260,260]) prop(scene,"Hangar wall",new Vector3(6,120,460),new Vector3(x,58,0),wall,Enum.Material.Concrete);
		prop(scene,"Hangar beam",new Vector3(520,4,4),new Vector3(0,118,-120),Color3.fromRGB(40,42,46));
		// Two work lights on the beam so the night hangar is a room, not a lamp pool in a void.
		for(const x of [-110,110]) {
			const lampStrip=prop(scene,"Hangar lamp",new Vector3(14,.6,1.2),new Vector3(x,115.6,-120),Color3.fromRGB(255,236,200),Enum.Material.Neon);
			const light=new Instance("PointLight");light.Brightness=1.2;light.Range=170;light.Color=Color3.fromRGB(255,228,190);light.Parent=lampStrip;
		}
	}
	if(sea) prop(scene,"Sea platform",new Vector3(70,12,70),new Vector3(SUBJECT.x,4,SUBJECT.z),tint(Color3.fromRGB(70,76,82)),Enum.Material.Concrete);
	// Mast 2 of the ring stood between the wide camera and the jet, so the ring has five.
	if(kind==="relay") for(let i=0;i<6;i++) {
		if(i===2)continue;
		const ang=i/6*math.pi*2,r=75;
		prop(scene,"Antenna mast",new Vector3(2,40+(i%2)*14,2),new Vector3(SUBJECT.x+math.cos(ang)*r,20+(i%2)*7,SUBJECT.z+math.sin(ang)*r),tint(Color3.fromRGB(150,156,160)));
	}
	if(auroraVisible(kind,mood)) for(const ribbon of AURORA) {
		const p=prop(scene,"Aurora",vec(ribbon.size),vec(ribbon.pos),col(ribbon.color),Enum.Material.Neon);
		p.CFrame=p.CFrame.mul(CFrame.Angles(0,ribbon.yaw,.06));p.Transparency=ribbon.transparency;p.CastShadow=false;
	}
	if(!sea && kind!=="hangar") {
		const burned=kind==="farm" && orchardBurned(id);
		const color=tint(burned ? Color3.fromRGB(30,26,24) : kind==="farm" ? Color3.fromRGB(82,113,63) : kind==="canyon" ? Color3.fromRGB(152,102,67) : kind==="city" ? Color3.fromRGB(44,52,66) : Color3.fromRGB(90,115,129));
		for(let i=0;i<7;i++) {
			const h=kind==="city" ? 110+(i%3)*40 : kind==="canyon" ? 100+(i%3)*28 : 20+(i%3)*8,x=-180+i*60,z=-180-(i%2)*60;
			prop(scene,kind,new Vector3(50,h,65),new Vector3(x,h/2,z),color,burned ? Enum.Material.Slate : kind==="farm" ? Enum.Material.Grass : Enum.Material.Concrete);
			// Charred orchard: a couple of ember flecks per block, no smoke particles (phones).
			if(burned) for(let e=0;e<2;e++) prop(scene,"Ember",new Vector3(1.2,.4,1.2),new Vector3(x-12+e*24,h+.2,z+(e===0 ? 10 : -14)),Color3.fromRGB(255,110,40),Enum.Material.Neon);
			// A few lit window strips so the city reads as inhabited at any mood.
			if(kind==="city") for(let w=0;w<3;w++) prop(scene,"Window strip",new Vector3(30,1.2,.4),new Vector3(x,h*(.35+w*.22),z+32.7),(i+w)%3===0 ? Color3.fromRGB(255,120,200) : Color3.fromRGB(120,230,255),Enum.Material.Neon);
		}
	}
	return {scene,reels,recorderLight,tealStrip};
}
type LightingKeys="ClockTime" | "Brightness" | "Ambient" | "OutdoorAmbient" | "FogColor" | "FogEnd" | "FogStart" | "ExposureCompensation";
const LIGHTING_KEYS:LightingKeys[]=["ClockTime","Brightness","Ambient","OutdoorAmbient","FogColor","FogEnd","FogStart","ExposureCompensation"];
/**
 * Applies the mood to Lighting and returns the restore function. The server
 * rewrites Lighting whenever it rebuilds a world (the finale cinematic starts
 * at the same moment the menu world comes back), so each property is watched:
 * a value we did not set becomes the new restore target and the mood is
 * re-applied. The Fog* properties are inert while an Atmosphere exists, so the
 * world's Atmosphere is thickened locally too, and a local cloud deck gives the
 * storm its grey sky (client changes do not replicate).
 */
function stageLighting(mood:StoryChapter["mood"]): ()=>void {
	type Bag=Record<LightingKeys,unknown>;
	const live=Lighting as unknown as Bag,saved:Partial<Bag>={},mine:Partial<Bag>={};
	const l=moodLighting(mood);
	const wanted:Bag={ClockTime:l.clockTime,Brightness:l.brightness,ExposureCompensation:l.exposure,Ambient:col(l.ambient),OutdoorAmbient:col(l.outdoorAmbient),FogColor:col(l.fogColor),FogStart:l.fogStart,FogEnd:l.fogEnd};
	const apply=(key:LightingKeys)=>{mine[key]=wanted[key];live[key]=wanted[key];};
	const watchers:RBXScriptConnection[]=[];
	for(const key of LIGHTING_KEYS) {
		saved[key]=live[key];apply(key);
		watchers.push(Lighting.GetPropertyChangedSignal(key).Connect(()=>{if(live[key]!==mine[key]){saved[key]=live[key];apply(key);}}));
	}
	const atmosphere=Lighting.FindFirstChildOfClass("Atmosphere");
	const atmo=atmosphere ? {density:atmosphere.Density,haze:atmosphere.Haze,color:atmosphere.Color} : undefined;
	if(atmosphere){atmosphere.Density=l.density;atmosphere.Haze=l.haze;atmosphere.Color=col(l.fogColor);}
	const existing=Workspace.Terrain.FindFirstChildOfClass("Clouds"),clouds=existing ?? new Instance("Clouds");
	const cloudsBefore={cover:clouds.Cover,density:clouds.Density,color:clouds.Color,enabled:clouds.Enabled};
	// A night deck hid the stars and the aurora entirely, so night runs with the layer off.
	// Phones keep the project's cloud budget (MobileGraphics only trims decks added later).
	const touch=UserInputService.TouchEnabled;
	clouds.Cover=touch ? math.min(l.clouds.cover,.3) : l.clouds.cover;clouds.Density=touch ? math.min(l.clouds.density,.3) : l.clouds.density;clouds.Color=col(l.clouds.color);clouds.Enabled=l.clouds.cover>0;
	if(!existing)clouds.Parent=Workspace.Terrain;
	return ()=>{
		for(const w of watchers)w.Disconnect();
		for(const key of LIGHTING_KEYS)live[key]=saved[key];
		if(atmosphere && atmo && atmosphere.Parent){atmosphere.Density=atmo.density;atmosphere.Haze=atmo.haze;atmosphere.Color=atmo.color;}
		if(existing){clouds.Cover=cloudsBefore.cover;clouds.Density=cloudsBefore.density;clouds.Color=cloudsBefore.color;clouds.Enabled=cloudsBefore.enabled;}
		else clouds.Destroy();
	};
}
const INK=Color3.fromRGB(4,9,14),IVORY=Color3.fromRGB(242,238,226),MUTED=Color3.fromRGB(152,168,176),FAINT=Color3.fromRGB(104,122,132);
const ACCENT=Color3.fromRGB(64,224,206),ORANGE=Color3.fromRGB(255,150,84),DANGER=Color3.fromRGB(255,84,76),AMBER=Color3.fromRGB(242,196,78);
const TONE_COLOR:Record<SpeakerTone,Color3>={teal:ACCENT,control:ORANGE,log:MUTED,marshal:DANGER,trainee:IVORY,wing:AMBER};
const bodyFont=(beat:StoryBeat)=>speakerStyle(beat.speaker).tone==="log" ? Enum.Font.RobotoMono : Enum.Font.GothamMedium;
/** Accessibility choices persist for the rest of the session; camera motion is shared with flight (MotionPreference). */
const prefs={large:false};
const TEXT_FADE_IN=.25,TEXT_FADE_OUT=.2,CUT_DIP=.3,CUT_BLACK=.85,ENTER_FADE=.5,EXIT_FADE=.5,SCROLL_GUTTER=6;
type HintMode="touch" | "keyboard" | "gamepad";
function hintModeFor(input:Enum.UserInputType): HintMode {
	if(input===Enum.UserInputType.Touch)return "touch";
	return input.Name.sub(1,7)==="Gamepad" ? "gamepad" : "keyboard";
}
const HINT:Record<HintMode,string>={touch:"TAP FOR NEXT",keyboard:"CLICK FOR NEXT",gamepad:"R1 NEXT"};
const graphemes=(text:string)=>{const [count]=utf8.len(text);return typeIs(count,"number") ? count : text.size();};

export function RelayCinematic({id,viewport,onFinish,onCancel}:{id:number;viewport:Vector2;onFinish:()=>void;onCancel:()=>void}) {
	const chapter=storyFor(id);
	const [beat,setBeat]=useState(0),[paused,setPaused]=useState(false),[still,setStill]=useState(MotionPreference.reduced),[large,setLarge]=useState(prefs.large);
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
	for(const b of chapter.beats)if(!isCard(b.shot))tallest=math.max(tallest,measure(b));
	if(tallest===0)tallest=textHeight;
	// Every rectangle comes from the pure layout: no top bar, one caption panel at the bottom with the controls on the speaker row.
	const frame=getCinematicFrame(layout,viewport.X,viewport.Y,tallest),band=frame.band;
	const overflow=textHeight>frame.text.height;
	// The safe root starts below the Roblox top bar; cards and fades reach up through that inset so no sky shows above a black card.
	const inset=math.max(0,GuiService.GetGuiInset()[0].Y);
	const subtitleRef=useRef<ScrollingFrame>(),bodyRef=useRef<TextLabel>(),nameRef=useRef<TextLabel>(),roleRef=useRef<TextLabel>();
	const progressRef=useRef<Frame>(),fadeRef=useRef<Frame>(),cardBodyRef=useRef<TextLabel>(),cardNameRef=useRef<TextLabel>();
	useEffect(()=>{if(subtitleRef.current)subtitleRef.current.CanvasPosition=Vector2.zero;},[beat]);
	const pausedRef=useRef(false),stillRef=useRef(MotionPreference.reduced),finishRef=useRef(onFinish),cancelRef=useRef(onCancel),done=useRef(false);
	// Longer lines stay on screen longer: 5-9 s per beat, scaled by text length.
	const durations=chapter.beats.map((b)=>beatDuration(b.text));
	// endRef is when the current beat hands over; a manual "next" pulls it in to
	// start the outro (text fade + dip to black) instead of hard-cutting.
	const indexRef=useRef(0),beatTimeRef=useRef(0),endRef=useRef(durations[0]);
	finishRef.current=onFinish;cancelRef.current=onCancel;
	const finish=()=>{if(done.current)return;done.current=true;finishRef.current();};
	const setTextAlpha=(alpha:number)=>{for(const label of [bodyRef.current,nameRef.current,roleRef.current,cardBodyRef.current,cardNameRef.current])if(label)label.TextTransparency=alpha;};
	const setVisible=(count:number)=>{for(const label of [bodyRef.current,cardBodyRef.current])if(label)label.MaxVisibleGraphemes=count;};
	const goTo=(index:number)=>{
		// Hide the outgoing line before React swaps text so it can fade or type in cleanly.
		if(!stillRef.current){setTextAlpha(1);setVisible(0);}
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
		else if(action==="motion"){stillRef.current=!stillRef.current;MotionPreference.reduced=stillRef.current;setStill(stillRef.current);}
		else if(action==="text"){prefs.large=!prefs.large;setLarge(prefs.large);}
	};
	useEffect(()=>{
		// Timeline and overlay run even without a camera so the fade can never stick on black.
		const camera=Workspace.CurrentCamera;
		const oldType=camera?.CameraType,oldFov=camera?.FieldOfView,oldFrame=camera?.CFrame;
		const stage=sceneFor(chapter),restoreLighting=stageLighting(chapter.mood);let clock=0,reelAngle=0;
		const last=chapter.beats.size()-1,steadyLamp=recorderOpen(id);
		const lengths=chapter.beats.map((b)=>graphemes(b.text));
		const move=RunService.RenderStepped.Connect((dt)=>{
			if(done.current)return;
			const step=math.min(dt,.1);
			clock+=step;if(!pausedRef.current)beatTimeRef.current+=step;
			if(beatTimeRef.current>=endRef.current){advance();if(done.current)return;}
			const index=indexRef.current,t=beatTimeRef.current,duration=durations[index],calm=stillRef.current;
			const left=endRef.current-t;
			const {shot,speaker:who}=chapter.beats[index],toneNow=speakerStyle(who).tone;
			// Text: tapes, the log and title cards type out over the first 40 % of the beat; everyone else fades in. All fade out over the outro unless reduced motion asks for instant swaps.
			const typed=isTyped(toneNow,shot);
			const fadeOut=index===last ? 1 : math.clamp(left/TEXT_FADE_OUT,0,1);
			setTextAlpha(calm ? 0 : 1-math.min(typed ? 1 : math.clamp(t/TEXT_FADE_IN,0,1),fadeOut));
			setVisible(typed ? typedGraphemes(t,duration,lengths[index],calm) : -1);
			if(progressRef.current)progressRef.current.Size=new UDim2(math.clamp(t/duration,0,1),0,1,0);
			// Black overlay: fade up from black, dip on camera cuts, fade out at the natural end.
			const enter=1-math.clamp(clock/ENTER_FADE,0,1);
			// Cut dip: darken over the outgoing beat's last CUT_DIP, then lift on the incoming shot.
			const dipOut=calm || index===last ? 0 : (1-math.clamp(left/CUT_DIP,0,1))*CUT_BLACK;
			const dipIn=calm || index===0 ? 0 : (1-math.clamp(t/CUT_DIP,0,1))*CUT_BLACK;
			const exitSpan=endRef.current<duration ? CUT_DIP : EXIT_FADE;
			const exit=index===last ? 1-math.clamp(left/exitSpan,0,1) : 0;
			if(fadeRef.current)fadeRef.current.BackgroundTransparency=1-math.max(enter,dipOut,dipIn,exit);
			// Stage life: reels turn while a tape or the log speaks; the recorder lamp blinks in its close-up; Sera's board follows chapter 9.
			if(!pausedRef.current && reelsSpin(toneNow))reelAngle+=step*2.4;
			for(const {part,base} of stage.reels)part.CFrame=base.mul(CFrame.Angles(reelAngle,0,0));
			stage.recorderLight.Transparency=recorderLightOn(shot,clock,steadyLamp) ? 0 : shot==="recorder" ? .85 : .55;
			stage.tealStrip.Transparency=boardShowsTeal(id,index,last) ? 0 : 1;
			// Camera framing follows the beat's shot; camera motion OFF holds each shot's mid pose.
			const alpha=calm ? .5 : math.clamp(t/duration,0,1);
			const size=viewportRef.current,pose=shotPose(shot,chapter.scene,alpha,size.Y<240,size.Y>size.X);
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
	const {tiny,controlSize,chipTextSize,pillHeight}=layout;
	// Children of the caption panel are placed relative to its top-left corner.
	const at=(r:Rect,origin:Rect=band)=>({Position:UDim2.fromOffset(r.x-origin.x,r.y-origin.y),Size:UDim2.fromOffset(r.width,r.height)});
	// Each control keeps its 44 px hit box; a thin outlined pill sits inside it.
	const control=(name:string,rect:Rect,control:CinematicControl | undefined,highlight:boolean,content:React.Element,onClick?:()=>void)=>
		<textbutton key={name} Position={at(rect).Position} Size={at(rect).Size} BackgroundTransparency={1} Text="" AutoButtonColor={false}
			Event={{Activated:onClick ?? (control ? activate(control) : undefined)}}>
			<frame key="Pill" AnchorPoint={new Vector2(.5,.5)} Position={UDim2.fromScale(.5,.5)} Size={new UDim2(1,-6,0,pillHeight)} BackgroundColor3={highlight ? ACCENT : INK} BackgroundTransparency={highlight ? .82 : .6} BorderSizePixel={0}>
				<uicorner CornerRadius={new UDim(1,0)}/>
				<uistroke Color={highlight ? ACCENT : IVORY} Transparency={highlight ? .3 : .72} Thickness={1}/>
				{content}
			</frame>
		</textbutton>;
	// Stepped play triangle (1 px columns narrowing to the tip): no glyph or image asset to go missing.
	const triangle=(key:string,height:number,color:Color3,order=0)=>{
		const width=math.round(height*.85),columns:React.Element[]=[];
		for(let i=0;i<width;i++){const h=math.max(1,math.round(height*(1-i/width)));columns.push(<frame key={`C${i}`} Position={UDim2.fromOffset(i,math.floor((height-h)/2))} Size={UDim2.fromOffset(1,h)} BackgroundColor3={color} BorderSizePixel={0}/>);}
		return <frame key={key} LayoutOrder={order} AnchorPoint={new Vector2(.5,.5)} Position={UDim2.fromScale(.5,.5)} Size={UDim2.fromOffset(width,height)} BackgroundTransparency={1}>{columns}</frame>;
	};
	const iconColor=paused ? ACCENT : IVORY;
	const pauseIcon=paused ? triangle("Play",12,iconColor) : <frame key="Pause" AnchorPoint={new Vector2(.5,.5)} Position={UDim2.fromScale(.5,.5)} Size={UDim2.fromOffset(9,12)} BackgroundTransparency={1}>
		<frame key="L" Size={UDim2.fromOffset(3,12)} BackgroundColor3={iconColor} BorderSizePixel={0}/>
		<frame key="R" Position={UDim2.fromOffset(6,0)} Size={UDim2.fromOffset(3,12)} BackgroundColor3={iconColor} BorderSizePixel={0}/>
	</frame>;
	const skipContent=<frame key="Skip" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1}>
		<uilistlayout FillDirection={Enum.FillDirection.Horizontal} HorizontalAlignment={Enum.HorizontalAlignment.Center} VerticalAlignment={Enum.VerticalAlignment.Center} Padding={new UDim(0,6)} SortOrder={Enum.SortOrder.LayoutOrder}/>
		<textlabel key="Label" LayoutOrder={1} AutomaticSize={Enum.AutomaticSize.X} Size={new UDim2(0,0,1,0)} BackgroundTransparency={1} Text="SKIP" TextSize={tiny ? 11 : 12} Font={Enum.Font.GothamBold} TextColor3={IVORY}/>
		<frame key="Icon" LayoutOrder={2} Size={UDim2.fromOffset(15,9)} BackgroundTransparency={1}>
			<frame key="A" Size={UDim2.fromOffset(8,9)} BackgroundTransparency={1}>{triangle("T",9,IVORY)}</frame>
			<frame key="B" Position={UDim2.fromOffset(7,0)} Size={UDim2.fromOffset(8,9)} BackgroundTransparency={1}>{triangle("T",9,IVORY)}</frame>
		</frame>
	</frame>;
	const panel=frame.settingsPanel,horizontal=frame.horizontalSettings;
	const toggle=(name:string,label:string,value:string,order:number,control:CinematicControl)=>
		<textbutton key={name} LayoutOrder={order} Size={horizontal ? new UDim2(.5,-2,0,controlSize) : new UDim2(1,0,0,controlSize)} BackgroundColor3={Color3.fromRGB(16,30,40)} BackgroundTransparency={.1} BorderSizePixel={0} Text="" AutoButtonColor={true} Event={{Activated:activate(control)}}>
			<uicorner CornerRadius={new UDim(0,8)}/>
			<textlabel key="Label" Position={UDim2.fromOffset(12,0)} Size={new UDim2(1,-60,1,0)} BackgroundTransparency={1} Text={label} TextXAlignment={Enum.TextXAlignment.Left} TextTruncate={Enum.TextTruncate.AtEnd} TextSize={tiny ? 12 : 13} Font={Enum.Font.GothamMedium} TextColor3={IVORY}/>
			<textlabel key="Value" AnchorPoint={new Vector2(1,0)} Position={new UDim2(1,-12,0,0)} Size={new UDim2(0,40,1,0)} BackgroundTransparency={1} Text={value} TextXAlignment={Enum.TextXAlignment.Right} TextSize={tiny ? 12 : 13} Font={Enum.Font.GothamBold} TextColor3={ACCENT}/>
		</textbutton>;
	// Lines mount hidden and RenderStepped fades or types them in (instant with reduced motion).
	const hidden=still ? 0 : 1,typedLine=isTyped(speaker.tone,current.shot),startVisible=still || !typedLine ? -1 : 0;
	// Speaker: tone swatch, name, then the role truncated to whatever the controls leave.
	const nameFont=speaker.tone==="log" ? Enum.Font.RobotoMono : Enum.Font.GothamBlack;
	const nameWidth=math.ceil(TextService.GetTextSize(speaker.name,chipTextSize,nameFont,new Vector2(1000,100)).X)+2;
	const roleX=3+8+nameWidth+8,roleWidth=math.max(0,frame.speaker.width-roleX);
	// One progress segment per beat: done ones solid, the current one fills over its beat.
	const segments=progressSegments(frame.progress.width,chapter.beats.size()).map((s,i)=>
		<frame key={`Segment${i}`} Position={UDim2.fromOffset(s.x,0)} Size={new UDim2(0,s.width,1,0)} BackgroundColor3={i<beat ? tone : IVORY} BackgroundTransparency={i<beat ? .25 : .82} BorderSizePixel={0}>
			<uicorner CornerRadius={new UDim(1,0)}/>
			{i===beat && <frame ref={progressRef} key="Fill" Size={UDim2.fromScale(0,1)} BackgroundColor3={tone} BackgroundTransparency={.1} BorderSizePixel={0}><uicorner CornerRadius={new UDim(1,0)}/></frame>}
		</frame>);
	const cardFont=speaker.tone==="log" ? Enum.Font.RobotoMono : Enum.Font.GothamMedium;
	// Gradient behind the panel: clear at the feather, ~45 % ink at the speaker row, ~70 % behind the line.
	const backdrop=frame.backdrop,fade=(y:number)=>math.clamp((y-backdrop.y)/math.max(1,backdrop.height),.01,.98);
	const rowKey=fade(band.y),textKey=math.max(rowKey+.01,fade(frame.text.y));
	// Layering: scene tap target 1, panel gradient 2, title card 3, caption panel and pause chip 4, settings 5, fade 6.
	// The panel sits above black cards so skip/pause/Aa stay reachable; the card shows its own speaker and line.
	return <frame key="CinematicScreen" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1}>
		{/* Tap or click anywhere on the scene for the next line. */}
		<textbutton key="CinematicAdvanceButton" ZIndex={1} Size={UDim2.fromScale(1,1)} BackgroundTransparency={1} Text="" AutoButtonColor={false} Selectable={false} Event={{Activated:activate("next")}}/>
		{settingsOpen && <frame key="CinematicSettings" ZIndex={5} Position={UDim2.fromOffset(panel.x,panel.y)} Size={UDim2.fromOffset(panel.width,panel.height)} BackgroundColor3={INK} BackgroundTransparency={.15} BorderSizePixel={0}>
			<uicorner CornerRadius={new UDim(0,10)}/>
			<uistroke Color={IVORY} Transparency={.85} Thickness={1}/>
			<uipadding PaddingTop={new UDim(0,4)} PaddingBottom={new UDim(0,4)} PaddingLeft={new UDim(0,4)} PaddingRight={new UDim(0,4)}/>
			<uilistlayout FillDirection={horizontal ? Enum.FillDirection.Horizontal : Enum.FillDirection.Vertical} Padding={new UDim(0,4)} SortOrder={Enum.SortOrder.LayoutOrder}/>
			{toggle("CinematicMotionButton",horizontal ? "Motion" : "Camera motion",still ? "OFF" : "ON",1,"motion")}
			{toggle("CinematicTextButton","Large text",large ? "ON" : "OFF",2,"text")}
		</frame>}
		{paused && <frame key="CinematicPaused" ZIndex={4} Position={UDim2.fromOffset(frame.pausedChip.x,frame.pausedChip.y)} Size={UDim2.fromOffset(frame.pausedChip.width,frame.pausedChip.height)} BackgroundColor3={INK} BackgroundTransparency={.35} BorderSizePixel={0}>
			<uicorner CornerRadius={new UDim(1,0)}/>
			<uistroke Color={IVORY} Transparency={.8} Thickness={1}/>
			<textlabel key="Label" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1} Text="PAUSED" TextSize={tiny ? 11 : 13} Font={Enum.Font.GothamBold} TextColor3={IVORY}/>
		</frame>}
		{/* Soft gradient only where the caption needs contrast; the scene keeps the rest of the screen. */}
		<frame key="CinematicBackdrop" ZIndex={2} AnchorPoint={new Vector2(0,1)} Position={UDim2.fromScale(0,1)} Size={new UDim2(1,0,0,backdrop.height)} BackgroundColor3={INK} BorderSizePixel={0}>
			<uigradient Rotation={90} Transparency={new NumberSequence([new NumberSequenceKeypoint(0,1),new NumberSequenceKeypoint(rowKey,.55),new NumberSequenceKeypoint(textKey,.32),new NumberSequenceKeypoint(1,.22)])}/>
		</frame>
		<frame key="CinematicDialogue" ZIndex={4} AnchorPoint={new Vector2(0,1)} Position={UDim2.fromScale(0,1)} Size={new UDim2(1,0,0,band.height)} BackgroundTransparency={1}>
			<frame key="CinematicSpeaker" Visible={!card} Position={at(frame.speaker).Position} Size={at(frame.speaker).Size} BackgroundTransparency={1}>
				<frame key="Swatch" AnchorPoint={new Vector2(0,.5)} Position={UDim2.fromScale(0,.5)} Size={UDim2.fromOffset(3,chipTextSize+4)} BackgroundColor3={tone} BorderSizePixel={0}/>
				<textlabel ref={nameRef} key="SpeakerName" TextTransparency={hidden} Position={UDim2.fromOffset(11,0)} Size={new UDim2(0,nameWidth,1,0)} BackgroundTransparency={1} Text={speaker.name} TextXAlignment={Enum.TextXAlignment.Left} TextSize={chipTextSize} Font={nameFont} TextColor3={tone}/>
				{speaker.role !== undefined && <textlabel ref={roleRef} key="SpeakerRole" TextTransparency={hidden} Position={UDim2.fromOffset(roleX,0)} Size={new UDim2(0,roleWidth,1,0)} BackgroundTransparency={1} Text={speaker.role} TextXAlignment={Enum.TextXAlignment.Left} TextSize={chipTextSize-1} Font={Enum.Font.GothamMedium} TextColor3={MUTED} TextTruncate={Enum.TextTruncate.AtEnd}/>}
			</frame>
			{frame.hint && <textlabel key="Hint" Position={at(frame.hint).Position} Size={at(frame.hint).Size} BackgroundTransparency={1} Text={HINT[hintMode]} TextXAlignment={Enum.TextXAlignment.Right} TextSize={chipTextSize-2} Font={Enum.Font.GothamMedium} TextColor3={FAINT}/>}
			{control("CinematicSettingsButton",frame.settingsButton,undefined,settingsOpen,<textlabel key="Label" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1} Text="Aa" TextSize={tiny ? 12 : 13} Font={Enum.Font.GothamBold} TextColor3={settingsOpen ? ACCENT : IVORY}/>,()=>setSettingsOpen((open)=>!open))}
			{control("CinematicPauseButton",frame.pauseButton,"pause",paused,pauseIcon)}
			{control("CinematicSkipButton",frame.skipButton,"skip",false,skipContent)}
			<scrollingframe ref={subtitleRef} key="CinematicSubtitles" Visible={!card} Position={at(frame.text).Position} Size={at(frame.text).Size} BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={UDim2.fromOffset(0,textHeight)} ScrollBarThickness={overflow ? 3 : 0} ScrollingEnabled={overflow} ScrollingDirection={Enum.ScrollingDirection.Y} Selectable={overflow} Active={overflow}>
				<textlabel ref={bodyRef} key="CinematicLine" TextTransparency={hidden} MaxVisibleGraphemes={startVisible} Size={new UDim2(0,wrapWidth,0,textHeight)} BackgroundTransparency={1} Text={current.text} TextWrapped={true} TextSize={layout.bodySize} TextXAlignment={Enum.TextXAlignment.Left} TextYAlignment={Enum.TextYAlignment.Top} TextColor3={speaker.tone==="log" ? Color3.fromRGB(214,222,214) : IVORY} Font={bodyFont(current)}/>
			</scrollingframe>
			<frame key="CinematicBeatTimer" Position={at(frame.progress).Position} Size={at(frame.progress).Size} BackgroundTransparency={1}>{segments}</frame>
		</frame>
		{/* Title card: the `black` shot keeps the screen black (top inset included) and centres the line in large ivory above the caption panel, chip small above it. */}
		{card && <frame key="CinematicCard" ZIndex={3} Position={UDim2.fromOffset(0,-inset)} Size={new UDim2(1,0,1,inset)} BackgroundColor3={Color3.fromRGB(0,0,0)} BorderSizePixel={0}>
			{/* The coup's voice: a faint red vignette closing in from every edge. */}
			{cardVignette(speaker.tone) && <frame key="Vignette" Size={UDim2.fromScale(1,1)} BackgroundColor3={DANGER} BorderSizePixel={0}>
				<uigradient Rotation={90} Transparency={new NumberSequence([new NumberSequenceKeypoint(0,.72),new NumberSequenceKeypoint(.3,1),new NumberSequenceKeypoint(.7,1),new NumberSequenceKeypoint(1,.72)])}/>
			</frame>}
			{cardVignette(speaker.tone) && <frame key="VignetteSides" Size={UDim2.fromScale(1,1)} BackgroundColor3={DANGER} BorderSizePixel={0}>
				<uigradient Rotation={0} Transparency={new NumberSequence([new NumberSequenceKeypoint(0,.78),new NumberSequenceKeypoint(.25,1),new NumberSequenceKeypoint(.75,1),new NumberSequenceKeypoint(1,.78)])}/>
			</frame>}
			<frame key="Column" AnchorPoint={new Vector2(.5,.5)} Position={new UDim2(.5,0,.5,(inset-band.height)/2)} Size={new UDim2(0,layout.textWidth,0,0)} AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1}>
				<uilistlayout HorizontalAlignment={Enum.HorizontalAlignment.Center} Padding={new UDim(0,tiny ? 6 : 14)} SortOrder={Enum.SortOrder.LayoutOrder}/>
				<textlabel ref={cardNameRef} key="CardSpeaker" TextTransparency={hidden} LayoutOrder={1} Size={new UDim2(1,0,0,chipTextSize+10)} BackgroundTransparency={1} Text={speaker.role !== undefined ? `${speaker.name}  ·  ${speaker.role}` : speaker.name} TextSize={chipTextSize} Font={nameFont} TextColor3={tone}/>
				<textlabel ref={cardBodyRef} key="CardLine" TextTransparency={hidden} MaxVisibleGraphemes={startVisible} LayoutOrder={2} Size={new UDim2(1,0,0,0)} AutomaticSize={Enum.AutomaticSize.Y} BackgroundTransparency={1} Text={current.text} TextWrapped={true} TextSize={math.floor(layout.bodySize*(tiny ? 1.2 : 1.5))} TextXAlignment={Enum.TextXAlignment.Center} TextColor3={IVORY} Font={cardFont} LineHeight={1.15}/>
			</frame>
		</frame>}
		<frame ref={fadeRef} key="CinematicFade" ZIndex={6} Position={UDim2.fromOffset(0,-inset)} Size={new UDim2(1,0,1,inset)} BackgroundColor3={Color3.fromRGB(0,0,0)} BackgroundTransparency={0} BorderSizePixel={0}/>
	</frame>;
}
