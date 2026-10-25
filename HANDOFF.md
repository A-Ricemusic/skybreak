# Broken Relay live QA handoff

- Lease: parent explicitly granted exclusive Studio QA at 1a48ee6ee3e63242fe746287fc35d11849005fe8. Root ledger: `/Users/pelicannurse/Projects/test app/build/studio-lease.json`.
- Worktree/branch: t3-b4a927bc / t3/broken-relay-campaign. PR #7, no merge/watch.
- Prior offline validation: 70 standalone Luau contracts pass; not engine/gameplay evidence.
- Starting actual Roblox Jest now. No production Studio instance launched yet. Initial Studio MCP list empty; no unrelated processes will be stopped.
- Genuine completed missions: none. Story scenes verified: none. All M1–M27 and 28 story scenes remain.
- Evidence directory: `build/relay-live-qa/` (original screenshots, logs, recordings retained).
- Resume: inspect this file, root lease ledger, own process log and Studio identity before any engine operation. Preserve session save state and reports.

## Engine tests

Actual Roblox Jest: 165/165 tests, 10/10 suites passed at 1a48ee6; test Studio PID 42067 was launched by `bun run test:roblox` with quitAfterExecution. Logs copied to build/relay-live-qa/jest-1a48ee6.{log,json}. Production build is build/skybreak.rbxlx.

Production Studio PID 42171, MCP ID 75f62c0f-1aa0-4bba-8d58-6af30b4ee953, exec session 65598. Own production file identity verified Broken Relay / 27 missions; build attribute 1a48ee6. No Rojo server.

## Live sequence start / QA harness corrections

First M1 genuinely completed through tutorial/radar/3 bandits (visible outcome 00:20, AIR3/GROUND1). Driver outcome logging then exposed missing `self` on compiled table methods, so its first result report is incomplete; original screenshot m01-flight.jpg actually shows that debrief. Corrected pilot-only WaitForChild startup and Catalog/Pilot colon bindings; no gameplay source/rules altered. Preserved old report as BrokenRelayQA_StartupAttempt. Replaying M1 through real menu/archive with NoEvade=true to record complete raw result and all opening beats. Production server remains original 1a48ee6 session; own PID42171 / Studio75f62c0f-1aa0-4bba-8d58-6af30b4ee953.

M1 replay fully recorded: 20.494 seconds, AIR3/GROUND1, hull100, EvadeCommands0, real Completed; all three Story_00 beats observed.

M02 {"Phases":{"1":"intercept @ 0.0891994166886434","2":"warehouses @ 12.94053533335682","3":"ace @ 23.137679916690104"},"Phase":"ace","MissileCommands":15,"elapsed":30.77086295839399,"MissionId":2,"kills":4,"saved":true,"StartedAt":438.3372912083287,"persistence":"session","Outcome":"Completed","ResultValid":true,"groundKills":5,"EvadeCommands":2,"Elapsed":30.737347541726194,"LowestHealth":100}

M03 genuinely completed: server console BROKEN_RELAY_REAL_RESULT M03_Attempt1 Completed 32.04164016665891 AIR4/GROUND0; screenshots show route2/3 and native-studio.png shows live final combat; inspected native video frames are debrief only (not flight evidence). QA report Folder was wiped by default avatar respawn on recap, so observer loop did not persist the M3 structured record. Corrected QA-only report parent to persistent PlayerScripts; M1/M2 structured logs already saved. Replaying M3 through archive next to obtain durable report and all three chapter2 observations; no unlock/progress overrides. Full campaign server remains 1a48ee6.

M03 {"Phase":"required_air","Phases":{"1":"route @ 0.0003964583156630397","2":"required_air @ 11.770815124968067"},"MissileCommands":6,"StartedAt":714.2059217916103,"Elapsed":28.270427000010386,"Outcome":"Running","EvadeCommands":0,"MissionId":3,"LowestHealth":100}

M03 {"Phases":{"1":"route @ 0.0003964583156630397","2":"required_air @ 11.770815124968067"},"Phase":"required_air","MissileCommands":8,"elapsed":32.13654262502678,"MissionId":3,"kills":4,"saved":true,"StartedAt":714.2059217916103,"persistence":"session","Outcome":"Completed","ResultValid":true,"groundKills":0,"EvadeCommands":0,"Elapsed":32.071026708348654,"LowestHealth":100}

M04 {"Phases":{"1":"recon @ 0.0003841667203232646","2":"required_ground @ 11.074800750007853","3":"required_air @ 19.275063166744076"},"Phase":"required_air","MissileCommands":8,"elapsed":32.30780495831277,"MissionId":4,"kills":3,"saved":true,"StartedAt":807.0860409582965,"persistence":"session","Outcome":"Completed","ResultValid":true,"groundKills":1,"EvadeCommands":0,"Elapsed":32.274051500018686,"LowestHealth":100}

M05 {"MissileCommands":7,"elapsed":56.581487874966115,"Phase":"escort","kills":3,"Elapsed":56.548062333255075,"Phases":{"1":"escort @ 0.05099608330056071"},"ProtectedHealth":88.7300000000013,"ResultValid":true,"StartedAt":890.7160985833034,"persistence":"session","Outcome":"Completed","saved":true,"groundKills":0,"EvadeCommands":0,"MissionId":5,"LowestHealth":100}

M06 {"Phases":{"1":"tutorial_move @ 0","2":"route @ 0.00019670836627483368","3":"required_ground @ 11.580967458314262","4":"required_air @ 24.582033208338544"},"Phase":"required_air","MissileCommands":10,"elapsed":35.080012208316475,"MissionId":6,"kills":2,"saved":true,"StartedAt":992.545320666628,"persistence":"session","Outcome":"Completed","ResultValid":true,"groundKills":3,"EvadeCommands":0,"Elapsed":34.97971570829395,"LowestHealth":100}

Video validation: m05-escort-native.mov is real 19.985s screen capture, inspected original frames at1/10/18seconds. It contains actual orbit/protected89% gameplay (objective39/55) followed by real debrief. m05-escort-gameplay.mp4 is a real-time crop; original retained. M3 recording is debrief-only and is not claimed as flight proof.

M07 {"Phases":{"1":"route @ 0.00043554173316806555","2":"required_air @ 12.871603583334945"},"Phase":"required_air","MissileCommands":8,"elapsed":30.604259958374314,"MissionId":7,"kills":4,"saved":true,"StartedAt":1071.5080923333298,"persistence":"session","Outcome":"Completed","ResultValid":true,"groundKills":0,"EvadeCommands":0,"Elapsed":30.571170791750774,"LowestHealth":100}
