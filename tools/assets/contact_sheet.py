"""Tile preview PNGs into one review sheet (Blender's bundled numpy, no PIL).

    Blender --background --factory-startup --python tools/assets/contact_sheet.py -- out.png cols a.png b.png ...
"""

import sys

import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1 :]
out, cols, files = argv[0], int(argv[1]), argv[2:]
tile = 384
rows = (len(files) + cols - 1) // cols
sheet = np.ones((rows * tile, cols * tile, 4), dtype=np.float32)
for i, path in enumerate(files):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    ys = (np.arange(tile) * h / tile).astype(int)
    xs = (np.arange(tile) * w / tile).astype(int)
    r, c = divmod(i, cols)
    # Blender pixel rows run bottom-up; sheet rows are filled bottom-up too.
    sheet[(rows - 1 - r) * tile : (rows - r) * tile, c * tile : (c + 1) * tile] = px[ys][:, xs]
result = bpy.data.images.new("sheet", cols * tile, rows * tile, alpha=False)
result.pixels[:] = sheet.ravel()
result.filepath_raw = out
result.file_format = "PNG"
result.save()
