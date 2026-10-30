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
| 59 | 2:16:13 | 2:37:51 | 21:38 | mission | 10 | Cockpit start; forested valleys under Stonehenge fire; mid-mission landing/relaunch ~8835-8905; MISSION ACCOMPLISHED ~9465 |
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
| 76 | 3:08:30 | 3:18:42 | 10:12 | mission | 13 | Cockpit start (MISSION START ~11313); fog-bound ravine escort of recon plane; intercept phase ~11745; MISSION ACCOMPLISHED ~11905 |
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

## Mission 14–18 specification pass (2026-10-29)

Source remains GamePlayShare <https://youtu.be/lO7bCwQOYUs>. Mapping checked against D-013, human dashboard and accepted chapter map: reference missions 14, 15, 16, 17 and 18 map directly to SKYBREAK 14–18. No merged/split reference mission in this range. New derived text is in `docs/specs/missions/m14.md`–`m18.md` and companion worlds.

### Acquisition and timestamp precision

Read AGENTS and `skills/video-reference-analysis/SKILL.md` plus extraction instructions before inspection. Reused `/Users/pelicannurse/Projects/test app/reference/ac04/video/proxy-480p.mp4` for navigation; did not fetch the full video. Used brew yt-dlp and `/opt/homebrew/bin/ffmpeg` to cut source sections at 1080p (format 399, AV1, silent video). **No audio listened to.** Subtitle functions alone inform radio notes. Initial M16/M17 exports failed when the disk filled; partial MP4 files lacked moov metadata and were rejected by ffprobe. A subsequent yt-dlp request hit YouTube’s bot check; recovered the exact bounded sections using still-valid media inputs from the original local logs. No replacement source used. Signed URLs stay ignored and are not committed.

| Mission | Local clip (gitignored; may be deleted after findings) | Source start, seconds | Verified duration / raster | SHA-256 |
|---|---|---|---|---|
| M14 | `reference/ac04/clips/tail-11946.mp4` | 11946 | 587.003817 s; 1440×1080; 60000/1001 fps | `4790edb2e7bb46de577ef3272dc3bffbb9165567c275d19d60ad265c9d198986` |
| M15 | `reference/ac04/clips/tail-12656.mp4` | 12656 | 1020.012350 s; 1440×1080; 60000/1001 fps | `7354b5307fb8126b68f7103ba27b95a649539aae479ae9fff74ea9493fb86d88` |
| M16 | `reference/ac04/clips/m16-detail.mp4` | 13744 | 1415.010533 s; 1440×1080; 60000/1001 fps | `38e3d923f8392b494d62d19a7e7c732530370e199da0c5a2c7dc065728f51b5b` |
| M17 | `reference/ac04/clips/m17-detail.mp4` | 15159 | 1230.005967 s; 1440×1080; 60000/1001 fps | `5b35cf37e59f07e9d68b275d7b93025b8f9ffa7191af7977ce0386e41c113bbf` |
| M18 | `reference/ac04/clips/m18-detail.mp4` | 16440 | 787.009800 s; 1440×1080; 60000/1001 fps | `5f23c3cd6413a8da518cce8ea76c65df7e486727fc5290fa3e2af4e833408437` |

All source starts are stream-copy offsets, not forced-keyframe recuts. Native start/control/debrief screens were cross-checked against the continuous proxy. Event times allow ±2 s, coarse overview windows ±5 s. ffprobe metadata alone is not the timestamp verification. 1440×1080 preserves the source’s 4:3 image; the title’s “1080p60” does not make the underlying game typography sharper.

### Actual visual inspection and coverage

Images live under `reference/ac04/frames/m14-m18/mNN/`. `source-SSSSS.png` is a proxy frame at absolute source second; `native-SSSSS.png` is a native frame at the matching clip offset or directly from the same media stream. `core-SSSSS.png` and `timer-SSSSS.png` identify additional bounded checks. Temporary contact sheets/clips can be deleted for disk budget after this record; native selected frames are retained locally for review.

| Mission | Whole-section overview actually opened | Native detail actually opened | Readable full-resolution keys actually opened |
|---|---|---|---|
| 14 | `overview-01–02.jpg`, proxy every 10 s from 3:19:06 through debrief; ignore padded/next-scene tiles beyond 3:28:53 | All `detail-01–09.jpg`, every 2 s across 11946–12533 s | 11946, 11992, 12023, 12531; proxy keys 11977, 11992, 12004, 12023, 12300, 12531 |
| 15 | `overview-01–04.jpg`, proxy every 10 s from 3:30:56 through debrief; next-story tiles are incidental | All `detail-01–15.jpg`, every 2 s across 12656–13676 s | 12711, 12766, 13000, 13300, 13465, 13673; proxy briefing/select/debrief 12711, 12721, 12766, 13673 |
| 16 | `overview-01–05.jpg`, proxy every 10 s across 13744–15159 s; incidental next-title tiles excluded from coverage | All `native-overview-01–08.jpg`, 5 s samples across 13744–15159 s | 13795, 13851, 14000, 14500, 14900, 15157; proxy briefing/select/debrief 13795, 13805, 13851, 15157 |
| 17 | `overview-01–05.jpg`, proxy every 10 s across 15159–16389 s; later-story tiles incidental | All `native-overview-01–07.jpg`, 5 s samples across 15159–16389 s; `elite-01–05.jpg`, 2 s samples across 16059–16389 s | 15220, 15271, 15400, 15600, 16077, 16387; timer crops 16070, 16072, 16074, 16076, 16315 |
| 18 | `overview-01–03.jpg`, proxy every 10 s across 16440–17227 s; later credits incidental | All `detail-01–11.jpg`, every 2 s across 16440–17227 s | 16475, 16525, 16660, 16900, 16960, 17105, 17175, 17210; extra core 17108, 17135, 17165, 17185, 17190; fighter-value at 16710 and final-hud at 17180 |

