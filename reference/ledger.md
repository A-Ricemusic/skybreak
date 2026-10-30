# AC04 reference footage ledger

Internal research ledger for the SKYBREAK campaign redesign. Gitignored; not a human-review doc. Dialogue is paraphrased by function only; mission titles are the original game's, as legible on screen.

## Source and proxy

| Field | Value |
|---|---|
| Source | "Ace Combat 04: Shattered Skies. Full campaign [HD 1080p 60fps]" by GamePlayShare |
| URL | https://www.youtube.com/watch?v=lO7bCwQOYUs |
| Source duration | 17522.38 s (4:52:02) |
| Proxy | `reference/ac04/video/proxy-480p.mp4`, 640x480 (4:3), H.264 29.97 fps + AAC audio, 1,264,610,800 bytes |
| Proxy SHA-256 | `fa9bb126606c64492d39d4611864151702ce651ac4fd2d6c67824923354dd323` |
| Metadata | `reference/ac04/video/source.json` (yt-dlp 2026.10.26, FFmpeg 9.0.2) |
| Ledger date | 2026-10-28 |
| Timestamps | Source seconds of the single continuous proxy (no cuts); h:mm:ss. Boundaries are to ~1 s unless marked. |

The title claims 1080p60, but the retrieved proxy is 640x480 at 29.97 fps. The recording runs straight through: PS2 boot and a disc-loader menu, the game's intro, all 18 missions in order with their briefings, selects, debriefs and story interludes, then the ending and credits. **No MISSION FAILED screens, retries or restarts were seen** at the sampling used (see Coverage). The recording shows no main menu or save screens between missions, so it is probably edited, but edits cannot be proven from frames alone.

### Recurring structure observed (each mission)

1. From M3 on, a mission **title card** (name, in-game date, mission number) on dark blue, ~5 s. M1 and M2 have no title card; their briefings open directly on the ISAF emblem.
2. **Briefing**: ISAF emblem, continent map, then tactical maps with subtitle-style text and data panels, ending on a 'select combat area' 3D terrain view. Grouped under `briefing` with its title card.
3. **Aircraft select** (hangar, stats panel), then **special-weapon select**. Both labelled `aircraft_select`.
4. **Loading card**: mission number, quoted title, objective text, 'NOW LOADING', then 'PRESS START BUTTON' (~10-15 s). Labelled `loading`.
5. **Mission**: from the first in-engine frame after the loading card (some missions open with in-engine intro shots) through the post-MISSION ACCOMPLISHED tail until the cut to black. Mid-mission landings/rearms are counted as mission time.
6. **Debrief**: results table (MISSION nn, points, kills by type, objective times, credits) with an animated route overlay and a one-line summary, ~15-20 s.
7. Optional **story interlude** (`cutscene`): illustrated or live-action narrated stills with subtitles, after M1, M2, M5, M7, M8, M11, M12, M14, M15 and M17.

## Mission table

Aircraft select includes the special-weapon select. Times are h:mm:ss source time; 'Preceding cutscene' means story interlude(s) that directly precede the mission's briefing.

