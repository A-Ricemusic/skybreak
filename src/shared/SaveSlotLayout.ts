/** 84px copy/activation lane, then an independent 44px action lane and 4px inset. */
export function getSaveSlotRowHeight(occupied: boolean, confirming: boolean): number {
	return occupied || confirming ? 132 : 84;
}
