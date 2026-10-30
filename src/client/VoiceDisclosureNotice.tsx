import React, { useEffect, useState } from "@rbxts/react";
import { Players } from "@rbxts/services";
import { VOICE_DISCLOSURE, VOICE_NOTICE_ATTRIBUTE } from "../shared/VoiceDisclosure";
import { C } from "./Theme";

/** Passive overlay inside CoreUISafeInsets; never captures touch or gamepad focus. */
export function VoiceDisclosureNotice() {
	const [visible, setVisible] = useState(false);
	useEffect(() => {
		const gui = Players.LocalPlayer.WaitForChild("PlayerGui");
		let timer: thread | undefined;
		const update = () => {
			if (timer) { task.cancel(timer); timer = undefined; }
			const expiresAt = gui.GetAttribute(VOICE_NOTICE_ATTRIBUTE);
			const remaining = typeIs(expiresAt, "number") ? expiresAt - os.clock() : 0;
			setVisible(remaining > 0);
			if (remaining > 0) timer = task.delay(remaining, () => { timer = undefined; setVisible(false); });
		};
		const connection = gui.GetAttributeChangedSignal(VOICE_NOTICE_ATTRIBUTE).Connect(update);
		update();
		return () => { connection.Disconnect(); if (timer) task.cancel(timer); };
	}, []);
	return <textlabel key="FirstVoiceNotice" Visible={visible} Active={false} Selectable={false}
		AnchorPoint={new Vector2(0.5, 0)} Position={new UDim2(0.5, 0, 0, 8)} Size={new UDim2(1, -32, 0, 76)}
		BackgroundColor3={C.Ink} BackgroundTransparency={0.12} BorderSizePixel={0}
		Font={Enum.Font.Gotham} Text={VOICE_DISCLOSURE} TextColor3={C.Ivory} TextSize={14} TextWrapped={true} ZIndex={60}>
		<uisizeconstraint MaxSize={new Vector2(540, 76)} />
		<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />
		<uicorner CornerRadius={new UDim(0, 6)} />
	</textlabel>;
}
