import { describe, expect, test, vi } from "vitest";

vi.mock("../config/env", () => ({
  mobileEnv: { apiBaseUrl: "http://127.0.0.1:3000/api/v1" },
}));

import { ApiRequestError } from "./apiClient";
import { ApiFailureKinds, describeApiFailure } from "./apiError";

describe("mobile API session recovery contract", () => {
  test.each([
    [0, "NETWORK_REQUEST_FAILED", ApiFailureKinds.Network],
    [403, "FORBIDDEN", ApiFailureKinds.Authorization],
    [409, "INCIDENT_ALREADY_CLAIMED", ApiFailureKinds.Conflict],
  ])("status %i remains recoverable without signing out", (status, code, kind) => {
    const failure = describeApiFailure(
      new ApiRequestError(status, code, "Recoverable request failure."),
    );

    expect(failure.kind).toBe(kind);
    expect(failure.shouldReturnToSignIn).toBe(false);
  });

  test("only an authentication failure requests a return to sign in", () => {
    const failure = describeApiFailure(
      new ApiRequestError(401, "AUTHENTICATION_REQUIRED", "Expired token."),
    );

    expect(failure.kind).toBe(ApiFailureKinds.Authentication);
    expect(failure.shouldReturnToSignIn).toBe(true);
  });
});
