local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ContextActionService = game:GetService("ContextActionService")
local GuiService = game:GetService("GuiService")
local FlightMath = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("FlightMath"))

local FlightController = {}
FlightController.__index = FlightController
local activeController
local controllerSerial = 0

local DEFAULTS = {
	kind = "Telemetry",
	health = 100,
	speed = 0,
	altitude = 250,
	kills = 0,
	total = 3,
	missiles = 8,
	missileCooldown = 0,
	evadeCooldown = 0,
	targetName = "",
	lockProgress = 0,
	incoming = false,
	elapsed = 0,
	targetDistance = 0,
	boundaryWarning = false,
}

local FLIGHT_KEYS = {
	Enum.KeyCode.W, Enum.KeyCode.S, Enum.KeyCode.A, Enum.KeyCode.D,
	Enum.KeyCode.Up, Enum.KeyCode.Down, Enum.KeyCode.Left, Enum.KeyCode.Right,
	Enum.KeyCode.Q, Enum.KeyCode.E, Enum.KeyCode.LeftShift,
	Enum.KeyCode.Space, Enum.KeyCode.F, Enum.KeyCode.Tab, Enum.KeyCode.R,
	Enum.KeyCode.ButtonR2, Enum.KeyCode.ButtonB, Enum.KeyCode.ButtonY,
	Enum.KeyCode.Thumbstick1,
}

local function remote(remotes, name)
	if typeof(remotes) == "Instance" then
		return remotes:WaitForChild(name)
	end
	assert(remotes[name], "Missing flight remote: " .. name)
	return remotes[name]
end

local function isModel(value)
	return typeof(value) == "Instance" and value:IsA("Model") and value.Parent ~= nil
end

local function createTargetCue(playerGui)
	local gui = Instance.new("ScreenGui")
	gui.Name = "SkybreakFlightTargeting"
	gui.IgnoreGuiInset = true
	gui.ResetOnSpawn = false
	gui.DisplayOrder = 8
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.Parent = playerGui
	local bracket = Instance.new("Frame")
	bracket.Name = "TargetBracket"
	bracket.AnchorPoint = Vector2.new(0.5, 0.5)
	bracket.Size = UDim2.fromOffset(60, 60)
	bracket.BackgroundTransparency = 1
	bracket.Visible = false
	bracket.Parent = gui
	local stroke = Instance.new("UIStroke")
	stroke.Thickness = 2
	stroke.Color = Color3.fromRGB(102, 237, 250)
	stroke.Parent = bracket
	local corners = Instance.new("UICorner")
	corners.CornerRadius = UDim.new(0, 7)
	corners.Parent = bracket
	local caption = Instance.new("TextLabel")
	caption.Name = "TargetCaption"
	caption.BackgroundTransparency = 1
	caption.Position = UDim2.new(0.5, 0, 1, 6)
	caption.AnchorPoint = Vector2.new(0.5, 0)
	caption.Size = UDim2.fromOffset(220, 45)
	caption.Font = Enum.Font.GothamBold
	caption.TextSize = 12
	caption.TextStrokeTransparency = 0.3
	caption.TextColor3 = stroke.Color
	caption.Parent = bracket
	local arrow = Instance.new("TextLabel")
	arrow.Name = "OffscreenDirection"
	arrow.AnchorPoint = Vector2.new(0.5, 0.5)
	arrow.Size = UDim2.fromOffset(50, 50)
	arrow.BackgroundTransparency = 1
	arrow.Font = Enum.Font.GothamBold
	arrow.Text = "▲"
	arrow.TextSize = 30
	arrow.TextColor3 = stroke.Color
	arrow.TextStrokeTransparency = 0.25
	arrow.Visible = false
	arrow.Parent = gui
	return gui, bracket, stroke, caption, arrow
end

-- Local QA can call this object just like the phone UI. The server applies the
-- same validation, movement, lock, cooldowns, damage and three-kill objective.
function FlightController.GetActive()
	return activeController
end

