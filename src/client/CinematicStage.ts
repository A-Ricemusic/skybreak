// Cutscene stage construction for RelayCinematic: builds the chapter's scenery (sceneFor), applies the
// mood to Lighting (stageLighting) and adds the cinematic-only post effects (stageEffects). Everything
// here is imperative Instance work with no React; each resource registers its undo with the caller's
// `track` the moment it exists, so a setup that throws halfway leaks nothing. Extracted verbatim from
// RelayCinematic.tsx; the voice-offline harness stubs this module's three stage exports.
import { Lighting, ReplicatedStorage, UserInputService, Workspace } from "@rbxts/services";
import {
	AURORA,
	CINEMATIC_JET,
	CINEMATIC_PARKED_JET,
	CINEMATIC_HANGAR,
	BOARD,
	CHAIR,
	CHART,
	RECORDER,
	Rgb,
	SUBJECT,
	TIN,
	Vec,
	auroraVisible,
	moodLighting,
	orchardBurned,
	recorderOpen,
	sceneTint,
	stageSubject,
	tapesInTin,
} from "../shared/CinematicStaging";
import { StoryChapter } from "../shared/RelayStory";
import { documentFor, documentLine } from "../shared/StoryDocuments";
import {
	BackdropItem,
	CinematicPropAsset,
	GroundMaterial,
	HARBOUR_WATER,
	ORCHARD_SPOTS,
	PROP_ANCHOR,
	RECEIVER,
	RECORDER_LID_OPEN,
	ShotDepth,
	StandInMaterial,
	StandInPart,
	backdropFor,
	dressBackdrop,
	moodGrade,
	stageGround,
	stageHalf,
	standInParts,
	subjectStandInParts,
} from "../shared/CinematicSet";
import { UploadedAssetSpecs } from "../shared/UploadedAssetSpecs";

