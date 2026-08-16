import type { AuthenticatedUserProfile } from "../../auth/auth.types";

export type MembershipRequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";

export type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type MembershipRequest = {
  id: string;
  organization: PublicOrganization;
  message: string | null;
  status: MembershipRequestStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

export type OrganizationSearchPage = { items: PublicOrganization[]; nextCursor: string | null };
export type MembershipRequestPage = { items: MembershipRequest[]; nextCursor: string | null };
export type ProfileResponse = { data: AuthenticatedUserProfile };
export type OrganizationSearchResponse = { data: OrganizationSearchPage };
export type MembershipRequestResponse = { data: MembershipRequest };
export type MembershipRequestListResponse = { data: MembershipRequestPage };
