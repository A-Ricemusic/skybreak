import { GuiService, Players, RunService, UserInputService } from "@rbxts/services";
import { getCinematicLayout } from "../shared/CinematicLayout";
import { Story } from "../shared/Story";
import { MissionCatalog } from "../shared/MissionCatalog";

let active = false;
let currentGui: ScreenGui | undefined;
let readAtOwnPace = false;
let reduceMotion = false;
function block(parent: Instance, name: string, size: Vector3, position: Vector3, color: Color3): Part {
	const part = new Instance("Part"); part.Name = name; part.Size = size; part.Position = position;
	part.Color = color; part.Material = Enum.Material.SmoothPlastic; part.Anchored = true;
	part.CanCollide = false; part.CanTouch = false; part.CanQuery = false; part.Parent = parent; return part;
}
function label(parent: Instance, text: string, position: UDim2, size: UDim2, fontSize: number): TextLabel {
	const item = new Instance("TextLabel"); item.BackgroundTransparency = 1; item.Text = text;
	item.Position = position; item.Size = size; item.TextSize = fontSize; item.Font = Enum.Font.GothamMedium;
	item.TextColor3 = Color3.fromRGB(244,242,227); item.TextWrapped = true; item.TextScaled = true;
	const textBounds = new Instance("UITextSizeConstraint"); textBounds.MinTextSize = 11; textBounds.MaxTextSize = fontSize; textBounds.Parent = item; item.Parent = parent; return item;
}
function button(parent: Instance, text: string, x: number, callback: () => void): TextButton {
	const item = new Instance("TextButton"); item.Text = text; item.Size = new UDim2(0.3,0,0,48);
	item.Position = new UDim2(x,0,1,-56); item.BackgroundColor3 = Color3.fromRGB(22,49,61);
	item.TextColor3 = Color3.fromRGB(225,244,238); item.TextSize = 13; item.TextWrapped = true;
	item.Font = Enum.Font.GothamBold; item.Parent = parent; item.Activated.Connect(callback); return item;
}
function jet(parent: Instance, name: string, color: Color3): Model {
	const model = new Instance("Model"); model.Name = name;
	const body = block(model,"Fuselage",new Vector3(4,3,21),Vector3.zero,color);
	block(model,"Wings",new Vector3(24,1,7),new Vector3(0,0,3),color);
	block(model,"Canopy",new Vector3(3,2,7),new Vector3(0,2,-3),Color3.fromRGB(31,92,115));
	block(model,"Tail",new Vector3(1,7,5),new Vector3(0,3,8),color);
	model.PrimaryPart = body; model.Parent = parent; return model;
}

