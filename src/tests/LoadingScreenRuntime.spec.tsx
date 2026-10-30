import { describe, expect, it } from "@rbxts/jest-globals";
import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { TextService } from "@rbxts/services";
import { createJetRig, Fader, JET_TEMPLATE_FOLDER, JET_TEMPLATE_NAME, whenJetTemplate } from "../shared/LoadingRig";
import { LoadingScreen } from "../shared/LoadingScreen";
import { getLoadingLayout, LOADING_SEGMENTS } from "../shared/LoadingScreenModel";
import { MissionCatalog } from "../shared/MissionCatalog";

function fakeJet(): Model {
	const model = new Instance("Model");
	model.Name = JET_TEMPLATE_NAME;
	const root = new Instance("Part");
	root.Name = "Root"; root.Size = new Vector3(3, 3, 16); root.Anchored = true; root.Position = new Vector3(40, 10, -5); root.Parent = model;
	model.PrimaryPart = root;
	const wing = new Instance("Part");
	wing.Name = "Wing"; wing.Size = new Vector3(20, 0.5, 6); wing.Anchored = true; wing.Position = new Vector3(40, 10, -3); wing.Parent = model;
	new Instance("Trail").Parent = root;
	new Instance("ParticleEmitter").Parent = root;
	new Instance("Sound").Parent = root;
	new Instance("PointLight").Parent = wing;
	return model;
}
function waitUntil(check: () => boolean, seconds = 3): boolean {
	const deadline = os.clock() + seconds;
	while (!check() && os.clock() < deadline) task.wait(0.05);
	return check();
}

describe("loading screen jet rig", () => {
	it("clones the approved jet into one viewport without cosmetics, centred, and removes everything on Destroy", () => {
		const holder = new Instance("Frame");
		const template = fakeJet();
		const rig = createJetRig(holder, template, true);
		expect(rig.viewport.Parent).toBe(holder);
		expect(rig.model).toBeDefined();
		expect(rig.model!.Parent).toBe(rig.viewport);
		expect(rig.viewport.CurrentCamera).toBeDefined();
		expect(rig.viewport.CurrentCamera!.Parent).toBe(rig.viewport);
		const [box] = rig.model!.GetBoundingBox();
		expect(box.Position.Magnitude).toBeLessThan(0.01);
		for (const item of rig.model!.GetDescendants()) {
			expect(item.IsA("Trail") || item.IsA("ParticleEmitter") || item.IsA("Sound") || item.IsA("Light")).toBe(false);
		}
		// The replicated template is never modified.
		expect(template.FindFirstChildWhichIsA("Part", true)?.Position).toEqual(new Vector3(40, 10, -5));
		expect(template.PrimaryPart!.FindFirstChildWhichIsA("Trail")).toBeDefined();
		rig.SetAlpha(1);
		expect(rig.viewport.ImageTransparency).toBe(0);
		rig.Destroy();
		rig.Destroy();
		expect(holder.GetChildren().size()).toBe(0);
		holder.Destroy();
		template.Destroy();
	});

	it("still frames the HUD with no template (the jet arrives later or never)", () => {
		const holder = new Instance("Frame");
		const rig = createJetRig(holder, undefined, false);
		expect(rig.model).toBeUndefined();
		expect(holder.FindFirstChild("JetViewport")).toBeDefined();
		rig.Destroy();
		expect(holder.GetChildren().size()).toBe(0);
		holder.Destroy();
	});

	it("waits for the replicated template folder and jet, then disconnects", () => {
		const root = new Instance("Folder");
		let calls = 0;
		const stop = whenJetTemplate(() => calls++, root);
		const folder = new Instance("Folder");
		folder.Name = JET_TEMPLATE_FOLDER;
		folder.Parent = root;
		task.wait(0.1);
		expect(calls).toBe(0);
		fakeJet().Parent = folder;
		expect(waitUntil(() => calls === 1)).toBe(true);
		const extra = new Instance("Folder"); extra.Parent = folder;
		task.wait(0.1);
		expect(calls).toBe(1);
		stop();
		root.Destroy();
	});
});

describe("loading screen fader", () => {
	it("tweens to its target, reports the value and ignores a superseded completion", () => {
		let seen = -1;
		let finished = 0;
		const fader = new Fader(0, (value) => (seen = value));
		expect(seen).toBe(0);
		fader.To(1, 0.1, () => finished++);
		fader.To(0.5, 0.1, () => finished++);
		expect(waitUntil(() => finished === 1)).toBe(true);
		task.wait(0.2);
		expect(finished).toBe(1);
		expect(seen).toBe(0.5);
		fader.Set(0.25);
		expect(fader.Get()).toBe(0.25);
		fader.Destroy();
	});
});

