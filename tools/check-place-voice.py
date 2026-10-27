#!/usr/bin/env python3
"""Reject missing/stale voice code in an rbxlx before publish. Does not test audio."""
import argparse
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
CLIENT = "StarterPlayer/StarterPlayerScripts/Client"
SHARED = "ReplicatedStorage/Shared"
REQUIRED = {
    f"{CLIENT}": ("LocalScript", "client/init.client.luau"),
    f"{CLIENT}/RelayCinematic": ("ModuleScript", "client/RelayCinematic.luau"),
    f"{CLIENT}/VoicePlayer": ("ModuleScript", "client/VoicePlayer.luau"),
    **{f"{SHARED}/{name}": ("ModuleScript", f"shared/{name}.luau") for name in
       ("RelayStory", "VoiceLines", "VoiceCues", "VoiceBanks", "VoiceReadiness")},
}


def check(place: Path, output: Path = ROOT / "out") -> None:
    inventory = {}

    def visit(parent, prefix=""):
        for item in parent.findall("Item"):
            name = item.findtext("Properties/string[@name='Name']")
            path = f"{prefix}/{name}" if prefix else name
            if path in inventory:
                raise ValueError(f"Duplicate instance path: {path}")
            inventory[path] = item
            visit(item, path)

    visit(ET.parse(place).getroot())
    for path, (kind, relative) in REQUIRED.items():
        item = inventory.get(path)
        if item is None or item.get("class") != kind:
            raise ValueError(f"Missing {kind}: {path}")
        source = item.findtext("Properties/ProtectedString[@name='Source']")
        if source is None:
            source = item.findtext("Properties/string[@name='Source']")
        compiled = (output / relative).read_text()
        if source is None or source.replace("\r\n", "\n") != compiled.replace("\r\n", "\n"):
            raise ValueError(f"Stale packaged source: {path}; rebuild with bun run build:place")
    cinematic = (output / "client/RelayCinematic.luau").read_text()
    if "Voice:Story(" not in cinematic or "VoicePlayer:Play(" not in cinematic:
        raise ValueError("Compiled RelayCinematic has no recorded-dialogue consumer")
    boot = (output / "client/init.client.luau").read_text()
    if "VoicePlayer:Preload()" not in boot:
        raise ValueError("Compiled client has no voice preload")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("place", type=Path)
    args = parser.parse_args()
    try:
        check(args.place)
    except (ValueError, OSError, ET.ParseError) as error:
        parser.exit(1, f"Voice artifact check failed: {error}\n")
    print("Voice artifact check passed: 8 packaged scripts match compiled output; audible playback and experience permissions NOT tested")
