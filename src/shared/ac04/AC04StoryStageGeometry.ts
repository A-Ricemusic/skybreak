/** Native, untextured story geometry; owned exclusively by a viewport WorldModel.
 * Every part is anchored and excluded from collision, touch and query. No meshes, decals or uploaded assets. */
export const PAPER = Color3.fromRGB(230,219,191), INK = Color3.fromRGB(20,29,39), GOLD = Color3.fromRGB(219,188,112);
export const WARM = Color3.fromRGB(150,108,74), BLUE = Color3.fromRGB(55,85,105), YELLOW = Color3.fromRGB(226,183,46);
export const STONE = Color3.fromRGB(128,124,112), CONCRETE = Color3.fromRGB(104,106,104), GRASS = Color3.fromRGB(96,118,72);
export type V = [number, number, number];
export function vector(v: V): Vector3 { return new Vector3(v[0], v[1], v[2]); }
export function part(parent: Instance, name: string, size: V, pos: V, color: Color3, material: Enum.Material = Enum.Material.SmoothPlastic, rotation: V = [0, 0, 0]): Part {
	const result = new Instance("Part");
	result.Name = name; result.Size = vector(size); result.CFrame = new CFrame(vector(pos)).mul(CFrame.Angles(rotation[0], rotation[1], rotation[2]));
	result.Anchored = true; result.CanCollide = false; result.CanTouch = false; result.CanQuery = false; result.CastShadow = false;
	result.TopSurface = Enum.SurfaceType.Smooth; result.BottomSurface = Enum.SurfaceType.Smooth;
	result.Color = color; result.Material = material; result.Parent = parent; return result;
}
export function ball(parent: Instance, name: string, size: V, pos: V, color: Color3, material: Enum.Material = Enum.Material.SmoothPlastic): Part {
	const result = part(parent, name, size, pos, color, material); result.Shape = Enum.PartType.Ball; return result;
}
/** Cylinder whose round faces point along local X. */
export function cylinder(parent: Instance, name: string, length: number, diameter: number, pos: V, color: Color3, rotation: V = [0, 0, 0]): Part {
	const result = part(parent, name, [length, diameter, diameter], pos, color, Enum.Material.SmoothPlastic, rotation); result.Shape = Enum.PartType.Cylinder; return result;
}
export function line(parent: Instance, name: string, a: V, b: V, width: number, color: Color3, depth = width): Part {
	const from = vector(a), to = vector(b), center = from.add(to).mul(.5);
	const result = part(parent, name, [width, depth, math.max(.02, to.sub(from).Magnitude)], [center.X, center.Y, center.Z], color);
	result.CFrame = CFrame.lookAt(center, to, math.abs(to.sub(from).Unit.Y) > .98 ? Vector3.xAxis : Vector3.yAxis); return result;
}
export function group(parent: Instance, name: string): Model { const m = new Instance("Model"); m.Name = name; m.Parent = parent; return m; }

/** Stroke capitals for markings that must be legible without SurfaceGui (which ViewportFrames do not render).
 * Grid is 2 wide by 4 high; strokes are drawn on the frame's local XY plane, facing +Z. */
const GLYPHS: Record<string, [number, number, number, number][]> = {
	"1": [[1,0,1,4]],
	"3": [[0,4,2,4],[2,4,2,0],[0,2,2,2],[0,0,2,0]],
	T: [[0,4,2,4],[1,4,1,0]],
	O: [[0,0,2,0],[2,0,2,4],[2,4,0,4],[0,4,0,0]],
	M: [[0,0,0,4],[0,4,1,2],[1,2,2,4],[2,4,2,0]],
	B: [[0,0,0,4],[0,4,1.6,4],[1.6,4,1.6,2],[0,2,2,2],[2,2,2,0],[2,0,0,0]],
	I: [[1,0,1,4],[.4,4,1.6,4],[.4,0,1.6,0]],
	U: [[0,4,0,0],[0,0,2,0],[2,0,2,4]],
	S: [[2,4,0,4],[0,4,0,2],[0,2,2,2],[2,2,2,0],[2,0,0,0]],
	N: [[0,0,0,4],[0,4,2,0],[2,0,2,4]],
	E: [[2,4,0,4],[0,4,0,0],[0,0,2,0],[0,2,1.5,2]],
	" ": [],
};
export function glyphs(parent: Instance, name: string, text: string, frame: CFrame, height: number, color: Color3, stroke = height * .16): number {
	const unit = height / 4; let cursor = 0, count = 0;
	for (const [character] of text.gmatch(".")) {
		const strokes = GLYPHS[character as string];
		assert(strokes !== undefined, `No story glyph for ${character}`);
		for (const [x1, y1, x2, y2] of strokes) {
			const a = frame.PointToWorldSpace(new Vector3((cursor + x1) * unit, y1 * unit, 0)), b = frame.PointToWorldSpace(new Vector3((cursor + x2) * unit, y2 * unit, 0));
			const center = a.add(b).mul(.5), stroked = part(parent, name, [stroke, stroke, a.sub(b).Magnitude + stroke], [center.X, center.Y, center.Z], color);
			stroked.CFrame = CFrame.lookAt(center, b, frame.LookVector); count++;
		}
		cursor += 3;
	}
	return count;
}

