export const CAMPAIGN_COMMAND_COOLDOWN = 0.12;
/** DeleteSlot flushes a cloud write each time, so it carries its own cooldown on top of the command budget. */
export const CAMPAIGN_DELETE_COOLDOWN = 1.5;
const STATUS_COOLDOWN = 0.5;

export type CampaignRequestKind = "command" | "status" | "delete";

/** Read-only observations must never consume the foreground command budget. */
export class CampaignRequestBudget {
	private foreground = -math.huge;
	private status = -math.huge;
	private deletion = -math.huge;
	public accept(now: number, kind: CampaignRequestKind): boolean {
		if (kind === "status") {
			if (now - this.status < STATUS_COOLDOWN) return false;
			this.status = now;
			return true;
		}
		if (now - this.foreground < CAMPAIGN_COMMAND_COOLDOWN) return false;
		if (kind === "delete" && now - this.deletion < CAMPAIGN_DELETE_COOLDOWN) return false;
		this.foreground = now;
		if (kind === "delete") this.deletion = now;
		return true;
	}
}
