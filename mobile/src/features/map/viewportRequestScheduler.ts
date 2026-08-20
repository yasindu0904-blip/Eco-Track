import type { MapViewport, MapViewportChangeHandler } from "./map.types";

export interface ViewportRequestScheduler {
  setCallback(callback: MapViewportChangeHandler | undefined): void;
  schedule(viewport: MapViewport): void;
  dispose(): void;
}

export function createViewportRequestScheduler(
  initialCallback: MapViewportChangeHandler | undefined,
  delayMilliseconds: number,
  onError?: () => void,
): ViewportRequestScheduler {
  let callback = initialCallback;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let requestId = 0;

  const disposePending = () => {
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
    controller?.abort();
    controller = undefined;
  };

  return {
    setCallback(nextCallback) {
      callback = nextCallback;
    },
    schedule(viewport) {
      disposePending();
      timeout = setTimeout(() => {
        timeout = undefined;
        if (!callback) return;

        controller = new AbortController();
        requestId += 1;
        const activeController = controller;
        void Promise.resolve(callback(viewport, {
          signal: activeController.signal,
          requestId,
        })).catch(() => {
          if (!activeController.signal.aborted) onError?.();
        });
      }, delayMilliseconds);
    },
    dispose: disposePending,
  };
}
