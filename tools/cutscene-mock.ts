// Renders static mocks of the cinematic caption panel from the compiled pure
// layout (build/offline-relay/CinematicLayout.luau, produced by test:offline),
// so the PNGs use exactly the rectangles the game uses. Not a Roblox render:
// fonts are system stand-ins for Gotham and the scene is a crop of a capture.
// Usage: LUAU_BIN=... bun run test:offline && bun tools/cutscene-mock.ts
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {requireLuauBin} from "./luau-bin";

const root=resolve(import.meta.dir,".."),relay=resolve(root,"build/offline-relay"),dest=resolve(root,"build/cutscene-mock");
await mkdir(dest,{recursive:true});
const luau=requireLuauBin();
const chrome=process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

interface Rect {x:number;y:number;width:number;height:number}
interface Mock {name:string;screen:[number,number];inset:{left:number;top:number;right:number};large:boolean;lines:number;settings:boolean;paused:boolean;hint?:string}
const MOCKS:Mock[]=[
	{name:"cutscene-mock-844x390",screen:[844,390],inset:{left:44,top:58,right:0},large:false,lines:2,settings:false,paused:false},
	{name:"cutscene-mock-844x390-settings",screen:[844,390],inset:{left:44,top:58,right:0},large:false,lines:2,settings:true,paused:true},
	{name:"cutscene-mock-1920x854",screen:[1920,854],inset:{left:0,top:58,right:0},large:false,lines:2,settings:false,paused:false,hint:"CLICK FOR NEXT"},
	{name:"cutscene-mock-320x182",screen:[320,182],inset:{left:0,top:0,right:0},large:false,lines:3,settings:true,paused:false},
];
const BEATS=5,BEAT=1,FILL=.55;

