-- Deterministic engine doubles for the cutscene stage: NOT a renderer. The generated production
-- RelayCinematic runs unchanged, including the real sceneFor, stageLighting and stageEffects, so
-- setup, frame and cleanup failures can be injected into the actual stage code.
local effects, cleanups, elements, warnings, clones = {}, {}, {}, {}, {}
local faults = {}
local game = {GameId=10772984313, PlaceId=112911685457826, PlaceVersion=123}
local warn = function(message) table.insert(warnings, tostring(message)) end
local function signal()
	local listeners = {}
	local s = {}
	function s:Connect(fn)
		local c = {Connected=true}
		function c:Disconnect() self.Connected = false end
		table.insert(listeners, {c=c, fn=fn})
		return c
	end
	function s:Once(fn) local c; c = self:Connect(function(...) c:Disconnect(); fn(...) end); return c end
	function s:Fire(...) for _, v in table.clone(listeners) do if v.c.Connected then v.fn(...) end end end
	function s:Count() local n = 0; for _, v in listeners do if v.c.Connected then n += 1 end end; return n end
	return s
end

-- Vector3 / CFrame ------------------------------------------------------------
local V = {}
V.__index = V
local function vec(x, y, z) return setmetatable({X=x or 0, Y=y or 0, Z=z or 0}, V) end
V.__add = function(a, b) return vec(a.X+b.X, a.Y+b.Y, a.Z+b.Z) end
V.__sub = function(a, b) return vec(a.X-b.X, a.Y-b.Y, a.Z-b.Z) end
V.__unm = function(a) return vec(-a.X, -a.Y, -a.Z) end
V.__mul = function(a, b)
	if type(a) == "number" then return vec(a*b.X, a*b.Y, a*b.Z) end
	if type(b) == "number" then return vec(a.X*b, a.Y*b, a.Z*b) end
	return vec(a.X*b.X, a.Y*b.Y, a.Z*b.Z)
end
V.__div = function(a, b) if type(b) == "number" then return vec(a.X/b, a.Y/b, a.Z/b) end; return vec(a.X/b.X, a.Y/b.Y, a.Z/b.Z) end
V.__eq = function(a, b) return a.X == b.X and a.Y == b.Y and a.Z == b.Z end
V.__index = function(t, k)
	if k == "Magnitude" then return math.sqrt(t.X*t.X + t.Y*t.Y + t.Z*t.Z) end
	if k == "Unit" then local m = math.sqrt(t.X*t.X + t.Y*t.Y + t.Z*t.Z); return vec(t.X/m, t.Y/m, t.Z/m) end
	return rawget(V, k)
end
local function cross(a, b) return vec(a.Y*b.Z - a.Z*b.Y, a.Z*b.X - a.X*b.Z, a.X*b.Y - a.Y*b.X) end
local Vector3 = {new=vec, zero=vec(0, 0, 0)}

local C = {}
local function cf(p, r) return setmetatable({p=p, r=r or {1,0,0, 0,1,0, 0,0,1}}, C) end
local function rotate(r, v) return vec(r[1]*v.X + r[2]*v.Y + r[3]*v.Z, r[4]*v.X + r[5]*v.Y + r[6]*v.Z, r[7]*v.X + r[8]*v.Y + r[9]*v.Z) end
local function matmul(a, b)
	local o = {}
	for i = 0, 2 do for j = 0, 2 do o[i*3+j+1] = a[i*3+1]*b[j+1] + a[i*3+2]*b[3+j+1] + a[i*3+3]*b[6+j+1] end end
	return o
end
C.__mul = function(a, b)
	if getmetatable(b) == V then return a.p + rotate(a.r, b) end
	return cf(a.p + rotate(a.r, b.p), matmul(a.r, b.r))