function FlightController.new(remotes)
	controllerSerial += 1
	local self = setmetatable({}, FlightController)
	self.remotes = {
		FlightInput = remote(remotes, "FlightInput"),
		CombatAction = remote(remotes, "CombatAction"),
		MissionState = remote(remotes, "MissionState"),
	}
	self.active = false
	self.telemetry = table.clone(DEFAULTS)
	self.touchInput = Vector2.zero
	self.gamepadInput = Vector2.zero
	self.throttle = 0.65
	self.keys = {}
	self.connections = {}
	self.hiddenParts = {}
	self.actionName = "SkybreakFlight_" .. controllerSerial
	self.renderName = "SkybreakCamera_" .. controllerSerial
	self.telemetryConnection = self.remotes.MissionState.OnClientEvent:Connect(function(data)
		if type(data) ~= "table" then
			return
		end
		if data.kind == "Telemetry" and self.active then
			for key, default in DEFAULTS do
				if type(data[key]) == type(default) then
					self.telemetry[key] = data[key]
				end
			end
			-- Clear dead targets rather than keeping a stale replicated model.
			self.telemetry.target = isModel(data.target) and data.target or nil
		elseif data.kind == "Completed" or data.kind == "Failed" then
			self:Stop()
		end
	end)
	activeController = self
	return self
end

function FlightController:SetInput(x, y)
	self.touchInput = Vector2.new(FlightMath.ClampInput(x), FlightMath.ClampInput(y))
end

function FlightController:SetThrottle(value)
	if FlightMath.IsFinite(value) then
		self.throttle = math.clamp(value, 0, 1)
	end
end

function FlightController:_action(action)
	if self.active then
		self.remotes.CombatAction:FireServer({ action = action })
	end
end

function FlightController:FireMissile()
	self:_action("FireMissile")
end

function FlightController:Evade()
	self:_action("Evade")
end

function FlightController:CycleTarget()
	self:_action("CycleTarget")
end

function FlightController:GetTelemetry()
	local result = table.clone(self.telemetry)
	if isModel(self.aircraft) then
		local position = self.aircraft:GetPivot().Position
		result.boundaryWarning = math.max(math.abs(position.X), math.abs(position.Z)) > 2300 or position.Y < 165 or position.Y > 980
		if isModel(result.target) then
			result.targetDistance = (result.target:GetPivot().Position - position).Magnitude
		else
			result.target, result.targetDistance = nil, 0
		end
	end
	return result
end

function FlightController:_input(dt)
	local x, y = self.touchInput.X + self.gamepadInput.X, self.touchInput.Y + self.gamepadInput.Y
	if not UserInputService:GetFocusedTextBox() then
		if self.keys[Enum.KeyCode.A] or self.keys[Enum.KeyCode.Left] then x -= 1 end
		if self.keys[Enum.KeyCode.D] or self.keys[Enum.KeyCode.Right] then x += 1 end
		if self.keys[Enum.KeyCode.W] or self.keys[Enum.KeyCode.Up] then y += 1 end
		if self.keys[Enum.KeyCode.S] or self.keys[Enum.KeyCode.Down] then y -= 1 end
		if self.keys[Enum.KeyCode.Q] then self:SetThrottle(self.throttle - dt * 0.4) end
		if self.keys[Enum.KeyCode.E] then self:SetThrottle(self.throttle + dt * 0.4) end
		if self.mouseSteer then
			local camera = workspace.CurrentCamera
			if camera then
				local inset = GuiService:GetGuiInset()
				local cursor = UserInputService:GetMouseLocation() - inset
				local size = camera.ViewportSize
				x += (cursor.X - size.X / 2) / math.max(size.X * 0.27, 1)
				y += (size.Y / 2 - cursor.Y) / math.max(size.Y * 0.27, 1)
			end
		end
	end
	return math.clamp(x, -1, 1), math.clamp(y, -1, 1), self.keys[Enum.KeyCode.LeftShift] and 1 or self.throttle
end

