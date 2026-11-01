# Military ground kit validation — 2026-10-31

- `bun install --frozen-lockfile`: exit 0.
- `bun run build`: exit 0.
- `LUAU_BIN="/Users/pelicannurse/Projects/test app/build/offline-luau/luau" bun run validate:offline`: exit 0 on final rerun; 1,225 offline contracts, 489 module compilations, 203 require-graph nodes and 124 Python tests pass. The two new kit contracts are in both generation and execution lists.
- `Blender --background --factory-startup --python tools/assets/verify_fbx.py`: exit 0, FBX_VERIFY PASS for all 49 asset folders. Each military kit FBX round-trips its names, triangle count, dimensions and four embedded texture maps; all 16 per-folder dependency/preview hashes match.
- `LUAU_BIN=... python3 tools/assets/ground_kit_packet.py`: exit 0; ten complete asset packets, 763 unique typed campaign contacts, 613 matching kit contacts. Packet regeneration checks triangle/texture budgets and existing checklist hashes.
- `bun tools/check-no-react-agent-testing.ts`: exit 0 with newly staged files.

The place build inside validate:offline is a local Rojo artifact; it does not launch Studio or upload. No Studio, Roblox Jest Instance execution, Player playtest, upload or independent safety review was performed. New Instance assembly tests in UploadedAssets.spec.ts compile but remain unexecuted. Creator preview inspection is not independent approval. IDs remain undefined and review status remains pending. Phone performance, imported Roblox orientation and live appearance still require acceptance after separately approved upload.