end
C.__add = function(a, v) return cf(a.p + v, a.r) end
C.__sub = function(a, v) return cf(a.p - v, a.r) end
C.__index = function(t, k)
	if k == "Position" then return t.p end
	if k == "X" then return t.p.X elseif k == "Y" then return t.p.Y elseif k == "Z" then return t.p.Z end
	if k == "Inverse" then return function(self)
		local r = self.r
		local rt = {r[1], r[4], r[7], r[2], r[5], r[8], r[3], r[6], r[9]}
		return cf(-rotate(rt, self.p), rt)
	end end
	if k == "Rotation" then return cf(vec(0, 0, 0), t.r) end
	return nil
end
local function rx(a) local c, s = math.cos(a), math.sin(a); return {1,0,0, 0,c,-s, 0,s,c} end
local function ry(a) local c, s = math.cos(a), math.sin(a); return {c,0,s, 0,1,0, -s,0,c} end
local function rz(a) local c, s = math.cos(a), math.sin(a); return {c,-s,0, s,c,0, 0,0,1} end
local CFrame = {
	new = function(x, y, z)
		if x == nil then return cf(vec(0, 0, 0)) end
		if type(x) == "table" then return cf(x) end
		return cf(vec(x, y, z))
	end,
	Angles = function(a, b, c) return cf(vec(0, 0, 0), matmul(matmul(rx(a), ry(b)), rz(c))) end,
	lookAt = function(eye, target)
		local look = (target - eye).Unit
		local right = cross(look, vec(0, 1, 0)).Unit
		local up = cross(right, look)
		return cf(eye, {right.X, up.X, -look.X, right.Y, up.Y, -look.Y, right.Z, up.Z, -look.Z})
	end,
}
local Color3 = {fromRGB=function(r, g, b) return {R=r/255, G=g/255, B=b/255} end}
local function values(...) return {...} end
local UDim2 = {new=values, fromOffset=values, fromScale=values}
local UDim = {new=values}
local Vector2 = {new=function(x, y) return {X=x, Y=y} end, zero={X=0, Y=0}}
local NumberRange = {new=function(a, b) return {Min=a, Max=b} end}
local NumberSequence = {new=values}; local NumberSequenceKeypoint = {new=values}
local TweenInfo = {new=values}
local function enumNode(name)
	return setmetatable({Name=name}, {__index=function(t, k) local v = enumNode(k); rawset(t, k, v); return v end})
end
local Enum = enumNode("Enum")
local task = {spawn=function(fn) fn() end, defer=function(fn) fn() end}

-- Instances -------------------------------------------------------------------
local PARTS = {Part=true, MeshPart=true, BasePart=true}
local LIGHTS = {PointLight=true, SpotLight=true}
local function isA(class, want)
	if class == want or want == "Instance" then return true end
	if want == "BasePart" then return PARTS[class] == true end
	if want == "Light" then return LIGHTS[class] == true end
	if want == "PostEffect" then return class == "ColorCorrectionEffect" or class == "SunRaysEffect" or class == "DepthOfFieldEffect" or class == "BloomEffect" end
	return false
end
local Instance = {}
local proto = {}
local function make(class, props)
	local self = {_class=class, _children={}, _props={}, _signals={}, _attributes={}}
	for k, v in props or {} do self._props[k] = v end
	return setmetatable(self, proto)
end
proto.__index = function(self, key)
	if key == "ClassName" then return rawget(self, "_class") end
	if key == "Parent" then return rawget(self, "_parent") end
	local props = rawget(self, "_props")
	if key == "Position" and props.CFrame then return props.CFrame.p end
	if props[key] ~= nil then return props[key] end
	local method = rawget(proto, key)
	if method then return method end
	for _, child in rawget(self, "_children") do if child.Name == key then return child end end
	return nil
