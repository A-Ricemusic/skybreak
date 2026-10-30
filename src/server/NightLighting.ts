import { RunService } from "@rbxts/services";
import { NightLighting, searchlightHeading } from "../shared/NightLighting";

/** Lights only: the world owns its environment and effects. Sweep is capped at 10 Hz. */
export function buildNightLighting(parent: Instance, plan: NightLighting, paused: () => boolean = () => false): void {
	const part = (name: string, position: Vector3) => {
		const p = new Instance("Part");
		p.Name = name;
		// Studio check (M05): 2-stud points vanished beyond about 1 km; 6 studs keep the field readable on approach.
		p.Size = new Vector3(6, 6, 6);
		p.Position = position;
		p.Anchored = true;
		p.CanCollide = false;
		p.CanTouch = false;
		p.CanQuery = false;
		p.Material = Enum.Material.Neon;
		p.Color = Color3.fromRGB(230, 235, 255);
		p.Parent = parent;
		return p;
	};
	for (const f of plan.fields) for (let i = 0; i < f.rows * f.columns; i++) {
		const p = part("Industrial light", new Vector3(f.origin.x + (i % f.columns) * f.spacing, f.origin.y, f.origin.z + math.floor(i / f.columns) * f.spacing));
		if (i < f.realLights) {
			const light = new Instance("PointLight");
			light.Range = 40;
			light.Brightness = 1;
			light.Shadows = false;
			light.Parent = p;
		}
	}
	const sweep = plan.searchlights.map(s => {
		const p = part("Searchlight", new Vector3(s.position.x, s.position.y, s.position.z));
		const light = new Instance("SpotLight");
		light.Angle = 25;
		// Roblox SpotLight's maximum range is 60 studs: it illuminates the near field;
		// the Beam supplies the authored long-distance visible shaft.
		light.Range = math.min(s.length, 60);
		light.Brightness = 3;
		light.Shadows = false;
		light.Parent = p;
		const a = new Instance("Attachment"), b = new Instance("Attachment");
		a.Parent = p;
		b.Position = new Vector3(0, 0, -s.length);
		b.Parent = p;
		const beam = new Instance("Beam");
		beam.Attachment0 = a;
		beam.Attachment1 = b;
		beam.Width0 = 2;
		beam.Width1 = 100;
		beam.Transparency = new NumberSequence(0.85);
		beam.FaceCamera = true;
		beam.Parent = p;
		return { p, s };
	});
	let elapsed = 0, update = 0;
	const connection = RunService.Heartbeat.Connect(dt => {
		if (paused()) return;
		elapsed += dt;
		update += dt;
		if (update < 0.1) return;
		update = 0;
		for (const { p, s } of sweep) p.CFrame = new CFrame(s.position.x, s.position.y, s.position.z)
			.mul(CFrame.Angles(0, math.rad(searchlightHeading(s, elapsed)), 0))
			.mul(CFrame.Angles(math.rad(55), 0, 0));
	});
	parent.Destroying.Once(() => connection.Disconnect());
}
