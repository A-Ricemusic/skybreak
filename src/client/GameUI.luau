local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local PLAYER = Players.LocalPlayer
local MENU_CAMERA = CFrame.lookAt(Vector3.new(180, 95, 170), Vector3.new(0, 24, 0))

local C = {
	Ink = Color3.fromRGB(5, 14, 25),
	Navy = Color3.fromRGB(10, 27, 43),
	Panel = Color3.fromRGB(13, 35, 53),
	PanelLight = Color3.fromRGB(18, 47, 67),
	Ivory = Color3.fromRGB(239, 235, 218),
	Muted = Color3.fromRGB(146, 164, 170),
	Teal = Color3.fromRGB(52, 218, 200),
	TealDim = Color3.fromRGB(25, 111, 111),
	Orange = Color3.fromRGB(255, 143, 72),
	Danger = Color3.fromRGB(255, 75, 71),
}

local function make(className, props, children)
	local object = Instance.new(className)
	for key, value in pairs(props or {}) do
		object[key] = value
	end
	for _, child in ipairs(children or {}) do
		child.Parent = object
	end
	return object
end

local function corner(radius)
	return make("UICorner", { CornerRadius = UDim.new(0, radius) })
end

local function stroke(color, transparency, thickness)
	return make("UIStroke", {
		Color = color,
		Transparency = transparency or 0,
		Thickness = thickness or 1,
	})
end

local function pad(left, right, top, bottom)
	return make("UIPadding", {
		PaddingLeft = UDim.new(0, left),
		PaddingRight = UDim.new(0, right),
		PaddingTop = UDim.new(0, top),
		PaddingBottom = UDim.new(0, bottom),
	})
end

local function textLabel(name, text, textSize, color, font)
	return make("TextLabel", {
		Name = name,
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Font = font or Enum.Font.Gotham,
		Text = text,
		TextColor3 = color or C.Ivory,
		TextSize = textSize,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Center,
	})
end

local function actionButton(name, text, primary)
	local control = make("TextButton", {
		Name = name,
		Active = true,
		AutoButtonColor = false,
		BackgroundColor3 = primary and C.Teal or C.PanelLight,
		BorderSizePixel = 0,
		Font = Enum.Font.GothamBold,
		Text = text,
		TextColor3 = primary and C.Ink or C.Ivory,
		TextSize = 15,
	}, {
		corner(4),
		stroke(primary and C.Teal or C.TealDim, 0.35, 1),
	})
	return control
end

local function enabled(control, isEnabled)
	control.Active = isEnabled
	control.BackgroundTransparency = isEnabled and 0 or 0.55
	control.TextTransparency = isEnabled and 0 or 0.42
	local outline = control:FindFirstChildOfClass("UIStroke")
	if outline then
		outline.Transparency = isEnabled and 0.35 or 0.82
	end
end

local function finite(value, fallback)
	if typeof(value) ~= "number" or value ~= value or math.abs(value) == math.huge then
		return fallback
	end
	return value
end

local function safeString(value, fallback)
	if typeof(value) == "string" and #value <= 80 then
		return value
	end
	return fallback
end

local GameUI = {}
GameUI.__index = GameUI

function GameUI.new(remotes, controller)
	local self = setmetatable({}, GameUI)
	self.remotes = remotes
	self.controller = controller
	self.connections = {}
	self.requestId = 0
	self.requestBusy = false
	self.selectedSlot = 1
	self.slots = nil
	self.persistence = "unavailable"
	self.inMission = false
	self.throttle = 0.65
	self.joystickInput = nil
	self.telemetrySampleClock = 0
	self.telemetry = self:_defaultTelemetry()
	return self
end

function GameUI:_defaultTelemetry()
	return {
		health = 100,
		speed = 0,
		altitude = 250,
		kills = 0,
		total = 3,
		missiles = 8,
		missileCooldown = 0,
		evadeCooldown = 0,
		target = nil,
		targetName = "",
		lockProgress = 0,
		incoming = false,
		elapsed = 0,
		targetDistance = 0,
		boundaryWarning = false,
	}
end

function GameUI:_connect(signal, callback)
	local connection = signal:Connect(callback)
	table.insert(self.connections, connection)
	return connection
end

function GameUI:_menuBackdrop(parent)
	local backdrop = make("Frame", {
		Name = "Backdrop",
		BackgroundColor3 = C.Ink,
		BackgroundTransparency = 0.17,
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		ZIndex = 0,
	})
	make("UIGradient", {
		Color = ColorSequence.new({
			ColorSequenceKeypoint.new(0, Color3.fromRGB(3, 13, 24)),
			ColorSequenceKeypoint.new(0.58, Color3.fromRGB(8, 31, 48)),
			ColorSequenceKeypoint.new(1, Color3.fromRGB(17, 54, 66)),
		}),
		Rotation = 24,
	}).Parent = backdrop
	backdrop.Parent = parent
	make("Frame", {
		Name = "TopAccent",
		BackgroundColor3 = C.Teal,
		BackgroundTransparency = 0.2,
		BorderSizePixel = 0,
		Position = UDim2.fromOffset(24, 20),
		Size = UDim2.fromOffset(70, 2),
		ZIndex = 1,
	}).Parent = parent
end

function GameUI:_buildTitle(parent)
	local screen = make("Frame", {
		Name = "TitleScreen",
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
	})
	screen.Parent = parent
	local content = make("Frame", {
		Name = "TitleContent",
		AnchorPoint = Vector2.new(0, 0.5),
		BackgroundTransparency = 1,
		Position = UDim2.new(0.075, 0, 0.5, 0),
		Size = UDim2.new(0.62, 0, 0, 330),
	})
	content.Parent = screen

	local eyebrow = textLabel("Eyebrow", "STRIKE COMMAND // THEATER 07", 12, C.Teal, Enum.Font.GothamBold)
	eyebrow.Position, eyebrow.Size = UDim2.fromOffset(2, 0), UDim2.new(1, 0, 0, 24)
	eyebrow.Parent = content
	local title = textLabel("Title", "SKYBREAK", 58, C.Ivory, Enum.Font.GothamBlack)
	title.Position, title.Size = UDim2.fromOffset(0, 28), UDim2.new(1, 0, 0, 72)
	title.TextScaled = true
	make("UITextSizeConstraint", { MaxTextSize = 58, MinTextSize = 30 }).Parent = title
	title.Parent = content
	local subtitle = textLabel("Subtitle", "O P E R A T I O N   G L A S S   H O R I Z O N", 14, C.Orange, Enum.Font.GothamBold)
	subtitle.Position, subtitle.Size = UDim2.fromOffset(2, 103), UDim2.new(1, 0, 0, 28)
	subtitle.Parent = content
	make("Frame", {
		Name = "Divider",
		BackgroundColor3 = C.Ivory,
		BackgroundTransparency = 0.72,
		BorderSizePixel = 0,
		Position = UDim2.fromOffset(2, 148),
		Size = UDim2.new(0.68, 0, 0, 1),
	}).Parent = content
	local blurb = textLabel("Blurb", "Three hostile aircraft have crossed the island defense line.\nLaunch before the horizon closes.", 15, C.Muted)
	blurb.Position, blurb.Size = UDim2.fromOffset(2, 166), UDim2.new(0.84, 0, 0, 54)
	blurb.TextWrapped, blurb.TextYAlignment = true, Enum.TextYAlignment.Top
	blurb.Parent = content
	local campaign = actionButton("CampaignButton", "CAMPAIGN   ›", true)
	campaign.Position, campaign.Size = UDim2.fromOffset(2, 245), UDim2.fromOffset(250, 58)
	campaign.TextXAlignment = Enum.TextXAlignment.Left
	pad(20, 16, 0, 0).Parent = campaign
	campaign.Parent = content
	local footer = textLabel("Footer", "ORIGINAL ARCADE FLIGHT COMBAT", 10, C.Muted, Enum.Font.GothamBold)
	footer.AnchorPoint, footer.Position = Vector2.new(1, 1), UDim2.new(1, -24, 1, -18)
	footer.Size, footer.TextXAlignment = UDim2.fromOffset(280, 20), Enum.TextXAlignment.Right
	footer.Parent = screen
	self.titleScreen, self.campaignButton = screen, campaign
