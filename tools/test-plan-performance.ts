// Run after test-relay-offline has staged the compiled planners. No Studio or engine shims.
// Frozen fingerprints captured at merge revision 37028404 before planner edits.
// M03 already excludes the buried floor at that revision.
// #236 preserves that output here; do not recapture fingerprints from the merged implementation.
// Floor-free writes/jobs/touches are pinned separately in MissionLoadBudget.spec.ts.
// All numeric values use integer millionths: sin/cos/atan2/sqrt feed coordinates,
// rotations, dimensions and other nested planner fields across the campaign.
// Baselines are independently recaptured from compiled 37028404 with this encoding,
// not from the implementation under test. Keys and all nonnumeric values stay exact.
// Production plans are never modified by fingerprinting. M01 independent ops are sorted.
import { resolve } from "node:path";
import { requireLuauBin } from "./luau-bin";
const root = resolve(import.meta.dir, "..");
let source = `local function fingerprint(value)
 local h=5381
 local function feed(s) for i=1,#s do h=(h*33+string.byte(s,i))%4294967296 end end
 local function visit(v,isKey)
  local t=type(v);feed(t..":")
  if t=="table" then
   local keys={} for k in v do table.insert(keys,k) end
   table.sort(keys,function(a,b) return tostring(a)<tostring(b) end)
   for _,k in keys do visit(k,true);visit(v[k]) end
  elseif t=="number" and not isKey then
   -- Integer formatting avoids serializing the original platform-dependent double.
   -- Plans must remain finite and within the exact integer range after scaling.
   assert(v==v and math.abs(v)*1000000<9007199254740991,"Plan number outside fingerprint range")
   feed(string.format("%.0f",math.floor(v*1000000+0.5)))
  else feed(tostring(v)) end
  feed(";")
 end
 visit(value);return h
end

-- Exercise nested values independently of today's mission shapes. Numeric keys,
-- strings, booleans, field presence and array order must never be quantized away.
local fixture={points={{x=-123.456789,y=0,z=123.456789,yaw=-0.25}},label="route",solid=true,[0.125]="key"}
local expected=fingerprint(fixture)
for _,key in {"x","y","z","yaw"} do
 local point=fixture.points[1];local original=point[key]
 for _,delta in {1e-10,-1e-10} do
  point[key]=original+delta
  assert(fingerprint(fixture)==expected,"Nested numeric rounding: "..key)
 end
 for _,delta in {0.001,-0.001} do
  point[key]=original+delta
  assert(fingerprint(fixture)~=expected,"Nested numeric change: "..key)
 end
 point[key]=original
end
assert(fingerprint({x=0})==fingerprint({x=-1e-12}),"Normalize signed near-zero values")
assert(fingerprint({[0.125]=1})~=fingerprint({[0.1250000001]=1}),"Numeric keys stay exact")
for _,changed in {{label="other",solid=true},{label="route",solid=false},{label="route",solid=true,extra=0}} do
 assert(fingerprint(changed)~=fingerprint({label="route",solid=true}),"Metadata stays exact")
end
assert(fingerprint({1,2})~=fingerprint({2,1}),"Array order stays exact")

local baseline={2595689487,3022175266,4091653953,3359413120,3709475856,1339997142,3660052952,304861289,995958326,2471117253,2029317218,487262690,2097524581,4080310693,2758503905,2234297660,956128081,3272172711}
local builders={}
`;
for (let id = 1; id <= 18; id++) {
 const n = String(id).padStart(2, "0");
 source += `builders[${id}]=require("./M${n}WorldPlan").buildM${n}Plan\n`;
}
source += `
-- Reverse the second pass: an order-dependent leak must not hide behind mission complexity.
for pass=1,2 do for index=1,18 do
 local id=if pass==1 then index else 19-index
 local last=os.clock();local start=last;local longest=0;local calls=0;local phases={}
 local p=builders[id](nil,function(phase)
  local now=os.clock();local dt=now-last;last=now;longest=math.max(longest,dt);calls+=1
  phase=phase or "composition";phases[phase]=(phases[phase] or 0)+dt
 end)
 local now=os.clock();longest=math.max(longest,now-last);local seconds=now-start
 -- Only M01's disjoint land groups have hash-map iteration order; normalize those independent ops.
 if id==1 then
 local decorated={} for _,op in p.ops do table.insert(decorated,{op=op,h=fingerprint(op)}) end
 table.sort(decorated,function(a,b) return a.h<b.h end)
 p.ops={} for _,entry in decorated do table.insert(p.ops,entry.op) end
 end
 local actual=fingerprint(p)
 if pass==1 then
  -- Probe a real coordinate in every mission without changing the retained plan.
  local function coordinate(v)
   if type(v)~="table" then return nil end
   if type(v.x)=="number" then return v end
   for _,child in v do local found=coordinate(child);if found then return found end end
   return nil
  end
  local point=assert(coordinate(p),"Mission has no coordinate probe")
  local original=point.x
  for _,delta in {1e-10,-1e-10} do
   point.x=original+delta
   assert(fingerprint(p)==actual,"Fingerprint must tolerate libm rounding for M"..id)
  end
  point.x=original+0.001
  assert(fingerprint(p)~=actual,"Fingerprint must detect changed coordinates for M"..id)
  point.x=original
 end
 print("MISSION_PLAN_OFFLINE mission="..id.." pass="..pass.." seconds="..seconds.." maxCheckpointGap="..longest.." checkpoints="..calls.." hash="..actual)
 for phase,work in phases do print("MISSION_PLAN_OFFLINE_PHASE mission="..id.." phase="..phase.." seconds="..work) end
 assert(actual==baseline[id],"Plan output changed for M"..id)
 assert(seconds<=5,"Offline plan CPU budget exceeded for M"..id)
 assert(longest<=0.1,"Offline checkpoint slice exceeded for M"..id)
 assert(calls>0 and calls<=100000,"Plan work count out of bounds for M"..id)
 p=nil
end end
print("PLAN_PERFORMANCE passed=36 failed=0")
`;
const path = resolve(root, "build/offline-relay/performance.luau");
await Bun.write(path, source);
const proc = Bun.spawn([requireLuauBin(), path], { cwd: root, stdout: "pipe", stderr: "pipe" });
const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
console.log(out); if (err) console.error(err);
await Bun.write(resolve(root, "build/plan-performance.log"), out + err);
if (code !== 0) process.exitCode = code;
