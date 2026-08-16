import { apiRequest } from "../../api/apiClient";
import { mobileEnv } from "../../config/env";
import { supabase } from "../../config/supabase";
import type {
  IncidentCategory,
  IncidentDetail,
  IncidentSeverity,
  IncidentSummary,
  MobileIncidentPhoto,
  UploadedEvidence,
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
