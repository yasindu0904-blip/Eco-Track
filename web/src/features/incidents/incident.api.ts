import { apiRequest } from "../../api/apiClient";
import { webEnv } from "../../config/env";
import { supabase } from "../../config/supabase";
import type {
  CreateIncidentInput,
  EvidenceUploadIntent,
  IncidentCategory,
  IncidentDetail,
  IncidentSummary,
  UploadedIncidentEvidence,
} from "./incident.types";

interface DataResponse<T> { data: T }

interface CreateIncidentResponse extends DataResponse<IncidentDetail> {
  meta: { idempotentReplay: boolean };
}

export interface CreateIncidentResult {
  incident: IncidentDetail;
  idempotentReplay: boolean;
}

export async function listIncidentCategories(accessToken: string): Promise<IncidentCategory[]> {
  return (await apiRequest<DataResponse<IncidentCategory[]>>("/incident-categories", { accessToken })).data;
}

export async function uploadIncidentEvidence(
  accessToken: string,
  submissionId: string,
  files: File[],
  onProgress: (completed: number, total: number, fileName: string) => void,
): Promise<UploadedIncidentEvidence[]> {
  const intents = (await apiRequest<DataResponse<EvidenceUploadIntent[]>>(
    "/incidents/evidence/upload-intents",
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId,
        files: files.map((file) => ({
          originalFileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        })),
      }),
    },
  )).data;

  const uploaded: UploadedIncidentEvidence[] = [];
  for (const [index, intent] of intents.entries()) {
    const file = files[index];
    if (!file) throw new Error("A selected photo was no longer available.");
    onProgress(index, intents.length, file.name);
    const { error } = await supabase.storage
      .from(webEnv.incidentEvidenceBucket)
      .uploadToSignedUrl(intent.storagePath, intent.token, file, {
        contentType: intent.contentType,
      });
    if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`);
    uploaded.push({
      storagePath: intent.storagePath,
      originalFileName: intent.originalFileName,
      contentType: intent.contentType,
      sizeBytes: intent.sizeBytes,
      sortOrder: index,
    });
    onProgress(index + 1, intents.length, file.name);
  }
  return uploaded;
}

export async function createIncident(
  accessToken: string,
  input: CreateIncidentInput,
): Promise<CreateIncidentResult> {
  const response = await apiRequest<CreateIncidentResponse>("/incidents", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return {
    incident: response.data,
    idempotentReplay: response.meta.idempotentReplay,
  };
}

export async function listMyIncidents(accessToken: string): Promise<IncidentSummary[]> {
  const response = await apiRequest<DataResponse<{ items: IncidentSummary[] }>>(
    "/incidents/me?limit=50",
    { accessToken },
  );
  return response.data.items;
}

export async function getMyIncident(accessToken: string, id: string): Promise<IncidentDetail> {
  return (await apiRequest<DataResponse<IncidentDetail>>(
    `/incidents/me/${encodeURIComponent(id)}`,
    { accessToken },
  )).data;
}
