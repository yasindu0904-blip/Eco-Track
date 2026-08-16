import type { MembershipRequestStatus } from "../../../generated/prisma/enums.js";

export type PublicOrganizationDto = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type OrganizationSearchPageDto = {
  items: PublicOrganizationDto[];
  nextCursor: string | null;
};

export type MembershipRequestDto = {
  id: string;
  organization: PublicOrganizationDto;
  message: string | null;
  status: MembershipRequestStatus;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

export type MembershipRequestPageDto = {
  items: MembershipRequestDto[];
  nextCursor: string | null;
};

export type OrganizationSearchCursor = {
  name: string;
  id: string;
};

export type MembershipRequestCursor = {
  createdAt: Date;
  id: string;
};
