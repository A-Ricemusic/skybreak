#!/usr/bin/env python3
"""Validate configured target without printing configured IDs or credentials."""
import os

OFFICIAL_PLACE = "112911685457826"
OFFICIAL_UNIVERSE = "10772984313"


def validate_target():
    place_matches = os.environ.get("ROBLOX_PLACE_ID") == OFFICIAL_PLACE
    universe_matches = os.environ.get("ROBLOX_UNIVERSE_ID") == OFFICIAL_UNIVERSE
    print(f"official_place_matches={str(place_matches).lower()}")
    print(f"official_universe_matches={str(universe_matches).lower()}")
    return place_matches and universe_matches


if __name__ == "__main__":
    raise SystemExit(0 if validate_target() else 1)
