import { TARGET_BOX_LIMIT, TargetBoxes, TargetBoxFlags, TargetBoxTone } from "../shared/TargetBoxes";
import type { Rectangle } from "../shared/UILayout";
import { HUD, HUD_FONT_BOLD } from "./Theme";

// Ace Combat-style boxes on every valid target in view (the selected one is the
// FlightController's flashing bracket). Validity is the server's: it publishes
// `Damageable` per enemy from the same rule its missiles use. Pooled frames,
// attributes cached from AttributeChanged, one pass per RenderStep.
const COLOR = { required: HUD.Green, optional: HUD.Dim, protected: HUD.Dim } as const;
const OUTLINE = Color3.fromRGB(6, 13, 22);
const WATCHED = new Set(["SkybreakEnemy", "SkybreakOwner", "Damageable", "RequiredTarget", "TargetKind"]);

interface Contact {
	model: Model;
	ground: boolean;
	flags: TargetBoxFlags;
	tone?: TargetBoxTone;
	connection: RBXScriptConnection;
	/** Filled each frame for the boxes that made the cut. */
	distance: number;
	x: number;
	y: number;
	size: number;
	/** Drawn this frame (drone glyphs skip it). */
	boxed: boolean;
}
interface Slot {
	frame: Frame;
	stroke: UIStroke;
	tag: TextLabel;
	x: number;
	y: number;
	size: number;
	tone?: TargetBoxTone;
}

export class TargetBoxOverlay {
	private readonly contacts = new Map<Model, Contact>();
	private readonly ranked: Contact[] = [];
	private readonly slots: Slot[] = [];
	private readonly connections: RBXScriptConnection[] = [];
	private keepouts: readonly Rectangle[] = [];
	private gui?: ScreenGui;
	private userId = 0;

	public Start(folder: Instance, gui: ScreenGui, userId: number): void {
		this.Stop();
		this.gui = gui;
		this.userId = userId;
		for (const child of folder.GetChildren()) this.add(child);
		this.connections.push(folder.ChildAdded.Connect((child) => this.add(child)));
		this.connections.push(folder.ChildRemoved.Connect((child) => this.remove(child)));
	}
	public Stop(): void {
		for (const connection of this.connections) connection.Disconnect();
		this.connections.clear();
		for (const [, contact] of this.contacts) contact.connection.Disconnect();
		this.contacts.clear();
		this.ranked.clear();
		// The frames die with the targeting ScreenGui.
		this.slots.clear();
		this.gui = undefined;
	}
	/** Touch controls in viewport px; boxes never overlap them. */
	public SetKeepouts(keepouts: readonly Rectangle[]): void { this.keepouts = keepouts; }
	public GetKeepouts(): readonly Rectangle[] { return this.keepouts; }
	/** Whether `model` has a box this frame. */
	public IsBoxed(model: Model): boolean { return this.contacts.get(model)?.boxed === true; }

