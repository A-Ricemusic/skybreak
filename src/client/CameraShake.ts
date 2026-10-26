import { TweenService, Workspace } from "@rbxts/services";
import { ImpactFeedback } from "../shared/ImpactFeedback";
import { MotionPreference } from "./MotionPreference";

// Client-only impact feel for the flight chase camera. FlightController asks for
// one CameraFrame per render step and layers it over its own follow; nothing here
// touches input, prediction or the server. Trauma (0-1) decays on its own; the
// visible offset is trauma squared, so stacked small hits stay subtle.

/** What the chase camera applies this frame. */
export interface CameraShakeFrame {
	/** Camera-space offset to multiply onto the chase frame. */
	offset: CFrame;
	/** Scales the chase camera's follow rate (hit-stop freezes it briefly). */
	follow: number;
	/** Degrees to add to the field of view (hit-stop punch). */
	fov: number;
}

const IDLE: CameraShakeFrame = { offset: new CFrame(), follow: 1, fov: 0 };
const FLASH_NAME = "SkybreakImpactFlash";

let trauma = 0;
let clock = 0;
/** os.clock() of the latest hit-stop, or -inf. */
let hitStopAt = -math.huge;
let flash: ColorCorrectionEffect | undefined;
let flashTween: Tween | undefined;

function pulseFlash(reduced: boolean): void {
	const camera = Workspace.CurrentCamera;
	if (!camera) return;
	if (!flash || flash.Parent !== camera) {
		flash?.Destroy();
		flash = new Instance("ColorCorrectionEffect");
		flash.Name = FLASH_NAME;
		flash.Parent = camera;
	}
	flashTween?.Cancel();
	// A white pop that drains back to neutral on its own tween, so it never sticks
	// if the sortie ends (and the render loop stops) mid-pulse. Reduced motion keeps a faint one.
	flash.Brightness = reduced ? 0.12 : 0.35;
	flash.Contrast = reduced ? 0.05 : 0.2;
	flash.Saturation = reduced ? -0.1 : -0.45;
	flash.TintColor = new Color3(1, 1, 1);
	flash.Enabled = true;
	flashTween = TweenService.Create(flash, new TweenInfo(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Brightness: 0, Contrast: 0, Saturation: 0 });
	flashTween.Play();
}

export const CameraShake = {
	/** Adds trauma (0-1). ~0.2 is a tap, ~0.6 a heavy hit. Ignored with reduced camera motion. */
	Add(amount: number): void {
		if (MotionPreference.reduced) return;
		trauma = ImpactFeedback.AddTrauma(trauma, amount);
	},

	/** Shake from an explosion at `worldPosition`, scaled by size and distance to the camera. */
	Explosion(worldPosition: Vector3, scale = 1): void {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		CameraShake.Add(ImpactFeedback.ExplosionTrauma(camera.CFrame.Position.sub(worldPosition).Magnitude, scale));
	},

	/** Hull loss from one telemetry update: a small kick, firmer on heavy hits. */
	Damage(hullLost: number): void {
		CameraShake.Add(ImpactFeedback.DamageTrauma(hullLost));
	},

	/**
	 * The ace-kill beat: the chase camera nearly freezes for a moment, the FOV
	 * punches in, and the screen pops white. Purely visual; the jet keeps flying.
	 */
	HitStop(): void {
		const reduced = MotionPreference.reduced;
		if (!reduced) {
			hitStopAt = os.clock();
			trauma = ImpactFeedback.AddTrauma(trauma, 0.35);
		}
		pulseFlash(reduced);
	},

	/** Advances decay and returns this frame's camera adjustments. */
	Step(dt: number): CameraShakeFrame {
		clock += dt;
		trauma = ImpactFeedback.DecayTrauma(trauma, dt);
		const since = os.clock() - hitStopAt;
		const stopping = ImpactFeedback.HitStopActive(since);
		if (trauma <= 0 && !stopping) return IDLE;
		const o = ImpactFeedback.Offset(trauma, clock);
		const beat = stopping ? ImpactFeedback.HitStop(since) : IDLE;
		return {
			offset: new CFrame(o.x, o.y, 0).mul(CFrame.Angles(o.pitch, o.yaw, o.roll)),
			follow: beat.follow,
			fov: beat.fov,
		};
	},

	/** Clears shake, hit-stop and flash (end of sortie). */
	Reset(): void {
		trauma = 0;
		hitStopAt = -math.huge;
		flashTween?.Cancel();
		flashTween = undefined;
		flash?.Destroy();
		flash = undefined;
	},

	/** Current trauma, for tests and diagnostics. */
	GetTrauma(): number {
		return trauma;
	},
};
