export type MembershipRole = "ORG_MEMBER" | "ORG_ADMIN";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "LEFT" | "REMOVED";
export type MembershipRequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";

export type MembershipUser = {
  id: string;
  fullName: string | null;
  email: string;
  phoneNumber: string | null;
};

export type AdminMembershipRequest = {
  id: string;
  requester: MembershipUser;
  message: string | null;
  status: MembershipRequestStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

export type OrganizationMember = {
  id: string;
  user: MembershipUser;
  role: MembershipRole;
  status: MembershipStatus;
  source: string;
  joinedAt: string;
  endedAt: string | null;
};

export type ActiveOrganizationMembership = {
  membershipId: string;
  organization: { id: string; name: string; slug: string };
  role: MembershipRole;
};

export type Page<T> = { items: T[]; nextCursor: string | null };
export type DataResponse<T> = { data: T };
