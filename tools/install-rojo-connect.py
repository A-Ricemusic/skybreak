"""Package the installed official Rojo client with this project's auto-connect script.

No plugin is downloaded here; install the official client with `rojo plugin install`.
A checksum receipt allows updates only to an unchanged companion installed by this tool.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PLUGINS = Path.home() / "Documents/Roblox/Plugins"
OFFICIAL = PLUGINS / "RojoManagedPlugin.rbxm"
TARGET = PLUGINS / "PhoneGameRojoConnect.rbxm"
RECEIPT = TARGET.with_suffix(".rbxm.sha256")


def check_directory(path):
    for parent in reversed((path, *path.parents)):
        if not stat.S_ISDIR(parent.lstat().st_mode):
            raise RuntimeError(f"Refusing non-directory or symlink plugin path: {parent}")


def read_regular(path):
    # O_NONBLOCK also prevents a substituted FIFO from hanging the installer.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise RuntimeError(f"Refusing non-regular plugin file: {path}")
        with os.fdopen(fd, "rb", closefd=False) as source:
            return source.read()
    finally:
        os.close(fd)


def check_target():
    check_directory(PLUGINS)
    try:
        receipt = read_regular(RECEIPT).decode("ascii").strip()
    except FileNotFoundError:
        receipt = None
    if receipt is not None and not re.fullmatch(r"[0-9a-f]{64}", receipt):
        raise RuntimeError(f"Invalid checksum receipt: {RECEIPT}")
    try:
        installed = read_regular(TARGET)
    except FileNotFoundError:
        return
    if receipt is None or hashlib.sha256(installed).hexdigest() != receipt:
        raise RuntimeError(f"Refusing to overwrite an unrecognized or modified plugin: {TARGET}. "
                           "Move it aside after review before installing.")


def stage_file(path, content):
    # Stage in the destination directory so replacement is atomic on this volume.
    staged = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}-", delete=False) as output:
            staged = Path(output.name)
            output.write(content)
    except BaseException:
        if staged is not None:
            staged.unlink()
        raise
    return staged


def main():
    try:
        check_target()
        official = read_regular(OFFICIAL)
    except FileNotFoundError:
        raise SystemExit("Run `rojo plugin install` first.") from None
    if not official:
        raise RuntimeError(f"Installed official Rojo plugin is empty: {OFFICIAL}")

    with tempfile.TemporaryDirectory(prefix="phone-game-rojo-") as temp:
        work = Path(temp)
        # Build from a snapshot, rather than letting Rojo reopen the installed source.
        snapshot = work / OFFICIAL.name
        snapshot.write_bytes(official)
        project = work / "bridge.project.json"
        project.write_text(json.dumps({
            "name": "PhoneGameRojoConnect",
            "tree": {
                "$className": "Folder",
                "Rojo": {"$path": str(snapshot)},
                "Bootstrap": {"$path": str(ROOT / "tools/rojo-connect.server.luau")},
            },
        }))
        intermediate = work / "bridge.rbxmx"
        subprocess.run(["rojo", "build", str(project), "-o", str(intermediate)],
                       cwd=ROOT, check=True, timeout=120)
        model = ET.parse(intermediate)
        # Use the official client's modules without mounting a second copy of its UI.
        disabled_count = 0
        for item in model.iter("Item"):
            if item.get("class") == "Script" and item.findtext("./Properties/string[@name='Name']") == "Plugin":
                properties = item.find("Properties")
                disabled = properties.find("bool[@name='Disabled']")
                if disabled is None:
                    disabled = ET.SubElement(properties, "bool", {"name": "Disabled"})
                disabled.text = "true"
                disabled_count += 1
        if not disabled_count:
            raise RuntimeError("Official Rojo plugin has no expected Plugin script; refusing installation.")
        model.write(intermediate, encoding="utf-8", xml_declaration=True)
        packaged = work / "package.project.json"
        packaged.write_text(json.dumps({"name": "PhoneGameRojoConnect", "tree": {"$path": str(intermediate)}}))
        built = work / TARGET.name
        subprocess.run(["rojo", "build", str(packaged), "-o", str(built)],
                       cwd=ROOT, check=True, timeout=120)
        content = read_regular(built)
        if not content:
            raise RuntimeError("Rojo built an empty companion plugin; refusing installation.")

        staged = []
        try:
            plugin = stage_file(TARGET, content)
            staged.append(plugin)
            receipt = stage_file(RECEIPT, (hashlib.sha256(content).hexdigest() + "\n").encode("ascii"))
            staged.append(receipt)
            check_target()
            os.replace(plugin, TARGET)
            os.replace(receipt, RECEIPT)
        finally:
            for path in staged:
                path.unlink(missing_ok=True)
        print(f"Installed {TARGET}. Reopen the starter place to connect.")


if __name__ == "__main__":
    main()
