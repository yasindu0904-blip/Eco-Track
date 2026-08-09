import type {
  AccountStatus,
  PlatformRole,
} from "../../generated/prisma/enums.js";

export type VerifiedSupabaseIdentity = {
  authUserId: string;
  email: string;
};

export type AuthenticatedUserProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  platformRole: PlatformRole;
  accountStatus: AccountStatus;
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