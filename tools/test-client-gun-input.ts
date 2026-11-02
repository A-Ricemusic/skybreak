// Executes compiled controller methods/callbacks; no engine input-routing or rendering claim.
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { requireLuauBin } from "./luau-bin";
const root = resolve(import.meta.dir, "..");
const source = await Bun.file(resolve(root, "out/client/FlightController.luau")).text();
function between(start: string, end: string) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Missing compiled boundary: ${start}`);
  return source.slice(a, b);
}
const gun = between("\tfunction FlightController:HasGun()", "\tfunction FlightController:IsGunFiring()");
const reset = between("\t\tlocal clearInput = function()", "\t\tlocal _connections_3 = self.connections");
const cutIn = between('elseif message.kind == "CutInStarted" and self.active then', 'elseif message.kind == "CutInComplete"');
for (const event of ["TextBoxFocused", "GamepadDisconnected", "WindowFocusReleased"]) {
  if (!source.includes(`UserInputService.${event}:Connect(clearInput)`)) throw new Error(`${event} lost input cleanup`);
}
const script = `
local FlightController = {}
local Vector2 = {zero = {}}
local EliteCutIn = {new = function() return {} end}
${gun}
local sent = {}
local self = setmetatable({active=true, telemetry={gunRounds=100}, gunSources={}, gunHeld=false, keys={},
 remotes={CombatAction={FireServer=function(_, packet) table.insert(sent,packet.action) end}},
 action=function(_, action) table.insert(sent,action) end}, {__index=FlightController})
${reset}
for _, event in {'text focus','gamepad disconnect','window focus'} do
 table.clear(sent)
 self:SetGunTrigger('keyboard',true)
 self:SetGunTrigger('touch',true)
 assert(#sent==1 and sent[1]=='GunStart', event)
 clearInput()
 assert(not self.gunHeld and next(self.gunSources)==nil and #sent==2 and sent[2]=='GunStop',event)
 clearInput()
 self:SetGunTrigger('keyboard',false)
 assert(#sent==2, 'late releases must be idempotent')
 self:SetGunTrigger('keyboard',true)
 assert(#sent==3 and sent[3]=='GunStart', 'fresh press must restart')
 clearInput()
end
self:SetGunTrigger('keyboard',true)
local message = {kind='CutInStarted'}
local data = {plan={}, subjects={}}
if false then
${cutIn}
end
assert(self.cutIn and not self.gunHeld and next(self.gunSources)==nil and sent[#sent]=='GunStop')
local before=#sent
self:SetGunTrigger('touch',true)
assert(not self.gunHeld and next(self.gunSources)==nil and #sent==before, 'cut-in must reject held sources')
self.cutIn=nil
self:SetGunTrigger('touch',true)
assert(self.gunHeld and sent[#sent]=='GunStart','fresh post-cut-in press must start')
self:ReleaseGun()
print('CLIENT_GUN_INPUT passed=6 failed=0; compiled callbacks only, engine input routing NOT tested')
`;
const dir = resolve(root, "build/client-gun-input");
await mkdir(dir, { recursive: true });
const path = resolve(dir, "run.luau");
await Bun.write(path, script);
const proc = Bun.spawn([requireLuauBin(), path], { stdout: "inherit", stderr: "inherit" });
if (await proc.exited !== 0) process.exitCode = 1;

// The HUD must retain an equipped gun even at zero rounds, and drop it for an unequipped sortie.
const format = await Bun.file(resolve(root, "out/client/screens/UIFormat.luau")).text();
function formatMethod(start: string, end: string) {
  const a = format.indexOf(start), b = format.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Missing compiled formatter boundary: ${start}`);
  return format.slice(a, b);
}
const hudScript = `
local MissionCatalog={IsValidId=function() return true end}
local SpecialWeapons={IsKind=function() return false end}
local WeaponRules={IsFireNotice=function() return false end}
local CountdownDisplay={Value=function() return 0 end}
${formatMethod('local function finite(', 'local function scaleRectangle(')}
${formatMethod('local function sanitizeTelemetry(', 'local function resumeMission(')}
local baseline={health=100,speed=0,altitude=0,kills=0,total=1,missiles=0,missileCooldown=0,evadeCooldown=0,elapsed=0,lockProgress=0,missionId=1,targetName=''}
for _, case in {{125,125},{0,0},{-5,0},{3.8,3},{math.huge,0}} do
 local packet=table.clone(baseline)
 packet.gunRounds=case[1]
 assert(sanitizeTelemetry(packet,baseline).gunRounds==case[2])
end
assert(sanitizeTelemetry(baseline,{gunRounds=50}).gunRounds==nil,'unequipped gun must stay absent')
print('CLIENT_GUN_HUD passed=6 failed=0; compiled sanitizer only, GUI rendering NOT tested')
`;
const hudPath = resolve(dir, "hud.luau");
await Bun.write(hudPath, hudScript);
const hudProc = Bun.spawn([requireLuauBin(), hudPath], { stdout: "inherit", stderr: "inherit" });
if (await hudProc.exited !== 0) process.exitCode = 1;

// Run only the emitted input and teardown callbacks, without mounting React or a GUI.
const controls = await Bun.file(resolve(root, "out/client/HudControls.luau")).text();
const buttonStart = controls.indexOf("local function GunButton(");
const inputStart = controls.indexOf("InputBegan = function(_rbx, input)", buttonStart);
const inputEnd = controls.indexOf("\n\t\tend,", inputStart);
const cleanupStart = controls.indexOf("return function()", buttonStart);
const cleanupEnd = controls.indexOf("\n\tend, {})", cleanupStart);
if ([buttonStart, inputStart, inputEnd, cleanupStart, cleanupEnd].some(index => index < 0)) throw new Error("Missing compiled gun button callbacks");
const touchScript = `
local Enum = {UserInputState={Begin='Begin',End='End',Cancel='Cancel'},UserInputType={Touch='Touch',MouseButton1='MouseButton1'}}
local gunTouchSerial=0
local heldInputs={current={}}
local held={}
local onTrigger=function(source, down) held[source]=if down then true else nil end
local ${controls.slice(inputStart, inputEnd)} end
local function cleanup() ${controls.slice(cleanupStart, cleanupEnd)} end
local disconnected=0
local function finger()
 local callback
 local input={UserInputState='Begin',UserInputType='Touch'}
 function input:GetPropertyChangedSignal()
  return {Connect=function(_, fn)
   callback=fn
   return {Disconnect=function() disconnected+=1 end}
  end}
 end
 return input,function(state) input.UserInputState=state; callback() end
end
local first, lift= finger()
InputBegan(nil,first)
assert(next(held)~=nil)
lift('End')
assert(next(held)==nil and disconnected==1 and next(heldInputs.current)==nil)
local second= finger()
local third= finger()
InputBegan(nil,second)
InputBegan(nil,third)
assert(held.touch2 and held.touch3)
cleanup()()
assert(next(held)==nil and next(heldInputs.current)==nil and disconnected==3,'unmount must release all touches and connections')
cleanup()()
assert(disconnected==3,'repeated cleanup must be inert')
print('CLIENT_GUN_TOUCH passed=3 failed=0; compiled callbacks only, GUI mounting NOT tested')
`;
const touchPath = resolve(dir, "touch.luau");
await Bun.write(touchPath, touchScript);
const touchProc = Bun.spawn([requireLuauBin(), touchPath], { stdout: "inherit", stderr: "inherit" });
if (await touchProc.exited !== 0) process.exitCode = 1;
