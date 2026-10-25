-- Studio CLI entrypoint. Run only against the isolated test.project.json place.
assert(workspace:GetAttribute("SkybreakTestMode") == true, "Use the isolated Jest test place")
local root = game:GetService("ServerStorage"):WaitForChild("Tests")
local modules = game:GetService("ReplicatedStorage"):WaitForChild("rbxts_include").node_modules
local Jest = require(modules["@rbxts"].jest.src)
local outcome = Jest.runCLI(root, {
	config = "{}",
	verbose = true,
	ci = true,
	runInBand = true,
	testMatch = { "**/*.spec" },
	testTimeout = 20000,
}, {root}):expect()
local results = outcome.results
local summary = {
	success = results.success,
	passed = results.numPassedTests,
	failed = results.numFailedTests,
	suites = results.numTotalTestSuites,
	total = results.numTotalTests,
}
print("SKYBREAK_JEST_RESULT:" .. game:GetService("HttpService"):JSONEncode(summary))
assert(summary.success and summary.total > 0, "Roblox Jest suite failed or found no tests")
