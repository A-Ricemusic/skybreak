// Freeze the released practice + 18 numbered entries. Execution policies are separately
// checked by campaign/tutorial contracts rather than excluded metadata snapshots.
import { resolve } from "node:path";
import { requireLuauBin } from "./luau-bin";
import { deepStrictEqual } from "node:assert";
const dir=resolve(import.meta.dir,"../build/offline-relay");
const script=String.raw`
local C=require("./MissionCatalog")
local function quote(s)
 return '"'..string.gsub(s,'[%z\1-\31\\"]',function(c)
  if c=='"' then return '\\"' end
  if c=='\\' then return '\\\\' end
  return string.format('\\u%04x',string.byte(c))
 end)..'"'
end
local function serialize(v)
 if type(v)=='string' then return quote(v) end
 if type(v)~='table' then return tostring(v) end
 local keys={} for k in v do if k~='execution' then table.insert(keys,k) end end
 table.sort(keys)
 local array=#keys==0 or type(keys[1])=='number'
 local parts={}
 for _,k in keys do table.insert(parts,(array and '' or quote(k)..':')..serialize(v[k])) end
 return (array and '[' or '{')..table.concat(parts,',')..(array and ']' or '}')
end
print(serialize({C.PRACTICE, unpack(C.MISSIONS)}))
`;
const path=resolve(dir,"catalog-snapshot.luau");
await Bun.write(path,script);
const proc=Bun.spawn([requireLuauBin(),path],{stdout:"pipe",stderr:"pipe"});
const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
if(code!==0)throw new Error(stderr);
function sorted(value: unknown): unknown {
 if(Array.isArray(value))return value.map(sorted);
 if(value!==null && typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sorted(v)]));
 return value;
}
const actual=sorted(JSON.parse(stdout));
const expected=process.argv.includes("--update") ? actual : sorted(await Bun.file(resolve(import.meta.dir,"fixtures/mission-catalog.campaign18.json")).json());
if (process.argv.includes("--update")) await Bun.write(resolve(import.meta.dir,"fixtures/mission-catalog.campaign18.json"),JSON.stringify(actual,null,2)+"\n");
else deepStrictEqual(actual,expected);
console.log("MISSION_CATALOG_SNAPSHOT passed=19 failed=0 (practice and 18 numbered entries; execution metadata excluded)");
