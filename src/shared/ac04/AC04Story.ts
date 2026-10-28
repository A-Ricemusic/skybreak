/** Original adaptation text. Reference transcripts establish events, never dialogue assets. */
export type AC04StoryEvent = "beforeCampaign" | "afterMissionSuccess" | "epilogue";
export type AC04Tableau = "cape" | "town" | "music" | "airfield" | "resistance" | "horizon" | "sabotage" | "keepsake" | "blackout" | "liberation" | "memorial" | "letter";
export type AC04StoryShot = "wide" | "detail" | "sky";
export interface AC04StoryBeat { speaker: string; text: string; shot: AC04StoryShot; durationSeconds: number; }
export interface AC04StoryChapter {
	id: string;
	title: string;
	trigger: { event: AC04StoryEvent; missionId?: number };
	tableau: AC04Tableau;
	mood: "day" | "dusk" | "night" | "dawn";
	beats: AC04StoryBeat[];
	sourceURLs: string[];
	boundaryConfidence: "corroborated-text";
}
const NARRATOR = "THE STORYTELLER";
const CHRONOLOGY = "https://mitoro.sakura.ne.jp/acecombat_bbs/words4/0034.htm";
function beat(text: string, shot: AC04StoryShot = "wide"): AC04StoryBeat {
	// Authored reading cadence, not a claim to match the original recordings' durations.
	return { speaker: NARRATOR, text, shot, durationSeconds: math.clamp(text.size() / 19 + 1.5, 6, 16) };
}
function chapter(n: number, title: string, missionId: number, tableau: AC04Tableau, mood: AC04StoryChapter["mood"], ...beats: AC04StoryBeat[]): AC04StoryChapter {
	const suffix = n < 10 ? `0${n}` : tostring(n);
	return { id: `ac04-i${suffix}`, title, tableau, mood, beats,
		trigger: n === 1 ? { event: "beforeCampaign" } : n === 12 ? { event: "epilogue", missionId: 18 } : { event: "afterMissionSuccess", missionId },
		sourceURLs: [`https://acecombat.wiki.gg/wiki/Transcript%3AInterlude_${suffix}`, CHRONOLOGY], boundaryConfidence: "corroborated-text" };
}

/** Boundaries 04, 07 and 10 corroborated by the chronological transcript on 2026-10-27.
 * Original audiovisual timing has not been measured. Chapter identity never equals mission identity. */
