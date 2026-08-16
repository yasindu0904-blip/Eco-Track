import { apiRequest } from "../../../api/apiClient";

import type {
  ActiveOrganizationMembership,
  AdminMembershipRequest,
  DataResponse,
  MembershipRole,
  MembershipStatus,
  OrganizationMember,
  Page,
} from "./membershipAdministration.types";

function jsonOptions(accessToken: string, method: string, body: object): RequestInit & { accessToken: string } {
  return {
    method,
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function listMyActiveOrganizationMemberships(accessToken: string, cursor?: string) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  return (await apiRequest<DataResponse<Page<ActiveOrganizationMembership>>>(`/organization-memberships/me/active?${query}`, { accessToken })).data;
}

export async function listPendingMembershipRequests(accessToken: string, organizationId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  return (await apiRequest<DataResponse<Page<AdminMembershipRequest>>>(`/organizations/${encodeURIComponent(organizationId)}/membership-requests?${query}`, { accessToken })).data;
}

export async function approveMembershipRequest(accessToken: string, organizationId: string, requestId: string) {
  return (await apiRequest<DataResponse<AdminMembershipRequest>>(`/organizations/${encodeURIComponent(organizationId)}/membership-requests/${encodeURIComponent(requestId)}/approve`, { method: "PATCH", accessToken })).data;
}

export async function declineMembershipRequest(accessToken: string, organizationId: string, requestId: string, reason: string) {
  return (await apiRequest<DataResponse<AdminMembershipRequest>>(
    `/organizations/${encodeURIComponent(organizationId)}/membership-requests/${encodeURIComponent(requestId)}/decline`,
    jsonOptions(accessToken, "PATCH", { reason }),
  )).data;
}

export async function listOrganizationMembers(
  accessToken: string,
  organizationId: string,
  filters: { query?: string; role?: MembershipRole; status?: MembershipStatus; cursor?: string } = {},
) {
  const query = new URLSearchParams({ limit: "20", query: filters.query ?? "" });
  if (filters.role) query.set("role", filters.role);
  if (filters.status) query.set("status", filters.status);
  if (filters.cursor) query.set("cursor", filters.cursor);
  return (await apiRequest<DataResponse<Page<OrganizationMember>>>(`/organizations/${encodeURIComponent(organizationId)}/members?${query}`, { accessToken })).data;
}

export async function addExistingMember(accessToken: string, organizationId: string, email: string) {
  return (await apiRequest<DataResponse<OrganizationMember>>(
    `/organizations/${encodeURIComponent(organizationId)}/members`,
    jsonOptions(accessToken, "POST", { email }),
  )).data;
}

export async function changeMemberRole(accessToken: string, organizationId: string, membershipId: string, role: MembershipRole) {
  return (await apiRequest<DataResponse<OrganizationMember>>(
    `/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(membershipId)}/role`,
    jsonOptions(accessToken, "PATCH", { role }),
  )).data;
}

export async function changeMemberStatus(accessToken: string, organizationId: string, membershipId: string, status: "ACTIVE" | "SUSPENDED" | "REMOVED") {
  return (await apiRequest<DataResponse<OrganizationMember>>(
    `/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(membershipId)}/status`,
    jsonOptions(accessToken, "PATCH", { status }),
  )).data;
}
