// Compare the compiled catalog with the deep, sorted snapshot captured before extraction.
// Only the newly explicit execution metadata is excluded: every pre-existing key/value,
// including the historical `legacy` data tag, must remain identical.
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
print(serialize(C.MISSIONS))
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
const expected=sorted(await Bun.file(resolve(import.meta.dir,"fixtures/mission-catalog.before.json")).json());
deepStrictEqual(actual,expected);
console.log("MISSION_CATALOG_SNAPSHOT passed=27 failed=0 (all original fields; additive execution metadata excluded)");
