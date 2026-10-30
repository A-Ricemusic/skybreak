import {describe,expect,it} from "@rbxts/jest-globals";
import {BACKDROP_ASSETS,BackdropItem,CINEMATIC_PROPS,FRIGATE_RING_CHAPTER,HARBOUR_WATER,NO_DEPTH,ORCHARD_SPOTS,PROP_ANCHOR,backdropFor,dressBackdrop,moodGrade,relayMasts,shotDepth,stageGround,stageHalf,standInParts,subjectStandInParts} from "../shared/CinematicSet";
import {CHAIR,SUBJECT,orchardBurned,recorderOpen,shotPose,stageSubject} from "../shared/CinematicStaging";
import {RobloxAssetIds} from "../shared/RobloxAssetIds";
import {UploadedAssetSpecs} from "../shared/UploadedAssetSpecs";
import {STORY,StoryChapter,StoryMood,StoryScene,StoryShot} from "../shared/RelayStory";
import {createTeardown} from "../shared/Teardown";

const MOODS:StoryMood[]=["dawn","day","dusk","night","storm"];
const SCENES:StoryScene[]=["hangar","canyon","farm","relay","harbor","city","sea"];
const SHOTS:StoryShot[]=["radio","wide","evidence","chair","recorder","sky","black"];
/** The story chapter with this title (the chapter numbering follows the 18-mission story, so tests find chapters by content). */
const titled=(title:string):StoryChapter=>{const found=STORY.find((c)=>c.title===title);assert(found,`no chapter titled ${title}`);return found;};
/** Axis-aligned half extents of a yawed footprint. */
const footprint=(asset:keyof typeof UploadedAssetSpecs,yaw:number,scale:number)=>{
	const size=UploadedAssetSpecs[asset].size,a=size.X/2*scale,b=size.Z/2*scale,c=math.abs(math.cos(yaw)),s=math.abs(math.sin(yaw));
	return {x:a*c+b*s,z:a*s+b*c};
};

