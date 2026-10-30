import { Lighting, Workspace } from "@rbxts/services";
import { cutInCaption, cutInOffset, CUT_IN_LIFT, canSkipCutIn, type CutInPlan } from "../shared/SortieCutaways";

/**
 * Local, HUD-less flypast of the surprise flight (m05 §9): copies of the replicated aircraft fly in formation along
 * the lead's heading, 350 studs above the frozen originals, past a camera that tracks them toward the moon side.
 * Presentation only; the server holds the sortie and owns when it ends.
 */
export class EliteCutIn {
	private readonly copies: { model: Model; start: CFrame }[] = [];
	private readonly heading: Vector3;
	private readonly camera: Vector3;
	private elapsed = 0;
	public constructor(private readonly plan: CutInPlan, subjects: Model[]) {
		const lead = subjects.find((m) => m.Parent !== undefined);
		const leadFrame = lead?.GetPivot() ?? new CFrame();
		const flat = new Vector3(leadFrame.LookVector.X, 0, leadFrame.LookVector.Z);
		this.heading = flat.Magnitude > 0.01 ? flat.Unit : new Vector3(0, 0, 1);
		const right = this.heading.Cross(new Vector3(0, 1, 0));
		// Stand off on the moon's side so the formation passes in front of it.
		const moon = Lighting.GetMoonDirection();
		const side = right.Dot(moon) >= 0 ? 1 : -1;
		this.camera = leadFrame.Position.add(new Vector3(0, CUT_IN_LIFT - 25, 0)).add(right.mul(-side * 170)).add(this.heading.mul(260));
		for (const subject of subjects) {
			if (subject.Parent === undefined) continue;
			subject.Archivable = true;
			const model = subject.Clone();
			for (const item of model.GetDescendants()) {
				if (item.IsA("BasePart")) { item.LocalTransparencyModifier = 0; item.Anchored = true; item.CanCollide = false; item.CanQuery = false; item.CanTouch = false; }
				else if (item.IsA("BillboardGui")) item.Enabled = false;
			}
			for (const [name] of model.GetAttributes()) model.SetAttribute(name, undefined);
			model.Name = `CutIn ${subject.Name}`;
			const start = new CFrame(subject.GetPivot().Position.add(new Vector3(0, CUT_IN_LIFT, 0))).mul(CFrame.lookAt(Vector3.zero, this.heading).Rotation);
			model.PivotTo(start.add(this.heading.mul(cutInOffset(0))));
			model.Parent = Workspace.CurrentCamera;
			this.copies.push({ model, start });
		}
	}
	/** Advances the flypast and returns the camera frame. */
	public Step(dt: number): CFrame {
		this.elapsed += dt;
		const along = this.heading.mul(cutInOffset(this.elapsed));
		for (const copy of this.copies) copy.model.PivotTo(copy.start.add(along));
		const lead = this.copies[0]?.start.Position.add(along) ?? this.camera.add(this.heading.mul(100));
		return CFrame.lookAt(this.camera, lead.add(new Vector3(0, 8, 0)));
	}
	public Caption(): string | undefined { return cutInCaption(this.plan, this.elapsed); }
	public Skippable(): boolean { return canSkipCutIn(this.elapsed); }
	public Stop(): void {
		for (const copy of this.copies) copy.model.Destroy();
		this.copies.clear();
	}
}
