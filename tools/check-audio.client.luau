-- Studio-only: validates approved asset fetches and native playback regions.
-- Does not change missions, combat, saves, or any provider credentials.
assert(game:GetService("RunService"):IsStudio(), "Studio-only audio QA")
local Players = game:GetService("Players")
local ContentProvider = game:GetService("ContentProvider")
local SoundService = game:GetService("SoundService")
local HttpService = game:GetService("HttpService")
local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
local bank = require(game.ReplicatedStorage.Shared.SoundBank).SoundBank
local old = playerGui:FindFirstChild("SkybreakAudioQA")
if old then old:Destroy() end
local report = Instance.new("Folder")
report.Name = "SkybreakAudioQA"
report:SetAttribute("State", "Running")
report.Parent = playerGui
task.spawn(function()
	local ok, err = pcall(function()
		local unique, ids, count = {}, {}, 0
		for name, definition in bank do
			count += 1
			assert(definition.assetId:match("^rbxassetid://%d+$"), name .. ": invalid ID")
			assert(definition.finish > definition.start and definition.seconds > 0, name .. ": invalid region")
			if not unique[definition.assetId] then
				unique[definition.assetId] = true
				table.insert(ids, definition.assetId)
			end
		end
		assert(count == 25, "Expected the complete 25-effect library, got " .. count)
		report:SetAttribute("CueCount", count)
		report:SetAttribute("AssetCount", #ids)
		local failures, probes = {}, {}
		for _, id in ids do
			local probe = Instance.new("Sound")
			probe.SoundId = id
			table.insert(probes, probe)
		end
		ContentProvider:PreloadAsync(probes, function(id, status)
			if status ~= Enum.AssetFetchStatus.Success then table.insert(failures, id .. ":" .. status.Name) end
		end)
		for _, probe in probes do probe:Destroy() end
		assert(#failures == 0, "Fetch failures: " .. table.concat(failures, ", "))
		report:SetAttribute("FetchFailures", 0)
		local checked = 0
		for name, definition in bank do
			local sound = Instance.new("Sound")
			sound.Name = "QA_" .. name
			sound.SoundId = definition.assetId
			sound.Volume = 0
			sound.PlaybackRegionsEnabled = true
			sound.PlaybackRegion = NumberRange.new(definition.start, definition.finish)
			sound.LoopRegion = sound.PlaybackRegion
			sound.Looped = definition.loop
			sound.Parent = SoundService
			local deadline = os.clock() + 8
			while not sound.IsLoaded and os.clock() < deadline do task.wait(0.05) end
			assert(sound.IsLoaded and sound.TimeLength >= definition.finish - 0.06, name .. ": asset not ready, length=" .. sound.TimeLength .. " expected finish=" .. definition.finish)
			sound:Play()
			task.wait(0.08)
			assert(sound.IsPlaying, name .. ": playback did not start")
			assert(sound.TimePosition >= definition.start - 0.06 and sound.TimePosition < definition.finish + 0.06, name .. ": playing outside cue region")
			sound:Destroy()
			checked += 1
			report:SetAttribute("RegionsChecked", checked)
		end
		local function regionSound(definition, looped)
			local sound = Instance.new("Sound")
			sound.Name = "QA_RegionBoundary"
			sound.SoundId = definition.assetId
			sound.Volume = 0
			sound.PlaybackRegionsEnabled = true
			sound.PlaybackRegion = NumberRange.new(definition.start, definition.finish)
			sound.LoopRegion = sound.PlaybackRegion
			sound.Looped = looped
			sound.Parent = SoundService
			local deadline = os.clock() + 8
			while not sound.IsLoaded and os.clock() < deadline do task.wait(0.05) end
			assert(sound.IsLoaded, "Boundary-test sound did not load")
			return sound
		end
		local looping = regionSound(bank.lockSearch, true)
		local loops = 0
		looping.DidLoop:Connect(function() loops += 1 end)
		looping:Play()
		task.wait(bank.lockSearch.seconds + 0.25)
		assert(loops >= 1 and looping.IsPlaying, "Loop region did not repeat")
		assert(looping.TimePosition >= bank.lockSearch.start and looping.TimePosition <= bank.lockSearch.finish, "Loop escaped into a neighboring cue")
		looping:Destroy()
		local transient = regionSound(bank.uiConfirm, false)
		local ended = false
		transient.Ended:Connect(function() ended = true end)
		transient:Play()
		task.wait(bank.uiConfirm.seconds + 0.3)
		assert(ended and not transient.IsPlaying, "One-shot did not end at its region boundary")
		transient:Destroy()
		report:SetAttribute("LoopBoundary", true)
		report:SetAttribute("OneShotBoundary", true)
		local result = { cues = count, assets = #ids, regionsChecked = checked, fetchFailures = #failures, loopBoundary = true, oneShotBoundary = true }
		report:SetAttribute("Result", HttpService:JSONEncode(result))
		report:SetAttribute("State", "Passed")
		print("SKYBREAK_AUDIO_QA:" .. HttpService:JSONEncode(result))
	end)
	if not ok then
		report:SetAttribute("State", "Failed")
		report:SetAttribute("Error", tostring(err))
		warn("SKYBREAK_AUDIO_QA_FAILED: " .. tostring(err))
	end
end)
return "Audio fetch and playback-region QA started; inspect PlayerGui.SkybreakAudioQA"
