export type PlatformRole = "USER" | "SUPER_ADMIN";

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type AuthenticatedUserProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  profileCompletedAt: string | null;
  platformRole: PlatformRole;
  accountStatus: AccountStatus;
};

export type CurrentUserResponse = {
  data: AuthenticatedUserProfile;
};

export type SuperAdminPingResponse = {
  data: {
    message: string;
  };
};
