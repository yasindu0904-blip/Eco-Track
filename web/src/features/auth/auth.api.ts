import { apiRequest } from "../../api/apiClient";

import type {
  AuthenticatedUserProfile,
  CurrentUserResponse,
  SuperAdminPingResponse,
} from "./auth.types";

export async function fetchCurrentUser(
  accessToken: string,
): Promise<AuthenticatedUserProfile> {
  const response =
    await apiRequest<CurrentUserResponse>(
      "/auth/me",
      {
        accessToken,
      },
    );

  return response.data;
}

export async function completeCurrentUserProfile(
  accessToken: string,
  input: { fullName: string; phoneNumber: string },
): Promise<AuthenticatedUserProfile> {
  const response =
    await apiRequest<CurrentUserResponse>(
      "/profile/complete",
      {
        method: "PUT",
        accessToken,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );

  return response.data;
}


export async function pingSuperAdmin(
  accessToken: string,
): Promise<string> {
  const response =
    await apiRequest<SuperAdminPingResponse>(
      "/super-admin/ping",
      {
        accessToken,
      },
    );

  return response.data.message;
}
