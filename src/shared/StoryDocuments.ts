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
	1:["GRAIN MANIFEST  IRON COAST","CARGO: GRAIN, DRUMS 200L","QTY 480   QUAYS 1-5","UNLOAD AFTER DARK","!FLASHPOINT 38 C","CLEARED: AIR COMMAND"],
	3:["RECEIVER 7-T  MEMORY","SITE: BOWL N OF THE PASS","RADAR - UNLISTED","LEDGER CHECK x3: NONE","TRACKS: TRAINEE SORTIES","!WHO SIGNED FOR THIS"],
	5:["TEKLAN VALLEY  PERMITS","SILO 2  GRAIN   (THUMB)","SILO 5  GRAIN   (THUMB)","SILO 9  GRAIN   (THUMB)","!AVIATION FUEL","NOTHING ELSE BURNS"],
	6:["SILO RADIO  INTERCEPT","COURIER: DUST PASS 1900","ESCORT CODE: VULTURE 4","CARGO: 'THE BOOK'","!CARGO BEFORE PILOT","SAME BEARING WHINE DAILY"],
	7:["ORDERS  EFFECTIVE 0400","VARDA TOWER: COMPROMISED","CHALLENGE CODE: CHANGED","TOWER CREW: RELIEVED","RELIEF FLIGHTS: TWO","AUTH: CMD / EMERGENCY"],
	9:["CERTIFICATE OF DEATH","GOVERNOR  A. VELLAN","DATE: 14 SPRING","CAUSE: NATURAL","!ORDERS SIGNED SINCE: 61","SRC: VULTURE LEAD RECORDER"],
	10:["NODE KIRO  ARCHIVE","SIGNING KEY: RECOVERED","MATCH NEEDED: TWO LOGS","LIRA  (EAST RIDGE)","MEREL (WEST RIDGE)","!WEST RIDGE HEARS THE FARMS"],
	11:["LOYALIST MOBILE TX","FLATBED - ONE UNIT","ROUTE: REFUGEE CORRIDOR","SPEED: 20 KM/H  NO ESCORT","!ONLY VOICE NOT HIS","PROTECT AT ANY RANGE"],
	12:["'FARM'  RAIL SIDING","FUEL SILOS: 4","RELAY DISH: 1","ANIMALS: 0","HOUSES: 3  (FAMILIES)","!COUNT TO FIVE"],
	14:["THREE STATIONS  ONE HAND","KIRO  LIRA  MEREL","+ GOVERNOR'S CERTIFICATE","TAPE LENGTH: 35 SEC","RECORDED: 2 WEEKS PRIOR","!HE TIMED IT"],
	15:["TEKLAN ORCHARD  REPORT","FIRE: NOON  (REPRISAL)","OLD WOMAN: ALIVE","GRANDDAUGHTER: ALIVE","SEED TIN: ASH","!I HATE THIS REPORT"],
	17:["ORDER 0001","DECLARE REGIONAL","EMERGENCY.","SUSPEND PARLIAMENT.","ASSUME AIR COMMAND.","!SIGNED: RUSK, AIR MARSHAL"],
	18:["MILITARY QUAYS  SURVEY","WAREHOUSES: 3","FISH MARKET: 2 BLOCKS","CRATES: NOT UNIFORMS","CRANES UNLOAD AT NIGHT","!HE KNEW WE'D HESITATE"],
	20:["CITY RELAY  LOCATION","APARTMENT BLOCK - ROOF","RESIDENTS: 400","DARK LINE: THE CANAL","ONE TOWER  ONE VOICE","!NOTHING ELSE GETS IN"],
	22:["OFFSHORE PLATFORM","FRIGATES: 3  (LOYALIST)","COMMAND: GREEN BEACON","CONVOY FUEL: NONE","CAPTAIN: WING CEREMONY","!WE ALL REMEMBER"],
	23:["STORM PLATFORM","STORES: 3  TRIDENT DECKS","DEFENCE MAP: ABSENT","HIGH APPROACH: NONE","APPROACH: SEA LEVEL","!ONLY FOR A WAR"],
	25:["SERVICE RECORD  TEAL","AIRCRAFT LOST WITH PILOT","~STATUS: DESERTED","!KILLED, NOT DESERTED","AMENDED: S. / VARDA CTRL","COURT-MARTIAL THE PAPER"],
	26:["LAST TRANSMISSION  FIX","BEARING: PARLIAMENT TWR","RELAYS LEFT: 1","WING: BROKEN","VOICE: HIS OWN","!ONE CALL SIGN. YOURS."],
	27:["VARDA RIM  ROSTER","TEAL   INSTRUCTOR","~DESERTED","!KILLED IN ACTION","INSTRUCTOR'S CHAIR:","FILLED"],
};
// Chapter 4's roster: three officers struck off, written out so the struck lines stay obvious.
DOCS[4]=["VARDA RIM  DUTY ROSTER","~CPT. MAREN OSK","~LT. DEVI HALLOR","~SGT. ILO BRANT","REASSIGNED: TONIGHT","AUTH: CMD / EMERGENCY"];
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
