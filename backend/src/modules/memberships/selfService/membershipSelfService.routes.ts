import { Router, type Router as ExpressRouter } from "express";

import { Actions } from "../../../authorization/actions.js";
import { Subjects } from "../../../authorization/subjects.js";
import { abilityMiddleware } from "../../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../../middleware/requireCompletedProfile.middleware.js";
import type { AuthenticationDependencies } from "../../auth/auth.types.js";

import {
  createMembershipRequestController,
  getMyMembershipRequestController,
  listMyMembershipRequestsController,
  searchActiveOrganizationsController,
  withdrawMembershipRequestController,
} from "./membershipSelfService.controllers.js";
import type { MembershipSelfServiceDependencies } from "./membershipSelfService.dependencies.js";

export function createMembershipSelfServiceRouter(
  authenticationDependencies: AuthenticationDependencies,
  membershipDependencies: MembershipSelfServiceDependencies,
): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(authenticationDependencies);
  const protectedRoute = [
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
  ] as const;

  router.get(
    "/organizations",
    ...protectedRoute,
    authorize(Actions.Read, Subjects.Organization),
    searchActiveOrganizationsController(membershipDependencies),
  );

  router.post(
    "/organization-membership-requests",
    ...protectedRoute,
    authorize(Actions.Create, Subjects.OrganizationMembership),
    createMembershipRequestController(membershipDependencies),
  );

  router.get(
    "/organization-membership-requests/me",
    ...protectedRoute,
    authorize(Actions.ReadOwn, Subjects.OrganizationMembership),
    listMyMembershipRequestsController(membershipDependencies),
  );

  router.get(
    "/organization-membership-requests/me/:requestId",
    ...protectedRoute,
    authorize(Actions.ReadOwn, Subjects.OrganizationMembership),
    getMyMembershipRequestController(membershipDependencies),
  );

  router.patch(
    "/organization-membership-requests/me/:requestId/withdraw",
    ...protectedRoute,
    authorize(Actions.Withdraw, Subjects.OrganizationMembership),
    withdrawMembershipRequestController(membershipDependencies),
  );

  return router;
}