end

function GameUI:_buildSlots(parent)
	local screen = make("Frame", {
		Name = "CampaignScreen",
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		Visible = false,
	})
	screen.Parent = parent
	local header = textLabel("CampaignHeader", "CAMPAIGN FILES", 28, C.Ivory, Enum.Font.GothamBlack)
	header.Position, header.Size = UDim2.new(0.06, 0, 0.07, 0), UDim2.new(0.75, 0, 0, 44)
	header.Parent = screen
	local sub = textLabel("CampaignSubheader", "SELECT A FLIGHT RECORD", 11, C.Teal, Enum.Font.GothamBold)
	sub.Position, sub.Size = UDim2.new(0.06, 2, 0.07, 44), UDim2.new(0.75, 0, 0, 24)
	sub.Parent = screen
	local grid = make("Frame", {
		Name = "SlotGrid",
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundTransparency = 1,
		Position = UDim2.fromScale(0.5, 0.53),
		Size = UDim2.new(0.88, 0, 0.56, 0),
	})
	grid.Parent = screen
	make("UIGridLayout", {
		CellPadding = UDim2.fromOffset(12, 12),
		CellSize = UDim2.new(0.5, -6, 0.5, -6),
		FillDirectionMaxCells = 2,
		SortOrder = Enum.SortOrder.LayoutOrder,
	}).Parent = grid
	self.slotButtons = {}
	for index = 1, 4 do
		local card = make("TextButton", {
			Name = "Slot" .. index .. "Button",
			AutoButtonColor = false,
			BackgroundColor3 = C.Panel,
			BackgroundTransparency = 0.08,
			BorderSizePixel = 0,
			LayoutOrder = index,
			Text = "",
		}, { corner(5), stroke(C.TealDim, 0.48, 1) })
		local number = textLabel("SlotNumber", string.format("%02d", index), 12, C.Orange, Enum.Font.GothamBold)
		number.Position, number.Size = UDim2.fromOffset(18, 10), UDim2.fromOffset(42, 22)
		number.Parent = card
		local status = textLabel("Status", "READING FILE...", 18, C.Ivory, Enum.Font.GothamBold)
		status.Position, status.Size = UDim2.fromOffset(18, 34), UDim2.new(1, -52, 0, 30)
		status.Parent = card
		local detail = textLabel("Detail", "PLEASE STAND BY", 11, C.Muted)
		detail.Position, detail.Size = UDim2.fromOffset(18, 66), UDim2.new(1, -52, 0, 22)
		detail.Parent = card
		local arrow = textLabel("Arrow", "›", 24, C.Teal)
		arrow.AnchorPoint, arrow.Position = Vector2.new(1, 0.5), UDim2.new(1, -18, 0.5, 0)
		arrow.Size, arrow.TextXAlignment = UDim2.fromOffset(22, 32), Enum.TextXAlignment.Right
		arrow.Parent = card
		card.Parent = grid
		self.slotButtons[index] = card
	end
	local back = actionButton("CampaignBackButton", "‹  BACK", false)
	back.Position, back.Size = UDim2.new(0.06, 0, 1, -64), UDim2.fromOffset(126, 46)
	back.Parent = screen
	local persistence = textLabel("PersistenceStatus", "CONNECTING TO FLIGHT RECORDS", 10, C.Muted, Enum.Font.GothamBold)
	persistence.AnchorPoint, persistence.Position = Vector2.new(1, 1), UDim2.new(0.94, 0, 1, -22)
	persistence.Size, persistence.TextXAlignment = UDim2.fromOffset(380, 22), Enum.TextXAlignment.Right
	persistence.Parent = screen
	self.slotScreen, self.slotGrid = screen, grid
	self.campaignBackButton, self.persistenceLabel = back, persistence
end

function GameUI:_buildBriefing(parent)
	local screen = make("Frame", {
		Name = "BriefingScreen",
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		Visible = false,
	})
	screen.Parent = parent
	local panel = make("Frame", {
		Name = "BriefingPanel",
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundColor3 = C.Panel,
		BackgroundTransparency = 0.04,
		BorderSizePixel = 0,
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.new(0.82, 0, 0.75, 0),
	}, { corner(6), stroke(C.TealDim, 0.35, 1), pad(34, 34, 24, 24) })
	panel.Parent = screen
	local eyebrow = textLabel("BriefingEyebrow", "MISSION 01 // EMERGENCY VECTOR", 11, C.Orange, Enum.Font.GothamBold)
	eyebrow.Size, eyebrow.Parent = UDim2.new(1, 0, 0, 22), panel
	local title = textLabel("BriefingTitle", "GLASS HORIZON", 32, C.Ivory, Enum.Font.GothamBlack)
	title.Position, title.Size, title.Parent = UDim2.fromOffset(0, 30), UDim2.new(1, 0, 0, 44), panel
	local tag = textLabel("ObjectiveTag", "PRIMARY OBJECTIVE", 10, C.Teal, Enum.Font.GothamBold)
	tag.Position, tag.Size, tag.Parent = UDim2.fromOffset(0, 90), UDim2.fromOffset(180, 18), panel
	local objective = textLabel("Objective", "Destroy the three hostile aircraft", 19, C.Ivory, Enum.Font.GothamBold)
	objective.Position, objective.Size, objective.Parent = UDim2.fromOffset(0, 110), UDim2.new(1, 0, 0, 34), panel
	local story = textLabel("Story", "CONTROL: Unknown contacts have cut across the outer defense line under cover of a fractured storm front. The island runway is still operational, but only just. Break through, identify the hostile flight, and clear the sky before they reach the evacuation corridor.", 14, C.Muted)
	story.Position, story.Size = UDim2.fromOffset(0, 156), UDim2.new(1, 0, 0, 82)
	story.TextWrapped, story.TextYAlignment, story.Parent = true, Enum.TextYAlignment.Top, panel
	make("Frame", {
		Name = "BriefingRule",
		BackgroundColor3 = C.Ivory,
		BackgroundTransparency = 0.78,
		BorderSizePixel = 0,
		Position = UDim2.new(0, 0, 1, -78),
		Size = UDim2.new(1, 0, 0, 1),
	}).Parent = panel
	local slot = textLabel("BriefingSlot", "FILE 01 // NEW SORTIE", 10, C.Muted, Enum.Font.GothamBold)
	slot.Position, slot.Size, slot.Parent = UDim2.new(0, 0, 1, -62), UDim2.new(0.45, 0, 0, 40), panel
	local launch = actionButton("LaunchButton", "LAUNCH  ›", true)
	launch.AnchorPoint, launch.Position = Vector2.new(1, 1), UDim2.new(1, 0, 1, 0)
	launch.Size, launch.Parent = UDim2.fromOffset(190, 52), panel
	local back = actionButton("BriefingBackButton", "‹  FILES", false)
	back.AnchorPoint, back.Position = Vector2.new(1, 1), UDim2.new(1, -204, 1, 0)
	back.Size, back.Parent = UDim2.fromOffset(126, 52), panel
	self.briefingScreen, self.briefingPanel = screen, panel
	self.briefingSlotLabel, self.launchButton, self.briefingBackButton = slot, launch, back
