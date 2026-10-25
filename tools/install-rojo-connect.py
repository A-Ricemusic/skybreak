"""Package the installed official Rojo client with this project's auto-connect script."""
import json
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PLUGINS = Path.home() / "Documents/Roblox/Plugins"
OFFICIAL = PLUGINS / "RojoManagedPlugin.rbxm"
if not OFFICIAL.exists():
    raise SystemExit("Run `rojo plugin install` first.")

with tempfile.TemporaryDirectory(prefix="phone-game-rojo-") as temp:
    work = Path(temp)
    project = work / "bridge.project.json"
    project.write_text(json.dumps({
        "name": "PhoneGameRojoConnect",
        "tree": {
            "$className": "Folder",
            "Rojo": {"$path": str(OFFICIAL)},
            "Bootstrap": {"$path": str(ROOT / "tools/rojo-connect.server.luau")},
        },
    }))
    intermediate = work / "bridge.rbxmx"
    subprocess.run(["rojo", "build", str(project), "-o", str(intermediate)], cwd=ROOT, check=True)
    model = ET.parse(intermediate)
    # Use the official client's modules without mounting a second copy of its UI.
    for item in model.iter("Item"):
        if item.get("class") == "Script" and item.findtext("./Properties/string[@name='Name']") == "Plugin":
            properties = item.find("Properties")
            disabled = properties.find("bool[@name='Disabled']")
            if disabled is None:
                disabled = ET.SubElement(properties, "bool", {"name": "Disabled"})
            disabled.text = "true"
    model.write(intermediate, encoding="utf-8", xml_declaration=True)
    packaged = work / "package.project.json"
    packaged.write_text(json.dumps({"name": "PhoneGameRojoConnect", "tree": {"$path": str(intermediate)}}))
    target = PLUGINS / "PhoneGameRojoConnect.rbxm"
    subprocess.run(["rojo", "build", str(packaged), "-o", str(target)], cwd=ROOT, check=True)
    print(f"Installed {target}. Reopen the starter place to connect.")
