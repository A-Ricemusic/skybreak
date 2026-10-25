import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, ReplicatedStorage, RunService, TextService, UserInputService, Workspace } from "@rbxts/services";
import { CinematicAction, CinematicControl, routeCinematicInput } from "../shared/CinematicInput";
import { getCinematicLayout } from "../shared/CinematicLayout";
import { storyFor } from "../shared/RelayStory";

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
export function RelayCinematic({id,viewport,onFinish,onCancel}:{id:number;viewport:Vector2;onFinish:()=>void;onCancel:()=>void}) {
	const {compact,titleHeight,panelHeight,subtitleY,subtitleHeight}=getCinematicLayout(viewport.Y);
	const viewportRef=useRef(viewport);viewportRef.current=viewport;
	const subtitleRef=useRef<ScrollingFrame>();
	const chapter=storyFor(id),[beat,setBeat]=useState(0),[paused,setPaused]=useState(false),[still,setStill]=useState(false),[large,setLarge]=useState(false);
	const subtitleSize=compact ? large ? 18 : 14 : large ? 28 : 22;
	// AutomaticSize underreports wrapped text after accessibility-size changes
	// in Studio (TextFits=false). Measure the actual font and give the scroller
	// an explicit canvas so the complete sentence stays reachable.
	const textHeight=TextService.GetTextSize(chapter.beats[beat].text,subtitleSize,Enum.Font.GothamMedium,new Vector2(math.max(1,viewport.X*.95-29),10000)).Y+4;
	useEffect(()=>{if(subtitleRef.current)subtitleRef.current.CanvasPosition=Vector2.zero;},[beat]);
	const pausedRef=useRef(false),stillRef=useRef(false),finishRef=useRef(onFinish),cancelRef=useRef(onCancel),done=useRef(false);
	finishRef.current=onFinish;cancelRef.current=onCancel;
	const finish=()=>{if(done.current)return;done.current=true;finishRef.current();};
	const dispatch=(action:CinematicAction | undefined)=>{
		if(done.current)return;
		if(action==="skip")finish();
		else if(action==="cancel"){done.current=true;cancelRef.current();}
		else if(action==="pause"){pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);}
		else if(action==="motion"){stillRef.current=!stillRef.current;setStill(stillRef.current);}
		else if(action==="text")setLarge((value)=>!value);
	};
	useEffect(()=>{
		const camera=Workspace.CurrentCamera;if(!camera)return;
		const oldType=camera.CameraType,oldFov=camera.FieldOfView,oldFrame=camera.CFrame;
		const scene=sceneFor(id);let elapsed=0,lastBeat=-1;
		// Longer lines stay on screen longer: 5-9 s per beat, scaled by text length.
		const durations=chapter.beats.map((b)=>beatDuration(b.text));
		const total=durations[0]+durations[1]+durations[2];
		const move=RunService.RenderStepped.Connect((dt)=>{
			if(!pausedRef.current)elapsed+=math.min(dt,.1);
			let index=0,start=0;
			while(index<2 && elapsed>=start+durations[index]){start+=durations[index];index++;}
			if(index!==lastBeat){lastBeat=index;setBeat(index);}
			const alpha=stillRef.current ? .5 : math.clamp((elapsed-start)/durations[index],0,1);
			const short=viewportRef.current.Y<240;
			const vehicle=chapter.scene==="farm" || chapter.scene==="harbor";
			const eye=index===0 ? short ? new Vector3(-8+alpha*2,12,-27) : new Vector3(-10+alpha*4,12,-19)
				: index===1 ? short ? vehicle ? new Vector3(230-alpha*4,80,150) : new Vector3(430-alpha*8,300,380)
				: new Vector3(220-alpha*12,160,150-alpha*10) : short ? new Vector3(21-alpha*2,20,-40) : new Vector3(21-alpha*5,20,-25);
			const focus=index===0 ? new Vector3(0,short ? 5 : 7,0) : index===1 ? short && vehicle ? new Vector3(45,-6,-65) : new Vector3(20,short ? -5 : 0,-85) : new Vector3(4,short ? 4 : 6,-2);
			camera.CameraType=Enum.CameraType.Scriptable;camera.FieldOfView=55;camera.CFrame=CFrame.lookAt(ORIGIN.add(eye),ORIGIN.add(focus));
			if(elapsed>=total)finish();
		});
		const input=UserInputService.InputBegan.Connect((key,processed)=>{
			dispatch(routeCinematicInput({kind:"shortcut",key:key.KeyCode.Name,
				processed:processed || GuiService.MenuIsOpen,guiSelected:GuiService.SelectedObject!==undefined}));
		});
		return ()=>{move.Disconnect();input.Disconnect();scene.Destroy();camera.CameraType=oldType;camera.FieldOfView=oldFov;camera.CFrame=oldFrame;const selected=GuiService.SelectedObject;if(selected?.IsDescendantOf(scene))GuiService.SelectedObject=undefined;};
	},[id]);
	const button=(name:string,text:string,x:number,control:CinematicControl)=><textbutton key={name} Position={new UDim2(x,0,0,0)} Size={new UDim2(.245,0,1,0)} BackgroundColor3={Color3.fromRGB(18,43,52)} BorderSizePixel={0} Text={text} TextScaled={true} Font={Enum.Font.GothamBold} TextColor3={Color3.fromRGB(230,240,232)} Event={{Activated:()=>dispatch(routeCinematicInput({kind:"activated",control}))}}><uitextsizeconstraint MaxTextSize={13} MinTextSize={9}/></textbutton>;
	return <frame key="CinematicScreen" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1}>
		<textlabel key="CinematicTitle" Position={new UDim2(0,0,0,0)} Size={new UDim2(1,0,0,titleHeight)} BackgroundColor3={Color3.fromRGB(3,12,18)} BackgroundTransparency={.1} Text={`BROKEN RELAY  /  ${chapter.title}`} TextColor3={Color3.fromRGB(93,239,215)} TextScaled={true} Font={Enum.Font.GothamBold}><uitextsizeconstraint MaxTextSize={compact ? 12 : 15} MinTextSize={10}/></textlabel>
		<frame key="CinematicPanel" Position={new UDim2(.025,0,1,-panelHeight-6)} Size={new UDim2(.95,0,0,panelHeight)} BackgroundColor3={Color3.fromRGB(3,12,18)} BackgroundTransparency={.08} BorderSizePixel={0}>
			<textlabel Position={UDim2.fromOffset(12,5)} Size={new UDim2(1,-24,0,compact ? 16 : 21)} BackgroundTransparency={1} Text={`${chapter.beats[beat].speaker}   ${beat+1}/3`} TextXAlignment={Enum.TextXAlignment.Left} TextColor3={Color3.fromRGB(93,239,215)} TextSize={compact ? 10 : 12} Font={Enum.Font.GothamBold}/>
			<scrollingframe ref={subtitleRef} key="CinematicSubtitles" Position={UDim2.fromOffset(12,subtitleY)} Size={new UDim2(1,-24,0,subtitleHeight)} BackgroundTransparency={1} BorderSizePixel={0} CanvasSize={UDim2.fromOffset(0,textHeight)} ScrollBarThickness={3} ScrollingDirection={Enum.ScrollingDirection.Y} Selectable={true}>
				<textlabel key={`Beat${beat}`} Size={new UDim2(1,-5,0,textHeight)} BackgroundTransparency={1} Text={chapter.beats[beat].text} TextWrapped={true} TextSize={subtitleSize} TextYAlignment={Enum.TextYAlignment.Top} TextColor3={Color3.fromRGB(247,244,231)} Font={Enum.Font.GothamMedium}/>
			</scrollingframe>
			<frame key="CinematicActions" Position={new UDim2(.02,0,1,-47)} Size={new UDim2(.96,0,0,44)} BackgroundTransparency={1}>
				{button("CinematicSkipButton","SKIP · A",0,"skip")}
				{button("CinematicPauseButton",paused ? "RESUME · X" : "PAUSE · X",.25,"pause")}
				{button("CinematicMotionButton",still ? "MOTION OFF" : "MOTION ON",.5,"motion")}
				{button("CinematicTextButton",large ? "TEXT: LARGE" : "TEXT SIZE",.75,"text")}
			</frame>
		</frame>
	</frame>;
}
