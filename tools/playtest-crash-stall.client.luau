-- Run as a LocalScript in a fresh Studio mission (M1 recommended).
-- Only legal bound gamepad controls. Reads authoritative telemetry/results;
-- never moves aircraft, edits health, awards kills or mutates mission state.
assert(game:GetService("RunService"):IsStudio(), "Studio only")
local player = game.Players.LocalPlayer
local controller = require(player.PlayerScripts.Client.FlightController).FlightController.GetActive()
assert(controller and controller.active, "Launch a fresh mission first")
local previous = player.PlayerScripts:FindFirstChild("SkybreakCrashStallQA")
assert(not previous or previous:GetAttribute("Outcome") ~= "Running", "QA already running")
if previous then previous:Destroy() end
local report = Instance.new("Folder")
report.Name = "SkybreakCrashStallQA"
report:SetAttribute("Outcome", "Running")
report:SetAttribute("Transport", "Bound controller handler, not physical hardware routing")
report.Parent = player.PlayerScripts
report:SetAttribute("InitialThrottle", controller:GetControlStateForStudio().throttle)
local function send(key, state, y)
	assert(controller:SimulateGamepadInput(key, state, Vector3.new(0, y or 0, 0)) == Enum.ContextActionResult.Sink, "Input rejected")
end
local function stick(key, y) send(key, Enum.UserInputState.Change, y) end
local function release(key) send(key, Enum.UserInputState.End) end
local function untilCheck(seconds, predicate, message)
	local deadline = os.clock() + seconds
	repeat
		if predicate() then return end
		assert(controller.active, "Mission stopped: " .. message)
		task.wait(.05)
	until os.clock() > deadline
	error(message)
end
local resultConnection = game.ReplicatedStorage.Remotes.MissionState.OnClientEvent:Connect(function(data)
	if data.kind == "Failed" or data.kind == "Completed" then
		report:SetAttribute("ResultCount", (report:GetAttribute("ResultCount") or 0) + 1)
		report:SetAttribute("ServerOutcome", data.kind)
		report:SetAttribute("ServerReason", data.reason or "")
		report:SetAttribute("Kills", data.kills)
	end
end)
task.spawn(function()
	local ok, message = xpcall(function()
		if script:GetAttribute("DiveOnly") ~= true then
			report:SetAttribute("Phase", "Climb")
			stick(Enum.KeyCode.Thumbstick2, 1)
			stick(Enum.KeyCode.Thumbstick1, 1)
			untilCheck(12, function() return controller:GetTelemetry().altitude > 850 end, "Climb failed")
			release(Enum.KeyCode.Thumbstick1); release(Enum.KeyCode.Thumbstick2)
			local initial = controller:GetControlStateForStudio().throttle
			stick(Enum.KeyCode.Thumbstick2, .1); task.wait(.3); release(Enum.KeyCode.Thumbstick2)
			assert(math.abs(initial - controller:GetControlStateForStudio().throttle) < .001, "RS drift")
			report:SetAttribute("Phase", "Decelerate")
			report:SetAttribute("FastSpeed", controller:GetTelemetry().speed)
			stick(Enum.KeyCode.Thumbstick2, -1); task.wait(2.7); release(Enum.KeyCode.Thumbstick2)
			assert(controller:GetControlStateForStudio().throttle < .01, "RS did not reduce throttle")
			untilCheck(10, function() return controller:GetTelemetry().speed < 120 end, "No stall")
			report:SetAttribute("StallSpeed", controller:GetTelemetry().speed)
			for _, label in player.PlayerGui:GetDescendants() do
				if label:IsA("TextLabel") and label.Name == "WarningText" then
					report:SetAttribute("StallWarning", label.Text)
					assert(string.find(label.Text, "STALL"), "HUD did not warn of stall")
				end
			end
			local altitude = controller:GetTelemetry().altitude
			task.wait(.6)
			assert(controller:GetTelemetry().altitude < altitude - 5, "No loss of lift")
			report:SetAttribute("Phase", "Recover")
			stick(Enum.KeyCode.Thumbstick2, 1); stick(Enum.KeyCode.Thumbstick1, -.25)
			task.wait(2.7); release(Enum.KeyCode.Thumbstick2)
			untilCheck(8, function() return controller:GetTelemetry().speed > 180 end, "Recovery failed")
			report:SetAttribute("RecoveredSpeed", controller:GetTelemetry().speed)
			release(Enum.KeyCode.Thumbstick1)
			local held = controller:GetControlStateForStudio().throttle
			stick(Enum.KeyCode.Thumbstick2, -1); send(Enum.KeyCode.Thumbstick2, Enum.UserInputState.Cancel)
			task.wait(.3)
			assert(math.abs(held - controller:GetControlStateForStudio().throttle) < .001, "Throttle stuck after cancel")
			-- A real TextBox focus transition must release held stick/key inputs.
			local gui = Instance.new("ScreenGui"); gui.Name = "FlightFocusQA"; gui.Parent = player.PlayerGui
			local box = Instance.new("TextBox"); box.Size = UDim2.fromOffset(100,30); box.Parent = gui
			stick(Enum.KeyCode.Thumbstick2, -1)
			box:CaptureFocus(); task.wait(.1)
			local focusedThrottle = controller:GetControlStateForStudio().throttle
			task.wait(.3)
			assert(math.abs(focusedThrottle - controller:GetControlStateForStudio().throttle) < .001, "Throttle changed during text focus")
			box:ReleaseFocus(); gui:Destroy(); task.wait(.3)
			assert(math.abs(focusedThrottle - controller:GetControlStateForStudio().throttle) < .001, "Throttle stuck after text focus")
			local beforeBumpers = controller:GetControlStateForStudio().throttle
			send(Enum.KeyCode.ButtonL1, Enum.UserInputState.Begin); task.wait(.3); send(Enum.KeyCode.ButtonL1, Enum.UserInputState.End)
			local reduced = controller:GetControlStateForStudio().throttle
			assert(reduced < beforeBumpers - .05, "LB failed")
			send(Enum.KeyCode.ButtonR1, Enum.UserInputState.Begin); task.wait(.3); send(Enum.KeyCode.ButtonR1, Enum.UserInputState.End)
			assert(controller:GetControlStateForStudio().throttle > reduced + .05, "RB failed")
			report:SetAttribute("FocusAndBumpers", "Passed")
		end
		report:SetAttribute("Phase", "Dive")
		stick(Enum.KeyCode.Thumbstick1, -1)
		local deadline = os.clock() + 20
		repeat task.wait(.1) until report:GetAttribute("ServerOutcome") or os.clock() > deadline
		assert(report:GetAttribute("ServerOutcome") == "Failed", "No server failure")
		assert(string.sub(report:GetAttribute("ServerReason"), 1, 6) == "crash_", "Failure was not impact")
		assert(report:GetAttribute("Kills") == 0, "Unexpected kill")
		task.wait(.3)
		assert(report:GetAttribute("ResultCount") == 1, "Duplicate mission result")
		report:SetAttribute("Outcome", "Passed")
	end, debug.traceback)
	if not ok then report:SetAttribute("Outcome", "Failed"); report:SetAttribute("Error", tostring(message)); warn(message) end
	if controller.active then release(Enum.KeyCode.Thumbstick1); release(Enum.KeyCode.Thumbstick2) end
	resultConnection:Disconnect()
	print("SKYBREAK_CRASH_STALL_QA", report:GetAttributes())
end)