end

function GameUI:_buildHud(parent)
	local hud = make("Frame", {
		Name = "MissionHUD",
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		Visible = false,
	})
	hud.Parent = parent
	local objective = make("Frame", {
		Name = "ObjectivePanel",
		AnchorPoint = Vector2.new(0.5, 0),
		BackgroundColor3 = C.Ink,
		BackgroundTransparency = 0.28,
		BorderSizePixel = 0,
		Position = UDim2.new(0.5, 0, 0, 12),
		Size = UDim2.fromOffset(340, 54),
	}, { corner(3), stroke(C.TealDim, 0.55, 1) })
	objective.Parent = hud
	local objectiveText = textLabel("ObjectiveText", "DESTROY THE THREE HOSTILE AIRCRAFT", 11, C.Ivory, Enum.Font.GothamBold)
	objectiveText.Position, objectiveText.Size, objectiveText.Parent = UDim2.fromOffset(14, 5), UDim2.new(1, -28, 0, 22), objective
	local kills = textLabel("KillText", "HOSTILES  0 / 3", 13, C.Teal, Enum.Font.GothamBold)
	kills.Position, kills.Size, kills.Parent = UDim2.fromOffset(14, 26), UDim2.new(1, -28, 0, 22), objective

	local data = make("Frame", {
		Name = "TelemetryPanel",
		BackgroundColor3 = C.Ink,
		BackgroundTransparency = 0.3,
		BorderSizePixel = 0,
		Position = UDim2.fromOffset(14, 14),
		Size = UDim2.fromOffset(184, 116),
	}, { corner(3), stroke(C.TealDim, 0.6, 1), pad(12, 12, 8, 8) })
	data.Parent = hud
	make("UIListLayout", { Padding = UDim.new(0, 2), SortOrder = Enum.SortOrder.LayoutOrder }).Parent = data
	local rows = {
		{ "Hull", "HULL       100%", C.Ivory },
		{ "Speed", "SPEED        0", C.Ivory },
		{ "Altitude", "ALT        250", C.Ivory },
		{ "Elapsed", "TIME      00:00", C.Muted },
	}
	for order, row in ipairs(rows) do
		local item = textLabel(row[1], row[2], 12, row[3], Enum.Font.RobotoMono)
		item.Size, item.LayoutOrder, item.Parent = UDim2.new(1, 0, 0, 20), order, data
	end

	local target = make("Frame", {
		Name = "TargetStatus",
		AnchorPoint = Vector2.new(0.5, 0),
		BackgroundColor3 = C.Ink,
		BackgroundTransparency = 0.38,
		BorderSizePixel = 0,
		Position = UDim2.new(0.5, 0, 0, 72),
		Size = UDim2.fromOffset(280, 46),
	}, { corner(3), stroke(C.TealDim, 0.58, 1) })
	target.Parent = hud
	local targetText = textLabel("TargetText", "NO TARGET // SEEKING", 11, C.Teal, Enum.Font.RobotoMono)
	targetText.Size, targetText.TextXAlignment, targetText.Parent = UDim2.fromScale(1, 1), Enum.TextXAlignment.Center, target
	local warning = textLabel("Warning", "", 18, C.Danger, Enum.Font.GothamBlack)
	warning.AnchorPoint, warning.Position = Vector2.new(0.5, 0), UDim2.new(0.5, 0, 0, 124)
	warning.Size, warning.TextXAlignment, warning.Parent = UDim2.fromOffset(360, 36), Enum.TextXAlignment.Center, hud

	self:_buildTouchHud(hud)
	local help = textLabel("DesktopHelp", "W/S PITCH · A/D TURN · RMB STEER · SPACE/LMB MISSILE · F EVADE · TAB/R TARGET · Q/E THROTTLE · SHIFT BOOST", 9, C.Muted, Enum.Font.GothamBold)
	help.AnchorPoint, help.Position = Vector2.new(0.5, 1), UDim2.new(0.5, 0, 1, -8)
	help.Size, help.TextXAlignment = UDim2.new(0.7, 0, 0, 18), Enum.TextXAlignment.Center
	help.Visible, help.Parent = not UserInputService.TouchEnabled, hud

	self.hud, self.killText, self.telemetryPanel = hud, kills, data
	self.targetStatus = target
	self.targetText, self.warningText, self.desktopHelp = targetText, warning, help
end

