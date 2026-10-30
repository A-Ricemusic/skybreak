import { STORY } from "./RelayStory";

/**
 * The short documents that sit on the flight chart during `evidence` shots:
 * the thing Sera or the trainee is actually looking at. Pure data so it runs
 * offline. Plain ASCII, at most six lines of at most 28 characters each so
 * RobotoMono stays legible on a phone. A leading "~" strikes the line through
 * (a name wiped off a roster); a leading "!" stamps it (red, boxed).
 */
export const DOCUMENT_LINES=6,DOCUMENT_COLUMNS=28;
const DOCS: Record<number,string[]>={
	1:["GRAIN MANIFEST  IRON COAST", "CARGO: GRAIN, DRUMS 200L", "QTY 480   QUAYS 1-5", "FARM AIRSTRIP / ANIMALS: 0", "!FLASHPOINT 38 C", "CLEARED: AIR COMMAND"],
	2:["RECEIVER 3-R  MEMORY", "SITE: BOWL N OF THE PASS", "RADAR - UNLISTED", "LEDGER CHECK x3: NONE", "TRACKS: TRAINEE SORTIES", "!WHO SIGNED FOR THIS"],
	3:["VARDA RIM  DUTY ROSTER", "~CPT. MAREN OSK", "~LT. DEVI HALLOR", "~SGT. ILO BRANT", "REASSIGNED: TONIGHT", "AUTH: CMD / EMERGENCY"],
	4:["TEKLAN VALLEY  PERMITS", "SILO ALPHA    GRAIN (THUMB)", "SILO BRAVO    GRAIN (THUMB)", "SILO CHARLIE  GRAIN (THUMB)", "!AVIATION FUEL", "NOTHING ELSE BURNS"],
	5:["CERTIFICATE OF DEATH", "GOVERNOR  A. VELLAN", "DATE: 14 SPRING", "CAUSE: NATURAL", "!ORDERS SIGNED SINCE: 61", "SRC: GUARD CHANNEL RECORDING"],
	6:["NODE KIRO  ARCHIVE", "SIGNING KEY: RECOVERED", "MATCH NEEDED: TWO LOGS", "LIRA  (WEST RIDGE)", "MEREL (EAST RIDGE)", "!WEST RIDGE HEARS THE FARMS"],
	7:["THREE STATIONS  ONE HAND", "KIRO  LIRA  MEREL", "+ GOVERNOR'S CERTIFICATE", "TAPE LENGTH: 35 SEC", "RECORDED: 2 WEEKS PRIOR", "!HE TIMED IT"],
	8:["LOYALIST LANDING", "FRIGATES: 3  (LOYALIST)", "COMMAND: GREEN BEACON", "GARRISONS: TWO STOOD DOWN", "CAPTAIN: WING CEREMONY", "!WE ALL REMEMBER"],
	9:["TEKLAN ORCHARD  REPORT", "FIRE: NOON  (REPRISAL)", "OLD WOMAN: ALIVE", "GRANDDAUGHTER: ALIVE", "SEED TIN: ASH", "!I HATE THIS REPORT"],
	14:["ORDER 0001", "DECLARE REGIONAL", "EMERGENCY.", "SUSPEND PARLIAMENT.", "ASSUME AIR COMMAND.", "!SIGNED: RUSK, AIR MARSHAL"],
	16:["SERVICE RECORD  TEAL", "AIRCRAFT LOST WITH PILOT", "~STATUS: DESERTED", "!KILLED, NOT DESERTED", "AMENDED: S. / VARDA CTRL", "COURT-MARTIAL THE PAPER"],
	17:["LAST TRANSMISSION  FIX", "BEARING: COASTAL RELAY WORKS", "RELAYS LEFT: 1", "WING: BROKEN", "VOICE: HIS OWN", "!ONE CALL SIGN. YOURS."],
	18:["VARDA RIM  ROSTER", "TEAL   INSTRUCTOR", "~DESERTED", "!KILLED IN ACTION", "INSTRUCTOR'S CHAIR:", "FILLED"],
};
/** Raw document lines for a chapter, or undefined when the chapter has no evidence shot. */
export function documentFor(id:number): string[] | undefined { return DOCS[id]; }
export interface DocumentLine { text: string; struck: boolean; stamp: boolean; }
/** Splits the "~"/"!" prefixes off a raw line. */
export function documentLine(raw:string): DocumentLine {
	const mark=raw.sub(1,1);
	if(mark==="~")return {text:raw.sub(2),struck:true,stamp:false};
	if(mark==="!")return {text:raw.sub(2),struck:false,stamp:true};
	return {text:raw,struck:false,stamp:false};
}
/** Chapters whose story has an `evidence` beat, so the document table can be checked against the story. */
export function chaptersWithEvidence(): number[] {
	const ids:number[]=[];
	for(const chapter of STORY)if(chapter.beats.some((b)=>b.shot==="evidence"))ids.push(chapter.id);
	return ids;
}
