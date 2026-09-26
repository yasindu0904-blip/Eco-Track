import { ApiRequestError, apiRequest } from "../api/apiClient";

import type {
  AuthenticatedUserProfile,
  CurrentUserResponse,
  SuperAdminPingResponse,
} from "./auth.types";

export async function fetchCurrentUser(
  accessToken: string,
): Promise<AuthenticatedUserProfile> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new ApiRequestError(
        0,
        "SESSION_PROFILE_TIMEOUT",
        "EcoTrack could not reach the API in time. Check your connection. For a laptop backend, its network address may have changed.",
      ));
      controller.abort();
    }, 15_000);
  });

  try {
    const response = await Promise.race([
      apiRequest<CurrentUserResponse>("/auth/me", {
        accessToken,
        signal: controller.signal,
      }),
      deadline,
    ]);
    return response.data;
  } finally {
    clearTimeout(timer);
  }
}

export async function completeCurrentUserProfile(
  accessToken: string,
  input: { fullName: string; phoneNumber: string },
): Promise<AuthenticatedUserProfile> {
  const response = await apiRequest<CurrentUserResponse>("/profile/complete", {
    method: "PUT",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function pingSuperAdmin(accessToken: string): Promise<string> {
  const response = await apiRequest<SuperAdminPingResponse>(
    "/super-admin/ping",
    { accessToken },
  );

  return response.data.message;
}
