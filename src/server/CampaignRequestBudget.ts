export const CAMPAIGN_COMMAND_COOLDOWN = 0.12;

/** Read-only observations must never consume the foreground command budget. */
export class CampaignRequestBudget {
	private foreground = -math.huge;
	private status = -math.huge;
	public accept(now: number, status: boolean): boolean {
		const previous = status ? this.status : this.foreground;
		if (now - previous < (status ? 0.5 : CAMPAIGN_COMMAND_COOLDOWN)) return false;
		if (status) this.status = now;
		else this.foreground = now;
		return true;
	}
}
