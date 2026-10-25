-- Original low-part-count silhouettes. Every effect uses built-in geometry;
-- there are no imported meshes, textures, sounds, or asset dependencies.
local Debris = game:GetService("Debris")
local JetFactory = {}

local function part(parent, className, name, size, cf, color, material)
	local item = Instance.new(className)
	item.Name = name
	item.Size = size
	item.CFrame = cf
	item.Color = color
	item.Material = material or Enum.Material.SmoothPlastic
	item.Anchored = true
	item.CanCollide = false
	item.CanTouch = false
	item.CanQuery = false
	item.CastShadow = true
	item.Parent = parent
	return item
end

local function trail(parent, position, color, width, lifetime)
	local a = Instance.new("Attachment")
	a.Position = position + Vector3.new(width / 2, 0, 0)
	a.Parent = parent
	local b = Instance.new("Attachment")
	b.Position = position - Vector3.new(width / 2, 0, 0)
	b.Parent = parent
	local effect = Instance.new("Trail")
	effect.Attachment0 = a
	effect.Attachment1 = b
	effect.Color = ColorSequence.new(color)
	effect.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.18), NumberSequenceKeypoint.new(1, 1) })
	effect.Lifetime = lifetime
	effect.LightEmission = 0.75
	effect.FaceCamera = true
	effect.MinLength = 0.1
	effect.Parent = parent
	return effect
end

function JetFactory.Create(name, enemy)
	local model = Instance.new("Model")
	model.Name = name
	local shell = enemy and Color3.fromRGB(94, 76, 88) or Color3.fromRGB(218, 229, 236)
	local dark = Color3.fromRGB(25, 39, 53)
	local accent = enemy and Color3.fromRGB(255, 95, 79) or Color3.fromRGB(44, 224, 240)
	local root = part(model, "Part", "Root", Vector3.new(3, 3, 16), CFrame.new(), dark)
	root.Transparency = 1
	model.PrimaryPart = root
	part(model, "Part", "Fuselage", Vector3.new(3.4, 2.5, 16), CFrame.new(), shell)
	part(model, "WedgePart", "Nose", Vector3.new(3.4, 2.5, 8), CFrame.new(0, 0, -11) * CFrame.Angles(0, math.pi, 0), shell)
	local canopy = part(model, "Part", "Canopy", Vector3.new(2.1, 1.45, 5.3), CFrame.new(0, 1.5, -3.1), Color3.fromRGB(40, 117, 147), Enum.Material.Glass)
	canopy.Transparency = 0.18
	for _, side in { -1, 1 } do
		part(model, "WedgePart", "SweptWing", Vector3.new(10, 0.55, 9), CFrame.new(side * 6.4, -0.25, 1.7) * CFrame.Angles(0, side < 0 and math.pi or 0, 0), shell)
		part(model, "Part", "WingMark", Vector3.new(1.2, 0.62, 4), CFrame.new(side * 9, -0.2, 3.8), accent)
		part(model, "WedgePart", "Tailplane", Vector3.new(4.5, 0.45, 4), CFrame.new(side * 3.5, 0.35, 7.3) * CFrame.Angles(0, side < 0 and math.pi or 0, 0), dark)
		part(model, "WedgePart", "TwinFin", Vector3.new(0.5, 3.9, 4.8), CFrame.new(side * 1.4, 2.1, 6.3), shell)
		part(model, "Part", "Engine", Vector3.new(1.35, 1.35, 3.1), CFrame.new(side * 0.95, -0.1, 7.6), dark)
		part(model, "Part", "Afterburner", Vector3.new(1, 1, 0.6), CFrame.new(side * 0.95, -0.1, 9.25), accent, Enum.Material.Neon)
		trail(root, Vector3.new(side * 10, -0.25, 4), Color3.fromRGB(224, 246, 255), 0.25, 1.1)
	end
	trail(root, Vector3.new(0, -0.1, 9.3), accent, 1.1, 0.35)
	return model
end

function JetFactory.CreateMissile(parent, position, direction, hostile)
	local color = hostile and Color3.fromRGB(255, 104, 72) or Color3.fromRGB(93, 247, 255)
	local missile = part(parent, "Part", hostile and "HostileMissile" or "SkyLance", Vector3.new(0.75, 0.75, 4.3), CFrame.lookAt(position, position + direction), color, Enum.Material.Neon)
	missile.CastShadow = false
	trail(missile, Vector3.new(0, 0, 2), color, 0.8, 0.5)
	return missile
end

function JetFactory.Burst(parent, position, color, scale)
	local flash = part(parent, "Part", "ImpactFlash", Vector3.new(scale, scale, scale), CFrame.new(position), color, Enum.Material.Neon)
	flash.Shape = Enum.PartType.Ball
	flash.Transparency = 0.2
	flash.CastShadow = false
	local light = Instance.new("PointLight")
	light.Color = color
	light.Brightness = 3
	light.Range = scale * 3
	light.Parent = flash
	local TweenService = game:GetService("TweenService")
	TweenService:Create(flash, TweenInfo.new(0.45), { Size = Vector3.new(scale, scale, scale) * 3, Transparency = 1 }):Play()
	Debris:AddItem(flash, 0.5)
end

function JetFactory.Flares(parent, position)
	for index = 1, 6 do
		local flare = part(parent, "Part", "Countermeasure", Vector3.new(1.4, 1.4, 1.4), CFrame.new(position), Color3.fromRGB(255, 218, 138), Enum.Material.Neon)
		flare.Shape = Enum.PartType.Ball
		flare.CastShadow = false
		trail(flare, Vector3.zero, Color3.fromRGB(255, 207, 111), 0.6, 0.5)
		local offset = Vector3.new((index - 3.5) * 11, -10 - index * 2, 24 + index * 4)
		game:GetService("TweenService"):Create(flare, TweenInfo.new(1.2), { Position = position + offset, Transparency = 1 }):Play()
		Debris:AddItem(flare, 1.3)
	end
end

return JetFactory