// Isolated WorldModel + Camera: no second Workspace camera writer, no mission
// timer, no server gameplay mutation. All parts and input connections are owned
// by this bounded call and destroyed on natural completion, skip, or UI teardown.
export const CutscenePlayer = {
	IsActive(): boolean { return active; },
	Stop(): void { currentGui?.Destroy(); },
	Play(sceneId: number): void {
		if (active) return;
		active = true;
		const gui = new Instance("ScreenGui"); gui.Name = "GlassHorizonCinema";
		currentGui = gui;
		gui.DisplayOrder = 60; gui.ResetOnSpawn = false; gui.IgnoreGuiInset = false;
		gui.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets;
		const previousSelection = GuiService.SelectedObject;
		let input: RBXScriptConnection | undefined;
		let resized: RBXScriptConnection | undefined;
		const [ok, problem] = pcall(() => {
			const scene = Story.Get(sceneId);
			const root = new Instance("Frame"); root.Size = UDim2.fromScale(1,1); root.BackgroundColor3 = Color3.fromRGB(5,13,22); root.Parent = gui;
			const viewport = new Instance("ViewportFrame"); viewport.BackgroundColor3 = Color3.fromRGB(47,90,118);
			viewport.Position = UDim2.fromOffset(0,32); viewport.Size = new UDim2(1,0,1,-180);
			viewport.Ambient = Color3.fromRGB(170,179,194); viewport.LightColor = Color3.fromRGB(255,226,185);
			viewport.LightDirection = new Vector3(-1,-1,-0.5); viewport.Parent = root;
			const world = new Instance("WorldModel"); world.Parent = viewport;
			const camera = new Instance("Camera"); camera.FieldOfView = 48; camera.Parent = viewport; viewport.CurrentCamera = camera;
			const env = MissionCatalog.Get(math.min(sceneId,27)).environmentId;
			const desert = env.find("desert")[0] !== undefined;
			const mountain = env.find("mountain")[0] !== undefined;
			block(world,"Sea",new Vector3(2000,4,2000),new Vector3(0,-16,0),desert ? Color3.fromRGB(187,148,96) : Color3.fromRGB(26,91,125));
			for (let i=0;i<5;i++) {
				const height = mountain ? 100 + (i%3)*60 : 25 + (i%3)*12;
				const island = block(world,"Island",new Vector3(130,height,150),new Vector3(-300+i*150,-15,-160-(i%2)*170),desert ? Color3.fromRGB(169,123,77) : Color3.fromRGB(96,125,104));
				island.Orientation = new Vector3(0,i*27,0);
			}
			const playerJet = jet(world,"Kestrel",Color3.fromRGB(224,229,216));
			const wingmate = jet(world,"Vale",sceneId < 10 ? Color3.fromRGB(167,82,58) : Color3.fromRGB(68,182,186));
			const relay = new Instance("Model"); relay.Name = "Network Relay";
			const mast = block(relay,"Mast",new Vector3(6,55,6),new Vector3(0,20,-130),Color3.fromRGB(70,82,88));
			const dish = block(relay,"Dish",new Vector3(35,20,5),new Vector3(0,50,-130),Color3.fromRGB(196,201,190));
			block(relay,"Signal",new Vector3(7,7,7),new Vector3(0,64,-130),sceneId === 28 ? Color3.fromRGB(53,207,159) : Color3.fromRGB(244,147,55));
			relay.PrimaryPart = mast; relay.Parent = world;
			block(world,"CarrierHull",new Vector3(34,14,150),new Vector3(85,-5,30),Color3.fromRGB(55,67,79));
			block(world,"FlightDeck",new Vector3(42,2,160),new Vector3(85,3,30),Color3.fromRGB(122,131,133));
			block(world,"Bridge",new Vector3(12,23,22),new Vector3(102,16,50),Color3.fromRGB(190,196,193));
			const heading = label(root,scene.title,new UDim2(0.04,0,0,0),new UDim2(0.92,0,0,28),19);
			const subtitle = label(root,"",new UDim2(0.045,0,1,-144),new UDim2(0.91,0,0,64),18);
			const hint = label(root,"",new UDim2(0.04,0,1,-80),new UDim2(0.92,0,0,20),12);
			let beatIndex = 0, beatTime = 0, skipped = false, advanceRequested = false;
			const advance = () => { advanceRequested = true; };
			const skip = button(root,"SKIP · B / Esc",0.025,() => { skipped = true; });
			const pace = button(root,"AUTO · toggle reading pace",0.35,() => { readAtOwnPace = !readAtOwnPace; });
			const motion = button(root,"MOTION · toggle",0.675,() => { reduceMotion = !reduceMotion; });
			skip.Name = "SkipCutsceneButton"; pace.Name = "ReadingPaceButton"; motion.Name = "ReducedMotionButton";
			subtitle.Name = "StorySubtitle"; hint.Name = "StoryHint";
			skip.Size = new UDim2(0.3,0,0,48);
			input = UserInputService.InputBegan.Connect((event,processed) => {
				if (processed || UserInputService.GetFocusedTextBox()) return;
				if (event.KeyCode === Enum.KeyCode.Escape || event.KeyCode === Enum.KeyCode.ButtonB) skipped = true;
				if (event.KeyCode === Enum.KeyCode.Space || event.KeyCode === Enum.KeyCode.Return || event.KeyCode === Enum.KeyCode.ButtonX) advance();
			});
			// A full-size subtitle panel also advances on touch/mouse; always >=44px.
			const nextButton = new Instance("TextButton"); nextButton.Name = "NextStoryBeatButton"; nextButton.Text = ""; nextButton.BackgroundTransparency = 1;
			nextButton.Position = new UDim2(0,0,1,-144); nextButton.Size = new UDim2(1,0,0,64);
			nextButton.Parent = root; nextButton.Activated.Connect(advance);
			const layout = () => {
				const geometry = getCinematicLayout(root.AbsoluteSize.X,root.AbsoluteSize.Y);
				const place = (item: GuiObject, rect: {x:number;y:number;width:number;height:number}) => {
					item.Position = UDim2.fromOffset(rect.x,rect.y); item.Size = UDim2.fromOffset(rect.width,rect.height);
				};
				place(heading,geometry.title); place(viewport,geometry.scene); place(subtitle,geometry.subtitle);
				place(nextButton,geometry.subtitle); place(hint,geometry.hint);
				[skip,pace,motion].forEach((item,index) => place(item,geometry.actions[index]));
			};
			resized = root.GetPropertyChangedSignal("AbsoluteSize").Connect(layout);
			gui.Parent = Players.LocalPlayer.WaitForChild("PlayerGui"); layout();
			GuiService.SelectedObject = skip;
			while (gui.Parent && !skipped && beatIndex < scene.beats.size()) {
				const [dt] = RunService.RenderStepped.Wait(); beatTime += math.min(dt,0.1);
				const beat = scene.beats[beatIndex];
				subtitle.Text = `${beat.speaker}: ${beat.text}`;
				pace.Text = readAtOwnPace ? "READ AT OWN PACE" : "AUTO ADVANCE";
				motion.Text = reduceMotion ? "REDUCED MOTION" : "CAMERA MOTION";
				hint.Text = `${beatIndex+1}/3 · ${readAtOwnPace ? "Tap subtitle / Space / X to continue" : "Auto advance · tap subtitle / Space / X to continue"}`;
				const t = reduceMotion ? 0 : math.min(beatTime,8);
				playerJet.PivotTo(new CFrame(-35 + math.sin(t*0.25)*10,65,-15-t*2).mul(CFrame.Angles(0,-0.15,0.06)));
				wingmate.PivotTo(new CFrame(0,72,18-t*2).mul(CFrame.Angles(0,-0.15,-0.05)));
				dish.Orientation = new Vector3(0, reduceMotion ? 0 : t*8,0);
				const focus = beat.focus === "flight" ? new Vector3(-20,65,-10) : beat.focus === "relay" ? new Vector3(0,40,-130) : new Vector3(85,5,30);
				const eye = focus.add(beat.focus === "flight" ? new Vector3(50,28,90) : new Vector3(140 + math.sin(t*0.12)*12,65,150));
				camera.CFrame = CFrame.lookAt(eye,focus);
				if (advanceRequested || (!readAtOwnPace && beatTime >= 8)) { beatIndex++; beatTime = 0; advanceRequested = false; }
			}
		});
		input?.Disconnect(); resized?.Disconnect(); gui.Destroy(); currentGui = undefined;
		if (previousSelection?.Parent) GuiService.SelectedObject = previousSelection;
		else GuiService.SelectedObject = undefined;
		active = false;
		if (!ok) warn(`Glass Horizon cutscene: ${tostring(problem)}`);
	},
};
