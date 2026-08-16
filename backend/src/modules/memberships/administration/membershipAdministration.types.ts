import type {
  MembershipRequestStatus,
  MembershipRole,
  MembershipStatus,
} from "../../../generated/prisma/enums.js";

export type MembershipRequesterDto = {
  id: string;
  fullName: string | null;
  email: string;
  phoneNumber: string | null;
};

export type AdminMembershipRequestDto = {
  id: string;
  requester: MembershipRequesterDto;
  message: string | null;
  status: MembershipRequestStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

export type AdminMembershipRequestPageDto = {
  items: AdminMembershipRequestDto[];
  nextCursor: string | null;
};

export type OrganizationMemberDto = {
  id: string;
  user: MembershipRequesterDto;
  role: MembershipRole;
  status: MembershipStatus;
  source: string;
  joinedAt: string;
  endedAt: string | null;
};

export type OrganizationMemberPageDto = {
  items: OrganizationMemberDto[];
  nextCursor: string | null;
};

export type ActiveOrganizationMembershipDto = {
  membershipId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  role: MembershipRole;
};

export type ActiveOrganizationMembershipPageDto = {
  items: ActiveOrganizationMembershipDto[];
  nextCursor: string | null;
};

export type DateIdCursor = {
  date: Date;
  id: string;
};

export type OrganizationNameCursor = {
  name: string;
  id: string;
};
