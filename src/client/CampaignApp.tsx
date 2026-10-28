import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { ReplicatedStorage } from "@rbxts/services";
import { Remotes } from "../shared/Types";
import { FlightController } from "./FlightController";
import { AC04GameUI } from "./ac04/AC04GameUI";
import { useAC04MenuKeys } from "./ac04/ui/AC04Input";
import { AC04_BODY_FONT, AC04_COMMAND_FONT, AC04Color } from "./ac04/ui/AC04Theme";

/** Connection screen in the AC04 command style; Retry is reachable by keyboard, gamepad and pointer. */
function Connecting({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
	useAC04MenuKeys(failed, (intent) => { if (intent === "confirm") onRetry(); });
	return (
		<screengui ResetOnSpawn={false} IgnoreGuiInset={false}>
			<frame Size={UDim2.fromScale(1, 1)} BackgroundColor3={AC04Color.Base} BorderSizePixel={0}>
				<textlabel BackgroundTransparency={1} FontFace={AC04_COMMAND_FONT} Text="SKYBREAK" TextColor3={AC04Color.White} TextSize={28} TextXAlignment={Enum.TextXAlignment.Left} Position={new UDim2(0.08, 0, 0.3, 0)} Size={new UDim2(0.84, 0, 0, 34)} />
				<frame BackgroundColor3={AC04Color.Ink} BackgroundTransparency={0.35} BorderSizePixel={0} Position={new UDim2(0.08, 0, 0.3, 40)} Size={new UDim2(0.84, 0, 0, 1)} />
				<textlabel BackgroundTransparency={1} FontFace={AC04_BODY_FONT} Text={failed ? "Flight records are not responding. Please try again." : "Connecting to flight records."} TextColor3={failed ? AC04Color.Warning : AC04Color.Ink} TextSize={18} TextWrapped={true} TextXAlignment={Enum.TextXAlignment.Left} Position={new UDim2(0.08, 0, 0.3, 52)} Size={new UDim2(0.84, 0, 0, 48)} />
				{failed && (
					<textbutton AutoButtonColor={false} BackgroundColor3={AC04Color.Focus} BackgroundTransparency={0.05} BorderSizePixel={0} FontFace={AC04_COMMAND_FONT} Text="RETRY" TextColor3={AC04Color.Base} TextSize={15} Position={new UDim2(0.08, 0, 0.3, 112)} Size={UDim2.fromOffset(180, 44)} Event={{ Activated: onRetry }} />
				)}
			</frame>
		</screengui>
	);
}

function CampaignApp({remotes,controller}:{remotes:Remotes;controller:FlightController}) {
	const [request,setRequest]=useState<RemoteFunction>();
	const [attempt,setAttempt]=useState(0), [connectionError,setConnectionError]=useState(false);
	useEffect(()=>{
		let cancelled=false;
		setConnectionError(false);
		task.spawn(()=>{
			const [ok,remote]=pcall(()=>{
				const folder=ReplicatedStorage.WaitForChild("Remotes",15);
				return folder?.WaitForChild("AC04Request",15);
			});
			if(cancelled)return;
			if(ok&&remote?.IsA("RemoteFunction"))setRequest(remote);
			else setConnectionError(true);
		});
		return()=>{cancelled=true;};
	},[attempt]);
	return request ? <AC04GameUI remotes={remotes} requestRemote={request} controller={controller}/> : <Connecting failed={connectionError} onRetry={()=>setAttempt((value)=>value+1)}/>;
}
export function mountCampaignUI(parent:Instance,remotes:Remotes,controller:FlightController){const root=ReactRoblox.createRoot(parent);root.render(<CampaignApp remotes={remotes} controller={controller}/>);return{unmount:()=>root.unmount()};}
