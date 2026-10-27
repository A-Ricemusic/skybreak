// Runs compiled controller -> UI radio delivery against the real queue; no Roblox playback claim.
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
const root = resolve(import.meta.dir, "..");
const read = (path: string) => Bun.file(resolve(root, path)).text();
const controller = await read("out/client/FlightController.luau");
const ui = await read("out/client/GameUI.luau");
function between(source: string, start: string, end: string): string {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Compiled delivery boundary missing: ${start}`);
  return source.slice(a, b);
}
const method = between(controller, "\tfunction FlightController:applyHud(message)", "\tfunction FlightController:handleBoundInput");
const delivery = between(ui, "\t\t\tif sanitized.radio ~= nil", "\t\t\tif sanitized.fireDenied ~= nil");
const queue = (await read("out/shared/RadioQueue.luau")).split("\n").filter(line => !line.startsWith("local TS =") && !line.includes("TS.import(")).join("\n");
const harness = `
local FlightController = {}
local MissionCatalog={IsValidId=function() return false end}
local WeaponRules={IsFireNotice=function() return false end}
local SpecialWeapons={IsKind=function() return false end}
local isModel=function() return false end
${method}
local _VoiceLines={VOICE_STALE_SECONDS=4,VOICE_TAIL=0.4}
local RadioQueue=(function() ${queue} end)().RadioQueue
local radioQueue=RadioQueue.new()
local now=0
local radioNow=function() return now end
local Voice={Radio=function() return nil end}
local RADIO_SECONDS=4.5
local stops, serials=0,0
local radioVoiceRef={current={Stop=function() stops+=1 end}}
local setRadioSerial=function() serials+=1 end
local previous={}
local function deliver(sanitized)
${delivery}
 previous=table.clone(sanitized)
end
local c=setmetatable({telemetry={},notify=function(self) deliver(self.telemetry) end},{__index=FlightController})
radioQueue:Push('old voice',4.5,0,12)
now=0.1
c:applyHud({radio='Bandits in 4s',radioSerial=1,radioSeconds=4,radioPriority=true})
assert(c.telemetry.radioPriority and radioQueue:Current(now).text=='Bandits in 4s' and stops==1)
local shown=radioQueue:Current(now).shownAt
now=0.2
c:applyHud({radio='Bandits in 4s',radioSerial=1,radioSeconds=4,radioPriority=true})
assert(stops==1 and serials==1 and radioQueue:Current(now).shownAt==shown)
now=4.1
c:applyHud({radio='Protection OFF',radioSerial=2,radioSeconds=6,radioPriority=true})
assert(radioQueue:Current(now).text=='Protection OFF')
now=4.2
c:applyHud({radio='ordinary',radioSerial=3})
assert(c.telemetry.radioPriority==false and radioQueue:Current(now).text=='Protection OFF' and radioQueue:Waiting()==1)
print('RADIO_DELIVERY passed=4 failed=0 (priority, repeated serial, expiry, ordinary reset)')
`;
const dest = resolve(root, "build/radio-delivery");
await mkdir(dest, { recursive: true });
const path = resolve(dest, "run.luau");
await Bun.write(path, harness);
const proc = Bun.spawn([process.env.LUAU_BIN ?? resolve(root, "build/offline-luau/luau"), path], { stdout: "inherit", stderr: "inherit" });
if (await proc.exited !== 0) process.exitCode = 1;
