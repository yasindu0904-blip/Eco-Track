import { Router, type Router as ExpressRouter } from "express";

import { Actions } from "../../../authorization/actions.js";
import { Subjects } from "../../../authorization/subjects.js";
import type { AuthorizationDependencies } from "../../../authorization/authorization.types.js";
import { abilityMiddleware } from "../../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../../middleware/requireCompletedProfile.middleware.js";
import { createTenantMiddleware } from "../../../middleware/tenant.middleware.js";
import type { AuthenticationDependencies } from "../../auth/auth.types.js";

import {
  addExistingMemberController,
  approveMembershipRequestController,
  changeMembershipRoleController,
  changeMembershipStatusController,
  declineMembershipRequestController,
  listMyActiveMembershipsController,
  listOrganizationMembersController,
  listPendingMembershipRequestsController,
} from "./membershipAdministration.controllers.js";
import type { MembershipAdministrationDependencies } from "./membershipAdministration.dependencies.js";

export function createMembershipAdministrationRouter(
  authenticationDependencies: AuthenticationDependencies,
  authorizationDependencies: AuthorizationDependencies,
  membershipDependencies: MembershipAdministrationDependencies,
): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(authenticationDependencies);

  router.get(
    "/organization-memberships/me/active",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    authorize(Actions.ReadOwn, Subjects.OrganizationMembership),
    listMyActiveMembershipsController(membershipDependencies),
  );

  const tenantRoute = [
    authenticate,
    requireCompletedProfile,
    createTenantMiddleware(authorizationDependencies),
    abilityMiddleware,
  ] as const;

  router.get(
    "/organizations/:organizationId/membership-requests",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.OrganizationMembership),
    listPendingMembershipRequestsController(membershipDependencies),
  );
  router.patch(
    "/organizations/:organizationId/membership-requests/:requestId/approve",
    ...tenantRoute,
    authorize(Actions.ManageMembership, Subjects.OrganizationMembership),
    approveMembershipRequestController(membershipDependencies),
  );
  router.patch(
    "/organizations/:organizationId/membership-requests/:requestId/decline",
    ...tenantRoute,
    authorize(Actions.ManageMembership, Subjects.OrganizationMembership),
    declineMembershipRequestController(membershipDependencies),
  );
  router.get(
    "/organizations/:organizationId/members",
    ...tenantRoute,
    authorize(Actions.Read, Subjects.OrganizationMembership),
    listOrganizationMembersController(membershipDependencies),
  );
  router.post(
    "/organizations/:organizationId/members",
    ...tenantRoute,
    authorize(Actions.ManageMembership, Subjects.OrganizationMembership),
    addExistingMemberController(membershipDependencies),
  );
  router.patch(
    "/organizations/:organizationId/members/:membershipId/role",
    ...tenantRoute,
    authorize(Actions.ManageMembership, Subjects.OrganizationMembership),
    changeMembershipRoleController(membershipDependencies),
  );
  router.patch(
    "/organizations/:organizationId/members/:membershipId/status",
    ...tenantRoute,
    authorize(Actions.ManageMembership, Subjects.OrganizationMembership),
    changeMembershipStatusController(membershipDependencies),
  );

  return router;
}