/** The stage floats far above any mission world; every prop position is relative to it. */
export const ORIGIN = new Vector3(0, 6000, 0);
export const vec = (point: Vec) => new Vector3(point.x, point.y, point.z);
const col = (colour: Rgb) => Color3.fromRGB(colour.r, colour.g, colour.b);
const rgb = (colour: Color3): Rgb => ({ r: colour.R * 255, g: colour.G * 255, b: colour.B * 255 });
/** Seconds a cinematic beat stays on screen: clamp(characters/14, 5, 9). */
export function beatDuration(text: string): number {
	return math.clamp(text.size() / 14, 5, 9);
}
function prop(
	parent: Instance,
	name: string,
	size: Vector3,
	pos: Vector3,
	color: Color3,
	material: Enum.Material = Enum.Material.Metal,
): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.Position = ORIGIN.add(pos);
	part.Color = color;
	part.Material = material;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanTouch = false;
	part.CanQuery = false;
	part.Parent = parent;
	return part;
}
/** Reels spin about local X (procedural cylinders on the receiver's face) or local Y (the uploaded console's flat deck reels). */
export interface Reel {
	part: BasePart;
	base: CFrame;
	axis: "x" | "y";
}
export interface Stage {
	scene: Folder;
	reels: Reel[];
	recorderLight: Part;
	tealStrip: Part;
}
const SUBJECT_Y: Record<string, number> = { RelayTruck: 18, HarborLaunch: 19, CommsRelay: 45 };
function cloneModel(template: Instance | undefined, parent: Instance, name: string, cf: CFrame): boolean {
	if (!template?.IsA("Model")) {
		warn(`SKYBREAK cinematic ${name}: template missing; using stage fallback where available`);
		return false;
	}
	// A clone that cannot be placed is destroyed here, never left behind beside the stand-in that replaces it.
	const model = template.Clone();
	const [placed, problem] = pcall(() => {
		model.Name = name;
		for (const item of model.GetDescendants()) {
			if (item.IsA("BasePart")) {
				item.Anchored = true;
				item.CanCollide = false;
				item.CanTouch = false;
				item.CanQuery = false;
			} else if (item.IsA("Trail") || item.IsA("ParticleEmitter") || item.IsA("Light")) item.Enabled = false;
		}
		model.PivotTo(cf);
		model.Parent = parent;
	});
	if (!placed) {
		model.Destroy();
		warn(
			`SKYBREAK cinematic ${name}: could not be placed (${tostring(problem)}); using stage fallback where available`,
		);
		return false;
	}
	const source = model.GetAttribute("GeometrySource");
	if (source === "Fallback") warn(`SKYBREAK cinematic ${name}: procedural fallback geometry active`);
	return true;
}
function cloneFurniture(
	models: Instance | undefined,
	scene: Folder,
	name: string,
	position: Vector3,
	yaw = 0,
): boolean {
	const template = models?.FindFirstChild(name);
	if (!template?.IsA("Model") || template.GetAttribute("GeometrySource") !== "Blender") {
		warn(`SKYBREAK cinematic ${name}: Blender mesh unavailable; retaining legacy prop`);
		return false;
	}
	const [, size] = template.GetBoundingBox();
	return cloneModel(
		template,
		scene,
		name,
		new CFrame(ORIGIN.add(position).add(new Vector3(0, size.Y / 2, 0))).mul(CFrame.Angles(0, yaw, 0)),
	);
}
/** An uploaded desk prop (dormant until its RobloxAssetIds entry is set), seated so its recorded anchor lands on `target`. */
function seatProp(
	models: Instance | undefined,
	scene: Folder,
	name: CinematicPropAsset,
	target: CFrame,
): Model | undefined {
	const template = models?.FindFirstChild(name);
	if (!template?.IsA("Model") || template.GetAttribute("GeometrySource") !== "Uploaded") return undefined;
	const anchor = UploadedAssetSpecs[name].anchors?.[PROP_ANCHOR[name]] ?? Vector3.zero;
	return cloneModel(template, scene, name, target.mul(new CFrame(anchor.mul(-1))))
		? (scene.FindFirstChild(name) as Model)
		: undefined;
}
/** Approved uploaded scenery around the desk: ground contact at the item's spot (the template's pivot is its bottom centre). */
function placeBackdrop(models: Instance | undefined, scene: Folder, item: BackdropItem): boolean {
	const template = models?.FindFirstChild(`Backdrop${item.asset}`);
	if (!template?.IsA("Model")) return false;
	const model = template.Clone();
	const [placed, problem] = pcall(() => {
		model.Name = item.asset;
		for (const part of model.GetDescendants())
			if (part.IsA("BasePart")) {
				part.Anchored = true;
				part.CanCollide = false;
				part.CanTouch = false;
				part.CanQuery = false;
			}
		if (item.scale !== 1) model.ScaleTo(model.GetScale() * item.scale);
		model.PivotTo(
			new CFrame(
				ORIGIN.add(new Vector3(item.x, -UploadedAssetSpecs[item.asset].groundOffset * item.scale, item.z)),
			).mul(CFrame.Angles(0, item.yaw, 0)),
		);
		model.Parent = scene;
	});
	// Destroyed before its stand-in is built, so a failed placement never leaves a half-placed clone.
	if (!placed) {
		model.Destroy();
		warn(`SKYBREAK cinematic ${item.asset}: could not be placed (${tostring(problem)}); using its stand-in`);
	}
	return placed;
}
const STAND_IN: Record<StandInMaterial, Enum.Material> = {
	Concrete: Enum.Material.Concrete,
	Metal: Enum.Material.Metal,
	Grass: Enum.Material.Grass,
	Slate: Enum.Material.Slate,
	Wood: Enum.Material.Wood,
	Neon: Enum.Material.Neon,
};
/** Part-built boxes in `frame` (a ground contact turned to the item's yaw); neon keeps its own colour, the rest take the mood tint. */
function buildStandIn(scene: Folder, frame: CFrame, parts: StandInPart[], tint: (c: Color3) => Color3): void {
	for (const part of parts) {
		const color = col(part.color);
		const box = prop(
			scene,
			part.name,
			vec(part.size),
			Vector3.zero,
			part.material === "Neon" ? color : tint(color),
			STAND_IN[part.material],
		);
		box.CFrame = frame.mul(new CFrame(vec(part.offset)));
	}
}
/** The stand-in for one backdrop spot, sized from the asset's in-game size. */
function standInBackdrop(scene: Folder, item: BackdropItem, tint: (c: Color3) => Color3): void {
	const spec = UploadedAssetSpecs[item.asset];
	const scale = item.scale;
	const frame = new CFrame(ORIGIN.add(new Vector3(item.x, 0, item.z))).mul(CFrame.Angles(0, item.yaw, 0));
	buildStandIn(
		scene,
		frame,
		standInParts(
			item.asset,
			{ x: spec.size.X * scale, y: spec.size.Y * scale, z: spec.size.Z * scale },
			spec.groundOffset * scale,
		),
		tint,
	);
}
const GROUND: Record<GroundMaterial, Enum.Material> = {
	Concrete: Enum.Material.Concrete,
	Sandstone: Enum.Material.Sandstone,
	Grass: Enum.Material.Grass,
	Ground: Enum.Material.Ground,
	Rock: Enum.Material.Rock,
	Asphalt: Enum.Material.Asphalt,
	Glass: Enum.Material.Glass,
};
const PAPER = Color3.fromRGB(226, 218, 192);
const INK_BROWN = Color3.fromRGB(46, 38, 30);
const STAMP = Color3.fromRGB(172, 42, 36);
/** The chapter's document on the chart's top face: monospace ink on paper, lit flat so the lamp cannot blow it out. */
function dressChart(chart: Part, id: number): void {
	const lines = documentFor(id);
	if (!lines) return;
	const gui = new Instance("SurfaceGui");
	gui.Name = "Document";
	gui.Face = Enum.NormalId.Top;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.FixedSize;
	gui.CanvasSize = new Vector2(380, 520);
	gui.LightInfluence = 0;
	gui.Brightness = 1;
	const paper = new Instance("Frame");
	paper.Name = "Paper";
	paper.Size = UDim2.fromScale(1, 1);
	paper.BackgroundColor3 = PAPER;
	paper.BorderSizePixel = 0;
	paper.Parent = gui;
	const pad = new Instance("UIPadding");
	pad.PaddingTop = new UDim(0, 34);
	pad.PaddingLeft = new UDim(0, 22);
	pad.PaddingRight = new UDim(0, 22);
	pad.Parent = paper;
	const list = new Instance("UIListLayout");
	list.Padding = new UDim(0, 10);
	list.SortOrder = Enum.SortOrder.LayoutOrder;
	list.Parent = paper;
	lines.forEach((raw, index) => {
		const line = documentLine(raw);
		const label = new Instance("TextLabel");
		label.Name = `Line${index + 1}`;
		label.LayoutOrder = index;
		label.Size = new UDim2(1, 0, 0, 62);
		label.BackgroundTransparency = 1;
		label.Font = Enum.Font.RobotoMono;
		label.TextSize = index === 0 ? 24 : 22;
		label.TextXAlignment = Enum.TextXAlignment.Left;
		label.TextColor3 = line.stamp ? STAMP : line.struck ? Color3.fromRGB(128, 116, 98) : INK_BROWN;
		label.RichText = line.struck;
		label.Text = line.struck ? `<s>${line.text}</s>` : line.text;
		label.Parent = paper;
		if (line.stamp) {
			const box = new Instance("UIStroke");
			box.Color = STAMP;
			box.Thickness = 2.5;
			box.Transparency = 0.15;
			box.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
			box.Parent = label;
			label.Rotation = -3;
			label.BackgroundTransparency = 0.92;
			label.BackgroundColor3 = STAMP;
			label.TextXAlignment = Enum.TextXAlignment.Center;
		}
	});
	// A Top-face GUI reads with "up" along the part's +X; a quarter turn points that at the far edge of the desk (checked in-engine: 0 and pi both read sideways, -pi/2 upside down).
	chart.CFrame = chart.CFrame.mul(CFrame.Angles(0, math.pi / 2, 0));
	gui.Parent = chart;
}
/** Teal's handheld recorder from parts: a dented grey box with a grille, a tape window and a red tally lamp (returned). */
function proceduralRecorder(scene: Folder, frame: CFrame, open: boolean): Part {
	const rec = prop(
		scene,
		"Recorder",
		new Vector3(2, 1, 3),
		Vector3.zero,
		Color3.fromRGB(96, 99, 102),
		Enum.Material.DiamondPlate,
	);
	rec.CFrame = frame;
	const detail = (name: string, size: Vector3, offset: Vector3, color: Color3, material: Enum.Material) => {
		const part = prop(scene, name, size, Vector3.zero, color, material);
		part.CFrame = rec.CFrame.mul(new CFrame(offset));
		return part;
	};
	detail(
		"Recorder grille",
		new Vector3(0.9, 0.06, 0.6),
		new Vector3(0.3, 0.53, -0.9),
		Color3.fromRGB(40, 42, 44),
		Enum.Material.Metal,
	);
	detail(
		"Recorder window",
		new Vector3(1.2, 0.06, 0.7),
		new Vector3(0, 0.53, 0.2),
		Color3.fromRGB(150, 160, 150),
		Enum.Material.Glass,
	).Transparency = 0.3;
	detail(
		"Recorder key",
		new Vector3(0.22, 0.16, 0.22),
		new Vector3(-0.6, 0.56, -1.1),
		Color3.fromRGB(200, 200, 196),
		Enum.Material.SmoothPlastic,
	);
	detail(
		"Recorder dent",
		new Vector3(0.7, 0.3, 0.9),
		new Vector3(0.5, 0.4, -0.8),
		Color3.fromRGB(70, 72, 74),
		Enum.Material.Metal,
	);
	if (open) {
		// Recovered from the seat: a second dent in the side, and the lid up on its hinge.
		detail(
			"Recorder dent",
			new Vector3(0.5, 0.6, 0.8),
			new Vector3(-1, -0.1, 0.4),
			Color3.fromRGB(64, 66, 68),
			Enum.Material.Metal,
		);
		const lid = prop(
			scene,
			"Recorder lid",
			new Vector3(2, 0.1, 1.5),
			Vector3.zero,
			Color3.fromRGB(88, 91, 94),
			Enum.Material.DiamondPlate,
		);
		lid.CFrame = rec.CFrame.mul(new CFrame(0, 0.5, -0.55))
			.mul(CFrame.Angles(-1.2, 0, 0))
			.mul(new CFrame(0, 0, -0.75));
	}
	return detail(
		"Recorder light",
		new Vector3(0.3, 0.2, 0.3),
		new Vector3(-0.6, 0.55, 1.1),
		Color3.fromRGB(255, 40, 40),
		Enum.Material.Neon,
	);
}
/** One stage per chapter: the radio desk is always there; the surroundings follow `scene`, props tint to `mood`, and a few props follow the story. */
export function sceneFor(chapter: StoryChapter, track: (undo: () => void) => void): Stage {
	const { scene: kind, mood, id } = chapter;
	const scene = new Instance("Folder");
	scene.Name = "BrokenRelayCinematic";
	track(() => scene.Destroy());
	scene.Parent = Workspace;
	const models = ReplicatedStorage.FindFirstChild("RelayStoryModels");
	const tint = (colour: Color3) => col(sceneTint(rgb(colour), mood));
	const sea = kind === "sea";
	const burned = kind === "farm" && orchardBurned(id);
	// Ground per scene (it was one slate slab everywhere); the sea runs out to the storm fog so the ships float on water.
	const ground = stageGround(kind, burned);
	const half = stageHalf(kind);
	prop(
		scene,
		"Stage",
		new Vector3(half * 2, 4, half * 2),
		new Vector3(0, -2, 0),
		tint(col(ground.color)),
		GROUND[ground.material],
	).Reflectance = ground.reflectance;
	if (kind === "harbor")
		prop(
			scene,
			"Harbour water",
			new Vector3(700, 4, HARBOUR_WATER.z1 - HARBOUR_WATER.z0),
			new Vector3(0, -1.8, (HARBOUR_WATER.z0 + HARBOUR_WATER.z1) / 2),
			tint(Color3.fromRGB(22, 52, 78)),
			Enum.Material.Glass,
		).Reflectance = 0.2;
	if (!cloneFurniture(models, scene, "CinematicDesk", new Vector3(0, 0, 0))) {
		prop(
			scene,
			"Radio desk",
			new Vector3(16, 2, 9),
			new Vector3(0, 4, 0),
			Color3.fromRGB(93, 63, 47),
			Enum.Material.Wood,
		);
		// The desk floated five studs off the floor in the low chair shot; four legs reach the stage.
		for (const [dx, dz] of [
			[-7.4, -4],
			[7.4, -4],
			[-7.4, 4],
			[7.4, 4],
		])
			prop(
				scene,
				"Desk leg",
				new Vector3(0.6, 5, 0.6),
				new Vector3(dx, 0.5, dz),
				Color3.fromRGB(70, 48, 36),
				Enum.Material.Wood,
			);
	}
	const reels: Reel[] = [];
	const receiverAt = ORIGIN.add(vec(RECEIVER));
	const console = seatProp(models, scene, "CinematicRadioConsole", new CFrame(receiverAt));
	let radio: Part;
	if (console) {
		// Uploaded console: its flat deck reels turn, the lamp hangs off an invisible anchor, and the teal strip sits on its window.
		radio = prop(scene, "Teal's receiver", new Vector3(1, 1, 1), vec(RECEIVER), Color3.fromRGB(44, 68, 75));
		radio.Transparency = 1;
		for (const name of ["ReelL", "ReelR"]) {
			const reel = console.FindFirstChild(name);
			if (reel?.IsA("BasePart")) reels.push({ part: reel, base: reel.CFrame, axis: "y" });
		}
		const window = UploadedAssetSpecs.CinematicRadioConsole.anchors?.FrequencyWindow;
		if (window) {
			const strip = prop(
				scene,
				"Frequency window",
				new Vector3(4, 0.6, 0.05),
				Vector3.zero,
				Color3.fromRGB(76, 234, 208),
				Enum.Material.Neon,
			);
			strip.CFrame = console.GetPivot().mul(new CFrame(window.add(new Vector3(0, 0, -0.03))));
		}
	} else {
		radio = prop(scene, "Teal's receiver", new Vector3(7, 4, 3), vec(RECEIVER), Color3.fromRGB(44, 68, 75));
		prop(
			scene,
			"Frequency window",
			new Vector3(4.5, 0.7, 0.2),
			new Vector3(0, 7.6, -1.6),
			Color3.fromRGB(76, 234, 208),
			Enum.Material.Neon,
		);
		// Reels are cylinders (axis along X, turned to face the camera) with a spoke so the spin reads.
		for (const x of [-2.4, 2.4]) {
			const base = new CFrame(ORIGIN.add(new Vector3(x, 6.4, -1.7))).mul(CFrame.Angles(0, math.pi / 2, 0));
			const reel = prop(
				scene,
				"Tape reel",
				new Vector3(0.4, 1.7, 1.7),
				Vector3.zero,
				Color3.fromRGB(197, 178, 132),
			);
			reel.Shape = Enum.PartType.Cylinder;
			reel.CFrame = base;
			const spoke = prop(
				scene,
				"Tape reel",
				new Vector3(0.5, 0.18, 1.4),
				Vector3.zero,
				Color3.fromRGB(70, 58, 40),
			);
			spoke.CFrame = base;
			reels.push({ part: reel, base, axis: "x" }, { part: spoke, base, axis: "x" });
		}
	}
	// The flight chart is a sheet of paper; the chapter's document is printed on it for the evidence shot.
	dressChart(
		prop(
			scene,
			"Flight chart",
			new Vector3(5.2, 0.15, 3.8),
			vec(CHART),
			Color3.fromRGB(196, 188, 160),
			Enum.Material.SmoothPlastic,
		),
		id,
	);
	// The coffee tin of tapes, found under Teal's bunk in chapter 1; one cassette leaves it for every chapter he has spoken in since.
	const tapes = tapesInTin(id);
	if (tapes !== undefined) {
		if (!seatProp(models, scene, "CinematicTapeTin", new CFrame(ORIGIN.add(vec(TIN))))) {
			const tin = prop(scene, "Coffee tin", new Vector3(1.7, 1.8, 1.8), vec(TIN), Color3.fromRGB(118, 46, 34));
			tin.Shape = Enum.PartType.Cylinder;
			tin.CFrame = tin.CFrame.mul(CFrame.Angles(0, 0, math.pi / 2));
		}
		for (let tape = 0; tape < tapes; tape++)
			prop(
				scene,
				"Tape cassette",
				new Vector3(0.2, 1, 0.7),
				vec(TIN).add(new Vector3(-0.42 + (tape % 4) * 0.28, 0.55, -0.36 + math.floor(tape / 4) * 0.36)),
				tape % 3 === 0 ? Color3.fromRGB(58, 54, 50) : Color3.fromRGB(40, 38, 36),
				Enum.Material.SmoothPlastic,
			);
	}
	// Teal's handheld recorder: a dented grey box with a grille, a tape window and a red tally lamp that blinks in recorder shots.
	const open = recorderOpen(id);
	const recorderAt = vec(RECORDER);
	const tilt = CFrame.Angles(0, -0.35, 0.04);
	const recFrame = new CFrame(ORIGIN.add(recorderAt)).mul(tilt);
	const recorder = seatProp(models, scene, "CinematicFieldRecorder", recFrame);
	let recorderLight: Part;
	if (recorder) {
		// Uploaded recorder: the blinking neon sits on its lamp lens; the recovery chapter (CinematicStaging.recorderOpen) swings the cassette door open on its hinge.
		const spec = UploadedAssetSpecs.CinematicFieldRecorder;
		const pivot = recorder.GetPivot();
		const lamp = spec.anchors?.Lamp ?? new Vector3(-0.6, 1, 1.1);
		recorderLight = prop(
			scene,
			"Recorder light",
			new Vector3(0.16, 0.04, 0.16),
			Vector3.zero,
			Color3.fromRGB(255, 40, 40),
			Enum.Material.Neon,
		);
		recorderLight.CFrame = pivot.mul(new CFrame(lamp));
		const lid = recorder.FindFirstChild("Lid");
		const hinge = spec.controlSurfaces?.Lid;
		if (open && lid?.IsA("BasePart") && hinge) {
			// An X-parallel hinge: its X position does not change the swing.
			const at = pivot.mul(new CFrame(hinge.from.add(hinge.to).div(2)));
			const swing = at.mul(CFrame.Angles(RECORDER_LID_OPEN, 0, 0)).mul(at.Inverse());
			lid.CFrame = swing.mul(lid.CFrame);
		}
	} else recorderLight = proceduralRecorder(scene, recFrame, open);
	// Sera's board by the desk: dark slate on a post, three name strips; Teal's is the bright one, and chapter 5 wipes it for a while.
	const boardAt = vec(BOARD);
	if (!seatProp(models, scene, "CinematicStatusBoard", new CFrame(ORIGIN.add(boardAt)))) {
		prop(
			scene,
			"Board post",
			new Vector3(0.3, 8, 0.3),
			new Vector3(boardAt.X, 2, boardAt.Z),
			Color3.fromRGB(52, 54, 58),
		);
		prop(
			scene,
			"Sera's board",
			new Vector3(5, 3.2, 0.25),
			boardAt,
			Color3.fromRGB(30, 50, 46),
			Enum.Material.Slate,
		);
	}
	for (const [dy, name] of [
		[0.9, "Teal strip smear"],
		[0.2, "Name strip"],
		[-0.5, "Name strip"],
	] as [number, string][])
		prop(
			scene,
			name,
			new Vector3(3.4, 0.3, 0.05),
			boardAt.add(new Vector3(0, dy, -0.15)),
			name === "Name strip" ? Color3.fromRGB(200, 196, 180) : Color3.fromRGB(44, 66, 62),
			Enum.Material.SmoothPlastic,
		);
	const tealStrip = prop(
		scene,
		"Teal strip",
		new Vector3(3.4, 0.3, 0.05),
		boardAt.add(new Vector3(0, 0.9, -0.17)),
		Color3.fromRGB(76, 234, 208),
		Enum.Material.Neon,
	);
	const lighting = moodLighting(mood);
	const lamp = new Instance("PointLight");
	lamp.Brightness = lighting.lamp;
	lamp.Range = mood === "night" ? 80 : 60;
	lamp.Color = Color3.fromRGB(255, 218, 171);
	lamp.Parent = radio;
	const subject = stageSubject(kind);
	if (subject) {
		const at = new CFrame(ORIGIN.add(new Vector3(SUBJECT.x, SUBJECT_Y[subject], SUBJECT.z)));
		// The story subject keeps a part-built stand-in (the launch on its sea platform included) if its model is missing.
		if (!cloneModel(models?.FindFirstChild(subject), scene, "Story subject", at))
			buildStandIn(
				scene,
				new CFrame(ORIGIN.add(new Vector3(SUBJECT.x, sea ? 10 : 0, SUBJECT.z))),
				subjectStandInParts(subject),
				tint,
			);
	}
	const jet = models?.FindFirstChild("CinematicKestrel");
	cloneModel(jet, scene, "Kestrel", new CFrame(ORIGIN.add(vec(CINEMATIC_JET))).mul(CFrame.Angles(0, 0.7, 0)));
	// The empty instructor's chair beside the desk, worn leather; the `chair` shot pushes in on it in every scene.
	const leather = Color3.fromRGB(96, 60, 42);
	const chairAt = vec(CHAIR);
	if (!cloneFurniture(models, scene, "CinematicChair", new Vector3(CHAIR.x, 0, CHAIR.z), math.pi)) {
		prop(scene, "Instructor's chair", new Vector3(4, 0.6, 4), chairAt, leather, Enum.Material.Fabric);
		prop(
			scene,
			"Instructor's chair",
			new Vector3(4, 4.2, 0.6),
			chairAt.add(new Vector3(0, 2.4, -1.9)),
			leather,
			Enum.Material.Fabric,
		);
		for (const [dx, dz] of [
			[-1.6, -1.6],
			[1.6, -1.6],
			[-1.6, 1.6],
			[1.6, 1.6],
		])
			prop(
				scene,
				"Chair leg",
				new Vector3(0.3, chairAt.Y + 2, 0.3),
				new Vector3(chairAt.X + dx, (chairAt.Y - 2) / 2 - 0.3, chairAt.Z + dz),
				Color3.fromRGB(52, 54, 58),
			);
	}
	if (kind === "hangar") {
		// Full-size airframes share the approved hangar; the old shell is an observable fallback.
		cloneModel(
			jet,
			scene,
			"Parked jet",
			new CFrame(ORIGIN.add(vec(CINEMATIC_PARKED_JET))).mul(CFrame.Angles(0, 2.3, 0)),
		);
		if (
			!cloneModel(
				models?.FindFirstChild("CinematicHangar"),
				scene,
				"Uploaded hangar",
				new CFrame(ORIGIN.add(vec(CINEMATIC_HANGAR))).mul(CFrame.Angles(0, math.pi, 0)),
			)
		) {
			const wall = tint(Color3.fromRGB(58, 62, 68));
			prop(
				scene,
				"Hangar wall",
				new Vector3(520, 120, 6),
				new Vector3(0, 58, -230),
				wall,
				Enum.Material.Concrete,
			);
			for (const x of [-260, 260])
				prop(
					scene,
					"Hangar wall",
					new Vector3(6, 120, 460),
					new Vector3(x, 58, 0),
					wall,
					Enum.Material.Concrete,
				);
			prop(scene, "Hangar beam", new Vector3(520, 4, 4), new Vector3(0, 118, -120), Color3.fromRGB(40, 42, 46));
			// Two work lights on the beam so the night hangar is a room, not a lamp pool in a void.
			for (const x of [-110, 110]) {
				const lampStrip = prop(
					scene,
					"Hangar lamp",
					new Vector3(14, 0.6, 1.2),
					new Vector3(x, 115.6, -120),
					Color3.fromRGB(255, 236, 200),
					Enum.Material.Neon,
				);
				const light = new Instance("PointLight");
				light.Brightness = 1.2;
				light.Range = 170;
				light.Color = Color3.fromRGB(255, 228, 190);
				light.Parent = lampStrip;
			}
		}
	}
	if (sea)
		prop(
			scene,
			"Sea platform",
			new Vector3(70, 12, 70),
			new Vector3(SUBJECT.x, 4, SUBJECT.z),
			tint(Color3.fromRGB(70, 76, 82)),
			Enum.Material.Concrete,
		);
	// Approved uploaded scenery around the desk; every spot whose model has not replicated, or fails to place, gets its own part-built stand-in.
	const dressed = dressBackdrop(
		backdropFor(kind, id, burned),
		(item) => placeBackdrop(models, scene, item),
		(item) => standInBackdrop(scene, item, tint),
	);
	if (dressed.standIns.size() > 0)
		warn(
			`SKYBREAK cinematic ${kind}: ${dressed.standIns.size()} of ${dressed.standIns.size() + dressed.uploaded.size()} scenery models unavailable; using part-built stand-ins for them`,
		);
	if (auroraVisible(kind, mood))
		for (const ribbon of AURORA) {
			const band = prop(
				scene,
				"Aurora",
				vec(ribbon.size),
				vec(ribbon.pos),
				col(ribbon.color),
				Enum.Material.Neon,
			);
			band.CFrame = band.CFrame.mul(CFrame.Angles(0, ribbon.yaw, 0.06));
			band.Transparency = ribbon.transparency;
			band.CastShadow = false;
		}
	// Burned orchard (CinematicStaging.orchardBurned): charred stumps with a few embers where the trees stood, no smoke particles (phones).
	if (burned)
		for (let index = 0; index < ORCHARD_SPOTS.size(); index++) {
			const spot = ORCHARD_SPOTS[index];
			// Preserve the original one-based orchard height/ember pattern.
			const i = index + 1;
			prop(
				scene,
				"Charred tree",
				new Vector3(3, 5 + (i % 3) * 2, 3),
				new Vector3(spot.x, 2.5 + (i % 3), spot.z),
				tint(Color3.fromRGB(30, 26, 24)),
				Enum.Material.Slate,
			);
			if (i % 2 === 0)
				prop(
					scene,
					"Ember",
					new Vector3(1.2, 0.4, 1.2),
					new Vector3(spot.x + 2.5, 0.2, spot.z - 1.5),
					Color3.fromRGB(255, 110, 40),
					Enum.Material.Neon,
				);
		}
	return { scene, reels, recorderLight, tealStrip };
}
type LightingKeys =
	| "ClockTime"
	| "Brightness"
	| "Ambient"
	| "OutdoorAmbient"
	| "FogColor"
	| "FogEnd"
	| "FogStart"
	| "ExposureCompensation";
