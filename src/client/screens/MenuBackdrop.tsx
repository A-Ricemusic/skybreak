import React from "@rbxts/react";
import { Workspace } from "@rbxts/services";
import { MENU_JET_POSITION } from "../../shared/MenuWorldGeometry";
import { getMenuLayout, getMenuSceneOpening, type MenuLayout } from "../../shared/UILayout";
import { C } from "../Theme";

// Frames the DisplayJet that WorldBuilder parks on the east apron.
const MENU_JET = MENU_JET_POSITION.add(new Vector3(0, 2, 0));
const MENU_EYE_OFFSET = new Vector3(-17, 9, 54);

const MENU_FOV = 50;
const MENU_TAN_HALF_FOV = math.tan(math.rad(MENU_FOV / 2));
let menuCameraViewport: Vector2 | undefined;
let menuCameraSheet = false;
let menuCameraOpening = 0.5;
function setMenuCamera() {
	const camera = Workspace.CurrentCamera;
	if (!camera) return;
	const size = camera.ViewportSize;
	const clock = os.clock();
	const sway = new Vector3(math.sin(clock * 0.11) * 2, math.sin(clock * 0.07) * 0.8, 0);
	let eye = MENU_JET.add(MENU_EYE_OFFSET);
	let focus: Vector3;
	// The layout solver only re-runs when the viewport changes, not every menu frame.
	if (menuCameraViewport !== size) {
		menuCameraViewport = size;
		const layout = getMenuLayout(size.X, size.Y);
		menuCameraSheet = layout.mode === "sheet";
		menuCameraOpening = getMenuSceneOpening(size.X, layout);
	}
	if (menuCameraSheet) {
		eye = MENU_JET.add(MENU_EYE_OFFSET.mul(1.8));
		focus = MENU_JET.sub(new Vector3(0, 20, 0));
	} else {
		// Centre the jet in the open strip right of the panel. A narrow strip
		// (phones) pulls the camera back so the whole aircraft still fits in it.
		const aspect = size.X / math.max(1, size.Y);
		const open = 1 - menuCameraOpening;
		const distance = math.clamp(0.5 / open, 1, 1.45);
		eye = MENU_JET.add(MENU_EYE_OFFSET.mul(distance));
		const screenX = (menuCameraOpening + open * 0.5) * 2 - 1;
		const lateral = screenX * MENU_EYE_OFFSET.Magnitude * distance * MENU_TAN_HALF_FOV * aspect;
		const cameraLeft = MENU_EYE_OFFSET.Cross(Vector3.yAxis).Unit;
		focus = MENU_JET.add(cameraLeft.mul(lateral));
	}
	camera.CameraType = Enum.CameraType.Scriptable;
	camera.CFrame = CFrame.lookAt(eye.add(sway), focus);
	camera.FieldOfView = MENU_FOV;
}

function MenuBackdropImpl({ visible, menu, viewport }: { visible: boolean; menu: MenuLayout; viewport: Vector2 }) {
	const side = menu.mode === "side";
	// Ink sits solidly behind the copy and clears just past the panel edge. The
	// backdrop ignores the safe-area inset, hence the small allowance.
	const opening = getMenuSceneOpening(viewport.X, menu) + 0.03;
	const sheetTop = math.clamp(menu.panel.y / math.max(1, viewport.Y), 0.25, 0.8);
	return (
		<frame key="Backdrop" BackgroundColor3={C.Ink} BackgroundTransparency={0} BorderSizePixel={0} Size={UDim2.fromScale(1, 1)} Visible={visible} ZIndex={0}>
			<uigradient
				Rotation={side ? 0 : 90}
				Transparency={side
					? new NumberSequence([
						new NumberSequenceKeypoint(0, 0.06),
						new NumberSequenceKeypoint(opening * 0.6, 0.12),
						new NumberSequenceKeypoint(opening - 0.04, 0.24),
						new NumberSequenceKeypoint(opening + 0.08, 0.82),
						new NumberSequenceKeypoint(opening + 0.18, 1),
						new NumberSequenceKeypoint(1, 1),
					])
					: new NumberSequence([
						new NumberSequenceKeypoint(0, 1),
						new NumberSequenceKeypoint(sheetTop - 0.2, 1),
						new NumberSequenceKeypoint(sheetTop - 0.05, 0.45),
						new NumberSequenceKeypoint(sheetTop + 0.05, 0.12),
						new NumberSequenceKeypoint(1, 0.04),
					])}
			/>
		</frame>
	);
}

const MenuBackdrop = React.memo(MenuBackdropImpl);

export { MenuBackdrop, setMenuCamera };