function GameUI:_buildTouchHud(hud)
	local joystick = make("Frame", {
		Name = "TouchJoystick",
		Active = true,
		AnchorPoint = Vector2.new(0, 1),
		BackgroundColor3 = C.Ink,
		BackgroundTransparency = 0.34,
		BorderSizePixel = 0,
		Position = UDim2.new(0, 18, 1, -18),
		Size = UDim2.fromOffset(136, 136),
	}, { corner(68), stroke(C.TealDim, 0.3, 2) })
	joystick.Parent = hud
	local axes = textLabel("Axes", "+", 48, C.TealDim, Enum.Font.RobotoMono)
	axes.AnchorPoint, axes.Position = Vector2.new(0.5, 0.5), UDim2.fromScale(0.5, 0.5)
	axes.Size, axes.TextXAlignment, axes.TextTransparency = UDim2.fromOffset(64, 64), Enum.TextXAlignment.Center, 0.28
	axes.Parent = joystick
	local knob = make("Frame", {
		Name = "JoystickKnob",
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundColor3 = C.Teal,
		BackgroundTransparency = 0.12,
		BorderSizePixel = 0,
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.fromOffset(52, 52),
	}, { corner(26), stroke(C.Ivory, 0.6, 1) })
	knob.Parent = joystick

	local throttle = make("Frame", {
		Name = "ThrottleControls",
		AnchorPoint = Vector2.new(0, 1),
		BackgroundColor3 = C.Ink,
		BackgroundTransparency = 0.3,
		BorderSizePixel = 0,
		Position = UDim2.new(0, 166, 1, -18),
		Size = UDim2.fromOffset(68, 164),
	}, { corner(4), stroke(C.TealDim, 0.55, 1), pad(6, 6, 6, 6) })
	throttle.Parent = hud
	local plus = actionButton("ThrottleUpButton", "+", false)
	plus.Size, plus.TextSize, plus.Parent = UDim2.new(1, 0, 0, 48), 22, throttle
	local throttleText = textLabel("ThrottleText", "65%\nTHR", 11, C.Ivory, Enum.Font.RobotoMono)
	throttleText.Position, throttleText.Size = UDim2.fromOffset(0, 50), UDim2.new(1, 0, 0, 52)
	throttleText.TextXAlignment, throttleText.TextWrapped, throttleText.Parent = Enum.TextXAlignment.Center, true, throttle
	local minus = actionButton("ThrottleDownButton", "−", false)
	minus.AnchorPoint, minus.Position = Vector2.new(0, 1), UDim2.new(0, 0, 1, 0)
	minus.Size, minus.TextSize, minus.Parent = UDim2.new(1, 0, 0, 48), 22, throttle

	local actions = make("Frame", {
		Name = "CombatControls",
		AnchorPoint = Vector2.new(1, 1),
		BackgroundTransparency = 1,
		Position = UDim2.new(1, -18, 1, -18),
		Size = UDim2.fromOffset(270, 174),
	})
	actions.Parent = hud
	make("UIGridLayout", {
		CellPadding = UDim2.fromOffset(8, 8),
		CellSize = UDim2.new(0.5, -4, 0.5, -4),
		FillDirectionMaxCells = 2,
		SortOrder = Enum.SortOrder.LayoutOrder,
	}).Parent = actions
	local missile = actionButton("MissileButton", "MISSILE", true)
	missile.LayoutOrder, missile.TextSize, missile.Parent = 1, 16, actions
	local evade = actionButton("EvadeButton", "EVADE", false)
	evade.LayoutOrder, evade.Parent = 2, actions
	local cycle = actionButton("TargetButton", "TARGET", false)
	cycle.LayoutOrder, cycle.Parent = 3, actions
	local status = make("Frame", {
		Name = "WeaponStatus",
		BackgroundColor3 = C.Ink,
		BackgroundTransparency = 0.32,
		BorderSizePixel = 0,
		LayoutOrder = 4,
	}, { corner(4), stroke(C.TealDim, 0.58, 1) })
	status.Parent = actions
	local weapon = textLabel("WeaponText", "MSL  8\nSEEKING", 11, C.Ivory, Enum.Font.RobotoMono)
	weapon.Size, weapon.TextXAlignment, weapon.TextWrapped, weapon.Parent = UDim2.fromScale(1, 1), Enum.TextXAlignment.Center, true, status
	self.joystick, self.joystickKnob = joystick, knob
	self.throttlePanel, self.throttleText = throttle, throttleText
	self.throttleUpButton, self.throttleDownButton = plus, minus
	self.actionPanel, self.missileButton, self.evadeButton, self.targetButton = actions, missile, evade, cycle
	self.weaponText = weapon
end

function GameUI:_buildOutcome(parent)
	local screen = make("Frame", {
		Name = "OutcomeScreen",
		BackgroundColor3 = C.Ink,
		BackgroundTransparency = 0.12,
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		Visible = false,
	})
	screen.Parent = parent
	local panel = make("Frame", {
		Name = "VictoryPanel",
		AnchorPoint = Vector2.new(0.5, 0.5),
		BackgroundColor3 = C.Panel,
		BackgroundTransparency = 0.02,
		BorderSizePixel = 0,
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.new(0.68, 0, 0.62, 0),
	}, { corner(6), stroke(C.Teal, 0.35, 1), pad(32, 32, 24, 24) })
	panel.Parent = screen
	local eyebrow = textLabel("OutcomeEyebrow", "OPERATION GLASS HORIZON", 11, C.Orange, Enum.Font.GothamBold)
	eyebrow.Size, eyebrow.Parent = UDim2.new(1, 0, 0, 24), panel
	local title = textLabel("OutcomeTitle", "HORIZON SECURED", 34, C.Ivory, Enum.Font.GothamBlack)
	title.Position, title.Size, title.Parent = UDim2.fromOffset(0, 32), UDim2.new(1, 0, 0, 48), panel
	local summary = textLabel("OutcomeSummary", "All hostile aircraft destroyed.\nThe evacuation corridor is clear.", 15, C.Muted)
	summary.Position, summary.Size = UDim2.fromOffset(0, 88), UDim2.new(1, 0, 0, 54)
	summary.TextWrapped, summary.Parent = true, panel
	local stats = textLabel("OutcomeStats", "HOSTILES  3 / 3     TIME  00:00", 13, C.Teal, Enum.Font.RobotoMono)
	stats.Position, stats.Size, stats.Parent = UDim2.fromOffset(0, 154), UDim2.new(1, 0, 0, 28), panel
	local save = textLabel("SaveStatus", "", 11, C.Muted, Enum.Font.GothamBold)
	save.Position, save.Size, save.Parent = UDim2.fromOffset(0, 186), UDim2.new(1, 0, 0, 24), panel
	local retry = actionButton("RetryButton", "RETRY SORTIE", false)
	retry.AnchorPoint, retry.Position = Vector2.new(1, 1), UDim2.new(1, -198, 1, 0)
	retry.Size, retry.Parent = UDim2.fromOffset(184, 52), panel
	local menu = actionButton("ReturnToMenuButton", "CAMPAIGN COMPLETE  ›", true)
	menu.AnchorPoint, menu.Position = Vector2.new(1, 1), UDim2.new(1, 0, 1, 0)
	menu.Size, menu.Parent = UDim2.fromOffset(190, 52), panel
	self.outcomeScreen, self.victoryPanel = screen, panel
	self.outcomeTitle, self.outcomeSummary = title, summary
	self.outcomeStats, self.saveStatus = stats, save
	self.retryButton, self.returnButton = retry, menu
end

function GameUI:_build()
	local gui = make("ScreenGui", {
		Name = "SkybreakUI",
		DisplayOrder = 20,
		IgnoreGuiInset = false,
		ResetOnSpawn = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	})
	pcall(function()
		gui.ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets
	end)
	local root = make("Frame", { Name = "Root", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) })
	root.Parent = gui
	self:_menuBackdrop(root)
	self:_buildTitle(root)
	self:_buildSlots(root)
	self:_buildBriefing(root)
	self:_buildHud(root)
	self:_buildOutcome(root)
	local toast = textLabel("StatusToast", "", 12, C.Ivory, Enum.Font.GothamBold)
	toast.AnchorPoint, toast.Position = Vector2.new(0.5, 1), UDim2.new(0.5, 0, 1, -24)
	toast.BackgroundColor3, toast.BackgroundTransparency, toast.BorderSizePixel = C.Panel, 0.06, 0
	toast.Size, toast.TextXAlignment = UDim2.fromOffset(420, 46), Enum.TextXAlignment.Center
	toast.Visible, toast.ZIndex = false, 20
	corner(4).Parent = toast
	stroke(C.Orange, 0.35, 1).Parent = toast
	toast.Parent = root
	self.gui, self.root, self.toast = gui, root, toast
	return gui
end

function GameUI:_setMenuCamera()
	local camera = Workspace.CurrentCamera
	if camera then
		camera.CameraType = Enum.CameraType.Scriptable
		camera.CFrame = MENU_CAMERA
		camera.FieldOfView = 54
	end