/** Plastered house with a pitched roof and windows facing +Z. */
export function house(parent: Instance, x: number, z: number, height = 9, lit = false, width = 8, wall = Color3.fromRGB(146,137,118), yaw = 0): void {
	const m = group(parent, "Townhouse");
	part(m, "Plaster wall", [width, height, 7], [0, height / 2, 0], wall);
	for (const side of [-1, 1]) part(m, "Pitched roof", [width + .8, .5, 4.6], [0, height + 1.1, side * 1.75], Color3.fromRGB(104,62,48), Enum.Material.SmoothPlastic, [side * .55, 0, 0]);
	part(m, "Roof ridge", [width + .8, .5, .5], [0, height + 2.2, 0], Color3.fromRGB(80,50,40));
	part(m, "Closed door", [1.8, 3.4, .14], [-width / 4, 1.7, 3.55], Color3.fromRGB(70,48,36));
	for (const fx of [-width / 4, width / 4]) for (const y of height > 7 ? [height - 2.4, 3.2] : [height - 2.4]) {
		if (y === 3.2 && fx < 0) continue;
		part(m, "Window", [1.5, 1.9, .15], [fx, y, 3.56], lit ? GOLD : Color3.fromRGB(46,62,74), lit ? Enum.Material.Neon : Enum.Material.SmoothPlastic);
		part(m, "Window sill", [1.9, .2, .45], [fx, y - 1.05, 3.7], PAPER);
		for (const s of [-1, 1]) part(m, "Shutter", [.55, 1.9, .1], [fx + s * 1.05, y, 3.6], Color3.fromRGB(70,92,82));
	}
	m.PivotTo(new CFrame(x, 0, z).mul(CFrame.Angles(0, yaw, 0)));
}
/** A row of attached facades along X, facing +Z by default. */
export function facades(parent: Instance, x0: number, z: number, count: number, yaw = 0, seed = 0, lit = false): void {
	const colours = [Color3.fromRGB(158,142,118), Color3.fromRGB(132,128,116), Color3.fromRGB(168,150,128), Color3.fromRGB(121,112,100)];
	const row = group(parent, "Facade row");
	for (let i = 0; i < count; i++) house(row, i * 8.2, 0, 8 + ((i + seed) % 3) * 2.5, lit && (i + seed) % 2 === 0, 8, colours[(i + seed) % 4]);
	row.PivotTo(new CFrame(x0, 0, z).mul(CFrame.Angles(0, yaw, 0)));
}
/** Chair oriented like a seated actor: occupant faces local -Z, so the back sits at +Z behind the occupant. */
export function chair(parent: Instance, cf: CFrame, name = "Empty chair"): Model {
	const m = group(parent, name);
	part(m, "Chair seat", [1.9, .2, 1.7], [0, 1.22, -.3], WARM, Enum.Material.Wood);
	part(m, "Chair back", [1.9, 1.6, .18], [0, 2.35, .62], WARM, Enum.Material.Wood);
	for (const dx of [-.8, .8]) {
		for (const dz of [-1, .5]) part(m, "Chair leg", [.16, 1.15, .16], [dx, .58, dz], WARM, Enum.Material.Wood);
		part(m, "Chair back post", [.16, 1.9, .16], [dx, 2.1, .62], WARM, Enum.Material.Wood);
	}
	m.PivotTo(cf); return m;
}
export function stageTable(parent: Instance, x: number, z: number, width = 3.6, depth = 2.4, round = false): Model {
	const m = group(parent, "Prop-table");
	const top = part(m, "Table top", [round ? depth : width, .2, depth], [x, 2.7, z], WARM, Enum.Material.Wood);
	if (round) { top.Shape = Enum.PartType.Cylinder; top.Size = new Vector3(.2, depth, depth); top.CFrame = new CFrame(x, 2.7, z).mul(CFrame.Angles(0, 0, math.pi / 2)); part(m, "Table pedestal", [.3, 2.6, .3], [x, 1.3, z], WARM, Enum.Material.Wood); }
	else for (const dx of [-width / 2 + .2, width / 2 - .2]) for (const dz of [-depth / 2 + .2, depth / 2 - .2]) part(m, "Table leg", [.18, 2.6, .18], [x + dx, 1.3, z + dz], WARM, Enum.Material.Wood);
	return m;
}
export function paper(parent: Instance, cf: CFrame, lines = 7, w = 1.5, d = 1.9): Model {
	const m = group(parent, "Prop-paper");
	const sheet = part(m, "Letter paper", [w, .03, d], [0, 0, 0], PAPER); sheet.CFrame = cf;
	for (let row = 0; row < lines; row++) { const l = part(m, row === lines - 1 ? "Signature line" : "Handwritten line", [row === lines - 1 ? w * .4 : w * .78, .012, .05], [0, 0, 0], BLUE); l.CFrame = cf.mul(new CFrame(row === lines - 1 ? -w * .19 : 0, .022, -d / 2 + .3 + row * (d - .5) / math.max(1, lines - 1))); }
	return m;
}
/** Fighter silhouette, nose toward -Z; twin canted fins, canards and swept wings. Yellow squadron markings optional. */
export function jet(parent: Instance, cf: CFrame, scale = 1, yellow = true, name = "Prop-fighter", tailNumber?: string): Model {
	const m = group(parent, name), s = scale;
	const body = Color3.fromRGB(84,96,104), dark = Color3.fromRGB(52,60,66);
	part(m, "Aircraft fuselage", [1.3 * s, .9 * s, 7.6 * s], [0, 0, 0], body);
	ball(m, "Aircraft nose", [1 * s, .8 * s, 2.6 * s], [0, -.02 * s, -4.4 * s], body);
	ball(m, "Canopy", [.75 * s, .7 * s, 1.9 * s], [0, .5 * s, -2.4 * s], Color3.fromRGB(32,44,58), Enum.Material.Glass);
	for (const side of [-1, 1]) {
		part(m, "Aircraft wing", [3.6 * s, .14 * s, 2.6 * s], [side * 2.3 * s, -.05 * s, .9 * s], body, Enum.Material.SmoothPlastic, [0, -side * .45, 0]);
		part(m, "Wingtip band", [.7 * s, .16 * s, 1.1 * s], [side * 3.9 * s, -.05 * s, 1.85 * s], yellow ? YELLOW : dark, Enum.Material.SmoothPlastic, [0, -side * .45, 0]);
		part(m, "Canard", [1.3 * s, .1 * s, .7 * s], [side * 1.1 * s, .1 * s, -2.9 * s], body, Enum.Material.SmoothPlastic, [0, -side * .5, 0]);
		part(m, "Engine intake", [.7 * s, .7 * s, 2.4 * s], [side * .55 * s, -.45 * s, -.6 * s], dark);
		cylinder(m, "Engine nozzle", .5 * s, .62 * s, [side * .42 * s, -.05 * s, 3.95 * s], dark, [0, math.pi / 2, 0]);
		part(m, "Tailplane", [1.6 * s, .1 * s, 1.1 * s], [side * 1.25 * s, -.05 * s, 3.4 * s], body, Enum.Material.SmoothPlastic, [0, -side * .35, 0]);
		const fin = part(m, "Tail fin", [.12 * s, 1.7 * s, 1.5 * s], [side * .75 * s, .95 * s, 2.9 * s], body, Enum.Material.SmoothPlastic, [-.35, 0, -side * .18]);
		if (yellow) {
			const tip = part(m, "Yellow tail band", [.14 * s, .45 * s, 1.35 * s], [0, 0, 0], YELLOW); tip.CFrame = fin.CFrame.mul(new CFrame(0, .62 * s, -.05 * s));
			if (tailNumber !== undefined) glyphs(m, "Tail number", tailNumber, fin.CFrame.mul(new CFrame(side * .08 * s, -.62 * s, .55 * s)).mul(CFrame.Angles(0, side * math.pi / 2, 0)), .75 * s, YELLOW, .12 * s);
		}
	}
	m.PivotTo(cf); return m;
}
/** Boarding ladder hooked over a cockpit sill; rails rise from foot toward top. */
export function ladder(parent: Instance, foot: Vector3, top: Vector3): Model {
	const m = group(parent, "Prop-ladder"), across = top.sub(foot).Cross(Vector3.yAxis).Unit.mul(.45);
	for (const side of [-1, 1]) { const o = across.mul(side); line(m, "Ladder rail", [foot.X + o.X, foot.Y, foot.Z + o.Z], [top.X + o.X, top.Y, top.Z + o.Z], .12, Color3.fromRGB(196,190,170)); }
	for (let i = 1; i < 8; i++) { const p = foot.Lerp(top, i / 8); line(m, "Ladder rung", [p.X - across.X, p.Y, p.Z - across.Z], [p.X + across.X, p.Y, p.Z + across.Z], .09, Color3.fromRGB(196,190,170)); }
	return m;
}
export function wheat(parent: Instance, x: number, z: number, width: number, depth: number, rows: number, ripe = true): void {
	const m = group(parent, "Wheat field");
	part(m, "Field soil", [width, .2, depth], [x, .1, z], Color3.fromRGB(112,94,64));
	for (let i = 0; i < rows; i++) {
		const rx = x - width / 2 + (i + .5) * width / rows, tone = ripe ? Color3.fromRGB(196 - (i % 3) * 14, 168 - (i % 2) * 12, 82) : Color3.fromRGB(128,150,78);
		part(m, "Wheat row", [width / rows * .62, 1.1 + (i % 3) * .2, depth], [rx, .7 + (i % 3) * .1, z], tone, Enum.Material.Grass);
		part(m, "Wheat heads", [width / rows * .5, .25, depth - .4], [rx, 1.4 + (i % 3) * .2, z], Color3.fromRGB(222,190,104), Enum.Material.Grass);
	}
}
export function highway(parent: Instance, damaged = false, civilian = false): void {
	const m = group(parent, "Highway runway");
	part(m, "Highway runway", [16, .2, 110], [0, .1, -20], Color3.fromRGB(78,80,80), Enum.Material.Concrete);
	for (let i = 0; i < 10; i++) part(m, "Lane marking", [.35, .03, 4], [0, .22, 26 - i * 9], PAPER);
	for (const side of [1, -1]) {
		part(m, "Shoulder line", [.25, .03, 110], [side * 7.3, .22, -20], PAPER);
		for (let i = 0; i < 9; i++) part(m, "Guardrail post", [.2, 1, .2], [side * 8.6, .5, 24 - i * 9], Color3.fromRGB(170,170,160));
		part(m, "Guardrail", [.14, .35, 80], [side * 8.6, .9, -12], Color3.fromRGB(184,184,176));
		wheat(m, side * 21, -8, 24, 70, 8, !civilian);
	}
	part(m, "Hillside above tunnel", [70, 14, 22], [0, 7, -66], Color3.fromRGB(88,106,70), Enum.Material.Grass);
	part(m, "Tunnel portal", [20, 10, 1.2], [0, 5, -54.6], Color3.fromRGB(150,150,142), Enum.Material.Concrete);
	part(m, "Tunnel mouth", [14, 7, .3], [0, 3.5, -53.9], INK);
	part(m, "Tunnel lintel", [20, 1.2, 1.8], [0, 10.4, -54.4], Color3.fromRGB(128,128,120), Enum.Material.Concrete);
	if (damaged) {
		part(m, "Runway crater", [7, .14, 6], [1, .24, -4], Color3.fromRGB(30,28,26), Enum.Material.Slate, [0, .3, 0]);
		part(m, "Scorched concrete", [11, .1, 9], [1, .2, -4], Color3.fromRGB(46,44,42), Enum.Material.Concrete, [0, -.2, 0]);
		for (let i = 0; i < 7; i++) part(m, "Broken concrete", [1.8, .7, 1.4], [-3.5 + i * 1.4, .45, -1 - (i % 3) * 2.6], Color3.fromRGB(126,124,114), Enum.Material.Concrete, [.25 * i, .4 * i, .15]);
		for (let i = 0; i < 3; i++) part(m, "Smoke plume", [3 + i, 3 + i, 3 + i], [2 + i * .8, 3 + i * 3.5, -6 - i], Color3.fromRGB(60,58,56), Enum.Material.SmoothPlastic, [i, i, 0]).Transparency = .35 + i * .15;
	}
}
export function birch(parent: Instance, x: number, z: number, height: number, lean = 0): void {
	const trunk = part(parent, "Birch trunk", [.45, height, .45], [x, height / 2, z], Color3.fromRGB(226,224,214), Enum.Material.SmoothPlastic, [lean, 0, lean * .5]);
	for (let i = 0; i < 3; i++) { const mark = part(parent, "Birch bark mark", [.5, .14, .5], [0, 0, 0], Color3.fromRGB(40,40,38)); mark.CFrame = trunk.CFrame.mul(new CFrame(0, -height / 2 + 1.4 + i * height / 4, 0)); }
	line(parent, "Bare branch", [x, height * .7, z], [x + 1.6, height * .9, z - .5], .12, Color3.fromRGB(96,90,84));
}
/** Low-cost clothed background figure (no face detail) for crowds and patrols. */
export function figure(parent: Instance, x: number, z: number, coat: Color3, yaw = 0, arms = false, height = 1): void {
	const m = group(parent, "Background figure"), h = height;
	part(m, "Clothed coat", [1.5 * h, 2.4 * h, .8 * h], [0, 3 * h, 0], coat);
	part(m, "Trousers", [1.3 * h, 1.9 * h, .7 * h], [0, .95 * h, 0], Color3.fromRGB(44,44,48));
	ball(m, "Head", [1 * h, 1.1 * h, 1 * h], [0, 4.85 * h, 0], Color3.fromRGB(176,150,120));
	part(m, "Hair or cap", [1.05 * h, .4 * h, 1.05 * h], [0, 5.3 * h, 0], Color3.fromRGB(58,46,36));
	if (arms) for (const s of [-1, 1]) line(m, "Raised sleeve", [s * .7 * h, 3.9 * h, 0], [s * 1.1 * h, 5.6 * h, -.3 * h], .4 * h, coat);
	m.PivotTo(new CFrame(x, 0, z).mul(CFrame.Angles(0, yaw, 0)));
}
/** Period saloon car, nose toward -Z. */
export function car(parent: Instance, cf: CFrame, body: Color3, name: string, headlights = false): Model {
	const m = group(parent, name);
	part(m, `${name} body`, [3, 1.3, 6], [0, 1.15, 0], body);
	part(m, `${name} cabin`, [2.6, 1.15, 3], [0, 2.35, .4], body);
	part(m, "Windshield", [2.4, .9, .1], [0, 2.4, -1.12], Color3.fromRGB(40,58,70), Enum.Material.Glass, [-.3, 0, 0]);
	for (const side of [-1, 1]) {
		part(m, "Side window", [.08, .75, 2.4], [side * 1.31, 2.4, .4], Color3.fromRGB(40,58,70), Enum.Material.Glass);
		for (const dz of [-1.9, 1.9]) cylinder(m, "Car wheel", .5, 1.1, [side * 1.4, .55, dz], INK);
		part(m, "Headlamp", [.5, .4, .1], [side * 1.05, 1.3, -3.02], headlights ? Color3.fromRGB(255,240,200) : PAPER, headlights ? Enum.Material.Neon : Enum.Material.SmoothPlastic);
	}
	m.PivotTo(cf); return m;
}
export function lamp(parent: Instance, x: number, z: number, lit: boolean): void {
	part(parent, "Street lamp post", [.25, 7, .25], [x, 3.5, z], INK);
	line(parent, "Street lamp arm", [x, 7, z], [x + 1.2, 7.2, z], .15, INK);
	ball(parent, "Street lamp globe", [.7, .7, .7], [x + 1.2, 6.8, z], lit ? GOLD : Color3.fromRGB(60,70,76), lit ? Enum.Material.Neon : Enum.Material.Glass);
}
export function gull(parent: Instance, x: number, y: number, z: number, s = 1): void {
	for (const side of [-1, 1]) line(parent, "Gull wing", [x, y, z], [x + side * 1.1 * s, y + .45 * s, z], .12 * s, Color3.fromRGB(238,238,232), .05);
}
