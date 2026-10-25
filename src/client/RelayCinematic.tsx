import React, { useEffect, useRef, useState } from "@rbxts/react";
import { GuiService, ReplicatedStorage, RunService, UserInputService, Workspace } from "@rbxts/services";
import { CinematicAction, CinematicControl, routeCinematicInput } from "../shared/CinematicInput";
import { storyFor } from "../shared/RelayStory";

const ORIGIN=new Vector3(0,6000,0);
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
export function RelayCinematic({id,onFinish,onCancel}:{id:number;onFinish:()=>void;onCancel:()=>void}) {
	const chapter=storyFor(id),[beat,setBeat]=useState(0),[paused,setPaused]=useState(false),[still,setStill]=useState(false),[large,setLarge]=useState(false);
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
		const move=RunService.RenderStepped.Connect((dt)=>{
			if(!pausedRef.current)elapsed+=math.min(dt,.1);
			const index=math.min(2,math.floor(elapsed/7));
			if(index!==lastBeat){lastBeat=index;setBeat(index);}
			const alpha=stillRef.current ? .5 : (elapsed%7)/7;
			const eye=index===0 ? new Vector3(-10+alpha*4,12,-19) : index===1 ? new Vector3(110-alpha*30,85,-5-alpha*12) : new Vector3(21-alpha*5,20,-25);
			const focus=index===0 ? new Vector3(0,7,0) : index===1 ? new Vector3(0,25,-80) : new Vector3(4,6,-2);
			camera.CameraType=Enum.CameraType.Scriptable;camera.FieldOfView=55;camera.CFrame=CFrame.lookAt(ORIGIN.add(eye),ORIGIN.add(focus));
			if(elapsed>=21)finish();
		});
		const input=UserInputService.InputBegan.Connect((key,processed)=>{
			dispatch(routeCinematicInput({kind:"shortcut",key:key.KeyCode.Name,
				processed:processed || GuiService.MenuIsOpen,guiSelected:GuiService.SelectedObject!==undefined}));
		});
		return ()=>{move.Disconnect();input.Disconnect();scene.Destroy();camera.CameraType=oldType;camera.FieldOfView=oldFov;camera.CFrame=oldFrame;const selected=GuiService.SelectedObject;if(selected?.IsDescendantOf(scene))GuiService.SelectedObject=undefined;};
	},[id]);
	const button=(name:string,text:string,x:number,control:CinematicControl)=><textbutton key={name} Position={new UDim2(x,0,0,0)} Size={new UDim2(.245,0,1,0)} BackgroundColor3={Color3.fromRGB(18,43,52)} BorderSizePixel={0} Text={text} TextScaled={true} Font={Enum.Font.GothamBold} TextColor3={Color3.fromRGB(230,240,232)} Event={{Activated:()=>dispatch(routeCinematicInput({kind:"activated",control}))}}><uitextsizeconstraint MaxTextSize={13} MinTextSize={9}/></textbutton>;
	return <frame key="CinematicScreen" Size={UDim2.fromScale(1,1)} BackgroundTransparency={1}>
		<textlabel Position={new UDim2(0,0,0,0)} Size={new UDim2(1,0,0,46)} BackgroundColor3={Color3.fromRGB(3,12,18)} BackgroundTransparency={.1} Text={`BROKEN RELAY  /  ${chapter.title}`} TextColor3={Color3.fromRGB(93,239,215)} TextSize={15} Font={Enum.Font.GothamBold}/>
		<frame Position={new UDim2(.025,0,1,-190)} Size={new UDim2(.95,0,0,184)} BackgroundColor3={Color3.fromRGB(3,12,18)} BackgroundTransparency={.08} BorderSizePixel={0}>
			<textlabel Position={UDim2.fromOffset(12,5)} Size={new UDim2(1,-24,0,21)} BackgroundTransparency={1} Text={`${chapter.beats[beat].speaker}   ${beat+1}/3`} TextXAlignment={Enum.TextXAlignment.Left} TextColor3={Color3.fromRGB(93,239,215)} TextSize={12} Font={Enum.Font.GothamBold}/>
			<textlabel Position={UDim2.fromOffset(12,30)} Size={new UDim2(1,-24,0,100)} BackgroundTransparency={1} Text={chapter.beats[beat].text} TextWrapped={true} TextScaled={true} TextColor3={Color3.fromRGB(247,244,231)} Font={Enum.Font.GothamMedium}><uitextsizeconstraint MaxTextSize={large ? 28 : 22} MinTextSize={14}/></textlabel>
			<frame Position={new UDim2(.02,0,1,-47)} Size={new UDim2(.96,0,0,44)} BackgroundTransparency={1}>
				{button("CinematicSkipButton","SKIP · A",0,"skip")}
				{button("CinematicPauseButton",paused ? "RESUME · X" : "PAUSE · X",.25,"pause")}
				{button("CinematicMotionButton",still ? "MOTION OFF" : "MOTION ON",.5,"motion")}
				{button("CinematicTextButton",large ? "TEXT: LARGE" : "TEXT SIZE",.75,"text")}
			</frame>
		</frame>
	</frame>;
}