end

function GameUI:_show(screenName)
	self.titleScreen.Visible = screenName == "title"
	self.slotScreen.Visible = screenName == "slots"
	self.briefingScreen.Visible = screenName == "briefing"
	self.hud.Visible = screenName == "mission"
	self.outcomeScreen.Visible = screenName == "outcome"
	self.root.Backdrop.Visible = screenName ~= "mission"
	self.root.TopAccent.Visible = screenName ~= "mission"
end

function GameUI:_toast(message, isError)
	self.toast.Text, self.toast.TextColor3, self.toast.Visible = message, isError and C.Danger or C.Ivory, true
	local id = self.requestId
	task.delay(4, function()
		if self.toast and id == self.requestId then
			self.toast.Visible = false
		end
	end)
end

function GameUI:_invoke(action, payload)
	local ok, response = pcall(function()
		return self.remotes.CampaignRequest:InvokeServer(action, payload)
	end)
	if not ok then
		return nil, "Command link interrupted. Try again."
	end
	if typeof(response) ~= "table" or response.ok ~= true then
		return nil, typeof(response) == "table" and safeString(response.error, "Command rejected the request.") or "Command rejected the request."
	end
	return response, nil
end

function GameUI:_request(callback)
	if self.requestBusy then
		return
	end
	self.requestBusy = true
	self.requestId += 1
	local id = self.requestId
	task.spawn(function()
		local ok, err = pcall(callback, id)
		if not ok then
			warn("SKYBREAK UI request failed:", err)
			self:_toast("Command link error. Try again.", true)
		end
		if id == self.requestId then
			self.requestBusy = false
		end
	end)
end

function GameUI:_formatTime(value)
	local seconds = math.max(0, math.floor(finite(value, 0)))
	return string.format("%02d:%02d", math.floor(seconds / 60), seconds % 60)
end

function GameUI:_applySlots(response)
	if typeof(response) ~= "table" or typeof(response.slots) ~= "table" or #response.slots ~= 4 then
		return false
	end
	local parsed = {}
	for index = 1, 4 do
		local source = response.slots[index]
		if typeof(source) ~= "table" then
			return false
		end
		parsed[index] = {
			occupied = source.occupied == true,
			completed = source.completed == true,
			kills = math.clamp(math.floor(finite(source.kills, 0)), 0, 3),
			bestTime = finite(source.bestTime, nil),
		}
	end
	self.slots = parsed
	local persistence = safeString(response.persistence, "unavailable")
	if persistence ~= "cloud" and persistence ~= "session" then
		persistence = "unavailable"
	end
	self.persistence = persistence
	self.persistenceLabel.Text = persistence == "cloud" and "FLIGHT RECORDS // CLOUD LINK ONLINE"
		or persistence == "session" and "FLIGHT RECORDS // THIS SESSION ONLY"
		or "FLIGHT RECORDS // OFFLINE — PROGRESS MAY NOT PERSIST"
	for index, slot in ipairs(parsed) do
		local card = self.slotButtons[index]
		if slot.completed then
			card.Status.Text, card.Status.TextColor3 = "COMPLETED // REPLAY", C.Teal
			card.Detail.Text = "HOSTILES 3 / 3   BEST " .. (slot.bestTime and self:_formatTime(slot.bestTime) or "--:--")
		elseif slot.occupied then
			card.Status.Text, card.Status.TextColor3 = "CONTINUE SORTIE", C.Ivory
			card.Detail.Text = string.format("LAST RESULT  %d / 3 HOSTILES", slot.kills)
		else
			card.Status.Text, card.Status.TextColor3 = "NEW CAMPAIGN", C.Ivory
			card.Detail.Text = "NO FLIGHT RECORD"
		end
		enabled(card, true)
	end
	return true
end

function GameUI:_loadSlots()
	for _, card in ipairs(self.slotButtons) do
		card.Status.Text, card.Detail.Text = "READING FILE...", "PLEASE STAND BY"
		enabled(card, false)
	end
	self.persistenceLabel.Text = "CONNECTING TO FLIGHT RECORDS"
	self:_request(function(id)
		local response, err = self:_invoke("ListSlots", nil)
		if id ~= self.requestId then
			return
		end
		if not response then
			for _, card in ipairs(self.slotButtons) do
				card.Status.Text, card.Detail.Text = "LINK UNAVAILABLE", "RETURN AND TRY AGAIN"
			end
			self.persistenceLabel.Text = "FLIGHT RECORDS // UNAVAILABLE"
			self:_toast(err, true)
		elseif not self:_applySlots(response) then
			self:_toast("Flight records returned an invalid response.", true)
		end
	end)
end

function GameUI:_selectSlot(index)
	if self.requestBusy or not self.slots or not self.slots[index] then
		return
	end
	self.selectedSlot = index
	local slot = self.slots[index]
	local mode = slot.completed and "COMPLETED // REPLAY" or (slot.occupied and "CONTINUE SORTIE" or "NEW SORTIE")
	self.briefingSlotLabel.Text = string.format("FILE %02d // %s", index, mode)
	self:_show("briefing")
end

function GameUI:_startMission()
	if self.requestBusy then
		return
	end
	enabled(self.launchButton, false)
	self.launchButton.Text = "REQUESTING CLEARANCE..."
	self:_request(function(id)
		local response, err = self:_invoke("StartMission", { slot = self.selectedSlot })
		if id ~= self.requestId then
			return
		end
		enabled(self.launchButton, true)
		self.launchButton.Text = "LAUNCH  ›"
		if not response then
			self:_toast(err, true)
			return
		end
		if response.slots then
			self:_applySlots(response)
		end
		self:_toast("Clearance received. Preparing aircraft...", false)
	end)
end

function GameUI:_returnToMenu()
	self.requestId += 1
	self.requestBusy, self.inMission = false, false
	self.controller:Stop()
	self:_setMenuCamera()
	self:_show("title")
	self:_request(function(id)
		local response, err = self:_invoke("ReturnToMenu", nil)
		if id ~= self.requestId then
			return
		end
		if not response then
			self:_toast(err, true)
		elseif response.slots then
			self:_applySlots(response)
		end
	end)
end

function GameUI:_retryMission()
	if self.requestBusy then
		return
	end
	enabled(self.retryButton, false)
	self.retryButton.Text = "RESETTING SORTIE..."
	self:_request(function(id)
		local returnResponse, returnError = self:_invoke("ReturnToMenu", nil)
		if id ~= self.requestId then
			return
		end
		if not returnResponse then
			enabled(self.retryButton, true)
			self.retryButton.Text = "RETRY SORTIE"
			self:_toast(returnError, true)
			return
		end
		if returnResponse.slots then
			self:_applySlots(returnResponse)
		end
		task.wait(0.16)
		if id ~= self.requestId then
			return
		end
		local startResponse, startError = self:_invoke("StartMission", { slot = self.selectedSlot })
		if id ~= self.requestId then
			return
		end
		enabled(self.retryButton, true)
		self.retryButton.Text = "RETRY SORTIE"
		if not startResponse then
			self:_toast(startError, true)
			return
		end
		if startResponse.slots then
			self:_applySlots(startResponse)
		end
		self:_toast("Clearance received. Preparing aircraft...", false)
	end)
