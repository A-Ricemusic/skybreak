import { navalVisual } from "../shared/NavalKit";
import { GROUND_KIT_BUDGET_ATTRIBUTE, GROUND_KIT_INSTANCE_ALLOWANCE, kitInstanceAllowance } from "./WorldInstanceBudget";
import { MILITARY_GROUND_KIT } from "../shared/MilitaryGroundKit";
import { WorldAssets } from "./WorldAssets";
import { navalHull } from "../shared/SurfaceTargetRules";
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
/** Cosmetic replacement only: original geometry remains the exact collision/target proxy.
 * Fit uniformly inside the old bounds; no stretched vehicles or expanded hitboxes.
 * Capture bounds and aim BEFORE decoration: uploaded detail never moves the lock point.
 */
export function decorateGroundTarget(model: Model, targetType: GroundTargetType, bounds: CFrame, size: Vector3): void {
 const navalAsset = navalVisual(targetType, model.GetAttribute("TargetType") as string | undefined, model.GetAttribute("LayoutGroup") as string | undefined);
 const asset = navalAsset !== undefined && WorldAssets.Has(navalAsset) ? navalAsset : MILITARY_GROUND_KIT[targetType];
 if (asset === undefined) return;
 const authored = UploadedAssetSpecs[asset].size;
 const scale = math.min(size.X / authored.X, size.Y / authored.Y, size.Z / authored.Z);
 const proxies = model.GetDescendants();
 const visual = WorldAssets.PlaceUploaded(asset, model, bounds.mul(new CFrame(0, -size.Y / 2, 0)), scale);
 if (visual === undefined) return;
 // Fail back to the unchanged proxies before hiding anything if a future import grows.
 if (1 + visual.GetDescendants().size() > kitInstanceAllowance(asset)) {
  visual.Destroy();
  warn(`Ground kit ${asset} exceeds ${GROUND_KIT_INSTANCE_ALLOWANCE} instances; retaining procedural visual`);
  return;
 }
 visual.SetAttribute(GROUND_KIT_BUDGET_ATTRIBUTE, true);
 for (const p of proxies) if (p.IsA("BasePart")) { p.SetAttribute("GroundKitQuery", p.Transparency < 1); p.Transparency = 1; }
 for (const p of visual.GetDescendants()) if (p.IsA("BasePart")) {
  p.SetAttribute("GroundKitQuery", false); p.CanQuery = false; p.CanCollide = false; p.CanTouch = false; p.SetAttribute("FlightSolid", false);
 }
 model.SetAttribute("UploadedAsset", asset);
}
/**
 * A world's own visual becomes a typed target: renamed to its HUD label, tagged with the spec id and
 * given an invisible stationary aim centre (the PrimaryPart combat locks and homes on).
 */
