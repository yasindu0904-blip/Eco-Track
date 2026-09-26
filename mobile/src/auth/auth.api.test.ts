import { afterEach, expect, it, vi } from "vitest";

vi.mock("../config/env", () => ({
  mobileEnv: { apiBaseUrl: "http://test-api.invalid/api/v1" },
}));

import { fetchCurrentUser } from "./auth.api";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("ends session loading when the API never responds and cancels the request", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => {
    signal = options.signal as AbortSignal;
    return new Promise(() => {});
  }));
  const request = fetchCurrentUser("test-token");
  const assertion = expect(request).rejects.toMatchObject({
    statusCode: 0,
    code: "SESSION_PROFILE_TIMEOUT",
  });
  await vi.advanceTimersByTimeAsync(15_000);
  await assertion;
  expect(signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("returns a restored profile and clears its deadline", async () => {
  vi.useFakeTimers();
  const profile = { id: "test-user" };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({ data: profile }),
  }));
  expect(await fetchCurrentUser("test-token")).toEqual(profile);
  expect(vi.getTimerCount()).toBe(0);
});
