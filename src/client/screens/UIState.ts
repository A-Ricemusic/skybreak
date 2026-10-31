import type { Remotes } from "../../shared/Types";
import type { Rectangle } from "../../shared/UILayout";
import type { FlightController } from "../FlightController";

const MENU_SCREEN_FRAMES = { title: "TitleScreen", slots: "CampaignScreen", briefing: "BriefingScreen", outcome: "OutcomeScreen", cinematic: "CinematicScreen" };

type Screen = "title" | "slots" | "briefing" | "loading" | "mission" | "outcome" | "cinematic";
// The loading overlay is opaque; the camera simply holds its last frame underneath it.
const NO_MENU_CAMERA: ReadonlySet<Screen> = new Set<Screen>(["mission", "cinematic", "loading"]);
// If "Started" never follows "Loading" (server holds for at most ~8 s), fall back to the briefing.
const LOADING_CLIENT_TIMEOUT = 20;
const MISSION_END_HOLD = 1.2;

interface ToastState {
	message: string;
	isError: boolean;
}


interface KillNotice {
	kills: number;
	total: number;
	until: number;
}


interface RadioNotice {
	text: string;
	until: number;
}

/** Seconds a refused FIRE reason stays up. */
const FIRE_DENIED_SECONDS = 1;
const FIRE_DENIED_TEXT: { [reason: string]: string } = {
	no_ammo: "NO MISSILES · RELOADING", cooldown: "LAUNCHER CYCLING", blind: "NO LOCK · FIRING BLIND",
	missiles_spent: "MISSILES EXPENDED", gun_empty: "GUN EMPTY",
	special_empty: "SPECIAL EXPENDED", special_cooldown: "SPECIAL CYCLING", special_active: "DRONE ALREADY UP", special_no_target: "SPECIAL · NO TARGET IN CONE",
};

interface GameUIProps {
	remotes: Remotes;
	controller: FlightController;
}

export { FIRE_DENIED_SECONDS, FIRE_DENIED_TEXT, LOADING_CLIENT_TIMEOUT, MENU_SCREEN_FRAMES, MISSION_END_HOLD, NO_MENU_CAMERA };
export type { GameUIProps, KillNotice, RadioNotice, Screen, ToastState };
