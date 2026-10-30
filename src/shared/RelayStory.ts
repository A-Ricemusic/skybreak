export type StoryScene = "hangar" | "canyon" | "farm" | "relay" | "harbor" | "city" | "sea";
export type StoryMood = "dawn" | "day" | "dusk" | "night" | "storm";
export type StoryShot = "radio" | "wide" | "evidence" | "chair" | "recorder" | "sky" | "black";
export interface StoryBeat { speaker: string; text: string; shot: StoryShot; recordingId?: string; }
export interface StoryChapter { id: number; title: string; scene: StoryScene; mood: StoryMood; beats: StoryBeat[]; }
export const TEAL="TEAL · RECORDED";
export const SERA="SERA · VARDA CONTROL";
/** The coup's voice before anyone can put a name to it. */
export const MARSHAL="MARSHAL · INTERCEPT";
/** The same voice once the aurora archive names him (chapter 14 on). */
export const RUSK="RUSK · AIR MARSHAL";
export const TRAINEE="TRAINEE";
export const LOG="FLIGHT LOG";
export const RECORDER="RECORDER 7-T";
export const VULTURE_TWO="VULTURE TWO";
/** Colour family for a speaker chip; the client maps tones to palette colours. */
export type SpeakerTone = "teal" | "control" | "log" | "marshal" | "trainee" | "wing";
export interface SpeakerStyle { name: string; role?: string; tone: SpeakerTone }
const SPEAKER_TONES: Record<string, SpeakerTone> = { TEAL: "teal", SERA: "control", "FLIGHT LOG": "log", "RECORDER 7-T": "log", MARSHAL: "marshal", RUSK: "marshal", TRAINEE: "trainee", "VULTURE TWO": "wing" };
/** Splits "NAME · ROLE" speaker strings into a chip name, optional role and tone. */
export function speakerStyle(speaker: string): SpeakerStyle {
	const parts = speaker.split(" · ");
	const name = parts[0];
	return { name, role: parts.size() > 1 ? parts[1] : undefined, tone: SPEAKER_TONES[name] ?? "control" };
}
/** Shorthand for one beat. */
function line(speaker:string,shot:StoryShot,text:string,recordingId?:string): StoryBeat { return {speaker,text,shot,recordingId}; }
function chapter(id:number,title:string,scene:StoryScene,mood:StoryMood,...beats:StoryBeat[]): StoryChapter { return {id,title,scene,mood,beats}; }
/** D-030/D-031: eighteen pre-mission chapters (opening shared with practice), then the finale.
 * recordingId references immutable approved bank transcripts; absent means new recording required. */
