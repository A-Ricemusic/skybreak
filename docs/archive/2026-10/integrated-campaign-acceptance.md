# Integrated campaign acceptance

Gameplay revision: `86b3ce98fe12a7e1e3655fb69f71326513e75ad7` (PR #7 merged). Parent independent Studio run, actual Roblox Jest 171/171 in 12 suites. One continuous fresh slot completed all 27 server-authoritative missions through actual menus and the normal FlightController pilot. No teleport, health, timer, kill, unlock or result overrides. All 28 story chapters recorded all three beats. Slot 1 has 27 completed records; slots 2–4 remain empty.

| Mission | Seconds | Air | Ground | Minimum hull | Evade commands |
|---|---:|---:|---:|---:|---:|
| 01 | 22.051 | 3 | 1 | 100 | 0 |
| 02 | 31.221 | 4 | 5 | 100 | 2 |
| 03 | 31.924 | 4 | 0 | 100 | 0 |
| 04 | 32.378 | 3 | 1 | 100 | 0 |
| 05 | 56.588 | 3 | 0 | 100 | 1 |
| 06 | 35.131 | 2 | 3 | 100 | 0 |
| 07 | 30.439 | 4 | 0 | 100 | 0 |
| 08 | 63.175 | 6 | 0 | 100 | 0 |
| 09 | 36.502 | 4 | 0 | 100 | 1 |
| 10 | 36.968 | 3 | 1 | 100 | 2 |
| 11 | 39.149 | 4 | 2 | 100 | 0 |
| 12 | 67.968 | 4 | 0 | 100 | 1 |
| 13 | 60.176 | 3 | 5 | 100 | 1 |
| 14 | 45.057 | 3 | 3 | 100 | 0 |
| 15 | 51.930 | 7 | 0 | 100 | 2 |
| 16 | 36.627 | 2 | 4 | 100 | 0 |
| 17 | 44.290 | 6 | 1 | 100 | 1 |
| 18 | 38.567 | 4 | 0 | 100 | 1 |
| 19 | 59.483 | 2 | 3 | 100 | 3 |
| 20 | 100.630 | 8 | 0 | 90 | 3 |
| 21 | 50.646 | 4 | 1 | 100 | 3 |
| 22 | 80.427 | 4 | 5 | 100 | 3 |
| 23 | 89.265 | 8 | 0 | 100 | 3 |
| 24 | 48.443 | 3 | 3 | 100 | 1 |
| 25 | 116.022 | 10 | 1 | 100 | 5 |
| 26 | 87.301 | 10 | 0 | 100 | 6 |
| 27 | 76.808 | 4 | 1 | 100 | 2 |

Original screenshots and reports: `build/parent-acceptance/`. Mission 2 initial active-flight capture was missed during a runner timing correction; its completion and story evidence were retained, and a separate replay completed in 37.261 seconds. Its additional screenshot landed during preparation and is labeled accordingly; no parent M2 active-flight image is claimed. Opening story has one original image plus three observed beats; subsequent story capture names are timing-based, while the observer is the authoritative three-beat coverage record. M27 completed image shows the beginning of the finale, not the debrief.

Limitations: unpublished Studio session persistence, not cloud/rejoin validation. Normal-control automation proves feasibility, not physical phone/console input or human difficulty. Screenshots are original gameplay captures, not full-playthrough videos.

## Final replay and cleanup probes

Integrated M12 withheld missile and Evade inputs: genuine protected_lost at47.137 seconds, zero kills/missiles/Evades. Visible Retry and Launch then completed66.903 seconds with8 missile commands,0 Evades,100 hull, protected78.627%. Completion preserved the full campaign records. Final combat folder empty and cinematic absent. Studio Play stopped and only the parent-owned process terminated.

The local gallery is `build/parent-acceptance/gallery.html`; the inline edition uses two original captures per mission plus finale to stay within the renderer size limit. Raw captures remain unmodified. The original test result is `build/jest-results.json`.
