#!/bin/sh
# Regenerate every SKYBREAK upload asset (four Blender processes at a time), then
# the manifest and src/shared/UploadedAssetSpecs.ts. Pass asset names to rebuild a subset.
set -eu
cd "$(dirname "$0")/../.."
mkdir -p build
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
if [ "$#" -gt 0 ]; then
	names="$*"
else
	names="$("$BLENDER" --background --factory-startup --python tools/assets/build.py -- --list 2>/dev/null | sed -n 's/^ASSETS //p')"
fi
for name in $names; do echo "$name"; done | xargs -P "${JOBS:-4}" -n 1 sh -c \
	'"$0" --background --factory-startup --python tools/assets/build.py -- "$1" > "build/asset-$1.log" 2>&1 && grep ASSET_DONE "build/asset-$1.log" || { echo "FAILED $1 (see build/asset-$1.log)"; exit 255; }' "$BLENDER"
python3 tools/assets/write_manifest.py
