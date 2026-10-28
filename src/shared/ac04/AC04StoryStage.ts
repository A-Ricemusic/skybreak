import { AC04StoryChapter } from "./AC04Story";
import { AC04StoryShots, StoryActor, StoryLight, StoryProp, StoryShot } from "./AC04StoryStageShots";
import {
	V, vector, part, ball, cylinder, line, group, glyphs, house, facades, chair, stageTable, paper, jet, ladder, highway, birch, figure, car, lamp, gull,
	PAPER, INK, GOLD, BLUE, YELLOW, STONE, CONCRETE, GRASS,
} from "./AC04StoryStageGeometry";
const FACE = Color3.fromRGB(183,156,123), BOOT = Color3.fromRGB(42,38,35), WOOD = Color3.fromRGB(110,80,58);
export const AC04_STORY_INSTANCE_LIMIT = 900;
/** Head/torso proportions in unscaled actor space (adult standing): hip 2.8, shoulder 4.45, head centre 5.3. */
const ARM = 2.0, TABLE_TOP = 2.8;
interface Look { coat: Color3; legs: Color3; hair: Color3; style: "short" | "mop" | "bob" | "long" | "bald" | "flatcap" | "helmet" | "forage" | "cap"; scale: number; width: number; }
const COATS: Record<string, Look> = {
	boy: { coat: Color3.fromRGB(116,78,54), legs: Color3.fromRGB(56,62,74), hair: Color3.fromRGB(92,60,38), style: "mop", scale: .74, width: 1.6 },
	thirteen: { coat: Color3.fromRGB(80,92,72), legs: Color3.fromRGB(58,64,56), hair: Color3.fromRGB(176,176,172), style: "short", scale: 1, width: 1.75 },
	four: { coat: Color3.fromRGB(92,100,96), legs: Color3.fromRGB(62,68,66), hair: Color3.fromRGB(38,30,28), style: "long", scale: .96, width: 1.6 },
	pilot: { coat: Color3.fromRGB(104,72,52), legs: Color3.fromRGB(60,62,58), hair: Color3.fromRGB(70,52,38), style: "short", scale: 1, width: 1.75 },
	recruit: { coat: Color3.fromRGB(126,134,120), legs: Color3.fromRGB(80,86,78), hair: Color3.fromRGB(110,84,56), style: "forage", scale: 1, width: 1.7 },
	mechanic: { coat: Color3.fromRGB(68,86,106), legs: Color3.fromRGB(68,86,106), hair: Color3.fromRGB(60,48,40), style: "cap", scale: 1, width: 1.75 },
	daughter: { coat: Color3.fromRGB(140,74,62), legs: Color3.fromRGB(64,50,58), hair: Color3.fromRGB(214,184,118), style: "bob", scale: .93, width: 1.55 },
	barkeeper: { coat: Color3.fromRGB(176,168,150), legs: Color3.fromRGB(54,50,48), hair: Color3.fromRGB(120,112,104), style: "bald", scale: 1.02, width: 2.1 },
	uncle: { coat: Color3.fromRGB(108,92,76), legs: Color3.fromRGB(64,58,52), hair: Color3.fromRGB(150,146,140), style: "flatcap", scale: 1, width: 1.75 },
	soldier: { coat: Color3.fromRGB(90,94,72), legs: Color3.fromRGB(72,74,58), hair: Color3.fromRGB(70,76,60), style: "helmet", scale: 1, width: 1.8 },
	writer: { coat: Color3.fromRGB(84,98,112), legs: Color3.fromRGB(52,54,60), hair: Color3.fromRGB(96,66,44), style: "short", scale: 1, width: 1.75 },
	citizen: { coat: Color3.fromRGB(120,110,96), legs: Color3.fromRGB(56,54,52), hair: Color3.fromRGB(80,64,48), style: "short", scale: 1, width: 1.7 },
};
type Vec = Vector3;
function v3(x: number, y: number, z: number): Vec { return new Vector3(x, y, z); }
function at(p: Instance, n: string, size: V, pos: Vec, c: Color3, m: Enum.Material = Enum.Material.SmoothPlastic): Part { return part(p, n, size, [pos.X, pos.Y, pos.Z], c, m); }
function seg(p: Instance, n: string, a: Vec, b: Vec, w: number, c: Color3): Part { return line(p, n, [a.X, a.Y, a.Z], [b.X, b.Y, b.Z], w, c); }
/** Two-bone arm reaching toward a target; the elbow bends down and outward so sleeves read as one limb. */
function arm(m: Instance, side: number, shoulder: Vec, target: Vec, coat: Color3, name: string): Part {
	let delta = target.sub(shoulder);
	if (delta.Magnitude > ARM * .98) delta = delta.Unit.mul(ARM * .98);
	const hand = shoulder.add(delta), mid = shoulder.add(hand).mul(.5), d = delta.Magnitude;
	let bend = v3(side * .45, -1, .2).sub(delta.Unit.mul(v3(side * .45, -1, .2).Dot(delta.Unit)));
	bend = bend.Magnitude > .01 ? bend.Unit : v3(side, 0, 0);
	const elbow = mid.add(bend.mul(math.sqrt(math.max(0, (ARM / 2) ** 2 - (d / 2) ** 2))));
	seg(m, "Jacket sleeve", shoulder, elbow, .56, coat); seg(m, "Jacket cuff", elbow, hand, .48, coat);
	return at(m, name, [.4, .4, .4], hand, FACE);
}
/** Original clothed figures assembled from primitive parts; no body meshes, skin textures, Humanoids or physics. */
function actor(parent: Instance, spec: StoryActor, eye: Vector3): Model {
	const look = COATS[spec.person], m = group(parent, `Actor-${spec.person}`);
	m.SetAttribute("Pose", spec.pose); m.SetAttribute("Mood", spec.mood ?? "neutral");
	const held = spec.holds ?? [], has = (h: string) => held.includes(h as never);
	const seated = spec.seated === true || spec.pose === "write" || spec.pose === "rest", kneel = spec.pose === "kneel";
	const scale = look.scale;
	const origin = vector(spec.at), towardFlat = new Vector3(spec.toward[0], origin.Y, spec.toward[2]);
	const cheat = spec.cheat ?? .3, flatEye = new Vector3(eye.X, origin.Y, eye.Z);
	let facing = towardFlat.sub(origin).Magnitude > .01 ? towardFlat.sub(origin).Unit : v3(0, 0, -1);
	if (cheat > 0 && flatEye.sub(origin).Magnitude > .01) facing = facing.Lerp(flatEye.sub(origin).Unit, cheat).Unit;
	const body = CFrame.lookAt(origin, origin.add(facing));
	const toLocal = (w: V) => body.PointToObjectSpace(vector(w)).div(scale);
	const hip = seated ? 1.7 : kneel ? 1.6 : 2.8, sh = hip + 1.65, headY = sh + .85, w = look.width;
	// Torso (the upper body may lean about the hip so hands can reach low targets) and legs.
	const u = group(m, "Upper body");
	at(u, "Clothed jacket", [w, 1.85, .86], v3(0, hip + .85, 0), look.coat);
	at(u, "Collar", [.8, .22, .9], v3(0, sh + .14, 0), spec.person === "thirteen" ? Color3.fromRGB(206,196,176) : PAPER);
	at(u, "Clothed waistband", [w, .26, .9], v3(0, hip - .02, 0), INK);
	if (spec.person === "barkeeper") { at(u, "Full apron over clothes", [1.7, 2.1, .1], v3(0, hip + .3, -.5), PAPER); at(u, "Waistcoat", [w + .02, 1.1, .7], v3(0, hip + 1.15, -.1), Color3.fromRGB(70,52,44)); }
	if (spec.person === "writer") at(m, "Overcoat skirt", [w, 1.3, .9], v3(0, hip - .55, 0), look.coat);
	if (spec.person === "mechanic") at(u, "Coverall pocket", [.6, .5, .05], v3(.4, hip + 1.1, -.45), Color3.fromRGB(52,68,86));
	const flying = spec.person === "thirteen" || spec.person === "four" || spec.person === "pilot" || spec.person === "recruit";
	if (flying) {
		at(u, "Flight jacket zip", [.08, 1.6, .04], v3(0, hip + .85, -.45), Color3.fromRGB(180,176,160));
		at(u, "Yellow shoulder patch", [.12, .5, .5], v3(w / 2 + .03, sh - .35, 0), spec.person === "recruit" ? Color3.fromRGB(150,150,140) : YELLOW);
		at(u, "Flight harness", [.17, 1.55, .06], v3(.42, hip + .85, -.46), PAPER);
	}
	if (spec.person === "thirteen") at(u, "Leader scarf", [.95, .5, .16], v3(0, sh - .1, -.48), YELLOW);
	if (spec.person === "four") at(u, "Wingman neck scarf", [.9, .4, .16], v3(0, sh, -.48), Color3.fromRGB(176,182,180));
	if (spec.person === "soldier") { at(u, "Greatcoat belt", [w + .02, .22, .9], v3(0, hip + .45, 0), Color3.fromRGB(52,40,30)); at(m, "Greatcoat skirt", [w, 1.1, .95], v3(0, hip - .45, 0), look.coat); }
	const leg = (x: number, knee: Vec, ankle: Vec, boot = "Closed boot") => {
		seg(m, "Trouser thigh", v3(x, hip, 0), knee, .72, look.legs); seg(m, "Trouser shin", knee, ankle, .64, look.legs);
		at(m, boot, [.75, .5, 1.05], v3(x, ankle.Y - .1, ankle.Z - .2), BOOT);
	};
	for (const x of [-.45, .45]) {
		if (seated) leg(x, v3(x, hip - .05, -1.15), v3(x, .35, -1.2));
		else if (kneel) x < 0 ? leg(x, v3(x, 1.1, -1), v3(x, .35, -1.05)) : leg(x, v3(x, .35, -.4), v3(x, .35, .7));
		else if (spec.pose === "leave") x < 0 ? leg(x, v3(x, 1.5, -.4), v3(x, .35, -.65)) : leg(x, v3(x, 1.5, .2), v3(x, .35, .55));
		else if (spec.pose === "climb" && x > 0) leg(x, v3(x, 2.25, -.7), v3(x, 1.35, -1.05), "Closed boot on rung");
		else leg(x, v3(x, 1.45, -.05), v3(x, .35, 0));
	}
	if (spec.person === "daughter") {
		if (seated) { at(m, "Long skirt", [1.65, .5, 1.35], v3(0, hip + .05, -.55), look.legs); at(m, "Long skirt drape", [1.65, 1.1, .2], v3(0, hip - .55, -1.2), look.legs); }
		else if (kneel) at(m, "Long skirt", [1.75, 1.3, 1.6], v3(0, hip - .45, -.2), look.legs);
		else at(m, "Long skirt", [1.7, 2.05, 1.05], v3(0, hip - .75, 0), look.legs);
		at(u, "Cardigan front", [.5, 1.5, .05], v3(0, hip + .9, -.45), Color3.fromRGB(200,184,160));
	}
	// Head: face, simple features and hair. Built around the neck pivot and turned toward the gaze target.
	const head = group(m, "Head"), hy = headY, mood = spec.mood ?? "neutral";
	ball(head, "Face", [1.12, 1.26, 1.04], [0, hy, 0], FACE);
	part(head, "Nose", [.16, .24, .14], [0, hy - .05, -.53], Color3.fromRGB(166,138,108));
	for (const x of [-.23, .23]) {
		part(head, "Eye", [.12, mood === "open" ? .14 : .1, .05], [x, hy + .06, -.5], INK);
		const brow = mood === "stern" ? x * .9 : mood === "sad" ? -x * .9 : 0;
		part(head, "Brow", [.26, .06, .05], [x, hy + .23, -.49], spec.person === "thirteen" ? Color3.fromRGB(120,118,114) : look.hair, Enum.Material.SmoothPlastic, [0, 0, brow]);
	}
	if (mood === "open") part(head, "Mouth", [.22, .16, .05], [0, hy - .31, -.48], Color3.fromRGB(76,40,36));
	else {
		part(head, "Mouth", [.3, .06, .05], [0, hy - .3, -.49], Color3.fromRGB(110,58,50));
		if (mood === "smile" || mood === "sad") for (const x of [-.17, .17]) part(head, "Mouth corner", [.08, .06, .05], [x, hy - .3 + (mood === "smile" ? .04 : -.05), -.48], Color3.fromRGB(110,58,50));
	}
	const hairC = look.hair, st = look.style;
	if (st !== "bald" && st !== "helmet") { ball(head, "Hair", [1.22, .82, 1.14], [0, hy + .36, .1], hairC); ball(head, "Hair back", [1.1, .95, .5], [0, hy + .05, .34], hairC); }
	if (st === "mop" || st === "bob" || st === "long") ball(head, "Hair fringe", [1, .26, .3], [0, hy + .4, -.38], hairC);
	if (st === "bob" || st === "long") for (const x of [-.55, .55]) ball(head, "Hair side", [.3, .9, .78], [x, hy + .02, .1], hairC);
	if (st === "long") part(head, "Long hair", [.95, 1.45, .26], [0, hy - .42, .46], hairC);
	if (st === "bald") { part(head, "Hair rim", [1.16, .3, .5], [0, hy + .05, .35], hairC); part(head, "Moustache", [.55, .12, .08], [0, hy - .2, -.53], hairC); }
	if (st === "flatcap") { part(head, "Flat cap", [1.3, .3, 1.3], [0, hy + .62, -.05], Color3.fromRGB(74,64,54)); part(head, "Cap brim", [1.1, .08, .5], [0, hy + .5, -.66], Color3.fromRGB(74,64,54)); part(head, "Moustache", [.5, .1, .08], [0, hy - .19, -.53], hairC); }
	if (st === "helmet") { ball(head, "Steel helmet", [1.36, .92, 1.36], [0, hy + .4, 0], hairC); part(head, "Helmet rim", [1.5, .08, 1.5], [0, hy + .18, 0], hairC); }
	if (st === "forage") part(head, "Forage cap", [.6, .35, 1.2], [0, hy + .78, 0], Color3.fromRGB(70,80,66));
	if (st === "cap") { part(head, "Work cap", [1.24, .3, 1.2], [0, hy + .62, 0], look.coat); part(head, "Cap brim", [1, .07, .45], [0, hy + .5, -.66], look.coat); }
	if (spec.person === "writer") {
		for (const x of [-.23, .23]) { const lens = part(head, "Glasses lens", [.28, .2, .02], [x, hy + .06, -.55], Color3.fromRGB(200,220,230), Enum.Material.Glass); lens.Transparency = .65; part(head, "Glasses rim", [.3, .035, .03], [x, hy + .17, -.55], INK); part(head, "Glasses rim", [.3, .03, .03], [x, hy - .05, -.55], INK); }
		part(head, "Glasses bridge", [.18, .035, .03], [0, hy + .12, -.55], INK);
	}
	if (has("headphones")) { for (const x of [-.62, .62]) cylinder(head, "Headphones", .18, .5, [x, hy, 0], INK); part(head, "Headphone band", [1.3, .12, .2], [0, hy + .68, 0], INK); }
	if (has("schoolbag")) { at(u, "School satchel", [1.1, 1.2, .5], v3(0, hip + 1.0, .68), Color3.fromRGB(122,90,54)); for (const x of [-.45, .45]) seg(u, "Satchel strap", v3(x, sh + .1, .3), v3(x, hip + .5, .55), .12, Color3.fromRGB(80,58,36)); }
	if (has("satchel")) { at(u, "Shoulder satchel", [.8, .65, .32], v3(-w / 2 - .2, hip + .05, -.1), Color3.fromRGB(96,72,46)); seg(u, "Satchel strap", v3(w / 2, sh + .1, -.42), v3(-w / 2 - .2, hip + .4, -.42), .1, Color3.fromRGB(70,52,34)); }
	if (has("rifle")) { seg(u, "Slung rifle", v3(.7, hip - .3, .55), v3(-.6, sh + .95, .55), .2, Color3.fromRGB(60,46,32)); seg(u, "Rifle sling", v3(.6, sh + .1, -.44), v3(-.6, hip + .1, -.44), .07, Color3.fromRGB(52,40,30)); }
	if (has("sling")) { at(u, "Arm sling", [1, .55, .12], v3(-.2, sh - .82, -.55), PAPER); seg(u, "Sling strap", v3(-.6, sh - .7, -.5), v3(.5, sh + .1, -.45), .1, PAPER); }
	// Arms and held items.
	const shoulderR = v3(w / 2 + .05, sh, 0), shoulderL = v3(-w / 2 - .05, sh, 0);
	let right: Vec, left: Vec;
	const guitarFrame = new CFrame(.15, hip + .55, -.95).mul(CFrame.Angles(0, 0, -.45));
	switch (spec.pose) {
		case "listen": right = v3(.28, hip + .4, -.6); left = v3(-.28, hip + .4, -.6); break;
		case "sit": right = v3(.5, hip + .32, -.8); left = v3(-.5, hip + .32, -.8); break;
		case "rest": right = v3(.5, TABLE_TOP + .16, -1.35); left = v3(-.55, TABLE_TOP + .16, -1.3); break;
		case "write": right = v3(.38, TABLE_TOP + .18, -1.3); left = v3(-.55, TABLE_TOP + .14, -1.2); break;
		case "offer": right = v3(.38, sh - .45, -1.05); left = v3(-.38, sh - .45, -1.05); break;
		case "hold": right = v3(.24, sh - .75, -.72); left = v3(-.24, sh - .75, -.72); break;
		case "point": right = v3(.6, sh - .2, -1.6); left = v3(-1.02, hip + .15, -.1); break;
		case "guard": right = v3(1.35, hip + 1, -.4); left = v3(-1.35, hip + 1, -.4); break;
		case "leave": right = v3(.95, hip + .25, .35); left = v3(-.95, hip + .25, -.4); break;
		case "kneel": right = v3(.42, .75, -1.15); left = v3(-.42, .75, -1.15); break;
		case "climb": right = v3(.45, sh + 1.1, -.55); left = v3(-.45, sh + 1.1, -.55); break;
		case "sing": right = v3(1, sh + .55, -.55); left = v3(-1, sh + .55, -.55); break;
		case "play":
			if (has("guitar")) { right = guitarFrame.PointToWorldSpace(v3(-.05, .1, -.42)); left = guitarFrame.PointToWorldSpace(v3(-1.9, 0, -.16)); }
			else { right = v3(.32, headY - .36, -.66); left = v3(-.32, headY - .36, -.66); }
			break;
		default: right = v3(1.02, hip + .1, -.1); left = v3(-1.02, hip + .1, -.1);
	}
	if (has("cup")) right = v3(.4, hip + .6, -.85);
	if (has("sling")) left = v3(-.1, sh - .78, -.56);
	// Choose the smallest forward lean that brings explicit reach targets within arm's length.
	const reachR = spec.reach ? toLocal(spec.reach) : undefined, reachL = spec.reachLeft ? toLocal(spec.reachLeft) : undefined;
	let lean = 0, leanT = CFrame.identity;
	const leanAbout = (angle: number) => new CFrame(0, hip, 0).mul(CFrame.Angles(-angle, 0, 0)).mul(new CFrame(0, -hip, 0));
	// Lean only as far as it actually shortens the reach, within a pose-appropriate limit.
	const maxLean = kneel ? .95 : seated ? .55 : .5;
	const shortfall = (t: CFrame) => {
		let worst = 0;
		if (reachR) worst = math.max(worst, reachR.sub(t.PointToWorldSpace(shoulderR)).Magnitude - ARM * .97);
		if (reachL) worst = math.max(worst, reachL.sub(t.PointToWorldSpace(shoulderL)).Magnitude - ARM * .97);
		return worst;
	};
	let best = shortfall(leanT);
	for (let step = 1; best > 0 && step * .05 <= maxLean + 1e-6; step++) {
		const t = leanAbout(step * .05), miss = shortfall(t);
		if (miss < best - .01) { best = miss; lean = step * .05; leanT = t; }
	}
	m.SetAttribute("Lean", lean);
	if (lean > 0) for (const item of u.GetDescendants()) if (item.IsA("BasePart")) item.CFrame = leanT.mul(item.CFrame);
	right = reachR ?? leanT.PointToWorldSpace(right); left = reachL ?? leanT.PointToWorldSpace(left);
	const rh = arm(m, 1, leanT.PointToWorldSpace(shoulderR), right, look.coat, "Right hand"), lh = arm(m, -1, leanT.PointToWorldSpace(shoulderL), left, look.coat, "Left hand");
	const rp = rh.Position, lp = lh.Position;
	if (has("armband")) at(m, "Resistance armband", [.62, .28, .62], leanT.PointToWorldSpace(shoulderL).Lerp(lp, .3), PAPER);
	if (has("guitar")) {
		const g = (n: string, size: V, offset: Vec, c: Color3, isBall = false) => { const q = isBall ? ball(m, n, size, [0, 0, 0], c) : part(m, n, size, [0, 0, 0], c); q.CFrame = guitarFrame.mul(new CFrame(offset)); return q; };
		g("Guitar body", [1.3, 1.4, .4], v3(.35, 0, 0), Color3.fromRGB(196,132,62), true);
		g("Guitar upper bout", [.98, 1.08, .4], v3(-.42, 0, 0), Color3.fromRGB(196,132,62), true);
		const hole = g("Guitar soundhole", [.04, .44, .44], v3(-.08, 0, -.2), INK); hole.Shape = Enum.PartType.Cylinder; hole.CFrame = hole.CFrame.mul(CFrame.Angles(0, math.pi / 2, 0));
		g("Guitar bridge", [.12, .5, .05], v3(.5, 0, -.21), Color3.fromRGB(60,40,28));
		g("Guitar neck", [1.7, .26, .12], v3(-1.75, 0, -.06), Color3.fromRGB(84,56,36));
		g("Guitar headstock", [.45, .34, .1], v3(-2.78, 0, -.06), Color3.fromRGB(70,46,30));
		for (let i = -1; i <= 1; i++) { const a = guitarFrame.PointToWorldSpace(v3(.5, i * .07, -.24)), b = guitarFrame.PointToWorldSpace(v3(-2.55, i * .05, -.13)); seg(m, "Guitar string", a, b, .02, PAPER); }
	}
	if (has("harmonica")) {
		const h = at(m, "Held harmonica", [.8, .2, .3], v3(0, headY - .3, -.72), Color3.fromRGB(196,198,196));
		for (let i = 0; i < 5; i++) at(m, "Harmonica reed hole", [.07, .07, .03], v3(-.28 + i * .14, headY - .3, -.88), INK);
		h.SetAttribute("HeldBy", spec.person);
	}
	if (has("cloth")) {
		const c = (rp.add(lp)).mul(.5);
		const cloth = at(m, "Folded keepsake cloth", [.85, .07, .62], c.add(v3(0, .2, -.06)), Color3.fromRGB(236,230,214)); cloth.CFrame = cloth.CFrame.mul(CFrame.Angles(.12, .15, 0));
		const fold = at(m, "Cloth fold", [.7, .06, .5], c.add(v3(.06, .26, -.04)), Color3.fromRGB(244,240,228)); fold.CFrame = fold.CFrame.mul(CFrame.Angles(.1, -.25, .05));
		const drape = at(m, "Cloth drape", [.62, .55, .05], c.add(v3(-.05, -.08, -.38)), Color3.fromRGB(232,226,208)); drape.CFrame = drape.CFrame.mul(CFrame.Angles(-.35, .1, 0));
		at(m, "Cloth stitched border", [.6, .04, .06], c.add(v3(-.05, -.33, -.46)), GOLD);
		cloth.SetAttribute("HeldBy", spec.person);
	}
	if (has("report")) {
		const c = rp.add(lp).mul(.5).add(v3(0, .25, -.08));
		at(m, "Held report", [1.15, 1.45, .04], c, PAPER);
		at(m, "Report heading", [.8, .12, .02], c.add(v3(0, .5, -.03)), INK);
		for (let i = 0; i < 6; i++) at(m, "Report line", [i === 5 ? .4 : .85, .05, .02], c.add(v3(0, .25 - i * .16, -.03)), BLUE);
	}
	if (has("plate")) { const c = rp.add(lp).mul(.5).add(v3(0, .22, 0)); at(m, "Bread plate", [1.1, .08, .8], c, PAPER); at(m, "Shared bread", [.7, .3, .42], c.add(v3(0, .18, 0)), GOLD); }
	if (has("notes")) { const n = at(m, "Handed notes", [.55, .05, .42], rp.add(v3(0, .24, -.06)), PAPER); n.CFrame = n.CFrame.mul(CFrame.Angles(.2, .3, 0)); at(m, "Notes writing", [.4, .02, .05], rp.add(v3(0, .28, -.06)), BLUE); }
	if (has("helmet")) { ball(m, "Flight helmet", [.9, .85, .95], [rp.X - .2, rp.Y + .45, rp.Z], PAPER); at(m, "Helmet visor", [.7, .3, .1], v3(rp.X - .2, rp.Y + .5, rp.Z - .45), Color3.fromRGB(40,50,62)); }
	if (has("cup")) { const c = cylinder(m, "Uncle's cup", .55, .38, [rp.X, rp.Y + .45, rp.Z], PAPER); c.CFrame = new CFrame(rp.add(v3(0, .45, 0))).mul(CFrame.Angles(0, 0, math.pi / 2)); }
	if (has("pen")) { const tip = v3(rp.X - .08, TABLE_TOP + .03, rp.Z - .18); seg(m, "Held pen", rp.add(v3(.05, .32, .08)), tip, .07, INK); m.SetAttribute("PenTipY", tip.Y); }
	if (has("plank")) seg(m, "Carried timber", v3(rp.X + .6, rp.Y + .1, rp.Z), v3(lp.X - .6, lp.Y + .1, lp.Z), .3, WOOD);
	if (has("torch")) {
		const dir = rp.sub(leanT.PointToWorldSpace(shoulderR)).Unit;
		seg(m, "Torch", rp, rp.add(dir.mul(.5)), .2, INK);
		const beam = seg(m, "Torch beam", rp.add(dir.mul(.5)), rp.add(dir.mul(4.5)), .9, Color3.fromRGB(255,240,190)); beam.Material = Enum.Material.Neon; beam.Transparency = .82;
	}
	if (seated) {
		if (spec.person === "soldier") at(m, "Seat crate", [1.9, 1.3, 1.7], v3(0, .65, -.2), Color3.fromRGB(110,92,62), Enum.Material.WoodPlanks);
		else chair(m, new CFrame(), "Occupied chair");
	}
	// Gaze: rotate the head group about the neck toward the target.
	const neck = new CFrame(0, sh + .15, 0), target = spec.look ? toLocal(spec.look) : leanT.PointToWorldSpace(v3(0, headY, -10));
	const headLocal = leanT.PointToWorldSpace(v3(0, headY, 0)), toEye = toLocal([eye.X, eye.Y, eye.Z]).sub(headLocal).Unit;
	const gaze = target.sub(headLocal).Unit.Lerp(toEye, cheat * .8);
	const flat = math.sqrt(gaze.X * gaze.X + gaze.Z * gaze.Z);
	const yaw = math.clamp(math.atan2(-gaze.X, -gaze.Z), math.rad(-80), math.rad(80)), pitch = math.clamp(math.atan2(gaze.Y, math.max(flat, .01)), math.rad(-42), math.rad(48));
	const turn = new CFrame(leanT.PointToWorldSpace(neck.Position)).mul(CFrame.Angles(0, yaw, 0)).mul(CFrame.Angles(pitch, 0, 0)).mul(neck.Inverse());
	for (const item of head.GetChildren()) if (item.IsA("BasePart")) item.CFrame = turn.mul(item.CFrame);
	m.WorldPivot = CFrame.identity;
	m.ScaleTo(scale);
	m.PivotTo(body);
	return m;
}
function setModel(w: Instance, name: string): Model { return group(w, `Set-${name}`); }
function bar(w: Instance): void {
	const m = setModel(w, "bar");
	part(m, "Timber floor", [32, .2, 26], [0, -.1, 0], Color3.fromRGB(92,64,44), Enum.Material.WoodPlanks);
	// Back wall with a real window opening so the sky (and passing aircraft) can be seen through it.
	const z = -9;
	part(m, "Wainscot", [32, 3.2, .3], [0, 1.6, z], Color3.fromRGB(78,54,38), Enum.Material.Wood);
	part(m, "Plaster wall", [14, 7, .3], [-9, 6.7, z], Color3.fromRGB(122,104,84));
	part(m, "Plaster wall", [10, 7, .3], [11, 6.7, z], Color3.fromRGB(122,104,84));
	part(m, "Plaster wall", [8, 1.6, .3], [2, 9.4, z], Color3.fromRGB(122,104,84));
	part(m, "Window sill", [8, .4, .5], [2, 3.4, z], Color3.fromRGB(214,200,170)); part(m, "Window head", [8, .4, .5], [2, 8.4, z], Color3.fromRGB(214,200,170));
	for (const [sx, px] of [[.4, -1.9], [.4, 5.9], [.16, 2]] as [number, number][]) part(m, "Window frame", [sx, 5, .4], [px, 5.9, z], Color3.fromRGB(214,200,170));
	part(m, "Window glass", [7.4, 4.6, .05], [2, 5.9, z - .1], Color3.fromRGB(150,180,200), Enum.Material.Glass).Transparency = .8;
	part(m, "Side wall", [.3, 10.3, 26], [-15.8, 5.1, 0], Color3.fromRGB(110,92,72));
	part(m, "Bar counter", [9, 3, 1.6], [-9, 1.5, -6.6], Color3.fromRGB(86,58,40), Enum.Material.Wood);
	part(m, "Counter top", [9.4, .25, 2], [-9, 3.1, -6.6], Color3.fromRGB(60,40,28), Enum.Material.Wood);
	for (const y of [4.7, 6.1]) part(m, "Bottle shelf", [8, .2, .8], [-9, y, -8.5], Color3.fromRGB(70,48,34), Enum.Material.Wood);
	const bottle = [Color3.fromRGB(64,110,70), Color3.fromRGB(150,96,40), Color3.fromRGB(190,200,196)];
	for (let i = 0; i < 9; i++) cylinder(m, "Bottle", .9, .38, [-12.4 + i * .85, i % 2 === 0 ? 5.25 : 6.65, -8.5], bottle[i % 3], [0, 0, math.pi / 2]);
	for (let i = 0; i < 3; i++) { cylinder(m, "Bar stool", .25, 1.2, [-11 + i * 2.4, 2.1, -5.2], Color3.fromRGB(70,48,34), [0, 0, math.pi / 2]); part(m, "Stool post", [.2, 2, .2], [-11 + i * 2.4, 1, -5.2], INK); }
	for (const [d, c] of [[1.7, Color3.fromRGB(30,30,30)], [1.2, Color3.fromRGB(196,180,150)], [.7, Color3.fromRGB(150,44,38)], [.2, Color3.fromRGB(30,30,30)]] as [number, Color3][]) cylinder(m, "Dartboard", .08 + (1.7 - d) * .05, d, [11, 5.6, z + .25 + (1.7 - d) * .03], c, [0, math.pi / 2, 0]);
	for (const [x, zz] of [[-3, -2.5], [5, -3.5]]) { line(m, "Lamp cord", [x, 10.4, zz], [x, 8.8, zz], .05, INK); part(m, "Lamp shade", [1.3, .5, 1.3], [x, 8.6, zz], Color3.fromRGB(70,60,40)); ball(m, "Warm lamp", [.5, .5, .5], [x, 8.25, zz], GOLD, Enum.Material.Neon); }
	stageTable(m, 10, -6, 2.4, 2.4, true); chair(m, new CFrame(10, 0, -3.8)); chair(m, new CFrame(12.4, 0, -6).mul(CFrame.Angles(0, math.pi / 2, 0)));
	part(m, "Framed squadron photo", [2, 1.4, .1], [-13.6 + 3, 6.2, z + .2], Color3.fromRGB(60,46,34));
	part(m, "Photo print", [1.7, 1.1, .05], [-10.6, 6.2, z + .27], Color3.fromRGB(176,168,150));
}
function upstairs(w: Instance, shot: StoryShot): void {
	const m = setModel(w, "upstairs"), paper = Color3.fromRGB(96,110,96);
	part(m, "Attic floor", [22, .2, 18], [0, -.1, 0], Color3.fromRGB(104,84,62), Enum.Material.WoodPlanks);
	const door = shot.props.find((q) => q.key === "doorway"), dx = door ? door.at[0] : 99;
	if (door) { part(m, "Wallpaper wall", [dx - 1.3 + 11, 7.5, .3], [(-11 + dx - 1.3) / 2, 3.75, -6], paper); part(m, "Wallpaper wall", [11 - dx - 1.3, 7.5, .3], [(dx + 1.3 + 11) / 2, 3.75, -6], paper); part(m, "Wallpaper wall", [2.6, 1.5, .3], [dx, 6.75, -6], paper); }
	else part(m, "Wallpaper wall", [22, 7.5, .3], [0, 3.75, -6], paper);
	part(m, "Wallpaper stripe", [22, .3, .32], [0, 3.2, -6], Color3.fromRGB(80,92,80));
	part(m, "Side wall", [.3, 7.5, 18], [-11, 3.75, 0], paper);
	for (const x of [-7, -2, 3, 8]) line(m, "Roof rafter", [x, 7.4, -6], [x, 10.4, 4], .35, Color3.fromRGB(84,64,46));
	cylinder(m, "Round attic window", .2, 1.8, [-6, 5.2, -5.8], Color3.fromRGB(40,52,72), [0, math.pi / 2, 0]);
	part(m, "Cot frame", [3, 1.1, 6], [-8.8, .55, -1], Color3.fromRGB(80,60,44));
	part(m, "Cot blanket", [3, .3, 5], [-8.8, 1.2, -.6], Color3.fromRGB(116,58,50));
	for (let i = 0; i < 3; i++) part(m, "Stacked crate", [1.6, 1.4, 1.6], [7.6 + (i % 2) * .4, .7 + math.floor(i / 2) * 1.4, -4.4 + (i % 2) * 1.7], Color3.fromRGB(120,98,64), Enum.Material.WoodPlanks);
	line(m, "Bulb cord", [0, 8.5, -1], [0, 7, -1], .05, INK); ball(m, "Bare bulb", [.45, .5, .45], [0, 6.8, -1], Color3.fromRGB(255,226,160), Enum.Material.Neon);
}
function study(w: Instance): void {
	const m = setModel(w, "desk");
	part(m, "Study floor", [20, .2, 18], [0, -.1, 0], Color3.fromRGB(110,84,62), Enum.Material.WoodPlanks);
	part(m, "Study wall", [8, 9, .3], [-7, 4.5, -6.5], Color3.fromRGB(184,172,148)); part(m, "Study wall", [8, 9, .3], [5.5, 4.5, -6.5], Color3.fromRGB(184,172,148));
	part(m, "Study wall", [4.5, 2.6, .3], [-.75, 7.7, -6.5], Color3.fromRGB(184,172,148)); part(m, "Study wall", [4.5, 2.4, .3], [-.75, 1.2, -6.5], Color3.fromRGB(184,172,148));
	part(m, "Daylight window", [4.5, 4, .1], [-.75, 4.4, -6.7], Color3.fromRGB(196,220,232), Enum.Material.Neon).Transparency = .3;
	for (const [sx, sy, px, py] of [[4.7, .3, -.75, 6.4], [4.7, .3, -.75, 2.4], [.2, 4, -.75, 4.4]] as [number, number, number, number][]) part(m, "Window frame", [sx, sy, .35], [px, py, -6.45], PAPER);
	part(m, "Bookshelf", [3.6, 6.5, 1.2], [5, 3.25, -5.7], Color3.fromRGB(88,62,44), Enum.Material.Wood);
	const books = [Color3.fromRGB(120,50,44), Color3.fromRGB(50,70,96), Color3.fromRGB(150,130,80), Color3.fromRGB(70,90,60)];
	for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) part(m, "Book spine", [.42, 1.2 + (i % 3) * .15, .9], [3.6 + i * .52, 1.2 + r * 2 + (i % 3) * .07, -5.15], books[(i + r) % 4]);
	stageTable(m, 0, -1.4, 4.4, 2.4);
	part(m, "Desk lamp base", [.6, .12, .6], [-1.7, TABLE_TOP + .06, -2.2], INK);
	line(m, "Desk lamp arm", [-1.7, TABLE_TOP + .1, -2.2], [-1.4, TABLE_TOP + 1.6, -1.9], .1, INK);
	part(m, "Desk lamp shade", [.8, .45, .8], [-1.35, TABLE_TOP + 1.6, -1.8], Color3.fromRGB(60,80,64));
	part(m, "Framed photograph", [.7, .9, .1], [1.8, TABLE_TOP + .45, -2.4], Color3.fromRGB(70,52,38), Enum.Material.SmoothPlastic, [-.2, 0, 0]);
}
function cape(w: Instance): void {
	const m = setModel(w, "cape");
	part(m, "Cape sea", [200, .2, 150], [0, -2, -80], Color3.fromRGB(70,108,130));
	part(m, "Grass headland", [70, 1.6, 30], [0, -.8, 6], GRASS, Enum.Material.Grass);
	part(m, "Cliff face", [70, 5, 3], [0, -3, -9.5], Color3.fromRGB(122,114,98), Enum.Material.Rock);
	part(m, "Far cape", [26, 4, 48], [-34, -1, -46], Color3.fromRGB(104,118,82), Enum.Material.Grass, [0, .4, 0]);
	part(m, "Far cape cliff", [26, 4, 2], [-26, -2, -66], Color3.fromRGB(122,114,98), Enum.Material.Rock, [0, .4, 0]);
	part(m, "Coastal road", [4, .1, 30], [6, .05, 0], Color3.fromRGB(96,94,88), Enum.Material.Asphalt);
	part(m, "Coastal road bend", [4, .1, 14], [1.5, .05, -11], Color3.fromRGB(96,94,88), Enum.Material.Asphalt, [0, .8, 0]);
	for (let i = 0; i < 8; i++) part(m, "Low stone wall", [1.6, .8, .7], [9 + (i % 2) * .1, .4, 10 - i * 2.2], STONE, Enum.Material.Cobblestone);
	part(m, "Distant hills", [120, 10, 10], [30, 0, -110], Color3.fromRGB(110,128,120));
}
function street(w: Instance, night: boolean): void {
	const m = setModel(w, "street");
	part(m, "Cobbled street", [18, .2, 90], [0, -.1, -20], Color3.fromRGB(82,80,76), Enum.Material.Cobblestone);
	for (const x of [-10.5, 10.5]) part(m, "Pavement", [3, .3, 90], [x, .05, -20], Color3.fromRGB(122,118,108), Enum.Material.Concrete);
	facades(m, -15.5, 8, 4, math.pi / 2, 0, !night);
	facades(m, 15.5, -25, 4, -math.pi / 2, 1, !night);
	house(m, 0, -46, 13, false, 14, Color3.fromRGB(140,132,120));
	for (const z of [4, -12]) { lamp(m, -9, z, false); lamp(m, 9, z - 4, false); }
}
function runway(w: Instance, damaged: boolean, civilian: boolean): void {
	const m = setModel(w, damaged ? "damage" : "runway");
	part(m, "Meadow", [140, .2, 160], [0, -.12, -30], GRASS, Enum.Material.Grass);
	highway(m, damaged, civilian);
	part(m, "Distant ridge", [160, 12, 10], [0, 0, -100], Color3.fromRGB(110,124,104));
	if (!civilian) for (let i = 0; i < 4; i++) cylinder(m, "Fuel drum", 1.6, 1.1, [-10.2 + (i % 2) * 1.2, .8, 8 + math.floor(i / 2) * 1.2], Color3.fromRGB(70,86,60), [0, 0, math.pi / 2]);
}
function door(w: Instance, shot: StoryShot): void {
	const m = setModel(w, "door"), wall = Color3.fromRGB(96,100,102);
	part(m, "Cobbled street", [40, .2, 30], [0, -.1, 2], Color3.fromRGB(70,72,74), Enum.Material.Cobblestone);
	const opening = shot.props.find((q) => q.key === "doorway"), x = opening ? opening.at[0] : 0, z = opening ? opening.at[2] : -6;
	part(m, "Blackout facade", [16, 10, 1], [x - 9.8, 5, z], wall); part(m, "Blackout facade", [16, 10, 1], [x + 9.8, 5, z], wall); part(m, "Blackout facade", [3.6, 3.6, 1], [x, 8.2, z], wall);
	for (const fx of [-6, -4, 4, 6]) for (const fy of [3.2, 7]) { part(m, "Shuttered window", [1.3, 1.8, .2], [x + fx * 1.4, fy, z + .55], Color3.fromRGB(46,56,60)); }
	part(m, "Passage wall", [.5, 6.4, 9], [x - 2, 3.2, z - 5], wall); part(m, "Passage wall", [.5, 6.4, 9], [x + 2, 3.2, z - 5], wall);
	part(m, "Passage ceiling", [4.5, .5, 9], [x, 6.6, z - 5], wall);
	house(m, x - 2, z - 24, 11, false, 10, Color3.fromRGB(150,162,170));
	part(m, "Kerb", [40, .3, .6], [0, .15, z + 2.2], Color3.fromRGB(110,112,114), Enum.Material.Concrete);
	lamp(m, x - 6.5, z + 2.6, false);
}
function square(w: Instance): void {
	const m = setModel(w, "square");
	part(m, "Square paving", [50, .2, 46], [0, -.1, -6], Color3.fromRGB(150,142,126), Enum.Material.Cobblestone);
	facades(m, -16, -20, 5, 0, 2, false);
	facades(m, -20, 8, 3, math.pi / 2, 1, false);
	cylinder(m, "Fountain basin", 1.2, 6, [0, .6, -12], STONE, [0, 0, math.pi / 2]);
	cylinder(m, "Fountain water", .2, 5.4, [0, 1.15, -12], Color3.fromRGB(110,150,170), [0, 0, math.pi / 2]);
	part(m, "Fountain column", [.8, 4, .8], [0, 2.6, -12], STONE);
	for (const y of [9, 10.5]) {
		line(m, "Celebration cord", [-14, y, -16], [14, y - .6, -4], .04, PAPER);
		for (let i = 0; i < 7; i++) { const t = i / 6; part(m, "Civilian pennant", [.7, .9, .05], [-14 + 28 * t, y - .6 * t - .55, -16 + 12 * t], i % 2 === 0 ? PAPER : Color3.fromRGB(70,110,160), Enum.Material.SmoothPlastic, [0, -.4, math.pi / 4]); }
	}
}
function grave(w: Instance): void {
	const m = setModel(w, "grave");
	part(m, "Forest floor", [60, .2, 60], [0, -.1, -10], Color3.fromRGB(112,98,72), Enum.Material.Grass);
	part(m, "Memorial earth", [2.4, .5, 1.6], [0, .25, 0], Color3.fromRGB(86,64,44), Enum.Material.Ground);
	part(m, "Memorial marker", [.3, 2.2, .25], [0, 1.1, -.95], Color3.fromRGB(120,94,64), Enum.Material.Wood);
	for (const [x, z] of [[-1.3, -.2], [1.3, .2], [-.6, .9], [.7, -.9]] as [number, number][]) part(m, "Grave stone", [.4, .3, .35], [x, .15, z], STONE, Enum.Material.Slate);
	const trees: [number, number, number][] = [[-6, -6, 18], [-3.5, -10, 20], [1, -12, 19], [4.5, -7, 21], [7.5, -11, 17], [-9, -2, 16], [9, -3, 19], [-12, -12, 22], [12, -14, 20], [-2, -18, 22], [6, -20, 21], [-8, 3, 15]];
	for (const [x, z, h] of trees) birch(m, x, z, h, (x % 3) * .015);
}
function overlook(w: Instance): void {
	const m = setModel(w, "overlook");
	part(m, "Hilltop grass", [60, 1, 26], [0, -.5, 6], Color3.fromRGB(118,112,78), Enum.Material.Grass);
	part(m, "Hill slope", [80, 8, 20], [0, -5, -12], Color3.fromRGB(102,98,70), Enum.Material.Grass, [-.25, 0, 0]);
	part(m, "Farbanti bay", [220, .2, 120], [0, -12, -90], Color3.fromRGB(96,110,124));
	for (let i = 0; i < 10; i++) part(m, "Farbanti tower", [6 + (i % 3) * 2, 14 + ((i * 7) % 5) * 5, 6], [-46 + ((i + 5) % 10) * 10, -5 + (7 + ((i * 7) % 5) * 2.5), -80 - (i % 3) * 6], Color3.fromRGB(96 + (i % 2) * 10, 100, 112));
	for (const [x, z] of [[-9, 2], [10, 3]] as [number, number][]) birch(m, x, z, 16);
}
function attachShotSet(w: Instance, shot: StoryShot): void {
	if (shot.set === "bar") bar(w);
	else if (shot.set === "upstairs") upstairs(w, shot);
	else if (shot.set === "desk") study(w);
	else if (shot.set === "cape") cape(w);
	else if (shot.set === "street") street(w, shot.light === "blackout");
	else if (shot.set === "runway") runway(w, false, shot.props.some((q) => q.key === "traffic"));
	else if (shot.set === "damage") runway(w, true, false);
	else if (shot.set === "door") door(w, shot);
	else if (shot.set === "square") square(w);
	else if (shot.set === "grave") grave(w);
	else overlook(w);
}
function parked(m: Instance, cf: CFrame, s: number, name: string, yellow = true, number?: string): Model {
	const plane = jet(m, cf.mul(new CFrame(0, 1.15 * s, 0)), s, yellow, name, number);
	for (const [x, z] of [[0, -3], [-.9, .9], [.9, .9]] as [number, number][]) { const top = cf.PointToWorldSpace(v3(x * s, .8 * s, z * s)), foot = cf.PointToWorldSpace(v3(x * s, .25 * s, z * s)); seg(plane, "Landing gear", top, foot, .14 * s, INK); const wheel = cylinder(plane, "Gear wheel", .2 * s, .5 * s, [foot.X, foot.Y, foot.Z], INK); wheel.CFrame = cf.Rotation.add(foot); }
	return plane;
}
function crate(m: Instance, pos: Vec, size: V): void { at(m, "Supply crate", size, pos, Color3.fromRGB(112,98,64), Enum.Material.WoodPlanks); at(m, "Crate stencil", [size[0] * .6, .14, size[2] + .02], pos, Color3.fromRGB(70,64,40)); }
function prop(w: Instance, q: StoryProp): void {
	const cf = new CFrame(vector(q.at)).mul(CFrame.Angles(0, q.yaw, 0)), s = q.scale, key = q.key;
	const g = group(w, `Prop-${key}`), L = (x: number, y: number, z: number) => cf.PointToWorldSpace(v3(x, y, z));
	const b = (n: string, size: V, p: Vec, c: Color3, mat: Enum.Material = Enum.Material.SmoothPlastic) => { const r = at(g, n, size, p, c, mat); r.CFrame = cf.Rotation.add(p); return r; };
	switch (key) {
		case "distant-guns":
			part(g, "Gun ridge", [70, 10, 26], [q.at[0], 0, q.at[2] - 6], Color3.fromRGB(100,112,96), Enum.Material.Grass);
			for (let i = 0; i < 3; i++) { const x = q.at[0] - 16 + i * 16; part(g, "Great gun turret", [9, 6, 9], [x, 8, q.at[2]], Color3.fromRGB(86,90,94)); line(g, "Great gun barrel", [x, 10, q.at[2]], [x + 6, 28, q.at[2] - 14], 2, Color3.fromRGB(70,74,80)); }
			break;
		case "gulls": for (const [x, y, z] of [[0, 0, 0], [3, 1.4, -2], [-2.6, 2, -4]] as V[]) gull(g, q.at[0] + x, q.at[1] + y, q.at[2] + z, 1.4); break;
		case "road-sign": b("Road sign post", [.2, 4, .2], L(0, 2, 0), Color3.fromRGB(150,150,146)); { const d = cylinder(g, "Road sign", .1, 1.5, [0, 0, 0], YELLOW); d.CFrame = cf.mul(new CFrame(0, 4.3, .12)).mul(CFrame.Angles(0, math.pi / 2, 0)); } break;
		case "home": house(g, q.at[0], q.at[2], 10, true, 9, Color3.fromRGB(196,186,160), q.yaw); part(g, "Garden fence", [12, .9, .2], [q.at[0] + 1, .45, q.at[2] + 6], PAPER); break;
		case "falling-fighter": {
			jet(g, cf.mul(CFrame.Angles(-.5, 0, 1.1)), 1.1, false);
			for (let i = 0; i < 5; i++) { const sm = ball(g, "Falling aircraft smoke", [2 + i * 1.2, 2 + i * 1.2, 2 + i * 1.2], [q.at[0] + i * 1.6, q.at[1] + 1.6 + i * 2.6, q.at[2] - 3 - i * 2], Color3.fromRGB(46,44,42)); sm.Transparency = .1 + i * .13; }
			ball(g, "Aircraft flame", [1.2, 1.2, 2], [q.at[0], q.at[1] + .6, q.at[2] + 2.6], Color3.fromRGB(255,150,60), Enum.Material.Neon);
			break;
		}
		case "pursuing-fighter": jet(g, cf.mul(CFrame.Angles(.45, .4, -.4)), 1.1, true); line(g, "Pursuit trail", [q.at[0], q.at[1] - .6, q.at[2] + 4], [q.at[0] - 4, q.at[1] - 5, q.at[2] + 16], .2, PAPER).Transparency = .3; break;
		case "ruin":
			b("Ruined foundation", [7, .3, 5.5], L(0, .15, 0), Color3.fromRGB(70,64,58), Enum.Material.Concrete);
			for (const [x, h, z] of [[-3.4, 3.2, -2], [-3.4, 1.6, 0], [3.3, 2.4, -2.5], [0, 1.2, -2.7]] as V[]) b("Broken wall", [x === 0 ? 4 : .5, h, x === 0 ? .5 : 2], L(x, h / 2, z), Color3.fromRGB(168,158,138));
			b("Broken threshold", [.35, 3.6, .45], L(-1.2, 1.8, 2.6), PAPER); b("Broken threshold", [.35, 2.4, .45], L(1.2, 1.2, 2.6), PAPER); b("Fallen lintel", [3, .35, .45], L(.1, .3, 3.3), PAPER).CFrame = cf.mul(new CFrame(.1, .4, 3.3)).mul(CFrame.Angles(0, .3, .25));
			for (let i = 0; i < 6; i++) { const d = b("Collapsed roof debris", [1.6, .35, .9], L(-2.5 + i, .45 + (i % 2) * .3, -1 + (i % 3)), Color3.fromRGB(80,52,40)); d.CFrame = d.CFrame.mul(CFrame.Angles(.3 * i, .5 * i, .2)); }
			for (let i = 0; i < 2; i++) ball(g, "Lingering smoke", [4, 3, 4], [q.at[0] - 4 + i * 1.5, 5.5 + i * 3, q.at[2] - 7], Color3.fromRGB(70,68,66)).Transparency = .62 + i * .12;
			break;
		case "yellow-thirteen": jet(g, cf, s, true, "Yellow fighter", "13"); break;
		case "patrol": for (let i = 0; i < 3; i++) figure(g, q.at[0] + i * 1.8, q.at[2] - i * 2.2, Color3.fromRGB(90,94,72), math.pi * .1); break;
		case "retreat-column": figure(g, q.at[0], q.at[2], Color3.fromRGB(90,94,72), -.3); figure(g, q.at[0] + 2.4, q.at[2] - 3, Color3.fromRGB(86,90,70), -.3); figure(g, q.at[0] - 1.6, q.at[2] - 6, Color3.fromRGB(90,94,72), -.4); car(g, new CFrame(q.at[0] + 1, 0, q.at[2] - 11).mul(CFrame.Angles(0, .1, 0)), Color3.fromRGB(74,80,62), "Army truck"); break;
		case "sandbags": for (let r = 0; r < 2; r++) for (let i = 0; i < 5 - r; i++) { const bag = b("Sandbag", [1.3, .6, .8], L(-2.6 + i * 1.3 + r * .65, .3 + r * .6, 0), Color3.fromRGB(150,136,104)); bag.Shape = Enum.PartType.Ball; } break;
		case "taxi": car(g, cf, Color3.fromRGB(196,160,58), "Taxi"); b("Taxi roof sign", [1.2, .4, .4], L(0, 3.1, .4), PAPER); break;
		case "blackout-car": car(g, cf, Color3.fromRGB(70,82,86), "Blackout car", true); break;
		case "traffic":
			car(g, new CFrame(-3.5, 0, -6), Color3.fromRGB(150,52,44), "Civilian car"); car(g, new CFrame(3.5, 0, 6).mul(CFrame.Angles(0, math.pi, 0)), Color3.fromRGB(70,110,140), "Civilian car"); car(g, new CFrame(3.5, 0, -26).mul(CFrame.Angles(0, math.pi, 0)), Color3.fromRGB(210,200,180), "Civilian car");
			part(g, "Delivery truck box", [3.4, 3.4, 7], [-3.5, 2.4, -16], Color3.fromRGB(220,214,196)); part(g, "Delivery truck cab", [3.2, 2.4, 2.4], [-3.5, 1.9, -11.2], Color3.fromRGB(70,110,140));
			break;
		case "bottle": cylinder(g, "Bottle", .9, .32, [q.at[0], .45, q.at[2]], Color3.fromRGB(64,110,70), [0, 0, math.pi / 2]); break;
		case "round-table": stageTable(g, q.at[0], q.at[2], 2.2, 2.2, true); break;
		case "long-table": stageTable(g, q.at[0], q.at[2], 5.6, 2.4); break;
		case "radio-desk": stageTable(g, q.at[0], q.at[2], 2.8, 1.5); break;
		case "coins": for (let i = 0; i < 6; i++) cylinder(g, "Earned coin", .06, .32, [q.at[0] - .5 + i * .2, q.at[1] + .03 + (i % 2) * .06, q.at[2] + (i % 3) * .12], GOLD, [0, 0, math.pi / 2]); b("Upturned cap", [.9, .3, .9], L(.7, .15, -.1), Color3.fromRGB(80,64,50)); break;
		case "resting-guitar": {
			const frame = cf.mul(new CFrame(0, 1.4, 0)).mul(CFrame.Angles(0, 0, math.pi / 2 - .2));
			for (const [n, size, x] of [["Guitar body", [1.3, 1.4, .4], .35], ["Guitar upper bout", [.98, 1.08, .4], -.42]] as [string, V, number][]) { const r = ball(g, n, size, [0, 0, 0], Color3.fromRGB(196,132,62)); r.CFrame = frame.mul(new CFrame(x + 1.1, 0, 0)); }
			const neck = part(g, "Guitar neck", [1.7, .26, .12], [0, 0, 0], Color3.fromRGB(84,56,36)); neck.CFrame = frame.mul(new CFrame(-.75, 0, 0));
			break;
		}
		case "harmonica": b("Harmonica", [.85, .18, .3], L(0, .09, 0), Color3.fromRGB(196,198,196)); for (let i = 0; i < 5; i++) b("Harmonica reed hole", [.07, .07, .03], L(-.28 + i * .14, .09, .16), INK); break;
		case "meal": b("Bread plate", [1, .08, .8], L(0, .04, 0), PAPER); b("Shared bread", [.6, .26, .36], L(0, .2, 0), GOLD); cylinder(g, "Cup", .45, .32, [0, 0, 0], PAPER).CFrame = cf.mul(new CFrame(.75, .23, .1)).mul(CFrame.Angles(0, 0, math.pi / 2)); break;
		case "uncle-chair": { const c = chair(g, cf, "Uncle's empty chair"); c.Parent = g; b("Left flat cap", [1.1, .28, 1.1], L(0, 1.48, -.3), Color3.fromRGB(74,64,54)); break; }
		case "four-chair": { chair(g, cf, "Four's empty chair"); const scarf = b("Draped grey scarf", [1.7, .9, .12], L(0, 2.6, .78), Color3.fromRGB(176,182,180)); scarf.CFrame = scarf.CFrame.mul(CFrame.Angles(.15, 0, .1)); break; }
		case "empty-chairs": stageTable(g, q.at[0], q.at[2], 2.2, 2.2, true); for (let i = 0; i < 3; i++) { const yaw = i * math.pi * 2 / 3 + .4; chair(g, new CFrame(q.at[0] + math.sin(yaw) * 2.1, 0, q.at[2] + math.cos(yaw) * 2.1).mul(CFrame.Angles(0, yaw, 0))); } break;
		case "radio": b("Crystal radio case", [1.5, .9, .9], L(0, .45, 0), Color3.fromRGB(84,62,44), Enum.Material.Wood); b("Radio speaker cloth", [.7, .55, .04], L(-.3, .5, .46), Color3.fromRGB(196,180,140)); for (const x of [.35, .6]) b("Radio tuning dial", [.18, .18, .06], L(x, .5, .47), GOLD); line(g, "Radio aerial", [q.at[0] + .5, q.at[1] + .9, q.at[2]], [q.at[0] + 1, q.at[1] + 2.4, q.at[2] - .2], .04, PAPER); break;
		case "field-radio": cylinder(g, "Tree stump", 1, 1.2, [q.at[0], .5, q.at[2]], Color3.fromRGB(96,76,56), [0, 0, math.pi / 2]); b("Field radio case", [1.1, .7, .6], L(0, 1.35, 0), Color3.fromRGB(70,82,62)); b("Field radio dial", [.25, .25, .04], L(.25, 1.4, .31), GOLD); line(g, "Field radio aerial", [q.at[0] - .4, 1.7, q.at[2]], [q.at[0] - .7, 4, q.at[2] - .3], .05, INK); break;
		case "notes": paper(g, cf, 4, .8, 1); break;
		case "letter": paper(g, cf, 9, 1.5, 1.9); break;
		case "inspection-report": paper(g, cf, 7, 1.2, 1.6); b("Clipboard", [1.3, .02, 1.8], L(0, -.02, 0), WOOD); break;
		case "flight-chart": {
			b("Chart sheet", [2.6, .03, 1.8], L(0, 0, 0), Color3.fromRGB(206,214,206));
			for (let i = 0; i < 4; i++) { b("Chart grid", [2.5, .01, .03], L(0, .02, -.7 + i * .45), Color3.fromRGB(150,170,170)); b("Chart grid", [.03, .01, 1.7], L(-1 + i * .65, .02, 0), Color3.fromRGB(150,170,170)); }
			line(g, "Chart coastline", [q.at[0] - 1.2, q.at[1] + .03, q.at[2] - .2], [q.at[0] - .3, q.at[1] + .03, q.at[2] + .7], .05, Color3.fromRGB(90,110,96));
			line(g, "Plotted opposing course", [q.at[0] + 1.1, q.at[1] + .04, q.at[2] - .7], [q.at[0] + .55, q.at[1] + .04, q.at[2] + .05], .07, Color3.fromRGB(176,48,40));
			line(g, "Own course", [q.at[0] - .9, q.at[1] + .04, q.at[2] + .6], [q.at[0] + .55, q.at[1] + .04, q.at[2] + .05], .06, BLUE);
			break;
		}
		case "doorway": {
			const set = w.FindFirstChild("Set-upstairs") !== undefined, h = set ? 6 : 6.4, half = set ? 1.3 : 1.8;
			for (const x of [-half, half]) b("Door jamb", [.3, h, .5], L(x, h / 2, .3), set ? PAPER : Color3.fromRGB(120,110,96));
			b("Door lintel", [half * 2 + .3, .35, .5], L(0, h, .3), set ? PAPER : Color3.fromRGB(120,110,96));
			const leaf = part(g, "Open wooden door", [.2, h - .3, half * 2 - .2], [0, 0, 0], WOOD); leaf.CFrame = cf.mul(new CFrame(-half - .55, (h - .3) / 2, -half + .3)).mul(CFrame.Angles(0, -.35, 0));
			if (set) b("Dark stairwell", [half * 2, h, .2], L(0, h / 2, -2.5), INK);
			else { b("Unblocked escape path", [3.2, .04, 26], L(0, .03, -12), Color3.fromRGB(110,124,132)); b("Moonlit street beyond", [14, .06, 10], L(0, .05, -20), Color3.fromRGB(160,176,186)); }
			break;
		}
		case "bomb-cart": {
			b("Bomb trolley", [2, .3, 4.4], L(0, .7, 0), Color3.fromRGB(80,90,74)); for (const [x, z] of [[-.9, -1.8], [.9, -1.8], [-.9, 1.8], [.9, 1.8]] as [number, number][]) { const wh = cylinder(g, "Trolley wheel", .25, .6, [0, 0, 0], INK); wh.CFrame = cf.mul(new CFrame(x, .3, z)); }
			for (let i = 0; i < 2; i++) { const bomb = cylinder(g, "Bomb casing", 3.4, .75, [0, 0, 0], Color3.fromRGB(70,80,66)); bomb.CFrame = cf.mul(new CFrame(-.45 + i * .9, 1.25, 0)).mul(CFrame.Angles(0, math.pi / 2, 0)); const nose = ball(g, "Bomb nose", [.75, .75, .8], [0, 0, 0], Color3.fromRGB(70,80,66)); nose.CFrame = cf.mul(new CFrame(-.45 + i * .9, 1.25, -1.75)); b("Bomb fins", [.9, .9, .1], L(-.45 + i * .9, 1.25, 1.75), Color3.fromRGB(60,68,56)); b("Bomb band", [.78, .78, .15], L(-.45 + i * .9, 1.25, -.8), YELLOW); }
			line(g, "Trolley handle", [L(0, .8, -2.2).X, .8, L(0, .8, -2.2).Z], [L(0, 2.3, -3.2).X, 2.3, L(0, 2.3, -3.2).Z], .12, INK);
			break;
		}
		case "supply-crates": for (let i = 0; i < 5; i++) crate(g, L((i % 3) * 2.1, .8 + math.floor(i / 3) * 1.6, (i % 2) * .3), [2, 1.6, 1.6]); break;
		case "empty-rack": for (const x of [-1.5, 1.5]) b("Empty parts rack upright", [.2, 4.4, .2], L(x, 2.2, 0), BLUE); for (const y of [1, 2.4, 3.8]) b("Empty parts shelf", [3.2, .16, 1.4], L(0, y, 0), BLUE); b("Last spare part", [.6, .4, .5], L(1, 2.68, 0), CONCRETE); b("Parts tag", [.3, .4, .02], L(-.6, 3.6, .72), PAPER); break;
		case "toolbox": b("Toolbox", [1.4, .7, .7], L(0, .35, 0), Color3.fromRGB(160,52,40)); b("Toolbox open lid", [1.4, .7, .06], L(0, .9, .4), Color3.fromRGB(160,52,40)); b("Wrench", [.12, .05, .8], L(.9, .03, .3), CONCRETE); break;
		case "boarding-fighter": parked(g, cf, s, "Boarding fighter", true, "13"); break;
		case "parked-fighter": parked(g, cf, s, "Parked fighter"); break;
		case "parked-row": for (let i = 0; i < 4; i++) parked(g, new CFrame(q.at[0] + (i % 2 === 0 ? -3.6 : 3.6), 0, q.at[2] - i * 7).mul(CFrame.Angles(0, math.pi * (i % 2 === 0 ? .8 : 1.2), 0)), 1.8, "Row fighter"); break;
		case "ladder": ladder(g, cf.Position, L(0, 3.6, -1.2)); break;
		case "fence": for (let i = 0; i < 5; i++) b("Fence post", [.16, 3.4, .16], L(-4 + i * 2, 1.7, 0), Color3.fromRGB(120,126,120)); for (const y of [.8, 1.7, 2.6, 3.3]) { const a = L(-4, y, 0), c = L(4, y, 0); line(g, "Fence wire", [a.X, a.Y, a.Z], [c.X, c.Y, c.Z], .03, Color3.fromRGB(150,154,150)); } break;
		case "five-aircraft": for (let i = 0; i < 5; i++) { const off = [[0, 0, 0], [-5, -.6, 4], [5, -.6, 4], [-10, -1.2, 8], [10, -1.2, 8]][i]; jet(g, new CFrame(q.at[0] + off[0], q.at[1] + off[1], q.at[2] + off[2]).mul(CFrame.Angles(0, math.pi, 0)).mul(CFrame.Angles(.05, 0, 0)), 1.1, true, `Formation ${i + 1}`); } break;
		case "four-departure": {
			const plane = jet(g, cf.mul(CFrame.Angles(.28, 0, 0)), s, true, "Departing fighter");
			const panel = part(plane, "Primer repair panel", [.12, .7 * s, 1.6 * s], [0, 0, 0], Color3.fromRGB(150,160,140)); panel.CFrame = plane.GetPivot().mul(new CFrame(.68 * s, .05 * s, .6 * s));
			const hatch = part(plane, "Open access hatch", [.1, .5 * s, .8 * s], [0, 0, 0], Color3.fromRGB(120,126,118)); hatch.CFrame = plane.GetPivot().mul(new CFrame(.95 * s, -.35 * s, -.6 * s)).mul(CFrame.Angles(0, 0, .7));
			for (let i = 0; i < 3; i++) ball(g, "Four departure trail", [1.2 + i * .8, 1 + i * .6, 3], [q.at[0] + i * .3, q.at[1] - 1 - i * 1.3, q.at[2] + 5 + i * 4], Color3.fromRGB(200,200,196)).Transparency = .45 + i * .15;
			break;
		}
		case "hospital": {
			part(g, "Hospital block", [18, 12, 8], [q.at[0], 6, q.at[2]], Color3.fromRGB(150,150,146));
			for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) part(g, "Blackout window", [1.4, 1.8, .15], [q.at[0] - 7.5 + i * 3, 3.5 + r * 4.5, q.at[2] + 4.05], Color3.fromRGB(30,40,48));
			part(g, "Hospital unlit cross upright", [.8, 3, .1], [q.at[0], 9.8, q.at[2] + 4.12], PAPER); part(g, "Hospital cross arm", [2.6, .8, .1], [q.at[0], 9.8, q.at[2] + 4.14], PAPER);
			for (let i = 0; i < 6; i++) { const ang = i / 6 * math.pi * 2; ball(g, "Roof sandbag", [1.3, .7, .9], [q.at[0] + 4 + math.cos(ang) * 2, 12.4, q.at[2] + math.sin(ang) * 2], Color3.fromRGB(150,136,104)); }
			part(g, "Rooftop gun mount", [1.6, 1.4, 1.6], [q.at[0] + 4, 13.1, q.at[2]], Color3.fromRGB(60,64,62));
			for (const dx of [-.3, .3]) line(g, "Rooftop gun barrel", [q.at[0] + 4 + dx, 13.6, q.at[2]], [q.at[0] + 1 + dx, 18.5, q.at[2] + 2.5], .3, Color3.fromRGB(50,54,52));
			break;
		}
		case "satchel-transmitter": b("Open satchel", [1.3, .7, .8], L(0, .35, 0), Color3.fromRGB(96,72,46)); b("Satchel flap", [1.3, .06, .8], L(0, .05, .8), Color3.fromRGB(96,72,46)); b("Transmitter case", [.95, .55, .6], L(0, .7, 0), Color3.fromRGB(58,66,60)); b("Transmitter dial", [.22, .22, .04], L(.2, .78, .31), GOLD); line(g, "Transmitter wire", [L(-.3, .8, 0).X, .8, L(-.3, .8, 0).Z], [L(-.9, .05, .9).X, .05, L(-.9, .05, .9).Z], .04, INK); break;
		case "crowd": { const c = [Color3.fromRGB(150,70,60), Color3.fromRGB(70,90,120), Color3.fromRGB(170,150,110), Color3.fromRGB(96,110,80), Color3.fromRGB(120,100,140)]; for (let i = 0; i < 14; i++) { const ang = -1.2 + i * .18, r = 5 + (i % 3) * 2.2; figure(g, q.at[0] + math.sin(ang) * r * 1.6, q.at[2] - math.cos(ang) * r, c[i % 5], -ang * .6 + math.pi, i % 2 === 0, .9 + (i % 4) * .05); } break; }
		case "rubble": for (let i = 0; i < 9; i++) { const r = b("Rubble stone", [.9 + (i % 3) * .3, .5 + (i % 2) * .3, .8], L(-1.2 + (i % 4) * .8, .3 + math.floor(i / 4) * .45, -.4 + (i % 3) * .5), Color3.fromRGB(150,140,124), Enum.Material.Concrete); r.CFrame = r.CFrame.mul(CFrame.Angles(.3 * i, .7 * i, .2)); } line(g, "Broken beam", [q.at[0] - 1.6, .3, q.at[2] + .6], [q.at[0] + 1.8, 1.4, q.at[2] - 1], .35, WOOD); break;
		case "allied-aircraft": for (let i = 0; i < 2; i++) { jet(g, new CFrame(q.at[0] + i * 7, q.at[1] + i * 2, q.at[2] - i * 4).mul(CFrame.Angles(0, -math.pi / 2 - .3, .2)), 1.6, false, "Allied fighter"); line(g, "Allied contrail", [q.at[0] + i * 7 + 6, q.at[1] + i * 2, q.at[2] - i * 4 + 2], [q.at[0] + i * 7 + 30, q.at[1] + i * 2 - 1, q.at[2] - i * 4 + 9], .4, PAPER).Transparency = .25; } break;
		case "pennants": line(g, "Celebration cord", [-5.5, 6.9, q.at[2]], [5.5, 6.5, q.at[2]], .04, PAPER); for (let i = 0; i < 8; i++) part(g, "Civilian pennant", [.7, .9, .05], [-4.9 + i * 1.4, 6.2, q.at[2]], i % 2 === 0 ? PAPER : Color3.fromRGB(70,110,160), Enum.Material.SmoothPlastic, [0, 0, math.pi / 4]); break;
		case "retreat-trucks": for (let i = 0; i < 2; i++) { const t = car(g, new CFrame(q.at[0] - 1.5 + i * 3, 0, q.at[2] - i * 9), Color3.fromRGB(80,86,66), "Retreat truck"); part(t, "Retreat truck", [3, 2.4, 3.6], [q.at[0] - 1.5 + i * 3, 3, q.at[2] - i * 9 + 1.5], Color3.fromRGB(110,112,90)); } for (let i = 0; i < 3; i++) ball(g, "Road dust", [4, 2.4, 4], [q.at[0] + 1, 1.2, q.at[2] + 5 + i * 3], Color3.fromRGB(170,160,140)).Transparency = .55 + i * .12; break;
		case "last-contest": {
			jet(g, new CFrame(q.at[0] - 6, q.at[1], q.at[2]).mul(CFrame.Angles(0, -1.2, .9)), 1.5, true, "Yellow fighter");
			jet(g, new CFrame(q.at[0] + 4, q.at[1] + 3, q.at[2] + 5).mul(CFrame.Angles(0, -1.6, -.7)), 1.5, false, "Opposing fighter");
			for (let i = 0; i < 6; i++) { const t = i / 6, n = (i + 1) / 6; line(g, "Contest contrail", [q.at[0] - 6 + math.cos(t * 4) * 12, q.at[1] - 2 + t * 6, q.at[2] - 8 + math.sin(t * 4) * 8], [q.at[0] - 6 + math.cos(n * 4) * 12, q.at[1] - 2 + n * 6, q.at[2] - 8 + math.sin(n * 4) * 8], .35, PAPER).Transparency = .3; }
			break;
		}
		case "burial-cloth": {
			const c = b("Folded keepsake cloth", [.9, .07, .7], L(0, 0, 0), Color3.fromRGB(236,230,214)); c.CFrame = c.CFrame.mul(CFrame.Angles(.05, 0, .04));
			b("Cloth fold", [.75, .06, .55], L(.05, .06, .03), Color3.fromRGB(244,240,228)); b("Cloth stitched border", [.8, .02, .06], L(0, .045, .33), GOLD);
			break;
		}
		case "envelope": {
			b("Envelope", [1.95, .03, 1.15], L(0, 0, 0), Color3.fromRGB(224,212,184));
			const plane = cf.mul(new CFrame(-.85, .03, -.15)).mul(CFrame.Angles(-math.pi / 2, 0, 0));
			glyphs(g, "Envelope address", "TO", plane.mul(new CFrame(0, .02, 0)), .2, INK, .035);
			glyphs(g, "Envelope address", "MOBIUS ONE", plane.mul(new CFrame(0, -.3, 0)), .2, INK, .035);
			b("Postage stamp", [.3, .02, .36], L(.7, .02, -.3), Color3.fromRGB(150,60,52));
			break;
		}
		case "pen-rest": line(g, "Desk pen", [q.at[0], q.at[1] + .04, q.at[2]], [q.at[0] + .7, q.at[1] + .04, q.at[2] + .4], .07, INK); break;
		case "ground-crew-tent": b("Tent canvas", [5, 3, 5], L(0, 1.5, 0), Color3.fromRGB(110,116,86)); { const roof = b("Tent roof", [5.6, .2, 3.4], L(0, 3.4, -1.2), Color3.fromRGB(100,106,78)); roof.CFrame = roof.CFrame.mul(CFrame.Angles(.5, 0, 0)); const roof2 = b("Tent roof", [5.6, .2, 3.4], L(0, 3.4, 1.2), Color3.fromRGB(100,106,78)); roof2.CFrame = roof2.CFrame.mul(CFrame.Angles(-.5, 0, 0)); } break;
		default: error(`Unauthored story prop: ${key}`);
	}
}
export interface StoryLighting { ambient: Color3; light: Color3; direction: Vector3; sky: Color3; }
export const AC04StoryLighting: Record<StoryLight, StoryLighting> = {
	day: { ambient: Color3.fromRGB(150,148,138), light: Color3.fromRGB(255,244,226), direction: new Vector3(-1, -1.4, -.6), sky: Color3.fromRGB(156,186,204) },
	dusk: { ambient: Color3.fromRGB(128,106,94), light: Color3.fromRGB(255,190,142), direction: new Vector3(-1, -.7, -.5), sky: Color3.fromRGB(200,156,124) },
	dawn: { ambient: Color3.fromRGB(144,140,134), light: Color3.fromRGB(255,228,198), direction: new Vector3(1, -.8, -.5), sky: Color3.fromRGB(196,196,190) },
	interior: { ambient: Color3.fromRGB(104,82,62), light: Color3.fromRGB(255,212,160), direction: new Vector3(.4, -1, -.6), sky: Color3.fromRGB(26,32,44) },
	attic: { ambient: Color3.fromRGB(84,84,86), light: Color3.fromRGB(240,220,180), direction: new Vector3(.3, -1, -.4), sky: Color3.fromRGB(14,18,24) },
	blackout: { ambient: Color3.fromRGB(58,80,90), light: Color3.fromRGB(160,200,214), direction: new Vector3(.6, -1, -.3), sky: Color3.fromRGB(12,22,32) },
	birch: { ambient: Color3.fromRGB(164,164,158), light: Color3.fromRGB(240,236,224), direction: new Vector3(-.5, -1, -.5), sky: Color3.fromRGB(226,228,226) },
	study: { ambient: Color3.fromRGB(150,140,124), light: Color3.fromRGB(255,236,206), direction: new Vector3(.2, -1, .6), sky: Color3.fromRGB(196,214,226) },
};
/** Authored framing is for ~1.9:1; narrower lanes pull the camera back so the composition still fits horizontally. */
export const AC04_STORY_AUTHORED_ASPECT = 1.9;
export function storyCameraCFrame(shot: StoryShot, aspect: number): CFrame {
	const focus = vector(shot.focus), eye = vector(shot.eye);
	const scale = aspect > 0 ? math.clamp(AC04_STORY_AUTHORED_ASPECT / aspect, 1, 2.2) : 1;
	return CFrame.lookAt(focus.add(eye.sub(focus).mul(scale)), focus);
}
export function assembleAC04StoryShot(w: Instance, shot: StoryShot): void {
	attachShotSet(w, shot);
	for (const entry of shot.actors) actor(w, entry, vector(shot.eye));
	for (const entry of shot.props) prop(w, entry);
}
export interface AC04StoryStage { readonly camera: Camera; show(index: number): void; reframe(): void; destroy(): void; }
/** One shot resident at a time. No connections, animation clock or Workspace/Lighting changes. */
export function createAC04StoryStage(viewport: ViewportFrame, chapter: AC04StoryChapter): AC04StoryStage {
	const camera = new Instance("Camera"); camera.Name = "AC04StoryCamera"; camera.FieldOfView = 42; camera.Parent = viewport; viewport.CurrentCamera = camera;
	let world: WorldModel | undefined, current: StoryShot | undefined; let alive = true;
	const frame = () => {
		if (!current) return;
		const size = viewport.AbsoluteSize;
		camera.FieldOfView = current.fov;
		camera.CFrame = storyCameraCFrame(current, size.X > 0 && size.Y > 0 ? size.X / size.Y : 0);
	};
	return { camera,
		show(index) {
			if (!alive) return;
			const shot = AC04StoryShots[chapter.id]?.[index]; if (!shot) return;
			world?.Destroy(); world = new Instance("WorldModel"); world.Name = `AC04Story-${chapter.id}-${index + 1}`; world.SetAttribute("Subject", shot.subject); world.Parent = viewport;
			assembleAC04StoryShot(world, shot);
			assert(world.GetDescendants().size() <= AC04_STORY_INSTANCE_LIMIT, "Story stage exceeds native budget");
			const light = AC04StoryLighting[shot.light];
			viewport.Ambient = light.ambient; viewport.LightColor = light.light; viewport.LightDirection = light.direction; viewport.BackgroundColor3 = light.sky;
			current = shot; frame();
		},
		reframe() { if (alive) frame(); },
		destroy() { if (!alive) return; alive = false; world?.Destroy(); world = undefined; current = undefined; if (viewport.CurrentCamera === camera) viewport.CurrentCamera = undefined; camera.Destroy(); },
	};
}