	/**
	 * Boxes the nearest valid on-screen targets other than `selected` (which the caller draws).
	 * `positionOf` gives the world point the player sees for a contact (smoothed clone for jets).
	 */
	public Update(camera: Camera, origin: Vector3, selected: Model | undefined, positionOf: (model: Model, ground: boolean) => Vector3): void {
		const gui = this.gui;
		if (!gui) return;
		const viewport = camera.ViewportSize;
		const ranked = this.ranked;
		ranked.clear();
		for (const [model, contact] of this.contacts) {
			contact.boxed = false;
			if (contact.tone === undefined || model === selected) continue;
			const world = positionOf(model, contact.ground);
			const [screen, onScreen] = camera.WorldToViewportPoint(world);
			// Behind the camera or out of view: no box and no further work (the radar covers it).
			if (!onScreen) continue;
			const distance = world.sub(origin).Magnitude;
			const size = TargetBoxes.Size(distance, viewport.Y);
			if (!TargetBoxes.Fits(screen.X, screen.Y, size, viewport.X, viewport.Y, this.keepouts)) continue;
			contact.distance = distance; contact.x = math.floor(screen.X + 0.5); contact.y = math.floor(screen.Y + 0.5); contact.size = size;
			ranked.push(contact);
		}
		const count = TargetBoxes.Rank(ranked, TARGET_BOX_LIMIT, selected ? 1 : 0);
		for (let index = 0; index < count; index++) {
			const contact = ranked[index];
			contact.boxed = true;
			const slot = this.slots[index] ?? this.createSlot(gui, index);
			if (contact.x !== slot.x || contact.y !== slot.y) { slot.x = contact.x; slot.y = contact.y; slot.frame.Position = UDim2.fromOffset(contact.x, contact.y); }
			if (contact.size !== slot.size) { slot.size = contact.size; slot.frame.Size = UDim2.fromOffset(contact.size, contact.size); }
			if (contact.tone !== slot.tone) {
				slot.tone = contact.tone;
				const color = COLOR[contact.tone!];
				slot.stroke.Color = color; slot.tag.TextColor3 = color;
				// Raiders read a step quieter than mission targets; only mission targets carry TGT.
				slot.stroke.Transparency = contact.tone === "required" ? 0.05 : 0.3;
				slot.tag.Visible = contact.tone === "required";
			}
			if (!slot.frame.Visible) slot.frame.Visible = true;
		}
		for (let index = count; index < this.slots.size(); index++) if (this.slots[index].frame.Visible) this.slots[index].frame.Visible = false;
	}

	private createSlot(gui: ScreenGui, index: number): Slot {
		const frame = new Instance("Frame");
		frame.Name = "TargetBox";
		frame.AnchorPoint = new Vector2(0.5, 0.5);
		frame.BackgroundTransparency = 1;
		frame.Visible = false;
		const stroke = new Instance("UIStroke");
		stroke.Thickness = 1.5;
		stroke.Parent = frame;
		const tag = new Instance("TextLabel");
		tag.Name = "Tgt";
		tag.BackgroundTransparency = 1;
		tag.AnchorPoint = new Vector2(0, 1);
		tag.Position = new UDim2(1, 2, 0, 1);
		tag.Size = UDim2.fromOffset(24, 10);
		tag.FontFace = HUD_FONT_BOLD;
		tag.TextSize = 9;
		tag.TextXAlignment = Enum.TextXAlignment.Left;
		tag.Text = "TGT";
		tag.TextStrokeColor3 = OUTLINE;
		tag.TextStrokeTransparency = 0.45;
		tag.Visible = false;
		tag.Parent = frame;
		frame.Parent = gui;
		const slot: Slot = { frame, stroke, tag, x: -1, y: -1, size: -1 };
		this.slots[index] = slot;
		return slot;
	}
	private add(child: Instance): void {
		if (!child.IsA("Model") || this.contacts.has(child)) return;
		const contact: Contact = {
			model: child, ground: false, flags: { enemy: undefined, owner: undefined, damageable: undefined, required: undefined },
			connection: child.AttributeChanged.Connect((name) => { if (WATCHED.has(name)) this.refresh(contact); }),
			distance: 0, x: 0, y: 0, size: 0, boxed: false,
		};
		this.refresh(contact);
		this.contacts.set(child, contact);
	}
	private remove(child: Instance): void {
		if (!child.IsA("Model")) return;
		const contact = this.contacts.get(child);
		if (!contact) return;
		contact.connection.Disconnect();
		this.contacts.delete(child);
	}
	private refresh(contact: Contact): void {
		const model = contact.model, flags = contact.flags;
		flags.enemy = model.GetAttribute("SkybreakEnemy");
		flags.owner = model.GetAttribute("SkybreakOwner");
		flags.damageable = model.GetAttribute("Damageable");
		flags.required = model.GetAttribute("RequiredTarget");
		contact.ground = model.GetAttribute("TargetKind") === "ground";
		contact.tone = TargetBoxes.Tone(flags, this.userId);
	}
}
