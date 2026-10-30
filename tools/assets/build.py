"""Entry point: build one SKYBREAK upload asset in a fresh Blender process.

    /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
        --python tools/assets/build.py -- <asset-name>

``tools/assets/build-all.sh`` runs every asset, then ``write_manifest.py``.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import skyasset  # noqa: E402
import aircraft  # noqa: E402
import aircraft_v2  # noqa: E402
import cinematic_assets  # noqa: E402
import m01_assets  # noqa: E402
import m04_m05_assets  # noqa: E402
import world  # noqa: E402

BUILDERS = {**aircraft.BUILDERS, **aircraft_v2.BUILDERS, **world.BUILDERS, **m01_assets.BUILDERS, **m04_m05_assets.BUILDERS, **cinematic_assets.BUILDERS}


def main() -> None:
    names = skyasset.args()
    if not names or names == ["--list"]:
        print("ASSETS " + " ".join(BUILDERS))
        return
    for name in names:
        if name not in BUILDERS:
            raise SystemExit(f"Unknown asset {name}; known: {', '.join(BUILDERS)}")
        BUILDERS[name]()


try:
    main()
except Exception:
    import traceback

    traceback.print_exc()
    sys.exit(1)
