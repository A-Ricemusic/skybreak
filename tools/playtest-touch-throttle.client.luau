-- Inject as a normal LocalScript in a menu-launched Studio mission.
-- Exercises the production touch controller API below engine/GUI dispatch.
-- Does not prove physical touch or multi-touch routing; never mutates mission state.
assert(game:GetService("RunService"):IsStudio(), "Studio only")
local player = game.Players.LocalPlayer
local controller = require(player.PlayerScripts.Client.FlightController).FlightController.GetActive()
assert(controller and controller.active, "Launch a fresh mission first")
local report = Instance.new("Folder")
report.Name = "SkybreakTwinStickQA"
report:SetAttribute("Outcome", "Running")
report.Parent = player.PlayerScripts
local function state() return controller:GetControlStateForStudio() end
local function held(seconds) task.wait(seconds) end
local ok, err = xpcall(function()
	local initial = state().throttle
	-- Make headroom through legal held input when rerunning after a full-power drag.
	if initial > .8 or initial < .2 then
		controller:SetTouchThrottleAxis(initial > .8 and -1 or 1)
		held(math.abs(initial - .65) / .4 + .05)
		controller:SetTouchThrottleAxis(0)
		initial = state().throttle
	end
	report:SetAttribute("InitialThrottle", initial)
	controller:SetInput(.3, .2)
	controller:SetTouchThrottleAxis(1)
	held(.35)
	assert(state().throttle > initial + .08, "Up did not accelerate")
	assert(math.abs(state().touchStick.X - .3) < .001 and math.abs(state().touchStick.Y - .2) < .001, "Throttle changed steering")
	controller:SetTouchThrottleAxis(0)
	local selected = state().throttle
	held(.25)
	assert(math.abs(state().throttle - selected) < .001, "Release did not hold selection")
	controller:SetTouchThrottleAxis(.17)
	held(.2)
	assert(math.abs(state().throttle - selected) < .001, "Deadzone drift")
	controller:SetTouchThrottleAxis(-1)
	held(.35)
	assert(state().throttle < selected - .08, "Down did not decelerate")
	controller:SetTouchThrottleAxis(0)
	controller:SetInput(0, 0)
	selected = state().throttle
	held(.2)
	assert(math.abs(state().throttle - selected) < .001, "Neutral did not hold")
	controller:SetTouchThrottleAxis(1)
	local text = Instance.new("TextBox")
	local gui = Instance.new("ScreenGui")
	gui.Name = "TwinStickFocusQA"
	gui.Parent = player.PlayerGui
	text.Parent = gui
	text:CaptureFocus()
	held(.1)
	assert(state().touchThrottleAxis == 0, "Focus did not clear held axis")
	text:ReleaseFocus()
	gui:Destroy()
	selected = state().throttle
	held(.2)
	assert(math.abs(state().throttle - selected) < .001, "Axis resumed after focus")
	report:SetAttribute("FinalThrottle", selected)
end, debug.traceback)
controller:SetTouchThrottleAxis(0)
controller:SetInput(0, 0)
report:SetAttribute("Outcome", ok and "Passed" or "Failed")
report:SetAttribute("Error", ok and "" or tostring(err))
print("SKYBREAK_TWIN_STICK_QA", report:GetAttributes())
