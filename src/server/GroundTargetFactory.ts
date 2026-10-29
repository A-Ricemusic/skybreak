import { BomberFactory } from "../shared/BomberFactory";
import { TypedGroundTarget } from "../shared/CampaignEncounters";
/** Replace this factory per world while retaining spec ids/positions and stationary aim roots. No uploads. */
export function createGroundTarget(spec: TypedGroundTarget): Model {
	const model = spec.type === "parked_bomber" ? BomberFactory.Create(spec.type) : new Instance("Model");
	model.Name = string.upper(spec.type);
	const part = (name: string, size: Vector3, at: Vector3, ball=false) => {
		const p=new Instance("Part"); p.Name=name; p.Size=size; p.Position=at; p.Anchored=true; p.CanCollide=false; p.CanTouch=false;
		p.Color=Color3.fromRGB(105,120,112); p.Material=Enum.Material.Metal; if(ball) p.Shape=Enum.PartType.Ball; p.Parent=model; return p;
	};
	if (spec.type !== "parked_bomber") {
		model.PrimaryPart=part("Aim",new Vector3(12,8,12),new Vector3(0,4,0));
		if (spec.type === "aa_gun") { part("Turret",new Vector3(8,6,8),new Vector3(0,10,0)); part("Barrel",new Vector3(2,2,24),new Vector3(0,13,-10)); }
		else if (spec.type === "parked_helicopter") { part("Cabin",new Vector3(10,10,24),new Vector3(0,10,0),true); part("Rotor",new Vector3(44,1,3),new Vector3(0,17,0)); part("Tail",new Vector3(3,4,28),new Vector3(0,10,20)); }
		else if (spec.type === "radar_dome") part("Dome",new Vector3(34,34,34),new Vector3(0,23,0),true);
		else if (spec.type === "hangar") { part("Hangar",new Vector3(65,25,55),new Vector3(0,12.5,0)); part("Door",new Vector3(45,20,1),new Vector3(0,10,-28)).Color=Color3.fromRGB(35,40,45); }
		else if (spec.type === "control_tower" || spec.type === "rig_tower") { part("Tower",new Vector3(12,55,12),new Vector3(0,27,0)); part("Cab",new Vector3(28,12,24),new Vector3(0,58,0)); }
		else if (spec.type === "substation") for (const x of [-16,0,16]) { part("Transformer",new Vector3(9,15,18),new Vector3(x,8,0)); part("Insulator",new Vector3(2,8,2),new Vector3(x,20,0)); }
		else { part("Plant deck",new Vector3(55,5,45),new Vector3(0,4,0)); for(const x of [-15,15]) part("Tank",new Vector3(20,28,20),new Vector3(x,20,0)); }
	}
	model.PivotTo(new CFrame(spec.position.x,spec.position.y,spec.position.z).mul(CFrame.Angles(0,math.rad(spec.yaw),0)));
	return model;
}
