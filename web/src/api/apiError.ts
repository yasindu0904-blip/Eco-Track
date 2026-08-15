import { ApiRequestError } from "./apiClient";

export const ApiFailureKinds = {
  Authentication: "authentication",
  ProfileIncomplete: "profileIncomplete",
  Authorization: "authorization",
  Conflict: "conflict",
  Network: "network",
  Unknown: "unknown",
} as const;

export type ApiFailureKind =
  (typeof ApiFailureKinds)[keyof typeof ApiFailureKinds];

export type ApiFailure = {
  kind: ApiFailureKind;
  message: string;
  shouldReturnToSignIn: boolean;
  shouldCompleteProfile: boolean;
};

export function describeApiFailure(
  error: unknown,
  fallbackMessage = "EcoTrack could not complete the request.",
): ApiFailure {
  if (error instanceof ApiRequestError) {
    if (error.statusCode === 401) {
      return {
        kind: ApiFailureKinds.Authentication,
        message:
          "Your session is invalid or expired. Please sign in again.",
        shouldReturnToSignIn: true,
        shouldCompleteProfile: false,
      };
    }

    if (error.code === "PROFILE_INCOMPLETE") {
      return {
        kind: ApiFailureKinds.ProfileIncomplete,
        message: error.message,
        shouldReturnToSignIn: false,
        shouldCompleteProfile: true,
      };
    }

    if (error.statusCode === 403) {
      return {
        kind: ApiFailureKinds.Authorization,
        message: error.message,
        shouldReturnToSignIn: false,
        shouldCompleteProfile: false,
      };
    }

    if (error.statusCode === 409) {
      return {
        kind: ApiFailureKinds.Conflict,
        message: error.message,
        shouldReturnToSignIn: false,
        shouldCompleteProfile: false,
      };
    }

    if (error.statusCode === 0) {
      return {
        kind: ApiFailureKinds.Network,
        message: error.message,
        shouldReturnToSignIn: false,
        shouldCompleteProfile: false,
      };
    }
  }

  return {
    kind: ApiFailureKinds.Unknown,
    message:
      error instanceof Error
        ? error.message
        : fallbackMessage,
    shouldReturnToSignIn: false,
    shouldCompleteProfile: false,
  };
}
