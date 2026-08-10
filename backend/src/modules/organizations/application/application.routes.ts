import {
  Router,
  type Router as ExpressRouter,
} from "express";

import { createAuthenticationMiddleware } from "../../../middleware/auth.middleware.js";
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
    createOrganizationApplicationController(applicationDependencies),
  );

  router.get(
    "/organization-applications/me",
    authenticate,
    listMyOrganizationApplicationsController(applicationDependencies),
  );

  router.get(
    "/organization-applications/me/:id",
    authenticate,
    getMyOrganizationApplicationController(applicationDependencies),
  );

  return router;
}
