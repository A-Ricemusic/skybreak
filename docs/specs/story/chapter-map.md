# Broken Relay: proposed 18-chapter map for the new campaign

Status: **approved by the owner on 2026-10-28, with changes (D-030, D-031)**. Nothing here is built. Written 2026-10-28 by the design sub-agent (Opus 5.5) from `main` at `b17fb9e`, then updated the same day with the owner's answers (section 5). The main change: Rusk survives mission 17 and falls in a one-on-one duel added at the end of mission 18 (section 2c).

Read for this proposal: `src/shared/RelayStory.ts` (all 28 chapters), `src/shared/StoryDocuments.ts`, `docs/broken-relay.md`, `src/shared/missions/m01.ts` to `m27.ts`, `reference/ledger.md` (the 18 reference missions), `docs/specs/missions/m01.md`, `docs/specs/worlds/m01.md` and `docs/human/decisions.md` (D-001, D-011, D-013, D-021).

Copyright (D-001): only the reference's mission **structure and settings** are used to pair chapters with missions. Every person, place, line and reason below comes from Broken Relay. Reference mission titles appear only in the column labelled "Reference (cross-reference only)". Timestamps there are source times from the ledger.

How to read it: "ch 14" means today's chapter 14 in `RelayStory.ts`. "New 7" means the chapter number in the proposed 19-chapter story. "M8" means new mission 8.

## 1. The story as it stands

**The arc in brief.** A trainee at Varda Rim finds an empty instructor's chair. Their instructor, Teal, missed three check-ins, and command made Sera at Varda Control call him a deserter on the net. Teal left a coffee tin of tapes "for Sera, not for the net". Following his recordings, the trainee finds that the enemy wears Varda's own paint. The trail runs from a hidden radar watching trainees, through the Teklan orchard where an old woman hid one of his tapes in a seed tin, to aviation fuel hidden under grain permits. Vulture Lead, who hunted Teal at night, carries orders signed by a governor who has been dead since spring. A chain of relay stations proves one hand signed them all. A 35-second broadcast makes two garrisons stand down. The coup's anonymous voice answers by burning the orchard. The aurora archive holds ORDER 0001 and names him: Air Marshal Rusk. Vulture Two, who taught Teal to fly and forged the orders in his own hand, is shot down and confesses. The evidence gets out by sea while Rusk holds the city with one voice on repeat. The recovery team finds Teal in the upper pass with his recorder still running. His last recording plays in full, and Sera amends the record herself: killed, not deserted. The trainee beats Rusk above the parliament and broadcasts the truth in their own voice. Check-in "two of three", and the instructor's chair is filled.

**Load-bearing beats (must survive condensation)**

| # | Beat | Where it is today |
|---|---|---|
| L1 | Teal missing and called a deserter; Sera forced to say it; the empty chair; "two taps"; "fly the pattern too low and too fast"; "the sky will still be there" | ch 0 |
| L2 | The coffee tin of tapes, "for Sera, not for the net"; the enemy wears our markings, "they're already home" | ch 1 |
| L3 | The unlisted radar inside the training area, watching trainees (the first hard proof) | ch 3 |
| L4 | The Teklan orchard: the old woman asked Teal's name, the seed tin, the trucks | ch 4 |
| L5 | The coup's voice heard anonymously before it is named | ch 4, 10, 15 |
| L6 | Vulture Lead hunted Teal ("erasing a witness"); his recorder holds orders signed by a dead governor | ch 8, 9 |
| L7 | Three relay stations, one signature: the proof | ch 9, 10, 14 |
| L8 | The 35-second broadcast, timed by Teal two weeks before he vanished; garrisons stand down | ch 14 |
| L9 | The orchard burns in reprisal; Sera: "I'd ask again" | ch 15 |
| L10 | The aurora archive and ORDER 0001 signed RUSK: the voice is named | ch 16, 17 |
| L11 | Vulture Two: Teal's own instructor, the handwriting match, the challenge, the ejection and the confession | ch 13, 17, 18 |
| L12 | The evidence physically gets out (the paper copy) | ch 19 |
| L13 | The city hears only Rusk, and the trainee gives it quiet | ch 20 |
| L14 | Rusk speaks to the trainee in his own name about Teal | ch 21 |
| L15 | Teal found in the pass; his last recording in full ("ten minutes"); the amended record | ch 25 |
| L16 | Rusk's last offer; the trainee answers in their own voice; check-in "one of three" | ch 26 |
| L17 | The final broadcast; "two of three"; the roster amended and the chair filled | ch 27 |

