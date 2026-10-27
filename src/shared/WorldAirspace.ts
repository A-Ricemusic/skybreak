/** World-owned horizontal limits, shared by server flight and client prediction.
 * Keep speed/acceleration tuning in FlightMath. Detailed terrain ends at 4000.
 */
export const WorldAirspace = { soft: 3600, hard: 3800, spawnLimit: 3500, radarRange: 4400 };