const LIGHTING_KEYS: LightingKeys[] = [
	"ClockTime",
	"Brightness",
	"Ambient",
	"OutdoorAmbient",
	"FogColor",
	"FogEnd",
	"FogStart",
	"ExposureCompensation",
];
/**
 * Applies the mood to Lighting, registering every restore with `track` as it goes. The server
 * rewrites Lighting whenever it rebuilds a world (the finale cinematic starts
 * at the same moment the menu world comes back), so each property is watched:
 * a value we did not set becomes the new restore target and the mood is
 * re-applied. The Fog* properties are inert while an Atmosphere exists, so the
 * world's Atmosphere is thickened locally too, and a local cloud deck gives the
 * storm its grey sky (client changes do not replicate).
 */
export function stageLighting(mood: StoryChapter["mood"], track: (undo: () => void) => void): void {
	type Bag = Record<LightingKeys, unknown>;
	const live = Lighting as unknown as Bag;
	const saved: Partial<Bag> = {};
	const mine: Partial<Bag> = {};
	const look = moodLighting(mood);
	const wanted: Bag = {
		ClockTime: look.clockTime,
		Brightness: look.brightness,
		ExposureCompensation: look.exposure,
		Ambient: col(look.ambient),
		OutdoorAmbient: col(look.outdoorAmbient),
		FogColor: col(look.fogColor),
		FogStart: look.fogStart,
		FogEnd: look.fogEnd,
	};
	const apply = (key: LightingKeys) => {
		mine[key] = wanted[key];
		live[key] = wanted[key];
	};
	// Each key's restore is registered before it changes, and its watcher's disconnect after it connects,
	// so teardown (newest first) stops a watcher before putting its key back.
	for (const key of LIGHTING_KEYS) {
		saved[key] = live[key];
		track(() => {
			live[key] = saved[key];
		});
		apply(key);
		const watcher = Lighting.GetPropertyChangedSignal(key).Connect(() => {
			if (live[key] !== mine[key]) {
				saved[key] = live[key];
				apply(key);
			}
		});
		track(() => watcher.Disconnect());
	}
	const atmosphere = Lighting.FindFirstChildOfClass("Atmosphere");
	if (atmosphere) {
		const atmo = { density: atmosphere.Density, haze: atmosphere.Haze, color: atmosphere.Color };
		track(() => {
			if (atmosphere.Parent) {
				atmosphere.Density = atmo.density;
				atmosphere.Haze = atmo.haze;
				atmosphere.Color = atmo.color;
			}
		});
		atmosphere.Density = look.density;
		atmosphere.Haze = look.haze;
		atmosphere.Color = col(look.fogColor);
	}
	const existing = Workspace.Terrain.FindFirstChildOfClass("Clouds");
	const clouds = existing ?? new Instance("Clouds");
	if (existing) {
		const before = { cover: clouds.Cover, density: clouds.Density, color: clouds.Color, enabled: clouds.Enabled };
		track(() => {
			clouds.Cover = before.cover;
			clouds.Density = before.density;
			clouds.Color = before.color;
			clouds.Enabled = before.enabled;
		});
	} else track(() => clouds.Destroy());
	// A night deck hid the stars and the aurora entirely, so night runs with the layer off.
	// Phones keep the project's cloud budget (MobileGraphics only trims decks added later).
	const touch = UserInputService.TouchEnabled;
	clouds.Cover = touch ? math.min(look.clouds.cover, 0.3) : look.clouds.cover;
	clouds.Density = touch ? math.min(look.clouds.density, 0.3) : look.clouds.density;
	clouds.Color = col(look.clouds.color);
	clouds.Enabled = look.clouds.cover > 0;
	if (!existing) clouds.Parent = Workspace.Terrain;
}
/**
 * Cinematic-only post-processing, created locally and destroyed on unmount: a mood grade stacked on
 * the world's own, soft sun rays at dawn and dusk (only when the world has none), and a depth of
 * field that follows the shot. Phones keep their budget: MobileGraphics disables sun rays and depth
 * of field as they are added, and only their settings (never Enabled) change per frame.
 */
