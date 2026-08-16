import { apiRequest } from "../../../api/apiClient";
import type {
  MapBoundaryFeatureCollection,
  MapViewport,
} from "../../maps";
import type { OrganizationIncidentPage } from "./organizationIncidentReview.types";

interface DataResponse<T> {
  data: T;
}

export async function listOrganizationIncidents(
  accessToken: string,
  organizationId: string,
  viewport: MapViewport,
  signal: AbortSignal,
  status?: string,
): Promise<OrganizationIncidentPage> {
  const query = new URLSearchParams({
    west: String(viewport.west),
    south: String(viewport.south),
    east: String(viewport.east),
    north: String(viewport.north),
    zoom: String(Math.round(viewport.zoom)),
    limit: "100",
  });

  if (status) {
    query.set("status", status);
  }

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