function FlightController:_updateTargetCue(camera)
	local target = self.telemetry.target
	if not isModel(target) then
		self.bracket.Visible = false
		self.arrow.Visible = false
		return
	end
	local worldPosition = target:GetPivot().Position
	local screen, visible = camera:WorldToViewportPoint(worldPosition)
	local size = camera.ViewportSize
	local safeX, safeY = math.min(90, size.X * 0.16), math.min(150, size.Y * 0.24)
	local inside = visible and screen.X >= safeX and screen.X <= size.X - safeX and screen.Y >= safeY and screen.Y <= size.Y - safeY
	self.bracket.Visible = inside
	self.arrow.Visible = not inside
	local locked = self.telemetry.lockProgress >= 0.99
	local color = locked and Color3.fromRGB(255, 193, 98) or Color3.fromRGB(103, 235, 248)
	self.bracketStroke.Color = color
	self.caption.TextColor3 = color
	if inside then
		self.bracket.Position = UDim2.fromOffset(screen.X, screen.Y)
		local distance = (worldPosition - self.visualFrame.Position).Magnitude
		self.caption.Text = string.format("%s  •  %d m\n%s", self.telemetry.targetName, math.floor(distance), locked and "LOCKED" or string.format("LOCK %d%%", self.telemetry.lockProgress * 100))
		local width = locked and 52 or 64
		self.bracket.Size = UDim2.fromOffset(width, width)
	else
		local localPosition = camera.CFrame:PointToObjectSpace(worldPosition)
		local direction = Vector2.new(localPosition.X, -localPosition.Y)
		if direction.Magnitude < 0.01 then
			direction = Vector2.new(localPosition.Z > 0 and 1 or 0, localPosition.Z > 0 and 0 or -1)
		end
		direction = direction.Unit
		local halfX, halfY = math.max(1, size.X / 2 - safeX), math.max(1, size.Y / 2 - safeY)
		local extent = 1 / math.max(math.abs(direction.X) / halfX, math.abs(direction.Y) / halfY)
		local point = size / 2 + direction * extent
		self.arrow.Position = UDim2.fromOffset(point.X, point.Y)
		self.arrow.Rotation = math.deg(math.atan2(direction.Y, direction.X)) + 90
		self.arrow.TextColor3 = color
	end
end

function FlightController:_render(dt)
	local camera = workspace.CurrentCamera
	if not self.active or not camera or not isModel(self.aircraft) then
		return
	end
	local authoritative = self.aircraft:GetPivot()
	self.visualFrame = self.visualFrame:Lerp(authoritative, FlightMath.DampAlpha(19, dt))
	if self.visual and self.visual.Parent then
		self.visual:PivotTo(self.visualFrame)
	end
	local position = self.visualFrame.Position
	local forward = self.visualFrame.LookVector
	local speedFactor = math.clamp((self.telemetry.speed - 165) / 155, 0, 1)
	-- Level camera up prevents motion sickness during a countermeasure roll.
	local desiredPosition = position - forward * (68 + speedFactor * 13) + Vector3.new(0, 20, 0)
	local desired = CFrame.lookAt(desiredPosition, position + forward * 100 + Vector3.new(0, 4, 0), Vector3.yAxis)
	self.cameraFrame = self.cameraFrame:Lerp(desired, FlightMath.DampAlpha(8, dt))
	camera.CameraType = Enum.CameraType.Scriptable
	camera.CFrame = self.cameraFrame
	camera.Focus = CFrame.new(position + forward * 90)
	camera.FieldOfView += (72 + speedFactor * 9 - camera.FieldOfView) * FlightMath.DampAlpha(3, dt)
	self:_updateTargetCue(camera)
	self.sendTime += dt
	local x, y, throttle = self:_input(dt)
	if self.sendTime >= 1 / 15 then
		self.sendTime %= 1 / 15
		self.remotes.FlightInput:FireServer({ x = x, y = y, throttle = throttle })
	end
end

