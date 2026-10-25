#!/usr/bin/env bash
# Uploads the built place as the new Published version of the Roblox experience.
# Needs ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, and ROBLOX_PLACE_ID. Run `bun run build:place` first.
set -euo pipefail

: "${ROBLOX_API_KEY:?Set ROBLOX_API_KEY to an Open Cloud key with universe-places write access}"
: "${ROBLOX_UNIVERSE_ID:?Set ROBLOX_UNIVERSE_ID to the experience's universe ID}"
: "${ROBLOX_PLACE_ID:?Set ROBLOX_PLACE_ID to the start place's place ID}"

PLACE_FILE="${1:-build/skybreak.rbxlx}"
if [ ! -f "$PLACE_FILE" ]; then
	echo "Missing $PLACE_FILE. Run bun run build:place first." >&2
	exit 1
fi

RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$RESPONSE_FILE"' EXIT

URL="https://apis.roblox.com/universes/v1/${ROBLOX_UNIVERSE_ID}/places/${ROBLOX_PLACE_ID}/versions?versionType=Published"

curl --silent --show-error --fail-with-body -X POST "$URL" \
	-H "x-api-key: ${ROBLOX_API_KEY}" \
	-H "Content-Type: application/xml" \
	--data-binary "@${PLACE_FILE}" \
	-o "$RESPONSE_FILE"

echo "Published $PLACE_FILE to place ${ROBLOX_PLACE_ID}: $(cat "$RESPONSE_FILE")"