end

function GameUI:_started(payload)
	self.selectedSlot = math.clamp(math.floor(finite(payload.slot, self.selectedSlot)), 1, 4)
	self.inMission, self.telemetry = true, self:_defaultTelemetry()
	self:_show("mission")
	self.controller:Start(payload)
	self.controller:SetThrottle(self.throttle)
	local ok, initial = pcall(function()
		return self.controller:GetTelemetry()
	end)
	if ok and typeof(initial) == "table" then
		self:_telemetry(initial)
	else
		self:_renderTelemetry()
	end
end

function GameUI:_telemetry(payload)
	if not self.inMission then
		return
	end
	local t = self.telemetry
	t.health = math.clamp(finite(payload.health, t.health), 0, 100)
	t.speed = math.max(0, finite(payload.speed, t.speed))
	t.altitude = finite(payload.altitude, t.altitude)
	t.kills = math.clamp(math.floor(finite(payload.kills, t.kills)), 0, 3)
	t.total = math.clamp(math.floor(finite(payload.total, 3)), 1, 3)
	t.missiles = math.max(0, math.floor(finite(payload.missiles, t.missiles)))
	t.missileCooldown = math.max(0, finite(payload.missileCooldown, t.missileCooldown))
	t.evadeCooldown = math.max(0, finite(payload.evadeCooldown, t.evadeCooldown))
	t.target = typeof(payload.target) == "Instance" and payload.target or nil
	t.targetName = safeString(payload.targetName, t.targetName)
	t.lockProgress = math.clamp(finite(payload.lockProgress, t.lockProgress), 0, 1)
	t.incoming = payload.incoming == true
	t.elapsed = math.max(0, finite(payload.elapsed, t.elapsed))
	t.targetDistance = math.max(0, finite(payload.targetDistance, t.targetDistance))
	if payload.boundaryWarning ~= nil then
		t.boundaryWarning = payload.boundaryWarning == true
	end
	self:_renderTelemetry()
end

function GameUI:_renderTelemetry()
	local t = self.telemetry
	self.telemetryPanel.Hull.Text = string.format("HULL       %3d%%", math.floor(t.health + 0.5))
	self.telemetryPanel.Hull.TextColor3 = t.health <= 30 and C.Danger or C.Ivory
	self.telemetryPanel.Speed.Text = string.format("SPEED      %4d", math.floor(t.speed + 0.5))
	self.telemetryPanel.Altitude.Text = string.format("ALT        %4d", math.floor(t.altitude + 0.5))
	self.telemetryPanel.Elapsed.Text = "TIME      " .. self:_formatTime(t.elapsed)
	self.killText.Text = string.format("HOSTILES  %d / %d", t.kills, t.total)
	local missileReady = t.missileCooldown <= 0 and t.missiles > 0
	enabled(self.missileButton, missileReady)
	self.missileButton.Text = missileReady and "MISSILE" or (t.missileCooldown > 0 and string.format("MISSILE %.1f", t.missileCooldown) or "MISSILE EMPTY")
	local evadeReady = t.evadeCooldown <= 0
	enabled(self.evadeButton, evadeReady)
	self.evadeButton.Text = evadeReady and "EVADE" or string.format("EVADE %.1f", t.evadeCooldown)
	local lock = t.lockProgress >= 1 and "LOCKED" or (t.target and string.format("LOCK %d%%", math.floor(t.lockProgress * 100)) or "SEEKING")
	self.weaponText.Text = string.format("MSL  %d\n%s", t.missiles, lock)
	self.weaponText.TextColor3 = t.lockProgress >= 1 and C.Teal or C.Ivory
	local name = t.targetName ~= "" and string.upper(t.targetName) or "NO TARGET"
	local distance = t.targetDistance > 0 and string.format(" // %dm", math.floor(t.targetDistance + 0.5)) or ""
	self.targetText.Text = string.format("%s%s // %s", name, distance, lock)
	if t.incoming then
		self.warningText.Text, self.warningText.TextColor3 = "⚠  MISSILE WARNING  ⚠", C.Danger
	elseif t.boundaryWarning then
		self.warningText.Text, self.warningText.TextColor3 = "AIRSPACE LIMIT — TURN BACK", C.Orange
	else
		self.warningText.Text = ""
	end
end

function GameUI:_finished(payload)
	if not self.inMission then
		return
	end
	self.inMission = false
	self.controller:Stop()
	self:_setMenuCamera()
	self:_show("outcome")
	local won = payload.kind == "Completed"
	local kills = math.clamp(math.floor(finite(payload.kills, self.telemetry.kills)), 0, 3)
	local elapsed = math.max(0, finite(payload.elapsed, self.telemetry.elapsed))
	if won then
		self.outcomeTitle.Text, self.outcomeTitle.TextColor3 = "HORIZON SECURED", C.Ivory
		self.outcomeSummary.Text = "All hostile aircraft destroyed.\nThe evacuation corridor is clear. Campaign complete."
		self.returnButton.Text = "CAMPAIGN COMPLETE  ›"
	else
		self.outcomeTitle.Text, self.outcomeTitle.TextColor3 = "SORTIE LOST", C.Danger
		self.outcomeSummary.Text = "The defense line did not hold.\nRearm and return to the horizon."
		self.returnButton.Text = "RETURN TO MENU  ›"
	end
	self.outcomeStats.Text = string.format("HOSTILES  %d / 3     TIME  %s", kills, self:_formatTime(elapsed))
	local persistence = safeString(payload.persistence, self.persistence)
	if won and payload.saved == true and persistence == "cloud" then
		self.saveStatus.Text, self.saveStatus.TextColor3 = "FLIGHT RECORD SAVED TO CLOUD", C.Teal
	elseif persistence == "session" then
		self.saveStatus.Text, self.saveStatus.TextColor3 = "RESULT HELD FOR THIS SESSION ONLY", C.Orange
	elseif persistence == "unavailable" then
		self.saveStatus.Text, self.saveStatus.TextColor3 = "SAVE SERVICE UNAVAILABLE — RESULT MAY NOT PERSIST", C.Orange
	else
		self.saveStatus.Text = won and "RESULT RECEIVED — SAVE NOT CONFIRMED" or ""
		self.saveStatus.TextColor3 = C.Muted
	end
end

function GameUI:_missionState(payload)
	if typeof(payload) ~= "table" then
		return
	end
	if payload.kind == "Started" then
		self:_started(payload)
	elseif payload.kind == "Telemetry" then
		self:_telemetry(payload)
	elseif payload.kind == "Completed" or payload.kind == "Failed" then
		self:_finished(payload)
	end
end

function GameUI:_setThrottle(value)
	self.throttle = math.clamp(value, 0, 1)
	self.throttleText.Text = string.format("%d%%\nTHR", math.floor(self.throttle * 100 + 0.5))
	if self.inMission then
		self.controller:SetThrottle(self.throttle)
	end
end

