/**
 * AC04 interface palette and typography. Colours are original tokens chosen to evoke the inspected operational
 * screens (deep navy command base, blue map grid, cyan instrument ink, red hostile marks); they are not
 * sampled from original assets. Fonts are Roblox-bundled families; no original typeface is claimed.
 */
export const AC04Color = {
	/** Command screen base. */
	Base: Color3.fromHex("#030918"),
	/** Map/tactical panel base. */
	Map: Color3.fromHex("#06152D"),
	Grid: Color3.fromHex("#12365C"),
	/** Primary line and label ink on command screens. */
	Ink: Color3.fromHex("#A5DAF0"),
	/** Bright value text. */
	White: Color3.fromHex("#D7EEF3"),
	Muted: Color3.fromHex("#6F93A8"),
	Disabled: Color3.fromHex("#3E5568"),
	/** Focus bar and selected row. */
	Focus: Color3.fromHex("#E8F6FA"),
	Hostile: Color3.fromHex("#D66D83"),
	Friendly: Color3.fromHex("#63BDD9"),
	/** Flight symbology. */
	Flight: Color3.fromHex("#8AE6CA"),
	FlightDim: Color3.fromHex("#4E9C86"),
	Warning: Color3.fromHex("#F2C46D"),
	Danger: Color3.fromHex("#FF6B6B"),
	Shadow: Color3.fromHex("#02060C"),
};

/** Wide technical lettering for commands, headings and tags. */
export const AC04_COMMAND_FONT = Font.fromEnum(Enum.Font.Michroma);
/** Readable body and caption text. */
export const AC04_BODY_FONT = Font.fromEnum(Enum.Font.TitilliumWeb);
/** Tabular numerals for instruments, clocks and scores. */
export const AC04_NUMBER_FONT = new Font("rbxasset://fonts/families/RobotoMono.json", Enum.FontWeight.Medium);

/** Thin instrument rule thickness in pixels. */
export const AC04_LINE = 1;