describe("cinematic set dressing",()=>{
	it("uses only approved, uploaded scenery and keeps every model on the stage, clear of the desk and the subject",()=>{
		for(const asset of BACKDROP_ASSETS){expect(RobloxAssetIds[asset]!==undefined).toBe(true);expect(UploadedAssetSpecs[asset].kind).toBe("world");}
		for(const chapter of STORY)for(const burned of [false,true]){
			const items=backdropFor(chapter.scene,chapter.id,burned),half=stageHalf(chapter.scene);
			if(chapter.scene==="hangar")expect(items.size()).toBe(0);else expect(items.size()>0).toBe(true);
			for(const item of items){
				expect(BACKDROP_ASSETS.includes(item.asset)).toBe(true);expect(item.scale>0).toBe(true);
				const f=footprint(item.asset,item.yaw,item.scale);
				expect(math.abs(item.x)+f.x<=half-4).toBe(true);expect(math.abs(item.z)+f.z<=half-4).toBe(true);
				// At least 60 studs between the desk and any footprint, so the desk shots and the chair push-in stay clear.
				expect(math.sqrt(item.x*item.x+item.z*item.z)-math.max(f.x,f.z)>=60).toBe(true);
				if(item.asset!=="RelayMast"){
					const clear=math.abs(item.x-SUBJECT.x)>=f.x+30 || math.abs(item.z-SUBJECT.z)>=f.z+30;
					expect(clear).toBe(true);
				}
			}
		}
	});
	it("puts scenery in front of the desk too, so the radio shot no longer looks at empty floor",()=>{
		for(const scene of ["canyon","farm","relay","harbor","city"] as StoryScene[])expect(backdropFor(scene,4,false).some((i)=>i.z>150)).toBe(true);
	});
	it("matches the story's chapters: frigates ring their sea, the orchard burns from its storm walk, no storm platform",()=>{
		const ring=titled("The frigate ring");
		expect(ring.scene).toBe("sea");expect(ring.id).toBe(FRIGATE_RING_CHAPTER);
		expect(backdropFor(ring.scene,ring.id,false).filter((i)=>i.asset==="Frigate").size()>=3).toBe(true);
		// The storm platform chapter is cut from the 18-mission story; no chapter asks for a platform.
		expect(STORY.find((c)=>c.title==="The storm platform")).toBeUndefined();
		expect((BACKDROP_ASSETS as string[]).includes("OilPlatform")).toBe(false);
		for(const chapter of STORY)if(chapter.scene==="sea" && chapter.id!==ring.id)expect(backdropFor("sea",chapter.id,false).size()).toBe(1);
		const burn=titled("Walking the storm");
		expect(burn.scene).toBe("farm");expect(orchardBurned(burn.id)).toBe(true);
		for(const chapter of STORY)if(chapter.scene==="farm"){
			const burned=orchardBurned(chapter.id);
			expect(burned).toBe(chapter.id>=burn.id);
			expect(backdropFor("farm",chapter.id,burned).some((i)=>i.asset==="Broadleaf")).toBe(!burned);
		}
		expect(ORCHARD_SPOTS.size()>0).toBe(true);
		const recovery=titled("The last fracture");
		expect(recorderOpen(recovery.id)).toBe(true);
		expect(STORY.filter((c)=>recorderOpen(c.id)).size()).toBe(1);
		const dark=titled("The city in darkness");expect(backdropFor(dark.scene,dark.id,false).some((i)=>i.asset==="CityTower")).toBe(true);
	});
	it("gives every backdrop spot and story subject a part-built stand-in inside its footprint",()=>{
		// Every real placement in every chapter (burned or not), at the scale it is placed.
		const placements:BackdropItem[]=[];
		for(const chapter of STORY)for(const burned of [false,true])for(const it of backdropFor(chapter.scene,chapter.id,burned))placements.push(it);
		for(const asset of BACKDROP_ASSETS)expect(placements.some((it)=>it.asset===asset)).toBe(true);
		for(const {asset,scale} of placements){
			const spec=UploadedAssetSpecs[asset],size={x:spec.size.X*scale,y:spec.size.Y*scale,z:spec.size.Z*scale};
			const parts=standInParts(asset,size,spec.groundOffset*scale);
			expect(parts.size()>0).toBe(true);
			for(const part of parts){
				expect(part.size.x>0 && part.size.y>0 && part.size.z>0).toBe(true);
				expect(math.max(part.size.x,part.size.y,part.size.z)<=2048).toBe(true);
				expect(math.abs(part.offset.x)+part.size.x/2<=math.max(size.x/2,1)+.5).toBe(true);
				expect(math.abs(part.offset.z)+part.size.z/2<=math.max(size.z/2,1)+.8).toBe(true);
				expect(part.offset.y-part.size.y/2>=-.01).toBe(true);
			}
		}
		// Ships float: the frigate stand-in rides at its waterline, not its keel.
		const frigate=UploadedAssetSpecs.Frigate,hull=standInParts("Frigate",{x:frigate.size.X/2,y:frigate.size.Y/2,z:frigate.size.Z/2},frigate.groundOffset/2)[0];
		expect(math.abs(hull.offset.y-hull.size.y/2)<1e-6).toBe(true);
		for(const chapter of STORY){const subject=stageSubject(chapter.scene);if(subject)expect(subjectStandInParts(subject).size()>0).toBe(true);}
		expect(subjectStandInParts("HarborLaunch").some((p)=>p.name==="Launch hull")).toBe(true);
	});
	it("stands in for exactly the spots whose models are missing or fail to place",()=>{
		const items=backdropFor("city",titled("The city in darkness").id,false),standIns:BackdropItem[]=[];
		// Partial availability: towers loaded, offices missing, apartments throw while placing.
		const result=dressBackdrop(items,(item)=>{
			if(item.asset==="ApartmentBlock")error("place failed");
			return item.asset==="CityTower";
		},(item)=>standIns.push(item));
		expect(result.uploaded.size()+result.standIns.size()).toBe(items.size());
		expect(result.uploaded.every((i)=>i.asset==="CityTower")).toBe(true);
		expect(result.standIns.size()).toBe(standIns.size());
		expect(standIns.some((i)=>i.asset==="ApartmentBlock") && standIns.some((i)=>i.asset==="OfficeMidrise")).toBe(true);
		expect(standIns.some((i)=>i.asset==="CityTower")).toBe(false);
		// Nothing available and everything available are the two extremes of the same rule.
		for(const chapter of STORY){
			const all=backdropFor(chapter.scene,chapter.id,orchardBurned(chapter.id));
			expect(dressBackdrop(all,()=>false,()=>undefined).standIns.size()).toBe(all.size());
			expect(dressBackdrop(all,()=>true,()=>undefined).uploaded.size()).toBe(all.size());
		}
	});
	it("tears down every registered resource once, newest first, even when steps throw",()=>{
		const order:string[]=[],reports:string[]=[];
		const teardown=createTeardown((m)=>reports.push(m));
		teardown.add(()=>order.push("camera"));teardown.add(()=>{order.push("lighting");error("restore failed");});teardown.add(()=>order.push("effects"));
		teardown.run();teardown.run();
		expect(order.join(",")).toBe("effects,lighting,camera");
		expect(reports.size()).toBe(1);expect(teardown.ran()).toBe(true);
		// A resource created after teardown started is undone immediately, not leaked.
		teardown.add(()=>order.push("late"));expect(order[order.size()-1]).toBe("late");
		// Transactional setup: a throw halfway undoes only what was created, and a second teardown is a no-op.
		const made:string[]=[],undone:string[]=[],setup=createTeardown();
		const failAt=2;
		const [ok]=pcall(()=>{
			for(const name of ["stage","lighting","effects"]){
				if(made.size()===failAt)error(`${name} failed`);
				made.push(name);setup.add(()=>undone.push(name));
			}
		});
		expect(ok).toBe(false);setup.run();setup.run();
		expect(undone.join(",")).toBe("lighting,stage");
	});
	it("keeps the relay ring at five masts around the subject",()=>{
		const masts=relayMasts();expect(masts.size()).toBe(5);
		for(const m of masts){const d=math.sqrt((m.x-SUBJECT.x)**2+(m.z-SUBJECT.z)**2);expect(math.abs(d-75)<.01).toBe(true);}
		expect(backdropFor("relay",9,false).filter((i)=>i.asset==="RelayMast").size()).toBe(5);
	});
	it("gives every scene a ground and every mood a gentle grade",()=>{
		for(const scene of SCENES)for(const burned of [false,true]){const g=stageGround(scene,burned);expect(g.color.r>=0 && g.color.r<=255 && g.reflectance>=0 && g.reflectance<1).toBe(true);}
		expect(stageGround("sea",false).material).toBe("Glass");expect(stageGround("farm",true).material).toBe("Ground");
		expect(stageHalf("sea")*2<=2048).toBe(true);expect(stageHalf("city")).toBe(350);
		expect(HARBOUR_WATER.z0>=-stageHalf("harbor") && HARBOUR_WATER.z1>HARBOUR_WATER.z0).toBe(true);
		for(const mood of MOODS){
			const g=moodGrade(mood);
			expect(math.abs(g.saturation)<=.25 && math.abs(g.contrast)<=.15 && math.abs(g.brightness)<=.05).toBe(true);
			expect(g.tint.r>=200 && g.tint.g>=200 && g.tint.b>=200).toBe(true);
		}
		expect(moodGrade("night").tint.b>moodGrade("night").tint.r).toBe(true);
		expect(moodGrade("dawn").sunRays!==undefined && moodGrade("night").sunRays===undefined).toBe(true);
	});
	it("focuses depth of field on each close shot's subject and leaves wide, sky and cards sharp",()=>{
		for(const shot of SHOTS)for(const scene of SCENES)for(const short of [false,true]){
			const pose=shotPose(shot,scene,.5,short),d=shotDepth(shot,pose);
			if(shot==="wide" || shot==="sky" || shot==="black"){expect(d).toBeUndefined();continue;}
			expect(d!==undefined).toBe(true);
			const dx=pose.eye.x-pose.focus.x,dy=pose.eye.y-pose.focus.y,dz=pose.eye.z-pose.focus.z;
			expect(math.abs(d!.focusDistance-math.sqrt(dx*dx+dy*dy+dz*dz))<1e-6).toBe(true);
			expect(d!.inFocusRadius>=3 && d!.farIntensity>0 && d!.farIntensity<=.5).toBe(true);expect(d!.nearIntensity).toBe(0);
		}
		// The chair stays inside its own shot's in-focus band.
		const chair=shotPose("chair","farm",.5,false),cd=shotDepth("chair",chair)!;
		const toChair=math.sqrt((chair.eye.x-CHAIR.x)**2+(chair.eye.y-CHAIR.y)**2+(chair.eye.z-CHAIR.z)**2);
		expect(math.abs(toChair-cd.focusDistance)<=cd.inFocusRadius).toBe(true);
		expect(NO_DEPTH.farIntensity).toBe(0);expect(NO_DEPTH.nearIntensity).toBe(0);
	});
	it("wires the approved, uploaded desk props, with the anchors the stage seats them by",()=>{
		const approved:Record<string,number>={CinematicRadioConsole:107763051422036,CinematicFieldRecorder:87111261775563,CinematicStatusBoard:105938775214679,CinematicTapeTin:86951943477271};
		for(const name of CINEMATIC_PROPS){
			expect(RobloxAssetIds[name]).toBe(approved[name]);
			const spec=UploadedAssetSpecs[name];
			expect(spec.kind).toBe("world");expect(spec.anchors!==undefined && spec.anchors[PROP_ANCHOR[name]]!==undefined).toBe(true);
		}
		const console=UploadedAssetSpecs.CinematicRadioConsole;
		expect(console.rotors!.ReelL.axis.Y).toBe(1);expect(console.rotors!.ReelR.axis.Y).toBe(1);
		expect(console.anchors!.FrequencyWindow.Z<console.anchors!.Body.Z).toBe(true);
		const recorder=UploadedAssetSpecs.CinematicFieldRecorder,hinge=recorder.controlSurfaces!.Lid;
		// The lid swings about an X-parallel hinge, so only its Y and Z (and its length) matter.
		expect(math.abs(hinge.from.Y-hinge.to.Y)<1e-3 && math.abs(hinge.from.Z-hinge.to.Z)<1e-3).toBe(true);
		expect(math.abs(math.abs(hinge.to.X-hinge.from.X)-1.3)<.01).toBe(true);
		expect(hinge.from.Z>recorder.anchors!.Centre.Z).toBe(true);
		expect(recorder.anchors!.Lamp.Y>recorder.anchors!.Centre.Y).toBe(true);
		// Envelopes the camera poses were tuned for: receiver 7 wide, recorder 2 x 3, board 5 wide, tin under 2 across.
		expect(math.abs(console.size.X-7.3)<.4).toBe(true);
		expect(recorder.size.X<2.4 && recorder.size.Z<3.6).toBe(true);
		expect(UploadedAssetSpecs.CinematicStatusBoard.size.X<5.6).toBe(true);
		expect(UploadedAssetSpecs.CinematicTapeTin.size.X<2).toBe(true);
	});
});
