local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local GameConfig = require(ReplicatedStorage.Shared.GameConfig)

local WorldBuilder = {}

local COLORS = {
	ocean = Color3.fromRGB(22, 80, 116),
	deepRock = Color3.fromRGB(40, 57, 64),
	rock = Color3.fromRGB(70, 82, 78),
	grass = Color3.fromRGB(83, 116, 79),
	sand = Color3.fromRGB(190, 172, 119),
	runway = Color3.fromRGB(42, 47, 52),
	concrete = Color3.fromRGB(116, 125, 130),
	white = Color3.fromRGB(232, 239, 235),
	cyan = Color3.fromRGB(47, 220, 231),
	navy = Color3.fromRGB(22, 38, 61),
	orange = Color3.fromRGB(255, 154, 67),
}

local function makePart(parent, name, size, cframe, color, material, options)
	options = options or {}
	local object = Instance.new(options.className or "Part")
	object.Name = name
	object.Size = size
	object.CFrame = cframe
	object.Color = color
	object.Material = material or Enum.Material.SmoothPlastic
	object.Anchored = true
	object.CanCollide = options.canCollide ~= false
	object.CanTouch = options.canTouch == true
	object.CanQuery = options.canQuery ~= false
	object.CastShadow = options.castShadow ~= false
	if options.transparency then
		object.Transparency = options.transparency
	end
	if options.reflectance then
		object.Reflectance = options.reflectance
	end
	if options.shape then
		object.Shape = options.shape
	end
	object.Parent = parent
	return object
end

local function addLight(parent, color, brightness, range)
	local light = Instance.new("PointLight")
	light.Color = color
	light.Brightness = brightness
	light.Range = range
	light.Shadows = false
	light.Parent = parent
	return light
end

local function buildLighting()
	Lighting.ClockTime = 16.35
	Lighting.Brightness = 2.25
	Lighting.ExposureCompensation = 0.08
	Lighting.Ambient = Color3.fromRGB(78, 91, 108)
	Lighting.OutdoorAmbient = Color3.fromRGB(122, 135, 148)
	Lighting.EnvironmentDiffuseScale = 0.45
	Lighting.EnvironmentSpecularScale = 0.65
	Lighting.GlobalShadows = true

	local oldAtmosphere = Lighting:FindFirstChild("SkybreakAtmosphere")
	if oldAtmosphere then
		oldAtmosphere:Destroy()
	end
	local atmosphere = Instance.new("Atmosphere")
	atmosphere.Name = "SkybreakAtmosphere"
	atmosphere.Color = Color3.fromRGB(188, 222, 232)
	atmosphere.Decay = Color3.fromRGB(91, 125, 147)
	atmosphere.Density = 0.23
	atmosphere.Glare = 0.14
	atmosphere.Haze = 1.35
	atmosphere.Offset = 0.08
	atmosphere.Parent = Lighting

	local oldColor = Lighting:FindFirstChild("SkybreakColor")
	if oldColor then
		oldColor:Destroy()
	end
	local color = Instance.new("ColorCorrectionEffect")
	color.Name = "SkybreakColor"
	color.Brightness = 0.01
	color.Contrast = 0.08
	color.Saturation = -0.03
	color.TintColor = Color3.fromRGB(238, 247, 255)
	color.Parent = Lighting

	local oldBloom = Lighting:FindFirstChild("SkybreakBloom")
	if oldBloom then
		oldBloom:Destroy()
	end
	local bloom = Instance.new("BloomEffect")
	bloom.Name = "SkybreakBloom"
	bloom.Intensity = 0.18
	bloom.Size = 22
	bloom.Threshold = 1.4
	bloom.Parent = Lighting

	local terrain = Workspace.Terrain
	local oldClouds = terrain:FindFirstChild("SkybreakClouds")
	if oldClouds then
		oldClouds:Destroy()
	end
	local clouds = Instance.new("Clouds")
	clouds.Name = "SkybreakClouds"
	clouds.Color = Color3.fromRGB(232, 239, 244)
	clouds.Cover = 0.28
	clouds.Density = 0.36
	clouds.Parent = terrain
end

