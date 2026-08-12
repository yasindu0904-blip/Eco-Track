import { apiRequest } from "../api/apiClient";

import type {
  AuthenticatedUserProfile,
  CurrentUserResponse,
  SuperAdminPingResponse,
} from "./auth.types";

export async function fetchCurrentUser(
  accessToken: string,
): Promise<AuthenticatedUserProfile> {
  const response = await apiRequest<CurrentUserResponse>("/auth/me", {
    accessToken,
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
