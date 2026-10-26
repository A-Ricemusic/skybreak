// Pure evade rules shared by the server (authoritative) and tests. The mechanic is
// input-agnostic: keyboard F, gamepad B and the touch EVADE button all send the same
// CombatAction "Evade"; only timing decides whether it works.
//
// Evade is a timed skill with three charges. A press spends a charge and opens a short
// decoy window; any hostile missile that is within 450 studs, or in the last 1.2 s of its
// flight, while the window is open is decoyed. Pressing early only wastes the charge.
// Charges come back one at a time, 10 s each.
export interface EvadeState {
	charges: number;
	/** Seconds banked toward the next charge (only while below MaxCharges). */
	recharge: number;
	/** Seconds left in the current decoy window. */
	window: number;
}
const MAX_CHARGES = 3;
const RECHARGE_SECONDS = 10;
const DECOY_RADIUS = 450;
const TAIL_SECONDS = 1.2;
/** The press is honoured for this long so a phone's round trip does not eat the timing. */
const WINDOW_SECONDS = 0.6;

function finite(value: number): boolean { return value === value && math.abs(value) !== math.huge; }

export const EvadeRules = {
	MaxCharges: MAX_CHARGES,
	RechargeSeconds: RECHARGE_SECONDS,
	DecoyRadius: DECOY_RADIUS,
	TailSeconds: TAIL_SECONDS,
	WindowSeconds: WINDOW_SECONDS,
	New(): EvadeState { return { charges: MAX_CHARGES, recharge: 0, window: 0 }; },
	Tick(state: EvadeState, dt: number): void {
		if (!finite(dt) || dt <= 0) return;
		state.window = math.max(0, state.window - dt);
		if (state.charges >= MAX_CHARGES) { state.recharge = 0; return; }
		state.recharge += dt;
		while (state.recharge >= RECHARGE_SECONDS && state.charges < MAX_CHARGES) {
			state.recharge -= RECHARGE_SECONDS;
			state.charges += 1;
		}
		if (state.charges >= MAX_CHARGES) state.recharge = 0;
	},
	/** Spend a charge and open the decoy window. Refused while a roll is still running or with no charge left. */
	Use(state: EvadeState, rolling: boolean): boolean {
		if (rolling || state.charges <= 0) return false;
		state.charges -= 1;
		state.window = WINDOW_SECONDS;
		return true;
	},
	/** Whether the decoy window from the last press is still open. */
	Open(state: EvadeState): boolean { return state.window > 0; },
	/** Does an open window decoy a hostile missile `distance` studs away with `remainingLife` seconds left? */
	Decoys(distance: number, remainingLife: number): boolean {
		return (finite(distance) && distance <= DECOY_RADIUS) || (finite(remainingLife) && remainingLife <= TAIL_SECONDS);
	},
	/**
	 * Seconds until EVADE can be pressed again, for the HUD and the client's roll prediction:
	 * the running roll, else 0 with a charge in hand, else the time to the next charge.
	 */
	Cooldown(state: EvadeState, rollRemaining: number): number {
		if (finite(rollRemaining) && rollRemaining > 0) return rollRemaining;
		if (state.charges > 0) return 0;
		return math.max(0, RECHARGE_SECONDS - state.recharge);
	},
};
