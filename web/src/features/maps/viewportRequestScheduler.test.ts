import { afterEach, describe, expect, test, vi } from "vitest";

import type { MapViewport, MapViewportRequestContext } from "./map.types";
import { createViewportRequestScheduler } from "./viewportRequestScheduler";

const firstViewport: MapViewport = {
  west: 79.8,
  south: 6.8,
  east: 80,
  north: 7,
  zoom: 12,
};
const secondViewport: MapViewport = {
  ...firstViewport,
  west: 79.81,
  east: 80.01,
};

afterEach(() => vi.useRealTimers());

describe("viewport request scheduling", () => {
  test("coalesces rapid viewport changes into one bounded request", async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const scheduler = createViewportRequestScheduler(callback, 400);

    scheduler.schedule(firstViewport);
    scheduler.schedule(secondViewport);
    await vi.advanceTimersByTimeAsync(399);
    expect(callback).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]?.[0]).toEqual(secondViewport);
    expect((callback.mock.calls[0]?.[1] as MapViewportRequestContext).requestId).toBe(1);
    scheduler.dispose();
  });

  test("aborts an in-flight request before starting the next one", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const callback = vi.fn((_viewport: MapViewport, context: MapViewportRequestContext) => {
      signals.push(context.signal);
      return new Promise<void>(() => undefined);
    });
    const scheduler = createViewportRequestScheduler(callback, 400);

    scheduler.schedule(firstViewport);
    await vi.advanceTimersByTimeAsync(400);
    scheduler.schedule(secondViewport);
    expect(signals[0]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(400);

    expect(callback).toHaveBeenCalledTimes(2);
    expect((callback.mock.calls[1]?.[1] as MapViewportRequestContext).requestId).toBe(2);
    scheduler.dispose();
    expect(signals[1]?.aborted).toBe(true);
  });
});
