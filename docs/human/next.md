# Next

M11 next: independently review D-444's91-health pressure fix, then flight-test altitude transitions/fairness after prerequisites merge. Release assertions and voice inventory findings remain integration work; they are outside this correction.

Updated 2026-10-30 against main `ea0045d`: missions 1–7 and D1–D6 merged. Merged gameplay is live by pipeline convention; no Player observation is claimed.

1. Review/merge dependencies #184 (D7), #183 (M08), #185 (M09), #187 (M10), then rebase M11. Do not merge M11 before them. D7 remains in re-review.
2. Review M11 HIGH CROSSING: data, runtime actor adoption and warning integration, sequential unlock and authoritative settlement. Offline verification does not establish rendered quality.
3. Under the orchestrator's single Studio lease, run the authored Jest tests and fly M11; compare the reference views in both specs, inspect load/clear time and phone HUD, then obtain owner acceptance.
4. Implement M12–M18 using their specs and dormant worlds.

## Mission 11 beta guide — HIGH CROSSING (In review, not live)

After the dependencies merge, complete mission 10 and launch 11. The remapped Broken Relay chapter 10 reveals the checkride handwriting before takeoff. Briefing/radio remain original and subtitle-only.

- Protect ORCHARD ONE at Y2,800 and ORCHARD TWO at Y900. Both must reach the northern exit around 313.28 seconds before the 330-second expiry. Either civilian loss, player destruction/crash, or expiry fails. Killing every fighter is unnecessary.
- Intercept high groups at 0/55 seconds, low groups at 110/170, and the final high group at 230. Seventeen ordinary attackers plus optional RIME at 250 exceed the reference eleven. Six concurrent hostile slots; no patrol/route traffic consumes them. Two allied escorts share one uncredited kill for the entire sortie.
- Verify distinct cyan identities/health, high/low callsigns, a callsign-specific missile-lock radio warning and INCOMING on the protected marker during attack windup, followed by independent damage warnings. TGT must never select civilians, and player weapons must not harm them.
- Use the regenerating missile rack, selected special and 1,200 gun rounds. Check C/B/A/S at 120/240/360/780; all available contacts total 1,260. Civilian progress/health pays no points. The ace is optional; do not abandon a threatened airliner for rank.
- Verify all-safe completion without killing remaining attackers, each independent loss, timeout, pause, replay, cleanup, save/reload and single-credit scoring. Reject launch with missing M10 or any earlier completion, including forged later records. M12 stays locked.

Analytical Normal pressure coverage allows a 60-second initial intercept, ten seconds per ordinary kill and two 25-second band transitions, excludes gun/specials, and checks rack supply and a pessimistic shared-gate damage burst. It is a tuning bound, not proof of flight feel. Runtime Jest, Studio/Player/phone tests and reference comparison remain pending; this agent is forbidden from launching Studio or running `test:roblox`. No audio or Blender uploads.
