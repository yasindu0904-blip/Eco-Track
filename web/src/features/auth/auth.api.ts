import { apiRequest } from "../../api/apiClient";

import type {
  AuthenticatedUserProfile,
  CurrentUserResponse,
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