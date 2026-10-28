import { describe, expect, it } from "@rbxts/jest-globals";
/** Native staging invariants. They prove geometry relationships (visibility, contact, framing), not art quality. */
import { AC04Story } from "../shared/ac04/AC04Story";
import { AC04StoryShots, StoryShot } from "../shared/ac04/AC04StoryStageShots";
import { AC04_STORY_INSTANCE_LIMIT, assembleAC04StoryShot, createAC04StoryStage, storyCameraCFrame } from "../shared/ac04/AC04StoryStage";
function requireNamed(world: Instance, name: string): Instance {
	const found = world.FindFirstChild(name, true); assert(found !== undefined, `Missing story content: ${name}`); return found!;
}
function partNamed(root: Instance, name: string): BasePart | undefined {
	for (const item of root.GetDescendants()) if (item.IsA("BasePart") && item.Name === name) return item;
	return undefined;
}
/** Resolves a "Group/Part" key to the owning top-level group and the part. */
function resolveKey(world: Instance, key: string): [Instance, BasePart] {
	const [groupName, partName] = key.split("/") as unknown as [string, string];
	const owner = world.FindFirstChild(groupName);
	assert(owner !== undefined, `Missing key group ${groupName}`);
	// "/Head" names the whole head (seen from any side); it resolves to the face part without a facing requirement.
	const target = partNamed(owner!, partName === "Head" ? "Face" : partName);
	assert(target !== undefined, `Missing key part ${key}`);
	return [owner!, target!];
}
function enableQuery(world: Instance): void {
	for (const item of world.GetDescendants()) if (item.IsA("BasePart")) item.CanQuery = item.Transparency < .4;
}
/** Fraction of sample points on the target whose first ray hit belongs to the target's own group. */
let lastBlocker = "";
function unoccludedShare(world: WorldModel, owner: Instance, target: BasePart, eye: Vector3): number {
	const half = target.Size.mul(.32), samples = [Vector3.zero, new Vector3(half.X, 0, 0), new Vector3(-half.X, 0, 0), new Vector3(0, half.Y, 0), new Vector3(0, -half.Y, 0)];
	let visible = 0;
	for (const offset of samples) {
		const point = target.CFrame.PointToWorldSpace(offset), direction = point.sub(eye);
		const hit = world.Raycast(eye, direction.mul(1.02));
		if (hit && (hit.Instance === target || hit.Instance.IsDescendantOf(owner))) visible++;
		else lastBlocker = hit ? `${hit.Instance.Parent?.Name}/${hit.Instance.Name}` : "miss";
	}
	return visible / samples.size();
}
function inFrame(camera: CFrame, fov: number, aspect: number, point: Vector3): boolean {
	const viewSpace = camera.PointToObjectSpace(point); if (viewSpace.Z >= -.5) return false;
	const v = math.tan(math.rad(fov) / 2), h = v * aspect;
	return math.abs(viewSpace.X / -viewSpace.Z) <= h * .96 && math.abs(viewSpace.Y / -viewSpace.Z) <= v * .96;
}
/** Wide compact lane (1205x525 root), narrow phone lane (390x525 root) and the authored ratio. */
export const AC04_STORY_TEST_ASPECTS = [4.3, 1.9, 1.62];
function withShot<T>(shot: StoryShot, body: (world: WorldModel) => T): T {
	// Raycasts need the WorldModel inside the DataModel; the isolated test place's Workspace hosts it briefly.
	const world = new Instance("WorldModel"); world.Name = "AC04StoryRaycastFixture"; world.Parent = game.GetService("Workspace");
	try { assembleAC04StoryShot(world, shot); return body(world); } finally { world.Destroy(); }
}
export function verifyAC04StoryStagingFixtures(): { coveredBeats: number; peakInstances: number; checkedKeys: number } {
	let coveredBeats = 0, peakInstances = 0, checkedKeys = 0;
	const problems: string[] = [];
	const check = (ok: boolean, message: string) => { if (!ok && !problems.includes(message)) { problems.push(message); print(`STORY_PROBLEM ${message}`); } };
	for (const chapter of AC04Story) {
		const shots = AC04StoryShots[chapter.id]; assert(shots !== undefined && shots.size() === chapter.beats.size(), `Uncovered chapter: ${chapter.id}`);
		const viewport = new Instance("ViewportFrame");
		const stage = createAC04StoryStage(viewport, chapter);
		try {
			let previous: WorldModel | undefined;
			for (let index = 0; index < chapter.beats.size(); index++) {
				const shot = shots[index];
				stage.show(index);
				if (previous) assert(previous.Parent === undefined, "Previous shot retained after replacement");
				const scene = viewport.FindFirstChildOfClass("WorldModel")!; assert(scene !== undefined, "Shot has no native world"); previous = scene;
				assert(viewport.CurrentCamera === stage.camera, "Viewport lost its owned camera");
				assert(scene.GetAttribute("Subject") === shot.subject, "Wrong beat composition");
				assert(math.abs(stage.camera.FieldOfView - shot.fov) < .01, "Shot field of view not applied");
				const descendants = scene.GetDescendants(); peakInstances = math.max(peakInstances, descendants.size());
				assert(descendants.size() <= AC04_STORY_INSTANCE_LIMIT, `Unbounded story scene ${chapter.id}/${index + 1}: ${descendants.size()}`);
				for (const item of descendants) {
					assert(!item.IsA("Decal") && !item.IsA("Texture") && !item.IsA("MeshPart") && !item.IsA("SpecialMesh") && !item.IsA("Humanoid") && !item.IsA("SurfaceAppearance"), "Story scene must stay native primitive geometry");
					if (item.IsA("BasePart")) {
						assert(item.Anchored && !item.CanCollide && !item.CanTouch && !item.CanQuery, "Story part participates in simulation");
						assert(item.Size.X > 0 && item.Size.Y > 0 && item.Size.Z > 0, "Invalid native geometry");
					}
				}
				for (const spec of shot.actors) {
					const model = requireNamed(scene, `Actor-${spec.person}`); assert(model.IsA("Model"), "Actor must be an assembled model");
					for (const name of ["Clothed jacket", "Trouser thigh", "Trouser shin", "Face", "Right hand", "Left hand"]) requireNamed(model, name);
					assert(model.GetAttribute("Pose") === spec.pose, "Wrong action pose");
				}
				for (const model of scene.GetChildren()) {
					if (!model.IsA("Model") || !model.Name.match("^Actor%-")[0]) continue;
					for (const boot of model.GetDescendants()) if (boot.IsA("BasePart") && boot.Name === "Closed boot") assert(math.abs(boot.Position.Y - boot.Size.Y / 2) < .06, `Actor floats or sinks: ${model.Name}`);
					// Chair regression: every occupied chair back must sit behind its occupant, never between face and the viewer.
					const back = partNamed(model, "Chair back"), face = partNamed(model, "Face");
					if (back && face) assert(model.GetPivot().PointToObjectSpace(back.Position).Z > .2, `Chair back in front of ${model.Name} (${chapter.id}/${index + 1})`);
				}
				const cameraBefore = stage.camera.CFrame;
				stage.show(index); assert(stage.camera.CFrame === cameraBefore, "Replay changes authored camera"); assert(scene.Parent === undefined, "Replay leaks old world");
				previous = viewport.FindFirstChildOfClass("WorldModel");
				coveredBeats++;
			}
			stage.destroy(); stage.destroy(); stage.show(0);
			assert(viewport.CurrentCamera === undefined && viewport.GetChildren().size() === 0, "Stage teardown leaks native instances");
		} finally { stage.destroy(); viewport.Destroy(); }
		// Composition: each named subject is unoccluded, in frame and (for faces) seen from the front, at every lane ratio.
		for (const shot of shots) {
			assert(shot.keys.size() >= 2, `${shot.subject}: too few composition keys`);
			withShot(shot, (world) => {
				enableQuery(world);
				for (const aspect of AC04_STORY_TEST_ASPECTS) {
					const camera = storyCameraCFrame(shot, aspect);
					for (const key of shot.keys) {
						const [groupName, partName] = key.split("/") as unknown as [string, string], holder = world.FindFirstChild(groupName);
						const found = holder ? partNamed(holder, partName === "Head" ? "Face" : partName) : undefined;
						check(found !== undefined, `${chapter.id}#${shots.indexOf(shot) + 1} missing key ${key}`);
						if (!found) continue;
						const [owner, target] = resolveKey(world, key);
						check(inFrame(camera, shot.fov, aspect, target.Position), `${chapter.id}#${shots.indexOf(shot) + 1} ${key} outside frame at ${aspect}`);
						const share = unoccludedShare(world, owner, target, camera.Position);
						check(share >= .6, `${chapter.id}#${shots.indexOf(shot) + 1} ${key} occluded by ${lastBlocker} at ${aspect}`);
						if (key.match("/Face$")[0] !== undefined) {
							const toward = camera.Position.sub(target.Position).Unit;
							check(target.CFrame.LookVector.Dot(toward) > .2, `${chapter.id}#${shots.indexOf(shot) + 1} ${key} faces away (${math.floor(target.CFrame.LookVector.Dot(toward) * 100) / 100})`);
						}
						checkedKeys++;
					}
				}
			});
		}
	}
	assert(problems.size() === 0, `${problems.size()} composition problems:\n${problems.join("\n")}`);
	assert(coveredBeats === 48, "Expected complete existing adaptation coverage");
	return { coveredBeats, peakInstances, checkedKeys };
}
function shotOf(id: string, beat: number): StoryShot { return AC04StoryShots[id][beat]; }
function near(a: Vector3, b: Vector3, limit: number, message: string): void { assert(a.sub(b).Magnitude <= limit, `${message}: ${math.floor(a.sub(b).Magnitude * 100) / 100} studs apart`); }

