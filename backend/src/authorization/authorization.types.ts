import type {
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

export type AuthorizationDependencies = {
  findActiveTenantContext: (
    userId: string,
    organizationId: string,
  ) => Promise<ActiveTenantContext | null>;
};
