import React from "@rbxts/react";
import type { Rectangle } from "../../shared/UILayout";
import { C } from "../Theme";
import { Corner, Stroke } from "./Primitives";
import type { ToastState } from "./UIState";

function StatusToast({ toast, toastRectangle }: { toast?: ToastState; toastRectangle: Rectangle }) {
	return (
		<>
					{toast !== undefined && (
						<textlabel
							key="StatusToast"
							Position={UDim2.fromOffset(toastRectangle.x, toastRectangle.y)}
							Size={UDim2.fromOffset(toastRectangle.width, toastRectangle.height)}
							BackgroundColor3={C.Ink}
							BackgroundTransparency={0.15}
							BorderSizePixel={0}
							Font={Enum.Font.GothamMedium}
							Text={toast.message}
							TextColor3={toast.isError ? C.Danger : C.Ivory}
							TextSize={12}
							TextWrapped={true}
							TextXAlignment={Enum.TextXAlignment.Center}
							ZIndex={20}
						>
							<Corner />
							<Stroke color={toast.isError ? C.Danger : C.Accent} transparency={0.45} />
							<uipadding PaddingLeft={new UDim(0, 12)} PaddingRight={new UDim(0, 12)} />
						</textlabel>
					)}
		</>
	);
}

export { StatusToast };
