import { apiRequest } from "../../../api/apiClient";

import type {
  CreateOrganizationApplicationInput,
  OrganizationApplication,
  OrganizationApplicationListResponse,
  OrganizationApplicationResponse,
} from "./organizationApplication.types";

export async function createOrganizationApplication(
  accessToken: string,
  application: CreateOrganizationApplicationInput,
): Promise<OrganizationApplication> {
  const response = await apiRequest<OrganizationApplicationResponse>(
    "/organization-applications",
    {
      method: "POST",
      accessToken,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(application),
    },
  );

  return response.data;
}

export async function listMyOrganizationApplications(
  accessToken: string,
): Promise<OrganizationApplication[]> {
  const response = await apiRequest<OrganizationApplicationListResponse>(
    "/organization-applications/me",
    { accessToken },
  );

  return response.data;
}

export async function getMyOrganizationApplication(
  accessToken: string,
  applicationId: string,
): Promise<OrganizationApplication> {
  const response = await apiRequest<OrganizationApplicationResponse>(
    `/organization-applications/me/${encodeURIComponent(applicationId)}`,
    { accessToken },
  );

  return response.data;
}
