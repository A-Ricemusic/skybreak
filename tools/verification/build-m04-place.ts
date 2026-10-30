// Isolated Studio QA place. Private hooks exist ONLY in copied compiled modules;
// no production source, save store or uploaded asset is modified.
import {resolve} from 'node:path';
import {readdir} from 'node:fs/promises';
const root=resolve(import.meta.dir,'../..');
const project=await Bun.file(resolve(root,'default.project.json')).json();
function absolute(v:any){if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(k==='$path')v[k]=resolve(root,x as string);else absolute(x);}}
absolute(project);
const entry=resolve(root,'build/m04-init.server.luau');
await Bun.write(entry,await Bun.file(resolve(root,'out/server/init.server.luau')).text());
const serverTree:any={$path:entry};
for(const file of await readdir(resolve(root,'out/server'))) if(file.endsWith('.luau') && file!=='init.server.luau') {
 const name=file.replace(/\.luau$/, '').replace(/\.server$/, '');
 serverTree[name]={$path:resolve(root,'out/server',file)};
}
project.tree.ServerScriptService.Server=serverTree;
for(const [name,hook] of [
 ['CampaignService','QARequest = handleRequest, QACoordinator = function(player) return getState(player).coordinator end,'],
 ['CombatService','QAKill = destroyEnemy,'],
]) {
 const text=await Bun.file(resolve(root,`out/server/${name}.luau`)).text();
 const marker=`return {\n\t${name} = ${name},`;
 if(!text.includes(marker))throw new Error(`QA hook marker missing: ${name}`);
 const dest=resolve(root,`build/m04-${name}.luau`);
 await Bun.write(dest,text.replace(marker,`assert(game:GetService("RunService"):IsStudio())\nreturn {\n\t${hook}\n\t${name} = ${name},`));
 project.tree.ServerScriptService.Server[name]={$path:dest};
}
project.tree.StarterPlayer.StarterPlayerScripts.M04JammingObserver={$path:resolve(root,'tools/verification/m04-jamming.client.luau')};
project.tree.ServerScriptService.M04QA={$path:resolve(root,'tools/verification/m04-playthrough.server.luau')};
await Bun.write(resolve(root,'build/m04-verification.project.json'),JSON.stringify(project,null,2));
const p=Bun.spawn(['rojo','build','build/m04-verification.project.json','-o','build/m04-verification.rbxlx'],{cwd:root,stdout:'inherit',stderr:'inherit'});
if(await p.exited!==0)throw new Error('M04 QA place build failed');
