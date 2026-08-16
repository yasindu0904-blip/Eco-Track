import { apiRequest } from "../../api/apiClient";
import type { CleanupWorkflow } from "./cleanupWorkflow.types";

export async function fetchCleanupWorkflow(accessToken: string, organizationId: string) {
  const response = await apiRequest<{ data: CleanupWorkflow }>(
    `/organizations/${encodeURIComponent(organizationId)}/cleanup-workflow`,
    { accessToken },
  );
  return response.data;
}