end
proto.__newindex = function(self, key, value)
	if rawget(self, "destroyed") and key ~= "Parent" then return end
	local fault = faults.set and faults.set[(self._props.Name or self._class) .. "." .. key]
	if fault then error("injected property fault: " .. key) end
	if key == "Parent" then
		local old = rawget(self, "_parent")
		if old then local list = rawget(old, "_children"); local i = table.find(list, self); if i then table.remove(list, i) end end
		rawset(self, "_parent", value)
		if value then
			if rawget(value, "destroyed") then error("parent is destroyed") end
			table.insert(rawget(value, "_children"), self)
			local added = rawget(value, "_childAdded"); if added then added:Fire(self) end
		end
		return
	end
	local props = self._props
	if key == "Position" then
		local r = props.CFrame and props.CFrame.r or nil
		props.CFrame = cf(value, r)
		return
	end
	local changed = props[key] ~= value
	props[key] = value
	if changed and self._signals[key] then self._signals[key]:Fire() end
end
function Instance.new(class)
	if faults.new and faults.new[class] then error("injected Instance.new fault: " .. class) end
	local defaults = {Name=class}
	if PARTS[class] then defaults.CFrame = CFrame.new(); defaults.Size = vec(4, 1, 2); defaults.Transparency = 0 end
	if class == "Sound" then defaults.Volume = 1; defaults.IsLoaded = true; defaults.TimePosition = 0; defaults.TimeLength = 400; defaults.IsPlaying = false; defaults.Ended = signal() end
	if class == "Clouds" then defaults.Cover = 0; defaults.Density = 0; defaults.Enabled = true end
	if class == "Model" then defaults.WorldPivot = CFrame.new(); defaults.Scale = 1 end
	return make(class, defaults)
end
function proto:IsA(want) return isA(self._class, want) end
function proto:GetChildren() return table.clone(self._children) end
function proto:GetDescendants()
	local out = {}
	local function walk(node) for _, c in rawget(node, "_children") do table.insert(out, c); walk(c) end end
	walk(self)
	return out
end
function proto:FindFirstChild(name) for _, c in self._children do if c.Name == name then return c end end; return nil end
function proto:WaitForChild(name) return self:FindFirstChild(name) end
function proto:FindFirstChildOfClass(class) for _, c in self._children do if c._class == class then return c end end; return nil end
function proto:FindFirstChildWhichIsA(class) for _, c in self._children do if isA(c._class, class) then return c end end; return nil end
function proto:GetPropertyChangedSignal(key) self._signals[key] = self._signals[key] or signal(); return self._signals[key] end
function proto:GetAttribute(key) return self._attributes[key] end
function proto:SetAttribute(key, value) self._attributes[key] = value; local s = self._signals["@" .. key]; if s then s:Fire() end end
function proto:GetAttributeChangedSignal(key) self._signals["@" .. key] = self._signals["@" .. key] or signal(); return self._signals["@" .. key] end
function proto:Destroy()
	if faults.destroy and faults.destroy[self._props.Name or self._class] then error("injected destroy fault: " .. tostring(self._props.Name)) end
	for _, c in table.clone(self._children) do pcall(function() c:Destroy() end) end
	self.Parent = nil
	rawset(self, "destroyed", true)
	self._props.IsPlaying = false
end
function proto:Clone()
	local copy = make(self._class, self._props)
	for k, v in self._attributes do copy._attributes[k] = v end
	for _, c in self._children do local cc = c:Clone(); cc.Parent = copy end
	table.insert(clones, copy)
	return copy
end
-- Models: parts move with the pivot; GetBoundingBox is an axis-aligned box over part centres and sizes.
function proto:GetPivot() return self._props.WorldPivot end
function proto:PivotTo(target)
	if faults.pivot and faults.pivot[self._props.Name] then error("injected PivotTo fault: " .. self._props.Name) end
	local delta = target * self._props.WorldPivot:Inverse()
	for _, d in self:GetDescendants() do if d:IsA("BasePart") then d._props.CFrame = delta * d._props.CFrame end end
	self._props.WorldPivot = target
