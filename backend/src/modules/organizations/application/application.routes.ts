import {
  Router,
  type Router as ExpressRouter,
} from "express";

import { Actions } from "../../../authorization/actions.js";
import { Subjects } from "../../../authorization/subjects.js";
import { abilityMiddleware } from "../../../middleware/ability.middleware.js";
import { createAuthenticationMiddleware } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/authorize.middleware.js";
import { requireCompletedProfile } from "../../../middleware/requireCompletedProfile.middleware.js";
import type { AuthenticationDependencies } from "../../auth/auth.types.js";

import type { OrganizationApplicationDependencies } from "./application.dependencies.js";
import { createOrganizationApplicationController } from "./controllers/createOrganizationApplication.controller.js";
import { getMyOrganizationApplicationController } from "./controllers/getMyOrganizationApplication.controller.js";
import { listMyOrganizationApplicationsController } from "./controllers/listMyOrganizationApplications.controller.js";

export function createOrganizationApplicationRouter(
  authenticationDependencies: AuthenticationDependencies,
  applicationDependencies: OrganizationApplicationDependencies,
): ExpressRouter {
  const router = Router();
  const authenticate = createAuthenticationMiddleware(
    authenticationDependencies,
  );

  router.post(
    "/organization-applications",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    authorize(
      Actions.Create,
      Subjects.OrganizationApplication,
    ),
    createOrganizationApplicationController(applicationDependencies),
  );

  router.get(
    "/organization-applications/me",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    authorize(
      Actions.ReadOwn,
      Subjects.OrganizationApplication,
    ),
    listMyOrganizationApplicationsController(applicationDependencies),
  );

  router.get(
    "/organization-applications/me/:id",
    authenticate,
    requireCompletedProfile,
    abilityMiddleware,
    authorize(
      Actions.ReadOwn,
      Subjects.OrganizationApplication,
    ),
    getMyOrganizationApplicationController(applicationDependencies),
  );

  return router;
}
