import { Router, type Router as ExpressRouter } from "express";

import { Actions } from "../../../authorization/actions.js";
import { Subjects } from "../../../authorization/subjects.js";
import { abilityMiddleware } from "../../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/authorize.middleware.js";
import type { AuthenticationDependencies } from "../../auth/auth.types.js";
import type { OrganizationApplicationDependencies } from "../application/application.dependencies.js";
import { getOrganizationApplicationReviewController } from "./controllers/getOrganizationApplicationReview.controller.js";
import { listPendingOrganizationApplicationsController } from "./controllers/listPendingOrganizationApplications.controller.js";
import { reviewOrganizationApplicationController } from "./controllers/reviewOrganizationApplication.controller.js";

export function createOrganizationReviewRouter(
  authenticationDependencies: AuthenticationDependencies,
  dependencies: OrganizationApplicationDependencies,
): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(authenticationDependencies);

  router.get(
    "/super-admin/organization-applications",
    authenticate,
    abilityMiddleware,
    authorize(Actions.Read, Subjects.OrganizationApplication),
    listPendingOrganizationApplicationsController(dependencies),
  );

  router.get(
    "/super-admin/organization-applications/:id",
    authenticate,
    abilityMiddleware,
    authorize(Actions.Read, Subjects.OrganizationApplication),
    getOrganizationApplicationReviewController(dependencies),
  );

  router.post(
    "/super-admin/organization-applications/:id/approve",
    authenticate,
    abilityMiddleware,
    authorize(Actions.Approve, Subjects.OrganizationApplication),
    reviewOrganizationApplicationController(dependencies, "APPROVE"),
  );

  router.post(
    "/super-admin/organization-applications/:id/decline",
    authenticate,
    abilityMiddleware,
    authorize(Actions.Decline, Subjects.OrganizationApplication),
    reviewOrganizationApplicationController(dependencies, "DECLINE"),
  );

  return router;
}
