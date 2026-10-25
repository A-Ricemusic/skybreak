import { Workspace } from "@rbxts/services";
import { FlightMath } from "../shared/FlightMath";

// Enemy jets are anchored and pivoted by the server at 30 Hz; replication
// delivers those pivots as discrete property updates with no interpolation, so
// on a phone they visibly skip. Mirror the player's own smoothing: hide the
// replicated model locally and lerp a local clone toward its pivot each frame.
interface Smoothed {
	model: Model;
	visual: Model;
	frame: CFrame;
	connections: RBXScriptConnection[];
}
export class EnemySmoothing {
	private readonly tracked = new Map<Model, Smoothed>();
	private readonly pending = new Map<Model, RBXScriptConnection>();
	private readonly connections: RBXScriptConnection[] = [];
	public Start(folder: Instance): void {
		this.Stop();
		for (const child of folder.GetChildren()) this.consider(child);
		this.connections.push(folder.ChildAdded.Connect((child) => this.consider(child)));
	}
	public Stop(): void {
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		for (const [, connection] of this.pending) connection.Disconnect();
		this.pending.clear();
		for (const [model] of this.tracked) this.release(model);
	}
	/** Called from the flight RenderStep; cheap when nothing is tracked. */
	public Step(dt: number): void {
		const alpha = FlightMath.DampAlpha(14, dt);
		for (const [model, entry] of this.tracked) {
			if (!model.IsDescendantOf(Workspace) || !entry.visual.Parent) { this.release(model); continue; }
			entry.frame = entry.frame.Lerp(model.GetPivot(), alpha);
			entry.visual.PivotTo(entry.frame);
		}
	}
	private consider(child: Instance): void {
		if (!child.IsA("Model") || this.tracked.has(child) || this.pending.has(child)) return;
		if (child.GetAttribute("TargetKind") === "air") { this.track(child); return; }
		// Attributes can land a frame after the instance when replication batches split.
		const connection = child.AttributeChanged.Connect(() => {
			if (child.GetAttribute("TargetKind") !== "air") return;
			connection.Disconnect();
			this.pending.delete(child);
			if (child.IsDescendantOf(Workspace)) this.track(child);
		});
		this.pending.set(child, connection);
	}
	private track(model: Model): void {
		if (this.tracked.has(model) || model.PrimaryPart === undefined) return;
		const hidden: BasePart[] = [];
		const hide = (item: Instance) => {
			if (item.IsA("BasePart")) { item.LocalTransparencyModifier = 1; hidden.push(item); }
			else if (item.IsA("Trail")) item.Enabled = false;
		};
		const visual = model.Clone();
		visual.Name = `${model.Name}_LocalVisual`;
		for (const item of visual.GetDescendants()) {
			if (item.IsA("BillboardGui")) item.Destroy(); // the warning banner stays on the server model
			else if (item.IsA("Trail")) item.Clear();
		}
		visual.PivotTo(model.GetPivot());
		visual.Parent = Workspace;
		for (const item of model.GetDescendants()) hide(item);
		const entry: Smoothed = { model, visual, frame: model.GetPivot(), connections: [] };
		entry.connections.push(model.DescendantAdded.Connect(hide));
		entry.connections.push(model.AncestryChanged.Connect(() => { if (!model.IsDescendantOf(Workspace)) this.release(model); }));
		this.tracked.set(model, entry);
	}
	private release(model: Model): void {
		const entry = this.tracked.get(model);
		if (!entry) return;
		this.tracked.delete(model);
		for (const connection of entry.connections) connection.Disconnect();
		entry.visual.Destroy();
		if (!model.Parent) return;
		for (const item of model.GetDescendants()) {
			if (item.IsA("BasePart")) item.LocalTransparencyModifier = 0;
			else if (item.IsA("Trail")) item.Enabled = true;
		}
	}
}
