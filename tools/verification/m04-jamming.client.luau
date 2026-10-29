-- Read-only client telemetry observer for the isolated M04 integration place.
assert(game:GetService('RunService'):IsStudio())
local player=game.Players.LocalPlayer
local remotes=game.ReplicatedStorage:WaitForChild('Remotes')
local codec=require(game.ReplicatedStorage.Shared.TelemetryCodec).TelemetryCodec
local report=Instance.new('Folder');report.Name='M04ClientVerification';report.Parent=player.PlayerScripts
local missionId,lastKey,telemetry=nil,nil,{}
remotes.MissionState.OnClientEvent:Connect(function(m)if m.kind=='Started' then missionId=m.missionId end end)
remotes.Telemetry.OnClientEvent:Connect(function(packet)
 if missionId~=4 or not codec:Decode(packet,telemetry) then return end
 local key=tostring(telemetry.radarJammed)..'/'..tostring(telemetry.radarPartial)
 if key==lastKey then return end;lastKey=key
 local v=Instance.new('StringValue');v.Name=key;v.Value=game.HttpService:JSONEncode({jammed=telemetry.radarJammed,partial=telemetry.radarPartial,visualRange=telemetry.jamVisualRange,elapsed=telemetry.elapsed});v.Parent=report
 print('M04_CLIENT_JAM:'..v.Value)
end)
