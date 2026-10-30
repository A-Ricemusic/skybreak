// Run from repository root after bun run build. Local Studio verification place only; never publishes.
// Adds the Studio-only mission 5 fixture (missions 3-4 opened, 1-4 completed in order) and the QA pilot.
import { resolve } from 'node:path';
const root=resolve(import.meta.dir,'../..');
const project=await Bun.file(resolve(root,'default.project.json')).json();
function absolute(value: any) {
 if (value && typeof value==='object') for(const [key,item] of Object.entries(value)) {
  if(key==='$path') value[key]=resolve(root,item as string); else absolute(item);
 }
}
absolute(project);
project.tree.StarterPlayer.StarterPlayerScripts.M05Pilot={$path:resolve(root,'tools/verification/m05-pilot.client.luau')};
project.tree.ServerScriptService.M05Fixture={$path:resolve(root,'tools/verification/m05-fixture.server.luau')};
await Bun.write(resolve(root,'build/m05-verification.project.json'),JSON.stringify(project,null,2));
const p=Bun.spawn(['rojo','build','build/m05-verification.project.json','-o','build/m05-verification.rbxlx'],{cwd:root,stdout:'inherit',stderr:'inherit'});
if(await p.exited!==0)throw new Error('Rojo M05 verification place build failed');
