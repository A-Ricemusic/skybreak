import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
export const mission: MissionBlueprint = {
 id: 5, act: 1, codename: "In development", title: "Mission 5", region: "canyon_airfield", environment: "farm_overcast",
 available: false, primary: "In development", briefing: MISSION_STORY_TEXT[5].briefing, debrief: MISSION_STORY_TEXT[5].debrief, failure: MISSION_STORY_TEXT[5].failure,
 ground: [], phases: [{ kind: "required_air", count: 1, label: "In development" }],
};
