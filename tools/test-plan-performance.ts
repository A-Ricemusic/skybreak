// Run after test-relay-offline has staged the compiled planners. No Studio or engine shims.
// Frozen fingerprints captured at merge revision 37028404 before planner edits.
// Covers every enumerable plan field, not counts alone. See D-669 for M01 normalization.
import { resolve } from "node:path";
import { requireLuauBin } from "./luau-bin";
const root = resolve(import.meta.dir, "..");
let source = `local function hash(value)
 local h=5381
 local function feed(s) for i=1,#s do h=(h*33+string.byte(s,i))%4294967296 end end
 local function visit(v)
  local t=type(v);feed(t..":")
  if t=="table" then
   local keys={} for k in v do table.insert(keys,k) end
   table.sort(keys,function(a,b) return tostring(a)<tostring(b) end)
   for _,k in keys do visit(k);visit(v[k]) end
  else feed(tostring(v)) end
  feed(";")
 end
 visit(value);return h
end

local baseline={3190489972,4127043566,3511608759,328657816,3045054979,2299562210,3618195384,981040680,3209937394,4114654245,2802350694,105356167,4053897778,1006650437,3968923461,862187324,149552753,3266528156}
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
 local decorated={} for _,op in p.ops do table.insert(decorated,{op=op,h=hash(op)}) end
 table.sort(decorated,function(a,b) return a.h<b.h end)
 p.ops={} for _,entry in decorated do table.insert(p.ops,entry.op) end
 end
 local actual=hash(p)
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