**Optional (can merge or go):** the fuel silos and the granddaughter's thumbprints (ch 5), the dust courier (ch 6), the Varda tower switch (ch 7), the mobile transmitter truck (ch 11), the staging farm (ch 12), the saddle antennas (ch 13, apart from L11's handwriting), the military quays (ch 18, apart from the confession), the fog fuel piers (ch 21, apart from L14), the frigate ring (ch 22), the storm platform (ch 23), and the dawn landing (ch 24, apart from Teal's "fly for the people beneath them").

## 2. The 18 missions and their chapters

**Chapter count.** Today, one chapter plays before each of 27 missions and a finale plays after the last: 28 in all. The same rule for 18 missions gives **18 chapters before missions plus the finale, 19 in all** (question Q1). The opening plays before the practice flight (D-021), and the practice flight leads straight into mission 1's briefing, so the opening is mission 1's chapter. New chapter *k* plays before mission *k*+1, as today.

### 2a. Mapping

| New # | Reference (cross-reference only) | Reference setting and type (ledger) | Chapter before it | Merged in / cut |
|---|---|---|---|---|
| Practice | — (today's controls tutorial, D-021) | Varda training islands, noon | **New 0 "A voice in the static"** (ch 0) | Unchanged apart from the last trainee line |
| 1 | Sitting Duck, 0:06:30–0:11:24 | Sea and island coast, overcast early afternoon. Intercept six bombers with escorts; carrier start | New 0 (plays before the practice flight) | — |
| 2 | Imminent Threat, 0:15:38–0:22:34 | Enemy airbase in farmland, overcast day. Strike parked bombers, hangars, AA | **New 1 "The sealed case"** (ch 1) | Two ch 12 beats merged ("they call it a farm"; real houses in the yard). Ch 12 is cut as a chapter |
| 3 | The Northern Eye, 0:26:41–0:34:24 | Snowy mountains, clear sky. Strike radar sites, return to base and land | **New 2 "An unlisted station"** (ch 3) | Ch 2 "Fox trail" merged (the beacons, the receiver, Teal's Sundays in the pass) |
| 4 | Blockade, 0:36:36–0:42:42 | Green hills and forest, blue sky. High-altitude intercept of large transport and radar aircraft with escorts | **New 3 "The orchard witnesses"** (ch 4) | Ch 6 "The dust courier" merged: the courier and its five escorts become the high flyers guiding the patrols onto the trucks |
| 5 | Lifeline, 0:44:42–0:58:13 | Night strike on a fuel refinery under searchlights; mid-mission rearm; an ace flight appears afterwards | **New 4 "Fuel under grain"** (ch 5) | Ch 8 "Vulture Lead" merged: he is the ace who arrives after the fuel burns |
| 6 | Invincible Fleet, 1:03:01–1:20:00 | Hazy daytime harbour. Strike docked warships, tankers and AA; mid-mission rearm | **New 5 "Military quays"** (ch 18's quay beats) | Ch 9's first half merged (Vulture Lead's recorder, the dead governor, "Merel talks to the harbours"). The harbour is Iron Coast, already named in ch 1 |
| 7 | Deep Strike, 1:22:13–1:35:49 | Low-level strike at sunset across dark hills on large arrays; drop into a canyon to hide from long-range guns | **New 6 "Two ridges"** (ch 10) | Ch 9's archive beat (Kiro) and ch 2's "the way you take when you don't want to be seen" merged. "The plateau chain" title dropped |
| 8 | Shattered Skies, 1:39:16–1:52:39 | Large air battle over a tropical island with a launch site; a bomber wave; the launch happens before the end | **New 7 "The loyalist window"** (ch 14) | Ch 7 "Varda switch" merged: Sera stays in her tower while the 35 seconds go out. The reference's launch moment becomes the broadcast. Ch 11's truck is cut |
| 9 | Operation Bunker Shot, 1:56:14–2:14:14 | Dark, misty mountainous coast. Support a beach landing against pillboxes, artillery and AA; carrier rearm | **New 8 "The frigate ring"** (ch 22) | Ch 15's first beat (two garrisons stood down) and Teal's storm line moved here: the garrisons that stood down come ashore under the weather |
| 10 | Tango Line, 2:16:13–2:37:51 | Clear day, forested mountains and river valleys. Long attack along a defensive line; avoid long-range guns; mid-mission rearm | **New 9 "Walking the storm"** (ch 15) | Starts at "And then the Marshal answered". The Marshal's answer is the orchard fire plus a defended line along the rivers |
| 11 | Escort, 2:39:46–2:45:27 | Snowy peaks, bright overcast. Escort two civilian airliners against fighters | **New 10 "High crossing"** (ch 13) | Ch 11's kitchen and slow-escort beats merged: the orchard survivors fly out over the saddle. Sera's handwriting reveal stays. "The portable voice" title dropped |
| 12 | Stonehenge Offensive, 2:48:27–3:04:55 | Arid crater with a ring of eight gun towers, clear sky; mid-mission landing; an ace fight after the last tower, ending with the enemy pilot ejecting | **New 11 "Vulture Two"** (ch 17's challenge beats) | Ch 13's "the antennas up there are his" merged: the ring of towers is the Marshal's command array. ORDER 0001 moves to new 14 |
| 13 | Safe Return, 3:08:30–3:18:42 | Fog-filled grey ravine. Escort a friendly reconnaissance aircraft past airship-mounted jammers, then intercept fighters | **New 12 "The evidence launch"** (ch 19) | Ch 18's confession merged (Vulture Two: "the handwriting was mine"). The boat becomes a slow evidence plane |
| 14 | Breaking Arrows, 3:20:22–3:28:38 | Night, sea ice and glaciers under a green aurora. Intercept low-flying cruise missiles | **New 13 "Aurora archive"** (ch 16) | — The crown station stands on the ice coast; the missiles are aimed at its dish |
| 15 | Emancipation, 3:32:45–3:47:38 | Night battle over a lit city: tanks, helicopters, AA, then a bomber attack on the city; mid-mission rearm | **New 14 "The city in darkness"** (ch 20) | Ch 17's ORDER 0001 log and Sera's wing-ceremony beat merged: the name comes first, then his voice over the city |
| 16 | Whiskey Corridor, 3:50:50–4:12:27 | Hazy clear-day desert: crater, bunkers, ruined town. Close air support for an armoured advance; airbase rearm | **New 15 "The dawn landing"** (ch 24) | Ch 21's Rusk-in-his-own-name beat, Sera's reply and the trainee's answer merged. Ch 21 is otherwise cut |
| 17 | Siege of Farbanti, 4:14:30–4:32:17 | Flooded coastal capital at golden hour: bridges, a battleship, tanks; rearm at dusk; five ace fighters at the end | **New 16 "The last fracture"** (ch 25) | — Rusk leads the five aces and **survives**: he breaks off and flies out to sea once his four wingmen are down (section 2c) |
| 18 | Megalith, 4:36:59–4:46:22 | Vast grey coastal structure under storm. Fly inside narrow grooves to kill generators, run the central vent, get out | **New 17 "Broken relay"** (ch 26) | — The structure is Rusk's relay works, playing his voice on a loop. **Added final phase, not in the reference:** a one-on-one duel with Rusk above the broken works, where he falls (section 2c) |
| Finale | — (after mission 18) | — | **New 18 "A clear frequency"** (ch 27) | Unchanged apart from one line |

**Cut entirely:** ch 23 "The storm platform" (no beat survives).
**Cut as chapters, a few beats kept elsewhere:** ch 12 "The staging farm" (into new 1), ch 21 "Fog fuel" (into new 15).
**Absorbed into another chapter, title dropped:** ch 2 "Fox trail", ch 6 "The dust courier", ch 7 "Varda switch", ch 8 "Vulture Lead", ch 9 "The plateau chain", ch 11 "The portable voice".
**Split across two new chapters:** ch 9 (new 5 and 6), ch 13 (new 10 and 11), ch 15 (new 8 and 9), ch 17 (new 11 and 14), ch 18 (new 5 and 12).

Every new chapter stays within today's three-to-eight-beat limit. Merges keep the beats listed above and drop briefing-style radio lines, because mission briefings will carry the instructions.

### 2b. Scene fit and what each briefing must say

| New # | Chapter scene and mood → mission terrain and time | What the briefing must say so the story holds |
|---|---|---|
| Practice | Hangar at dawn → Varda's training islands at noon. A good fit: the checkout morning. | This is Teal's unsigned checkout; fly the pattern. No enemies (see Q7). |
| 1 | Same chapter. The raid comes after the checkout on the same day; dawn turns to overcast afternoon. | The checkout is cut short. Six bombers in Varda's own paint are crossing the islands toward Varda Rim's runway; they squawk our codes, so the warning came late. You are the nearest jet, flying off the training carrier (D-020). The debrief hands over the sealed case. |
| 2 | Hangar at night → overcast farmland the next morning. A good fit: night discovery, morning strike. | The manifest's grain drums led to a "farm" with a runway and no animals; the bombers came from there. Hit the aircraft and hangars, not the farmhouses. |
| 3 | Canyon at night (ch 3) → snowy pass and bowl in clear daylight. The scene needs snow, or the pass reads as rock; the mood changes to dawn. | Teal's beacons led to his receiver. His receiver names a radar nobody signed for. Photograph and destroy the sites, then land with the film: "if I look at it first, it's a crime". |
| 4 | Farm by day → green orchard hills under blue sky. A strong fit. | The radar's memory named the orchard. Patrols are firing on the evacuation trucks, guided from high above by the courier and its escorts. Bring the high flyers down so the trucks get out. |
| 5 | Farm at dusk plus canyon at night → night fuel works under searchlights. Mood set to night. A strong fit. | The granddaughter's thumbprints marked the tanks. The fuel works behind the grain silos feed the coup; burn it, and expect the pilot who hunted Teal with his lights off. |
| 6 | Relay at dawn (ch 9) → hazy harbour by day. Scene changes to harbour, mood to dawn. | Vulture Lead's recorder shows dead men's orders going down the relay chain to the Iron Coast harbour from ch 1's manifest. Sink the ships and tankers the drums were for. Workers and a fish market are two blocks away. |
| 7 | Relay by day → hills at sunset. Mood changes to dusk. A good fit: low-level and hidden, the way Teal came home. | Kiro's signing key needs two more logs: Lira and Merel. Strike the arrays at sunset and use the canyons to stay out of the guns' sight. Copy before you cut. |
| 8 | Farm by day plus hangar at night → tropical island by day. Scene changes to the Varda tower, mood to day. | Three logs, one signature. Varda's island transmitter will play Teal's 35 seconds. Every coup aircraft will come for it. Hold the sky until the broadcast finishes (the launch moment); Sera stays in the tower. |
| 9 | Sea in a storm → dark, misty coast. A strong fit. | Two garrisons stood down. Their frigates are landing them under the weather to join us. Clear the guns on the beach. |
| 10 | Farm in a storm (the burning) → clear day in forested river valleys. The chapter keeps the storm because the orchard burned in it; the mission is the next, clear day. | The Marshal answered with fire and a defended line along the rivers. Break the line, and stay low in the valleys away from his long-range guns. |
| 11 | Farm at dusk plus relay at dawn → snowy peaks under bright overcast. Scene: the saddle, by day. | The orchard survivors and the families from the trucks are flying to Varda on two civilian airliners over the saddle Teal flew on his checkride. Keep the fighters off them. |
| 12 | Relay at night (searchlights) → arid crater under clear sky. Mood changes to day; the searchlights are dropped. | The ring of eight towers is the Marshal's command array; take it down. Vulture Two is waiting. Mark where he lands if he ejects (the confession depends on it). |
| 13 | Harbour by day → fog-filled ravine. Mood changes to storm (a grey deck). | Vulture Two confessed. The harbour master's paper copy and his statement are on one slow plane. Escort it through the ravine; airships are jamming the way out. |
| 14 | Relay at night under the aurora → night sea ice under the aurora. The strongest fit in the map. | The crown station on the ice coast transmits only at night. It holds the first order, signed in his own name. He has launched missiles at the dish. Stop every one until the archive is received. |
| 15 | City at night → lit city at night. A strong fit. | ORDER 0001: Rusk. His voice holds the city through one relay. Silence it, cover the loyalist ground forces, then stop his bombers punishing the city. |
| 16 | City at dawn → hazy desert by day, ruined town. The landing becomes a column crossing the dry coast. | Parliament is coming home behind the loyalist column. Clear the bunkers and the town ahead of it until both squads answer from the streets. |
| 17 | Canyon at dawn (Teal found) → flooded capital at golden hour. Different places but the same tone: the last light of the long day. | Teal was found; the witnesses must reach parliament tonight. Keep the bridges and the quay open. Rusk is flying with his own wing of five over the capital. The debrief says he left his wing to die and ran for the coast. |
| 18 | City at dusk → coastal structure in a storm. Scene changes to the relay works, mood to storm. | Rusk ran to his relay works on the coast, which keep playing his voice on a loop. Fly inside it and break it, so the trainee's voice can go out. When the loop stops, he will come up to meet you alone. |
| Finale | City at dawn, after the storm. A good fit. | — (the chapter plays automatically after the mission is won) |

### 2c. Rusk at missions 17 and 18 (owner's answer to Q2)

**Mission 17: how Rusk survives.** Rusk leads the five aces over the flooded capital. He cannot be shot down in this mission. When the last of his four wingmen falls, he breaks off and flies out to sea, toward his relay works on the coast. If the player damages him badly before that, he breaks off at that point instead. The mission is won when the four wingmen are down and Rusk has gone. This is one small change to the reference's ending, where all five aces are fought: one of them now leaves instead of falling.

Why he withdraws, rather than escaping by luck or being driven off: it is who Rusk has been all story. He has let other people carry his risk (Vulture Lead, Vulture Two, his wing) and has only ever reached the city through a relay. When his wing breaks, he runs to the one thing that keeps him in power, his voice. It also makes today's ch 26 opener literally true: "The wing is broken. He's alone up there with one relay and his own voice."

**Mission 18: the added duel.** This is a new final phase that the reference's mission 18 does not have.

- **When it starts:** after the player has destroyed the generators, run the central vent and got out of the structure, in the same mission and without a loading screen. The structure breaks, the loop of his voice stops, and Sera calls it: he is coming up.
- **Where:** in open air above and around the broken relay works, over the stormy sea. Not inside the grooves. The works is a dead, smoking landmark under the fight.
- **What makes it a duel:** Rusk alone. No wingmen, no other enemy aircraft, and the structure's guns are already dead. Any enemy fighters still flying when the vent run ends leave before he arrives. The player's own wingmen, if the mission has any, hold off and do not fire on him.
- **How it ends:** the mission is won when the player shoots Rusk down. The usual failures still apply (for example, the player is shot down). The finale chapter then plays.
- **For the later spec and build:** Rusk's aircraft, his difficulty, how long the duel may run and whether it has its own countdown are left to the mission 18 spec. The reference's mission 18 runs about 9.4 minutes; the duel adds to that.

## 3. Continuity check

**Reveal order (old → new)**

| Reveal | Today | New chapter (before mission) | Order check |
|---|---|---|---|
| Teal missing, called a deserter | ch 0 | New 0 (practice, M1) | First. OK |
| The enemy wears our paint | ch 1 | New 1 (M2), after the M1 bombers | OK, stronger: the player has just shot them down |
| The radar watching trainees | ch 3 | New 2 (M3) | OK |
| The orchard and the seed tin; the coup's voice first heard (anonymous) | ch 4 | New 3 (M4) | OK |
| Vulture Lead hunted Teal | ch 8 | New 4 (M5) | Moved earlier; no longer follows the tower switch (conflict 6) |
| Dead governor's signatures | ch 9 | New 5 (M6) | OK |
| Three stations, one signature | ch 10, 14 | New 6 (M7), new 7 (M8) | OK |
| The broadcast; two garrisons stand down | ch 14, 15 | New 7 (M8), new 8 (M9) | OK |
| The orchard burns | ch 15 | New 9 (M10) | After the broadcast, before the naming. Same as today |
| Vulture Two's handwriting matches | ch 13 | New 10 (M11) | Moved after the broadcast; still before his duel. OK |
| Vulture Two challenges and ejects | ch 17 | New 11 (M12) | Now before the naming, not after (conflict 13) |
| Vulture Two confesses | ch 18 | New 12 (M13) | OK. He confesses his own hand only and points at the archive, so he does not name Rusk early |
| Archive received | ch 16 | New 13 (M14) | OK |
| The voice named: RUSK | ch 17 | New 14 (M15) | Named before he speaks as RUSK. OK |
| Rusk uses his own name to the trainee | ch 21 | New 15 (M16) | After the naming. OK |
| Teal's last recording; the amended record | ch 25 | New 16 (M17) | Second-to-last, as today. OK |
| Rusk leaves his wing and runs for the coast | — (new) | M17's ending and debrief | New. Sets up his last stand at the relay works. OK |
| Rusk's last offer, live and alone; "one of three" | ch 26 | New 17 (M18) | OK. Still his own live voice, as today |
| Rusk falls in the duel | ch 26's duel | End of M18 (added phase) | Last fight of the game, as today. OK |
| The final broadcast; "two of three" | ch 27 | New 18 (finale) | Last. OK |

**Conflicts found and how the map resolves them**

1. **Varda Rim is a canyon airfield; mission 1 is sea, island and a carrier.** Varda already has "training islands" (today's first mission). Varda Rim becomes the airfield on the island's headland, the base the bombers are heading for; the trainee flies off the training carrier. "The rim" still reads as a sea-cliff rim. (Q3, adopted.)
2. **"Three bandits on the rim" (ch 0) and "the bandits wore our markings" (ch 1)** no longer match a practice flight and a six-bomber raid. Both lines are rewritten for the bombers.
3. **Ch 1's manifest sends the fuel to five quays on Iron Coast, but M2 is a farm airfield and the harbour comes at M6.** The manifest names both: the farm with a runway first, the Iron Coast quays later.
4. **Ch 2 and 3 are set in a rock canyon; M3 is snowy mountains.** "Canyon" and "switchback" become "the pass". This also makes the pass where Teal is later found (ch 25) the same pass the player already knows.
5. **Ch 6's courier flies "through the dust pass" in a storm; M4 is a blue-sky high-altitude intercept over green hills.** The courier flies high over the orchard hills, guiding the patrols. The dust and storm wording goes.
6. **Ch 8 opens with "The tower is ours again" (after ch 7), but the tower defence moves to M8.** Ch 8's opener is replaced; Vulture Lead now follows the fuel strike.
7. **Ch 7's orders "effective 0400" make the tower attack imminent, but it now waits until M8.** The urgent-orders framing goes. The tower is attacked because it is about to broadcast. Sera's "I'm not leaving my chair" stays.
8. **Ch 9's chain runs "Kiro, Lira, Merel, the harbours" in that order, but the harbour (M6) comes before the arrays (M7).** The beat is reframed: hit the end of the chain first and listen back up it.
9. **Ch 11's mobile transmitter is cut, but ch 14 says "the mobile crew has it on tape".** The broadcast goes out from Varda's island transmitter. Ch 15 already says "Varda Rim has broadcast enemy propaganda", so this now matches better. (Q4, adopted.)
10. **Ch 13 says "the staging raid exposed a command frequency", but the staging farm is now M2 and the saddle comes later.** The checkride card comes from Sera's own files; the reference to the raid goes.
11. **Ch 15 is a storm chapter, but M10 is clear.** The chapter keeps the storm (the day of the burning). Teal's storm line ("when the weather's bad, that's when they move") moves to new 8 before the misty landing. "Rain hides the last fuel markings" goes.
12. **Ch 16 says "his plateau fuel is gone" and places the crown station on the plateau; M14 is sea ice.** The opener points at M10's broken line instead. The crown station stands on the ice coast. "Only transmits at night" and the aurora stay.
13. **Ch 17 holds both the naming and Vulture Two's challenge, but the challenge now comes at M12 and the naming at M15.** The chapter is split. The code comment "chapter 17 on" for the RUSK speaker label becomes "new chapter 14 on". Ch 17's searchlights and night ridge become daylight over the crater.
14. **Ch 18: marines lift Vulture Two "off the ridge".** This becomes "out of the crater".
15. **Ch 19: the evidence is on a boat leaving a harbour mouth sealed by the eastern wing, and the list includes "the archive", which is not yet recovered.** The boat becomes a slow plane through the ravine, the blockers become jammers and fighters, and "the archive" leaves the list.
16. **Ch 20 opens "The launch is clear. Marines have the evidence".** This becomes the plane. "The city in darkness" against a lit city is kept on purpose: the lights are on, but the city hears nothing except him.
17. **Ch 21's fog fuel piers no longer exist.** Only Rusk's own-name beat, Sera's reply and the trainee's answer survive, in new 15. "That's the first time he's used his own name" still holds, because his ch 20 line never says it.
18. **Ch 22 has "Rusk forgot" and "at his wing ceremony too" before Rusk is named, and "his convoy can't refuel" refers to cut missions.** These become "the Marshal" and the ceremony line drops "too". The fuel framing gives way to the landing.
19. **Ch 23 is cut, and with it "He said the canyon got Teal".** That line pointed back at ch 21's Rusk line; both are gone or moved, so nothing dangles.
20. **Ch 24's landing craft on the city beach do not fit a desert column.** They become a loyalist column with parliament following it "home by road". "Both squads answer from the streets" fits the ruined town.
21. **Ch 26 has Rusk alive and speaking live "above the parliament tower", with a duel to come, but the reference's M18 structure has no duel.** The owner chose to keep the duel (Q2, D-031). Rusk survives M17 by leaving his wing and flying to his relay works on the coast. Ch 26 keeps his live offer; only its place changes, from the parliament tower to the relay works. M18 gains an added final phase: once the works is broken, Rusk comes up alone and falls in the duel (section 2c). The finale's "He's down. His relay is dark" now reads literally: the relay went dark when the works broke, and he went down in the duel.
22. **The story documents shown on the flight chart are keyed by today's chapter numbers**, and several name cut places (the dust pass, the mobile transmitter, the offshore platform, the parliament tower bearing). They are re-keyed and edited in section 4.
23. **Visual cues keyed to chapter numbers**: farms charred "from chapter 15", Sera's board without Teal's name "during chapter 9", the aurora on "night relay chapters", the dented recorder "in chapter 25". They move to new 9, new 5, new 13 and new 16.
24. **No chapter now refers to a mission or place that no longer exists**, once the changes in section 4 are made. The remaining places are Varda Rim and its islands, the farm airfield, the pass, the Teklan orchard, the fuel works, Iron Coast, the relay ridges (Kiro, Lira, Merel), the saddle, the crown station, the city and the parliament.

## 4. Text changes for a later PR

Story chapters (`RelayStory.ts`), in new order:

1. New 0: rewrite the last trainee line for a practice flight; e.g. "An empty chair and a checkout nobody's signing. Fine. I'll fly the pattern."
2. New 1: "bandits" becomes "bombers" in Sera's first line.
3. New 1: the manifest line adds a farm with a runway as the first destination and keeps the Iron Coast quays as the second.
4. New 1: add ch 12's Teal "they call it a farm" beat and Sera's "real houses in that yard" beat.
5. New 2: merge ch 2's beacons, receiver and Sundays beats into ch 3; "canyon" and "switchback" become "the pass"; mood becomes dawn.
6. New 3: add the courier and its five escorts (from ch 6) as the high flyers guiding the patrols; drop "dust pass" and "storm".
7. New 4: merge ch 5 and ch 8 to eight beats; replace ch 8's opener "The tower is ours again"; mood becomes night; "searching the night approach" becomes the fuel works.
8. New 5: build from ch 9's recorder, chain and board beats plus ch 18's cranes, fish-market and workers beats; Iron Coast named as the harbour.
9. New 5: reframe "Break one link and listen to who screams" so the harbour is hit first.
10. New 6: add ch 9's Kiro archive beat and ch 2's "the way you take when you don't want to be seen" beat to ch 10; mood becomes dusk.
11. New 7: replace "the mobile crew has it on tape" with Varda's island transmitter; add ch 7's "I'm staying in the tower" and "Keep the lights on, Sera" beats.
12. New 8: open with ch 15's "Three garrisons heard it. Two stood down."; add Teal's storm line from ch 15.
13. New 8: the frigates carry the stood-down garrisons ashore; "Rusk forgot" becomes "the Marshal forgot"; drop "too" from the ceremony line; drop "his convoy can't refuel".
14. New 9: start at "And then the Marshal answered"; drop the storm-fuel radio line; the Marshal's answer includes the river line.
15. New 10: combine ch 11's kitchen beat and slow-escort beat (truck becomes airliner) with ch 13's checkride, handwriting and "fly his checkride" beats; drop "the staging raid exposed".
16. New 11: ch 17's Vulture Two, Teal and Sera challenge beats plus ch 13's "the antennas up there are his"; searchlights and night become daylight over the crater; mood becomes day.
17. New 12: open with ch 18's ejection and confession beats ("off the ridge" becomes "out of the crater"); Vulture Two points at the archive without naming Rusk.
18. New 12: ch 19's boat becomes a slow evidence plane; "harbour mouth sealed by the eastern wing" becomes jammers in the ravine; "the archive" leaves the list.
19. New 13: replace "His plateau fuel is gone" with a line about the broken river line; the crown station is on the ice coast.
20. New 14: open with ch 17's ORDER 0001 log beat and Sera's wing-ceremony beat, then ch 20; "The launch is clear" becomes the evidence plane.
21. New 15: add ch 21's Rusk own-name beat, Sera's "first time he's used his own name" beat and the trainee's answer; landing craft become a column; parliament comes "home by road".
22. New 16: Sera's last radio beat points at the capital's bridges and quay and says Rusk is flying with his own wing of five tonight; e.g. "He's flying with his wing himself tonight. Five of them, over the bridges."
23. New 17: keep "The wing is broken" and "alone up there with one relay and his own voice"; "above the parliament tower" becomes his relay works on the coast; scene becomes the relay works and mood becomes storm.
24. New 17: Rusk's offer stays live, in his own voice, and the trainee's answer stays. "Mark a clear road for Rusk before the duel" becomes the order of the fight; e.g. "Break the works first. When his voice stops, he'll come up to meet you alone."
25. New 18 (finale): no change needed. "He's down. His relay is dark." now matches the duel exactly.
26. The RUSK speaker-label comment changes from "chapter 17 on" to "new chapter 14 on".

Story documents (`StoryDocuments.ts`):

27. Manifest (new 1): add the farm airstrip line; keep the quays.
28. Courier intercept (today's ch 6, now new 3): "DUST PASS 1900" becomes a high-altitude route.
29. Tower orders (ch 7) and mobile transmitter (ch 11): drop both documents.
30. Staging farm (ch 12): drop the document, or merge its "ANIMALS: 0" line into new 1's manifest.
31. Military quays survey (ch 18): moves to new 5.
32. ORDER 0001 (ch 17): moves to new 14.
33. Offshore platform (ch 22): rewrite as the landing frigates and drop "CONVOY FUEL: NONE".
34. Storm platform (ch 23): drop.
35. Last transmission fix (ch 26): "BEARING: PARLIAMENT TWR" becomes the coastal relay works; "VOICE: HIS OWN" stays, because he is still live.
36. Re-key every remaining document to its new chapter number.

Briefings, debriefs and other text:

37. Write new briefing, debrief and failure text for the practice flight and missions 1 to 18 from section 2b, replacing today's 27 mission texts.
38. Each debrief ends on the thread its next chapter picks up (for example, M1's debrief hands over the sealed case, and M17's says Rusk left his wing and ran for the coast). M18 has no debrief in the reference; the finale follows the duel.
39. `docs/broken-relay.md`: update the story paragraph's chapter numbers (aurora archive, orchard burning, confession, last recording) and the mission manifest when the new campaign ships.
40. Cutscene cues keyed to chapter numbers (charred farms, the board name strip, the aurora, the dented recorder) move as in conflict 23.

## 5. Owner answers (2026-10-28)

The owner approved the map with these answers. Questions 1 and 5 to 9 take the writer's recommendations.

| # | Question | Answer | Consequence |
|---|---|---|---|
| Q1 | D-013 says 18 chapters. Is that 18 chapters before missions plus the finale (19 in all), or 18 in all? | **18 plus the finale** (recommendation adopted). | 19 chapters in all: one before each of missions 1 to 18 (mission 1's is the opening, played before the practice flight) and the finale after mission 18. |
| Q2 | Where does Rusk fall? The final reference mission has no duel. | **Owner's choice, against the recommendation (fall at mission 17): Rusk survives mission 17 and falls in a one-on-one duel added at the end of mission 18** (D-031). | Rusk leaves his wing at M17 and runs to his relay works. M18 gains a duel phase after the vent run (section 2c). Ch 26 keeps his live offer. M18 departs from the reference by this one added phase. |
| Q3 | Varda Rim moves from a canyon rim to an island headland (mission 1's world, with a carrier start). | **Yes** (recommendation adopted). | Varda Rim is the airbase on mission 1's island headland, the base the bombers are heading for. |
| Q4 | Cut the mobile transmitter truck (ch 11) and broadcast the 35 seconds from Varda's island transmitter at mission 8? | **Yes** (recommendation adopted). | The truck and its document go; the broadcast goes out from Varda while Sera stays in her tower. |
| Q5 | Should mission 12's ring of eight towers be the crown station instead of mission 14's ice coast? | **Keep the crown station at mission 14** (recommendation adopted). | The crown station stands on the ice coast under the aurora; mission 12's ring is the command array Vulture Two guards. |
| Q6 | Cut "The storm platform" (ch 23) and almost all of "Fog fuel" (ch 21)? | **Yes** (recommendation adopted). | Ch 23 is cut; ch 21 survives only as the Rusk-own-name beat and its replies, in new 15. |
| Q7 | Does the practice flight keep today's three live bandits at the end? | **No enemies** (recommendation adopted). | The practice flight is a pure checkout; the bombers in Varda's paint are the first enemy. New 0's last trainee line is rewritten. |
| Q8 | Replays: should the opening play before every practice flight, or only the first time and before mission 1 replays? | **Opening on the first run; a replay reprise before mission 1 only** (recommendation adopted). | Reprises work as they do today. |
| Q9 | Merged chapters take one existing title. Any titles wanted back? | **Keep the titles in section 2a** (recommendation adopted). | No new chapter names are needed. |
