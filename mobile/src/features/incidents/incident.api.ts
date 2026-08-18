import { apiRequest } from "../../api/apiClient";
import { mobileEnv } from "../../config/env";
import { supabase } from "../../config/supabase";
import type {
  IncidentCategory,
  IncidentDetail,
  IncidentDiscoveryFilters,
  IncidentRadiusDiscoveryQuery,
  IncidentSeverity,
  IncidentSummary,
  IncidentViewportDiscoveryQuery,
  MobileIncidentPhoto,
  UploadedEvidence,
  PublicIncidentPage,
} from "./incident.types";

type DataResponse<T> = { data: T };
type UploadIntent = {
  storagePath: string; token: string; signedUrl: string;
  originalFileName: string; contentType: string; sizeBytes: number;
};

export async function listIncidentCategories(token: string) {
  return (await apiRequest<DataResponse<IncidentCategory[]>>("/incident-categories", { accessToken: token })).data;
}

export async function uploadEvidence(
  token: string,
  submissionId: string,
  photos: MobileIncidentPhoto[],
  progress: (complete: number, total: number, name: string) => void,
): Promise<UploadedEvidence[]> {
  const intents = (await apiRequest<DataResponse<UploadIntent[]>>("/incidents/evidence/upload-intents", {
    method: "POST",
    accessToken: token,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      submissionId,
      files: photos.map(({ originalFileName, contentType, sizeBytes }) => ({ originalFileName, contentType, sizeBytes })),
    }),
  })).data;

  const uploaded: UploadedEvidence[] = [];
  for (const [index, intent] of intents.entries()) {
    const photo = photos[index];
    if (!photo) throw new Error("A selected photo is no longer available.");
    progress(index, photos.length, photo.originalFileName);
    const { error } = await supabase.storage
      .from(mobileEnv.incidentEvidenceBucket)
      .uploadToSignedUrl(intent.storagePath, intent.token, photo.data, { contentType: photo.contentType });
    if (error) throw new Error(`Could not upload ${photo.originalFileName}: ${error.message}`);
    uploaded.push({
      storagePath: intent.storagePath,
      originalFileName: photo.originalFileName,
      contentType: photo.contentType,
      sizeBytes: photo.sizeBytes,
      sortOrder: index,
    });
    progress(index + 1, photos.length, photo.originalFileName);
  }
  return uploaded;
}

export async function createIncident(token: string, input: {
  submissionId: string; categoryId: string; title: string; description: string;
  severity: IncidentSeverity; latitude: number; longitude: number; addressText?: string;
  evidence: UploadedEvidence[];
}) {
  return (await apiRequest<DataResponse<IncidentDetail>>("/incidents", {
    method: "POST", accessToken: token, headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  })).data;
}

export async function listMyIncidents(token: string) {
  return (await apiRequest<DataResponse<{ items: IncidentSummary[] }>>("/incidents/me?limit=50", { accessToken: token })).data.items;
}

export async function getMyIncident(token: string, id: string) {
  return (await apiRequest<DataResponse<IncidentDetail>>(`/incidents/me/${encodeURIComponent(id)}`, { accessToken: token })).data;
}

export async function getPublicIncident(
  token: string,
  id: string,
  signal?: AbortSignal,
) {
  return (await apiRequest<DataResponse<IncidentDetail>>(
    `/incidents/${encodeURIComponent(id)}`,
    { accessToken: token, signal },
  )).data;
}

function appendDiscoveryFilters(
  parameters: URLSearchParams,
  filters: IncidentDiscoveryFilters,
) {
  if (filters.limit !== undefined) parameters.set("limit", String(filters.limit));
  if (filters.cursor) parameters.set("cursor", filters.cursor);
  if (filters.status) parameters.set("status", filters.status);
  if (filters.categoryId) parameters.set("categoryId", filters.categoryId);
  if (filters.reportedAfter) parameters.set("reportedAfter", filters.reportedAfter);
}

export async function listPublicIncidents(
  token: string,
  query: IncidentViewportDiscoveryQuery,
  signal?: AbortSignal,
): Promise<PublicIncidentPage> {
  const parameters = new URLSearchParams({
    west: String(query.west),
    south: String(query.south),
    east: String(query.east),
    north: String(query.north),
    zoom: String(Math.round(query.zoom)),
  });
  appendDiscoveryFilters(parameters, query);
  return (await apiRequest<DataResponse<PublicIncidentPage>>(
    `/incidents?${parameters}`,
    { accessToken: token, signal },
  )).data;
}

export async function listNearbyPublicIncidents(
  token: string,
  query: IncidentRadiusDiscoveryQuery,
  signal?: AbortSignal,
): Promise<PublicIncidentPage> {
  const parameters = new URLSearchParams({
    latitude: String(query.latitude),
    longitude: String(query.longitude),
    radiusMeters: String(query.radiusMeters),
  });
  appendDiscoveryFilters(parameters, query);
  return (await apiRequest<DataResponse<PublicIncidentPage>>(
    `/incidents/nearby?${parameters}`,
    { accessToken: token, signal },
  )).data;
}