Extracting contact sheets does not establish inspection. The rows above list images opened with the image-viewing tool. Samples between these frames, other playthroughs, failure screens, hidden spawn/ace rules and difficulty variants were **not** examined. Ground subtype totals in M15–17 remain unreconciled; debrief aggregates do not prove those counts. Proposed world positions are adaptation assumptions with explicit 0.96 studs/m conversion, not measurements from one camera path. No Roblox render, Studio launch or Player verification performed.

### Findings, source-specific

| Mission | Settled debrief / HUD | Inventory and objective observations | Remaining gaps |
|---|---|---|---|
| 14 | 3:28:51: **2,260 / 1,700, S**, objective 7:49.88. Initial HUD 20:00 at 3:20:23. | MISSILE ×16 = 1,700; F-22 ×3 = 360; XB-70 ×1 = 200. Low cruise weapons, separating contacts and last isolated weapon along glacier. Score decomposition implies fifteen 100-point and one 200-point missile kills; not sixteen initial carriers. | Parent/child initial inventory, exact split triggers, optional fighter arrivals and exact rank cuts unknown. |
| 15 | 3:47:53: **4,930 / 2,000, S**, 10:00 + 2:53.28 = 12:53.28. HUD 10:00 at 3:32:46; ~9:49 after bomber update at 3:44:25. | Roster 19 air / 62 ground / 0 naval; kills C-17 7, Ka-50 4, A-10 2, Su-37 1, Tu-160 6, EF-2000 1, **ground 53** = 2,440. Corrected an initial proxy reading of 55 ground kills using native debrief. | Ground subtypes, complete waves/conditions and S cutoff unresolved. |
| 16 | 4:12:37: **7,800 / 3,500, S**, objective 20:00. Initial HUD 20:00 at 3:50:51. | Roster 13 air / 113 ground; kills Tornado 3, A-10 2, F-117 3, AH-64 5, F-2 1, ground 138 = 6,830. More kills than initial roster prove additional enemies existed. | Subtype counts, reinforcement predicates and full possible spawn total unknown. |
| 17 | 4:33:07: **5,040 / 2,100, S**, 12:00 + 3:58.46 = 15:58.46. | Roster 4 air / 34 ground / 4 naval. Debrief: Su-37 5, AH-64 4, F-22 4, F-15 ACTIVE 3, S-37 1, V-22 4, EF-2000 2; ground 55 = 2,530; ships 4 = 580. Timer: 00:01.91 at 4:27:50, 17:59.93 at 4:27:52, 14:01.53 on victory 4:31:55: **18:00 elite reset**. | Ground/hull subtype allocation and full wave schedule unknown. D-031 explicitly replaces the fifth elite kill with Rusk’s withdrawal. |
| 18 | No debrief. Final HUD at 4:46:20: **4,920 / S**, 28:41.13 remaining. | Native roster 3 ground / 3 required, not 23. Three 500-point generators; update shows 29:55.84 at 4:45:05 (30:00 reset); ascending missiles 300, central target 990. Four ascending kills inferred from +1,200; core adds 990. Early fighter HUD 90; 990 pre-generator total implies 11 kills; separate +240 implies ace kill. Reconciliation 990+240+1,500+1,200+990 = 4,920. | These air counts are score inferences, not complete spawn counts. Ascending missiles’ requiredness/failure remains unproved; final core required. Exact S cutoff unknown. Duel is an original D-031 addition with no video counterpart. |

All five mission/world pairs include source observations, explicit unknowns, original adaptation proposals, main baseline `088fbfc` and batch A/B/C gaps. No asset upload or copied reference production art/text is included. Blender upload gate remains mandatory for any future exact exports.

Disk-budget closeout: this worktree stayed below 1 GB during recovery. After recording hashes/findings, removed this task’s full mission clips, failed partials, media download logs and temporary contact sheets; retained small native keyframes/probe metadata under the ignored evidence directory. The shared main-checkout proxy and other agents’ evidence were not modified. Offline validation passed: Luau 730/0, catalog 19/0, Python 122 tests / OK; no Studio or Roblox Player test.