export const STORY: StoryChapter[] = [
	chapter(0,"A voice in the static","hangar","dawn",
		line(TEAL,"recorder","Two taps. That's me. If you're hearing this, I missed a check-in, and you're sitting in my chair because nobody else wanted the paperwork.","story.c00.b00"),
		line(SERA,"chair","He missed three. He told me once: one check-in is weather, two is trouble, three is worry. I've been worried since Tuesday.","story.c00.b01"),
		line(TEAL,"radio","Sparrow. You fly the pattern too low and too fast, and I never fixed it, because it's the only thing you do without asking permission.","story.c00.b02"),
		line(SERA,"wide","Command calls it desertion. They made me say the word on the net. I said it. I'm not saying it again.","story.c00.b03"),
		line(TEAL,"sky","If I miss your checkout, fly the pattern anyway. The sky will still be there.","story.c00.b04"),
		line(TRAINEE,"chair","An empty chair and a checkout nobody's signing. Fine. I'll fly the pattern.")),
	chapter(1,"The sealed case","hangar","night",
		line(SERA,"evidence","The bombers wore our markings. Our paint, our numbers. One of them was a tail I cleared for departure in March."),
		line(SERA,"chair","The quartermaster found a case under Teal's bunk. A coffee tin, twelve tapes, and a note: 'For Sera. Not for the net.'","story.c01.b01"),
		line(TEAL,"recorder","Keep these off the command net. Somebody up there is listening and signing things they shouldn't. If I go quiet, the case goes to Sera. Only Sera.","story.c01.b02"),
		line(TEAL,"radio","The manifest sends grain drums to a farm with a runway, then five quays on Iron Coast. Nobody ships grain in drums."),
		line(TEAL,"radio","They call it a farm because a fuel ledger would show the number of aircraft. The silos with no dust on the ladders. Those are the ones.","story.c12.b01"),
		line(SERA,"chair","There are real houses in that yard. Families who work the siding. I need you to come home with the right number of fires.","story.c12.b02"),
		line(SERA,"wide","Iron Coast is a hundred miles of our own shoreline. Whoever this is, they're not invading. They're already home.","story.c01.b04"),
		line(TRAINEE,"sky","Then I'll look at that farm. From above, before anyone can tidy it up.")),
	chapter(2,"An unlisted station","canyon","dawn",
		line(TEAL,"recorder","I dropped beacons on the way in. Low power, my own frequency. If anyone ever follows me, I wanted it to be someone who knew the song.","story.c02.b01"),
		line(SERA,"chair","He used to tune that pass on Sundays. Said it was the only place the tower couldn't talk to him."),
		line(SERA,"evidence","Recovery followed the beacons into the snowy pass. His receiver was in the rocks. Cracked case, memory intact. He meant us to find it."),
		line(TEAL,"recorder","There's a radar inside our own training box. Dug into the bowl north of the pass. Nobody signed for it. I checked the ledger three times.","story.c03.b01"),
		line(TEAL,"radio","Somebody wanted to watch trainees. Not the sky. Trainees. Think about why you'd want to know when the kids fly.","story.c03.b02"),
		line(SERA,"wide","If it's real, it's been watching every pattern you've flown for a year. Command wants it gone quietly. I want it photographed first.","story.c03.b03"),
		line(TRAINEE,"chair","If I just blow it up, it's a rumour. If I look at it first, it's a crime.","story.c03.b05")),
	chapter(3,"The orchard witnesses","farm","day",
		line(TEAL,"radio","The Teklan farmers let me hide a tape in a seed tin. The old woman asked my name, not my rank. Nobody at Varda has asked my name in ten years.","story.c04.b00"),
		line(SERA,"wide","The radar's memory names that orchard. Three days later somebody ordered it evacuated. Now there are patrols firing on the evacuation trucks.","story.c04.b01"),
		line(SERA,"chair","They're not shooting at farmers. They're shooting at a seed tin. That's how badly someone wants Teal's tape back.","story.c04.b02"),
		line(MARSHAL,"black","...three officers at Varda are being reassigned tonight. Their names are already off the roster. Nobody will ask. Nobody ever asks.","story.c04.b03"),
		line(TEAL,"radio","One courier carries the frequency book high over the orchard hills. His radar guides the patrols onto the trucks."),
		line(SERA,"evidence","Five escorts above the cloud line. Bring the high flyers down and the families have a road out."),
		line(TRAINEE,"sky","Those trucks are carrying somebody who asked his name. They get out.","story.c04.b05")),
	chapter(4,"Fuel under grain","farm","night",
		line(SERA,"wide","The convoy made it. The old woman's granddaughter drove the lead truck. She marked three silos on the map with her thumb. 'Those smell wrong.'","story.c05.b00"),
		line(TEAL,"recorder","Three tanks under grain permits. Aviation fuel. The farmers know the difference, they just can't prove it. A fuel ledger would prove it.","story.c05.b01"),
		line(TEAL,"radio","Sparrow. Every unmarked silo in that valley is somebody's winter. Don't be the one who makes them hungry to make a point.","story.c05.b02"),
		line(SERA,"chair","He wrote that one for you. He never wrote anything for me. I'm choosing not to be hurt by that today.","story.c05.b03"),
		line(TEAL,"recorder","Vulture Lead followed me into the pass. He wasn't chasing a deserter. You don't chase deserters at night with your lights off. He was erasing a witness.","story.c08.b01"),
		line(SERA,"chair","If the fuel burns, he'll come looking for you over the works. You don't owe him a duel. Bring yourself home."),
		line(TRAINEE,"evidence","Three thumbprints. Three fires. Then I'm leaving him in the dark.")),
	chapter(5,"Military quays","harbor","dawn",
		line(SERA,"evidence","You got clear of Vulture Lead. His orders kept repeating on guard; we recorded them. Every one bears a governor's name. He died in spring."),
		line(TEAL,"radio","Kiro talks to Lira. Lira talks to Merel. Merel talks to the harbours. Start at the quays; listen back up the chain."),
		line(SERA,"chair","I wiped his name off my board this morning. Then I wrote it back. I'm not ready to decide what he is.","story.c09.b03"),
		line(TEAL,"radio","On the coast, look at what the cranes unload. The uniforms tell you nothing. The crates do.","story.c18.b02"),
		line(SERA,"evidence","Iron Coast. Military stores beside a fish market. The Marshal put his war where he knew we'd hesitate."),
		line(SERA,"radio","Workers are two blocks from those quays. The ships and tankers are his supply line. Their neighbours are not."),
		line(TRAINEE,"chair","He's right. I'll hesitate. Then I'll aim.","story.c18.b05")),
	chapter(6,"Two ridges","relay","dusk",
		line(TEAL,"recorder","Kiro keeps an archive. Every forged order, filed, because forgers are vain. It's the only honest thing on the plateau.","story.c09.b02"),
		line(MARSHAL,"black","Declare the emergency first. Find the reason after. In a year, nobody has asked me for the reason.","story.c10.b00"),
		line(SERA,"evidence","The harbour traffic gave us Kiro's signing key. A key alone is a rumour. We need Lira and Merel's logs with the same signature."),
		line(TEAL,"radio","Lira and Merel sit on opposite ridges and hate each other's weather. Lira lies, Merel repeats her. The west ridge still hears the farms.","story.c10.b02"),
		line(SERA,"wide","Three logs, one signature. If his words go out from the west ridge, they reach the people who hid him.","story.c10.b03"),
		line(TEAL,"radio","I came home through the pass. Not the pretty way. The way you take when you don't want to be seen coming home."),
		line(TRAINEE,"sky","His own words, in his own voice, on their own relay. He'd have liked that.","story.c10.b05")),
	chapter(7,"The loyalist window","relay","day",
		line(SERA,"evidence","Three stations, one signature. Varda's island transmitter has the orders and the governor's death certificate. Thirty-five seconds."),
		line(TEAL,"radio","A clear signal needs time. Don't give them a hero. Give them thirty-five seconds and a hero is beside the point.","story.c14.b01"),
		line(SERA,"chair","He recorded that two weeks before he vanished. Thirty-five seconds. He'd already timed it. He knew exactly what this would take.","story.c14.b02"),
		line(SERA,"radio","I'm staying in the tower. In case you were wondering. I'm not leaving my chair for them.","story.c07.b03"),
		line(TRAINEE,"sky","Keep the lights on, Sera. I'll keep the sky.","story.c07.b05")),
	chapter(8,"The frigate ring","sea","storm",
		line(SERA,"wide","Three garrisons heard it. Two stood down. Their people are coming ashore to join us."),
		line(SERA,"evidence","Three loyalist frigates cover the landing under the weather. The command ship carries a green beacon and most of our hope."),
		line(TEAL,"recorder","Storms ground frightened people. They don't ground orders, or fuel, or the people who own them. When the weather's bad, that's when they move.","story.c15.b04"),
		line(TEAL,"radio","If I don't get home, leave the lane open for the next one. That's the job. There isn't a second part.","story.c22.b01"),
		line(SERA,"chair","The frigate captain was at his wing ceremony. Half this coast was. The Marshal forgot that we all remember."),
		line(TRAINEE,"sky","Green beacon. I'll stay close enough to read it.","story.c22.b04")),
	chapter(9,"Walking the storm","farm","storm",
		line(SERA,"wide","And then the Marshal answered. Fire at the orchard. A line of guns along the rivers."),
		line(MARSHAL,"black","Varda Rim has broadcast enemy propaganda. It is a hostile station. The Teklan orchard sheltered the source. There will be no further warnings.","story.c15.b01"),
		line(SERA,"evidence","The orchard burned at noon. The old woman is alive. Her granddaughter is alive. The seed tin is ash. That's my report, and I hate it.","story.c15.b02"),
		line(SERA,"chair","I asked you to broadcast. I'd ask again. I need you to know that I'd ask again.","story.c15.b03"),
		line(TRAINEE,"sky","The rain has passed. The line hasn't. I'll take the valleys.")),
	chapter(10,"High crossing","relay","day",
		line(SERA,"wide","The old woman heard Teal in her kitchen before the fire. She says he sounded tired. Now her neighbours are flying out over his saddle."),
		line(SERA,"chair","Teal flew that saddle on his checkride. Vulture Two signed the card. I pulled it last night. The handwriting matches the forged orders.","story.c13.b02"),
		line(TEAL,"recorder","Two civilian airliners. One cannot climb. Somebody will have to leave the high sky to keep the lower one safe."),
		line(TRAINEE,"sky","Then I'll fly his checkride for him. Properly, this time.","story.c13.b04")),
	chapter(11,"Vulture Two","relay","day",
		line(SERA,"wide","The eight towers in that crater are the Marshal's command array. The antennas up there are his. So is the pilot waiting above them."),
		line(VULTURE_TWO,"black","Varda trainee, this is Vulture Two. I taught your instructor to fly. I know what he'd try over that crater. Turn home. Nobody has to watch."),
		line(TEAL,"recorder","Vulture Two taught me that an order is not the same as a duty. Then he forgot. If you meet him, remind him. Loudly.","story.c17.b03"),
		line(SERA,"chair","He's challenged your call sign in daylight. He wants you above the crater, where he can see your face."),
		line(SERA,"radio","If he ejects, mark where he lands. We need a witness who can answer back."),
		line(TRAINEE,"sky","Then he'll see it.","story.c17.b06")),
	chapter(12,"The evidence launch","canyon","storm",
		line(SERA,"wide","Vulture Two ejected. Marines lifted him out of the crater. He asked if you were Teal's. I said yes."),
		line(VULTURE_TWO,"radio","He was the best I ever signed off. Tell the kid the handwriting was mine. All of it. I'm done lying to pilots.","story.c18.b01"),
		line(TEAL,"recorder","I made a paper copy. Radios get jammed. Ink still travels. It's in the harbour master's safe, and she doesn't like the Marshal either."),
		line(SERA,"wide","The harbour master's copy and Vulture Two's statement are on one slow plane. Airships are jamming the ravine. Fighters are waiting beyond it."),
		line(SERA,"chair","The signatures, his tapes, a living witness on paper. If that plane falls, command gets to call him a deserter again."),
		line(TRAINEE,"sky","Then it doesn't fall.")),
	chapter(13,"Aurora archive","relay","night",
		line(SERA,"wide","His river line is broken. The crown station on the ice coast still talks under the aurora. He has sent missiles to silence its dish."),
		line(TEAL,"radio","At the crown station I left the order that started all of this. The first one. With his real signature, before he learned to use dead men's names.","story.c16.b01"),
		line(TEAL,"recorder","I didn't take it with me. I didn't trust myself to get home. I trusted the dish.","story.c16.b02"),
		line(SERA,"chair","He didn't trust himself to get home. He said it out loud, to a tape, and flew anyway. I keep rewinding that part.","story.c16.b03"),
		line(TRAINEE,"sky","He trusted the dish. I can do that much.","story.c16.b05")),
	chapter(14,"The city in darkness","city","night",
		line(LOG,"evidence","ARCHIVE RECOVERED. ORDER 0001. 'Declare regional emergency. Suspend parliament. Assume air command.' Signed: RUSK, AIR MARSHAL.","story.c17.b00"),
		line(SERA,"wide","Rusk. He gave the speech at Teal's wing ceremony. He told us the sky belongs to whoever is willing to be up in it.","story.c17.b01"),
		line(SERA,"wide","The evidence plane is clear. Marines have the case. Now we have his signature too. And the city still hears nothing but him."),
		line(RUSK,"black","Citizens. Parliament has fled. Rebel aircraft are over the harbour. Stay inside. Trust the lights. Trust my voice.","story.c20.b01"),
		line(TEAL,"radio","One tower, one voice, one emergency on repeat. He didn't build it to tell anyone anything. He built it so nothing else gets in.","story.c20.b02"),
		line(SERA,"evidence","The broadcast relay sits in a block of apartments. He chose that too. The canal is the only dark line through the city.","story.c20.b03"),
		line(TRAINEE,"chair","Everyone in those apartments has been listening to him for a year. I'd like to give them some quiet.","story.c20.b05")),
	chapter(15,"The dawn landing","city","dawn",
		line(RUSK,"black","Trainee. This is Rusk. Teal flew my wing the winter the coast starved while parliament debated. He had talent too. Ask the pass how far it got him."),
		line(SERA,"chair","That's the first time he's used his own name. He wants you to know he's a person. Don't let him.","story.c21.b03"),
		line(TRAINEE,"sky","He flew your wing. Then you hunted him at night with your lights off. I'll remember both.","story.c21.b05"),
		line(SERA,"wide","A loyalist column is crossing the dry coast. Parliament is coming home by road. The ruined town ahead of them still has guns."),
		line(TEAL,"radio","Don't fly for the people giving orders. Fly for the people who have to live beneath them. The man on the net is weather.","story.c24.b01"),
		line(SERA,"chair","He recorded that one at two in the morning. I can hear the hangar heater behind him. I could find that hangar in the dark by that sound.","story.c24.b02"),
		line(SERA,"radio","Clear the bunkers ahead of the column. Stay on their channel until both squads answer from the streets."),
		line(TRAINEE,"sky","Beneath them. Right. The road, then.")),
	chapter(16,"The last fracture","canyon","dawn",
		line(SERA,"wide","Recovery reached the upper pass this morning. They found his aircraft. They found him. He was in the seat. The recorder was still running.","story.c25.b00"),
		line(RECORDER,"black","RECORDER 7-T. ENTRY 04:12. PLAYBACK.","story.c25.b01"),
		line(TEAL,"black","Two taps. Sparrow, it's me. Lead is on my tail and I'm out of altitude, so I'm going to stay in the pass a while. The seed trucks need ten minutes.","story.c25.b02"),
		line(TEAL,"black","I flew that order knowing the price. The tapes are so you never have to take my word for any of it. This part I'm choosing myself.","story.c25.b03"),
		line(TEAL,"black","Fly the pattern too low and too fast. Nobody ever fixed it. Good. The sky will...","story.c25.b04"),
		line(SERA,"chair","Witnesses reach parliament tonight. Keep the bridges and quay open. He's flying with his own wing: five of them over the capital."),
		line(SERA,"evidence","I've amended the record myself. 'Aircraft lost with pilot. KILLED, NOT DESERTED.' Command can court-martial the paperwork.","story.c25.b06"),
		line(TRAINEE,"sky","Ten minutes. He bought ten minutes. I'm going to go and spend them.","story.c25.b07")),
	chapter(17,"Broken relay","relay","storm",
		line(SERA,"evidence","The wing is broken. Rusk left his wingmen and ran to the coastal relay works. He's alone there with one relay and his own voice."),
		line(RUSK,"black","Trainee. Land, and I'll tell the city you were misled by a dead man. Fly, and you're the traitor in every history I write.","story.c26.b01"),
		line(TEAL,"recorder","When you have the truth, send it in your own voice. You don't have to sound like me. You never did.","story.c26.b02"),
		line(SERA,"chair","I've got every harbour on the net. Every loyalist station is listening for one call sign. Not his. Yours.","story.c26.b03"),
		line(SERA,"radio","Break the generators, run the vent and get clear. When his loop stops, he'll come up alone. Then the sky is yours to answer him."),
		line(TRAINEE,"sky","Marshal. I heard the tape. He didn't sound misled. He sounded like he was counting trucks.","story.c26.b05"),
		line(TRAINEE,"radio","Sera. Varda trainee, checking in. One of three. The other two are for after.","story.c26.b06")),
	chapter(18,"A clear frequency","city","dawn",
		line(SERA,"wide","He's down. His relay is dark. Every harbour on the coast is answering. You're on every receiver from the rim to the sea. Say it your way.","story.c27.b00"),
		line(TRAINEE,"sky","This is Varda trainee, transmitting in the clear. The Air Marshal is down. The emergency is over. It never started.","story.c27.b01"),
		line(TRAINEE,"radio","The orders were forged. The names were dead men's. An orchard was burned for a seed tin. Teal flew the pass so the trucks could get out.","story.c27.b02"),
		line(TRAINEE,"evidence","His name was Teal. He was not a deserter. Amend your records. For Teal. For the rim. We are coming home.","story.c27.b03"),
		line(SERA,"chair","Varda trainee, Varda Control. Check-in received. Two of three. Come home and make the third in person.","story.c27.b04"),
		line(TEAL,"recorder","...the sky will still be there.","story.c27.b05"),
		line(LOG,"black","VARDA RIM ROSTER. TEAL: KILLED IN ACTION, NOT DESERTED. INSTRUCTOR'S CHAIR: FILLED.","story.c27.b06")),
];
export function storyFor(id:number): StoryChapter { assert(id%1===0 && id>=0 && id<STORY.size(),"Invalid story chapter"); return STORY[id]; }
/** Shared by the client selection and server seen marker. */
export function chapterBeforeMission(id:number): number { assert(id%1===0 && id>=0 && id<=18,"Invalid mission"); return math.max(0,id-1); }
/** Chapters reachable with the current mission release flags; finale remains dormant. */
export function reachableStoryChapters(): number[] { return [0,1,2]; }
/** D-030 Q8: opening reprise on M1 replays; retries and practice replays retain seen semantics. */
export function shouldPlayChapter(missionId:number,seen:number[] | undefined,completed:boolean): boolean {
 return (missionId===1 && completed) || !(seen?.includes(chapterBeforeMission(missionId)) ?? false);
}