export function stageEffects(
	mood: StoryChapter["mood"],
	track: (undo: () => void) => void,
): { depth: (depth: ShotDepth) => void } {
	const grading = moodGrade(mood);
	const effect = <T extends "ColorCorrectionEffect" | "SunRaysEffect" | "DepthOfFieldEffect">(
		kind: T,
		name: string,
	) => {
		const instance = new Instance(kind);
		track(() => instance.Destroy());
		instance.Name = name;
		return instance;
	};
	const grade = effect("ColorCorrectionEffect", "CinematicGrade");
	grade.TintColor = col(grading.tint);
	grade.Saturation = grading.saturation;
	grade.Contrast = grading.contrast;
	grade.Brightness = grading.brightness;
	grade.Parent = Lighting;
	if (grading.sunRays && !Lighting.FindFirstChildWhichIsA("SunRaysEffect")) {
		const rays = effect("SunRaysEffect", "CinematicSunRays");
		rays.Intensity = grading.sunRays.intensity;
		rays.Spread = grading.sunRays.spread;
		rays.Parent = Lighting;
	}
	const dof = effect("DepthOfFieldEffect", "CinematicDepth");
	dof.FarIntensity = 0;
	dof.NearIntensity = 0;
	dof.Parent = Lighting;
	return {
		depth: (depth) => {
			dof.FocusDistance = depth.focusDistance;
			dof.InFocusRadius = depth.inFocusRadius;
			dof.FarIntensity = depth.farIntensity;
			dof.NearIntensity = depth.nearIntensity;
		},
	};
}