describe("loading screen text fits", () => {
	it("fits the longest segment label wherever labels are drawn", () => {
		for (const [width, height] of [[1920, 1022], [1280, 662], [768, 966], [390, 750], [430, 830]] as [number, number][]) {
			const layout = getLoadingLayout(width, height);
			if (layout.labelsHeight === 0) continue;
			for (const name of LOADING_SEGMENTS) {
				const size = TextService.GetTextSize(name, layout.smallSize, Enum.Font.GothamBold, new Vector2(1000, 100));
				expect(size.X).toBeLessThanOrEqual(layout.segmentWidth);
			}
		}
	});

	it("keeps every mission title legible (≥ 14 px when scaled) in the header column", () => {
		for (const [width, height] of [[1920, 1022], [1280, 662], [750, 332], [568, 262], [390, 750], [320, 510]] as [number, number][]) {
			const layout = getLoadingLayout(width, height);
			for (const mission of [MissionCatalog.Get(0), ...MissionCatalog.All()]) {
				const size = TextService.GetTextSize(mission.title, 14, Enum.Font.GothamBlack, new Vector2(10000, 100));
				expect(size.X).toBeLessThanOrEqual(layout.header.width);
			}
		}
	});
});

describe("loading screen component", () => {
	it("covers the full screen while loading, fades into the mission and cleans up fully", () => {
		const container = new Instance("Folder");
		const root = ReactRoblox.createRoot(container);
		const props = { missionId: 2, progress: 0, viewport: new Vector2(1280, 662), phase: "building" as const, inputMode: "keyboard" as const, motion: true };
		root.render(<LoadingScreen visible={true} launched={false} {...props} />);
		expect(waitUntil(() => container.FindFirstChild("SkybreakLoadingBackdrop") !== undefined)).toBe(true);
		const backdrop = container.FindFirstChild("SkybreakLoadingBackdrop") as ScreenGui;
		const content = container.FindFirstChild("SkybreakLoadingContent") as ScreenGui;
		expect(backdrop.Enabled).toBe(true);
		expect(backdrop.IgnoreGuiInset).toBe(true);
		expect(backdrop.ScreenInsets).toBe(Enum.ScreenInsets.None);
		expect(content.ScreenInsets).toBe(Enum.ScreenInsets.CoreUISafeInsets);
		expect(backdrop.DisplayOrder).toBeGreaterThan(20);
		expect(content.DisplayOrder).toBeGreaterThan(backdrop.DisplayOrder);
		const title = content.FindFirstChild("Title", true) as TextLabel;
		expect(title.Text).toBe(MissionCatalog.Get(2).title);
		expect((content.FindFirstChild("Eyebrow", true) as TextLabel).Text).toBe("MISSION 02");
		expect((content.FindFirstChild("Status", true) as TextLabel).Text).toBe("Requesting sortie…");
		const jetFrame = backdrop.FindFirstChild("JetFrame", true) as Frame;
		expect(jetFrame.FindFirstChild("JetViewport")).toBeDefined();
		const fill = content.FindFirstChild("Fill", true) as Frame;
		expect(waitUntil(() => fill.Size.X.Scale > 0)).toBe(true);
		const early = fill.Size.X.Scale;

		root.render(<LoadingScreen visible={true} launched={false} {...props} phase="queued" />);
		expect(waitUntil(() => (content.FindFirstChild("Status", true) as TextLabel).Text === "Waiting for the previous mission to clear…")).toBe(true);
		root.render(<LoadingScreen visible={true} launched={false} {...props} phase="preloading" progress={0.5} />);
		expect(waitUntil(() => fill.Size.X.Scale > 4 / 6)).toBe(true);
		expect(fill.Size.X.Scale).toBeGreaterThanOrEqual(early);

		// Started: the fill completes and the whole screen fades away, then disables.
		root.render(<LoadingScreen visible={false} launched={true} {...props} phase="preloading" progress={1} />);
		expect(waitUntil(() => !backdrop.Enabled && !content.Enabled, 3)).toBe(true);
		expect(fill.Size.X.Scale).toBeCloseTo(1, 2);
		expect(jetFrame.FindFirstChild("JetViewport")).toBeUndefined();

		// A failed launch hides quickly without completing the fill.
		root.render(<LoadingScreen visible={true} launched={false} {...props} />);
		expect(waitUntil(() => backdrop.Enabled)).toBe(true);
		expect(waitUntil(() => fill.Size.X.Scale < 1 / 6)).toBe(true);
		root.render(<LoadingScreen visible={false} launched={false} {...props} />);
		expect(waitUntil(() => !backdrop.Enabled, 2)).toBe(true);
		expect(fill.Size.X.Scale).toBeLessThan(1 / 6);

		root.unmount();
		expect(waitUntil(() => container.GetChildren().size() === 0)).toBe(true);
		container.Destroy();
	});
});
