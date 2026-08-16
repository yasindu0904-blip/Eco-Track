export type PlatformRole = "USER" | "SUPER_ADMIN";

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type MembershipRole = "ORG_MEMBER" | "ORG_ADMIN";

export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "LEFT" | "REMOVED";

export type ActiveOrganizationMembership = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: MembershipRole;
  status: MembershipStatus;
};

export type AuthenticatedUserProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  profileCompletedAt: string | null;
  platformRole: PlatformRole;
  accountStatus: AccountStatus;
  activeMemberships?: ActiveOrganizationMembership[];
};

export type CurrentUserResponse = {
  data: AuthenticatedUserProfile;
};

export type SuperAdminPingResponse = {
  data: {
    message: string;
  };
};
