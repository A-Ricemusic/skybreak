import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
export const mission: MissionBlueprint = {
 id: 10, act: 2, codename: "In development", title: "Mission 10", region: "canyon_airfield", environment: "farm_overcast",
 available: false, primary: "In development", briefing: MISSION_STORY_TEXT[10].briefing, debrief: MISSION_STORY_TEXT[10].debrief, failure: MISSION_STORY_TEXT[10].failure,
 ground: [], phases: [{ kind: "required_air", count: 1, label: "In development" }],
};
