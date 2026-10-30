# Cutscene captures, 2026-10-29 (PR "modernize cutscene set dressing")

## Blender set preview (review aid)

`blender-set-preview/`: the four desk props (since approved and uploaded), imported from their exact exported FBX files and seated by their checklist anchors around a plain desk stand-in. Rendered by `tools/assets/cinematic_set_preview.py` from the cutscene's radio, recorder and wide-shot directions, plus a view of the board's face. These renders are not in-game and not part of any upload. The props were approved and uploaded on 2026-10-30; they have not yet been seen in Studio.

## Studio before/after captures

Not captured in this pass. First, the shared Studio lease was never free for the required continuous 5 minutes between 18:13 and 19:55 local. Other agents held it with a performance benchmark, an EditFile session and a Jest run. The only gap, about 18:39–18:44, closed just before 5 minutes. After the lease finally came free (20:34–20:39), the Studio launched for `bun run test:roblox` opened Roblox's sign-in dialog: Studio is signed out on this Mac, so no script ran and no capture was possible. The test runner closed that Studio itself; no other agent's Studio was touched.

When the lease is free: build `origin/main` after #159 merges (before) and this branch (after). In Play mode (Client), run `capture-helper.luau` (in this folder) to mount `RelayCinematic` for the 18-mission story's chapters 3 (farm, radio shot), 4 (farm night, wide), 8 ("The frigate ring", sea wide), 9 (burned orchard, wide), 10 (relay day, wide), 12 (canyon storm, wide), 13 (relay night with aurora, wide), 18 (city dawn, wide), 2 (canyon, recorder close-up) and 16 ("The last fracture": its first beat is wide; the recovered recorder with its lid open appears in its later recorder or evidence beats). The first beat's shot is what shows about 2 s after mounting. Capture about 2 s after mounting, and store the captures here as `before-chNN.png` and `after-chNN.png`.