export const AC04Story: AC04StoryChapter[] = [
	chapter(1, "The house beyond the cape", 0, "cape", "day",
		beat("Before the war, adults spoke about the sky as something that might fall on us. Ulysses had taught them that. The great guns were meant to keep it above our heads.", "sky"),
		beat("Then those guns belonged to an army. I understood little of armies. I understood the path to school, the bend by the cape, and the house waiting for me afterward."),
		beat("That morning I stopped to watch two fighters turning overhead. One began to burn. For a moment its trail seemed almost beautiful. Then I saw where it was going.", "sky"),
		beat("There was no house to return to. No family inside it. The other aircraft passed low enough for me to see a yellow thirteen. I kept that number when almost everything else was gone.", "detail")),
	chapter(2, "Coins on the counter", 1, "town", "dusk",
		beat("Occupation arrived in small changes before I understood the large one. Different words at school. Unfamiliar uniforms at the corners. Neighbors speaking softly when footsteps approached."),
		beat("My uncle took me in. Without fuel his taxi stood still, and he spent longer over a drink than he ever had behind the wheel. We needed money neither of us knew how to earn."),
		beat("At the Sky Kid bar, I played my harmonica. The soldiers left coins. My uncle disliked where the money came from, but hunger was less particular.", "detail"),
		beat("The barkeeper's daughter was older than me. Her kindness made the room feel less foreign. Even there, I listened for aircraft, wondering when that yellow number would return.", "sky")),
	chapter(3, "A familiar melody", 2, "music", "night",
		beat("The pilots entered together, filling the bar with noise and stories of the day's fighting. I watched their patches and tried to decide which face belonged to the number I remembered."),
		beat("Their leader sat apart with a guitar. When someone announced his victories, the others turned toward him. Yellow Thirteen looked much quieter than the man I had imagined."),
		beat("He noticed my harmonica and made room in the music for me. I had prepared accusations for this meeting. Instead, I found myself breathing in time with his playing.", "detail"),
		beat("My father had loved that melody. Hearing it there did not excuse anything. It only made it impossible to fit the man across from me into the simple shape of my hatred.")),
	chapter(4, "Five shadows over wheat", 5, "airfield", "day",
		beat("An unfinished highway beyond town had become their runway. Aircraft slept near tunnels that had never carried traffic. Wheat still moved beside the concrete, indifferent to the uniforms."),
		beat("Thirteen's squadron guarded Stonehenge. As the fighting moved farther away, they followed it. Five aircraft would climb out together, and he wanted five to return.", "sky"),
		beat("Four was his wingman. Quiet on the ground, precise in the air, she watched over him so carefully that the conversation I had imagined never seemed possible.", "detail"),
		beat("He spoke of skilled opponents without contempt. I came to understand that he cared more about bringing his pilots home than adding another victory. Somewhere among those evenings, their company became a place I belonged.")),
	chapter(5, "The room upstairs", 7, "resistance", "night",
		beat("One day my uncle did not come back. I never learned whether he had left by choice. In an occupied town, an unanswered question could remain unanswered for the rest of your life."),
		beat("The squadron gave my days a shape. Meals, music, departures, returns. I had lost one home and drifted into another without deciding what that made me."),
		beat("Then I discovered what happened above the bar. The barkeeper's family listened to the soldiers for more than conversation. Information moved from that room to the resistance.", "detail"),
		beat("People called him a collaborator downstairs. Upstairs he risked everything against the occupation. His daughter protected my secret as well as theirs. I was grateful, and ashamed that gratitude was not simpler.")),
	chapter(6, "What freedom would take", 8, "horizon", "dawn",
		beat("The daughter began listening to the news with a different expression. The Allies were preparing to return. She pictured the town free again; I pictured the empty chairs they would leave behind."),
		beat("Her feelings for Thirteen made that freedom harder to imagine. Four remained beside him, trusted without explanation. I was young enough to notice jealousy before I understood it.", "detail"),
		beat("Thirteen's attention was somewhere above us. A pilot he had encountered was improving. He spoke about that enemy with the concentration he usually reserved for his own aircraft.", "sky"),
		beat("I wondered why finding someone who might defeat him seemed to restore his spirits. At the time I thought every pilot wanted to be invincible. He seemed to want something more difficult.")),
	chapter(7, "The damaged runway", 11, "sabotage", "dusk",
		beat("Bombs began arriving at the base. The front was drawing nearer, and the squadron was being asked to fight a different war."),
		beat("Then the resistance struck the runway. Four was wounded. The concrete could be repaired, but the lost supplies could not simply be summoned. The mechanics had already learned to wait for parts that did not arrive.", "detail"),
		beat("Thirteen feared being trapped on the ground. Flying at least allowed him to answer danger with his own hands. I could understand that, though the people beyond the fence had no such choice."),
		beat("When the alarm came from Stonehenge, Four went with them. Her aircraft needed work there had been no time or equipment to finish. I watched her take off, as I had so many times before.", "sky")),
	chapter(8, "The folded cloth", 12, "keepsake", "dusk",
		beat("Four's place stayed empty. Thirteen spoke of inspections and responsibility, of the condition of her aircraft. Those were things a pilot could explain. Her absence was something else."),
		beat("Once I found him holding her handkerchief. He told me about the girl she had been before he taught her to fly. I listened because he needed someone there, not because he expected an answer.", "detail"),
		beat("Experienced pilots left to strengthen other units. New faces took their places. The formation still had five aircraft, but I no longer believed that a number could promise anything.", "sky"),
		beat("He displayed a report praising the enemy who had destroyed Stonehenge. His respect was unmistakable. So was his anger at sabotage. Beside me, the daughter looked away. Our town was approaching liberation, and none of us knew how to meet it.")),
	chapter(9, "A door left open", 14, "blackout", "night",
		beat("Retreating soldiers crowded the town. Guns appeared above the hospital. Thirteen objected, but the rooftops remained occupied. At night the blackout swallowed even familiar streets."),
		beat("The daughter was caught preparing another resistance attack. Thirteen found her before the patrol did. He understood now who had destroyed the runway, and who had been sitting beside him in the bar.", "detail"),
		beat("I told him to leave our town. The words came out harder than I expected. For once he looked as though someone had struck him. I could not explain that wanting him gone did not mean wanting him dead."),
		beat("He let us pass. The following day he returned to the work of keeping his aircraft flying. We returned to waiting for the blackout to end. Nothing between us had become simple, but he had given us a way out.")),
	chapter(10, "After the lights returned", 15, "liberation", "dawn",
		beat("There was singing in the streets. For so long, voices had carried only as far as the next closed door. Now they crossed the square together."),
		beat("The occupation's guns had fired through our streets during the battle. The town began gathering its prisoners and counting its losses. Freedom arrived with work still to do."),
		beat("The squadron's rooms were empty. Allied aircraft passed overhead, and I wondered whether one carried the pilot Thirteen had been waiting for.", "sky"),
		beat("I should have stayed in the town that was finally ours again. Instead I followed the retreat. There were people leaving whom I could not stop caring about, and a meeting in the sky I was afraid to imagine.")),
	chapter(11, "A small grave", 17, "memorial", "dusk",
		beat("We had followed them to the end of the retreat. Above Farbanti, Thirteen met the opponent whose skill he had watched from a distance. This time he did not return.", "sky"),
		beat("The daughter and I had no body to bury. There was only the handkerchief, and all the things a small piece of cloth could suddenly mean.", "detail"),
		beat("I could not separate his memory from Four's. A guitar in a crowded room. Aircraft lifting from the highway. The way an ordinary evening becomes precious only after there can be no more of them."),
		beat("That day the surrender was accepted. Maps and broadcasts could call it an ending. Beside that little grave, we had no words large enough for one.")),
	chapter(12, "For the pilot who returned", 18, "letter", "day",
		beat("The highway carries traffic now. Someone driving through could pass the place where the aircraft waited without noticing anything unusual. I sometimes envy them."),
		beat("Years have made the memories quieter, but they have not arranged them into enemies on one side and friends on the other. The people I knew will not stay in those categories."),
		beat("Mobius One, you met Thirteen where I never could. I hope the last contest gave him something beyond the war that had taken so much from everyone. I cannot know whether it did.", "detail"),
		beat("This letter cannot recover him, or ask you to undo what happened. I wanted you to know the man beneath that number, and the child who once listened to him play. What remains is yours to read.")),
];

