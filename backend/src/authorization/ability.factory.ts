import { AbilityBuilder } from "@casl/ability";

import type { AuthenticatedUserProfile } from "../modules/auth/auth.types.js";

import { Actions } from "./actions.js";
import type { AppAbility } from "./ability.types.js";
import type { ActiveTenantContext } from "./authorization.types.js";
import { createPrismaAbility } from "./caslPrisma.js";
import { Subjects } from "./subjects.js";

type BuildAbilityContext = {
  profile: AuthenticatedUserProfile;
  tenant?: ActiveTenantContext;
};

export function buildAbilityForRequest(
  context: BuildAbilityContext,
): AppAbility {
  const { can, build } =
    new AbilityBuilder<AppAbility>(
      createPrismaAbility,
    );

  const { profile, tenant } = context;

  if (profile.accountStatus !== "ACTIVE") {
    return build();
  }

  can(Actions.Create, Subjects.OrganizationApplication);
  can(
    Actions.ReadOwn,
    Subjects.OrganizationApplication,
  );
  can(Actions.ReadOwn, Subjects.Notification);

  if (profile.platformRole === "SUPER_ADMIN") {
    can(Actions.Read, Subjects.Platform);
    can(
      [
        Actions.Read,
        Actions.Review,
        Actions.Approve,
        Actions.Decline,
      ],
      Subjects.OrganizationApplication,
    );
    can(Actions.Read, Subjects.Organization);
    can(
      Actions.Read,
      Subjects.OrganizationServiceArea,
    );
  }

  if (
    !tenant ||
    tenant.organization.status !== "ACTIVE" ||
    tenant.membership.status !== "ACTIVE"
  ) {
    return build();
  }

  const organizationId = tenant.organization.id;

  can(Actions.Read, Subjects.Organization, {
    id: organizationId,
  });
  can(
    Actions.Read,
    Subjects.OrganizationServiceArea,
    {
      organizationId,
    },
  );

  if (tenant.membership.role === "ORG_ADMIN") {
    can(Actions.Update, Subjects.Organization, {
      id: organizationId,
    });
    can(
      Actions.ManageMembership,
      Subjects.OrganizationMembership,
      {
        organizationId,
      },
    );
  }

  return build();
}
