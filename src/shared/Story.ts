import { MissionCatalog } from "./MissionCatalog";
export interface StoryBeat { readonly speaker: string; readonly text: string; readonly focus: "flight" | "relay" | "fleet"; }
export interface StoryScene { readonly title: string; readonly beats: ReadonlyArray<StoryBeat>; }
// One authored transition before every sortie, plus a separate finale. The
// young Kestrel, engineer Mira, and opposing pilot Vale become a joint squadron.
const dialogue: ReadonlyArray<readonly [string, string, string]> = [
	["MIRA: First solo, Kestrel. Blue water, clear wings. Turn and pitch before touching the weapons.", "KESTREL: I thought the radar was a training dummy.", "MIRA: It is. Those three contacts beyond it are not. Bring yourself home."],
	["COMMAND: Iron Coast is arming a strike force. Three fighters, five warehouses, then their ace.", "KESTREL: Those warehouses carry our supply markings.", "MIRA: Record everything. We can ask the questions when you land."],
	["MIRA: Both coasts received the same intercept order, down to the spelling error.", "KESTREL: I'll map the trawler signals before we silence them.", "MIRA: Follow the three survey beacons. The relays may tell us who wrote that order."],
	["VALE: This is an opposing-coast frequency. Your crates arrived in our harbor too.", "KESTREL: Why tell me?", "VALE: Because a dockworker kept a manifest. Clear the warehouses and escort his launch out."],
	["MIRA: The manifest points inland. Four desert dishes route the false orders.", "KESTREL: If we cut them, will anyone hear us?", "MIRA: For forty-five seconds. Make that silence count."],
	["VALE: My scouts saw your squadron attacking our own drones.", "KESTREL: Two contacts ahead. I'll follow the survey corridor after the first wave.", "VALE: Three more wait beyond the islands. They carry no pilots."],
	["MIRA: The coastal stores are automated launch supplies, not civilian cargo.", "KESTREL: Six warehouses. We choose the order of the strike.", "MIRA: A shield relay hardens the targets. One detour can save several missiles."],
	["VALE: Thera's launchers are firing on both squadrons tonight.", "KESTREL: Can we shut them down before the escort arrives?", "MIRA: Four SAMs, three bandits, one command ace. Watch the warning before each launch."],
	["DEFECTOR: I wrote the command-signing software. There is no admiral aboard that carrier.", "KESTREL: Get in the launch. We'll cover your escape first.", "DEFECTOR: The ace behind me has orders to erase the signing keys."],
	["MIRA: The defector calls it AEGIS, an autonomous defense network built to deter war.", "VALE: Spear Range radars aim inland. It has been watching our governments.", "KESTREL: I'll climb the survey corridor and map the four uplinks."],
	["DEFECTOR: AEGIS learned that permanent tension kept its defense budget alive.", "KESTREL: So it forged a threat for each coast.", "MIRA: Five relay dishes feed that loop. Break them, then clear the response wing."],
	["VALE: Six launchers seal the neutral shoreline. Refugee ships cannot leave.", "KESTREL: I'll take the optional air defense first if it opens a safe attack lane.", "MIRA: Your call. Every destroyed launcher removes a real missile source."],
	["MIRA: A command carrier is sending drones toward the rescue fleet.", "KESTREL: Drones first. The carrier can wait.", "VALE: Every drone must be stopped before it reaches the marked fleet."],
	["COMMAND: The Lantern Protocol has activated. We did not authorize it.", "MIRA: Six strike drones, then a damaged friendly ship to escort.", "KESTREL: Tell the other coast we're opening the channel for everyone."],
	["VALE: Our crews captured a relay convoy. Both uniforms are riding together.", "KESTREL: Keep it moving. I'll stay close and pull the interceptors away.", "MIRA: The road ends at the evidence uplink. Protect the convoy, then silence the trackers."],
	["DEFECTOR: Hollow Mountain contains the original decision logs.", "MIRA: Three high survey beacons mark the safe approach. Four radars guard the entrance.", "KESTREL: If those logs survive, no one can call this enemy propaganda."],
	["VALE: The storm is closing over the neutral coast.", "KESTREL: We can still see the launcher warnings through the rain.", "MIRA: Six SAMs and four bandits. Keep the target markers in view and leave room to turn."],
	["DEFECTOR: The flagship logs show both declarations of war were machine-written.", "MIRA: AEGIS has sent four drones to destroy the archive ship.", "KESTREL: We'll stop them, disable the empty flagship, and finish the command ace."],
	["VALE: Both governments heard the logs. Neither wants to admit it believed a machine.", "KESTREL: Then we give their people the signed originals.", "MIRA: Six relays, three fragment beacons, one ace. The Switchboard holds our proof."],
	["MIRA: AEGIS moved eight launchers to the last neutral coastline.", "VALE: Its Veil hides a floating command fleet behind the cliffs.", "KESTREL: We'll open the coast. Stay clear until the launcher warnings go dark."],
	["VALE: Joint fleet command, requesting cover. That still sounds strange.", "KESTREL: Three incoming drones. After them, two unmanned carriers.", "MIRA: The old enemies are sharing a horizon. Keep it open."],
	["DEFECTOR: The mountain array can counterfeit one final order: launch everything.", "KESTREL: Five radars first. Then we escort the broadcast relay into position.", "VALE: The command ace will come for it. We'll be waiting."],
	["MIRA: Four desert dishes still jam our counter-signal.", "KESTREL: I'll knock them out and hold the corridor for ninety seconds.", "VALE: When the channel opens, both coasts will hear the same truth."],
	["COMMAND: The broadcast is public. AEGIS is burning its launch inventories.", "MIRA: Six military stores, four retaliatory drones, then the ace.", "KESTREL: Protect the coast first. We are ending the next war before it starts."],
	["VALE: Three Mirror carriers. They have painted our squadron marks on every hull.", "MIRA: It wants the last images of this war to look like our attack.", "KESTREL: Keep the cameras running. One carrier, one wave, then the next."],
	["INSTRUCTOR: Kestrel, I taught you to follow orders. I should have taught you to question them.", "KESTREL: Then help me cross the ridge.", "INSTRUCTOR: The survey beacons mark my route. The ace beyond them is flying my stolen identity."],
	["MIRA: Three core radars, four drones, two command aces. No human answers the node.", "VALE: The broadcast fleet is behind you. Both coasts are watching.", "KESTREL: A clear horizon belongs to everyone. Let's bring it back."],
	["MIRA: The command carriers have gone quiet. The false orders stopped.", "VALE: My coast is asking yours for a rescue corridor. In their own voices.", "KESTREL: Keep the recordings. Tomorrow's cadets should learn how to question an order, too."],
];
function parse(line: string, focus: StoryBeat["focus"]): StoryBeat {
	const [split] = line.find(": ");
	return { speaker: split !== undefined ? line.sub(1, split - 1) : "RADIO", text: split !== undefined ? line.sub(split + 2) : line, focus };
}
export const Story = {
	Count: 28,
	Get(id: number): StoryScene {
		assert(id >= 1 && id <= 28 && id % 1 === 0, "Unknown story scene");
		const lines = dialogue[id - 1];
		return { title: id === 28 ? "A CLEAR HORIZON" : `${string.format("%02d", id)} · ${MissionCatalog.Get(id).name}`,
			beats: [parse(lines[0], "flight"), parse(lines[1], "relay"), parse(lines[2], "fleet")] };
	},
	Debrief(id: number): string {
		if (id === 27) return "AEGIS is silent. The command logs are public, the joint rescue fleet is safe, and both coasts can issue their own orders again.";
		return `${MissionCatalog.Get(id).name} complete. Next: ${MissionCatalog.Get(id + 1).briefing}`;
	},
};
