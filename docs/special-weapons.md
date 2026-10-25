# Special weapons: the second slot

Skybreak's primary weapon is the unlimited, regenerating standard missile (8 on the rail, one back every 2.5 s, 55 damage, 2450 m lock envelope). This document covers the **second, equippable slot**: one special weapon or support ability chosen on the briefing screen before a sortie, in the spirit of Ace Combat's special weapons.

## Design goals

- **One choice, made before launch.** The briefing screen shows the current special with a one-line description; tapping cycles through the set. The slot remembers the last choice (saved on the campaign slot, so it survives a rejoin). A fresh slot starts on the Recon Drone.
- **Server-authoritative.** Charges, cooldowns, effect timers, targeting and damage all live on the server (`CombatService`) and in the pure rules module `src/shared/SpecialWeapons.ts`, which is unit-tested. The client only sends `{ action: "Special" }` and renders what the 10 Hz telemetry says.
- **Phone-first HUD.** A second round button beside FIRE (above TGT in the right column; beside TGT on the tiny Studio root), `C` on keyboard, `X` on a gamepad. It shows the weapon's short name plus charges, the cooldown in seconds, or the seconds of effect remaining. Refusals are explained on the weapons line, like FIRE.
- **Spice, not power creep.** Every special has an obvious counterplay or cost so the standard missile stays the workhorse.

## Candidate menu

| Special | Type | Effect | Ammo / cooldown | Counterplay | Status |
| --- | --- | --- | --- | --- | --- |
| **Recon Drone (UAV)** | Support | Marks every live hostile on the HUD for 20 s (glyph on screen, arrow at the edge when off screen). While up, locks build in 0.4 s instead of 0.8 s and the lock envelope grows 35% (3307 m). | 2 charges, no recharge. 25 s cooldown from launch (so a 5 s gap after the drone lands). | Costs a charge for a timed window; aces still notch to break locks. | **Implemented** |
| **Flare Pod** | Defensive | Pops a 2.5 s decoy cloud. Every hostile missile within 1200 m, now or while the cloud lasts, rolls once to be decoyed: standard missiles always bite, ace missiles 65%. No barrel roll, no invulnerability, so the pilot keeps flying their line. | 3 charges, one recharges every 15 s. 1.5 s cooldown. | Ace missiles can see through it; windups in progress still launch. The existing EVADE roll (700 m, 6 s) remains for the ones that get through. | **Implemented** |
| **4AAM Salvo** | Offensive | Fires up to four guided standard-damage missiles at up to four *different* hostiles inside the lock cone at once, no lock time. Current target first, then required targets, then nearest. | 3 salvos, no recharge. 5 s cooldown. | Needs targets in the cone (refused otherwise); one missile per target, so a bandit still needs a second hit; ace flares decoy them like any guided shot. | **Implemented** |
| **XLAA Lance** | Offensive | Heavy long-range missile: the lock envelope grows to 3800 m while equipped, 110 damage (a one-hit kill on any bandit, two on an ace), 950 m/s. | 4 charges, no recharge. 4 s cooldown. | Requires a full lock; ace flares and lock-break notches still work; the standard missile's own envelope is unchanged, so long shots must use the special. | **Implemented** |
| QAAM (high-manoeuvre) | Offensive | Missile with a much tighter turn rate for tail chases. | 6 charges, 3 s cooldown. | Aces' flares; slower than standard. | Later |
| LASM / anti-ship | Offensive | Sea-skimming missile for harbor launches and platforms, big ground damage, no air lock. | 4 charges. | Ground only; long flight time. | Later (needs ground-only guidance) |
| UGB / bombs | Offensive | Gravity-dropped bombs with a 60 m proximity fuse against ground targets; overfly required. | 8 bombs. | Needs a run-in over defended sites. | Later (needs a ballistic projectile path) |
| Rail gun / EML | Offensive | Hitscan beam with charge-up; punishes a steady nose. | 10 shots, 2 s charge. | Must hold aim on a jinking target. | Later |
| ECM jammer | Support | Enemies cannot start a launch windup for 8 s. | 2 charges. | Only delays; aces still manoeuvre. | Later |
| Afterburner boost | Support | Temporary top-speed and turn boost. | 3 charges. | Nothing else happens while boosting. | Later (flight model is shared with client prediction) |
| Repair kit | Support | Restores 30 hull once. | 1 charge. | A lost missile window. | Later |

## Implementation notes

- `src/shared/SpecialWeapons.ts`: catalog, `New/Tick/Activate` state machine, lock range and build time modifiers, salvo targeting, flare decoy chance, missile damage and speed, HUD button state. Tested in `src/tests/SpecialWeapons.spec.ts`.
- `src/server/CombatService.ts`: `session.special` is ticked every fixed step; the `"Special"` combat action (rate-limited like FIRE) runs `activateSpecial`. Salvo and lance missiles are tagged `special` so they are never refunded as standard missiles, and carry their own `damage` and `speed`. The flare cloud is checked once per hostile missile.
- `CampaignService`/`CampaignRepository`: `StartMission` accepts `special`; the chosen kind is stored on the save slot (`special`) and used as the default next time. Unknown kinds are rejected (request) or dropped (storage).
- Client: `FlightController` binds `C` / `ButtonX`, exposes `Special()`, and draws the drone's marks for every hostile model in the mission folder while `specialActive > 0`. `LoadoutPicker.tsx` is the briefing row; `GameUI.tsx` adds the HUD button, status text and hint.
- Telemetry: three numbers (`specialCharges`, `specialCooldown`, `specialActive`) ride the 10 Hz packet; the equipped kind travels on the reliable `HudState`.
