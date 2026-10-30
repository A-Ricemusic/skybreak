-- Studio capture helper (Client datamodel during Play). _G.SkybreakCapture(id) mounts the real
-- RelayCinematic for chapter `id` over a hidden game UI; _G.SkybreakCaptureStop() unmounts it.
local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local client=Players.LocalPlayer:WaitForChild("PlayerScripts"):WaitForChild("Client")
local TS=require(RS:WaitForChild("rbxts_include"):WaitForChild("RuntimeLib"))
local mod=client:WaitForChild("RelayCinematic")
local React=TS.import(mod,RS,"rbxts_include","node_modules","@rbxts","react")
local ReactRoblox=TS.import(mod,RS,"rbxts_include","node_modules","@rbxts","react-roblox")
local RelayCinematic=require(mod).RelayCinematic
local state=_G.SkybreakCaptureState or {}
_G.SkybreakCaptureState=state
function _G.SkybreakCaptureStop()
	if state.root then state.root:unmount() state.root=nil end
	if state.gui then state.gui:Destroy() state.gui=nil end
	for gui,enabled in pairs(state.hidden or {}) do if gui.Parent then gui.Enabled=enabled end end
	state.hidden=nil
end
function _G.SkybreakCapture(id)
	_G.SkybreakCaptureStop()
	local pg=Players.LocalPlayer:WaitForChild("PlayerGui")
	state.hidden={}
	for _,g in ipairs(pg:GetChildren()) do if g:IsA("ScreenGui") then state.hidden[g]=g.Enabled g.Enabled=false end end
	local gui=Instance.new("ScreenGui") gui.Name="CutsceneCapture" gui.DisplayOrder=100 gui.ResetOnSpawn=false gui.Parent=pg
	state.gui=gui
	state.root=ReactRoblox.createRoot(gui)
	state.root:render(React.createElement(RelayCinematic,{id=id,viewport=workspace.CurrentCamera.ViewportSize,onFinish=function() end,onCancel=function() end}))
end
return "ready"