function FlightController:Start(missionData)
	self:Stop()
	if type(missionData) ~= "table" or not isModel(missionData.aircraft) then
		warn("SKYBREAK flight start is missing its replicated aircraft")
		return false
	end
	self.aircraft = missionData.aircraft
	self.active = true
	activeController = self
	self.telemetry = table.clone(DEFAULTS)
	self.keys = {}
	self.touchInput = Vector2.zero
	self.gamepadInput = Vector2.zero
	self.throttle = 0.65
	self.sendTime = 1 / 15
	self.mouseSteer = false
	self.visualFrame = self.aircraft:GetPivot()
	local camera = workspace.CurrentCamera
	if camera then
		self.previousCamera = { type = camera.CameraType, subject = camera.CameraSubject, frame = camera.CFrame, fov = camera.FieldOfView }
		self.cameraFrame = CFrame.lookAt(self.visualFrame.Position - self.visualFrame.LookVector * 75 + Vector3.new(0, 20, 0), self.visualFrame.Position + self.visualFrame.LookVector * 100)
	else
		self.cameraFrame = self.visualFrame
	end
	-- A local visual smoothly follows the anchored authoritative plane. Only
	-- visual transparency changes locally; server simulation remains untouched.
	self.visual = self.aircraft:Clone()
	self.visual.Name = "SkybreakLocalFlightVisual"
	self.visual.Parent = workspace
	for _, descendant in self.visual:GetDescendants() do
		if descendant:IsA("Trail") then
			descendant:Clear()
		end
	end
	local function hidePart(descendant)
		if descendant:IsA("BasePart") then
			self.hiddenParts[descendant] = descendant.LocalTransparencyModifier
			descendant.LocalTransparencyModifier = 1
		elseif descendant:IsA("Trail") then
			self.hiddenParts[descendant] = descendant.Enabled
			descendant.Enabled = false
		end
	end
	for _, descendant in self.aircraft:GetDescendants() do hidePart(descendant) end
	table.insert(self.connections, self.aircraft.DescendantAdded:Connect(hidePart))
	self.targetGui, self.bracket, self.bracketStroke, self.caption, self.arrow = createTargetCue(Players.LocalPlayer:WaitForChild("PlayerGui"))
	ContextActionService:BindActionAtPriority(self.actionName, function(_, state, input)
		if not self.active or UserInputService:GetFocusedTextBox() then
			return Enum.ContextActionResult.Pass
		end
		if input.KeyCode == Enum.KeyCode.Thumbstick1 then
			local value = Vector2.new(input.Position.X, input.Position.Y)
			self.gamepadInput = value.Magnitude >= 0.12 and value or Vector2.zero
		else
			self.keys[input.KeyCode] = state == Enum.UserInputState.Begin or state == Enum.UserInputState.Change
			if state == Enum.UserInputState.Begin then
				if input.KeyCode == Enum.KeyCode.Space or input.KeyCode == Enum.KeyCode.ButtonR2 then self:FireMissile() end
				if input.KeyCode == Enum.KeyCode.F or input.KeyCode == Enum.KeyCode.ButtonB then self:Evade() end
				if input.KeyCode == Enum.KeyCode.Tab or input.KeyCode == Enum.KeyCode.R or input.KeyCode == Enum.KeyCode.ButtonY then self:CycleTarget() end
			end
		end
		return Enum.ContextActionResult.Sink
	end, false, 3000, table.unpack(FLIGHT_KEYS))
	table.insert(self.connections, UserInputService.InputBegan:Connect(function(input, processed)
		if processed or UserInputService:GetFocusedTextBox() then return end
		if input.UserInputType == Enum.UserInputType.MouseButton1 then self:FireMissile() end
		if input.UserInputType == Enum.UserInputType.MouseButton2 then self.mouseSteer = true end
	end))
	table.insert(self.connections, UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton2 then self.mouseSteer = false end
	end))
	table.insert(self.connections, UserInputService.WindowFocusReleased:Connect(function()
		table.clear(self.keys)
		self.mouseSteer = false
		self.touchInput, self.gamepadInput = Vector2.zero, Vector2.zero
	end))
	RunService:BindToRenderStep(self.renderName, Enum.RenderPriority.Camera.Value + 1, function(dt) self:_render(dt) end)
	return true
end

function FlightController:Stop()
	self.active = false
	RunService:UnbindFromRenderStep(self.renderName)
	ContextActionService:UnbindAction(self.actionName)
	for _, connection in self.connections do connection:Disconnect() end
	table.clear(self.connections)
	for part, previous in self.hiddenParts do
		if part.Parent then
			if part:IsA("BasePart") then part.LocalTransparencyModifier = previous end
			if part:IsA("Trail") then part.Enabled = previous end
		end
	end
	table.clear(self.hiddenParts)
	if self.visual then self.visual:Destroy() self.visual = nil end
	if self.targetGui then self.targetGui:Destroy() self.targetGui = nil end
	local camera = workspace.CurrentCamera
	if camera and self.previousCamera then
		camera.CameraType = self.previousCamera.type
		camera.CameraSubject = self.previousCamera.subject
		camera.CFrame = self.previousCamera.frame
		camera.FieldOfView = self.previousCamera.fov
	end
	self.previousCamera = nil
	self.aircraft = nil
	self.touchInput, self.gamepadInput = Vector2.zero, Vector2.zero
	table.clear(self.keys)
	self.mouseSteer = false
end

function FlightController:Destroy()
	self:Stop()
	self.telemetryConnection:Disconnect()
	if activeController == self then activeController = nil end
end

return FlightController
