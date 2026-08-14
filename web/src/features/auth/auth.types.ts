export type PlatformRole =
  | "USER"
  | "SUPER_ADMIN";

export type AccountStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "ARCHIVED";

export interface AuthenticatedUserProfile {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  profileCompletedAt: string | null;
  platformRole: PlatformRole;
  accountStatus: AccountStatus;
}

export interface CurrentUserResponse {
  data: AuthenticatedUserProfile;
}


export interface SuperAdminPingResponse {
  data: {
    message: string;
  };
}
