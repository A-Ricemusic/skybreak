#!/usr/bin/env bash
# Uploads the built place as the new Published version of the Roblox experience.
# Needs ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, and ROBLOX_PLACE_ID. Run `bun run build:place` first.
set -euo pipefail

# Fail closed before any POST, including direct invocations outside CI.
python3 "$(dirname "$0")/verify-roblox-target.py"

: "${ROBLOX_API_KEY:?Set ROBLOX_API_KEY to an Open Cloud key with universe-places write access}"
: "${ROBLOX_UNIVERSE_ID:?Set ROBLOX_UNIVERSE_ID to the experience's universe ID}"
: "${ROBLOX_PLACE_ID:?Set ROBLOX_PLACE_ID to the start place's place ID}"

PLACE_FILE="${1:-build/skybreak.rbxlx}"
if [ ! -f "$PLACE_FILE" ]; then
	echo "Missing $PLACE_FILE. Run bun run build:place first." >&2
	exit 1
fi

# Reject stale local artifacts before any upload request. This is not a live audio test.
python3 tools/check-place-voice.py "$PLACE_FILE"

RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$RESPONSE_FILE"' EXIT

URL="https://apis.roblox.com/universes/v1/${ROBLOX_UNIVERSE_ID}/places/${ROBLOX_PLACE_ID}/versions?versionType=Published"

# Roblox answers 409 "Server is busy" while the place is locked, e.g. by an open Team Create session.
for ATTEMPT in 1 2 3; do
	# Header via stdin keeps the key out of curl's argv (visible in ps); fresh stdin per attempt.
	STATUS="$(printf 'x-api-key: %s\n' "$ROBLOX_API_KEY" | curl --silent --show-error -X POST "$URL" \
		-H @- \
		-H "Content-Type: application/xml" \
		--data-binary "@${PLACE_FILE}" \
		-o "$RESPONSE_FILE" -w "%{http_code}")"
	[ "$STATUS" = "409" ] && [ "$ATTEMPT" -lt 3 ] || break
	echo "Roblox is busy (attempt $ATTEMPT); retrying in 60 seconds." >&2
	sleep 60
done

if [ "$STATUS" != "200" ]; then
	echo "Publish failed with HTTP $STATUS: $(cat "$RESPONSE_FILE")" >&2
	exit 1
fi

echo "Published $PLACE_FILE to place ${ROBLOX_PLACE_ID}: $(cat "$RESPONSE_FILE")"
