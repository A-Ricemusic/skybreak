// Shared menu palette: deep ink, teal accent, ivory type.
export const C = {
	Ink: Color3.fromRGB(6, 13, 22),
	Panel: Color3.fromRGB(14, 30, 44),
	PanelHot: Color3.fromRGB(26, 54, 72),
	Ivory: Color3.fromRGB(242, 238, 226),
	Muted: Color3.fromRGB(152, 168, 176),
	Faint: Color3.fromRGB(104, 122, 132),
	Accent: Color3.fromRGB(64, 224, 206),
	AccentHot: Color3.fromRGB(128, 242, 228),
	Orange: Color3.fromRGB(255, 150, 84),
	Danger: Color3.fromRGB(255, 84, 76),
};

/** Hex forms for RichText <font color> tags. */
export const HEX = {
	Accent: "#40E0CE",
	Orange: "#FF9654",
	Muted: "#98A8B0",
	Faint: "#687A84",
};

/** In-flight HUD: one monochrome green with amber/red for state, drawn over a dark outline for bright sky. */
export const HUD = {
	Green: Color3.fromRGB(108, 255, 176),
	/** Dimmed rows and secondary line work. */
	Dim: Color3.fromRGB(70, 168, 118),
	Amber: Color3.fromRGB(255, 196, 84),
	Red: Color3.fromRGB(255, 82, 82),
	White: Color3.fromRGB(236, 255, 244),
	Shadow: Color3.fromRGB(4, 16, 10),
};

/** Monospaced (tabular) HUD type. */
export const HUD_FONT = new Font("rbxasset://fonts/families/RobotoMono.json", Enum.FontWeight.Medium);
export const HUD_FONT_BOLD = new Font("rbxasset://fonts/families/RobotoMono.json", Enum.FontWeight.Bold);
