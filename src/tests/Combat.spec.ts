import { afterEach, describe, expect, it } from "@rbxts/jest-globals";
import { Workspace } from "@rbxts/services";
import { JetFactory } from "../shared/JetFactory";

// Engine integration: real instances, pivots, attachments and effects in Roblox.
// Mission combat is also exercised through the phone controller by the live driver.
describe("Roblox jet and missile integration", () => {
	let fixture: Folder | undefined;
	afterEach(() => { fixture?.Destroy(); fixture = undefined; });
	function folder(): Folder {
		fixture = new Instance("Folder");
		fixture.Name = "SkybreakJetIntegrationFixture";
		fixture.Parent = Workspace;
		return fixture;
	}
	it("creates pivotable safe aircraft with distinct enemy colors and complete trails", () => {
		const root = folder();
		const player = JetFactory.Create("Test Kestrel", false);
		const enemy = JetFactory.Create("Test Vanta", true);
		player.Parent = root; enemy.Parent = root;
		expect(player.PrimaryPart?.Name).toBe("Root");
		const destination = new CFrame(123, 400, -600).mul(CFrame.Angles(0, 0.6, 0.1));
		player.PivotTo(destination);
		expect(player.GetPivot().Position.sub(destination.Position).Magnitude).toBeCloseTo(0, 4);
		let trailCount = 0;
		for (const item of player.GetDescendants()) {
			if (item.IsA("BasePart")) {
				expect(item.Anchored).toBe(true);
				expect(item.CanCollide).toBe(false);
				expect(item.CanTouch).toBe(false);
				expect(item.CanQuery).toBe(false);
			} else if (item.IsA("Trail")) {
				trailCount += 1;
				expect(item.Attachment0?.Parent).toBe(player.PrimaryPart);
				expect(item.Attachment1?.Parent).toBe(player.PrimaryPart);
			}
		}
		expect(trailCount).toBe(3);
		const playerShell = player.FindFirstChild("Fuselage") as Part;
		const enemyShell = enemy.FindFirstChild("Fuselage") as Part;
		expect(playerShell.Color).never.toEqual(enemyShell.Color);
	});
	it("creates correctly oriented friendly and hostile missiles", () => {
		const root = folder();
		const position = new Vector3(40, 300, -200);
		const direction = new Vector3(0.3, 0.2, -1).Unit;
		for (const hostile of [false, true]) {
			const missile = JetFactory.CreateMissile(root, position, direction, hostile);
			expect(missile.Name).toBe(hostile ? "HostileMissile" : "SkyLance");
			expect(missile.Position).toEqual(position);
			expect(missile.CFrame.LookVector.Dot(direction)).toBeCloseTo(1, 5);
			expect(missile.FindFirstChildWhichIsA("Trail")).toBeDefined();
			expect(missile.CanTouch).toBe(false);
		}
	});
	it("creates impact and countermeasure effects with engine cleanup", () => {
		const root = folder();
		const position = new Vector3(0, 300, 0);
		JetFactory.Burst(root, position, Color3.fromRGB(255, 179, 102), 8);
		JetFactory.Flares(root, position);
		const flash = root.FindFirstChild("ImpactFlash") as Part;
		expect(flash.FindFirstChildWhichIsA("PointLight")).toBeDefined();
		expect(root.GetChildren().size()).toBe(7);
		task.wait(1.6);
		expect(root.GetChildren().size()).toBe(0);
	});
});