export function adoptGroundTarget(model: Model, id: string, targetType: GroundTargetType): Model {
	const [bounds, size] = model.GetBoundingBox();
	decorateGroundTarget(model, targetType, bounds, size);
	const aim = new Instance("Part");
	aim.Name = "Aim"; aim.Size = new Vector3(4, 4, 4); aim.CFrame = new CFrame(bounds.Position); aim.Transparency = 1;
	aim.Anchored = true; aim.CanCollide = false; aim.CanTouch = false; aim.CanQuery = false; aim.Parent = model;
	model.PrimaryPart = aim;
	model.Name = GROUND_TARGET_LABELS[targetType];
	model.SetAttribute("TargetId", id);
	return model;
}
/** Fallback visual for worlds that do not draw a target themselves; retains spec ids/positions and stationary aim roots. Keeps the procedural fallback when the dormant kit is unavailable. */
export function createGroundTarget(spec: TypedGroundTarget): Model {
	const model = spec.type === "parked_bomber" ? BomberFactory.Create(spec.type) : new Instance("Model");
	const part = (name: string, size: Vector3, at: Vector3, ball=false) => {
		const p=new Instance("Part"); p.Name=name; p.Size=size; p.Position=at; p.Anchored=true; p.CanCollide=false; p.CanTouch=false;
		p.Color=Color3.fromRGB(105,120,112); p.Material=Enum.Material.Metal; if(ball) p.Shape=Enum.PartType.Ball; p.Parent=model; return p;
	};
	if (spec.type !== "parked_bomber") {
		model.PrimaryPart=part("Aim",new Vector3(12,8,12),new Vector3(0,4,0));
		if(spec.type==="generator" || spec.type==="core") {
			model.PrimaryPart!.Transparency=1; part(spec.type,new Vector3(40,80,40),new Vector3(0,40,0));
		} else if (spec.type === "ship") {
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
		} else if (navalHull(spec.type) && spec.type!=="gunboat") {
			const length=spec.type==="missile_boat" ? 85 : spec.type==="cruiser" ? 260 : 200;
			model.PrimaryPart!.Transparency=1;
			part("Hull",new Vector3(spec.type==="submarine" ? 25 : 48,18,length),new Vector3(0,0,0));
			part(spec.type==="submarine" ? "Sail" : "Bridge",new Vector3(22,22,32),new Vector3(0,18,length*0.25));
			if(spec.type==="container_ship" || spec.type==="supply_ship") for(const z of [-55,-20,15]) part("Deck cargo",new Vector3(32,18,25),new Vector3(0,17,z));
		} else if (spec.type === "gunboat") {
			part("Hull",new Vector3(18,8,55),new Vector3(0,0,0)); part("Cabin",new Vector3(12,10,16),new Vector3(0,9,12));
		} else if (spec.type === "container") { part("Cargo",new Vector3(16,16,40),new Vector3(0,8,0));
		} else if (spec.type === "watchtower") { part("Stilts",new Vector3(8,40,8),new Vector3(0,20,0)); part("Lookout",new Vector3(20,10,20),new Vector3(0,45,0));
		} else if (spec.type === "antenna") { part("Mast",new Vector3(3,60,3),new Vector3(0,30,0)); part("Aerial",new Vector3(25,3,3),new Vector3(0,52,0));
		} else if (spec.type === "barracks") { part("Quarters",new Vector3(30,18,70),new Vector3(0,9,0));
		} else if (spec.type === "sub_pen") { model.PrimaryPart!.Transparency=1; for(const x of [-55,55]) part("Pier wall",new Vector3(10,70,100),new Vector3(x,35,0)).Material=Enum.Material.Concrete; part("Roof",new Vector3(120,10,100),new Vector3(0,75,0)).Material=Enum.Material.Concrete;
		} else if (spec.type === "containers") {
			for(const x of [-18,0,18]) part("Container",new Vector3(16,16,40),new Vector3(x,8,0));
		} else if (spec.type === "storage") { part("Storehouse",new Vector3(65,30,45),new Vector3(0,15,0)); }
		else if (spec.type === "solar_panel") { model.PrimaryPart!.Transparency=1; for(const x of [-18,0,18]) { const panel=part("Reflector",new Vector3(16,2,32),new Vector3(x,10,0)); panel.Color=Color3.fromRGB(55,105,145); panel.Material=Enum.Material.Glass; panel.CFrame=panel.CFrame.mul(CFrame.Angles(math.rad(20),0,0)); } }
		else if (spec.type === "solar_tower") { part("Collector tower",new Vector3(14,100,14),new Vector3(0,50,0)); part("Receiver",new Vector3(26,18,26),new Vector3(0,105,0)); }
		else if (spec.type === "bridge_section") { part("Military bridge span",new Vector3(100,12,38),new Vector3(0,10,0)); part("Pier",new Vector3(12,25,30),new Vector3(0,-6,0)); }
		else if (spec.type === "railgun_emplacement" || spec.type === "wreck") { model.PrimaryPart!.Transparency=1; part("Ring foundation",new Vector3(90,12,90),new Vector3(0,6,0)); part("Pivot",new Vector3(28,45,28),new Vector3(0,30,0)); const barrel=part("Rail barrel",new Vector3(12,12,150),new Vector3(0,52,-55)); if(spec.type==="wreck") { barrel.CFrame=barrel.CFrame.mul(CFrame.Angles(0,0,math.rad(32))); barrel.Color=Color3.fromRGB(40,40,40); } }
		else if(spec.type === "ground_ecm") { part("ECM housing",new Vector3(30,18,30),new Vector3(0,9,0)); part("Antenna",new Vector3(4,42,4),new Vector3(0,35,0)); part("Array",new Vector3(40,12,4),new Vector3(0,52,0)); }
		else if (spec.type === "artillery") { part("Gun carriage",new Vector3(16,6,22),new Vector3(0,5,0)); part("Long barrel",new Vector3(3,3,38),new Vector3(0,11,-15)); }
		else if (spec.type === "tank" || spec.type === "vehicle") { part("Chassis",new Vector3(18,8,30),new Vector3(0,6,0)); for(const x of [-9,9]) part("Running gear",new Vector3(4,6,28),new Vector3(x,3,0)); part(spec.type === "tank" ? "Turret" : "Cab",new Vector3(12,7,12),new Vector3(0,13,0)); if(spec.type === "tank") part("Cannon",new Vector3(2,2,25),new Vector3(0,14,-15)); }
		else if (spec.type === "bunker" || spec.type === "pillbox") { part("Bunker",new Vector3(36,14,30),new Vector3(0,7,0)).Material=Enum.Material.Concrete; part("Firing slit",new Vector3(20,3,2),new Vector3(0,10,-16)).Color=Color3.fromRGB(20,25,25); }
		else if (spec.type === "sam" && spec.sam) { part("Launcher",new Vector3(16,8,20),new Vector3(0,8,0)); for(const x of [-5,5]) part("Tube",new Vector3(3,4,22),new Vector3(x,15,-4)); }
		else if (spec.type === "aa_gun" || spec.type === "gun_mount" || spec.type === "flak_gun") { part("Turret",new Vector3(8,6,8),new Vector3(0,10,0)); part("Barrel",new Vector3(2,2,24),new Vector3(0,13,-10)); }
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
	const [bounds, size] = model.GetBoundingBox();
 if (spec.parentId !== undefined) model.SetAttribute("LayoutGroup", "naval_mount");
	decorateGroundTarget(model, spec.type, bounds, size);
	model.Name = GROUND_TARGET_LABELS[spec.type];
	model.SetAttribute("TargetId", spec.id);
	return model;
}
