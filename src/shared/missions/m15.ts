import { MISSION_STORY_TEXT } from "../StoryMissionText";
import type { MissionBlueprint } from "../MissionCatalog";
export const mission: MissionBlueprint = {
 id: 15, act: 3, codename: "In development", title: "Mission 15", region: "canyon_airfield", environment: "farm_overcast",
 available: false, primary: "In development", briefing: MISSION_STORY_TEXT[15].briefing, debrief: MISSION_STORY_TEXT[15].debrief, failure: MISSION_STORY_TEXT[15].failure,
 ground: [], phases: [{ kind: "required_air", count: 1, label: "In development" }],
};