local function buildIsland(parent, name, center, scale, mountainHeight)
	local model = Instance.new("Model")
	model.Name = name
	model.Parent = parent

	makePart(model, "CliffBase", Vector3.new(scale.X, 32, scale.Z), CFrame.new(center.X, -8, center.Z), COLORS.deepRock, Enum.Material.Slate)
	makePart(model, "SandShelf", Vector3.new(scale.X + 32, 8, scale.Z + 32), CFrame.new(center.X, 6, center.Z), COLORS.sand, Enum.Material.Sand)
	makePart(model, "GreenShelf", Vector3.new(scale.X - 18, 12, scale.Z - 18), CFrame.new(center.X, 15, center.Z), COLORS.grass, Enum.Material.Grass)

	local peakY = 21 + mountainHeight / 2
	local mountainA = makePart(model, "MountainA", Vector3.new(scale.X * 0.45, mountainHeight, scale.Z * 0.42), CFrame.new(center.X - scale.X * 0.12, peakY, center.Z) * CFrame.Angles(0, math.rad(18), 0), COLORS.rock, Enum.Material.Rock, {
		className = "WedgePart",
	})
	mountainA.CanCollide = true
	makePart(model, "MountainB", Vector3.new(scale.X * 0.35, mountainHeight * 0.7, scale.Z * 0.32), CFrame.new(center.X + scale.X * 0.18, 21 + mountainHeight * 0.35, center.Z - scale.Z * 0.12) * CFrame.Angles(0, math.rad(205), 0), COLORS.deepRock, Enum.Material.Slate, {
		className = "WedgePart",
	})
	makePart(model, "SunFace", Vector3.new(scale.X * 0.23, mountainHeight * 0.55, scale.Z * 0.24), CFrame.new(center.X, 21 + mountainHeight * 0.275, center.Z + scale.Z * 0.2) * CFrame.Angles(0, math.rad(-25), 0), COLORS.grass, Enum.Material.Grass, {
		className = "WedgePart",
	})

	return model
end

local function buildHangar(parent, center, facing)
	local model = Instance.new("Model")
	model.Name = "Hangar"
	model.Parent = parent
	local pivot = CFrame.new(center) * CFrame.Angles(0, facing, 0)

	makePart(model, "Floor", Vector3.new(72, 2, 52), pivot, COLORS.concrete, Enum.Material.Concrete)
	makePart(model, "Back", Vector3.new(72, 27, 3), pivot * CFrame.new(0, 14, 25), COLORS.navy, Enum.Material.Metal)
	makePart(model, "LeftWall", Vector3.new(3, 27, 52), pivot * CFrame.new(-34.5, 14, 0), COLORS.concrete, Enum.Material.Metal)
	makePart(model, "RightWall", Vector3.new(3, 27, 52), pivot * CFrame.new(34.5, 14, 0), COLORS.concrete, Enum.Material.Metal)
	makePart(model, "Roof", Vector3.new(75, 3, 56), pivot * CFrame.new(0, 29, 0), COLORS.deepRock, Enum.Material.Metal)
	makePart(model, "DoorHeader", Vector3.new(72, 5, 3), pivot * CFrame.new(0, 26, -25), COLORS.orange, Enum.Material.Metal)
	return model
end

