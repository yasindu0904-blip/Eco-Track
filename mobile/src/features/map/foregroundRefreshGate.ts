export type EcoTrackAppState = "active" | "background" | "inactive" | "unknown" | "extension";

export function isForegroundTransition(
  previous: EcoTrackAppState,
  next: EcoTrackAppState,
): boolean {
  return next === "active" && (previous === "background" || previous === "inactive");
}

export function createForegroundRefreshGate(minimumIntervalMilliseconds: number) {
  let lastRefreshAt = Number.NEGATIVE_INFINITY;

  return {
    shouldRefresh(
      previous: EcoTrackAppState,
      next: EcoTrackAppState,
      nowMilliseconds: number,
    ): boolean {
      if (!isForegroundTransition(previous, next)) return false;
      if (nowMilliseconds - lastRefreshAt < minimumIntervalMilliseconds) return false;
      lastRefreshAt = nowMilliseconds;
      return true;
    },
  };
}
