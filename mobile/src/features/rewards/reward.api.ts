import { apiRequest } from "../../api/apiClient";

import type {
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

export async function listMyContributions(
  accessToken: string,
  cursor?: string,
): Promise<ContributionPage> {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);

  return (await apiRequest<DataResponse<ContributionPage>>(
    `/rewards/me/contributions?${query.toString()}`,
    { accessToken },
  )).data;
}
