import { apiRequest } from "../../api/apiClient";

import type {
  AdministrativeArea,
  AdministrativeAreaListResponse,
  CreateOrganizationApplicationInput,
  OrganizationApplication,
  OrganizationApplicationListResponse,
  OrganizationApplicationResponse,
} from "./organizationApplication.types";

export async function listAdministrativeAreas(
  accessToken: string,
  search: string,
): Promise<AdministrativeArea[]> {
  const parameters = new URLSearchParams({ limit: "50" });

  if (search.trim()) {
    parameters.set("search", search.trim());
  }

  const response = await apiRequest<AdministrativeAreaListResponse>(
    `/administrative-areas?${parameters.toString()}`,
    { accessToken },
  );

  return response.data;
}

export async function createOrganizationApplication(
  accessToken: string,
  application: CreateOrganizationApplicationInput,
): Promise<OrganizationApplication> {
  const response = await apiRequest<OrganizationApplicationResponse>(
    "/organization-applications",
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
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
