-- Run in Edit mode in a local test.project.json place; never publish this scene.
local shared = game:GetService("ReplicatedStorage").Shared
local loader = require(shared.UploadedAssets).UploadedAssets
local specs = require(shared.UploadedAssetSpecs).UploadedAssetSpecs
local world = require(game:GetService("ServerScriptService").Server.WorldAssets).WorldAssets
loader:Configure()
local prior = workspace:FindFirstChild("OrientationQA")
if prior then prior:Destroy() end
local scene = Instance.new("Folder")
scene.Name = "OrientationQA"
scene.Parent = workspace
local report = {}
for i, name in ipairs({"HeavyBomber", "HeavyTransport", "RadarJammer", "FuelTanker", "AttackHelicopter", "VantaV2Elite", "VantaV2"}) do
    local loaded = assert(loader:Template({name}), name .. " failed to load")
    local x = (i - 1) * 110
    local model
    if name == "FuelTanker" then
        model = assert(world.PlaceUploaded(name, scene, CFrame.new(x, 0, 0)))
    else
        model = loaded.template:Clone()
        model.Name = name
        model:PivotTo(CFrame.new(x, 25, 0))
        model.Parent = scene
    end
    local box, size = model:GetBoundingBox()
    local row = {name=name, assetId=model:GetAttribute("AssetId"), importScale=model:GetAttribute("ImportScale"), centre=tostring(box.Position), size=tostring(size), pivot=tostring(model:GetPivot().Position)}
    if name == "AttackHelicopter" then
        row.rotors = {}
        for rotor, data in pairs(specs[name].rotors) do
            local part = assert(model:FindFirstChild(rotor))
            local hub = Instance.new("Part")
            hub.Name = rotor .. "_ConfiguredHub"
            hub.Shape = Enum.PartType.Ball
            hub.Size = Vector3.new(0.25, 0.25, 0.25)
            hub.Material = Enum.Material.Neon
            hub.Color = Color3.fromRGB(255, 80, 180)
            hub.Anchored = true
            hub.CanCollide = false
            hub.Position = model:GetPivot():PointToWorldSpace(data.hub)
            hub.Parent = scene
            row.rotors[rotor] = {meshCentre=tostring(model:GetPivot():PointToObjectSpace(part.Position)), partPivot=tostring(model:GetPivot():PointToObjectSpace(part:GetPivot().Position)), configuredHub=tostring(data.hub), configuredAxis=tostring(data.axis)}
        end
    end
    table.insert(report, row)
    local marker = Instance.new("Part")
    marker.Name = name .. "_ForwardMinusZ"
    marker.Anchored = true
    marker.CanCollide = false
    marker.Size = Vector3.new(1, 1, 15)
    marker.Color = Color3.fromRGB(255, 230, 20)
    marker.Position = Vector3.new(x, 0, -size.Z/2 - 12)
    marker.Parent = scene
end
local sea = Instance.new("Part")
sea.Name = "SeaLevelY0"
sea.Size = Vector3.new(1200, 0.2, 650)
sea.Position = Vector3.new(330, -0.1, 0)
sea.Anchored = true
sea.CanCollide = false
sea.Color = Color3.fromRGB(36, 94, 125)
sea.Transparency = 0.35
sea.Parent = scene
local light = game:GetService("Lighting")
light.ClockTime = 12
light.Brightness = 2
light.Ambient = Color3.fromRGB(160, 160, 160)
workspace.CurrentCamera.FieldOfView = 45
return game:GetService("HttpService"):JSONEncode(report)
