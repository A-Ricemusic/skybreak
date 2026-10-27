# PR54 high-speed cast fix

Repro: M1 Normal at 2995 MPH (~599 studs/s) sent a two-second warning
Spherecast direction of 1100–1159 studs, exceeding the engine limit.

WorldRoot documents Spherecast direction <=1024 studs, radius <=256;
Raycast direction <=15000. Verified with the official Studio docs tool:
https://create.roblox.com/docs/reference/engine/classes/WorldRoot

Warning and authoritative collision now share ordered <=1000-stud segments.
The 24-stud margin covers Vector3 float rounding, including diagonals. The
warning retains its full two-second horizon: 1200 studs at 600 studs/s. First
hit wins; warning distance adds completed segment lengths to hit.Distance.
Radius remains 6 for warning and 4 for crash. No speed limit was lowered.
Zero/nonfinite vectors and invalid radii return no hit. Corrupt paths over one
million studs are rejected to bound render work; this is far beyond world size.
Like the engine API, this does not detect an initial overlap.

Both callers retain their existing explicit FlightSolid/Terrain include lists,
excluding the player aircraft, other jets, missiles, invisible roots and overlays.
Warning remains advisory; server collision finishes the mission before other
session events. Server simulation uses fixed 1/30 s steps (20 studs at top speed),
with catch-up bounded to five steps. Long correction/sweep paths are segmented.
Prediction correction does not become a gameplay collision sweep.

Other casts audited: enemy avoidance is 200; scenery grounding 900; actor
grounding 1700. These are raycasts, below 15000. Test-only world rays are <=1500.
Cosmetic wreck rays inherit speed: wreck lifetime is 3.2 s, gravity 110, normal
velocity <=600 plus effects. Expiry now precedes movement/casting after a long
frame; nonfinite/nonpositive dt is ignored. Surviving steps are <3.2 s and stay
well below 15000. Wreck filters exclude client effects and the character.
No other production Spherecast/Blockcast/Shapecast calls exist.

Validation: build passes; pure compiled-domain contracts pass (490). Three
Roblox Jest engine tests passed in existing Edit instance
`d62254c5-b073-4f9a-b016-43ce10e84ce2` using the actual compiled SphereSweep module
and temporary fixture modules, removed afterwards. Covers below/at/above 1024,
600 studs/s, long 3600-stud correction/high-dt equivalent, diagonals, earliest
hit, total distance, reverse travel, invalid radius, zero/nonfinite geometry.
Engine hit at 1143.5 studs gives 1.90583 seconds, beyond the first segment.
The existing place was not replaced or patched for gameplay.

This is engine fixture evidence, not live gameplay acceptance. Fresh exact-build
M1 combat and complete 800/3000 MPH loops, M5 stress, M3/M19 collision/boundary
checks remain for the parent's 5.6 retest. No merge/publish/new Studio/watch.
