import { EvadeRules } from "./EvadeRules";

// Pure state of the EVADE control (touch button, hint and local roll prediction).
// The server owns the charges; the client only reads telemetry. When a server
// without charges answers, `evadeCharges` is absent and the gauge falls back to
// one charge gated by `evadeCooldown`, so the button still works.

/** Charges the server grants per sortie when it reports them. */
export const EVADE_MAX_CHARGES = 3;
/** Seconds the server takes to return one charge (the server's own constant). */
export const EVADE_RECHARGE_SECONDS = EvadeRules.RechargeSeconds;
/** Cooldown of the single-charge (legacy) evade, used to draw its ring. */
export const EVADE_LEGACY_COOLDOWN = 6;

export interface EvadeTelemetry {
	evadeCooldown: number;
	evadeCharges?: number;
	incoming: boolean;
	/** Server says at least one missile can be decoyed now. Absent on older servers. */
	evadeThreat?: boolean;
}

export interface EvadeGauge {
	/** Charges ready now. */
	charges: number;
	/** Pips to draw (1 without server charges). */
	maxCharges: number;
	/** A press now would roll. */
	ready: boolean;
	/** 0–1 progress of the charge currently recharging; 1 when every charge is back. */
	recharge: number;
	/** Seconds until the next charge returns (0 when full). */
	cooldown: number;
	/** Decoyable missile and a charge ready: the button pulses. */
	flash: boolean;
	/** Button caption. */
	label: string;
}

function finite(value: unknown, fallback: number): number {
	return typeIs(value, "number") && value === value && math.abs(value) !== math.huge ? value : fallback;
}

export function evadeGauge(telemetry: EvadeTelemetry): EvadeGauge {
	const cooldown = math.max(0, finite(telemetry.evadeCooldown, 0));
	const reported = telemetry.evadeCharges;
	const charged = typeIs(reported, "number") && finite(reported, -1) >= 0;
	const maxCharges = charged ? EVADE_MAX_CHARGES : 1;
	const charges = charged ? math.clamp(math.floor(reported as number), 0, EVADE_MAX_CHARGES) : cooldown <= 0 ? 1 : 0;
	const period = charged ? EVADE_RECHARGE_SECONDS : EVADE_LEGACY_COOLDOWN;
	const recharge = charges >= maxCharges || cooldown <= 0 ? 1 : math.clamp(1 - cooldown / period, 0, 1);
	// With charges in hand the server reports a positive cooldown only while a roll is still running, and refuses a press then.
	const ready = charges > 0 && (!charged || cooldown <= 0);
	return {
		charges,
		maxCharges,
		ready,
		recharge,
		cooldown: charges >= maxCharges ? 0 : cooldown,
		flash: ready && telemetry.evadeThreat === true,
		label: ready ? "EVADE" : string.format("%d", math.max(1, math.ceil(cooldown))),
	};
}
