import { Workspace } from "@rbxts/services";
import { FlightMath } from "../shared/FlightMath";

// Enemy jets are pivoted by the server once per Heartbeat (one welded Root
// CFrame each); replication delivers those as discrete, jittery updates. The
// replicated model is hidden locally and a local clone is drawn instead:
//  1. between updates the clone dead-reckons along the jet's nose at its
//     measured speed (capped at EXTRAPOLATE seconds), so it never stalls and
//     then jumps when packets bunch up;
//  2. the result is exponentially smoothed so corrections never pop.
// Direction comes from the replicated orientation (noise free); only the
// scalar speed is estimated from update spacing, heavily smoothed.
const EXTRAPOLATE = 0.12;
const SMOOTH_RATE = 18;
const DEFAULT_SPEED = 300;
const MAX_SPEED = 700;
interface Smoothed {
	model: Model;
	root: BasePart;
	visual: Model;
	visualRoot: BasePart;
	frame: CFrame;
	/** Last distinct replicated root CFrame, when it arrived, and the smoothed speed. */
	last: CFrame;
	arrived: number;
	speed: number;
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
	/** Where the player sees `model` this frame (the smoothed clone), or its replicated pivot if untracked. */
	public GetFrame(model: Model): CFrame {
		return this.tracked.get(model)?.frame ?? model.GetPivot();
	}
	/** Called from the flight RenderStep; cheap when nothing is tracked. Allocation is limited to CFrame math. */
	public Step(dt: number): void {
		const now = os.clock();
		const alpha = FlightMath.DampAlpha(SMOOTH_RATE, dt);
		for (const [model, entry] of this.tracked) {
			// AncestryChanged releases removed models; this only guards a clone destroyed elsewhere.
			if (entry.visualRoot.Parent === undefined) { this.release(model); continue; }
			const replicated = entry.root.CFrame;
			if (replicated.Position !== entry.last.Position) {
				const elapsed = now - entry.arrived;
				if (elapsed > 0.008 && elapsed < 0.5) {
					const measured = math.min(MAX_SPEED, replicated.Position.sub(entry.last.Position).Magnitude / elapsed);
					entry.speed += (measured - entry.speed) * 0.15;
				}
				entry.last = replicated;
				entry.arrived = now;
			}
			const ahead = math.min(now - entry.arrived, EXTRAPOLATE) * entry.speed;
			const target = replicated.add(replicated.LookVector.mul(ahead));
			entry.frame = entry.frame.Lerp(target, alpha);
			entry.visualRoot.CFrame = entry.frame; // welded clone: one write moves every part
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
		const root = model.PrimaryPart;
		if (this.tracked.has(model) || root === undefined) return;
		const hide = (item: Instance) => {
			if (item.IsA("BasePart")) item.LocalTransparencyModifier = 1;
			else if (item.IsA("Trail")) item.Enabled = false;
		};
		const visual = model.Clone();
		visual.Name = `${model.Name}_LocalVisual`;
		for (const item of visual.GetDescendants()) {
			if (item.IsA("BillboardGui")) item.Destroy(); // the warning banner stays on the server model
			// Server models ship with trails off; only this visible clone draws them.
			else if (item.IsA("Trail")) { item.Enabled = true; item.Clear(); }
		}
		const visualRoot = visual.PrimaryPart;
		if (visualRoot === undefined) { visual.Destroy(); return; }
		const frame = root.CFrame;
		visualRoot.CFrame = frame;
		visual.Parent = Workspace;
		for (const item of model.GetDescendants()) hide(item);
		const entry: Smoothed = { model, root, visual, visualRoot, frame, last: frame, arrived: os.clock(), speed: DEFAULT_SPEED, connections: [] };
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
		}
	}
}
