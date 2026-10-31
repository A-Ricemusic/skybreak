import { navalHull } from "../shared/EngineBatchD2";
import { AssetSelection } from "../shared/AssetSelection";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";
import { UploadedAssets } from "../shared/UploadedAssets";
import { BomberFactory, attachBomberGeometry } from "../shared/BomberFactory";
import { GROUND_TARGET_LABELS, GroundTargetType, TypedGroundTarget } from "../shared/CampaignEncounters";
/** Lifts `model` so its bounding box rests on `baseY` (a parked aircraft's wheels on the pavement). */
export function restOn(model: Model, baseY: number): void {
	const [bounds, size] = model.GetBoundingBox();
	model.PivotTo(model.GetPivot().add(new Vector3(0, baseY - (bounds.Position.Y - size.Y / 2), 0)));
}
/**
 * A world's own visual becomes a typed target: renamed to its HUD label, tagged with the spec id and
 * given an invisible stationary aim centre (the PrimaryPart combat locks and homes on).
 */
export function adoptGroundTarget(model: Model, id: string, targetType: GroundTargetType): Model {
	const [bounds] = model.GetBoundingBox();
	const aim = new Instance("Part");
	aim.Name = "Aim"; aim.Size = new Vector3(4, 4, 4); aim.CFrame = new CFrame(bounds.Position); aim.Transparency = 1;
	aim.Anchored = true; aim.CanCollide = false; aim.CanTouch = false; aim.CanQuery = false; aim.Parent = model;
	model.PrimaryPart = aim;
	model.Name = GROUND_TARGET_LABELS[targetType];
	model.SetAttribute("TargetId", id);
	return model;
}
/** Fallback visual for worlds that do not draw a target themselves; retains spec ids/positions and stationary aim roots. No uploads. */
export function createGroundTarget(spec: TypedGroundTarget): Model {
	const model = spec.type === "parked_bomber" ? BomberFactory.Create(spec.type) : new Instance("Model");
	const part = (name: string, size: Vector3, at: Vector3, ball=false) => {
		const p=new Instance("Part"); p.Name=name; p.Size=size; p.Position=at; p.Anchored=true; p.CanCollide=false; p.CanTouch=false;
		p.Color=Color3.fromRGB(105,120,112); p.Material=Enum.Material.Metal; if(ball) p.Shape=Enum.PartType.Ball; p.Parent=model; return p;
	};
	if (spec.type !== "parked_bomber") {
		model.PrimaryPart=part("Aim",new Vector3(12,8,12),new Vector3(0,4,0));
		if (spec.type === "ship") {
			const loaded = UploadedAssets.Template(AssetSelection.TankerCandidates(UploadedAssetSpecs));
			if (loaded) {
				const aim = model.PrimaryPart!;
				aim.Transparency = 1;
				// Uploaded world geometry is bottom-centred; its waterline sits above the keel.
				aim.CFrame = new CFrame(0, -UploadedAssetSpecs[loaded.name].groundOffset, 0);
				attachBomberGeometry(model, loaded.template);
				const [bounds] = loaded.template.GetBoundingBox();
				const centre = aim.CFrame.PointToWorldSpace(loaded.template.GetPivot().PointToObjectSpace(bounds.Position));
				aim.CFrame = new CFrame(centre);
				model.SetAttribute("UploadedAsset", loaded.name);
			} else {
				part("Hull", new Vector3(50,25,220), new Vector3(0,5,0));
				part("Bridge", new Vector3(35,30,40), new Vector3(0,30,65));
			}
		} else if (navalHull(spec.type)) {
			const length=spec.type==="missile_boat" ? 85 : spec.type==="cruiser" ? 260 : 200;
			model.PrimaryPart!.Transparency=1;
			part("Hull",new Vector3(spec.type==="submarine" ? 25 : 48,18,length),new Vector3(0,0,0));
			part(spec.type==="submarine" ? "Sail" : "Bridge",new Vector3(22,22,32),new Vector3(0,18,length*0.25));
			if(spec.type==="container_ship" || spec.type==="supply_ship") for(const z of [-55,-20,15]) part("Deck cargo",new Vector3(32,18,25),new Vector3(0,17,z));
		} else if (spec.type === "containers") {
			for(const x of [-18,0,18]) part("Container",new Vector3(16,16,40),new Vector3(x,8,0));
		} else if (spec.type === "storage") { part("Storehouse",new Vector3(65,30,45),new Vector3(0,15,0)); }
		else if (spec.type === "sam" && spec.sam) { part("Launcher",new Vector3(16,8,20),new Vector3(0,8,0)); for(const x of [-5,5]) part("Tube",new Vector3(3,4,22),new Vector3(x,15,-4)); }
		else if (spec.type === "aa_gun" || spec.type === "gun_mount") { part("Turret",new Vector3(8,6,8),new Vector3(0,10,0)); part("Barrel",new Vector3(2,2,24),new Vector3(0,13,-10)); }
		else if (spec.type === "parked_helicopter") { part("Cabin",new Vector3(10,10,24),new Vector3(0,10,0),true); part("Rotor",new Vector3(44,1,3),new Vector3(0,17,0)); part("Tail",new Vector3(3,4,28),new Vector3(0,10,20)); }
		else if (spec.type === "radar_dome") part("Dome",new Vector3(34,34,34),new Vector3(0,23,0),true);
		else if (spec.type === "hangar") { part("Hangar",new Vector3(65,25,55),new Vector3(0,12.5,0)); part("Door",new Vector3(45,20,1),new Vector3(0,10,-28)).Color=Color3.fromRGB(35,40,45); }
		else if (spec.type === "control_tower" || spec.type === "rig_tower") { part("Tower",new Vector3(12,55,12),new Vector3(0,27,0)); part("Cab",new Vector3(28,12,24),new Vector3(0,58,0)); }
		else if (spec.type === "substation") for (const x of [-16,0,16]) { part("Transformer",new Vector3(9,15,18),new Vector3(x,8,0)); part("Insulator",new Vector3(2,8,2),new Vector3(x,20,0)); }
		else { part("Plant deck",new Vector3(55,5,45),new Vector3(0,4,0)); for(const x of [-15,15]) part("Tank",new Vector3(20,28,20),new Vector3(x,20,0)); }
	}
	const placement = new CFrame(spec.position.x,spec.position.y,spec.position.z).mul(CFrame.Angles(0,math.rad(spec.yaw),0));
	model.PivotTo(spec.type === "ship" ? placement.mul(model.GetPivot()) : placement);
	// A parked bomber's pivot is its fuselage centre: rest the hull on the ground instead of sinking it.
	if (spec.type === "parked_bomber") restOn(model, spec.position.y);
	model.Name = GROUND_TARGET_LABELS[spec.type];
	model.SetAttribute("TargetId", spec.id);
	return model;
}