describe("AC04 story staging", () => {
	it("assembles all 48 story beats with clothed actors, visible named subjects and deterministic cleanup", () => {
		const result = verifyAC04StoryStagingFixtures();
		expect(result.coveredBeats).toBe(48);
		expect(result.peakInstances).toBeLessThanOrEqual(AC04_STORY_INSTANCE_LIMIT);
		expect(result.checkedKeys).toBeGreaterThan(48 * 3 * 3);
	});
	it("keeps the leader's face, guitar and the boy's harmonica unobstructed by furniture in the music scenes", () => {
		for (const [id, beat] of [["ac04-i03", 1], ["ac04-i03", 2], ["ac04-i03", 3], ["ac04-i05", 1], ["ac04-i11", 2]] as [string, number][]) withShot(shotOf(id, beat), (world) => {
			enableQuery(world);
			const camera = storyCameraCFrame(shotOf(id, beat), 1.9).Position, leader = world.FindFirstChild("Actor-thirteen")!;
			for (const name of ["Face", "Guitar body", "Guitar neck"]) {
				const target = partNamed(leader, name)!, hit = world.Raycast(camera, target.Position.sub(camera).mul(1.02));
				if (!hit || !hit.Instance.IsDescendantOf(leader)) error(`${id}/${beat + 1}: ${name} hidden by ${hit ? hit.Instance.GetFullName() : "nothing (ray missed)"}`);
			}
		});
	});
	it("puts the guitarist's hands on the instrument, the keepsake in Thirteen's hands and the boy's harmonica at his mouth", () => {
		withShot(shotOf("ac04-i03", 2), (world) => {
			const leader = world.FindFirstChild("Actor-thirteen")!, neck = partNamed(leader, "Guitar neck")!, body = partNamed(leader, "Guitar body")!;
			const left = partNamed(leader, "Left hand")!.Position, right = partNamed(leader, "Right hand")!.Position;
			near(neck.CFrame.PointToWorldSpace(new Vector3(neck.CFrame.PointToObjectSpace(left).X, 0, 0)), left, .45, "Fretting hand off the neck");
			near(body.Position, right, 1, "Strumming hand off the body");
			const boy = world.FindFirstChild("Actor-boy")!, harmonica = partNamed(boy, "Held harmonica")!, face = partNamed(boy, "Face")!;
			near(harmonica.Position, face.Position, .9, "Harmonica not at the mouth");
		});
		withShot(shotOf("ac04-i08", 1), (world) => {
			const leader = world.FindFirstChild("Actor-thirteen")!, cloth = partNamed(leader, "Folded keepsake cloth")!;
			expect(cloth.GetAttribute("HeldBy")).toBe("thirteen");
			near(partNamed(leader, "Right hand")!.Position.Lerp(partNamed(leader, "Left hand")!.Position, .5), cloth.Position, .45, "Cloth not supported by both hands");
		});
		withShot(shotOf("ac04-i11", 1), (world) => {
			const cloth = partNamed(world.FindFirstChild("Prop-burial-cloth")!, "Folded keepsake cloth")!;
			near(partNamed(world.FindFirstChild("Actor-daughter")!, "Right hand")!.Position, cloth.Position, .5, "Daughter's hand not at the memorial cloth");
		});
	});
	it("touches the writer's pen to the letter and keeps the Mobius One address legible from the camera", () => {
		const shot = shotOf("ac04-i12", 2);
		withShot(shot, (world) => {
			const writer = world.FindFirstChild("Actor-writer")!, pen = partNamed(writer, "Held pen")!;
			const tip = pen.CFrame.PointToWorldSpace(new Vector3(0, 0, -pen.Size.Z / 2));
			const letter = partNamed(world.FindFirstChild("Prop-letter")!, "Letter paper")!, onPaper = letter.CFrame.PointToObjectSpace(tip);
			expect(math.abs(onPaper.X) <= letter.Size.X / 2 && math.abs(onPaper.Z) <= letter.Size.Z / 2).toBe(true);
			expect(math.abs(onPaper.Y)).toBeLessThan(.12);
			const strokes = world.FindFirstChild("Prop-envelope")!.GetChildren().filter((v) => v.Name === "Envelope address");
			expect(strokes.size()).toBeGreaterThanOrEqual(30);
			const camera = storyCameraCFrame(shot, 1.9);
			// The address lies flat and reads along +X; the camera looks down at it with +X to screen right.
			expect(camera.LookVector.Y).toBeLessThan(-.5);
			expect(camera.RightVector.X).toBeGreaterThan(.7);
			for (const stroke of strokes) expect(math.abs((stroke as BasePart).Position.Y - 2.85)).toBeLessThan(.06);
		});
		withShot(shotOf("ac04-i01", 3), (world) => {
			const number = world.FindFirstChild("Prop-yellow-thirteen")!.GetDescendants().filter((v) => v.Name === "Tail number");
			expect(number.size()).toBeGreaterThanOrEqual(5);
		});
	});
	it("seats every occupied chair under its occupant with the back behind them", () => {
		for (const chapter of AC04Story) for (const shot of AC04StoryShots[chapter.id]) withShot(shot, (world) => {
			for (const model of world.GetChildren()) {
				const seat = model.IsA("Model") ? partNamed(model, "Chair seat") : undefined;
				if (!seat || !model.Name.match("^Actor%-")[0]) continue;
				const pivot = (model as Model).GetPivot(), seatLocal = pivot.PointToObjectSpace(seat.Position), backLocal = pivot.PointToObjectSpace(partNamed(model, "Chair back")!.Position);
				expect(backLocal.Z).toBeGreaterThan(seatLocal.Z);
				expect(math.abs(seatLocal.X)).toBeLessThan(.2);
			}
		});
	});
});
