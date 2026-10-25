# Embers of Home — Studio campaign QA

Date: 2026-10-24  
Studio place: `build/skybreak.rbxlx`  
Save: slot 1, session persistence (unpublished place)  
Method: normal campaign UI and progression; the Studio-only pilot drives the same
`FlightController` input, targeting, missile, and evade methods as the shipped HUD.
It never writes health, damage, kills, clocks, objectives, unlocks, or outcomes.

## Sequential campaign result

M1 through M27 completed in one continuous slot. Every opening cinematic rendered
before either playing onward or receiving a real Skip button click. Every success
debrief rendered before the outcome screen, and every non-final outcome advanced
through the real Next button. That transition returned to the briefing world,
disposing the old mission before launching the next one. M27 returned to the title,
reopened slot 1 as `COMPLETED · REPLAY`, and exposed all 27 replay buttons.

`HP` is final player health; `min HP` is the observer's minimum. Protected-object
minimum health was 100 in all observed rescue/escort sorties. All listed completions
were independently marked `ResultValid=true` against catalog air/ground totals and
the 600-second deadline.

| M | Result | Time (s) | HP / min HP | Required phase path |
|---:|:---|---:|:---:|:---|
| 01 | complete | 45.60 | 100 / 100 | tutorial_move → tutorial_target → tutorial_missile → tutorial_bandits |
| 02 | complete | 54.57 | 90 / 90 | intercept → warehouses → ace |
| 03 | complete | 19.39 | 100 / 100 | rescue |
| 04 | complete | 27.08 | 100 / 100 | escort |
| 05 | complete | 26.55 | 100 / 100 | intercept |
| 06 | complete | 25.52 | 100 / 100 | strike |
| 07 | complete | 12.80 | 100 / 100 | ace |
| 08 | complete | 36.22 | 100 / 100 | strike |
| 09 | complete | 57.26 | 90 / 90 | intercept → strike → ace |
| 10 | complete | 23.56 | 100 / 100 | intercept |
| 11 | complete | 11.78 | 100 / 100 | strike |
| 12 | complete | 26.18 | 100 / 100 | escort |
| 13 | complete | 23.10 | 100 / 100 | rescue |
| 14 | complete | 23.08 | 100 / 100 | intercept |
| 15 | complete | 15.56 | 100 / 100 | ace |
| 16 | complete | 32.15 | 100 / 100 | escort |
| 17 | complete | 19.55 | 100 / 100 | strike |
| 18 | complete | 59.31 | 100 / 100 | intercept → strike → ace |
| 19 | complete | 12.34 | 100 / 100 | strike |
| 20 | complete | 34.73 | 100 / 100 | strike |
| 21 | complete | 28.43 | 100 / 100 | intercept |
| 22 | complete | 240.01 | 100 / 100 | survive (full 240-second clock, 28 evasions) |
| 23 | complete | 25.43 | 100 / 100 | escort |
| 24 | complete | 10.42 | 100 / 100 | strike |
| 25 | complete | 19.30 | 100 / 100 | elite |
| 26 | complete + replay | 51.08 | 100 / 100 | intercept → strike → ace |
| 27 | complete | 38.91 | 100 / 100 | escort |

## Genuine defect and retry

The first M26 launch failed honestly with Roblox's `Extents are too large` Terrain
error. The drydock used one radius-820 terrain fill. The fix replaces it with five
overlapping radius-460 fills, retaining the authored harbor footprint while keeping
every individual operation within the already live-tested radius-600 bound. The
source-equivalent fix was injected into the running server so the continuous save
could retry without altering progression. M26 then completed (outcome showed four
air and four ground targets) and was replayed from the completed 27-mission selector;
the replay result above includes the full observer record.

## Evidence

Genuine Studio MCP captures include:

- `embers-title-initial`, `embers-m01-briefing`, `embers-m01-opening`
- `embers-m02-briefing-unlocked`, `embers-m02-opening`, `embers-m02-debrief`
- `embers-m09-briefing`, `embers-m09-opening`, `embers-m09-debrief`
- `embers-m18-briefing`, `embers-m18-opening`, `embers-m18-debrief`
- `embers-m22-briefing`
- `embers-m26-hotfix-active`, `embers-m26-outcome`, `embers-m26-replay-selected2`
- `embers-m27-briefing`, `embers-m27-opening`, `embers-m27-finale-debrief`,
  `embers-m27-campaign-complete`
- `embers-full-campaign-replay-menu`, `embers-replay-selector-m26-visible`

Native window video capture was not used because the existing capture path produced
black frames. The MCP images were inspected before being listed here.

## Honest limitations

- The place is unpublished, so this run exercised the documented session-only save
  fallback. DataStore persistence and cross-session restore remain covered by Jest,
  not by this live unpublished session.
- The pilot is deterministic automation at the public controller boundary, not a
  human hand-flying all 27 sorties. It still obeys real lock cones, cooldowns,
  missile travel/damage, enemy attacks, health, objectives, and mission clocks.
- Two early observer clones timed out while an opening/UI transition was still in
  progress. They changed no game state; the affected missions were subsequently
  launched and completed normally.

