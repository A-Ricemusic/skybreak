// Caption-first story cinematics for Last Tide. Camera motion and timing are
// client presentation only; campaign progression remains server authoritative.

export type CinematicShot = "reef" | "hangar" | "horizon" | "storm" | "fleet" | "memorial";

export interface CinematicBeat {
	speaker: string;
	text: string;
	shot: CinematicShot;
	duration: number;
}

export interface CinematicScene {
	afterMission: number;
	title: string;
	location: string;
	beats: CinematicBeat[];
}

const scene = (afterMission: number, title: string, location: string, beats: CinematicBeat[]): CinematicScene => ({
	afterMission, title, location, beats,
});

export const CUTSCENES: CinematicScene[] = [
	scene(0, "THE WATER REMEMBERS", "Yurei Atoll · Reefwatch Hangar", [
		{ speaker: "CAPTAIN SIAOSI", text: "The Admiralty calls this a blockade. My mother calls it a hand around twenty thousand throats.", shot: "reef", duration: 4.8 },
		{ speaker: "CHIEF VARO", text: "We have one Kestrel, eight missiles, and every island radio listening. That will have to be an air wing.", shot: "hangar", duration: 4.8 },
		{ speaker: "SIAOSI", text: "Then open the hangar. Before the next tide, Yurei learns to fly.", shot: "horizon", duration: 4.4 },
	]),
	scene(1, "FIRST WAKE", "Yurei Reef · sunset", [
		{ speaker: "VARO", text: "Training radar gone, three raiders down. You made the lesson real faster than I planned.", shot: "hangar", duration: 4.5 },
		{ speaker: "SIAOSI", text: "Their wreckage points west. Reefbreak Harbor is feeding the blockade.", shot: "fleet", duration: 4.4 },
		{ speaker: "RADIO CHOIR", text: "Reefwatch, the islands hear you. Bring the horizon back.", shot: "reef", duration: 4.4 },
	]),
	scene(2, "A HOLE IN THE LINE", "Reefbreak Harbor · burning quay", [
		{ speaker: "VARO", text: "Warehouses are burning. The ace is in the water. For one hour, the eastern channel is ours.", shot: "fleet", duration: 4.5 },
		{ speaker: "SIAOSI", text: "One hour is enough to move medicine. Not enough to end a war.", shot: "horizon", duration: 4.3 },
		{ speaker: "UNKNOWN NAVIGATOR", text: "Reefwatch, if you want the whole blockade, sweep the shallows. I can prove where it breaks.", shot: "storm", duration: 4.8 },
	]),
	scene(3, "FOOTPRINTS ON WATER", "Yurei Shallows · patrol return", [
		{ speaker: "SIAOSI", text: "The scouts flew a pattern, not a hunt. Someone is measuring our flood walls.", shot: "reef", duration: 4.6 },
		{ speaker: "VARO", text: "The mystery voice marked Pearl Lagoon. Three stolen cutters are fueling there.", shot: "hangar", duration: 4.4 },
		{ speaker: "SIAOSI", text: "We follow the mark. We do not trust the hand that drew it.", shot: "horizon", duration: 4.4 },
	]),
	scene(4, "PEARLS AND POWDER", "Pearl Lagoon · empty moorings", [
		{ speaker: "VARO", text: "Cutters sunk before they cast off. The lagoon families are already relighting their docks.", shot: "reef", duration: 4.5 },
		{ speaker: "UNKNOWN NAVIGATOR", text: "Good. Now look south. The first monsoon will hide an Admiralty fleet move.", shot: "storm", duration: 4.5 },
		{ speaker: "SIAOSI", text: "Give me a name, navigator.", shot: "hangar", duration: 3.6 },
	]),
	scene(5, "MONSOON VOICE", "Reefwatch Hangar · rain roof", [
		{ speaker: "UNKNOWN NAVIGATOR", text: "Mira Sen. Navigation officer, Admiralty carrier Resolute. For now, still aboard.", shot: "storm", duration: 4.7 },
		{ speaker: "SIAOSI", text: "You guided the ships that starved us.", shot: "hangar", duration: 3.8 },
		{ speaker: "MIRA", text: "Yes. Let me guide you to the depots that keep them here.", shot: "fleet", duration: 4.5 },
	]),
	scene(6, "EMPTY CRATES", "Driftwood Dock · dawn", [
		{ speaker: "VARO", text: "Four stockyards gone. Half the western patrol is flying on fumes.", shot: "fleet", duration: 4.4 },
		{ speaker: "MIRA", text: "Their best reef pilot hunts alone through Bone Reef. He will not expect you inside the wreck field.", shot: "storm", duration: 4.7 },
		{ speaker: "SIAOSI", text: "You know his habits too well.", shot: "hangar", duration: 3.9 },
	]),
	scene(7, "THE OLD WRECKS", "Bone Reef · memorial buoys", [
		{ speaker: "MIRA", text: "His name was Tal. We trained together. The Admiralty taught us loyalty meant never looking down.", shot: "memorial", duration: 5 },
		{ speaker: "SIAOSI", text: "Down there are the people who pay for that lesson.", shot: "reef", duration: 4.2 },
		{ speaker: "MIRA", text: "Destroy the four signal relays. Then I can leave without leading the carrier to you.", shot: "horizon", duration: 4.6 },
	]),
	scene(8, "SIGNAL DARK", "Signal Keys · silent towers", [
		{ speaker: "VARO", text: "Their targeting net is blind from here to the flood wall.", shot: "reef", duration: 4.3 },
		{ speaker: "MIRA", text: "I have a launch window. They will send everyone behind me.", shot: "fleet", duration: 4.4 },
		{ speaker: "SIAOSI", text: "Come east. One clean route, no tricks. I will meet you halfway.", shot: "horizon", duration: 4.7 },
	]),
	scene(9, "SECOND SEAT", "Yurei Hangar · midnight", [
		{ speaker: "VARO", text: "Mira Sen, former enemy navigator, currently dripping on my clean hangar floor.", shot: "hangar", duration: 4.6 },
		{ speaker: "MIRA", text: "Former navigator. Current volunteer. Admiral Reyne plans to open your flood wall during the second tide.", shot: "storm", duration: 5 },
		{ speaker: "SIAOSI", text: "At dawn you fly second seat. Trust starts in the air.", shot: "horizon", duration: 4.5 },
	]),
	scene(10, "TWO SETS OF EYES", "Shelter Pass · sunrise", [
		{ speaker: "MIRA", text: "You waited for my calls even when your instincts said turn. Thank you.", shot: "reef", duration: 4.5 },
		{ speaker: "SIAOSI", text: "You found every launcher. Trust is easier with good navigation.", shot: "hangar", duration: 4.2 },
		{ speaker: "VARO", text: "Save the friendship speech. Attack boats are racing the flood gates.", shot: "fleet", duration: 4.4 },
	]),
	scene(11, "THE WALL HOLDS", "Yurei Flood Wall · twilight", [
		{ speaker: "RADIO CHOIR", text: "North gate dry. Pearl ward dry. Children are painting your Kestrel on the shelters.", shot: "reef", duration: 4.8 },
		{ speaker: "MIRA", text: "Blackwater Yard built the boats we stopped. Six drydocks can build six more.", shot: "fleet", duration: 4.5 },
		{ speaker: "SIAOSI", text: "Then the next tide finds empty docks.", shot: "horizon", duration: 4.1 },
	]),
	scene(12, "BLACKWATER EMBERS", "Blackwater Yard · smoke line", [
		{ speaker: "VARO", text: "The yardmasters are down and their keels are scrap. That buys us a season.", shot: "fleet", duration: 4.5 },
		{ speaker: "MIRA", text: "Not if Reyne moves in the typhoon. He thinks island pilots fear weather.", shot: "storm", duration: 4.5 },
		{ speaker: "SIAOSI", text: "Island pilots grew up listening to roofs come loose.", shot: "hangar", duration: 4.1 },
	]),
	scene(13, "EYE WALL", "Typhoon Eye · fleet channel", [
		{ speaker: "MIRA", text: "Inside the eye I could hear every island radio. No Admiralty order ever sounded like that.", shot: "storm", duration: 4.8 },
		{ speaker: "SIAOSI", text: "Orders end when the speaker leaves. Community answers back.", shot: "reef", duration: 4.4 },
		{ speaker: "VARO", text: "A corvette convoy just answered. Reefline Strait, five hulls.", shot: "fleet", duration: 4.3 },
	]),
	scene(14, "STRAIT OPEN", "Reefline Strait · rescue lights", [
		{ speaker: "RADIO CHOIR", text: "Fishing boats are crossing the strait for the first time in eight weeks.", shot: "reef", duration: 4.7 },
		{ speaker: "MIRA", text: "Reyne will send night interceptors. He punishes hope where people can see it.", shot: "storm", duration: 4.5 },
		{ speaker: "SIAOSI", text: "Then we make hope visible after dark.", shot: "horizon", duration: 4.1 },
	]),
	scene(15, "LIGHTS IN RAIN", "Yurei Approach · 02:10", [
		{ speaker: "VARO", text: "Seven enemy aircraft down. Every runway lamp stayed on.", shot: "hangar", duration: 4.4 },
		{ speaker: "MIRA", text: "The breakwater siege begins at first light: launchers, relays, a full combat patrol.", shot: "fleet", duration: 4.8 },
		{ speaker: "SIAOSI", text: "We meet them before the beach families wake.", shot: "reef", duration: 4.2 },
	]),
	scene(16, "OUTER WALL", "Yurei Breakwater · morning", [
		{ speaker: "RADIO CHOIR", text: "Breakwater secure. No landing ships reached the reef.", shot: "reef", duration: 4.2 },
		{ speaker: "MIRA", text: "Reyne has stopped sending formations. Two of his shadows are coming for us personally.", shot: "horizon", duration: 4.7 },
		{ speaker: "SIAOSI", text: "Good. Shadows disappear when they leave the carrier's light.", shot: "hangar", duration: 4.3 },
	]),
	scene(17, "NO MORE SHADOWS", "Open Reef · floating flare", [
		{ speaker: "MIRA", text: "Those were Reyne's longest-serving pilots. He has no one left who remembers his first victory.", shot: "memorial", duration: 4.8 },
		{ speaker: "SIAOSI", text: "He still has the second tide and every gun behind it.", shot: "fleet", duration: 4.2 },
		{ speaker: "VARO", text: "Flood wall crews report targets. This is the attack Mira warned us about.", shot: "storm", duration: 4.6 },
	]),
	scene(18, "SECOND TIDE", "Flood Wall · high water", [
		{ speaker: "RADIO CHOIR", text: "The wall holds. Repeat: every ward is dry.", shot: "reef", duration: 4.2 },
		{ speaker: "MIRA", text: "The blockade carrier is exposed while it recovers aircraft. Its screen is thin.", shot: "fleet", duration: 4.6 },
		{ speaker: "SIAOSI", text: "We have spent eighteen missions defending home. Time to move the horizon west.", shot: "horizon", duration: 5 },
	]),
	scene(19, "ON THEIR DECK", "Admiralty carrier screen · dusk", [
		{ speaker: "VARO", text: "Five escorts broken. Carrier deck operations stopped cold.", shot: "fleet", duration: 4.4 },
		{ speaker: "MIRA", text: "Reyne moved command codes to Lone Spire. Six batteries and an ace guard the uplink.", shot: "storm", duration: 4.6 },
		{ speaker: "SIAOSI", text: "Cut the voice from the fleet.", shot: "horizon", duration: 3.8 },
	]),
	scene(20, "THE QUIET ORDER", "Lone Spire · dead transmitter", [
		{ speaker: "MIRA", text: "The fleet is receiving nothing but static. Some captains will choose for themselves now.", shot: "reef", duration: 4.7 },
		{ speaker: "SIAOSI", text: "Choice can end this faster than missiles.", shot: "hangar", duration: 4 },
		{ speaker: "VARO", text: "Not for the ten aircraft crossing both horizons. Those still chose us.", shot: "horizon", duration: 4.5 },
	]),
	scene(21, "DECOY SUN", "Twin Horizon · western channel", [
		{ speaker: "MIRA", text: "The decoy signal pulled their reserve away from the refugee channel.", shot: "fleet", duration: 4.5 },
		{ speaker: "RADIO CHOIR", text: "Three thousand people crossed under your wing.", shot: "reef", duration: 4.2 },
		{ speaker: "SIAOSI", text: "Relight Reef Beacon. Let every ship see where safety begins.", shot: "horizon", duration: 4.5 },
	]),
	scene(22, "BEACON LIT", "Reef Beacon · first rotation", [
		{ speaker: "VARO", text: "Beacon turning. Raider batteries silent. Flight lord down.", shot: "reef", duration: 4.2 },
		{ speaker: "MIRA", text: "Reyne is hiding his retreat behind the monsoon veil.", shot: "storm", duration: 4.1 },
		{ speaker: "SIAOSI", text: "We know how to read rain now. Lead us through.", shot: "hangar", duration: 4.2 },
	]),
	scene(23, "VEIL LIFTED", "Monsoon Veil · clear channel", [
		{ speaker: "MIRA", text: "Refugees clear. Reyne's supply ships are stranded at Last Light.", shot: "storm", duration: 4.4 },
		{ speaker: "SIAOSI", text: "You stopped calling them our targets three missions ago.", shot: "hangar", duration: 4.1 },
		{ speaker: "MIRA", text: "I think I finally started calling this home.", shot: "reef", duration: 4.7 },
	]),
	scene(24, "LAST LIGHT OUT", "Last Light Anchorage · predawn", [
		{ speaker: "VARO", text: "Supply chain cut. Two escort aces gone. The blockade cannot stay another week.", shot: "fleet", duration: 4.6 },
		{ speaker: "MIRA", text: "It will not stay another day. Reyne's carrier is moving before sunrise.", shot: "horizon", duration: 4.2 },
		{ speaker: "SIAOSI", text: "Mark the blind quarter. We go to the source.", shot: "hangar", duration: 4.2 },
	]),
	scene(25, "FLAGSHIP WOUNDED", "Admiralty flagship · launch deck", [
		{ speaker: "MIRA", text: "Emplacements gone. Launch deck burning. Reyne escaped in his command aircraft.", shot: "fleet", duration: 4.8 },
		{ speaker: "SIAOSI", text: "Let him run. The island evacuation comes first.", shot: "reef", duration: 4.2 },
		{ speaker: "VARO", text: "Six pursuit fighters and a ground line are closing that corridor now.", shot: "storm", duration: 4.5 },
	]),
	scene(26, "BREAKING WAVE", "Evacuation Corridor · open water", [
		{ speaker: "RADIO CHOIR", text: "Last civilian ferry clear. Every island accounted for.", shot: "reef", duration: 4.6 },
		{ speaker: "MIRA", text: "Reyne is waiting at Last Horizon with three lieutenants. He wants a legend, not an escape.", shot: "horizon", duration: 4.7 },
		{ speaker: "SIAOSI", text: "Then we deny him both. We bring him back alive if the sea allows it.", shot: "hangar", duration: 4.7 },
	]),
	scene(27, "THE LAST TIDE", "Yurei Atoll · one month later", [
		{ speaker: "MIRA", text: "Reyne faces the island tribunal tomorrow. He asked who taught you to fly like that.", shot: "memorial", duration: 4.8 },
		{ speaker: "SIAOSI", text: "Tell him the reefs did. Every narrow channel, every bad roof, every voice on the radio.", shot: "reef", duration: 5 },
		{ speaker: "VARO", text: "Hangar door is open. Not for war this time — the outer islands need mail.", shot: "hangar", duration: 4.4 },
		{ speaker: "MIRA", text: "Navigator ready, Captain. Let's see what lies beyond a free horizon.", shot: "horizon", duration: 5.2 },
	]),
];

export function getCutscene(afterMission: number): CinematicScene {
	assert(afterMission >= 0 && afterMission <= 27 && afterMission % 1 === 0, `Unknown cutscene ${afterMission}`);
	return CUTSCENES[afterMission];
}

assert(CUTSCENES.size() === 28, "Last Tide requires an opening, 26 transitions, and a finale");
for (let index = 0; index < CUTSCENES.size(); index++) {
	assert(CUTSCENES[index].afterMission === index, `Cutscene ${index} is out of order`);
	assert(CUTSCENES[index].beats.size() >= 3, `Cutscene ${index} needs at least three rendered beats`);
}
