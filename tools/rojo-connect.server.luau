-- Starts the official Rojo client for this repository without a manual UI click.
if not plugin or not game:GetService("RunService"):IsEdit() or workspace:GetAttribute("SkybreakTestMode") == true then
	return
end

local PROJECT_NAME = "Test Game Coding From Phone"
local config = game:GetService("ReplicatedStorage"):FindFirstChild("Shared")
config = config and config:FindFirstChild("GameConfig")
if not config or not string.find(config.Source, PROJECT_NAME, 1, true) then
	return
end

local Rojo = script.Parent.Rojo
local ApiContext = require(Rojo.Plugin.ApiContext)
local ServeSession = require(Rojo.Plugin.ServeSession)
local status = Instance.new("Folder")
status.Name = "PhoneGameRojoStatus"
status:SetAttribute("Project", PROJECT_NAME)
status.Parent = game:GetService("CoreGui")

local session
local unloaded = false
plugin.Unloading:Connect(function()
	unloaded = true
	if session then
		session:stop()
	end
	status:Destroy()
end)

task.spawn(function()
	while not unloaded do
		if not session or session:getStatus() == ServeSession.Status.Disconnected then
			local api = ApiContext.new("http://localhost:34872")
			local ok, info = api:connect():await()
			api:disconnect()
			if ok and info.projectName == PROJECT_NAME then
				session = ServeSession.new({ apiContext = ApiContext.new("http://localhost:34872"), twoWaySync = false })
				session:onStatusChanged(function(state, detail)
					status:SetAttribute("State", state)
					status:SetAttribute("Detail", tostring(detail))
					print("[Phone Game Rojo]", state, detail)
				end)
				session:start()
			else
				status:SetAttribute("State", "WaitingForProject")
			end
		end
		task.wait(3)
	end
end)
