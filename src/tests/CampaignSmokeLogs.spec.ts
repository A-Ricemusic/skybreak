import { describe, expect, it } from "@rbxts/jest-globals";
import { classifyCampaignLog, containsLogText, isTerrainCaptureFailureLog } from "./helpers/CampaignSmokeLogs";

describe("campaign runtime log classification", () => {
	it("distinguishes severity and actual substring matches after compilation", () => {
		const fallback = "still loading after the preload deadline; placing fallbacks";
		expect(classifyCampaignLog("unrelated output", Enum.MessageType.MessageOutput)).toBeUndefined();
		expect(classifyCampaignLog("unrelated warning", Enum.MessageType.MessageWarning)).toBeUndefined();
		expect(classifyCampaignLog("real error", Enum.MessageType.MessageError)).toBe("error");
		expect(classifyCampaignLog(fallback, Enum.MessageType.MessageError)).toBe("error");
		expect(classifyCampaignLog(fallback, Enum.MessageType.MessageWarning)).toBe("warning");
		for (const prefix of ["SKYBREAK world lifecycle", "settlement:", "SKYBREAK mission construction failed"])
			expect(classifyCampaignLog(`${prefix} failed`, Enum.MessageType.MessageWarning)).toBe("error");
		const capture = "Owned terrain column exceeds supported ray range";
		expect(containsLogText("unrelated warning", capture)).toBe(false);
		expect(containsLogText(`construction failed: ${capture}`, capture)).toBe(true);
	});
	it("does not collect informational reports containing copied diagnostics", () => {
		const warnings: string[] = [];
		const errors: string[] = [];
		const collect = (message: string, kind: Enum.MessageType) => {
			const result = classifyCampaignLog(message, kind);
			if (result === "warning") warnings.push(message);
			else if (result === "error") errors.push(message);
		};
		collect("still loading after the preload deadline; placing fallbacks", Enum.MessageType.MessageWarning);
		collect("SKYBREAK mission construction failed", Enum.MessageType.MessageError);
		const first = `CAMPAIGN_SMOKE mission=0 WARNING ${warnings.join(" | ")} errors=${errors.join(" | ")}`;
		collect(first, Enum.MessageType.MessageOutput);
		expect(warnings.size()).toBe(1);
		expect(errors.size()).toBe(1);
		const second = `CAMPAIGN_SMOKE mission=1 WARNING ${warnings.join(" | ")} errors=${errors.join(" | ")}`;
		expect(containsLogText(second, "mission=0")).toBe(false);
	});
	it("admits capture diagnostics only at warning/error severity, excluding copied reports and unrelated failures", () => {
		const diagnostic = "construction failed: Owned terrain column exceeds supported ray range";
		const events = [
			{ text: "an unrelated warning", kind: Enum.MessageType.MessageWarning },
			{ text: "an unrelated error", kind: Enum.MessageType.MessageError },
			{ text: `CAMPAIGN_SMOKE copied ${diagnostic}`, kind: Enum.MessageType.MessageOutput },
			{ text: diagnostic, kind: Enum.MessageType.MessageWarning },
			{ text: `stack traceback: ${diagnostic}`, kind: Enum.MessageType.MessageError },
		];
		const accepted = events.filter((event) => isTerrainCaptureFailureLog(event.text, event.kind));
		expect(accepted.map((event) => event.text)).toEqual([diagnostic, `stack traceback: ${diagnostic}`]);
		expect(containsLogText("literal [capture]? failed", "[capture]?")).toBe(true);
		expect(containsLogText("literal c failed", "[capture]?")).toBe(false);
	});
});
