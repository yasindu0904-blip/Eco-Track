import { apiRequest } from "../../api/apiClient";

import type {
  CompletedCleanupEventHistory,
  ContributionPage,
  ImpactSummary,
} from "./reward.types";

type DataResponse<T> = { data: T };

export async function getMyImpactSummary(
  accessToken: string,
): Promise<ImpactSummary> {
  return (await apiRequest<DataResponse<ImpactSummary>>(
    "/rewards/me/summary",
    { accessToken },
  )).data;
}

export async function listMyCompletedCleanupEvents(
  accessToken: string,
  cursor?: string,
): Promise<CompletedCleanupEventHistory> {
  const parameters = new URLSearchParams({ limit: "20" });
  if (cursor) parameters.set("cursor", cursor);

  return (await apiRequest<DataResponse<CompletedCleanupEventHistory>>(
    `/rewards/me/completed-events?${parameters.toString()}`,
    { accessToken },
  )).data;
}

export async function listMyContributions(
  accessToken: string,
  cursor?: string,
): Promise<ContributionPage> {
  const parameters = new URLSearchParams({ limit: "20" });
  if (cursor) parameters.set("cursor", cursor);

  return (await apiRequest<DataResponse<ContributionPage>>(
    `/rewards/me/contributions?${parameters.toString()}`,
    { accessToken },
  )).data;
}
