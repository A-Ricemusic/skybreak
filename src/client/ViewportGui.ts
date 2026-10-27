import { GuiService } from "@rbxts/services";

/** Camera viewport pixels -> child Position in a measured GUI parent.
 * AbsolutePosition and WorldToScreenPoint use inset-relative screen coordinates;
 * WorldToViewportPoint does not. Even ScreenInsets.None reports an origin of
 * -GetGuiInset(), not zero. Subtract both origins before normalizing by the
 * rendered parent size. Scale components also work inside a UIScale; HUD scale
 * must never multiply a camera projection or the targeting layer's pixel sizes.
 */
export function viewportPosition(parent: GuiBase2d, x: number, y: number): UDim2 {
	const [inset] = GuiService.GetGuiInset();
	const origin = parent.AbsolutePosition.add(inset);
	const size = parent.AbsoluteSize;
	return UDim2.fromScale((x - origin.X) / math.max(1, size.X), (y - origin.Y) / math.max(1, size.Y));
}

/** A HUD root's rendered origin in camera viewport pixels (keep-outs use these). */
export function viewportOrigin(parent: GuiBase2d): Vector2 {
	const [inset] = GuiService.GetGuiInset();
	return parent.AbsolutePosition.add(inset);
}
