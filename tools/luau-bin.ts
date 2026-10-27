// Shared lookup for the official standalone Luau CLI used by the offline tools.
// LUAU_BIN overrides the default build/offline-luau/luau. No Studio fallback.
import {existsSync} from "node:fs";
import {resolve} from "node:path";

export const LUAU_BIN=process.env.LUAU_BIN ?? resolve(import.meta.dir,"../build/offline-luau/luau");

/** Returns LUAU_BIN, or throws a clear error when the executable is missing. */
export function requireLuauBin():string{
	if(!existsSync(LUAU_BIN))throw new Error(`Luau CLI not found at ${LUAU_BIN}. Set LUAU_BIN to the official Luau CLI (see docs/broken-relay.md). No Studio fallback will run.`);
	return LUAU_BIN;
}