end
function proto:GetScale() return self._props.Scale end
function proto:ScaleTo(scale)
	local k = scale / self._props.Scale
	local pivot = self._props.WorldPivot
	for _, d in self:GetDescendants() do
		if d:IsA("BasePart") then
			local local_ = pivot:Inverse() * d._props.CFrame
			d._props.CFrame = pivot * cf(local_.p * k, local_.r)
			d._props.Size = d._props.Size * k
		end
	end
	self._props.Scale = scale
end
function proto:GetBoundingBox()
	local lo, hi
	for _, d in self:GetDescendants() do
		if d:IsA("BasePart") then
			local p, h = d._props.CFrame.p, d._props.Size / 2
			local a, b = p - h, p + h
			lo = lo and vec(math.min(lo.X, a.X), math.min(lo.Y, a.Y), math.min(lo.Z, a.Z)) or a
			hi = hi and vec(math.max(hi.X, b.X), math.max(hi.Y, b.Y), math.max(hi.Z, b.Z)) or b
		end
	end
	lo = lo or vec(0, 0, 0); hi = hi or vec(0, 0, 0)
	return CFrame.new((lo + hi) / 2), hi - lo
end
function proto:Play() self._props.IsPlaying = true end
function proto:Stop() self._props.IsPlaying = false end
function proto:Pause() self._props.IsPlaying = false end
function proto:Resume() self._props.IsPlaying = true end

-- Services ----------------------------------------------------------------------
local LIGHTING_DEFAULTS = {ClockTime=14, Brightness=2, Ambient=Color3.fromRGB(1, 2, 3), OutdoorAmbient=Color3.fromRGB(4, 5, 6),
	FogColor=Color3.fromRGB(7, 8, 9), FogEnd=100000, FogStart=0, ExposureCompensation=0}
-- One world for the whole run (the modules capture services when they load); freshWorld resets it.
local Workspace = make("Workspace", {Name="Workspace"})
local terrain = make("Terrain", {Name="Terrain"}); terrain.Parent = Workspace; Workspace._props.Terrain = terrain
local camera = make("Camera", {Name="Camera"}); camera.Parent = Workspace; Workspace._props.CurrentCamera = camera
local Lighting = make("Lighting", {Name="Lighting"})
local ReplicatedStorage = make("ReplicatedStorage", {Name="ReplicatedStorage"})
local storyModels = make("Folder", {Name="RelayStoryModels"}); storyModels.Parent = ReplicatedStorage
local playerGui = make("PlayerGui", {Name="PlayerGui"})
local services
local function clear(node, keep) for _, c in node:GetChildren() do if c ~= keep then c.Parent = nil end end end
local function freshWorld()
	clear(Workspace, terrain); camera.Parent = Workspace; clear(terrain); clear(storyModels); clear(Lighting)
	camera._props.CameraType = "Custom"; camera._props.FieldOfView = 70; camera._props.CFrame = CFrame.new(1, 2, 3)
	Lighting._signals = {}
	for k, v in LIGHTING_DEFAULTS do Lighting._props[k] = v end
	local atmosphere = make("Atmosphere", {Name="Atmosphere", Density=.3, Haze=1, Color=Color3.fromRGB(10, 11, 12)}); atmosphere.Parent = Lighting
	return storyModels
