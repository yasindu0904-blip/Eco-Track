import { afterEach, describe, expect, test, vi } from "vitest";

import type { MapViewport, MapViewportRequestContext } from "./map.types";
import { createViewportRequestScheduler } from "./viewportRequestScheduler";

const viewport: MapViewport = {
  west: 79.8,
  south: 6.8,
  east: 80,
  north: 7,
  zoom: 12,
};

afterEach(() => vi.useRealTimers());

describe("mobile viewport request scheduling", () => {
  test("keeps only the newest rapid viewport request", async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const scheduler = createViewportRequestScheduler(callback, 400);

    scheduler.schedule(viewport);
    scheduler.schedule({ ...viewport, zoom: 13 });
    await vi.advanceTimersByTimeAsync(400);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]?.[0].zoom).toBe(13);
    scheduler.dispose();
  });

  test("aborts active work on a newer viewport and on disposal", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const callback = vi.fn((_nextViewport: MapViewport, context: MapViewportRequestContext) => {
      signals.push(context.signal);
      return new Promise<void>(() => undefined);
    });
    const scheduler = createViewportRequestScheduler(callback, 400);

    scheduler.schedule(viewport);
    await vi.advanceTimersByTimeAsync(400);
    scheduler.schedule({ ...viewport, zoom: 13 });
    expect(signals[0]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(400);
    scheduler.dispose();
    expect(signals[1]?.aborted).toBe(true);
  });
});
