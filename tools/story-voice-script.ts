// Offline editorial manifest. Does not generate, upload, or approve audio.
import { STORY } from "../src/shared/RelayStory";
import { VOICE_CUES } from "../src/shared/VoiceCues";
const casting = await Bun.file("assets/voice/casting.json").json();
const lines = [];
// Direction follows the line's dramatic purpose; a confession is not a combat challenge.
const DIRECTIONS: Record<string,string> = {
 "story.c00.b00":"Intimate familiar greeting; concern held behind dry humour",
 "story.c00.b03":"Controlled anger at having been forced to call a friend a deserter",
 "story.c03.b03":"Cold administrative menace; no shouting",
 "story.c04.b04":"Quiet recognition of a deliberate witness killing",
 "story.c09.b02":"Clipped factual report barely containing grief",
 "story.c09.b03":"Resolve through guilt; needs the trainee to believe her",
 "story.c11.b01":"Personal warning from a former instructor; menace covering shame, not heroic resolve",
 "story.c12.b01":"Exhausted confession; owns the lie without self-pity",
 "story.c14.b00":"Neutral archive readout; clearly pronounce the signature",
 "story.c15.b00":"Contemptuous personal offer; calm confidence in his power",
 "story.c15.b02":"Accusation kept steady; distinguish the hunter from the man who ordered him",
 "story.c16.b00":"Grief held inside a factual recovery report",
 "story.c16.b02":"Urgent last recording under pursuit; count the trucks, do not perform a death scene",
 "story.c16.b03":"Deliberate acceptance of the price; no plea for rescue",
 "story.c16.b04":"Affectionate instruction cut off mid-thought",
 "story.c16.b06":"Grief becoming defiance; stress killed, not deserted",
 "story.c17.b01":"Coercive last bargain; control beginning to slip",
 "story.c18.b04":"Relief and warmth at the second check-in",
 "story.c18.b06":"Neutral roster readout; finality without triumph",
};
function direction(id:string,speaker:string,shot:string):string {
 return DIRECTIONS[id] ?? (shot==="evidence" ? "Read the evidence clearly; let the facts carry the weight" : shot==="chair" ? "Private reflection; speak to the listener, not the room" : speaker==="TEAL" ? "Intimate recorded testimony; restrained" : shot==="sky" ? "Steady outward resolve" : "Plain operational speech; match the scene's stakes");
}
for (const chapter of STORY) for (const [index,beat] of chapter.beats.entries()) {
 const id=`story.c${String(chapter.id).padStart(2,"0")}.b${String(index).padStart(2,"0")}`;
 const chip=beat.speaker, name=chip.split(" · ")[0], speaker=casting.aliases[name] ?? name;
 const cue=beat.recordingId ? VOICE_CUES[beat.recordingId] : undefined;
 if (cue && (cue.text!==beat.text || cue.speaker!==speaker)) throw Error(`Stale recording alias: ${id}`);
 lines.push({id,kind:"story",speaker,chip,text:beat.text,context:`${chapter.title}; ${chapter.scene}, ${chapter.mood}; ${beat.shot} shot`,emotion:direction(id,speaker,beat.shot),maxDurationSeconds:Math.max(6,Math.ceil(beat.text.split(/\s+/).length/2.2)+2, cue ? Math.ceil(cue.finish-cue.start) : 0),durationBasis:cue ? "Cap accommodates the measured approved take; never truncate its bank region" : "Editorial word-count cap; review the take before upload",recordingId:beat.recordingId ?? null,needsRecording:!cue});
}
const generation = await Bun.file("assets/voice/lines.json").json();
for(const line of generation.lines.filter((l: {kind:string})=>l.kind==="radio")) {
 const recorded=Object.entries(VOICE_CUES).find(([,cue])=>cue.radio && cue.text===line.text && cue.speaker===line.speaker);
 const chip=line.text.includes(": ") ? line.text.split(": ")[0] : "SERA · VARDA CONTROL";
 lines.push({id:line.id,kind:"radio",speaker:line.speaker,chip,text:line.text,context:line.id.includes(".story.") ? "Planned mission radio; future builder must wire this exact text" : "Live mission phase/landing radio",emotion:"Concise operational urgency",maxDurationSeconds:Math.max(5,Math.ceil(line.spoken.split(/\s+/).length/2.5)+1),recordingId:recorded?.[0] ?? null,needsRecording:!recorded});
}
const storyLines=lines.filter(l=>l.kind==="story");
if(storyLines.length!==122 || storyLines.filter(l=>!l.needsRecording).length!==78 || storyLines.filter(l=>l.needsRecording).length!==44 || lines.filter(l=>!l.needsRecording).length!==78 || lines.length!==228 || lines.filter(l=>l.needsRecording).length!==150) throw Error(`Story/recording inventory changed: total=${lines.length}, missing=${lines.filter(l=>l.needsRecording).length}; review exact coverage counts`);
if(casting.speakers["RIM TOWER"].voice===casting.speakers.SERA.voice || lines.filter(l=>l.chip==="RIM TOWER").some(l=>l.speaker!=="RIM TOWER")) throw Error("Tower must retain a voice distinct from Sera");
for(const l of lines) if(l.recordingId) { const cue=VOICE_CUES[l.recordingId]; if(l.maxDurationSeconds<cue.finish-cue.start) throw Error(`Duration cap truncates ${l.id}`); }
const json=JSON.stringify({generatedBy:"bun tools/story-voice-script.ts",lines},null,1)+"\n";
const pending=lines.filter(l=>l.needsRecording);
const md=`# Broken Relay voice script\n\nD-131. Generated by \`bun tools/story-voice-script.ts\`. ${lines.length} authored story/planned-radio lines; ${pending.length} have no recording and are subtitle-only. D-142: no new audio is generated or uploaded; the six approved live banks on main are the only voice.\n\nThe JSON companion \`assets/voice/story-script.json\` contains every line, including reusable immutable recording IDs. This table lists every line without a recording; each plays as a silent subtitle. Durations are editorial reading caps for subtitles, not measured audio. Briefings/results are unvoiced UI text.\n\nCurrent lines in live missions: opening answer c00.b05 remains silent; changed c01 beats 00,03,06 become silent; c02 beats 01,02 are silent. Other moved c02 lines retain exact matching recordings.\n\n| ID | Speaker / chip | Exact text | Context / emotion | Max seconds |\n|---|---|---|---|---|\n`+pending.map(l=>`| ${l.id} | ${l.speaker} / ${l.chip} | ${l.text.replaceAll("|","\\|")} | ${l.context}; ${l.emotion} | ${l.maxDurationSeconds} |`).join("\n")+`\n\n## Existing recording duration\n\nThe approved c14.b00 archive readout is 12.3 seconds. Its cap is 13 seconds (rounded up from the measured bank region), rather than the 10-second word-count estimate. Retain its clear pronunciation and full recording; do not accelerate or truncate it to satisfy an estimate. All reusable lines have caps at least as long as their measured recordings.\n\n## No new audio (D-142)\n\nAfter Roblox rejected a regenerated voice bank (2026-10-30), the owner's policy is no further audio uploads; the story continues with subtitles. Runtime plays a beat's voice only through its exact-text immutable alias into main's approved cue table; every other beat is a silent subtitle. Do not generate, pack or upload replacement takes. \`bun tools/voice-lines.ts\` still refreshes \`assets/voice/lines.json\`, so the inventory stays exact.\n\nMissing by design: recordings for the lines above. Still pending: Studio/Player verification of chapter sequencing and of the retained recordings.\n`;
const outputs: [string,string][]=[["assets/voice/story-script.json",json],["docs/specs/story/voice-script.md",md]];
for(const [path,text] of outputs) { if(process.argv.includes("--check")) { if(await Bun.file(path).text()!==text) throw Error(`Stale ${path}`); } else await Bun.write(path,text); }
console.log(`STORY_VOICE_SCRIPT lines=${lines.length} pending=${pending.length}`);
