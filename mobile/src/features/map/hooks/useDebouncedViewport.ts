import { useCallback, useEffect, useRef } from "react";

import type {
  MapViewport,
  MapViewportChangeHandler,
} from "../map.types";

export function useDebouncedViewport(
  onViewportChange: MapViewportChangeHandler | undefined,
  delayMilliseconds: number,
) {
  const callbackRef = useRef(onViewportChange);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    callbackRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      controllerRef.current?.abort();
    },
    [],
  );

  return useCallback(
    (viewport: MapViewport) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      controllerRef.current?.abort();

      timeoutRef.current = setTimeout(() => {
        const callback = callbackRef.current;

        if (!callback) {
          return;
        }

        const controller = new AbortController();
        controllerRef.current = controller;
        requestIdRef.current += 1;

        void Promise.resolve(
          callback(viewport, {
            signal: controller.signal,
            requestId: requestIdRef.current,
          }),
        ).catch((error: unknown) => {
          if (!controller.signal.aborted) {
            console.error("EcoTrack mobile map viewport request failed.", error);
          }
        });
      }, delayMilliseconds);
    },
    [delayMilliseconds],
  );
}