function GameUI:_moveJoystick(input)
	local center = self.joystick.AbsolutePosition + self.joystick.AbsoluteSize / 2
	local offset = Vector2.new(input.Position.X, input.Position.Y) - center
	local radius = math.max(1, self.joystick.AbsoluteSize.X * 0.34)
	if offset.Magnitude > radius then
		offset = offset.Unit * radius
	end
	local vector = Vector2.new(offset.X / radius, -offset.Y / radius)
	if vector.Magnitude < 0.08 then
		vector = Vector2.zero
	end
	self.joystickKnob.Position = UDim2.new(0.5, offset.X, 0.5, offset.Y)
	self.controller:SetInput(vector.X, vector.Y)
end

function GameUI:_releaseJoystick()
	self.joystickInput = nil
	self.joystickKnob.Position = UDim2.fromScale(0.5, 0.5)
	self.controller:SetInput(0, 0)
end

function GameUI:_layoutPanels(compact)
	local briefing = self.briefingPanel
	local victory = self.victoryPanel
	if compact then
		briefing.BriefingEyebrow.Size = UDim2.new(1, 0, 0, 16)
		briefing.BriefingEyebrow.TextSize = 9
		briefing.BriefingTitle.Position, briefing.BriefingTitle.Size = UDim2.fromOffset(0, 17), UDim2.new(1, 0, 0, 30)
		briefing.BriefingTitle.TextSize = 24
		briefing.ObjectiveTag.Position, briefing.ObjectiveTag.Size = UDim2.fromOffset(0, 50), UDim2.fromOffset(180, 14)
		briefing.ObjectiveTag.TextSize = 9
		briefing.Objective.Position, briefing.Objective.Size = UDim2.fromOffset(0, 64), UDim2.new(1, 0, 0, 26)
		briefing.Objective.TextSize = 16
		briefing.Story.Position, briefing.Story.Size = UDim2.fromOffset(0, 96), UDim2.new(1, 0, 0, 66)
		briefing.Story.TextSize = 11
		briefing.BriefingRule.Position = UDim2.new(0, 0, 1, -62)
		self.briefingSlotLabel.Position, self.briefingSlotLabel.Size = UDim2.new(0, 0, 1, -50), UDim2.new(0.45, 0, 0, 38)
		self.launchButton.Size, self.briefingBackButton.Size = UDim2.fromOffset(190, 48), UDim2.fromOffset(126, 48)

		victory.OutcomeEyebrow.Size, victory.OutcomeEyebrow.TextSize = UDim2.new(1, 0, 0, 16), 9
		self.outcomeTitle.Position, self.outcomeTitle.Size, self.outcomeTitle.TextSize = UDim2.fromOffset(0, 18), UDim2.new(1, 0, 0, 34), 25
		self.outcomeSummary.Position, self.outcomeSummary.Size, self.outcomeSummary.TextSize = UDim2.fromOffset(0, 53), UDim2.new(1, 0, 0, 42), 12
		self.outcomeStats.Position, self.outcomeStats.Size = UDim2.fromOffset(0, 101), UDim2.new(1, 0, 0, 22)
		self.saveStatus.Position, self.saveStatus.Size, self.saveStatus.TextSize = UDim2.fromOffset(0, 126), UDim2.new(1, 0, 0, 22), 9
		self.retryButton.Size, self.returnButton.Size = UDim2.fromOffset(184, 48), UDim2.fromOffset(190, 48)
	else
		briefing.BriefingEyebrow.Size, briefing.BriefingEyebrow.TextSize = UDim2.new(1, 0, 0, 22), 11
		briefing.BriefingTitle.Position, briefing.BriefingTitle.Size, briefing.BriefingTitle.TextSize = UDim2.fromOffset(0, 30), UDim2.new(1, 0, 0, 44), 32
		briefing.ObjectiveTag.Position, briefing.ObjectiveTag.Size, briefing.ObjectiveTag.TextSize = UDim2.fromOffset(0, 90), UDim2.fromOffset(180, 18), 10
		briefing.Objective.Position, briefing.Objective.Size, briefing.Objective.TextSize = UDim2.fromOffset(0, 110), UDim2.new(1, 0, 0, 34), 19
		briefing.Story.Position, briefing.Story.Size, briefing.Story.TextSize = UDim2.fromOffset(0, 156), UDim2.new(1, 0, 0, 82), 14
		briefing.BriefingRule.Position = UDim2.new(0, 0, 1, -78)
		self.briefingSlotLabel.Position, self.briefingSlotLabel.Size = UDim2.new(0, 0, 1, -62), UDim2.new(0.45, 0, 0, 40)
		self.launchButton.Size, self.briefingBackButton.Size = UDim2.fromOffset(190, 52), UDim2.fromOffset(126, 52)

		victory.OutcomeEyebrow.Size, victory.OutcomeEyebrow.TextSize = UDim2.new(1, 0, 0, 24), 11
		self.outcomeTitle.Position, self.outcomeTitle.Size, self.outcomeTitle.TextSize = UDim2.fromOffset(0, 32), UDim2.new(1, 0, 0, 48), 34
		self.outcomeSummary.Position, self.outcomeSummary.Size, self.outcomeSummary.TextSize = UDim2.fromOffset(0, 88), UDim2.new(1, 0, 0, 54), 15
		self.outcomeStats.Position, self.outcomeStats.Size = UDim2.fromOffset(0, 154), UDim2.new(1, 0, 0, 28)
		self.saveStatus.Position, self.saveStatus.Size, self.saveStatus.TextSize = UDim2.fromOffset(0, 186), UDim2.new(1, 0, 0, 24), 11
		self.retryButton.Size, self.returnButton.Size = UDim2.fromOffset(184, 52), UDim2.fromOffset(190, 52)
	end
end

