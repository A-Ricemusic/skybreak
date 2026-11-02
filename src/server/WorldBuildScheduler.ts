/** Frame boundary shared by world assembly. Tests can omit pacing without replacing Roblox's task library. */
export const WorldBuildScheduler = {
 Pause: (): void => { task.wait(); },
};