end
services = {
	Workspace=Workspace, Lighting=Lighting, ReplicatedStorage=ReplicatedStorage,
	ContentProvider={PreloadAsync=function() end},
	Players={LocalPlayer={FindFirstChildOfClass=function() return playerGui end}},
	SoundService=make("SoundService", {Name="SoundService"}),
	RunService={IsClient=function() return true end, Heartbeat=signal(), RenderStepped=signal()},
	GuiService={GetGuiInset=function() return Vector2.new(0, 0), Vector2.new(0, 0) end, MenuIsOpen=false},
	TextService={GetTextSize=function() return Vector2.new(80, 40) end},
	UserInputService={TouchEnabled=false, GetLastInputType=function() return Enum.UserInputType.Keyboard end, InputBegan=signal(), LastInputTypeChanged=signal()},
	TweenService={Create=function(self, sound, info, props)
		local tween = {Completed=signal()}; function tween:Play() sound.Volume = props.Volume; self.Completed:Fire() end; return tween
	end},
}
local servicesProxy = setmetatable({}, {__index=function(_, k) return services[k] end})
freshWorld()
local react = {
	useRef=function(value) return {current=value} end,
	useState=function(value) return value, function() end end,
	useMemo=function(factory) return factory() end,
	useEffect=function(fn) table.insert(effects, fn) end,
	createElement=function(kind, props, ...)
		if props and props.ref then props.ref.current = table.clone(props); if props.key then elements[props.key] = props.ref.current end end
		return {}
	end,
}
local modules = {services=servicesProxy, react=react}
-- INSERT MODULES
local STORY = modules.RelayStory.STORY
local function chapterTitled(title) for _, c in STORY do if c.title == title then return c end end; error("no chapter " .. title) end
local function mount(id)
	effects = {}; cleanups = {}; clones = {}
	local finished = 0
	modules.RelayCinematic.RelayCinematic({id=id, viewport=Vector2.new(1280, 720), onFinish=function() finished += 1 end, onCancel=function() end})
	for _, effect in effects do local cleanup = effect(); if cleanup then table.insert(cleanups, cleanup) end end
	return function() return finished end
end
local function unmount() for _, cleanup in cleanups do cleanup() end end
local function tick(seconds) for _ = 1, math.ceil(seconds / .05) do services.RunService.RenderStepped:Fire(.05) end end
local function stage() return Workspace:FindFirstChild("BrokenRelayCinematic") end
local function cinematicEffects()
	local n = 0
	for _, c in Lighting:GetChildren() do if string.sub(c.Name, 1, 9) == "Cinematic" then n += 1 end end
	return n
end
local function lightingRestored()
	for k, v in LIGHTING_DEFAULTS do if Lighting._props[k] ~= v then return false, k end end
	local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere")
	if atmosphere.Density ~= .3 or atmosphere.Haze ~= 1 then return false, "Atmosphere" end
	if Workspace.Terrain:FindFirstChildOfClass("Clouds") then return false, "Clouds" end
	return true
end
local function cameraRestored() return camera.CameraType == "Custom" and camera.FieldOfView == 70 and camera.CFrame.p == vec(1, 2, 3) end
local function everythingUndone()
	local ok, which = lightingRestored()
	return stage() == nil and cinematicEffects() == 0 and ok and cameraRestored() and services.RunService.RenderStepped:Count() == 0, which
end
-- A replicated uploaded template: one part, pivot at its bottom centre, as WorldAssets.PlaceUploaded leaves it.
local function template(parent, name, size, attributes, extraParts)
	local model = Instance.new("Model"); model.Name = name
	local part = Instance.new("MeshPart"); part.Name = "Body"; part.Size = size; part.CFrame = CFrame.new(0, size.Y / 2, 0); part.Parent = model
	for partName, at in extraParts or {} do
		local extra = Instance.new("MeshPart"); extra.Name = partName; extra.Size = vec(1, .2, 1); extra.CFrame = CFrame.new(at.X, at.Y, at.Z); extra.Parent = model
	end
	for k, v in attributes or {} do model:SetAttribute(k, v) end
	model.Parent = parent
	return model
end
local count = 0
local function test(name, fn)
	faults = {}; warnings = {}
	local ok, problem = pcall(fn)
	faults = {}
	-- Leave nothing connected for the next test, whatever happened.
	pcall(unmount)
	if not ok then print("FAIL " .. name .. ": " .. tostring(problem)); error("cinematic stage test failed", 0) end
	count += 1; print("PASS " .. name)
end

