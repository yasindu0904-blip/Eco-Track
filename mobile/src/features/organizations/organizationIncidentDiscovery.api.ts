import { apiRequest } from "../../api/apiClient";
import type { MapBoundaryFeatureCollection, MapViewport } from "../map";
import type {
  OrganizationIncidentPage,
  OrganizationIncidentQuery,
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

export async function listOrganizationServiceAreaBoundaries(
  accessToken: string,
  organizationId: string,
  viewport: MapViewport & { limit?: number },
  signal?: AbortSignal,
): Promise<MapBoundaryFeatureCollection> {
  const query = new URLSearchParams({
    west: String(viewport.west),
    south: String(viewport.south),
    east: String(viewport.east),
    north: String(viewport.north),
    zoom: String(Math.round(viewport.zoom)),
    limit: String(viewport.limit ?? 100),
  });
  return (
    await apiRequest<DataResponse<MapBoundaryFeatureCollection>>(
      `/organizations/${encodeURIComponent(organizationId)}/service-area-boundaries?${query}`,
      { accessToken, signal },
    )
  ).data;
}
