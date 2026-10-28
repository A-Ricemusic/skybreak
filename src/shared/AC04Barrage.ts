/** Tango Line fixed-schedule adaptation of the approximate source firing windows.
 * https://acecombat.wiki.gg/wiki/Tango_Line
 * Original radio-dependent timing delays are not yet modeled. */
export function ac04BarrageState(elapsed: number, escape: boolean): { warning?: number; damaging: boolean } {
	const salvos = escape ? [20, 65, 110, 155, 200, 245, 290, 335, 380, 425, 470, 515, 560] : [300, 705, 1125];
	const warningSeconds = escape ? 10 : 30;
	for (let index = 0; index < salvos.size(); index++) {
		const fire = salvos[index];
		if (elapsed >= fire - warningSeconds && elapsed < fire) return { warning: fire, damaging: false };
		if (elapsed >= fire && elapsed < fire + 10) return { damaging: !(escape && index === 0) };
	}
	return { damaging: false };
}