// Dump layout + frame for every mock from the real Luau module.
const dump=MOCKS.map((m)=>{
	const w=m.screen[0]-m.inset.left-m.inset.right,h=m.screen[1]-m.inset.top;
	return `do local l=L.getCinematicLayout(${w},${h},${m.large}) local f=L.getCinematicFrame(l,${w},${h},l.lineHeight*${m.lines}+4)
	out[#out+1]={layout=l,frame=f,segments=L.progressSegments(f.progress.width,${BEATS})} end`;
}).join("\n");
await Bun.write(resolve(relay,"mockdump.luau"),`local L=require("./CinematicLayout")
local out={}
${dump}
local function enc(v)
	local t=type(v)
	if t=="table" then
		if #v>0 then local p={} for _,x in v do p[#p+1]=enc(x) end return "["..table.concat(p,",").."]" end
		local p={} for k,x in v do if type(x)~="function" then p[#p+1]='"'..k..'":'..enc(x) end end return "{"..table.concat(p,",").."}"
	elseif t=="boolean" then return tostring(v) else return tostring(v) end
end
print(enc(out))`);
const proc=Bun.spawn([luau,resolve(relay,"mockdump.luau")],{stdout:"pipe",stderr:"pipe"});
const [stdout,stderr,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
if(code!==0)throw new Error(`Luau exited ${code}: ${stderr}`);
if(stderr)throw new Error(stderr);
const data=JSON.parse(stdout) as {layout:Record<string,number>;frame:Record<string,Rect> & {horizontalSettings:boolean};segments:Rect[]}[];

const scene=resolve(root,"docs/design/cutscene-current-phone.png");
const LINE="I came home through the western switchback. Not the pretty way. The way you take when you don't want to be seen coming home.";
const box=(r:Rect,style="")=>`left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;${style}`;
const tri=(h:number,color:string)=>`<i style="display:inline-block;width:0;height:0;border-top:${h/2}px solid transparent;border-bottom:${h/2}px solid transparent;border-left:${Math.round(h*.85)}px solid ${color}"></i>`;

for(const [i,m] of MOCKS.entries()){
	const {layout:l,frame:f,segments}=data[i];
	const [sw,sh]=m.screen,w=sw-m.inset.left-m.inset.right,h=sh-m.inset.top;
	const tiny=Boolean(l.tiny),pill=l.pillHeight,ink="4,9,14";
	const back=f.backdrop,band=f.band,stop=(y:number)=>((y-back.y)/back.height*100).toFixed(1);
	const control=(r:Rect,inner:string,on=false)=>`<div class="hit" style="${box(r)}"><div class="pill${on?" on":""}" style="height:${pill}px">${inner}</div></div>`;
	const pauseIcon=m.paused ? tri(12,"#40e0ce") : `<span style="display:inline-flex;gap:3px"><i class="bar"></i><i class="bar"></i></span>`;
	const panel=f.settingsPanel,horizontal=f.horizontalSettings;
	const toggle=(label:string,value:string)=>`<div class="toggle" style="${horizontal?`width:calc(50% - 2px)`:"width:100%"};height:${l.controlSize}px"><span>${label}</span><b>${value}</b></div>`;
	// The scene: a crop of the in-game capture, scaled to cover the whole screen (no letterbox).
	const crop={x:113,y:296,w:1774,h:390},scale=Math.max(sw/crop.w,sh/crop.h);
	const html=`<!doctype html><html><head><style>
	*{box-sizing:border-box;margin:0;padding:0}
	body{width:${sw}px;height:${sh}px;overflow:hidden;background:#000;font-family:"Avenir Next","Helvetica Neue",sans-serif;color:#f2eee2}
	.scene{position:absolute;inset:0;overflow:hidden}
	.scene img{position:absolute;width:${2000*scale}px;left:${(sw-crop.w*scale)/2-crop.x*scale}px;top:${(sh-crop.h*scale)/2-crop.y*scale}px}
	.root{position:absolute;left:${m.inset.left}px;top:${m.inset.top}px;width:${w}px;height:${h}px}
	.abs,.hit,.root>div{position:absolute}
	.hit{display:flex;align-items:center;justify-content:center}
	.pill{width:calc(100% - 6px);border-radius:999px;background:rgba(${ink},.4);border:1px solid rgba(242,238,226,.28);display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;font-size:${tiny?11:12}px;letter-spacing:.04em}
	.pill.on{background:rgba(64,224,206,.18);border-color:rgba(64,224,206,.7);color:#40e0ce}
	.bar{display:inline-block;width:3px;height:12px;background:#f2eee2}
	.toggle{position:relative;display:inline-flex;align-items:center;justify-content:space-between;padding:0 12px;border-radius:8px;background:rgba(16,30,40,.9);font-size:${tiny?12:13}px;margin-right:${horizontal?4:0}px;margin-bottom:${horizontal?0:4}px}
	.toggle b{color:#40e0ce}
	.roblox{position:absolute;top:${Math.max(4,(m.inset.top-44)/2)}px;height:44px;border-radius:22px;background:rgba(240,240,240,.85)}
	</style></head><body>
	<div class="scene"><img src="file://${scene}"></div>
	${m.inset.top?`<div class="roblox" style="left:${m.inset.left+12}px;width:44px"></div><div class="roblox" style="left:${m.inset.left+64}px;width:150px"></div>`:""}
	${m.inset.left?`<div style="position:absolute;left:0;top:0;width:${m.inset.left}px;height:${sh}px;background:linear-gradient(90deg,rgba(0,0,0,.5),rgba(0,0,0,0))"></div>`:""}
	<div class="root">
		<div style="${box({...back,y:back.y})}background:linear-gradient(180deg,rgba(${ink},0) 0%,rgba(${ink},.45) ${stop(band.y)}%,rgba(${ink},.68) ${stop(f.text.y)}%,rgba(${ink},.78) 100%)"></div>
		${m.paused?`<div style="${box(f.pausedChip)}border-radius:999px;background:rgba(${ink},.65);border:1px solid rgba(242,238,226,.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${tiny?11:13}px;letter-spacing:.08em">PAUSED</div>`:""}
		<div style="${box(f.speaker)}display:flex;align-items:center;gap:8px;white-space:nowrap;overflow:hidden">
			<i style="width:3px;height:${l.chipTextSize+4}px;background:#40e0ce"></i>
			<b style="color:#40e0ce;font-weight:900;font-size:${l.chipTextSize}px;letter-spacing:.04em">TEAL</b>
			<span style="color:#98a8b0;font-size:${l.chipTextSize-1}px;font-weight:500;letter-spacing:.04em">RECORDED</span>
		</div>
		${f.hint?`<div style="${box(f.hint)}display:flex;align-items:center;justify-content:flex-end;color:#687a84;font-size:${l.chipTextSize-2}px;font-weight:600;letter-spacing:.05em">${m.hint}</div>`:""}
		${control(f.settingsButton,"Aa",m.settings)}
		${control(f.pauseButton,pauseIcon,m.paused)}
		${control(f.skipButton,`SKIP <span style="display:inline-flex">${tri(9,"#f2eee2")}${tri(9,"#f2eee2")}</span>`)}
		<div style="${box(f.text)}font-size:${l.bodySize}px;line-height:${l.lineHeight}px;font-weight:500;overflow:hidden">${LINE}</div>
		<div style="${box(f.progress)}">${segments.map((s,k)=>`<div style="position:absolute;${box({...s,height:f.progress.height})}border-radius:2px;background:${k<BEAT?"rgba(64,224,206,.75)":"rgba(242,238,226,.18)"}">${k===BEAT?`<div style="width:${FILL*100}%;height:100%;border-radius:2px;background:#40e0ce"></div>`:""}</div>`).join("")}</div>
		${m.settings?`<div style="${box(panel)}border-radius:10px;background:rgba(${ink},.85);border:1px solid rgba(242,238,226,.15);padding:4px;display:flex;flex-direction:${horizontal?"row":"column"}">${toggle(horizontal?"Motion":"Camera motion","ON")}${toggle("Large text","OFF")}</div>`:""}
	</div></body></html>`;
	const file=resolve(dest,`${m.name}.html`),png=resolve(root,`docs/design/${m.name}.png`);
	await Bun.write(file,html);
	const shot=Bun.spawn([chrome,"--headless=new","--disable-gpu","--hide-scrollbars","--allow-file-access-from-files","--force-device-scale-factor=2",`--window-size=${sw},${sh}`,`--screenshot=${png}`,`file://${file}`],{stdout:"ignore",stderr:"ignore"});
	if(await shot.exited!==0)throw new Error(`Chrome failed for ${m.name}`);
	console.log(`${m.name}: root ${w}x${h}, panel ${band.height}px, scene ${f.scene.height}px, settings ${horizontal?"side by side":"stacked"}`);
}
