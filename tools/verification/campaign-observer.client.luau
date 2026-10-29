-- Read-only runtime observer. No remote invocations, movement or state edits.
assert(game:GetService("RunService"):IsStudio())
local player=game:GetService("Players").LocalPlayer
local RS=game:GetService("ReplicatedStorage")
local H=game:GetService("HttpService")
local folder=Instance.new("Folder");folder.Name="CampaignVerification";folder.Parent=player.PlayerScripts
local function clean(v)
 if typeof(v)=="Instance" then return v:GetFullName() end
 if typeof(v)=="Vector3" then return {v.X,v.Y,v.Z} end
 if type(v)=="table" then local out={};for k,x in pairs(v) do out[tostring(k)]=clean(x) end;return out end
 return v
end
local sequence=0
local function record(kind,data)
 sequence+=1
 local s=H:JSONEncode({kind=kind,clock=os.clock(),data=clean(data)})
 local entry=Instance.new("StringValue");entry.Name=string.format("%05d_%s",sequence,kind);entry.Value=s;entry.Parent=folder
 print("CAMPAIGN_VERIFY:"..s)
end
local loading
RS:WaitForChild("Remotes"):WaitForChild("MissionState").OnClientEvent:Connect(function(message)
 if message.kind=="Loading" then loading=os.clock() end
 record("MissionState",message)
 if message.kind=="FlightControl" then record("TimeToControl",{secondsFromLoading=loading and os.clock()-loading}) end
end)
local FC=require(player:WaitForChild("PlayerScripts"):WaitForChild("Client"):WaitForChild("FlightController")).FlightController
while task.wait(1) do
 local c=FC.GetActive()
 if c and c.active then record("Telemetry",c:GetTelemetry()) end
end