function GameUI:_layout()
	local camera = Workspace.CurrentCamera
	if not camera then
		return
	end
	local size, portrait = camera.ViewportSize, camera.ViewportSize.Y > camera.ViewportSize.X
	local compact = size.Y < 500
	if portrait then
		self:_layoutPanels(false)
		self.titleScreen.TitleContent.Size, self.titleScreen.TitleContent.Position = UDim2.new(0.88, 0, 0, 330), UDim2.new(0.06, 0, 0.42, 0)
		self.slotGrid.Size, self.slotGrid.Position = UDim2.new(0.88, 0, 0.66, 0), UDim2.fromScale(0.5, 0.53)
		self.slotGrid.UIGridLayout.CellSize, self.slotGrid.UIGridLayout.FillDirectionMaxCells = UDim2.new(1, 0, 0.25, -9), 1
		self.briefingPanel.Size, self.victoryPanel.Size = UDim2.new(0.9, 0, 0.82, 0), UDim2.new(0.9, 0, 0.68, 0)
		self.actionPanel.Size = UDim2.fromOffset(132, 232)
		self.actionPanel.UIGridLayout.CellSize, self.actionPanel.UIGridLayout.FillDirectionMaxCells = UDim2.new(1, 0, 0.25, -6), 1
		self.joystick.Size = UDim2.fromOffset(124, 124)
		self.throttlePanel.Position, self.throttlePanel.Size = UDim2.new(0, 18, 1, -156), UDim2.fromOffset(124, 54)
		self.throttleUpButton.Size = UDim2.fromOffset(48, 42)
		self.throttleDownButton.AnchorPoint, self.throttleDownButton.Position = Vector2.new(1, 0), UDim2.new(1, 0, 0, 0)
		self.throttleDownButton.Size = UDim2.fromOffset(48, 42)
		self.throttleText.Position, self.throttleText.Size = UDim2.fromOffset(46, 0), UDim2.fromOffset(32, 42)
		self.telemetryPanel.Position = UDim2.fromOffset(14, 78)
		self.targetStatus.Position = UDim2.new(0.5, 0, 0, 200)
		self.warningText.Position = UDim2.new(0.5, 0, 0, 250)
		self.briefingBackButton.Position = UDim2.new(1, 0, 1, -60)
		self.retryButton.Position = UDim2.new(1, 0, 1, -60)
	else
		self:_layoutPanels(compact)
		self.titleScreen.TitleContent.Size, self.titleScreen.TitleContent.Position = UDim2.new(0.62, 0, 0, 330), UDim2.new(0.075, 0, 0.5, 0)
		self.slotGrid.Size, self.slotGrid.Position = UDim2.new(0.88, 0, 0.56, 0), UDim2.fromScale(0.5, 0.53)
		self.slotGrid.UIGridLayout.CellSize, self.slotGrid.UIGridLayout.FillDirectionMaxCells = UDim2.new(0.5, -6, 0.5, -6), 2
		self.briefingPanel.Size = compact and UDim2.new(0.9, 0, 0.9, 0) or UDim2.new(0.82, 0, 0.75, 0)
		self.victoryPanel.Size = compact and UDim2.new(0.82, 0, 0.9, 0) or UDim2.new(0.68, 0, 0.62, 0)
		self.actionPanel.Size = UDim2.fromOffset(270, compact and 154 or 174)
		self.actionPanel.UIGridLayout.CellSize, self.actionPanel.UIGridLayout.FillDirectionMaxCells = UDim2.new(0.5, -4, 0.5, -4), 2
		local joystickSize = compact and 122 or 136
		self.joystick.Size = UDim2.fromOffset(joystickSize, joystickSize)
		self.throttlePanel.Position, self.throttlePanel.Size = UDim2.new(0, compact and 150 or 166, 1, -18), UDim2.fromOffset(68, compact and 148 or 164)
		self.throttleUpButton.Size = UDim2.new(1, 0, 0, 48)
		self.throttleDownButton.AnchorPoint, self.throttleDownButton.Position = Vector2.new(0, 1), UDim2.new(0, 0, 1, 0)
		self.throttleDownButton.Size = UDim2.new(1, 0, 0, 48)
		self.throttleText.Position, self.throttleText.Size = UDim2.fromOffset(0, 50), UDim2.new(1, 0, 0, compact and 38 or 52)
		self.telemetryPanel.Position = UDim2.fromOffset(14, 14)
		self.targetStatus.Position = UDim2.new(0.5, 0, 0, 72)
		self.warningText.Position = UDim2.new(0.5, 0, 0, 124)
		self.briefingBackButton.Position = UDim2.new(1, -204, 1, 0)
		self.retryButton.Position = UDim2.new(1, -198, 1, 0)
	end
	self.desktopHelp.Visible = not UserInputService.TouchEnabled and not compact
end

function GameUI:_bind()
	self:_connect(self.campaignButton.Activated, function()
		if not self.requestBusy then
			self:_show("slots")
			self:_loadSlots()
		end
	end)
	self:_connect(self.campaignBackButton.Activated, function()
		if not self.requestBusy then
			self:_show("title")
		end
	end)
	for index, slot in ipairs(self.slotButtons) do
		self:_connect(slot.Activated, function()
			self:_selectSlot(index)
		end)
	end
	self:_connect(self.briefingBackButton.Activated, function()
		if not self.requestBusy then
			self:_show("slots")
		end
	end)
	self:_connect(self.launchButton.Activated, function() self:_startMission() end)
	self:_connect(self.retryButton.Activated, function() self:_retryMission() end)
	self:_connect(self.returnButton.Activated, function() self:_returnToMenu() end)
	self:_connect(self.missileButton.Activated, function()
		if self.inMission and self.telemetry.missileCooldown <= 0 and self.telemetry.missiles > 0 then self.controller:FireMissile() end
	end)
	self:_connect(self.evadeButton.Activated, function()
		if self.inMission and self.telemetry.evadeCooldown <= 0 then self.controller:Evade() end
	end)
	self:_connect(self.targetButton.Activated, function()
		if self.inMission then self.controller:CycleTarget() end
	end)
	self:_connect(self.throttleUpButton.Activated, function() self:_setThrottle(self.throttle + 0.1) end)
	self:_connect(self.throttleDownButton.Activated, function() self:_setThrottle(self.throttle - 0.1) end)
	self:_connect(self.joystick.InputBegan, function(input)
		if self.inMission and (input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1) then
			self.joystickInput = input
			self:_moveJoystick(input)
		end
	end)
	self:_connect(UserInputService.InputChanged, function(input)
		if self.joystickInput and (input == self.joystickInput or input.UserInputType == Enum.UserInputType.MouseMovement) then self:_moveJoystick(input) end
	end)
	self:_connect(UserInputService.InputEnded, function(input)
		if input == self.joystickInput or (self.joystickInput and input.UserInputType == Enum.UserInputType.MouseButton1) then self:_releaseJoystick() end
	end)
	self:_connect(self.remotes.MissionState.OnClientEvent, function(payload) self:_missionState(payload) end)
	self:_connect(RunService.RenderStepped, function(deltaTime)
		-- Character spawning can reset the default camera after the menu mounts.
		if not self.inMission then
			self:_setMenuCamera()
		end
		self.telemetrySampleClock += deltaTime
		if self.inMission and self.telemetrySampleClock >= 0.1 then
			self.telemetrySampleClock = 0
			local ok, snapshot = pcall(function()
				return self.controller:GetTelemetry()
			end)
			if ok and typeof(snapshot) == "table" then
				self.telemetry.targetDistance = math.max(0, finite(snapshot.targetDistance, self.telemetry.targetDistance))
				self.telemetry.boundaryWarning = snapshot.boundaryWarning == true
				self:_renderTelemetry()
			end
		end
		if self.telemetry.incoming and self.warningText.Text ~= "" then
			self.warningText.TextTransparency = 0.1 + 0.55 * math.abs(math.sin(os.clock() * 6))
		else
			self.warningText.TextTransparency = 0
		end
	end)
	local camera = Workspace.CurrentCamera
	if camera then
		self:_connect(camera:GetPropertyChangedSignal("ViewportSize"), function() self:_layout() end)
	end
end

function GameUI:Mount()
	if self.gui then
		return
	end
	self:_build().Parent = PLAYER:WaitForChild("PlayerGui")
	self:_setMenuCamera()
	self:_bind()
	self:_setThrottle(self.throttle)
	self:_layout()
	self:_show("title")
end

function GameUI:Destroy()
	self.requestId += 1
	self.controller:Stop()
	for _, connection in ipairs(self.connections) do connection:Disconnect() end
	table.clear(self.connections)
	if self.gui then self.gui:Destroy() end
	self.gui = nil
end

return GameUI
