import { apiRequest } from "../../api/apiClient";

import type {
  OrganizationReviewApplication,
  OrganizationReviewListResponse,
  OrganizationReviewResponse,
} from "./organizationReview.types";

export async function listPendingOrganizationApplications(
  accessToken: string,
): Promise<OrganizationReviewApplication[]> {
  const response = await apiRequest<OrganizationReviewListResponse>(
    "/super-admin/organization-applications",
    { accessToken },
  );

  return response.data;
}

export async function approveOrganizationApplication(
  accessToken: string,
  applicationId: string,
  reviewNotes: string,
): Promise<OrganizationReviewApplication> {
  const response = await apiRequest<OrganizationReviewResponse>(
    `/super-admin/organization-applications/${encodeURIComponent(applicationId)}/approve`,
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNotes: reviewNotes.trim() || undefined }),
    },
  );

  return response.data;
}

export async function declineOrganizationApplication(
  accessToken: string,
  applicationId: string,
  reviewNotes: string,
): Promise<OrganizationReviewApplication> {
  const response = await apiRequest<OrganizationReviewResponse>(
    `/super-admin/organization-applications/${encodeURIComponent(applicationId)}/decline`,
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNotes }),
    },
  );

  return response.data;
}

export async function listPendingOrganizationApplicationPage(accessToken: string, cursor?: string) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  return (await apiRequest<{ data: { items: OrganizationReviewApplication[]; nextCursor: string | null } }>(`/super-admin/organization-applications?${query}`, { accessToken })).data;
}
