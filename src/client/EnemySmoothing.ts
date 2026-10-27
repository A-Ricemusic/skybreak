import { moveRenderedTarget } from "../shared/RenderedTarget";
import { Workspace } from "@rbxts/services";
import { FlightMath } from "../shared/FlightMath";
import { JetFactory } from "../shared/JetFactory";

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
/** A smoothed visual handed over as a wreck: where it was and how fast it was going. */
export interface ClaimedVisual { visual: Model; frame: CFrame; velocity: Vector3 }
// A killed jet's clone outlives its server model briefly, whichever of the
// removal or the CombatEffect event reaches this client first.
const KILLED_GRACE = 1;
const instances = new Set<EnemySmoothing>();
const killed = new Map<Model, ClaimedVisual & { at: number }>();
function claimed(entry: Smoothed): ClaimedVisual {
	return { visual: entry.visual, frame: entry.frame, velocity: entry.frame.LookVector.mul(entry.speed) };
}
export class EnemySmoothing {
	/** Hands `model`'s smoothed clone to the caller (who must destroy it); falls back to the nearest recent kill. */
	public static Claim(model: Model | undefined, position: Vector3): ClaimedVisual | undefined {
		const now = os.clock();
		let best: Model | undefined;
		// Without a model, only a clone close to the blast is plausibly the same jet.
		let bestDistance = model ? 120 : 30;
		for (const [key, entry] of killed) {
			if (now - entry.at > KILLED_GRACE || entry.visual.Parent === undefined) { entry.visual.Destroy(); killed.delete(key); continue; }
			const distance = entry.frame.Position.sub(position).Magnitude;
			if (key === model) { best = key; break; }
			if (distance < bestDistance) { best = key; bestDistance = distance; }
		}
		if (model) for (const smoothing of instances) {
			const entry = smoothing.tracked.get(model);
			if (!entry) continue;
			smoothing.tracked.delete(model);
			for (const connection of entry.connections) connection.Disconnect();
			if (entry.visual.Parent === undefined) { entry.visual.Destroy(); break; }
			return claimed(entry);
		}
		const entry = best && killed.get(best);
		if (!best || !entry) return undefined;
		killed.delete(best);
		return entry;
	}
	private readonly tracked = new Map<Model, Smoothed>();
	private readonly pending = new Map<Model, RBXScriptConnection>();
	private readonly connections: RBXScriptConnection[] = [];
	public Start(folder: Instance): void {
		this.Stop();
		instances.add(this);
		for (const child of folder.GetChildren()) this.consider(child);
		this.connections.push(folder.ChildAdded.Connect((child) => this.consider(child)));
		this.connections.push(folder.ChildRemoved.Connect((child) => {
			if (!child.IsA("Model")) return;
			this.pending.get(child)?.Disconnect();
			this.pending.delete(child);
		}));
	}
	public Stop(): void {
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		for (const [, connection] of this.pending) connection.Disconnect();
		this.pending.clear();
		for (const [model] of this.tracked) this.release(model);
		instances.delete(this);
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
			// PivotTo moves the visible assembly immediately in this render callback;
			// a root-only write waits for the weld solver and leaves the HUD a frame ahead.
			moveRenderedTarget(entry.visual, entry.frame);
		}
	}
	private consider(child: Instance): void {
		if (!child.IsA("Model") || this.tracked.has(child) || this.pending.has(child)) return;
		if (child.GetAttribute("TargetKind") === "air") { this.track(child); return; }
		// Attributes can land a frame after the instance when replication batches split;
		// a model that already has a non-air TargetKind never needs the wait.
		if (child.GetAttribute("TargetKind") !== undefined) return;
		const connection = child.AttributeChanged.Connect(() => {
			const kind = child.GetAttribute("TargetKind");
			if (kind === undefined) return;
			connection.Disconnect();
			this.pending.delete(child);
			if (kind === "air" && child.IsDescendantOf(Workspace)) this.track(child);
		});
		this.pending.set(child, connection);
	}
	private track(model: Model): void {
		const root = model.PrimaryPart;
		if (this.tracked.has(model) || root === undefined) return;
		const hide = (item: Instance) => {
			if (item.IsA("BasePart")) item.LocalTransparencyModifier = 1;
			else if (JetFactory.IsCosmetic(item)) item.Enabled = false;
		};
		const visual = model.Clone();
		visual.Name = `${model.Name}_LocalVisual`;
		for (const item of visual.GetDescendants()) {
			if (item.IsA("BillboardGui")) item.Destroy(); // the warning banner stays on the server model
			// Server models ship with trails, emitters and lights off; only this visible clone draws them.
			else if (JetFactory.IsCosmetic(item)) JetFactory.ShowCosmetic(item);
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
		if (!model.Parent && model.GetAttribute("Health") === 0 && entry.visual.Parent) {
			killed.set(model, { ...claimed(entry), at: os.clock() });
			task.delay(KILLED_GRACE, () => { if (killed.get(model)?.visual === entry.visual) { killed.delete(model); entry.visual.Destroy(); } });
			return;
		}
		entry.visual.Destroy();
		if (!model.Parent) return;
		for (const item of model.GetDescendants()) {
			if (item.IsA("BasePart")) item.LocalTransparencyModifier = 0;
		}
	}
}
