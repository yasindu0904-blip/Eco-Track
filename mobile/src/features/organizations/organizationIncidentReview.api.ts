import { apiRequest } from "../../api/apiClient";
import type { MapBoundaryFeatureCollection } from "../map";
import type { OrganizationIncidentPage } from "./organizationIncidentReview.types";

type DataResponse<T> = { data: T };

export async function listOrganizationIncidents(
  accessToken: string,
  organizationId: string,
  signal: AbortSignal,
): Promise<OrganizationIncidentPage> {
  const query = new URLSearchParams({
    scope: "all",
  });

  return (
    await apiRequest<DataResponse<OrganizationIncidentPage>>(
      `/organizations/${encodeURIComponent(organizationId)}/incidents?${query}`,
      { accessToken, signal },
    )
  ).data;
}

export async function listOrganizationServiceAreaBoundaries(
  accessToken: string,
  organizationId: string,
): Promise<MapBoundaryFeatureCollection> {
  return (
    await apiRequest<DataResponse<MapBoundaryFeatureCollection>>(
      `/organizations/${encodeURIComponent(organizationId)}/service-area-boundaries`,
      { accessToken },
    )
  ).data;
}
