import type {
  AccountStatus,
  MembershipRole,
  MembershipStatus,
  PlatformRole,
} from "../../generated/prisma/enums.js";

export type VerifiedSupabaseIdentity = {
  authUserId: string;
  email: string;
};

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
  profileCompletedAt: Date | null;
  platformRole: PlatformRole;
  accountStatus: AccountStatus;
  activeMemberships?: ActiveOrganizationMembership[];
};

export type AuthenticationContext = {
  authUserId: string;
  profile: AuthenticatedUserProfile;
};

export type AuthenticationDependencies = {
  verifyAccessToken: (
    accessToken: string,
  ) => Promise<VerifiedSupabaseIdentity | null>;

  provisionOrSynchronizeProfile: (
    identity: VerifiedSupabaseIdentity,
  ) => Promise<AuthenticatedUserProfile>;
};
