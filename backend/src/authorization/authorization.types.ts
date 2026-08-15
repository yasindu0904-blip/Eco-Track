import type {
  CleanupLifecycleStatus,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
} from "../generated/prisma/enums.js";

export type ActiveTenantContext = {
  organization: {
    id: string;
    status: OrganizationStatus;
  };
  membership: {
    id: string;
    organizationId: string;
    userId: string;
    role: MembershipRole;
    status: MembershipStatus;
  };
};

export type EventAuthorizationContext = {
  cleanupEvent: {
    id: string;
    organizationId: string;
    lifecycleStatus: CleanupLifecycleStatus;
  };
  isCoordinator: boolean;
};

export type AuthorizationDependencies = {
  findActiveTenantContext: (
    userId: string,
    organizationId: string,
  ) => Promise<ActiveTenantContext | null>;

  findEventAuthorizationContext: (
    organizationId: string,
    membershipId: string,
    cleanupEventId: string,
  ) => Promise<EventAuthorizationContext | null>;
};