test("real stage, lighting and effects come up and are fully undone on unmount", function()
	freshWorld()
	local ring = chapterTitled("The frigate ring")
	mount(ring.id); tick(.2)
	assert(stage() and cinematicEffects() >= 2 and Lighting.ClockTime ~= 14 and camera.CameraType ~= "Custom")
	-- Nothing replicated: every frigate spot and the launch subject stand in with parts.
	assert(stage():FindFirstChild("Frigate hull") and stage():FindFirstChild("Launch hull"), "sea stand-ins")
	unmount()
	local ok, which = everythingUndone(); assert(ok, "not undone: " .. tostring(which))
	unmount(); assert(everythingUndone(), "second cleanup must be a no-op")
end)
test("partial availability: uploaded where it replicated, a stand-in at every other spot", function()
	local models = freshWorld()
	template(models, "BackdropCityTower", vec(130, 435.8, 140))
	local dark = chapterTitled("The city in darkness")
	mount(dark.id)
	local towers, offices, apartments = 0, 0, 0
	for _, c in stage():GetChildren() do
		if c.ClassName == "Model" and c.Name == "CityTower" then towers += 1 end
		if c.Name == "OfficeMidrise stand-in" then offices += 1 end
		if c.Name == "ApartmentBlock stand-in" then apartments += 1 end
	end
	local plan = modules.CinematicSet.backdropFor(dark.scene, dark.id, false)
	local want = {CityTower=0, OfficeMidrise=0, ApartmentBlock=0}
	for _, it in plan do want[it.asset] += 1 end
	assert(towers == want.CityTower and towers > 0, "uploaded towers")
	assert(offices == want.OfficeMidrise and apartments == want.ApartmentBlock and offices > 0, "stand-ins for missing models")
	unmount(); assert(everythingUndone())
end)
test("a clone that fails to place is destroyed and its stand-in takes the spot", function()
	local models = freshWorld()
	template(models, "BackdropOfficeMidrise", vec(114.8, 132, 80.4))
	faults.pivot = {OfficeMidrise=true}
	local dark = chapterTitled("The city in darkness")
	local status = mount(dark.id)
	assert(status() == 0, "a placement failure must not end the cutscene")
	local made = 0
	for _, c in clones do if c.Name == "OfficeMidrise" then made += 1; assert(c.destroyed and c.Parent == nil, "failed clone left behind") end end
	assert(made > 0, "the clone was attempted")
	for _, c in stage():GetChildren() do assert(not (c.ClassName == "Model" and c.Name == "OfficeMidrise"), "no half-placed office") end
	assert(stage():FindFirstChild("OfficeMidrise stand-in"), "stand-in built")
	unmount(); assert(everythingUndone())
end)
test("a prop or subject clone that fails to place is destroyed and falls back", function()
	local models = freshWorld()
	template(models, "CinematicTapeTin", vec(1.9, 1.705, 1.9), {GeometrySource="Uploaded"})
	template(models, "HarborLaunch", vec(26, 37, 57))
	faults.pivot = {CinematicTapeTin=true, ["Story subject"]=true}
	mount(chapterTitled("Military quays").id)
	for _, c in clones do if c.Name == "CinematicTapeTin" or c.Name == "Story subject" then assert(c.destroyed and c.Parent == nil) end end
	assert(stage():FindFirstChild("Coffee tin") and stage():FindFirstChild("Launch hull"), "procedural tin and launch stand-in")
	unmount(); assert(everythingUndone())
end)
test("a setup failure in the real effects undoes the real lighting and stage and skips", function()
	freshWorld()
	faults.new = {DepthOfFieldEffect=true}
	local status = mount(0)
	assert(status() == 1, "skipped like Skip")
	local ok, which = everythingUndone(); assert(ok, "not undone: " .. tostring(which))
	assert(string.find(table.concat(warnings, "\n"), "stage setup failed", 1, true))
	unmount(); assert(everythingUndone() and status() == 1)
end)
test("a setup failure inside the real stage leaves Lighting untouched", function()
	freshWorld()
	faults.new = {PointLight=true}
	local status = mount(0)
	assert(status() == 1 and everythingUndone() and Lighting.ClockTime == 14)
end)
test("a frame-time failure runs the terminal handler once: everything undone, cutscene skipped", function()
	freshWorld()
	local status = mount(0); tick(.2)
	assert(stage() and status() == 0)
	faults.set = {["Recorder light.Transparency"]=true}
	tick(.2)
	assert(status() == 1, "skipped once")
	local ok, which = everythingUndone(); assert(ok, "not undone: " .. tostring(which))
	assert(string.find(table.concat(warnings, "\n"), "a frame failed", 1, true))
	tick(.5); unmount(); assert(status() == 1 and everythingUndone())
end)
test("an input-handler failure takes the same terminal path", function()
	freshWorld()
	local status = mount(0); tick(.1)
	local poisoned = setmetatable({}, {__index=function() error("injected input fault") end})
	services.UserInputService.InputBegan:Fire({KeyCode=poisoned}, false)
	assert(status() == 1 and everythingUndone())
	assert(string.find(table.concat(warnings, "\n"), "input failed", 1, true))
end)
test("a failing restore is reported and every other restoration still runs once", function()
	freshWorld()
	faults.destroy = {CinematicGrade=true}
	mount(0); tick(.1)
	unmount()
	assert(stage() == nil and lightingRestored() and cameraRestored(), "others restored")
	assert(Lighting:FindFirstChild("CinematicDepth") == nil and Lighting:FindFirstChild("CinematicGrade") ~= nil, "only the failing effect remains")
	assert(string.find(table.concat(warnings, "\n"), "cleanup step failed", 1, true))
	local before = #warnings; unmount(); assert(#warnings == before, "no second attempt")
end)
test("approved props seat on their anchors: reels turn, the recovered recorder's lid opens", function()
	local models = freshWorld()
	local specs = modules.UploadedAssetSpecs.UploadedAssetSpecs
	local console = specs.CinematicRadioConsole
	template(models, "CinematicRadioConsole", console.size, {GeometrySource="Uploaded"}, {ReelL=console.rotors.ReelL.hub, ReelR=console.rotors.ReelR.hub})
	local recorder = specs.CinematicFieldRecorder
	local hinge = recorder.controlSurfaces.Lid
	template(models, "CinematicFieldRecorder", recorder.size, {GeometrySource="Uploaded"}, {Lid=(hinge.from + hinge.to) / 2 - vec(0, 0, .4)})
	template(models, "CinematicStatusBoard", specs.CinematicStatusBoard.size, {GeometrySource="Uploaded"})
	local recovery = chapterTitled("The last fracture")
	assert(modules.CinematicStaging.recorderOpen(recovery.id))
	mount(recovery.id)
	local s = stage()
	local seated = s:FindFirstChild("CinematicRadioConsole")
	assert(seated and s:FindFirstChild("Teal's receiver").Transparency == 1, "console replaces the receiver box")
	-- The console's Body anchor lands on the receiver point.
	local body = seated:GetPivot() * console.anchors.Body
	local want = vec(0, 6007, 0)
	assert((body - want).Magnitude < 1e-6, "seated on the anchor")
	assert(seated:FindFirstChild("ReelL") and seated:FindFirstChild("ReelR"), "deck reels kept")
	tick(.5)
	local lid = s:FindFirstChild("CinematicFieldRecorder"):FindFirstChild("Lid")
	assert(lid.CFrame.r[5] < .9, "lid swung open")
	assert(s:FindFirstChild("Sera's board") == nil and s:FindFirstChild("Board post") == nil, "board replaced")
	unmount(); assert(everythingUndone())
end)
print(`CINEMATIC_STAGE_RESULT passed={count}; engine doubles only, rendering NOT tested`)
