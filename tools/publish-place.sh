#!/usr/bin/env bash
# Uploads the built place as the new Published version of the Roblox experience.
# Needs ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, and ROBLOX_PLACE_ID. Run `bun run build:place` first.
set +x
set -euo pipefail

# Fail closed before any POST, including direct invocations outside CI.
python3 "$(dirname "$0")/verify-roblox-target.py"

: "${ROBLOX_API_KEY:?Set ROBLOX_API_KEY to an Open Cloud key with universe-places write access}"
: "${ROBLOX_UNIVERSE_ID:?Set ROBLOX_UNIVERSE_ID to the experience's universe ID}"
: "${ROBLOX_PLACE_ID:?Set ROBLOX_PLACE_ID to the start place's place ID}"

# Reject header injection without putting the key on a command line.
LC_ALL=C
KEY_PATTERN='^[!-~]+$'
if [ "${#ROBLOX_API_KEY}" -gt 8192 ] || ! [[ "$ROBLOX_API_KEY" =~ $KEY_PATTERN ]]; then
    echo "Invalid API key format" >&2
    exit 1
fi

PLACE_FILE="${1:-build/skybreak.rbxlx}"
if [ ! -f "$PLACE_FILE" ]; then
	echo "Missing $PLACE_FILE. Run bun run build:place first." >&2
	exit 1
fi

# Pin the checked bytes for all retries; never POST a mutable build artifact.
PUBLISH_TEMP="$(mktemp -d)"
trap 'rm -rf "$PUBLISH_TEMP"' EXIT
PLACE_SNAPSHOT="$PUBLISH_TEMP/place.rbxlx"
cp "$PLACE_FILE" "$PLACE_SNAPSHOT"
chmod 400 "$PLACE_SNAPSHOT"
# Check the pinned bytes, including voice freshness, before transport.
python3 tools/check-place-voice.py "$PLACE_SNAPSHOT"
git fetch origin main
# CI checkouts are shallow; the HALT baseline needs the previous main tip.
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
	git fetch --deepen=2 origin main
fi

URL="https://apis.roblox.com/universes/v1/${ROBLOX_UNIVERSE_ID}/places/${ROBLOX_PLACE_ID}/versions?versionType=Published"

# Roblox answers 409 "Server is busy" while the place is locked, e.g. by an open Team Create session.
for ATTEMPT in 1 2 3; do
	python3 tools/check-place-assets.py "$PLACE_SNAPSHOT" --publish
	# Header via stdin keeps the key out of curl's argv (visible in ps); fresh stdin per attempt.
	STATUS="$(printf 'x-api-key: %s\n' "$ROBLOX_API_KEY" | curl --disable --silent --show-error --proto "=https" --connect-timeout 10 --max-time 90 -X POST "$URL" \
		-H @- \
		-H "Content-Type: application/xml" \
		--data-binary "@${PLACE_SNAPSHOT}" \
		-o /dev/null -w "%{http_code}")"
	[ "$STATUS" = "409" ] && [ "$ATTEMPT" -lt 3 ] || break
	echo "Roblox is busy (attempt $ATTEMPT); retrying in 60 seconds." >&2
	sleep 60
done

if [ "$STATUS" != "200" ]; then
	echo "Publish failed with HTTP $STATUS" >&2
	exit 1
fi

echo "Published $PLACE_FILE to place ${ROBLOX_PLACE_ID}"
