import { viewportOrigin } from "./ViewportGui";
import { TARGET_BOX_LIMIT, TARGET_TAG_GAP, TARGET_TAG_HEIGHT, TARGET_TAG_RISE, TARGET_TAG_WIDTH, TargetBoxes, TargetBoxFlags, TargetBoxTone, TargetTagSide } from "../shared/TargetBoxes";
import type { Rectangle } from "../shared/UILayout";
import { HUD, HUD_FONT_BOLD } from "./Theme";

// Ace Combat-style boxes on every valid target in view (the selected one is the
// FlightController's flashing bracket). Validity is the server's: it publishes
// `Damageable` per enemy from the same rule its missiles use. Pooled frames,
// attributes cached from AttributeChanged, one pass per RenderStep. Boxes and
// their TGT tags stay inside the safe area and off the touch controls.
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
	tagLabel: TextLabel;
	size: number;
	tone?: TargetBoxTone;
	/** Where the TGT tag sits; undefined hides it. */
	tag?: TargetTagSide;
}

export class TargetBoxOverlay {
	private readonly contacts = new Map<Model, Contact>();
	private readonly ranked: Contact[] = [];
	private readonly slots: Slot[] = [];
	private readonly connections: RBXScriptConnection[] = [];
	private keepouts: readonly Rectangle[] = [];
	private bounds?: Rectangle;
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
		// Stop/Start can reuse a live ScreenGui; the overlay owns these frames.
		for (const slot of this.slots) slot.frame.Destroy();
		this.slots.clear();
		this.gui = undefined;
		this.keepouts = []; this.bounds = undefined;
	}
	/** Touch controls in viewport px and the safe area (TargetBoxes.Bounds): boxes and their text keep inside it and off them. */
	public SetPlacement(keepouts: readonly Rectangle[], bounds: Rectangle): void { this.keepouts = keepouts; this.bounds = bounds; }
	public GetKeepouts(): readonly Rectangle[] { return this.keepouts; }
	public GetBounds(): Rectangle | undefined { return this.bounds; }
	/** Whether `model` has a box this frame. */
	public IsBoxed(model: Model): boolean { return this.contacts.get(model)?.boxed === true; }

	/**
	 * Boxes the nearest valid on-screen targets other than `selected` (which the caller draws).
	 * `positionOf` gives the world point the player sees for a contact (smoothed clone for jets).
	 */
	public Update(camera: Camera, origin: Vector3, selected: Model | undefined, positionOf: (model: Model, ground: boolean) => Vector3): void {
		const gui = this.gui, bounds = this.bounds, keepouts = this.keepouts;
		if (!gui || !bounds) return;
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
			const x = math.floor(screen.X + 0.5), y = math.floor(screen.Y + 0.5);
			if (!TargetBoxes.Fits(x, y, size, bounds, keepouts)) continue;
			contact.distance = distance; contact.x = x; contact.y = y; contact.size = size;
			ranked.push(contact);
		}
		// One slot always stays the selected bracket's, so at most TARGET_BOX_LIMIT box frames ever exist.
		const count = TargetBoxes.Rank(ranked, TARGET_BOX_LIMIT, 1);
		// All slots share the same inset and rendered parent geometry this frame.
		const guiOrigin = count > 0 ? viewportOrigin(gui) : Vector2.zero;
		const guiSize = gui.AbsoluteSize;
		const width = math.max(1, guiSize.X), height = math.max(1, guiSize.Y);
		for (let index = 0; index < count; index++) {
			const contact = ranked[index];
			contact.boxed = true;
			const slot = this.slots[index] ?? this.createSlot(gui, index);
			// Re-evaluate even for a stationary target: topbar/safe-area geometry can change.
			slot.frame.Position = UDim2.fromScale((contact.x - guiOrigin.X) / width, (contact.y - guiOrigin.Y) / height);
			if (contact.size !== slot.size) { slot.size = contact.size; slot.frame.Size = UDim2.fromOffset(contact.size, contact.size); }
			if (contact.tone !== slot.tone) {
				slot.tone = contact.tone;
				const color = COLOR[contact.tone!];
				slot.stroke.Color = color; slot.tagLabel.TextColor3 = color;
				// Raiders read a step quieter than mission targets; only mission targets carry TGT.
				slot.stroke.Transparency = contact.tone === "required" ? 0.05 : 0.3;
			}
			// The TGT tag goes right of the box, else left, else not at all: it never covers a control or leaves the safe area.
			const tag = contact.tone === "required" ? TargetBoxes.PlaceTag(contact.x, contact.y, contact.size, bounds, keepouts) : undefined;
			if (tag !== slot.tag) {
				slot.tag = tag;
				slot.tagLabel.Visible = tag !== undefined;
				if (tag === "right") {
					slot.tagLabel.AnchorPoint = new Vector2(0, 0); slot.tagLabel.Position = new UDim2(1, TARGET_TAG_GAP, 0, -TARGET_TAG_RISE);
					slot.tagLabel.TextXAlignment = Enum.TextXAlignment.Left;
				} else if (tag === "left") {
					slot.tagLabel.AnchorPoint = new Vector2(1, 0); slot.tagLabel.Position = new UDim2(0, -TARGET_TAG_GAP, 0, -TARGET_TAG_RISE);
					slot.tagLabel.TextXAlignment = Enum.TextXAlignment.Right;
				}
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
		tag.Size = UDim2.fromOffset(TARGET_TAG_WIDTH, TARGET_TAG_HEIGHT);
		tag.FontFace = HUD_FONT_BOLD;
		tag.TextSize = 9;
		tag.TextXAlignment = Enum.TextXAlignment.Left;
		tag.Text = "TGT";
		tag.TextStrokeColor3 = OUTLINE;
		tag.TextStrokeTransparency = 0.45;
		tag.Visible = false;
		tag.Parent = frame;
		frame.Parent = gui;
		const slot: Slot = { frame, stroke, tagLabel: tag, size: -1 };
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
