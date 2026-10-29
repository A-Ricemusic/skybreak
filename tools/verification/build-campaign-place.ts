// Run from repository root after bun run build. Local place only; never publishes.
import { resolve } from 'node:path';
const root=resolve(import.meta.dir,'../..');
const project=await Bun.file(resolve(root,'default.project.json')).json();
function absolute(value: any) {
 if (value && typeof value==='object') for(const [key,item] of Object.entries(value)) {
  if(key==='$path') value[key]=resolve(root,item as string); else absolute(item);
 }
}
absolute(project);
const scripts=project.tree.StarterPlayer.StarterPlayerScripts;
scripts.QAPilot={$path:resolve(root,'tools/playtest-relay.client.luau')};
scripts.QAObserver={$path:resolve(root,'tools/verification/campaign-observer.client.luau')};
scripts.QAFrames={$path:resolve(root,'tools/verification/campaign-frames.client.luau')};
await Bun.write(resolve(root,'build/campaign-verification.project.json'),JSON.stringify(project,null,2));
const p=Bun.spawn(['rojo','build','build/campaign-verification.project.json','-o','build/campaign-verification.rbxlx'],{cwd:root,stdout:'inherit',stderr:'inherit'});
if(await p.exited!==0)throw new Error('Rojo verification place build failed');
