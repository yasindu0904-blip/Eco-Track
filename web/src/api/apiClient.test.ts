import { afterEach, expect, test, vi } from "vitest";

import { apiRequest } from "./apiClient";

vi.mock("../config/env", () => ({
  webEnv: { apiBaseUrl: "http://localhost:5000/api/v1" },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

test("accepts a successful 204 response and disables stale API caching", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);

  await expect(apiRequest<void>("/sessions/session-1", { method: "DELETE" })).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenCalledWith(
    "http://localhost:5000/api/v1/sessions/session-1",
    expect.objectContaining({ cache: "no-store", method: "DELETE" }),
  );
});