export function ac04Chapter(id: string): AC04StoryChapter | undefined { return AC04Story.find((entry) => entry.id === id); }
export function ac04ChaptersFor(event: AC04StoryEvent, missionId?: number): AC04StoryChapter[] {
	return AC04Story.filter((entry) => entry.trigger.event === event && (entry.trigger.missionId === undefined || entry.trigger.missionId === missionId));
}

export interface AC04MissionNarrativeEntry {
	briefing: string;
	debriefing: string;
	strategic: string;
	radio: { primary: string[]; update: string[]; complete: string[]; failure: string[] };
	events?: Record<string, string[]>;
}
function mission(briefing: string, debriefing: string, strategic: string, primary: string[], update: string[] = [], events?: Record<string, string[]>): AC04MissionNarrativeEntry {
	return { briefing, debriefing, strategic, radio: { primary, update,
		complete: ["SkyEye: Objective confirmed. Maintain formation while we account for everyone."],
		failure: ["SkyEye: We cannot complete the operation from this position. Disengage if able."] }, events };
}

/** Each text is authored for this adaptation; numeric objective rules remain owned by mission data. */
export const AC04MissionNarrative: Record<number, AC04MissionNarrativeEntry> = {
	1: mission(
		"Erusean bombers are approaching Newfield Island. Our retreat has left North Point exposed, and the damaged warning network gives us little time. Intercept the six Tu-95s before they reach the protected area. Escorts are secondary; a fighter kill is no substitute for stopping a bomber.",
		"The bomber formation has been destroyed. North Point remains secure for now. We must remove the forward airfield threat before another strike can be assembled.",
		"ISAF holds North Point beyond the mainland. Newfield is the first defensive barrier.",
		["SkyEye: Mobius One, bomber tracks are marked. Keep your attention on the aircraft heading for the island.", "Omega: We've still got a headquarters to defend. Let's keep it that way."], [],
		{ bombersRemain: ["SkyEye: Bomber contacts remain. Check the objective markers before pursuing escorts."] }),
	2: mission(
		"Rigley Air Base is preparing the next attack on North Point. Strike the eleven bombers parked on its aprons. Expect fighters and anti-aircraft fire around the runway. Hit the designated aircraft while they are concentrated on the ground; optional installations must not distract from the bomber line.",
		"The parked bomber force is eliminated. Rigley can no longer launch the planned mass strike. This gives our remaining forces time to consolidate.",
		"A short counterattack reaches the occupied mainland at Rigley, south of Saint Ark.",
		["SkyEye: The bomber parking areas are your priority. Watch the active runway.", "Viper: Fighters are rolling. Don't let them pull you away from the strike." ]),
	3: mission(
		"The Shezna radar installations watch the routes our withdrawing forces need. Destroy all nine radar targets across the two mountain positions. Terrain masks some approaches but leaves little room for careless turns. When the network is down, withdraw across the southern return line.",
		"The Shezna network is silent and our strike aircraft have cleared the area. The evacuation route is less exposed. The survivors reaching North Point will be needed for the counteroffensive.",
		"The Shezna mountains cover the evacuation from Saint Ark toward ISAF's offshore refuge.",
		["SkyEye: Radar groups lie on separate heights. Check both positions.", "Rapier: We'll keep the fighters occupied. Take those dishes out."],
		["SkyEye: Radar network disabled. Proceed south across the withdrawal boundary."]),
	4: mission(
		"Erusea is supplying Comberth through an air corridor. Intercept three C-17 transports to close it. Two airborne control aircraft support the route with jamming; destroying them will improve your sensor picture. Maintain a visual search when the radar becomes unreliable and prevent the transports from escaping.",
		"The transport route has been cut. Comberth's forces must now depend more heavily on their local reserves. Our next strike will target those reserves directly.",
		"ISAF begins isolating Comberth and the Aegir Fleet before committing to the harbor attack.",
		["SkyEye: Three transports are moving through the corridor. The jamming originates from separate aircraft.", "Halo: I have visual contacts inside the interference. Don't trust an empty scope." ]),
	5: mission(
		"Comberth's naval forces rely on the coastal refinery and offshore oil facilities. Inflict the required damage before the strike window closes. Plan a route between the two groups and preserve enough weapons and fuel margin to get home. Enemy reinforcements may force a withdrawal.",
		"The fuel strike has impaired the fleet's readiness. Yellow Squadron's arrival made withdrawal costly, but the surviving aircraft are clear. The harbor remains our next objective.",
		"Fuel production and storage along the Comberth coast sustain Erusea's planned naval advance.",
		["SkyEye: Work the refinery and offshore installations. Keep the return direction in mind.", "Omega: Those platforms are spread out. Pick your run before you commit."],
		["SkyEye: Yellow Squadron has entered the area. The return boundary has moved south. Break contact and withdraw.", "Rapier: Five yellow-marked fighters. We are not staying here to trade turns with them." ]),
	6: mission(
		"The Aegir Fleet is concentrated in Comberth Harbor. Attack the warships and supporting facilities until the required damage is achieved. The harbor has several target clusters, with aircraft and shipboard defenses covering the approaches. Use the return route to rearm when necessary, and distinguish hull targets from their weapons.",
		"The fleet has lost its ability to threaten North Point. Our forces can prepare to return to the continent without that naval attack hanging over them. The war is still far from won.",
		"Comberth is the center of the naval threat to ISAF's remaining territory.",
		["SkyEye: Multiple harbor groups ahead. Select a sector and watch your ammunition.", "Viper: Naval fire is heavy near the docks. Keep moving through your attack run." ]),
	7: mission(
		"Attack the designated command, radar and generation structures at Faith Park. This power complex supports Erusea's industrial strength. The route extends into Stonehenge's reach. Study the ravines south of the target before beginning the strike; they may be your only cover on withdrawal.",
		"Faith Park's key facilities are disabled. Stonehenge inflicted serious losses during the withdrawal. A mainland campaign cannot remain under that weapon's shadow indefinitely.",
		"The strike reaches inland beyond earlier operations and exposes Stonehenge's continental reach.",
		["SkyEye: Three designated structures. Keep the ravine exits on your map.", "Halo: Long way from the sea now. Let's finish the job and turn south."],
		["SkyEye: Stonehenge fire detected. Descend below two thousand feet and use the ravines. Continue south.", "Omega: Get under the ridgeline. Stay with the canyon!" ]),
	8: mission(
		"A reconnaissance satellite will launch from the Comona Islands. Win the air battle above the complex and keep hostile aircraft from interrupting the launch. Expect a large fighter engagement and remain ready to intercept a bomber attack. The launch schedule determines how long we must hold this airspace.",
		"The launch succeeded. Reconnaissance coverage will support our return to the mainland. Mobius One's performance is becoming known well beyond this formation.",
		"Comona's launch complex supplies the reconnaissance needed for the coming landing operation.",
		["SkyEye: Comona launch control is counting on this air cover. Engage hostile fighters.", "Viper: Contrails everywhere. Check your target before you fire."],
		["SkyEye: B-2 bombers approaching from the west. Intercept every bomber, then hold until the launch is secure.", "Launch Control: We are committed to the countdown. Keep that approach clear." ]),
	9: mission(
		"Support the landing forces across the three beach sectors. Destroy defensive positions and forces that can stop the advance. Conditions vary along the coast; watch the progress of every landing group rather than concentrating all your attacks on one beach. Be ready for a further close-support task once the first defenses break.",
		"The landing forces have established their foothold. Supply routes and an inland advance can now follow. Our next operations must keep the beachhead from becoming an isolated pocket.",
		"ISAF returns to the mainland through coordinated coastal landings.",
		["SkyEye: Three landing sectors are active. Give the ground teams room to move.", "Landing Force: We're coming off the beach. Marking the positions holding us here."],
		["SkyEye: New defensive targets are designated. Clear them for the advancing troops." ]),
	10: mission(
		"Break the defenses around Istas Fortress on the Tango Line. The terrain shelters several enemy positions, so use the map to plan separate attack runs. You remain within Stonehenge's reach. The required damage must be achieved without losing the aircraft to the fortress or its distant artillery cover.",
		"The Tango Line has been breached. Our ground forces can establish a forward headquarters around Los Canas. That position puts a strike on Stonehenge within practical reach.",
		"The inland offensive approaches Los Canas through the fortified Tango Line.",
		["SkyEye: Istas positions are spread through the terrain. Do not mistake one cleared basin for the whole fortress.", "Ground Control: We're waiting on those strongpoints. Keep the pressure on."], [],
		{ barrage: ["SkyEye: Stonehenge is firing. Get below the warning ceiling and use the terrain."] }),
	11: mission(
		"Protect two civilian aircraft carrying Stonehenge engineers and their families. The passengers have offered technical information in return for sanctuary. One aircraft is flying low and cannot evade attacks normally. Keep both transports alive until they reach safety; enemy fighters are threats to the passengers, not merely score opportunities.",
		"Both aircraft have arrived safely. Their passengers are receiving assistance, and the engineers are being debriefed. Their knowledge may give us the opening we need against Stonehenge.",
		"A defection over the hills near Chopinburg could change the balance of the continental war.",
		["SkyEye: Two civilian tracks. Cover both; the lower aircraft cannot climb out of danger.", "Civilian Pilot: We have families aboard. We're holding the assigned route."], [],
		{ threatened: ["SkyEye: Hostile closing on a civilian aircraft. Intercept before it can fire."] }),
	12: mission(
		"Destroy Stonehenge. The defectors identified a central jamming installation that interferes with radar and guided weapons. Neutralize that installation, then attack the operational guns. Stay alert for returning defenders. This operation will decide whether our ground forces can advance without the threat of continental artillery.",
		"Stonehenge is destroyed. The counterattack is no longer constrained by its firing radius. Yellow Squadron withdrew after losing one aircraft, but remains a threat as we advance west.",
		"ISAF attacks the weapon that forced its retreat from the continent.",
		["SkyEye: Central jammer first if you need guided weapons. Stonehenge's operational guns are designated.", "Rapier: All that distance it kept us away. Now we're looking straight at it."],
		["SkyEye: Yellow Squadron returning. Defend yourselves and maintain visual separation.", "Yellow Flight: Stay together. Cover the withdrawal." ]),
	13: mission(
		"A damaged reconnaissance aircraft is returning through Gnome Ravine at low altitude. Airborne jammers obscure the route and its instruments. Find and destroy the jammer balloons visually; use the gun when a missile lock is unavailable. Keep the route clear until the reconnaissance aircraft can escape the ravine.",
		"The reconnaissance aircraft returned with intelligence on Megalith, another major Erusean weapon under construction. Headquarters wants the war concluded before that facility becomes operational.",
		"Beyond Stonehenge, reconnaissance uncovers the next strategic threat.",
		["SkyEye: Find the balloons by sight. Radar silence does not mean the canyon is clear.", "Recon Pilot: Engine response is poor. I need the route ahead opened, not a climb."], [],
		{ jamCleared: ["Recon Pilot: Instruments are settling. I can read the route again."] }),
	14: mission(
		"Cruise missiles are approaching our northern landing forces at very low altitude. Intercept every weapon before it reaches the defended area. Expect separate groups and changing approach directions. Fast target identification matters more than pursuing optional aircraft; even one missile getting through can end the operation.",
		"The missile attack was stopped and the landing forces remain intact. With the northern coast secure, the advance toward San Salvacion can continue.",
		"The northern landing opens another route across Usea while Erusea attempts a long-range counterstrike.",
		["SkyEye: Cruise missiles inbound. Check the low-altitude tracks and close the intercept angle.", "Landing Control: Our formations are exposed. We need every one of those weapons stopped."],
		["SkyEye: A further missile group is approaching. Recheck your map; do not continue on the old heading."],
		{ "missile-wave-2": ["SkyEye: Second missile group. Split approaches; take the nearest threat first."], "missile-final": ["SkyEye: Final weapon detected. It is maneuvering. Stay with it until destruction is confirmed."] }),
	15: mission(
		"Liberate San Salvacion by breaking the forces blocking our ground troops. Armor holds Old Towne, while helicopters and defenders protect the New City area. Watch the airport for hostile air activity. The resistance will restore the lights as our troops approach; remain ready to defend the city against a counterattack.",
		"San Salvacion is free and the bomber counterattack has been defeated. Our troops are entering the city as the remaining Erusean forces retreat. For the people below, this victory is the return of their home.",
		"The continental offensive reaches the occupied city at the heart of the civilian story.",
		["SkyEye: Support the ground advance across the city. Watch for the resistance signal.", "Resistance: We're bringing the lights back. Our people are ready."],
		["SkyEye: Tu-160 bombers inbound. Intercept them before the liberated city becomes their target." ]),
	16: mission(
		"Break the armored defenses in Whiskey Corridor. Several lines stand between our forces and Farbanti, supported by artillery, aircraft and air defenses. Plan a sustained close-air-support sortie and use the return route when ammunition runs low. Keep attacking until the required defensive capacity has been removed.",
		"The corridor is open. Erusea's last major defensive line before its capital has broken. Our next operation will strike Farbanti and seek an end to the war.",
		"ISAF moves west between the Lambert and Amber mountains toward the capital.",
		["SkyEye: Multiple defensive lines ahead. Work through the sectors and monitor stores.", "Ground Control: Armor is massing across the corridor. Your strikes are opening our route." ]),
	17: mission(
		"Support the assault on Farbanti. Enemy forces occupy several sectors of the damaged capital, including positions near the bridges and flooded district. Achieve the required damage while supporting the advance on headquarters. Yellow Squadron may make its final defense here; be prepared to finish the air battle after the ground operation develops.",
		"Yellow Squadron has been destroyed and Erusea has accepted surrender. Our formations are being accounted for. The formal war is over, though headquarters is still tracking forces that have not obeyed the ceasefire.",
		"The campaign reaches Farbanti, where the ground offensive and the rivalry with Yellow Thirteen converge.",
		["SkyEye: Farbanti sectors are marked. Maintain awareness of bridges, sea level and the ruined district.", "Ground Control: We're approaching headquarters. Keep their reinforcements off us."],
		["SkyEye: Five Yellow fighters entering the battle. All five are confirmed hostile. This is the final engagement with Thirteen's squadron.", "Yellow Lead: Hold formation. We meet them here." ]),
	18: mission(
		"Officers refusing the surrender have seized Megalith. Its rockets can turn remaining asteroid fragments into weapons against the continent. Enter the three outer tunnels and destroy their generators. An infiltration team will open the central route. Destroy the main missile inside and escape through the vertical shaft; the outer walls cannot be defeated by ordinary strafing.",
		"Megalith's main weapon is destroyed and Mobius One has escaped. The surviving aircraft are returning. The immediate threat to Usea is over; rebuilding the continent will take far longer than this final sortie.",
		"After the surrender, the last operation reaches Megalith in the Twinkle Islands. These Yellow-marked defenders are a new force, not Thirteen's lost squadron.",
		["SkyEye: Mobius formation, cover the approach. One, take the generator tunnels.", "Bravo One: We're inside, but the control room is locked. Cut the generators so we can reach the panel."],
		["Bravo One: Power is down. Central route opening now. We are holding your exit.", "SkyEye: Destroy the main missile, then climb out through the shaft. We're waiting for you outside."],
		{ generator: ["Bravo One: Another generator is down. Keep going; we're moving with you."], core: ["SkyEye: Main weapon destroyed. Take the exit now, Mobius One."] }),
};
