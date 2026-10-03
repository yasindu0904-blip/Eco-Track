import { useCallback, useEffect, useMemo } from "react";

import type { MapViewport, MapViewportChangeHandler } from "./map.types";
import { createViewportRequestScheduler } from "./viewportRequestScheduler";

export function useDebouncedViewport(
  onViewportChange: MapViewportChangeHandler | undefined,
  delayMilliseconds: number,
) {
  const scheduler = useMemo(
    () => createViewportRequestScheduler(
      undefined,
      delayMilliseconds,
      () => console.error("EcoTrack map viewport request failed."),
    ),
    [delayMilliseconds],
  );

  useEffect(() => scheduler.setCallback(onViewportChange), [onViewportChange, scheduler]);
  // Dispose the previous scheduler on replacement and the current scheduler on unmount.
  useEffect(() => () => scheduler.dispose(), [scheduler]);

  return useCallback((viewport: MapViewport) => scheduler.schedule(viewport), [scheduler]);
}
