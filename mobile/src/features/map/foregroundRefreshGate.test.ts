import { describe, expect, test } from "vitest";

import { createForegroundRefreshGate, isForegroundTransition } from "./foregroundRefreshGate";

describe("foreground map refresh", () => {
  test("recognizes only background or inactive transitions to active", () => {
    expect(isForegroundTransition("background", "active")).toBe(true);
    expect(isForegroundTransition("inactive", "active")).toBe(true);
    expect(isForegroundTransition("active", "active")).toBe(false);
    expect(isForegroundTransition("active", "background")).toBe(false);
  });

  test("throttles repeated foreground transitions", () => {
    const gate = createForegroundRefreshGate(10_000);
    expect(gate.shouldRefresh("background", "active", 1_000)).toBe(true);
    expect(gate.shouldRefresh("inactive", "active", 5_000)).toBe(false);
    expect(gate.shouldRefresh("background", "active", 11_000)).toBe(true);
  });
});
