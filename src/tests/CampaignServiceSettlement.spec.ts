import { describe, expect, it } from "@rbxts/jest-globals";
import { Players } from "@rbxts/services";
import { CampaignCoordinator, normalizeProfile } from "../server/CampaignRepository";
import { CampaignService, installCampaignSmokePlayer } from "../server/CampaignService";
import { MissionCatalog } from "../shared/MissionCatalog";
import { Remotes } from "../shared/Types";
import { CAMPAIGN_COMMAND_COOLDOWN } from "../server/CampaignRequestBudget";

// Studio-only transport fixture; real campaign handlers, synthetic cloud store, no worlds/Studio launches.
describe("Campaign service result admission survives cleanup (Studio)", () => {
	for (const removal of [false, true])
		it(`keeps a win when ${removal ? "PlayerRemoving" : "ReturnToMenu"} immediately precedes deferred confirmation`, () => {
			let stored: unknown;
			let clock = 0;
			let messages = 0;
			const queued: (() => void)[] = [];
			const write = () => {
				queued.shift()?.();
			};
			const c = new CampaignCoordinator(
				"service-settlement",
				{
					load() {
						return undefined;
					},
					update(_key, transform) {
						stored = transform(stored);
						return stored;
					},
				},
				{
					clock: () => clock,
					wait: () => {
						clock++;
						write();
					},
					defer: (fn) => {
						queued.push(fn);
					},
					now: () => 1000,
				},
			);
			c.load();
			const player = { Name: "SettlementRegression", UserId: -243, Parent: Players } as unknown as Player;
			const identity = {};
			let session: unknown;
			const combat = {
				IsCompleting() {
					return false;
				},
				GetSession() {
					return session;
				},
				StartMission() {
					session = identity;
					return $tuple(true);
				},
				EndMission() {
					session = undefined;
				},
				CancelLaunch() {
					session = undefined;
				},
			};
			const transport = {
				MissionState: {
					FireClient() {
						messages++;
					},
				},
			} as unknown as Remotes;
			const fixture = installCampaignSmokePlayer(player, c, transport, combat);
			const [ok, err] = pcall(() => {
				expect(fixture.request("StartMission", { slot: 1, missionId: 1 }).ok).toBe(true);
				task.wait(CAMPAIGN_COMMAND_COOLDOWN + 0.01);
				const confirm = CampaignService.OnFinished(
					player,
					true,
					{
						slot: 1,
						missionId: 1,
						kills: 6,
						groundKills: 0,
						completedPhases: MissionCatalog.TotalPhases(MissionCatalog.Get(1)),
						elapsed: 100,
					},
					identity,
				);
				expect(c.getSlots()[0].missions?.[1]?.completed).toBe(true);
				if (removal) fixture.remove();
				else expect(fixture.request("ReturnToMenu").ok).toBe(true);
				write();
				if (confirm) confirm();
				expect(normalizeProfile(stored).slots[0].missions?.[1]?.completed).toBe(true);
				expect(messages).toBe(removal ? 0 : 1);
			});
			fixture.restore();
			assert(ok, tostring(err));
		});
});
