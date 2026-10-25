import {afterEach,describe,expect,it} from "@rbxts/jest-globals";
import {Lighting,Workspace} from "@rbxts/services";
import {MissionWorld} from "../server/MissionWorld";
import {MissionCatalog} from "../shared/MissionCatalog";
import {AircraftCollision} from "../server/AircraftCollision";
import {PART_BUDGET} from "../server/Scenery";
/** Engine integration only. Included in Roblox Jest; never run by the offline VM. */
describe("Broken Relay disposable world integration",()=>{
	let fixture:Folder | undefined;
	afterEach(()=>{
		fixture?.Destroy();fixture=undefined;Workspace.Terrain.Clear();
		Workspace.Terrain.FindFirstChild("MissionClouds")?.Destroy();
		for(const name of ["MissionAtmosphere","MissionGrade","MissionSky"])Lighting.FindFirstChild(name)?.Destroy();
	});
	for(const bp of MissionCatalog.All())it(`builds and disposes M${bp.id} with exact authored targets and bounded scenery`,()=>{
		fixture=new Instance("Folder");fixture.Name="RelayWorldFixture";fixture.Parent=Workspace;
		const world=MissionWorld.Build(bp.id,fixture);
		expect(world.groundTargets.size()).toBe(bp.ground.size());
		for(let i=0;i<world.groundTargets.size();i++){
			const target=world.groundTargets[i];expect(target.Parent).toBe(fixture);expect(target.Name).toBe(bp.ground[i].name);
			expect(target.PrimaryPart?.Position.X).toBeCloseTo(bp.ground[i].x,2);
			expect(target.PrimaryPart?.Position.Z).toBeCloseTo(bp.ground[i].z,2);
			expect(target.GetAttribute("GeometrySource")).toBe("Blender");
		}
		let parts=0;
		for(const item of fixture.GetDescendants())if(item.IsA("BasePart")){
			parts++;expect(item.Anchored).toBe(true);expect(item.CanCollide).toBe(false);
			// Audit the actual builders against the pre-followup classifications.
			// Every tagged visible surface remains solid except authored decoration.
			if (item.GetAttribute("FlightSolid") !== undefined) {
				const decoration = ["Shallows", "Marker light", "Navigation light", "Safety line", "Centreline", "Threshold", "Threshold bar", "Approach bar", "Center stripe", "Lit windows"].includes(item.Name);
				const solid = !decoration && item.Transparency < 1;
				expect(item.CanQuery).toBe(solid);
				expect(item.GetAttribute("FlightSolid")).toBe(solid);
				item.Name = solid ? "Marker light" : "Renamed decoration";
			}

			expect(item.Size.X<=2048 && item.Size.Y<=2048 && item.Size.Z<=2048).toBe(true);
		}
		const filter = AircraftCollision.Parameters(fixture).FilterDescendantsInstances;
		for (const item of fixture.GetDescendants()) if (item.IsA("BasePart") && item.GetAttribute("FlightSolid") !== undefined) {
			expect(filter.includes(item)).toBe(item.GetAttribute("FlightSolid") === true);
		}
		expect(parts<400).toBe(true);
		fixture.Destroy();expect(world.groundTargets.every((model)=>model.Parent===undefined)).toBe(true);
	});
	// The hand-composed opening worlds carry the densest scenery (airbase,
	// harbor, canyon). Their part counts are reported by Scenery.Report and
	// must stay inside the phone budget shared by every disposable world.
	for(const id of [1,2,3])it(`keeps the M${id} composition within the ${PART_BUDGET}-part budget`,()=>{
		fixture=new Instance("Folder");fixture.Name="RelayWorldFixture";fixture.Parent=Workspace;
		MissionWorld.Build(id,fixture);
		let parts=0;
		for(const item of fixture.GetDescendants())if(item.IsA("BasePart"))parts++;
		expect(fixture.GetAttribute("PartCount")).toBe(parts);
		expect(parts).toBeLessThanOrEqual(PART_BUDGET);
		expect(parts).toBeGreaterThan(100);
	});
});
