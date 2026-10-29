-- Run from Edit after all terrain/props probes finish. Uses the isolated project.
assert(workspace:GetAttribute("LargeWorldSpike"))
local Test=game:GetService("StudioTestService")
local Simulator=game:GetService("StudioDeviceSimulatorService")
local previousProfile=Simulator:GetDeviceAsync()
local previousStreaming=workspace.StreamingEnabled
local function run(extent, streaming, profile)
 workspace.StreamingEnabled=streaming
 print("LARGE_WORLD_PLAY_BEGIN",extent,streaming,profile)
 local result=Test:ExecutePlayModeAsync({extent=extent,profile=profile})
 print("LARGE_WORLD_PLAY:"..game:GetService("HttpService"):JSONEncode({extent=extent,streaming=streaming,profile=profile,result=result}))
end
local ok,err=pcall(function()
 Simulator:SetDeviceAsync("default")
 for _,extent in {8000,16000,24000,35000} do
  for _,streaming in {false,true} do run(extent,streaming,"desktop") end
 end
 Simulator:SetDeviceAsync("samsung_galaxy_a16")
 for _,streaming in {false,true} do run(35000,streaming,"Galaxy A16 emulator") end
end)
Simulator:SetDeviceAsync(previousProfile)
workspace.StreamingEnabled=previousStreaming
assert(ok,tostring(err))
print("LARGE_WORLD_PLAY_COMPLETE")
