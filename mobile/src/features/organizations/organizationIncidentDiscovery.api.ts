import { apiRequest } from "../../api/apiClient";
import type { MapBoundaryFeatureCollection } from "../map";
import type {
  OrganizationIncidentDetail,
  OrganizationIncidentPage,
  OrganizationIncidentQuery,
  OrganizationIncidentReviewInput,
  OrganizationIncidentReviewMutation,
} from "./organizationIncidentDiscovery.types";

type DataResponse<T> = { data: T };

export async function listOrganizationIncidents(
  accessToken: string,
  organizationId: string,
  input: OrganizationIncidentQuery,
  signal: AbortSignal,
): Promise<OrganizationIncidentPage> {
  const query = new URLSearchParams({
    west: String(input.west),
    south: String(input.south),
    east: String(input.east),
    north: String(input.north),
    zoom: String(Math.round(input.zoom)),
    limit: String(input.limit ?? 100),
  });
  if (input.cursor) query.set("cursor", input.cursor);
  if (input.status) query.set("status", input.status);
  if (input.categoryId) query.set("categoryId", input.categoryId);
  if (input.reportedAfter) query.set("reportedAfter", input.reportedAfter);

  return (
    await apiRequest<DataResponse<OrganizationIncidentPage>>(
      `/organizations/${encodeURIComponent(organizationId)}/incidents?${query}`,
      { accessToken, signal },
    )
  ).data;
}

export async function getOrganizationIncidentDetail(
  accessToken: string,
  organizationId: string,
  incidentId: string,
  signal?: AbortSignal,
): Promise<OrganizationIncidentDetail> {
  return (
    await apiRequest<DataResponse<OrganizationIncidentDetail>>(
      `/organizations/${encodeURIComponent(organizationId)}/incidents/${encodeURIComponent(incidentId)}`,
      { accessToken, signal },
    )
  ).data;
}

export async function updateOrganizationIncidentReview(
  accessToken: string,
  organizationId: string,
  incidentId: string,
  input: OrganizationIncidentReviewInput,
): Promise<OrganizationIncidentReviewMutation> {
  return (
    await apiRequest<DataResponse<OrganizationIncidentReviewMutation>>(
      `/organizations/${encodeURIComponent(organizationId)}/incidents/${encodeURIComponent(incidentId)}/review`,
      {
        method: "PATCH",
        accessToken,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    )
  ).data;
}

export async function listOrganizationServiceAreaBoundaries(
  accessToken: string,
  organizationId: string,
  signal?: AbortSignal,
): Promise<MapBoundaryFeatureCollection> {
  const query = new URLSearchParams({
    scope: "all",
    limit: "500",
  });
  return (
    await apiRequest<DataResponse<MapBoundaryFeatureCollection>>(
      `/organizations/${encodeURIComponent(organizationId)}/service-area-boundaries?${query}`,
      { accessToken, signal },
    )
  ).data;
}
