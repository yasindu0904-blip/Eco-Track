import type { AuthenticatedUserProfile } from "../auth/auth.types";

export type MembershipRole = "ORG_MEMBER" | "ORG_ADMIN";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "ENDED";

export type ActiveMembershipSummary = {
  organizationId: string;
  role: MembershipRole;
  status: MembershipStatus;
};

export type AuthorizationUiContext = {
  profile: AuthenticatedUserProfile;
  activeMembership?: ActiveMembershipSummary;
  coordinatedEventIds?: readonly string[];
};

export type UiCapabilities = {
  canUseCitizenFeatures: boolean;
  canUsePlatformOversight: boolean;
  canUseOrganizationWorkspace: boolean;
  canManageMemberships: boolean;
  canCoordinateEvent: (eventId: string) => boolean;
};

export function hasCompletedProfile(
  profile: AuthenticatedUserProfile,
): boolean {
  return Boolean(
    profile.profileCompletedAt &&
      profile.fullName?.trim() &&
      profile.phoneNumber?.trim(),
  );
}

export function buildUiCapabilities(
  context: AuthorizationUiContext,
): UiCapabilities {
  const { profile, activeMembership } = context;
  const isActiveAndComplete =
    profile.accountStatus === "ACTIVE" && hasCompletedProfile(profile);
  const isPlatformUser =
    isActiveAndComplete && profile.platformRole === "USER";
  const hasActiveMembership =
    isPlatformUser && activeMembership?.status === "ACTIVE";
  const isOrganizationAdmin =
    hasActiveMembership && activeMembership.role === "ORG_ADMIN";
  const coordinatedEventIds = new Set(context.coordinatedEventIds ?? []);

  return {
    canUseCitizenFeatures: isPlatformUser,
    canUsePlatformOversight:
      isActiveAndComplete && profile.platformRole === "SUPER_ADMIN",
    canUseOrganizationWorkspace: hasActiveMembership,
    canManageMemberships: isOrganizationAdmin,
    canCoordinateEvent: (eventId) =>
      Boolean(
        isOrganizationAdmin ||
          (hasActiveMembership && coordinatedEventIds.has(eventId)),
      ),
  };
}