local function buildDisplayJet(parent)
	local model = Instance.new("Model")
	model.Name = "DisplayJet"
	model.Parent = parent
	local pivot = CFrame.new(155, 29, -100) * CFrame.Angles(0, math.rad(202), 0)

	local body = makePart(model, "Fuselage", Vector3.new(5, 4, 30), pivot, COLORS.navy, Enum.Material.Metal, { canCollide = false, canTouch = false })
	makePart(model, "Nose", Vector3.new(4, 3, 9), pivot * CFrame.new(0, -0.2, -19) * CFrame.Angles(math.rad(-90), 0, 0), COLORS.navy, Enum.Material.Metal, {
		className = "WedgePart", canCollide = false, canTouch = false,
	})
	makePart(model, "Canopy", Vector3.new(3.8, 2.2, 8), pivot * CFrame.new(0, 2.4, -5), Color3.fromRGB(62, 137, 163), Enum.Material.Glass, {
		canCollide = false, canTouch = false, transparency = 0.22,
	})
	makePart(model, "LeftWing", Vector3.new(17, 1, 13), pivot * CFrame.new(-9.5, 0, 2) * CFrame.Angles(0, math.rad(10), 0), COLORS.navy, Enum.Material.Metal, {
		className = "WedgePart", canCollide = false, canTouch = false,
	})
	makePart(model, "RightWing", Vector3.new(17, 1, 13), pivot * CFrame.new(9.5, 0, 2) * CFrame.Angles(0, math.rad(170), 0), COLORS.navy, Enum.Material.Metal, {
		className = "WedgePart", canCollide = false, canTouch = false,
	})
	makePart(model, "LeftTail", Vector3.new(7, 1, 7), pivot * CFrame.new(-4.8, 0.5, 12), COLORS.navy, Enum.Material.Metal, {
		className = "WedgePart", canCollide = false, canTouch = false,
	})
	makePart(model, "RightTail", Vector3.new(7, 1, 7), pivot * CFrame.new(4.8, 0.5, 12) * CFrame.Angles(0, math.rad(180), 0), COLORS.navy, Enum.Material.Metal, {
		className = "WedgePart", canCollide = false, canTouch = false,
	})
	makePart(model, "TailFin", Vector3.new(1, 7, 8), pivot * CFrame.new(0, 4, 11), COLORS.orange, Enum.Material.Metal, {
		className = "WedgePart", canCollide = false, canTouch = false,
	})
	makePart(model, "LeftIntake", Vector3.new(2, 2, 9), pivot * CFrame.new(-3.3, -1.2, 2), COLORS.cyan, Enum.Material.Neon, { canCollide = false, canTouch = false })
	makePart(model, "RightIntake", Vector3.new(2, 2, 9), pivot * CFrame.new(3.3, -1.2, 2), COLORS.cyan, Enum.Material.Neon, { canCollide = false, canTouch = false })
	model.PrimaryPart = body
	return model
end

local function buildAirbase(parent)
	local airbase = Instance.new("Model")
	airbase.Name = "GlassHorizonAirbase"
	airbase.Parent = parent

	makePart(airbase, "IslandRock", Vector3.new(570, 26, 990), CFrame.new(0, -5, 0), COLORS.deepRock, Enum.Material.Slate)
	makePart(airbase, "IslandSand", Vector3.new(600, 7, 1020), CFrame.new(0, 9, 0), COLORS.sand, Enum.Material.Sand)
	makePart(airbase, "IslandPlateau", Vector3.new(545, 8, 965), CFrame.new(0, 15, 0), COLORS.grass, Enum.Material.Grass)
	makePart(airbase, "RunwayShoulder", Vector3.new(112, 3, 900), CFrame.new(0, 20.5, 0), COLORS.concrete, Enum.Material.Concrete)
	makePart(airbase, "Runway", Vector3.new(88, 2, 872), CFrame.new(0, 23, 0), COLORS.runway, Enum.Material.Asphalt)

	for z = -350, 350, 50 do
		makePart(airbase, "CenterMark", Vector3.new(2.5, 0.25, 22), CFrame.new(0, 24.15, z), COLORS.white, Enum.Material.SmoothPlastic, { canCollide = false })
	end
	for _, endZ in { -405, 405 } do
		for stripe = -3, 3 do
			makePart(airbase, "ThresholdMark", Vector3.new(7, 0.25, 30), CFrame.new(stripe * 10, 24.15, endZ), COLORS.white, Enum.Material.SmoothPlastic, { canCollide = false })
		end
	end

	makePart(airbase, "WestTaxiway", Vector3.new(135, 2, 28), CFrame.new(-105, 22.5, 115), COLORS.runway, Enum.Material.Asphalt)
	makePart(airbase, "EastTaxiway", Vector3.new(135, 2, 28), CFrame.new(105, 22.5, -105), COLORS.runway, Enum.Material.Asphalt)
	makePart(airbase, "WestApron", Vector3.new(170, 2, 190), CFrame.new(-185, 22.5, 115), COLORS.concrete, Enum.Material.Concrete)
	makePart(airbase, "EastApron", Vector3.new(170, 2, 190), CFrame.new(185, 22.5, -105), COLORS.concrete, Enum.Material.Concrete)

	buildHangar(airbase, Vector3.new(-195, 24, 72), math.rad(90))
	buildHangar(airbase, Vector3.new(-195, 24, 155), math.rad(90))
	buildHangar(airbase, Vector3.new(195, 24, -150), math.rad(-90))

	local tower = Instance.new("Model")
	tower.Name = "ControlTower"
	tower.Parent = airbase
	makePart(tower, "Base", Vector3.new(30, 42, 30), CFrame.new(190, 44, 40), COLORS.concrete, Enum.Material.Concrete)
	makePart(tower, "Cab", Vector3.new(45, 12, 45), CFrame.new(190, 68, 40), Color3.fromRGB(55, 104, 122), Enum.Material.Glass, { transparency = 0.18 })
	makePart(tower, "Roof", Vector3.new(50, 3, 50), CFrame.new(190, 76, 40), COLORS.navy, Enum.Material.Metal)
	makePart(tower, "Antenna", Vector3.new(2, 21, 2), CFrame.new(190, 88, 40), COLORS.white, Enum.Material.Metal, { canCollide = false })
	local beacon = makePart(tower, "Beacon", Vector3.new(4, 4, 4), CFrame.new(190, 99.5, 40), COLORS.orange, Enum.Material.Neon, {
		shape = Enum.PartType.Ball, canCollide = false,
	})
	addLight(beacon, COLORS.orange, 2, 35)

	for _, z in { -470, -440, 440, 470 } do
		for _, x in { -34, 34 } do
			local approach = makePart(airbase, "ApproachLight", Vector3.new(2, 2, 2), CFrame.new(x, 23, z), COLORS.cyan, Enum.Material.Neon, {
				shape = Enum.PartType.Ball, canCollide = false,
			})
			addLight(approach, COLORS.cyan, 0.8, 14)
		end
	end

	for index = 1, 3 do
		local x = -255 + index * 34
		makePart(airbase, "FuelTank", Vector3.new(24, 24, 24), CFrame.new(x, 36, -245), COLORS.white, Enum.Material.Metal, {
			shape = Enum.PartType.Ball,
		})
	end

	buildDisplayJet(airbase)
	return airbase
