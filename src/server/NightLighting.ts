import { RunService } from "@rbxts/services";
import { environmentFor } from "../shared/EnvironmentPresets";
import { NightLighting, searchlightHeading } from "../shared/NightLighting";
import { WorldEnvironment } from "./WorldEnvironment";
/** Opt-in pre-dawn preset. Parent owns all geometry and disconnects its sweep on destruction. */
export function buildNightLighting(parent: Instance, plan: NightLighting): void {
 const base=environmentFor("ocean_night");
 WorldEnvironment.ApplySpec({...base,clock:5.2,brightness:0.7,ambient:[35,43,60],outdoorAmbient:[40,50,68],starCount:450,moonSize:7,water:{...base.water,color:[17,25,32]}},"industrial_predawn");
 const part=(name:string,position:Vector3)=>{const p=new Instance("Part"); p.Name=name;p.Size=new Vector3(2,2,2);p.Position=position;p.Anchored=true;p.CanCollide=false;p.CanTouch=false;p.CanQuery=false;p.Material=Enum.Material.Neon;p.Color=Color3.fromRGB(230,235,255);p.Parent=parent;return p;};
 for(const f of plan.fields) for(let i=0;i<f.rows*f.columns;i++) {const p=part("Industrial light",new Vector3(f.origin.x+(i%f.columns)*f.spacing,f.origin.y,f.origin.z+math.floor(i/f.columns)*f.spacing));if(i<f.realLights){const l=new Instance("PointLight");l.Range=40;l.Brightness=1;l.Shadows=false;l.Parent=p;}}
 const sweep=plan.searchlights.map(s=>{const p=part("Searchlight",new Vector3(s.position.x,s.position.y,s.position.z));const l=new Instance("SpotLight");l.Angle=25;l.Range=60;l.Shadows=false;l.Parent=p;const a=new Instance("Attachment");a.Parent=p;const b=new Instance("Attachment");b.Position=new Vector3(0,0,-s.length);b.Parent=p;const beam=new Instance("Beam");beam.Attachment0=a;beam.Attachment1=b;beam.Width0=2;beam.Width1=100;beam.Transparency=new NumberSequence(0.85);beam.FaceCamera=true;beam.Parent=p;return {p,s};});
 let elapsed=0;const c=RunService.Heartbeat.Connect(dt=>{elapsed+=dt;for(const {p,s} of sweep)p.CFrame=new CFrame(s.position.x,s.position.y,s.position.z).mul(CFrame.Angles(0,math.rad(searchlightHeading(s,elapsed)),0)).mul(CFrame.Angles(math.rad(55),0,0));});parent.Destroying.Once(()=>c.Disconnect());
}