| # | Reference title | Mission start-end | Briefing (incl. title card) | Aircraft + weapon select | Loading card | Debrief | Preceding cutscene | Summary |
|---|---|---|---|---|---|---|---|---|
| 1 | Sitting Duck | 0:06:30-0:11:24 (4.9 min) | 0:05:00-0:05:58 | 0:05:58-0:06:23 | 0:06:23-0:06:30 | 0:11:24-0:11:41 | 0:01:28-0:05:00 | Air intercept over open sea and the coast of an island under overcast daylight, flown in an F-4E. Opens with an in-engine carrier catapult launch and a black quote card before control is handed over. Targets are bombers (results table lists six Tu-95 kills; corrected from the 1080p clip, the 480p read caught the count-up mid-animation) with fighter escorts; MISSION ACCOMPLISHED appears in the cockpit at ~0:11:04. Gameplay ~4.9 min. |
| 2 | Imminent Threat | 0:15:38-0:22:34 (6.9 min) | 0:14:17-0:15:07 | 0:15:07-0:15:28 | 0:15:28-0:15:38 | 0:22:34-0:22:51 | 0:11:41-0:14:17 | Ground strike on an enemy airbase set in farmland under overcast daylight, F-4E with napalm-type bombs (NPB) selected. Targets are parked bombers, hangars and AA guns on the airfield. Ends with MISSION ACCOMPLISHED and an RTB radio call, no landing shown. Gameplay ~6.9 min. |
| 3 | The Northern Eye | 0:26:41-0:34:24 (7.7 min) | 0:25:03-0:26:05 | 0:26:05-0:26:30 | 0:26:30-0:26:41 | 0:34:24-0:34:42 | 0:22:51-0:25:03 | Strike on radar facilities among snowy mountains under a clear blue sky, F-5E. The objective card requires destroying all indicated targets and returning to base; a MISSION UPDATE after the radars fall sends the player home, and a full approach-and-landing sequence (skippable prompt visible) closes the mission. Gameplay ~7.7 min. |
| 4 | Blockade | 0:36:36-0:42:42 (6.1 min) | 0:34:42-0:35:53 | 0:35:53-0:36:27 | 0:36:27-0:36:36 | 0:42:42-0:43:02 | none | High-altitude air intercept above green hills and forest under a blue sky, F-16C with XAGM selected. Targets are large transport/AWACS-type aircraft with fighter escorts (aircraft types read from HUD labels at contact-sheet scale; treat as inferred). Ends with MISSION ACCOMPLISHED and AWACS praise. Gameplay ~6.1 min. |
| 5 | Lifeline | 0:44:42-0:58:13 (13.5 min) | 0:43:02-0:44:15 | 0:44:15-0:44:30 | 0:44:30-0:44:42 | 0:58:13-0:58:43 | none | Night strike on a large oil refinery/petrochemical complex lit by searchlights, F-16C with UGBS (unguided bombs; corrected from the 1080p clip, the 480p read took the carousel's XAGM); score-threshold objective within a time limit. Includes a mid-mission RTB, night landing and relaunch (~0:50:55-0:52:25) and, after the facility is neutralised, a surprise appearance of an elite enemy squadron (~0:56:25) followed by a dogfight. Gameplay ~13.5 min. |
| 6 | Invincible Fleet | 1:03:01-1:20:00 (17.0 min) | 1:01:12-1:02:16 | 1:02:16-1:02:47 | 1:02:47-1:03:01 | 1:20:00-1:20:24 | 0:58:43-1:01:12 | Large daytime strike on a hazy harbour (Comberth Harbor per briefing) against docked warships, submarines, tankers and AA, Mirage 2000 with LASM; score-threshold objective. Includes a mid-mission landing/rearm (~1:08:05-1:09:05). After MISSION ACCOMPLISHED (~1:19:25) an external flyby plays before the results table; no story cutscene follows. Gameplay ~17 min. |
| 7 | Deep Strike | 1:22:13-1:35:49 (13.6 min) | 1:20:24-1:21:28 | 1:21:28-1:22:01 | 1:22:01-1:22:13 | 1:35:49-1:36:04 | none | Low-level strike at sunset across dark desert hills against solar power arrays, Tornado IDS with a bomblet dispenser. Starts alongside large friendly aircraft; a MISSION UPDATE (~1:33:45) warns of long-range artillery and the player drops into a canyon to mask terrain until MISSION ACCOMPLISHED (~1:35:44). Gameplay ~13.6 min. |
| 8 | Shattered Skies | 1:39:16-1:52:39 (13.4 min) | 1:37:34-1:38:36 | 1:38:36-1:39:01 | 1:39:01-1:39:16 | 1:52:39-1:52:57 | 1:36:04-1:37:34 | Large air battle over a tropical island with a rocket launch site, F-14A; score-threshold objective. A bomber wave (B-2 type per HUD) arrives after a MISSION UPDATE (~1:46:25); the rocket visibly launches (~1:51:55) before MISSION ACCOMPLISHED (~1:52:25). Gameplay ~13.4 min. |
| 9 | Operation Bunker Shot | 1:56:14-2:14:14 (18.0 min) | 1:54:17-1:55:27 | 1:55:27-1:56:03 | 1:56:03-1:56:14 | 2:14:14-2:14:29 | 1:52:57-1:54:17 | Support of an amphibious beach landing on a dark, misty mountainous coastline (pillboxes, artillery, AA), F/A-18C with LASM; score-threshold objective. Includes a carrier landing and relaunch (~2:05:35-2:06:35) and an enemy ground-attack aircraft wave after a MISSION UPDATE (~2:07:25). Gameplay ~18 min. |
| 10 | Tango Line | 2:16:13-2:37:51 (21.6 min) | 2:14:29-2:15:36 | 2:15:36-2:16:01 | 2:16:01-2:16:13 | 2:37:51-2:38:12 | none | Clear-day ground attack along a defensive line in green forested mountains and river valleys, Tornado IDS; objective card adds avoiding long-range artillery fire, which forces repeated low-level valley flying. Includes VTOL aircraft, AA and radar targets and a mid-mission landing/relaunch (~2:27:15-2:28:25). Longest mission in the run. Gameplay ~21.6 min. |
| 11 | Escort | 2:39:46-2:45:27 (5.7 min) | 2:38:12-2:39:11 | 2:39:11-2:39:36 | 2:39:36-2:39:46 | 2:45:27-2:45:44 | none | Escort of two civilian airliners through bright overcast skies above snowy peaks, F-15C with XMAA; objective is to protect the civilian aircraft from attacking fighters. Short and purely air-to-air. Gameplay ~5.7 min. |
| 12 | Stonehenge Offensive | 2:48:27-3:04:55 (16.5 min) | 2:46:38-2:47:48 | 2:47:48-2:48:18 | 2:48:18-2:48:27 | 3:04:55-3:05:08 | 2:45:44-2:46:38 | Strike on the giant railgun installation (circular crater with eight gun towers) in arid terrain under a clear sky, F-117A with PGB. Opens with in-engine establishing shots of the guns; includes a mid-mission landing (~2:59:25-3:00:35) and, after the final gun falls, a fight with the elite squadron (~3:02:05) ending with an enemy pilot ejecting. Gameplay ~16.5 min. |
| 13 | Safe Return | 3:08:30-3:18:42 (10.2 min) | 3:06:52-3:07:59 | 3:07:59-3:08:19 | 3:08:19-3:08:30 | 3:18:42-3:19:06 | 3:05:08-3:06:52 | Low-visibility flight through a fog-filled grey ravine, EF-2000; score-threshold objective. Targets include airship-mounted jammers while escorting a friendly reconnaissance aircraft; a MISSION UPDATE (~3:15:45) switches to intercepting enemy fighters. Gameplay ~10.2 min. |
| 14 | Breaking Arrows | 3:20:22-3:28:38 (8.3 min) | 3:19:06-3:19:57 | 3:19:57-3:20:09 | 3:20:09-3:20:22 | 3:28:38-3:28:53 | none | Night intercept over sea ice and glaciers under a green aurora sky, EF-2000 with XLAA. Targets are low-flying cruise missiles (per briefing and radio). The results table is followed by a story interlude. Gameplay ~8.3 min. |
| 15 | Emancipation | 3:32:45-3:47:38 (14.9 min) | 3:30:56-3:32:06 | 3:32:06-3:32:32 | 3:32:32-3:32:45 | 3:47:38-3:47:56 | 3:28:53-3:30:56 | Night liberation battle over a lit city (San Salvacion per briefing) against tanks, helicopters and AA, F-2A with LASM; score-threshold objective. Includes a mid-mission landing with an explicit TAKEOFF / CHANGE WEAPON rearm menu (~3:41:35-3:43:05) and a later MISSION UPDATE about a bomber attack on the city (~3:44:25). Gameplay ~14.9 min. |
| 16 | Whiskey Corridor | 3:50:50-4:12:27 (21.6 min) | 3:49:04-3:50:15 | 3:50:15-3:50:38 | 3:50:38-3:50:50 | 4:12:27-4:12:39 | 3:47:56-3:49:04 | Close air support for an armoured advance across hazy, clear-day desert (crater, bunkers, ruined town), F-2A with LASM; score-threshold objective. Includes a desert-airbase landing and relaunch (~4:00:15-4:01:35); no story cutscene follows. Gameplay ~21.6 min. |
| 17 | Siege of Farbanti | 4:14:30-4:32:17 (17.8 min) | 4:12:39-4:13:48 | 4:13:48-4:14:16 | 4:14:16-4:14:30 | 4:32:50-4:33:09 | none | Large battle over a flooded coastal capital at golden hour with low sun glare (bridges, battleship, tanks, submarine), F-15 ACTIVE with XMAA; score-threshold objective. Includes a dusk landing and relaunch (~4:24:35-4:25:45) and a final fight with five elite enemy fighters (~4:27:55). After MISSION ACCOMPLISHED (~4:31:55) a HUD-less in-engine epilogue plays before the results table. Gameplay ~17.8 min. |
| 18 | Megalith | 4:36:59-4:46:22 (9.4 min) | 4:34:00-4:35:29 | 4:35:29-4:36:49 | 4:36:49-4:36:59 | none (no results table shown) | 4:33:09-4:34:00 | Final assault on a vast grey coastal superweapon structure under stormy overcast, F-22A with XMAA. After an in-engine intro and quote card, the player destroys generators by flying inside narrow missile-port grooves (trench flying with PULL UP warnings), then runs a central silo/vent and exits. Ends with a HUD-less in-engine ending, an ending cutscene and credits; no results table is shown. Gameplay ~9.4 min including the ~40 s intro. |

Title legibility: all 18 titles were read on screen, M1/M2/M9 from full-width 480 px loading-card frames and the rest from title or loading cards on 288 px contact-sheet tiles. None is unconfirmed.

## Full segment ledger

Contiguous from 0:00:00 to 4:52:02.38, with no gaps or overlaps (checked by script). A segment ends where the next begins. Short black frames between screens are folded into the adjacent segment as noted. Bare numbers inside notes (e.g. ~664) are source seconds.

| # | Start | End | Duration (m:ss) | Type | Mission | Note |
|---|---|---|---|---|---|---|
| 1 | 0:00:00 | 0:00:18 | 0:18 | other | - | PS2 boot logo (Sony Computer Entertainment) then disc-loader game list UI and PlayStation 2 logo (recording setup, not game content) |
| 2 | 0:00:18 | 0:00:27 | 0:09 | title | - | "Produced by namco" logo then AC04 PROJECT logo |
| 3 | 0:00:27 | 0:01:24 | 0:57 | cutscene | - | Opening movie: blue quote text on black, gulls over sea, jet, "shattered skies" caption (black 25.7-27.2 precedes) |
| 4 | 0:01:24 | 0:01:28 | 0:04 | title | - | Title screen "ACE COMBAT 04 shattered skies / PRESS START BUTTON" (black 82.2-83.9 precedes) |
| 5 | 0:01:28 | 0:05:00 | 3:32 | cutscene | - | Prologue story interlude: starfall streaks, narrated illustrated stills with subtitles (no main menu observed between title and prologue) |
| 6 | 0:05:00 | 0:05:58 | 0:58 | briefing | 1 | ISAF emblem then Usea map and tactical maps; ends on select-combat-area screen (black 294.0-299.9 folded into prologue) |
| 7 | 0:05:58 | 0:06:23 | 0:25 | aircraft_select | 1 | Hangar aircraft select (F-4E), then special-weapon select |
| 8 | 0:06:23 | 0:06:30 | 0:07 | loading | 1 | Black then mission-objective card "01 ... DESTROY ALL INDICATED TARGETS / NOW LOADING" |
| 9 | 0:06:30 | 0:11:24 | 4:54 | mission | 1 | In-engine carrier-launch intro, then gameplay over sea and coast; MISSION ACCOMPLISHED ~664; gameplay continues to 683 |
| 10 | 0:11:24 | 0:11:41 | 0:17 | debrief | 1 | Results table MISSION 01 with route animation and summary text |
| 11 | 0:11:41 | 0:14:17 | 2:36 | cutscene | 1 | Story interlude (town, uncle, bar) after black 699.4-701.0 |
| 12 | 0:14:17 | 0:15:07 | 0:50 | briefing | 2 | ISAF emblem then maps (Rigley Air Base) |
| 13 | 0:15:07 | 0:15:28 | 0:21 | aircraft_select | 2 | Aircraft (F-4E) and weapon (NPB) select |
| 14 | 0:15:28 | 0:15:38 | 0:10 | loading | 2 | Card "02 ... DESTROY ALL INDICATED TARGETS / NOW LOADING", then PRESS START BUTTON |
| 15 | 0:15:38 | 0:22:34 | 6:56 | mission | 2 | Gameplay (MISSION START caption ~941); farmland airbase; continues to 1353 |
| 16 | 0:22:34 | 0:22:51 | 0:17 | debrief | 2 | Results table MISSION 02 |
| 17 | 0:22:51 | 0:25:03 | 2:12 | cutscene | 2 | Story interlude (pub/cafe, pilots) |
| 18 | 0:25:03 | 0:26:05 | 1:02 | briefing | 3 | Title card "THE NORTHERN EYE" (Mission 03) then briefing maps (black 1497.1-1502.8 folded into cutscene) |
| 19 | 0:26:05 | 0:26:30 | 0:25 | aircraft_select | 3 | Aircraft (F-5E) and weapon select (RCL/UGBS browsed) |
| 20 | 0:26:30 | 0:26:41 | 0:11 | loading | 3 | Card "03 ... destroy all indicated targets and return to base / NOW LOADING", PRESS START BUTTON |
| 21 | 0:26:41 | 0:34:24 | 7:43 | mission | 3 | Gameplay; snowy mountains; RTB and landing; MISSION ACCOMPLISHED shown on runway ~2057-2061 |
| 22 | 0:34:24 | 0:34:42 | 0:18 | debrief | 3 | Results table MISSION 03 (black 2062.5-2063.6 before) |
| 23 | 0:34:42 | 0:35:53 | 1:11 | briefing | 4 | Title card "BLOCKADE" (Mission 04) then briefing (no cutscene after M3) |
| 24 | 0:35:53 | 0:36:27 | 0:34 | aircraft_select | 4 | Aircraft (F-16C) and weapon select (UGBS browsed, XAGM chosen) |
| 25 | 0:36:27 | 0:36:36 | 0:09 | loading | 4 | Card "04 ... DESTROY ALL INDICATED TARGETS / NOW LOADING", PRESS START BUTTON |
| 26 | 0:36:36 | 0:42:42 | 6:06 | mission | 4 | Cockpit start (MISSION START ~2199); high-altitude intercept; continues to 2561 |
| 27 | 0:42:42 | 0:43:02 | 0:20 | debrief | 4 | Results table MISSION 04 |
| 28 | 0:43:02 | 0:44:15 | 1:13 | briefing | 5 | Title card "LIFELINE" (Mission 05) then briefing (no cutscene after M4) |
| 29 | 0:44:15 | 0:44:30 | 0:15 | aircraft_select | 5 | Aircraft (F-16C) and weapon select (XAGM browsed, UGBS taken per the in-flight HUD) |
| 30 | 0:44:30 | 0:44:42 | 0:12 | loading | 5 | Card "05 ... score at least N points within the time limit / NOW LOADING" |
| 31 | 0:44:42 | 0:58:13 | 13:31 | mission | 5 | Night refinery strike; mid-mission RTB, landing and relaunch ~3065-3135; Yellow Squadron appears ~3385 |
| 32 | 0:58:13 | 0:58:43 | 0:30 | debrief | 5 | Results table MISSION 05 (MISSION ACCOMPLISHED shown ~3480-3492 in cockpit) |
| 33 | 0:58:43 | 1:01:12 | 2:29 | cutscene | 5 | Story interlude (runway/freeway, Yellow 13 backstory, bar) |
| 34 | 1:01:12 | 1:02:16 | 1:04 | briefing | 6 | Title card "INVINCIBLE FLEET" (Mission 06) then briefing (black 3668.7-3672.2 folded into cutscene) |
| 35 | 1:02:16 | 1:02:47 | 0:31 | aircraft_select | 6 | Aircraft (Mirage 2000) and weapon (LASM) select |
| 36 | 1:02:47 | 1:03:01 | 0:14 | loading | 6 | Card "06 ... score at least N points ... / NOW LOADING" |
| 37 | 1:03:01 | 1:20:00 | 16:59 | mission | 6 | Harbor strike, daytime; mid-mission landing/rearm ~4085-4145; MISSION ACCOMPLISHED ~4765; post-mission flyby to ~4802 |
| 38 | 1:20:00 | 1:20:24 | 0:24 | debrief | 6 | Results table MISSION 06 (no cutscene follows) |
| 39 | 1:20:24 | 1:21:28 | 1:04 | briefing | 7 | Title card "DEEP STRIKE" (Mission 07) then briefing |
| 40 | 1:21:28 | 1:22:01 | 0:33 | aircraft_select | 7 | Aircraft (Tornado IDS) and weapon select (LASM browsed, BDSP chosen) |
| 41 | 1:22:01 | 1:22:13 | 0:12 | loading | 7 | Card "07 ... DESTROY ALL INDICATED TARGETS / NOW LOADING", PRESS START BUTTON |
| 42 | 1:22:13 | 1:35:49 | 13:36 | mission | 7 | Cockpit start under tanker/transport aircraft; dusk desert and solar plant; Stonehenge fire forces canyon flight ~5625; MISSION ACCOMPLISHED ~5744 |
| 43 | 1:35:49 | 1:36:04 | 0:15 | debrief | 7 | Results table MISSION 07 |
| 44 | 1:36:04 | 1:37:34 | 1:30 | cutscene | 7 | Story interlude (uncle taken away; boy among the enemy pilots) |
| 45 | 1:37:34 | 1:38:36 | 1:02 | briefing | 8 | Title card "SHATTERED SKIES" (Mission 08) then briefing (black 5850.2-5853.7 folded into cutscene) |
| 46 | 1:38:36 | 1:39:01 | 0:25 | aircraft_select | 8 | Aircraft (F-14A) and weapon select (UGBM browsed, XLAA chosen) |
| 47 | 1:39:01 | 1:39:16 | 0:15 | loading | 8 | Card "08 ... score at least N points ... / NOW LOADING", PRESS START BUTTON |
| 48 | 1:39:16 | 1:52:39 | 13:23 | mission | 8 | Cockpit start over ocean (MISSION START ~5959); Comona island launch-site defence; B-2 phase ~6385; rocket launch ~6715; MISSION ACCOMPLISHED ~6745 |
| 49 | 1:52:39 | 1:52:57 | 0:18 | debrief | 8 | Results table MISSION 08 |
| 50 | 1:52:57 | 1:54:17 | 1:20 | cutscene | 8 | Story interlude (girl, bar, Yellow Squadron artwork, clouds) |
| 51 | 1:54:17 | 1:55:27 | 1:10 | briefing | 9 | Title card "OPERATION BUNKER SHOT" (Mission 09) then briefing (black 6862.2-6867.2 inside) |
| 52 | 1:55:27 | 1:56:03 | 0:36 | aircraft_select | 9 | Aircraft (F/A-18C) and weapon select (LASM/XMAA browsed, LASM chosen) |
| 53 | 1:56:03 | 1:56:14 | 0:11 | loading | 9 | Card "09 ... score at least N points ... / NOW LOADING" |
| 54 | 1:56:14 | 2:14:14 | 18:00 | mission | 9 | Night/dusk beach landing support; carrier landing and relaunch ~7535-7595; A-10 phase ~7645; MISSION ACCOMPLISHED ~8015 |
| 55 | 2:14:14 | 2:14:29 | 0:15 | debrief | 9 | Results table MISSION 09 (no cutscene follows) |
| 56 | 2:14:29 | 2:15:36 | 1:07 | briefing | 10 | Title card "TANGO LINE" (Mission 10; mostly faded, seen ~8070-8074), black 8074.4-8078.9, ISAF emblem, briefing |
| 57 | 2:15:36 | 2:16:01 | 0:25 | aircraft_select | 10 | Aircraft (Tornado IDS) and weapon select (LASM browsed, BDSP chosen) |
| 58 | 2:16:01 | 2:16:13 | 0:12 | loading | 10 | Card "10 ... score at least N points within the time limit; avoid Stonehenge's attack / NOW LOADING" |
| 59 | 2:16:13 | 2:37:51 | 21:38 | mission | 10 | Cockpit start; forested valleys under Stonehenge fire; mid-mission landing/relaunch ~8835-8905; clock expiry ~9454; MISSION ACCOMPLISHED by ~9459 |
| 60 | 2:37:51 | 2:38:12 | 0:21 | debrief | 10 | Results table MISSION 10 (no cutscene follows) |
| 61 | 2:38:12 | 2:39:11 | 0:59 | briefing | 11 | Title card "ESCORT" (Mission 11) then briefing |
| 62 | 2:39:11 | 2:39:36 | 0:25 | aircraft_select | 11 | Aircraft (F-15C) and weapon (XMAA) select |
| 63 | 2:39:36 | 2:39:46 | 0:10 | loading | 11 | Card "11 ... ESCORT THE CIVILIAN AIRCRAFT / NOW LOADING", PRESS START BUTTON |
| 64 | 2:39:46 | 2:45:27 | 5:41 | mission | 11 | Cockpit start (MISSION START ~9589); overcast snowy mountains, escort of two airliners; MISSION ACCOMPLISHED ~9905 |
| 65 | 2:45:27 | 2:45:44 | 0:17 | debrief | 11 | Results table MISSION 11 |
| 66 | 2:45:44 | 2:46:38 | 0:54 | cutscene | 11 | Story interlude (cafe, runway sabotage, Stonehenge raid, girl's plane) |
| 67 | 2:46:38 | 2:47:48 | 1:10 | briefing | 12 | Title card "STONEHENGE OFFENSIVE" (Mission 12, ~9998-10004), black 10003.9-10008.9, ISAF emblem, briefing |
| 68 | 2:47:48 | 2:48:18 | 0:30 | aircraft_select | 12 | Aircraft (F-117A) and weapon select (PGB/UGBL browsed, PGB chosen) |
| 69 | 2:48:18 | 2:48:27 | 0:09 | loading | 12 | Card "12 ... DESTROY ALL INDICATED TARGETS / NOW LOADING", PRESS START BUTTON |
| 70 | 2:48:27 | 3:04:55 | 16:28 | mission | 12 | In-engine establishing shots of Stonehenge railguns, then gameplay; mid-mission landing ~10765-10835; Yellow Squadron phase ~10925; MISSION ACCOMPLISHED ~11065 |
| 71 | 3:04:55 | 3:05:08 | 0:13 | debrief | 12 | Results table MISSION 12 |
| 72 | 3:05:08 | 3:06:52 | 1:44 | cutscene | 12 | Story interlude (Yellow 13 and the boy, newspaper about lone fighter, bar, tank convoy) (black 11106.2-11107.8 before) |
| 73 | 3:06:52 | 3:07:59 | 1:07 | briefing | 13 | Title card "SAFE RETURN" (Mission 13, ~11212.5-11217.8), black, ISAF emblem, briefing (black 11208.1-11212.5 folded into cutscene) |
| 74 | 3:07:59 | 3:08:19 | 0:20 | aircraft_select | 13 | Aircraft (EF-2000) and weapon select (UGBM browsed, XLAA chosen) |
| 75 | 3:08:19 | 3:08:30 | 0:11 | loading | 13 | Card "13 ... score at least N points within the time limit ... / NOW LOADING" |
| 76 | 3:08:30 | 3:18:42 | 10:12 | mission | 13 | Cockpit start (MISSION START ~11313); fog-bound ravine escort of recon plane; intercept update ~11736; MISSION ACCOMPLISHED ~11905 |
| 77 | 3:18:42 | 3:19:06 | 0:24 | debrief | 13 | Results table MISSION 13 (no cutscene follows) |
| 78 | 3:19:06 | 3:19:57 | 0:51 | briefing | 14 | Title card "BREAKING ARROWS" (Mission 14, 11946-11951), black 11951.4-11955.8, briefing |
| 79 | 3:19:57 | 3:20:09 | 0:12 | aircraft_select | 14 | Aircraft (EF-2000) and weapon select (XLAA/UGBM browsed, XLAA chosen) |
| 80 | 3:20:09 | 3:20:22 | 0:13 | loading | 14 | Card "14 ... DESTROY ALL INDICATED TARGETS / NOW LOADING" |
| 81 | 3:20:22 | 3:28:38 | 8:16 | mission | 14 | Cockpit start (MISSION START caption); night, sea ice and glacier, cruise-missile intercept; MISSION ACCOMPLISHED ~12505 |
| 82 | 3:28:38 | 3:28:53 | 0:15 | debrief | 14 | Results table MISSION 14 |
| 83 | 3:28:53 | 3:30:56 | 2:03 | cutscene | 14 | Story interlude (Allies advance; barkeep's daughter plants laser transmitters; Yellow 13 at his jet) |
| 84 | 3:30:56 | 3:32:06 | 1:10 | briefing | 15 | Title card "EMANCIPATION" (Mission 15, 12656-12661), black with small NOW LOADING text 12661-12666, ISAF emblem, briefing (black 12652.9-12655.8 folded into cutscene) |
| 85 | 3:32:06 | 3:32:32 | 0:26 | aircraft_select | 15 | Aircraft (F-2A) and weapon select (LASM/RCL/UGBM browsed, LASM chosen) |
| 86 | 3:32:32 | 3:32:45 | 0:13 | loading | 15 | Card "15 ... score at least N points within the time limit ... / NOW LOADING", PRESS START BUTTON |
| 87 | 3:32:45 | 3:47:38 | 14:53 | mission | 15 | Cockpit start (MISSION START ~12768); night city battle (San Salvacion); mid-mission landing and rearm menu (TAKEOFF / CHANGE WEAPON) ~13295-13385; MISSION ACCOMPLISHED ~13635 |
| 88 | 3:47:38 | 3:47:56 | 0:18 | debrief | 15 | Results table MISSION 15 |
| 89 | 3:47:56 | 3:49:04 | 1:08 | cutscene | 15 | Story interlude (liberation crowds, AA gunners, empty quarters, boy) |
| 90 | 3:49:04 | 3:50:15 | 1:11 | briefing | 16 | Title card "WHISKEY CORRIDOR" (Mission 16), black 13749.6-13753.6, ISAF emblem, briefing (black 13741.3-13744.3 folded into cutscene) |
| 91 | 3:50:15 | 3:50:38 | 0:23 | aircraft_select | 16 | Aircraft (F-2A) and weapon select (RCL browsed, LASM chosen) |
| 92 | 3:50:38 | 3:50:50 | 0:12 | loading | 16 | Card "16 ... score at least N points within the time limit ... / NOW LOADING", PRESS START BUTTON |
| 93 | 3:50:50 | 4:12:27 | 21:37 | mission | 16 | Cockpit/chase start (MISSION START ~13853); desert armoured battle; mid-mission landing/relaunch ~14415-14495; MISSION ACCOMPLISHED ~15135 |
| 94 | 4:12:27 | 4:12:39 | 0:12 | debrief | 16 | Results table MISSION 16 (no cutscene follows) |
| 95 | 4:12:39 | 4:13:48 | 1:09 | briefing | 17 | Title card "SIEGE OF FARBANTI" (Mission 17, 15159-15164), black 15164-15169, ISAF emblem, briefing |
| 96 | 4:13:48 | 4:14:16 | 0:28 | aircraft_select | 17 | Aircraft (F-15 ACTIVE) and weapon select (FAEB browsed, XMAA chosen) |
| 97 | 4:14:16 | 4:14:30 | 0:14 | loading | 17 | Card "17 ... score at least N points within the time limit ... / NOW LOADING", PRESS START BUTTON |
| 98 | 4:14:30 | 4:32:17 | 17:47 | mission | 17 | Cockpit start (MISSION START ~15273); golden-hour flooded capital, bridges; mid-mission landing ~15875-15945; Yellow Squadron phase ~16075; MISSION ACCOMPLISHED ~16315 |
| 99 | 4:32:17 | 4:32:50 | 0:33 | cutscene | 17 | Post-mission in-engine sequence without HUD: aerial views of the city with white subtitles (surrender broadcast, ground reports) (black 16335.8-16337.2 before) |
| 100 | 4:32:50 | 4:33:09 | 0:19 | debrief | 17 | Results table MISSION 17 |
| 101 | 4:33:09 | 4:34:00 | 0:51 | cutscene | 17 | Story interlude (birch forest, handkerchief, end-of-war narration) |
| 102 | 4:34:00 | 4:35:29 | 1:29 | briefing | 18 | Title card "MEGALITH" (Mission 18, 16440-16445), black 16445.3-16450.3, ISAF emblem, briefing incl. classified schematic screens |
| 103 | 4:35:29 | 4:36:49 | 1:20 | aircraft_select | 18 | Aircraft (F-22A) and weapon select (PGB browsed, XMAA chosen) |
| 104 | 4:36:49 | 4:36:59 | 0:10 | loading | 18 | Card "18 ... DESTROY ALL INDICATED TARGETS / NOW LOADING" |
| 105 | 4:36:59 | 4:46:22 | 9:23 | mission | 18 | In-engine intro (Megalith structure, gulls, jet) and black quote card, then gameplay (~16660); generators; trench/groove flying; MISSION UPDATE ~17105; central silo run and exit ~17125-17175 |
| 106 | 4:46:22 | 4:47:07 | 0:45 | cutscene | 18 | In-engine ending without HUD (explosions, AWACS, F-22A, coastline) with white subtitles; no results table/debrief follows |
| 107 | 4:47:07 | 4:47:49 | 0:42 | cutscene | 18 | Ending story interlude (former runway now a highway; narration) (black 17224.0-17227.2 before) |
| 108 | 4:47:49 | 4:51:50 | 4:01 | other | - | Staff credits over animated blue background (black 17258.9-17261.4 and 17263.8-17268.9 before) |
| 109 | 4:51:50 | 4:51:56 | 0:06 | other | - | namco logo, then black |
| 110 | 4:51:56 | 4:52:02.38 | 0:06.38 | cutscene | - | Post-credits text card (one line of white-blue text), then final black 17521.4-17522.38 |

Totals by type (minutes): mission 227.1, cutscene 23.4, briefing 19.8, aircraft_select 8.6, debrief 5.2, other 4.4, loading 3.4, title 0.2. Sum = 17522.38 s.

## Coverage and honesty

**Extracted** (all 480 px wide JPEG, q 5-6; about 85 MB in total outside `video/`):

| Set | Count | Path | Notes |
|---|---|---|---|
| 10 s floor frames | 1,752 | `frames/index/t_SSSSSS.jpg` | Named by true source second (5, 15, ... 17515). See timing note below. |
| Scene-change keyframes (`gt(scene,0.3)`) | 838 | `frames/index/scene_NNNNN.jpg` + `scene_times.csv` | Absolute times parsed from `showinfo`, extracted in four parallel `-ss` chunks with offsets re-added. |
| Black intervals (blackdetect d>=0.25 s) | 193 | `frames/index/black_intervals.csv` | Used to snap boundaries to the second. |
| Silence intervals (-50 dB, >=2 s) | 58 | `frames/index/silence_intervals.csv` | Numeric only; **not used and not listened to**. |
| 1 fps boundary strips | 1,320 (110 x 12) + 96 extra | `frames/boundary/`, `frames/strip2/` | 12 s windows around each approximate boundary. |
| Spot frames | 21 | `frames/detail/d_*.jpg` | Title-card, legibility and end checks. |

**Viewed** (every view was a tiled sheet opened with the image viewer; no JPEG was opened on its own):

- All **59/59 floor contact sheets** (`sheets/floor_001-059.jpg`, 6x5 tiles at 288x216, timestamp on each tile). That puts all 1,752 floor frames in view at tile scale.
- **17 boundary-strip sheets** (`sheets/boundary/bstrip_001-017.jpg`, 1,224 frames at 160x120), **2 corrected strip sheets** (`fix_001-002`, 132 frames) and **1 extra strip sheet** (`extra_001`, 96 frames).
- **5 detail sheets** at 320-480 px per tile (`frames/detail/chk_*.jpg`, 27 frames): intro logos, hidden title cards, Mission 1 legibility, loading cards and the final seconds.
- About **3,230 frame views** in total. Of the **838 scene-change keyframes, none was opened as an image**; only their timestamps were used, together with blackdetect.

**Timing correction (important).** FFmpeg's `fps=1/10` placed the source frame from about label+4.97 s into each slot. This was verified by checksum against `showinfo` for every source frame from 0 to 65 s. The floor frames were therefore renamed to their true times (+5 s) and the contact sheets regenerated. The sanity check of five renamed frames against the source at the named second gave PSNR 31-38 dB, against 11-22 dB at -5 s. All 59 sheets were *read* before this correction, so `notes_sheets.md` keeps the old labels (annotated: add 5 s). Every time in this ledger uses the corrected values. The 1 fps strips start about 0.47 s after their labels.

**Precision.**
- About 1 s: every segment boundary in the full ledger, placed from 1 fps strips plus blackdetect/scene times. Exceptions: the prologue start (0:01:28, inside a 10 s near-black starfield; a skipped menu could hide there), the M10 briefing start (2:14:29, title card already fading, ±2 s), the credits start (±1 s) and the M1 mission start (snapped to the black edge at 390.2 s; frames 386-390 were not strip-viewed).
- About ±5 s (10 s sampling): every in-mission event (MISSION UPDATE, MISSION ACCOMPLISHED, mid-mission landings, enemy-wave arrivals) quoted in notes and summaries.

**Seen only via 10 s contact sheets.** Everything outside the ±6 s strip windows, about 16,100 s (~92 %) of the video, including all mission gameplay interiors, cutscene interiors and most briefing screens. Brief overlays, enemy arrivals, kill counts and radio content between samples were not inspected.

**Not inspected.**
- Audio (no listening, no transcription), so narration delivery, music and SFX are unknown.
- Scene-change keyframe images.
- Any 1080p material (none downloaded).
- Radio and subtitle text beyond what tiles happened to show.

**Uncertainties.**
1. *Edits and retries.* No MISSION FAILED, continue or retry screen appears in any floor frame or strip, and the run looks like a clean single pass. However, 10 s sampling cannot rule out short cuts. The absence of main-menu, save and campaign-menu screens between missions suggests the uploader edited them out.
2. *Names.* Enemy aircraft types, place names (Newfield Is., Rigley Air Base, Comberth Harbor, San Salvacion, Farbanti) and briefing operation names were read from small text at tile scale. Operation names in `notes_sheets.md` marked "?" are unconfirmed. Mission titles are confirmed.
3. *Labelling judgement calls.* Post-ACCOMPLISHED HUD-less in-engine sequences are labelled `cutscene` (M17 epilogue, M18 ending). The short M6 external flyby, which keeps HUD-like framing, and the in-engine mission intros (M1 carrier launch, M12 railgun shots, M18 Megalith intro plus quote card) count as `mission`. Mid-mission landings and rearms count as `mission`. Black gaps are folded into the neighbouring segment. The PS2 boot and disc-loader UI (0:00:00-0:00:18) and the credits are `other`; the namco and AC04 PROJECT logos are `title`; the opening movie and post-credits text card are `cutscene`.
4. *Missing menus.* No main menu or 'new game' screen is visible between the title screen (0:01:24) and the prologue. The `menu` label is therefore unused.
5. *M18 has no debrief.* The game goes straight from the in-engine ending to the ending cutscene and credits. This is observed, but whether the game shows results elsewhere is unknown.

## Notes for Mission 1 spec

| Part | Range (source) | Length | What is there |
|---|---|---|---|
| Preceding intro | 0:00:18-0:05:00 | 4:42 | Logos (0:00:18-0:00:27); opening movie (0:00:27-0:01:24); title screen (0:01:24-0:01:28); narrated prologue in illustrated and photographic stills (0:01:28-0:05:00). |
| Briefing | 0:05:00-0:05:58 | 0:58 | No title card. ISAF emblem, then continent map, then tactical map of an island area with DATE / AREA / OPERATION / COORDINATES / CONDITION panels and subtitle text, then the 'select combat area' terrain view (~0:05:54-0:05:57). |
| Aircraft + weapon select | 0:05:58-0:06:23 | 0:25 | Hangar F-4E with stats panel (~0:05:58-0:06:13); special-weapon screen browsing UGBM/NPB (~0:06:14-0:06:22). The HUD later shows UGBM. |
| Loading card | 0:06:23-0:06:30 | 0:07 | "01 / 'SITTING DUCK' / objective: destroy all indicated targets". |
| Mission | 0:06:30-0:11:24 | 4:54 | In-engine carrier deck launch (~0:06:30-0:06:59), black quote card (~0:07:00-0:07:08), gameplay from ~0:07:10 over sea and an island coast under overcast. Bombers with escorts; MISSION ACCOMPLISHED in cockpit ~0:11:04; tail to 0:11:23. |
| Debrief | 0:11:24-0:11:41 | 0:17 | Results table MISSION 01 (points, kills by type listing Tu-95 x6 (corrected from the 1080p clip; the 480p frame caught the count-up mid-animation), objective time, credits) with animated route overlay and a one-line summary. |
| Following cutscene | 0:11:41-0:14:17 | 2:36 | Story interlude (town, uncle, bar), then M2 briefing. |

**Legibility at 480p** (judged on full-width 480 px frames: `frames/detail/chk_m1legibility_001.jpg`, `chk_cards_001.jpg`):
- Briefing body text, data-panel labels and values, aircraft-select descriptions and stat labels, loading cards, debrief table and radio subtitles are all **legible**.
- On the HUD, the large readouts (GUN / MSSL / special-weapon counts, DMG %, TIME) and speaker tags are **legible**. SPEED and ALT digits, the radar minimap contents, target designator labels, pitch-ladder numbers and the small top-left score/target counter are **marginal to illegible**.
- At contact-sheet tile scale (288 px) only headlines and large captions are readable.

**1080p clips needed** (not downloaded, per instructions; 1080p availability not verified):
1. **0:04:55-0:06:35**: briefing, aircraft and weapon select, and loading card, for exact typography, panel layout, map styling and transition timing.
2. **0:06:25-0:07:40**: carrier launch intro, quote card and first gameplay frames with the full HUD (layout, fonts, small numerals, radar).
3. **0:07:30-0:11:45**: full engagement through MISSION ACCOMPLISHED and the debrief, for enemy arrival timing, target labels and results-table detail. If only one clip is allowed, take **0:04:55-0:11:45** (~6 min 50 s).

### M11/M13 detail evidence — 2026-10-29, specs-m10-m13

Only these mission records are added by this analyst; campaign index coverage above is not upgraded to continuous viewing. Source: GamePlayShare URL above. Existing continuous 640×480 proxy overview10s and gameplay PTS/TGT crops1fps, every generated requested sheet opened; no audio listening. M11 source2:38:12–2:45:44: format299,1440×1080,59.94fps,452.017417s,169186283bytes,SHA256 `ddb5a7bbe0cd473bef0c32056fc42ca39465592452b5dc795f27173531b78c24`. Native frames opened at clip53,94,98,110,185,330,449s; 2fps consecutive sheet373–379s opened (ace chase, not the kill itself). M13 source3:06:52–3:19:06: format299+140,1440×1080,59.94fps,734.050783s,237969827bytes,SHA256 `3198d61544e82788d6a788d80252583c2e1bc05cdc94e955903ba4995272bff7`. Native frames opened at clip43,60,101,104,276,530,731s; 2fps consecutive sheet521–527s opened (mission update appears about3:15:36). Source≈clip+9492s /+11212s respectively, ±1s: first-HUD counters and settled debrief agree with direct proxy seeks. Download cuts used stream copy, no forced keyframes; no subsecond source-accuracy claim.

M11:5:30 clock; two protected airliners; eleven fighter kills;840/S,objective5:13.28 (2:45:41). M13:7:00+15:00 clocks;1300-point threshold;32 jammers×100, two normal F-15E×60 plus one F-15E-class ace×240, two EF-2000×60;3680/S;7:00.00+2:43.96=9:43.96 (3:19:03). Intermediate animated result tables are not final totals. Local readable frames retained under `reference/ac04/frames/m10-m13/`; inspected M11/M13 clips may be removed for disk pressure after this evidence record. Fine map geometry, total deployed optional roster, failure branches, exact rank thresholds and most spawn predicates remain unresolved; see mission specs.

### M12 detail evidence — 2026-10-29, specs-m10-m13

Source2:46:38–3:05:08 retrieved format299 (video only),1440×1080,59.94fps,1110.030267s,499421731bytes; SHA256 `0d26f5889e6a37895944e54c747f8f7c9acf75d5ddd3e7d81b79167c6d35b5ae`. Native frames actually opened: clip67,110,133,250,400,780,910,925,1065,1107s. Opened consecutive2fps sheets at clip891–905(last gun),908–914(update),925–931(arrival; visible subtitle calls five),1065–1067(elite kill). Source≈clip+9998s,±1s, matched select display, HUD and final debrief against direct proxy seeks. Source3:01:33–3:01:34 last gun; update about3:01:38; elite arrival cut-in about3:02:03–3:02:09; elite kill about3:04:23–3:04:24. **Elite clock is10:00**, confirmed by native09:49.91 then07:27.29; small-proxy5:00 interpretation rejected. Settled3:05:05debrief3050/S,1750denominator,24groundkills=2240; Su-37×1=150,R-M01×3=180,F-15E×2=120,F-2×3=360;11:31.11+2:33.07=14:04.18. R-M01 is retained as the readable HUD label rather than misidentified from a small frame. Initial map AIR003,GRND018,TARGET007,TOTAL021; cause of18vs24ground discrepancy unknown. Existing640×480overview10s(4sheets) and1fpsHUD(10sheets) opened; not continuous viewing. Audio not listened to, failures/variants/off-route optional roster unobserved. Full-resolution frames/metadata remain gitignored at `reference/ac04/frames/m10-m13/m12/` and `reference/ac04/clips/`. Earlier downloads failed on disk pressure; only this completed export is used.

### M10 detail evidence — 2026-10-29, specs-m10-m13

Source2:14:29–2:38:12 retrieved format299(video only),1440×1080,59.94fps,1423.065917s,698112732bytes; SHA256 `e96c2b3e8253117174b3d4790e204bb4ce45e4dfa7bfab4b393601230539bb44`. Native frames actually opened: clip61,106,160,350,520,780,1000,1136,1250,1292,1380,1390,1396,1419s; enlarged native debrief ground/naval-count crop opened. Opened2fps consecutive sheets clip390–396(artillery descent instruction and low valleys),1134–1140(named ace kill). Source≈clip+8069s,±1s; select map, first clock and ace PTS jump match direct proxy seeks. Initial headingNW,ALT2000ft,SPEED486;20:00strike clock. Map AIR026,GRND100,NAVAL024,TARGET000,TOTAL150 at2:15:30. Named R-M01-class ace+240 about2:33:25; second200-point submarine base about2:36:01. Debrief2:38:08:6190/S,3000minimum,air Mi-24×8=400,F-14×1=60,AV-8B×12=720,CH-47×7=280,C-130×1=100,EF-2000×2=120,R-M01×1=240. Native crop reads **GRND×070**, **SHIP×019**; earlier small-proxy71/10 readings rejected. Ground3010points; naval digits soft,1260reconstructed as6190−1920−3010. Per-type naval/subtarget accounting unresolved. TGT80points visible2:31:09 but label not secure. Objective1/total20:00.00,objective2absent;reward310000+rankbonus70000=380000. Existing640×480overview10s(5sheets) and1fpsHUD(13sheets) opened; not continuous viewing. Audio not listened to; no failed run/alternate route/difficulty inspection. Earlier retrievals were interrupted or failed on disk pressure; this completed clip and its retained native frames are the evidence. Ground/naval per-type totals, exact wave/artillery predicates, scale and rank cuts remain explicitly unresolved in the specs.

M10 ending refinement: native clip1380/source2:37:29 has TIME00:05.10; clip1390/source2:37:39 has TIME00:00.00 and accomplished; clip1396/source2:37:45 retains accomplished. Thus expiry about2:37:34 and victory by2:37:39. These three additional native frames were opened.
