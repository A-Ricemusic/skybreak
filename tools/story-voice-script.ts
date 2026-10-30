// Offline editorial manifest. Does not generate, upload, or approve audio.
import { STORY } from "../src/shared/RelayStory";
import { VOICE_CUES } from "../src/shared/VoiceCues";
const casting = await Bun.file("assets/voice/casting.json").json();
const provenance = (await Bun.file("assets/voice/provenance.json").json()).lines as Record<string,{source:string;requestId:string|null;bank:string|null;tier?:string}>;
const plan = await Bun.file("assets/voice/upload-plan.json").json();
// D-142/D-143: where each line's audio comes from: an approved live bank, a new bank, or not packed yet.
function status(id:string) { const p=provenance[id]; return {voiceSource:p.source,bank:p.bank,tier:p.tier ?? null,needsGeneration:p.source==="pending" && !p.requestId}; }
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
 lines.push({id,kind:"story",speaker,chip,text:beat.text,context:`${chapter.title}; ${chapter.scene}, ${chapter.mood}; ${beat.shot} shot`,emotion:direction(id,speaker,beat.shot),maxDurationSeconds:Math.max(6,Math.ceil(beat.text.split(/\s+/).length/2.2)+2, cue ? Math.ceil(cue.finish-cue.start) : 0),durationBasis:cue ? "Cap accommodates the measured packed take; never truncate its bank region" : "Editorial word-count cap; review the take before upload",recordingId:beat.recordingId ?? null,needsRecording:!cue,...status(id)});
}
const generation = await Bun.file("assets/voice/lines.json").json();
for(const line of generation.lines.filter((l: {kind:string})=>l.kind==="radio")) {
 const recorded=Object.entries(VOICE_CUES).find(([,cue])=>cue.radio && cue.text===line.text && cue.speaker===line.speaker);
 const chip=line.text.includes(": ") ? line.text.split(": ")[0] : "SERA · VARDA CONTROL";
 lines.push({id:line.id,kind:"radio",speaker:line.speaker,chip,text:line.text,context:line.id.includes(".story.") ? "Planned mission radio; future builder must wire this exact text" : "Live mission phase/landing radio",emotion:"Concise operational urgency",maxDurationSeconds:Math.max(5,Math.ceil(line.spoken.split(/\s+/).length/2.5)+1,recorded ? Math.ceil(recorded[1].finish-recorded[1].start) : 0),recordingId:recorded?.[0] ?? null,needsRecording:!recorded,...status(line.id)});
}
const storyLines=lines.filter(l=>l.kind==="story");
const count=(f:(l:typeof lines[number])=>boolean)=>lines.filter(f).length;
if(storyLines.length!==122 || lines.length!==168 || count(l=>l.voiceSource==="legacy")!==78 || count(l=>l.voiceSource==="new")!==0 || count(l=>l.voiceSource==="pending")!==90 || count(l=>l.needsGeneration)!==10 || count(l=>l.needsRecording)!==90 || lines.some(l=>l.needsRecording!==(l.voiceSource==="pending"))) throw Error("Story/recording inventory changed; review exact coverage counts");
if(casting.speakers["RIM TOWER"].voice===casting.speakers.SERA.voice || lines.filter(l=>l.chip==="RIM TOWER").some(l=>l.speaker!=="RIM TOWER")) throw Error("Tower must retain a voice distinct from Sera");
for(const l of lines) if(l.recordingId && VOICE_CUES[l.recordingId]) { const cue=VOICE_CUES[l.recordingId]; if(l.maxDurationSeconds<cue.finish-cue.start) throw Error(`Duration cap truncates ${l.id}`); }
const json=JSON.stringify({generatedBy:"bun tools/story-voice-script.ts",lines},null,1)+"\n";
const generate=lines.filter(l=>l.needsGeneration);
const pending=lines.filter(l=>l.needsRecording);
const tiers=Object.entries(plan.pendingTiers as Record<string,{risk:string;lines:string[];needGeneration:string[]}>);
const md=`# Broken Relay voice script\n\nD-131, D-141–D-143. Generated by \`bun tools/story-voice-script.ts\`. ${lines.length} authored story/planned-radio lines: ${count(l=>l.voiceSource==="legacy")} play from regions of approved live banks (never re-uploaded), ${pending.length} wait for new risk-ordered banks, and ${generate.length} of those still need an ElevenLabs take. No audio is generated or uploaded by this manifest.\n\nThe JSON companion \`assets/voice/story-script.json\` contains every line with its voice source (\`legacy\`, \`new\` or \`pending\`). Durations are editorial caps, not measured audio; use an unhurried read and flag overlength takes. Briefings/results are unvoiced UI text.\n\nPending lines have no cue and stay silent (subtitles only) until their tier is packed, independently reviewed and moderation-approved. The voiceBank01 rejection (2026-10-30) removed every regenerated bank; see \`docs/human/blockers.md\`.\n\n## Lines needing generation\n\n| ID | Speaker / chip | Exact text | Context / emotion | Max seconds |\n|---|---|---|---|---|\n`+generate.map(l=>`| ${l.id} | ${l.speaker} / ${l.chip} | ${l.text.replaceAll("|","\\|")} | ${l.context}; ${l.emotion} | ${l.maxDurationSeconds} |`).join("\n")+`\n\n## New banks, in upload order\n\nUpload one bank at a time, lowest risk first, and wait for APPROVED before the next. On any rejection, keep the HALT and stop.\n\n`+tiers.map(([tier,t])=>`- **${tier}** (${t.risk}): ${t.lines.length} lines, ${t.needGeneration.length} need generation. ${t.lines.join(", ")}.`).join("\n")+`\n\n## Generation handoff\n\nAfter building and running the offline relay extraction, \`bun tools/voice-lines.ts\` refreshes \`assets/voice/lines.json\` (the generation input). \`python3 tools/voice.py plan\` lists reused takes, new banks and the lines that need generation, with credits, without contacting ElevenLabs. The orchestrator supplies a key file securely for \`voice.py generate --key-file … --budget … --only …\`. Casting and spoken replacements live in \`assets/voice/casting.json\`. The cache hashes voice/model/settings/text, so only edited lines regenerate; a take found in an approved live bank (same cache key, request id and raw sha256) is never generated or uploaded again.\n\n\`voice.py pack\` packs each complete tier and rewrites VoiceCues and transcripts. Then \`voice.py stt\`, \`voice.py checklist\` (heard-text lexicon, non-speech/stray-word gate), an independent listening review per bank, \`tools/upload-voice.py --only <bank>\`, moderation and permissions are separate steps. Do not overwrite approved cues with invented transcripts. New text stays silent until its exact cue and approved bank exist. After repacking, regenerate this manifest and update its inventory counts.\n\nPending: ${generate.length} takes, STT and checklists for each new bank, independent review, human listening, uploads, and Studio/Player audible verification. Editorial emotion and duration metadata are in this companion manifest; voice.py does not enforce duration caps or pass emotion instructions to ElevenLabs. Planned radio is not scheduled by locked mission placeholders; future builders must wire it and remove duplicate phase IDs from the voice generation input if appropriate.\n`;
const outputs: [string,string][]=[["assets/voice/story-script.json",json],["docs/specs/story/voice-script.md",md]];
for(const [path,text] of outputs) { if(process.argv.includes("--check")) { if(await Bun.file(path).text()!==text) throw Error(`Stale ${path}`); } else await Bun.write(path,text); }
console.log(`STORY_VOICE_SCRIPT lines=${lines.length} pending=${pending.length} generate=${generate.length}`);
