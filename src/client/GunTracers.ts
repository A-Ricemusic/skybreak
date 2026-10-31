import { Workspace } from "@rbxts/services";
import { GunRules } from "../shared/SortieArmament";

// Cosmetic tracers for the batch D1 player gun. The server owns rounds and hits;
// this only draws a few local neon streaks from the predicted nose while the
// trigger is held, from a small fixed pool so nothing replicates or piles up.
const SPEED = 3000;
const LIFETIME = GunRules.Range / SPEED;
const POOL = 6;
const LENGTH = 14;
const COLOR = Color3.fromRGB(255, 214, 120);
interface Tracer { part: Part; age: number; origin: Vector3; direction: Vector3 }
export class GunTracers {
	private readonly tracers: Tracer[] = [];
	private folder?: Folder;
	private timer = 0;
	private next = 0;
	/** Advance live tracers and spawn one per round interval while `firing`. */
	public Step(dt: number, firing: boolean, frame: CFrame): void {
		if (!firing) this.timer = 0;
		else {
			this.timer += dt;
			// At most one new tracer per frame: a slow frame never bursts the pool.
			if (this.timer >= GunRules.Interval) { this.timer %= GunRules.Interval; this.spawn(frame); }
		}
		for (const tracer of this.tracers) {
			if (tracer.age >= LIFETIME) continue;
			tracer.age += dt;
			if (tracer.age >= LIFETIME) { tracer.part.Transparency = 1; continue; }
			const head = tracer.origin.add(tracer.direction.mul(SPEED * tracer.age));
			tracer.part.CFrame = CFrame.lookAt(head, head.add(tracer.direction));
		}
	}
	public Stop(): void {
		this.folder?.Destroy(); this.folder = undefined;
		this.tracers.clear(); this.timer = 0; this.next = 0;
	}
	private spawn(frame: CFrame): void {
		if (!this.folder) {
			const folder = new Instance("Folder");
			folder.Name = "SkybreakGunTracers";
			folder.Parent = Workspace.CurrentCamera ?? Workspace;
			this.folder = folder;
		}
		if (this.tracers.size() < POOL) {
			const part = new Instance("Part");
			part.Name = "GunTracer";
			part.Anchored = true; part.CanCollide = false; part.CanQuery = false; part.CanTouch = false; part.CastShadow = false;
			part.Material = Enum.Material.Neon; part.Color = COLOR; part.Size = new Vector3(0.35, 0.35, LENGTH);
			part.Parent = this.folder;
			this.tracers.push({ part, age: LIFETIME, origin: Vector3.zero, direction: Vector3.zAxis });
		}
		const tracer = this.tracers[this.next % this.tracers.size()];
		this.next += 1;
		// Alternate the two wing-root muzzles slightly so a burst reads as a stream.
		const side = this.next % 2 === 0 ? 1.5 : -1.5;
		tracer.origin = frame.PointToWorldSpace(new Vector3(side, -0.8, -12));
		tracer.direction = frame.LookVector;
		tracer.age = 0;
		tracer.part.Transparency = 0.15;
		tracer.part.CFrame = CFrame.lookAt(tracer.origin, tracer.origin.add(tracer.direction));
	}
}
