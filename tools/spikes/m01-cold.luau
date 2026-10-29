-- Fresh Studio process per cold run; omit the warm line for the second process.
local measure=require(game:GetService("ServerStorage").Measure)
measure("cold")
measure("warm")
