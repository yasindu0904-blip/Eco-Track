import { apiRequest } from "../../api/apiClient";
import type { AuthenticatedUserProfile } from "../../auth/auth.types";

import type {
  MembershipRequest,
  MembershipRequestListResponse,
  MembershipRequestPage,
  MembershipRequestResponse,
  OrganizationSearchPage,
  OrganizationSearchResponse,
  ProfileResponse,
} from "./membershipSelfService.types";

export async function updateMyProfile(accessToken: string, input: { fullName: string; phoneNumber: string }): Promise<AuthenticatedUserProfile> {
  return (await apiRequest<ProfileResponse>("/profile", {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })).data;
}

export async function searchOrganizations(accessToken: string, query: string, cursor?: string): Promise<OrganizationSearchPage> {
  const parameters = new URLSearchParams({ query, limit: "12" });
  if (cursor) parameters.set("cursor", cursor);
  return (await apiRequest<OrganizationSearchResponse>(`/organizations?${parameters.toString()}`, { accessToken })).data;
}

export async function requestMembership(accessToken: string, organizationId: string): Promise<MembershipRequest> {
  return (await apiRequest<MembershipRequestResponse>("/organization-membership-requests", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId }),
  })).data;
}

export async function listMyMembershipRequests(accessToken: string, cursor?: string): Promise<MembershipRequestPage> {
  const parameters = new URLSearchParams({ limit: "20" });
  if (cursor) parameters.set("cursor", cursor);
  return (await apiRequest<MembershipRequestListResponse>(`/organization-membership-requests/me?${parameters.toString()}`, { accessToken })).data;
}

export async function withdrawMembershipRequest(accessToken: string, requestId: string): Promise<MembershipRequest> {
  return (await apiRequest<MembershipRequestResponse>(`/organization-membership-requests/me/${requestId}/withdraw`, {
    method: "PATCH",
    accessToken,
  })).data;
}