end

function WorldBuilder.Build()
	local existing = Workspace:FindFirstChild("World")
	if existing then
		existing:Destroy()
	end

	buildLighting()
	local world = Instance.new("Folder")
	world.Name = "World"
	world.Parent = Workspace

	local ocean = Instance.new("Folder")
	ocean.Name = "Ocean"
	ocean.Parent = world
	for tileX = -1, 1 do
		for tileZ = -1, 1 do
			makePart(ocean, string.format("Tile_%d_%d", tileX, tileZ), Vector3.new(2000, 4, 2000), CFrame.new(tileX * 2000, GameConfig.World.OceanY - 2, tileZ * 2000), COLORS.ocean, Enum.Material.SmoothPlastic, {
				canCollide = false,
				canTouch = false,
				reflectance = 0.12,
			})
		end
	end
	buildAirbase(world)

	buildIsland(world, "NorthwestIsland", Vector3.new(-1050, 0, -950), Vector3.new(480, 1, 390), 70)
	buildIsland(world, "NortheastIsland", Vector3.new(1220, 0, -1200), Vector3.new(580, 1, 430), 76)
	buildIsland(world, "SouthwestIsland", Vector3.new(-1380, 0, 1120), Vector3.new(420, 1, 520), 64)
	buildIsland(world, "EasternIsland", Vector3.new(1550, 0, 620), Vector3.new(330, 1, 410), 58)

	local lighthouseBase = makePart(world, "Lighthouse", Vector3.new(18, 62, 18), CFrame.new(1450, 58, 620), COLORS.white, Enum.Material.Concrete)
	local lighthouseLamp = makePart(world, "LighthouseLamp", Vector3.new(24, 9, 24), CFrame.new(1450, 94, 620), COLORS.cyan, Enum.Material.Glass, { transparency = 0.18 })
	addLight(lighthouseLamp, COLORS.cyan, 3, 60)
	lighthouseBase.Color = COLORS.white

	return {
		World = world,
		MenuCamera = GameConfig.World.MenuCamera,
	}
end

return WorldBuilder
